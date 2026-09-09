import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  NotificationType,
  PaymentGroupStatus,
  Prisma,
  RefundStatus,
  SlipStatus,
  UserRole,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApproveRefundRequestDto } from './dto/approve-refund-request.dto';
import { CreateRefundRequestDto } from './dto/create-refund-request.dto';

const SERIALIZABLE_TRANSACTION_ATTEMPTS = 3;

const refundSelect = {
  id: true,
  bookingId: true,
  requestedByUserId: true,
  reason: true,
  requestedAmount: true,
  approvedAmount: true,
  status: true,
  evidenceUrls: true,
  payoutMethod: true,
  payoutPromptPayId: true,
  payoutBankName: true,
  payoutAccountNumber: true,
  payoutAccountName: true,
  reviewedByUserId: true,
  reviewedAt: true,
  processedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RefundRequestSelect;

type RefundRecord = Prisma.RefundRequestGetPayload<{
  select: typeof refundSelect;
}>;

export type RefundResponse = Omit<
  RefundRecord,
  'requestedAmount' | 'approvedAmount'
> & {
  requestedAmount: string;
  approvedAmount: string | null;
};

const refundOverviewSelect = {
  ...refundSelect,
  booking: {
    select: {
      id: true,
      bookingCode: true,
      event: {
        select: {
          id: true,
          name: true,
          organization: { select: { id: true, name: true } },
        },
      },
      shop: { select: { id: true, name: true } },
      paymentGroup: { select: { paymentCode: true } },
    },
  },
  requestedBy: { select: { id: true, email: true, fullName: true } },
} satisfies Prisma.RefundRequestSelect;

const payoutWarningSelect = {
  requestedBy: { select: { fullName: true } },
  booking: {
    select: {
      slips: {
        where: { slipokStatus: SlipStatus.VERIFIED },
        select: { senderName: true },
      },
      paymentGroup: {
        select: {
          slips: {
            where: { slipokStatus: SlipStatus.VERIFIED },
            select: { senderName: true },
          },
        },
      },
    },
  },
} satisfies Prisma.RefundRequestSelect;

type RefundOverviewRecord = Prisma.RefundRequestGetPayload<{
  select: typeof refundOverviewSelect;
}>;
export type RefundOverviewResponse = Omit<
  RefundOverviewRecord,
  'requestedAmount' | 'approvedAmount'
> & {
  requestedAmount: string;
  approvedAmount: string | null;
};

const adminRefundSelect = {
  status: true,
  requestedAmount: true,
  approvedAmount: true,
  requestedByUserId: true,
  booking: {
    select: {
      boothPrice: true,
      vendorUserId: true,
      paymentGroupId: true,
      paymentGroup: { select: { totalAmount: true } },
    },
  },
} satisfies Prisma.RefundRequestSelect;

type AdminRefundRecord = Prisma.RefundRequestGetPayload<{
  select: typeof adminRefundSelect;
}>;

@Injectable()
export class RefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(
    bookingId: string,
    vendorUserId: string,
    dto: CreateRefundRequestDto,
  ): Promise<RefundResponse> {
    for (
      let attempt = 1;
      attempt <= SERIALIZABLE_TRANSACTION_ATTEMPTS;
      attempt += 1
    ) {
      try {
        const result = await this.prisma.$transaction(
          (transaction) =>
            this.createWithinTransaction(
              transaction,
              bookingId,
              vendorUserId,
              dto,
            ),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );

        await this.notifyOrganizationAdmins(
          result.organizationId,
          result.bookingCode,
          result.refund,
        );
        await this.notifications.createForRole(UserRole.SUPER_ADMIN, {
          type: NotificationType.REFUND,
          title: 'มีคำร้องขอคืนเงินใหม่',
          body: `การจอง ${result.bookingCode} ขอคืนเงิน ${result.refund.requestedAmount.toString()} บาท`,
          relatedEntityType: 'REFUND_REQUEST',
          relatedEntityId: result.refund.id,
        });
        return this.toResponse(result.refund);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034'
        ) {
          if (attempt < SERIALIZABLE_TRANSACTION_ATTEMPTS) continue;
          throw new ConflictException(
            'มีการส่งคำร้องคืนเงินพร้อมกัน กรุณาลองใหม่อีกครั้ง',
          );
        }
        throw error;
      }
    }

    throw new ConflictException(
      'มีการส่งคำร้องคืนเงินพร้อมกัน กรุณาลองใหม่อีกครั้ง',
    );
  }

  private async createWithinTransaction(
    transaction: Prisma.TransactionClient,
    bookingId: string,
    vendorUserId: string,
    dto: CreateRefundRequestDto,
  ) {
    const booking = await transaction.booking.findFirst({
      where: { id: bookingId, vendorUserId },
      select: {
        bookingCode: true,
        boothPrice: true,
        isPaymentExempt: true,
        status: true,
        event: { select: { organizationId: true } },
        paymentGroup: {
          select: {
            status: true,
            totalAmount: true,
            slips: {
              where: { slipokStatus: SlipStatus.VERIFIED },
              select: { amount: true },
            },
          },
        },
        slips: {
          where: { slipokStatus: SlipStatus.VERIFIED },
          select: { amount: true },
        },
      },
    });

    if (!booking) {
      // Unknown and another vendor's booking intentionally share one answer.
      throw new NotFoundException('ไม่พบการจอง');
    }
    if (booking.status !== BookingStatus.CANCELLED) {
      throw new ConflictException(
        'ส่งคำร้องคืนเงินได้เฉพาะการจองที่ยกเลิกแล้ว',
      );
    }
    if (booking.isPaymentExempt) {
      throw new ConflictException('การจองนี้ไม่มีการชำระเงินให้คืน');
    }
    const paymentGroup = booking.paymentGroup;
    const hasVerifiedPayment = paymentGroup
      ? paymentGroup.status === PaymentGroupStatus.CONFIRMED &&
        paymentGroup.slips.some(({ amount }) =>
          amount.equals(paymentGroup.totalAmount),
        )
      : booking.slips.some(({ amount }) => amount.equals(booking.boothPrice));
    if (!hasVerifiedPayment) {
      throw new ConflictException(
        'ไม่พบการชำระเงินที่ตรวจสอบแล้วสำหรับการจองนี้',
      );
    }

    const requestedAmount = new Prisma.Decimal(dto.requestedAmount);
    if (requestedAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('จำนวนเงินที่ขอคืนต้องมากกว่า 0');
    }
    if (requestedAmount.greaterThan(booking.boothPrice)) {
      throw new BadRequestException('จำนวนเงินที่ขอคืนต้องไม่เกินราคาบูธ');
    }

    const existing = await transaction.refundRequest.findFirst({
      where: { bookingId },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('การจองนี้มีคำร้องคืนเงินแล้ว');
    }

    const refund = await transaction.refundRequest.create({
      data: {
        bookingId,
        requestedByUserId: vendorUserId,
        reason: dto.reason,
        requestedAmount,
        status: RefundStatus.PENDING,
        payoutMethod: dto.payoutMethod,
        payoutAccountName: dto.payoutAccountName,
        payoutPromptPayId:
          dto.payoutMethod === 'PROMPTPAY' ? dto.payoutPromptPayId : null,
        payoutBankName:
          dto.payoutMethod === 'BANK_TRANSFER' ? dto.payoutBankName : null,
        payoutAccountNumber:
          dto.payoutMethod === 'BANK_TRANSFER' ? dto.payoutAccountNumber : null,
      },
      select: refundSelect,
    });

    return {
      refund,
      organizationId: booking.event.organizationId,
      bookingCode: booking.bookingCode,
    };
  }

  async findMine(vendorUserId: string): Promise<RefundResponse[]> {
    const refunds = await this.prisma.refundRequest.findMany({
      where: { requestedByUserId: vendorUserId },
      select: refundSelect,
      orderBy: { createdAt: 'desc' },
    });
    return refunds.map((refund) => this.toResponse(refund));
  }

  async findForOrganization(organizationId: string): Promise<RefundResponse[]> {
    const refunds = await this.prisma.refundRequest.findMany({
      where: { booking: { event: { organizationId } } },
      select: { ...refundSelect, ...payoutWarningSelect },
      orderBy: { createdAt: 'desc' },
    });
    return refunds.map(({ booking, requestedBy, ...refund }) => {
      const slips = [...booking.slips, ...(booking.paymentGroup?.slips ?? [])];
      return {
        ...this.toResponse(refund),
        payoutNameMismatch: this.payoutNameMismatch(
          refund.payoutAccountName,
          requestedBy.fullName,
          slips,
        ),
        pendingSince:
          refund.status === RefundStatus.PENDING
            ? refund.createdAt
            : refund.status === RefundStatus.APPROVED
              ? refund.reviewedAt
              : null,
      };
    });
  }

  async findAllAcrossOrganizations(): Promise<RefundOverviewResponse[]> {
    const refunds = await this.prisma.refundRequest.findMany({
      select: refundOverviewSelect,
      orderBy: { createdAt: 'desc' },
    });
    return refunds.map((refund) => this.toOverviewResponse(refund));
  }

  async approve(
    bookingId: string,
    refundId: string,
    organizationId: string,
    reviewerUserId: string,
    dto: ApproveRefundRequestDto,
  ): Promise<RefundResponse> {
    for (
      let attempt = 1;
      attempt <= SERIALIZABLE_TRANSACTION_ATTEMPTS;
      attempt += 1
    ) {
      try {
        const { refund, response } = await this.prisma.$transaction(
          (transaction) =>
            this.approveWithinTransaction(
              transaction,
              bookingId,
              refundId,
              organizationId,
              reviewerUserId,
              dto,
            ),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        await this.notifyVendor(
          refund.requestedByUserId,
          response,
          'คำร้องคืนเงินได้รับการอนุมัติแล้ว',
          `อนุมัติคืนเงิน ${response.approvedAmount ?? '0'} บาท`,
        );
        return response;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034'
        ) {
          if (attempt < SERIALIZABLE_TRANSACTION_ATTEMPTS) continue;
          throw new ConflictException(
            'มีการอนุมัติคืนเงินพร้อมกัน กรุณาลองใหม่อีกครั้ง',
          );
        }
        throw error;
      }
    }

    throw new ConflictException(
      'มีการอนุมัติคืนเงินพร้อมกัน กรุณาลองใหม่อีกครั้ง',
    );
  }

  private async approveWithinTransaction(
    transaction: Prisma.TransactionClient,
    bookingId: string,
    refundId: string,
    organizationId: string,
    reviewerUserId: string,
    dto: ApproveRefundRequestDto,
  ): Promise<{ refund: AdminRefundRecord; response: RefundResponse }> {
    const refund = await this.findAdminRefund(
      bookingId,
      refundId,
      organizationId,
      transaction,
    );
    if (refund.status !== RefundStatus.PENDING) {
      throw new ConflictException('คำร้องนี้ไม่อยู่ในสถานะรอตรวจสอบ');
    }

    const approvedAmount = new Prisma.Decimal(dto.approvedAmount);
    if (approvedAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('จำนวนเงินที่อนุมัติต้องมากกว่า 0');
    }
    if (
      approvedAmount.greaterThan(refund.requestedAmount) ||
      approvedAmount.greaterThan(refund.booking.boothPrice)
    ) {
      throw new BadRequestException(
        'จำนวนเงินที่อนุมัติต้องไม่เกินยอดที่ขอคืนและราคาบูธ',
      );
    }

    if (refund.booking.paymentGroupId && refund.booking.paymentGroup) {
      const aggregate = await transaction.refundRequest.aggregate({
        where: {
          id: { not: refundId },
          booking: { paymentGroupId: refund.booking.paymentGroupId },
          status: { in: [RefundStatus.APPROVED, RefundStatus.PROCESSED] },
        },
        _sum: { approvedAmount: true },
      });
      const approvedForGroup =
        aggregate._sum.approvedAmount ?? new Prisma.Decimal(0);
      if (
        approvedForGroup
          .plus(approvedAmount)
          .greaterThan(refund.booking.paymentGroup.totalAmount)
      ) {
        throw new BadRequestException(
          'ยอดคืนเงินรวมต้องไม่เกินยอดที่ชำระของกลุ่มการจอง',
        );
      }
    }

    const reviewedAt = new Date();
    const updated = await transaction.refundRequest.updateMany({
      where: {
        id: refundId,
        bookingId,
        status: RefundStatus.PENDING,
        booking: { event: { organizationId } },
      },
      data: {
        status: RefundStatus.APPROVED,
        approvedAmount,
        reviewedByUserId: reviewerUserId,
        reviewedAt,
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException('สถานะคำร้องคืนเงินเปลี่ยนไปแล้ว');
    }

    const response = await this.findUpdatedRefund(
      bookingId,
      refundId,
      organizationId,
      transaction,
    );
    return { refund, response };
  }

  async reject(
    bookingId: string,
    refundId: string,
    organizationId: string,
    reviewerUserId: string,
  ): Promise<RefundResponse> {
    const refund = await this.findAdminRefund(
      bookingId,
      refundId,
      organizationId,
    );
    if (refund.status !== RefundStatus.PENDING) {
      throw new ConflictException('คำร้องนี้ไม่อยู่ในสถานะรอตรวจสอบ');
    }

    const updated = await this.prisma.refundRequest.updateMany({
      where: {
        id: refundId,
        bookingId,
        status: RefundStatus.PENDING,
        booking: { event: { organizationId } },
      },
      data: {
        status: RefundStatus.REJECTED,
        approvedAmount: null,
        reviewedByUserId: reviewerUserId,
        reviewedAt: new Date(),
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException('สถานะคำร้องคืนเงินเปลี่ยนไปแล้ว');
    }

    const response = await this.findUpdatedRefund(
      bookingId,
      refundId,
      organizationId,
    );
    await this.notifyVendor(
      refund.requestedByUserId,
      response,
      'คำร้องคืนเงินไม่ได้รับการอนุมัติ',
      'กรุณาติดต่อผู้จัดงานหากต้องการข้อมูลเพิ่มเติม',
    );
    return response;
  }

  async process(
    bookingId: string,
    refundId: string,
    organizationId: string,
  ): Promise<RefundResponse> {
    const refund = await this.findAdminRefund(
      bookingId,
      refundId,
      organizationId,
    );
    if (
      refund.status !== RefundStatus.APPROVED ||
      refund.approvedAmount === null
    ) {
      throw new ConflictException('ต้องอนุมัติคำร้องก่อนยืนยันการคืนเงิน');
    }

    const updated = await this.prisma.refundRequest.updateMany({
      where: {
        id: refundId,
        bookingId,
        status: RefundStatus.APPROVED,
        booking: { event: { organizationId } },
      },
      data: {
        status: RefundStatus.PROCESSED,
        processedAt: new Date(),
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException('สถานะคำร้องคืนเงินเปลี่ยนไปแล้ว');
    }

    const response = await this.findUpdatedRefund(
      bookingId,
      refundId,
      organizationId,
    );
    await this.notifyVendor(
      refund.requestedByUserId,
      response,
      'ดำเนินการคืนเงินแล้ว',
      `ผู้จัดงานยืนยันการคืนเงิน ${response.approvedAmount ?? '0'} บาทแล้ว`,
    );
    return response;
  }

  private async findAdminRefund(
    bookingId: string,
    refundId: string,
    organizationId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const refund = await client.refundRequest.findFirst({
      where: {
        id: refundId,
        bookingId,
        booking: { event: { organizationId } },
      },
      select: adminRefundSelect,
    });

    if (!refund) {
      // A wrong booking, another tenant and an unknown refund are indistinguishable.
      throw new NotFoundException('ไม่พบคำร้องคืนเงิน');
    }
    return refund;
  }

  private async findUpdatedRefund(
    bookingId: string,
    refundId: string,
    organizationId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<RefundResponse> {
    const refund = await client.refundRequest.findFirst({
      where: {
        id: refundId,
        bookingId,
        booking: { event: { organizationId } },
      },
      select: refundSelect,
    });
    if (!refund) {
      throw new NotFoundException('ไม่พบคำร้องคืนเงิน');
    }
    return this.toResponse(refund);
  }

  private async notifyOrganizationAdmins(
    organizationId: string,
    bookingCode: string,
    refund: RefundRecord,
  ): Promise<void> {
    await this.notifications
      .createForOrganizationAdmins(organizationId, 'payments', {
        type: NotificationType.REFUND,
        title: 'มีคำร้องขอคืนเงินใหม่',
        body: `การจอง ${bookingCode} ขอคืนเงิน ${refund.requestedAmount.toString()} บาท`,
        relatedEntityType: 'REFUND_REQUEST',
        relatedEntityId: refund.id,
      })
      .catch(() => 0);
  }

  private notifyVendor(
    vendorUserId: string,
    refund: RefundResponse,
    title: string,
    body: string,
  ) {
    return this.notifications.createForUser(vendorUserId, {
      type: NotificationType.REFUND,
      title,
      body,
      relatedEntityType: 'REFUND_REQUEST',
      relatedEntityId: refund.id,
    });
  }

  private toResponse(refund: RefundRecord): RefundResponse {
    const { requestedAmount, approvedAmount, ...rest } = refund;
    return {
      ...rest,
      requestedAmount: requestedAmount.toString(),
      approvedAmount: approvedAmount?.toString() ?? null,
    };
  }

  private payoutNameMismatch(
    accountName: string | null,
    fullName: string,
    slips: { senderName: string | null }[],
  ): boolean {
    if (!accountName) return false;
    const normalize = (name: string) =>
      name
        .normalize('NFKC')
        .trim()
        .replace(/\s+/g, ' ')
        .toLocaleLowerCase('th');
    const name = normalize(accountName);
    return (
      normalize(fullName) !== name ||
      slips.some(
        ({ senderName }) => !!senderName && normalize(senderName) !== name,
      )
    );
  }

  private toOverviewResponse(
    refund: RefundOverviewRecord,
  ): RefundOverviewResponse {
    const { booking, requestedBy, ...refundRecord } = refund;
    return {
      ...this.toResponse(refundRecord),
      booking,
      requestedBy,
    };
  }
}
