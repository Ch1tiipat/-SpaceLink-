import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  BoothStatus,
  CancelledByRole,
  EventStatus,
  NotificationType,
  OrgStatus,
  Prisma,
  SlipStatus,
  UserRole,
  type Booking,
  type User,
} from '@prisma/client';
import generatePromptPayPayload from 'promptpay-qr';
import QRCode from 'qrcode';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SlipVerificationService } from '../slips/slip-verification.service';
import {
  BookingSlipStorageService,
  type UploadedSlipFile,
} from './booking-slip-storage.service';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { ConfirmExemptBookingDto } from './dto/confirm-exempt-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.CONFIRMED,
];
const DEFAULT_BOOKING_QUOTA = 2;
const HOLD_DURATION_MS = 5 * 60 * 1000;
const SERIALIZABLE_TRANSACTION_ATTEMPTS = 3;
const BOOKABLE_EVENT_STATUSES: EventStatus[] = [
  EventStatus.PUBLISHED,
  EventStatus.ONGOING,
];

const bookingListInclude = {
  event: {
    select: {
      id: true,
      name: true,
      organization: { select: { promptpayId: true } },
    },
  },
  booth: {
    select: {
      id: true,
      code: true,
      zone: { select: { id: true, code: true, name: true } },
    },
  },
  shop: { select: { id: true, name: true } },
} satisfies Prisma.BookingInclude;

const adminBookingInclude = {
  event: {
    select: {
      id: true,
      name: true,
      organizationId: true,
      organization: { select: { id: true, name: true } },
    },
  },
  shop: { select: { id: true, name: true } },
  vendor: { select: { id: true, email: true, fullName: true } },
  booth: {
    select: {
      id: true,
      code: true,
      zone: { select: { id: true, code: true, name: true } },
    },
  },
} satisfies Prisma.BookingInclude;

export type BookingResponse = Omit<Booking, 'boothPrice'> & {
  boothPrice: string;
};
type BookingListRecord = Prisma.BookingGetPayload<{
  include: typeof bookingListInclude;
}>;
type BookingListResponse = Omit<BookingListRecord, 'boothPrice' | 'event'> & {
  boothPrice: string;
  event: { id: string; name: string };
  paymentQrDataUri: string | null;
};
type AdminBookingRecord = Prisma.BookingGetPayload<{
  include: typeof adminBookingInclude;
}>;
export type AdminBookingResponse = Omit<AdminBookingRecord, 'boothPrice'> & {
  boothPrice: string;
};

/**
 * The only thing the admin create path is allowed to differ by. Deliberately
 * one flag rather than a general "skip checks" switch: every other invariant in
 * `createWithinTransaction` protects a booth or an event, not a vendor's
 * allowance, and none of them are an admin's to waive.
 */
interface CreateBookingOptions {
  skipQuotaCheck?: boolean;
}

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
    private readonly notifications: NotificationsService,
  ) {}

  create(
    createBookingDto: CreateBookingDto,
    vendorUserId: string,
  ): Promise<BookingResponse> {
    return this.createWithRetry(createBookingDto, vendorUserId, {});
  }

  /**
   * The approved end of a booking-quota exception (SupportTicketsService): an
   * admin creates the booking on a vendor's behalf with the per-event quota
   * skipped, and nothing else skipped. Booth availability, the venue match, the
   * date range and the one-active-booking-per-(event, booth) rule all still
   * apply, so this cannot double-book a booth or reach into another venue —
   * quota is the single invariant an admin is allowed to waive here.
   *
   * `vendorUserId` is the vendor the booking is *for*, not the admin calling.
   * The shop is still checked against that vendor inside the transaction, so an
   * admin cannot attach someone else's shop to it.
   *
   * The caller is responsible for authorization: this method takes no orgId and
   * checks no membership. Only route it from behind `@OrgScoped`.
   */
  createForAdmin(
    createBookingDto: CreateBookingDto,
    vendorUserId: string,
  ): Promise<BookingResponse> {
    return this.createWithRetry(createBookingDto, vendorUserId, {
      skipQuotaCheck: true,
    });
  }

  /**
   * The serializable-transaction retry shared by both create paths. A P2034
   * write conflict is retried; a P2002 is the unique (event, booth) constraint
   * firing, which no retry can help with.
   */
  private async createWithRetry(
    createBookingDto: CreateBookingDto,
    vendorUserId: string,
    options: CreateBookingOptions,
  ): Promise<BookingResponse> {
    for (
      let attempt = 1;
      attempt <= SERIALIZABLE_TRANSACTION_ATTEMPTS;
      attempt += 1
    ) {
      try {
        return await this.prisma.$transaction(
          (transaction) =>
            this.createWithinTransaction(
              transaction,
              createBookingDto,
              vendorUserId,
              options,
            ),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034'
        ) {
          if (attempt < SERIALIZABLE_TRANSACTION_ATTEMPTS) {
            continue;
          }
          throw new ConflictException(
            'มีการจองพร้อมกัน กรุณาตรวจสอบรายการจองแล้วลองใหม่',
          );
        }
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException('บูธนี้ถูกจองไปแล้ว');
        }
        throw error;
      }
    }

    throw new ConflictException(
      'มีการจองพร้อมกัน กรุณาตรวจสอบรายการจองแล้วลองใหม่',
    );
  }

  private async createWithinTransaction(
    transaction: Prisma.TransactionClient,
    createBookingDto: CreateBookingDto,
    vendorUserId: string,
    options: CreateBookingOptions = {},
  ): Promise<BookingResponse> {
    const { eventId, boothId, shopId } = createBookingDto;
    const [event, booth, shop, vendor] = await Promise.all([
      transaction.event.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          status: true,
          organizationId: true,
          venueId: true,
          startDate: true,
          endDate: true,
          organization: {
            select: {
              status: true,
              orgConfig: {
                select: { bookingQuotaPerVendor: true },
              },
            },
          },
        },
      }),
      transaction.booth.findUnique({
        where: { id: boothId },
        select: {
          id: true,
          status: true,
          boothPrice: true,
          zone: { select: { venueId: true } },
        },
      }),
      transaction.shop.findFirst({
        where: { id: shopId, ownerUserId: vendorUserId },
        select: { id: true },
      }),
      transaction.user.findUnique({
        where: { id: vendorUserId },
        select: { isBlacklisted: true },
      }),
    ]);

    if (vendor?.isBlacklisted) {
      throw new ForbiddenException(
        'บัญชีนี้ถูกระงับสิทธิ์การจอง กรุณาติดต่อผู้ดูแลระบบ',
      );
    }

    if (!event) {
      throw new NotFoundException('ไม่พบอีเวนต์');
    }
    if (event.organization.status !== OrgStatus.ACTIVE) {
      throw new ForbiddenException('องค์กรนี้ถูกระงับการใช้งานชั่วคราว');
    }
    if (!BOOKABLE_EVENT_STATUSES.includes(event.status)) {
      throw new ConflictException('อีเวนต์นี้ยังไม่เปิดให้จอง');
    }
    if (
      this.thailandDateKey(event.endDate) < this.thailandDateKey(new Date())
    ) {
      throw new ConflictException('อีเวนต์นี้สิ้นสุดแล้ว');
    }
    if (!booth) {
      throw new NotFoundException('ไม่พบบูธ');
    }
    if (booth.status !== BoothStatus.AVAILABLE) {
      throw new ConflictException('บูธนี้ไม่พร้อมให้จอง');
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

    const activeBooking = await transaction.booking.findFirst({
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

    const activeBookingCount = await transaction.booking.count({
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
        ? await transaction.platformConfig.findFirst({
            orderBy: { updatedAt: 'desc' },
            select: { defaultBookingQuota: true },
          })
        : null;
    const quota =
      orgQuota ?? platformConfig?.defaultBookingQuota ?? DEFAULT_BOOKING_QUOTA;

    // Everything above this point applies to both callers. The quota is the one
    // invariant `createForAdmin` waives, and it is waived here rather than by
    // skipping the counting above so the two paths read the same data and the
    // block stays a single decision.
    if (!options.skipQuotaCheck && activeBookingCount >= quota) {
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

    const booking = await transaction.booking.create({ data });
    return this.toResponse(booking);
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
        event: { select: { status: true, endDate: true } },
        booth: { select: { status: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException('ไม่พบการจอง');
    }
    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      throw new ConflictException('การจองนี้ไม่อยู่ในสถานะรอชำระเงิน');
    }
    if (!BOOKABLE_EVENT_STATUSES.includes(booking.event.status)) {
      throw new ConflictException('อีเวนต์นี้ไม่เปิดรับการจองแล้ว');
    }
    if (
      this.thailandDateKey(booking.event.endDate) <
      this.thailandDateKey(new Date())
    ) {
      throw new ConflictException('อีเวนต์นี้สิ้นสุดแล้ว');
    }
    if (booking.booth.status !== BoothStatus.AVAILABLE) {
      throw new ConflictException('บูธนี้ไม่พร้อมสำหรับการจองแล้ว');
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

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const result = await this.slipVerification.verify(
          {
            bookingId: booking.id,
            slipImageUrl: storedSlip.verificationUrl,
            storedObjectPath: storedSlip.objectPath,
            expectedAmount: booking.boothPrice,
          },
          transaction,
        );

        if (
          result.status === SlipStatus.VERIFIED &&
          result.amount?.equals(booking.boothPrice) === true
        ) {
          const confirmedAt = new Date();
          const updated = await transaction.booking.updateMany({
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
      });
    } catch (error) {
      await this.slipStorage
        .removeObject(storedSlip.objectPath)
        .catch(() => undefined);

      if (error instanceof ConflictException) {
        throw error;
      }
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
  }

  async findAll(vendorUserId: string): Promise<BookingListResponse[]> {
    const bookings = await this.prisma.booking.findMany({
      where: { vendorUserId },
      include: bookingListInclude,
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(bookings.map((booking) => this.toListResponse(booking)));
  }

  async findByOrganization(
    organizationId: string,
  ): Promise<AdminBookingResponse[]> {
    const bookings = await this.prisma.booking.findMany({
      where: { event: { organizationId } },
      include: adminBookingInclude,
      orderBy: { createdAt: 'desc' },
    });
    return bookings.map((booking) => this.toAdminResponse(booking));
  }

  async findAllAcrossOrganizations(): Promise<AdminBookingResponse[]> {
    const bookings = await this.prisma.booking.findMany({
      include: adminBookingInclude,
      orderBy: { createdAt: 'desc' },
    });
    return bookings.map((booking) => this.toAdminResponse(booking));
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
        holdExpiresAt: true,
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
    if (
      booking.status === BookingStatus.PENDING_PAYMENT &&
      (!booking.holdExpiresAt || booking.holdExpiresAt <= cancelledAt)
    ) {
      await this.prisma.booking.updateMany({
        where: {
          id: booking.id,
          vendorUserId,
          status: BookingStatus.PENDING_PAYMENT,
          OR: [
            { holdExpiresAt: null },
            { holdExpiresAt: { lte: cancelledAt } },
          ],
        },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledByUserId: null,
          cancelledByRole: CancelledByRole.SYSTEM,
          cancelledAt,
        },
      });
      throw new ConflictException('การจองหมดเวลาชำระเงินแล้ว');
    }
    if (
      this.thailandDateKey(booking.bookingStartDate) <=
      this.thailandDateKey(cancelledAt)
    ) {
      throw new ConflictException('ไม่สามารถยกเลิกหลังวันเริ่มจองได้');
    }

    const updated = await this.prisma.booking.updateMany({
      where: {
        id: booking.id,
        vendorUserId,
        OR: [
          { status: BookingStatus.CONFIRMED },
          {
            status: BookingStatus.PENDING_PAYMENT,
            holdExpiresAt: { gt: cancelledAt },
          },
        ],
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

  /**
   * Admin lookup by id. `orgId` comes from `@CurrentOrgId()`, which OrgScopeGuard
   * already derived from this exact booking's own `event.organizationId` before
   * the handler could run — so the filter below cannot exclude a row the guard
   * allowed, and is not a second independent check.
   *
   * What it buys is the same forcing function as `ZonesService.update`: a caller
   * must supply an `orgId` to compile, and the only sanctioned source throws the
   * moment `@OrgScoped` is missing from the route. A route that forgets the guard
   * fails loudly instead of silently running an unscoped read (§14.2).
   */
  async findOne(bookingId: string, orgId: string): Promise<BookingResponse> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, event: { organizationId: orgId } },
    });

    if (!booking) {
      throw new NotFoundException('ไม่พบการจอง');
    }

    return this.toResponse(booking);
  }

  /**
   * Admin lookup by the short code a vendor is actually shown — the one an admin
   * is handed in a support conversation, since the booking id is a UUID nobody
   * quotes over the phone.
   *
   * The org check lives here rather than in OrgScopeGuard because the guard
   * rejects any route param that is not a UUID, and a booking code is not one.
   * §14.2 requires the ownership check on exactly this lookup regardless: the
   * code is short and guessable, so membership is filtered in the query itself.
   * SUPER_ADMIN skips the filter, mirroring the bypass OrgScopeGuard already has
   * for that role.
   *
   * A code in another organization and a code that does not exist both answer
   * 404 with the same message — 403 would confirm the code is real (§14.1).
   */
  async findByCode(
    bookingCode: string,
    user: Pick<User, 'id' | 'role'>,
  ): Promise<BookingResponse> {
    const booking = await this.prisma.booking.findFirst({
      where: {
        bookingCode,
        ...(user.role === UserRole.SUPER_ADMIN
          ? {}
          : {
              event: {
                organization: { memberships: { some: { userId: user.id } } },
              },
            }),
      },
    });

    if (!booking) {
      throw new NotFoundException('ไม่พบการจอง');
    }

    return this.toResponse(booking);
  }

  /**
   * The payment-exempt path of AGENTS.md §8 step 6, applied to a booking that is
   * already stuck in PENDING_PAYMENT: an admin confirms it directly with a
   * reason, skipping the slip.
   *
   * The read below exists only to name *why* a booking cannot be confirmed; the
   * write is guarded by putting the status in its own `where`. That matters here
   * because BookingHoldExpiryService cancels expired holds every minute, so a
   * read-then-write pair could resurrect a booking the cron had just cancelled.
   * `cancel()` closes the same race the same way.
   *
   * Hold expiry is deliberately *not* a precondition. Rescuing a booking whose
   * hold lapsed before the cron swept it is the point of this endpoint, and
   * `holdExpiresAt` is left untouched — the cron only looks at PENDING_PAYMENT
   * rows, so a CONFIRMED booking is never swept. This matches what the slip
   * confirmation path in `uploadSlip` does.
   */
  async confirmExempt(
    bookingId: string,
    confirmExemptBookingDto: ConfirmExemptBookingDto,
    orgId: string,
  ): Promise<BookingResponse> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, event: { organizationId: orgId } },
      select: {
        id: true,
        status: true,
        vendor: { select: { isBlacklisted: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException('ไม่พบการจอง');
    }
    if (booking.vendor.isBlacklisted) {
      throw new ForbiddenException(
        'บัญชีนี้ถูกระงับสิทธิ์การจอง กรุณาติดต่อผู้ดูแลระบบ',
      );
    }
    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      throw new ConflictException(
        'ยืนยันการจองนี้ไม่ได้ เนื่องจากไม่ได้อยู่ในสถานะรอชำระเงิน',
      );
    }

    const updated = await this.prisma.booking.updateMany({
      where: {
        id: booking.id,
        event: { organizationId: orgId },
        status: BookingStatus.PENDING_PAYMENT,
      },
      data: {
        isPaymentExempt: true,
        paymentExemptReason: confirmExemptBookingDto.paymentExemptReason,
        status: BookingStatus.CONFIRMED,
        confirmedAt: new Date(),
      },
    });

    if (updated.count !== 1) {
      throw new ConflictException('การจองหมดเวลาหรือสถานะเปลี่ยนไปแล้ว');
    }

    const confirmedBooking = await this.prisma.booking.findUnique({
      where: { id: booking.id },
    });
    if (!confirmedBooking) {
      throw new NotFoundException('ไม่พบการจอง');
    }

    const response = this.toResponse(confirmedBooking);
    await this.notifications.createForUser(confirmedBooking.vendorUserId, {
      type: NotificationType.BOOKING_STATUS,
      title: 'การจองของคุณได้รับการยืนยันแล้ว',
      body: 'แอดมินยืนยันการจองให้คุณโดยยกเว้นการชำระเงิน',
      relatedEntityType: 'BOOKING',
      relatedEntityId: confirmedBooking.id,
    });

    return response;
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

  private thailandDateKey(value: Date): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(value);
    const valueOf = (type: Intl.DateTimeFormatPartTypes): string =>
      parts.find((part) => part.type === type)?.value ?? '';
    return `${valueOf('year')}-${valueOf('month')}-${valueOf('day')}`;
  }

  private toResponse(booking: Booking): BookingResponse {
    const { boothPrice, ...rest } = booking;
    return { ...rest, boothPrice: boothPrice.toString() };
  }

  private async toListResponse(
    booking: BookingListRecord,
  ): Promise<BookingListResponse> {
    const { boothPrice, event, ...rest } = booking;
    const promptpayId = event.organization.promptpayId;

    let paymentQrDataUri: string | null = null;
    if (promptpayId) {
      // The QR encoder requires a JavaScript number. Conversion happens only
      // at this external-library boundary; every API money field remains a
      // Decimal-backed string.
      const payload = generatePromptPayPayload(promptpayId, {
        amount: boothPrice.toNumber(),
      });
      paymentQrDataUri = await QRCode.toDataURL(payload, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 320,
      });
    }

    return {
      ...rest,
      boothPrice: boothPrice.toString(),
      event: { id: event.id, name: event.name },
      paymentQrDataUri,
    };
  }

  private toAdminResponse(booking: AdminBookingRecord): AdminBookingResponse {
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
