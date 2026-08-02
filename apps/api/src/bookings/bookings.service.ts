import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  CancelledByRole,
  Prisma,
  SlipStatus,
  type Booking,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SlipVerificationService } from '../slips/slip-verification.service';
import {
  BookingSlipStorageService,
  type UploadedSlipFile,
} from './booking-slip-storage.service';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.CONFIRMED,
];
const DEFAULT_BOOKING_QUOTA = 2;
const HOLD_DURATION_MS = 5 * 60 * 1000;

type BookingResponse = Omit<Booking, 'boothPrice'> & { boothPrice: string };

interface SlipBooking {
  id: string;
  status: BookingStatus;
  boothPrice: Prisma.Decimal;
  holdExpiresAt: Date | null;
  confirmedAt: Date | null;
}

export interface BookingSlipResponse {
  booking: Pick<SlipBooking, 'id' | 'status' | 'confirmedAt' | 'holdExpiresAt'>;
  verification: {
    status: SlipStatus;
    message: string;
  };
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly slipVerification: SlipVerificationService,
    private readonly slipStorage: BookingSlipStorageService,
  ) {}

  async create(
    createBookingDto: CreateBookingDto,
    vendorUserId: string,
  ): Promise<BookingResponse> {
    const { eventId, boothId, shopId } = createBookingDto;
    const [event, booth, shop] = await Promise.all([
      this.prisma.event.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          organizationId: true,
          venueId: true,
          startDate: true,
          endDate: true,
          organization: {
            select: {
              orgConfig: {
                select: { bookingQuotaPerVendor: true },
              },
            },
          },
        },
      }),
      this.prisma.booth.findUnique({
        where: { id: boothId },
        select: {
          id: true,
          boothPrice: true,
          zone: { select: { venueId: true } },
        },
      }),
      this.prisma.shop.findFirst({
        where: { id: shopId, ownerUserId: vendorUserId },
        select: { id: true },
      }),
    ]);

    if (!event) {
      throw new NotFoundException('ไม่พบอีเวนต์');
    }
    if (!booth) {
      throw new NotFoundException('ไม่พบบูธ');
    }
    if (!shop) {
      throw new NotFoundException('ไม่พบร้านค้าของผู้ใช้');
    }

    if (booth.zone.venueId !== event.venueId) {
      throw new BadRequestException('บูธนี้ไม่ได้อยู่ในสถานที่จัดงาน');
    }

    const bookingStartDate = event.startDate;
    const bookingEndDate = event.endDate;
    if (
      bookingStartDate < event.startDate ||
      bookingEndDate > event.endDate ||
      bookingStartDate > bookingEndDate
    ) {
      throw new BadRequestException('ช่วงวันที่จองไม่อยู่ในช่วงวันที่จัดงาน');
    }

    const activeBooking = await this.prisma.booking.findFirst({
      where: {
        eventId,
        boothId,
        status: { in: ACTIVE_BOOKING_STATUSES },
      },
      select: { id: true },
    });
    if (activeBooking) {
      throw new ConflictException('บูธนี้ถูกจองไปแล้ว');
    }

    const activeBookingCount = await this.prisma.booking.count({
      where: {
        eventId,
        vendorUserId,
        status: { in: ACTIVE_BOOKING_STATUSES },
      },
    });
    const orgQuota =
      event.organization.orgConfig?.bookingQuotaPerVendor ?? null;
    const platformConfig =
      orgQuota === null
        ? await this.prisma.platformConfig.findFirst({
            orderBy: { updatedAt: 'desc' },
            select: { defaultBookingQuota: true },
          })
        : null;
    const quota =
      orgQuota ?? platformConfig?.defaultBookingQuota ?? DEFAULT_BOOKING_QUOTA;

    if (activeBookingCount >= quota) {
      throw new ConflictException('คุณจองบูธในงานนี้ครบโควตาแล้ว');
    }

    const now = new Date();
    const data: Prisma.BookingUncheckedCreateInput = {
      bookingCode: this.createBookingCode(),
      eventId,
      boothId,
      shopId,
      vendorUserId,
      bookingStartDate,
      bookingEndDate,
      boothPrice: booth.boothPrice,
      isPaymentExempt: false,
      status: BookingStatus.PENDING_PAYMENT,
      holdExpiresAt: new Date(now.getTime() + HOLD_DURATION_MS),
    };

    try {
      const booking = await this.prisma.booking.create({ data });
      return this.toResponse(booking);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('บูธนี้ถูกจองไปแล้ว');
      }
      throw error;
    }
  }

  async uploadSlip(
    bookingId: string,
    file: UploadedSlipFile,
    vendorUserId: string,
  ): Promise<BookingSlipResponse> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, vendorUserId },
      select: {
        id: true,
        status: true,
        boothPrice: true,
        holdExpiresAt: true,
        confirmedAt: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('ไม่พบการจอง');
    }
    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      throw new ConflictException('การจองนี้ไม่อยู่ในสถานะรอชำระเงิน');
    }

    const checkedAt = new Date();
    if (!booking.holdExpiresAt || booking.holdExpiresAt <= checkedAt) {
      throw new ConflictException('หมดเวลาชำระเงินสำหรับการจองนี้แล้ว');
    }

    const storedSlip = await this.slipStorage.uploadForVerification(
      file,
      booking.id,
      vendorUserId,
    );

    let result;
    try {
      result = await this.slipVerification.verify({
        bookingId: booking.id,
        slipImageUrl: storedSlip.verificationUrl,
        storedObjectPath: storedSlip.objectPath,
        expectedAmount: booking.boothPrice,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return this.toSlipResponse(
          booking,
          SlipStatus.DUPLICATE,
          'สลิปนี้ถูกใช้แล้ว',
        );
      }

      return this.toSlipResponse(
        booking,
        SlipStatus.ERROR,
        'ไม่สามารถตรวจสอบสลิปได้ กรุณาลองใหม่',
      );
    }

    if (
      result.status === SlipStatus.VERIFIED &&
      result.amount?.equals(booking.boothPrice) === true
    ) {
      const confirmedAt = new Date();
      const updated = await this.prisma.booking.updateMany({
        where: {
          id: booking.id,
          vendorUserId,
          status: BookingStatus.PENDING_PAYMENT,
          holdExpiresAt: { gt: confirmedAt },
        },
        data: {
          status: BookingStatus.CONFIRMED,
          confirmedAt,
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException('การจองหมดเวลาหรือสถานะเปลี่ยนไปแล้ว');
      }

      return this.toSlipResponse(
        {
          ...booking,
          status: BookingStatus.CONFIRMED,
          confirmedAt,
        },
        SlipStatus.VERIFIED,
        'ตรวจสอบสลิปสำเร็จ',
      );
    }

    if (result.status === SlipStatus.VERIFIED) {
      return this.toSlipResponse(
        booking,
        SlipStatus.INVALID,
        'ยอดเงินในสลิปไม่ตรงกับยอดที่ต้องชำระ',
      );
    }

    return this.toSlipResponse(
      booking,
      result.status,
      this.safeSlipMessage(result.status),
    );
  }

  async findAll(vendorUserId: string): Promise<BookingResponse[]> {
    const bookings = await this.prisma.booking.findMany({
      where: { vendorUserId },
    });
    return bookings.map((booking) => this.toResponse(booking));
  }

  async cancel(
    bookingId: string,
    cancelBookingDto: CancelBookingDto,
    vendorUserId: string,
  ): Promise<BookingResponse> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, vendorUserId },
      select: {
        id: true,
        status: true,
        bookingStartDate: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('ไม่พบการจอง');
    }
    if (!ACTIVE_BOOKING_STATUSES.includes(booking.status)) {
      throw new ConflictException('การจองนี้ไม่สามารถยกเลิกได้');
    }

    const cancelledAt = new Date();
    if (booking.bookingStartDate <= cancelledAt) {
      throw new ConflictException('ไม่สามารถยกเลิกหลังวันเริ่มจองได้');
    }

    const updated = await this.prisma.booking.updateMany({
      where: {
        id: booking.id,
        vendorUserId,
        status: { in: ACTIVE_BOOKING_STATUSES },
        bookingStartDate: { gt: cancelledAt },
      },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledByUserId: vendorUserId,
        cancelledByRole: CancelledByRole.VENDOR,
        cancelReason: cancelBookingDto.cancelReason,
        cancelledAt,
      },
    });

    if (updated.count !== 1) {
      throw new ConflictException('การจองหมดเวลาหรือสถานะเปลี่ยนไปแล้ว');
    }

    const cancelledBooking = await this.prisma.booking.findUnique({
      where: { id: booking.id },
    });
    if (!cancelledBooking) {
      throw new NotFoundException('ไม่พบการจอง');
    }

    return this.toResponse(cancelledBooking);
  }

  findOne(id: string) {
    return this.prisma.booking.findUnique({
      where: { id },
    });
  }

  update(id: string, updateBookingDto: UpdateBookingDto) {
    return this.prisma.booking.update({
      where: { id },
      data: updateBookingDto,
    });
  }

  remove(id: string) {
    return this.prisma.booking.delete({
      where: { id },
    });
  }

  private createBookingCode(): string {
    const token = randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
    return `BK-${token}`;
  }

  private toResponse(booking: Booking): BookingResponse {
    const { boothPrice, ...rest } = booking;
    return { ...rest, boothPrice: boothPrice.toString() };
  }

  private toSlipResponse(
    booking: SlipBooking,
    status: SlipStatus,
    message: string,
  ): BookingSlipResponse {
    return {
      booking: {
        id: booking.id,
        status: booking.status,
        confirmedAt: booking.confirmedAt,
        holdExpiresAt: booking.holdExpiresAt,
      },
      verification: { status, message },
    };
  }

  private safeSlipMessage(status: SlipStatus): string {
    switch (status) {
      case SlipStatus.INVALID:
        return 'สลิปไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่';
      case SlipStatus.DUPLICATE:
        return 'สลิปนี้ถูกใช้แล้ว';
      case SlipStatus.ERROR:
        return 'ไม่สามารถตรวจสอบสลิปได้ กรุณาลองใหม่';
      case SlipStatus.VERIFIED:
        return 'ตรวจสอบสลิปสำเร็จ';
    }
  }
}
