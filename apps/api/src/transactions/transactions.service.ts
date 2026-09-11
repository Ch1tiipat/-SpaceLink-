import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import {
  buildTransactionTimeline,
  derivePaymentState,
  deriveRefundState,
  uniqueSlips,
  type PaymentState,
  type RefundState,
  type TransactionSlip,
  type TransactionView,
} from './transaction-state';

const slipSelect = {
  id: true,
  slipokStatus: true,
  amount: true,
  transRef: true,
  sendingBank: true,
  senderName: true,
  receiverName: true,
  verifiedAt: true,
  createdAt: true,
} satisfies Prisma.VerifiedSlipSelect;

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
  requestedBy: { select: { id: true, fullName: true, email: true } },
  reviewedBy: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.RefundRequestSelect;

const transactionBookingSelect = {
  id: true,
  bookingCode: true,
  paymentGroupId: true,
  eventId: true,
  boothId: true,
  shopId: true,
  vendorUserId: true,
  bookingStartDate: true,
  bookingEndDate: true,
  boothPrice: true,
  isPaymentExempt: true,
  paymentExemptReason: true,
  status: true,
  holdExpiresAt: true,
  confirmedAt: true,
  cancelledByUserId: true,
  cancelledByRole: true,
  cancelReason: true,
  cancelledAt: true,
  createdAt: true,
  updatedAt: true,
  event: { select: { id: true, name: true, organizationId: true } },
  booth: {
    select: {
      id: true,
      code: true,
      zone: { select: { id: true, code: true, name: true } },
    },
  },
  shop: { select: { id: true, name: true } },
  vendor: {
    select: { id: true, fullName: true, email: true, phone: true },
  },
  slips: {
    select: slipSelect,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  },
  paymentGroup: {
    select: {
      id: true,
      paymentCode: true,
      totalAmount: true,
      status: true,
      holdExpiresAt: true,
      confirmedAt: true,
      cancelledAt: true,
      createdAt: true,
      updatedAt: true,
      slips: {
        select: slipSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      },
    },
  },
  refundRequests: {
    select: refundSelect,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  },
} satisfies Prisma.BookingSelect;

type TransactionBooking = Prisma.BookingGetPayload<{
  select: typeof transactionBookingSelect;
}>;
type TransactionRefundRecord = TransactionBooking['refundRequests'][number];

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: ListTransactionsQueryDto) {
    const dateRange = this.dateRange(query.from, query.to);
    const bookings = await this.prisma.booking.findMany({
      where: this.bookingWhere(organizationId, query),
      select: transactionBookingSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    const prepared = bookings.map((booking) => this.prepare(booking));
    const dated = prepared.filter((entry) =>
      this.matchesDate(entry, query.view, dateRange),
    );
    const statusFiltered = dated.filter(
      ({ booking, payment, refundStatus }) =>
        (!query.bookingStatus || booking.status === query.bookingStatus) &&
        (!query.paymentStatus || payment.status === query.paymentStatus) &&
        (query.view === 'REFUNDS' ||
          !query.refundStatus ||
          refundStatus === query.refundStatus),
    );

    const items = this.itemsForView(
      statusFiltered,
      query.view,
      dateRange,
      query.refundStatus,
    );
    const start = (query.page - 1) * query.pageSize;

    return {
      view: query.view,
      summary: this.summary(dated),
      filters: this.filters(prepared),
      page: query.page,
      pageSize: query.pageSize,
      total: items.length,
      items: items.slice(start, start + query.pageSize),
    };
  }

  async findBookingDetail(organizationId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, event: { organizationId } },
      select: transactionBookingSelect,
    });
    if (!booking) throw new NotFoundException('ไม่พบการจอง');

    const entry = this.prepare(booking);
    const refunds = booking.refundRequests.map((refund) =>
      this.refundResponse(refund, entry.slips, booking.vendor.fullName),
    );

    return {
      booking: {
        id: booking.id,
        bookingCode: booking.bookingCode,
        status: booking.status,
        bookingStartDate: booking.bookingStartDate,
        bookingEndDate: booking.bookingEndDate,
        boothPrice: booking.boothPrice.toString(),
        isPaymentExempt: booking.isPaymentExempt,
        paymentExemptReason: booking.paymentExemptReason,
        holdExpiresAt: booking.holdExpiresAt,
        confirmedAt: booking.confirmedAt,
        cancelledByUserId: booking.cancelledByUserId,
        cancelledByRole: booking.cancelledByRole,
        cancelReason: booking.cancelReason,
        cancelledAt: booking.cancelledAt,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
      },
      event: booking.event,
      zone: booking.booth.zone,
      booth: { id: booking.booth.id, code: booking.booth.code },
      vendor: booking.vendor,
      shop: booking.shop,
      payment: {
        status: entry.payment.status,
        effectiveAt: entry.payment.effectiveAt,
        group: booking.paymentGroup
          ? {
              id: booking.paymentGroup.id,
              paymentCode: booking.paymentGroup.paymentCode,
              totalAmount: booking.paymentGroup.totalAmount.toString(),
              status: booking.paymentGroup.status,
              holdExpiresAt: booking.paymentGroup.holdExpiresAt,
              confirmedAt: booking.paymentGroup.confirmedAt,
              cancelledAt: booking.paymentGroup.cancelledAt,
              createdAt: booking.paymentGroup.createdAt,
              updatedAt: booking.paymentGroup.updatedAt,
            }
          : null,
        slips: entry.slips.map((slip) => ({
          id: slip.id,
          source: slip.source,
          status: slip.slipokStatus,
          amount: slip.amount.toString(),
          transRef: slip.transRef,
          sendingBank: slip.sendingBank,
          senderName: slip.senderName,
          receiverName: slip.receiverName,
          verifiedAt: slip.verifiedAt,
          createdAt: slip.createdAt,
        })),
      },
      refunds,
      timeline: buildTransactionTimeline({
        booking,
        paymentGroup: booking.paymentGroup,
        slips: entry.slips,
        refunds: booking.refundRequests,
      }),
    };
  }

  private prepare(booking: TransactionBooking) {
    const slips = uniqueSlips(booking.slips, booking.paymentGroup?.slips ?? []);
    return {
      booking,
      slips,
      payment: derivePaymentState({
        isPaymentExempt: booking.isPaymentExempt,
        confirmedAt: booking.confirmedAt,
        createdAt: booking.createdAt,
        slips,
      }),
      refundStatus: deriveRefundState(booking.refundRequests),
    };
  }

  private bookingWhere(
    organizationId: string,
    query: ListTransactionsQueryDto,
  ): Prisma.BookingWhereInput {
    const q = query.q;
    return {
      event: {
        organizationId,
        ...(query.eventId ? { id: query.eventId } : {}),
      },
      ...(query.zoneId ? { booth: { zoneId: query.zoneId } } : {}),
      ...(query.vendorUserId ? { vendorUserId: query.vendorUserId } : {}),
      ...(query.shopId ? { shopId: query.shopId } : {}),
      ...(q
        ? {
            OR: [
              { bookingCode: { contains: q, mode: 'insensitive' } },
              { event: { name: { contains: q, mode: 'insensitive' } } },
              { booth: { code: { contains: q, mode: 'insensitive' } } },
              {
                booth: { zone: { code: { contains: q, mode: 'insensitive' } } },
              },
              {
                booth: { zone: { name: { contains: q, mode: 'insensitive' } } },
              },
              { shop: { name: { contains: q, mode: 'insensitive' } } },
              { vendor: { fullName: { contains: q, mode: 'insensitive' } } },
              { vendor: { email: { contains: q, mode: 'insensitive' } } },
              {
                paymentGroup: {
                  paymentCode: { contains: q, mode: 'insensitive' },
                },
              },
              {
                refundRequests: {
                  some: { reason: { contains: q, mode: 'insensitive' } },
                },
              },
            ],
          }
        : {}),
    };
  }

  private bookingRow(entry: ReturnType<TransactionsService['prepare']>) {
    const { booking, payment, refundStatus } = entry;
    return {
      id: booking.id,
      bookingCode: booking.bookingCode,
      bookingStatus: booking.status,
      paymentStatus: payment.status,
      refundStatus,
      boothPrice: booking.boothPrice.toString(),
      createdAt: booking.createdAt,
      paymentEffectiveAt: payment.effectiveAt,
      event: { id: booking.event.id, name: booking.event.name },
      zone: booking.booth.zone,
      booth: { id: booking.booth.id, code: booking.booth.code },
      vendor: booking.vendor,
      shop: booking.shop,
      paymentGroup: booking.paymentGroup
        ? {
            id: booking.paymentGroup.id,
            paymentCode: booking.paymentGroup.paymentCode,
            status: booking.paymentGroup.status,
            totalAmount: booking.paymentGroup.totalAmount.toString(),
          }
        : null,
    };
  }

  private itemsForView(
    entries: ReturnType<TransactionsService['prepare']>[],
    view: TransactionView,
    dateRange: DateRange,
    refundStatus?: RefundState,
  ) {
    if (view === 'REFUNDS') {
      return entries
        .flatMap((entry) =>
          entry.booking.refundRequests
            .filter(
              (refund) =>
                this.inRange(refund.createdAt, dateRange) &&
                (!refundStatus || refund.status === refundStatus),
            )
            .map((refund) => ({
              ...this.refundResponse(
                refund,
                entry.slips,
                entry.booking.vendor.fullName,
              ),
              booking: this.bookingRow(entry),
            })),
        )
        .sort(compareResponseDates);
    }

    if (view === 'VENDORS') return this.vendorRows(entries);
    return entries
      .map((entry) => this.bookingRow(entry))
      .sort(
        (left, right) =>
          (view === 'PAYMENTS'
            ? right.paymentEffectiveAt.getTime() -
              left.paymentEffectiveAt.getTime()
            : right.createdAt.getTime() - left.createdAt.getTime()) ||
          right.id.localeCompare(left.id),
      );
  }

  private vendorRows(entries: ReturnType<TransactionsService['prepare']>[]) {
    const vendors = new Map<
      string,
      {
        id: string;
        fullName: string;
        email: string;
        phone: string | null;
        shops: Map<string, { id: string; name: string }>;
        bookingCount: number;
        confirmedCount: number;
        lastBookingAt: Date;
      }
    >();

    for (const { booking } of entries) {
      const current = vendors.get(booking.vendor.id) ?? {
        ...booking.vendor,
        shops: new Map(),
        bookingCount: 0,
        confirmedCount: 0,
        lastBookingAt: booking.createdAt,
      };
      current.shops.set(booking.shop.id, booking.shop);
      current.bookingCount += 1;
      if (booking.status === 'CONFIRMED') current.confirmedCount += 1;
      if (booking.createdAt > current.lastBookingAt) {
        current.lastBookingAt = booking.createdAt;
      }
      vendors.set(current.id, current);
    }

    return [...vendors.values()]
      .map(({ shops, ...vendor }) => ({
        ...vendor,
        shops: [...shops.values()],
      }))
      .sort(
        (left, right) =>
          right.lastBookingAt.getTime() - left.lastBookingAt.getTime() ||
          right.id.localeCompare(left.id),
      );
  }

  private refundResponse(
    refund: TransactionRefundRecord,
    slips: TransactionSlip[],
    vendorName: string,
  ) {
    return {
      ...refund,
      requestedAmount: refund.requestedAmount.toString(),
      approvedAmount: refund.approvedAmount?.toString() ?? null,
      evidenceUrls: this.stringArray(refund.evidenceUrls),
      payoutNameMismatch: this.payoutNameMismatch(
        refund.payoutAccountName,
        vendorName,
        slips,
      ),
      pendingSince:
        refund.status === 'PENDING'
          ? refund.createdAt
          : refund.status === 'APPROVED'
            ? refund.reviewedAt
            : null,
    };
  }

  private summary(entries: ReturnType<TransactionsService['prepare']>[]) {
    const payments: Record<PaymentState, number> = {
      EXEMPT: 0,
      AWAITING_SLIP: 0,
      VERIFIED: 0,
      FAILED: 0,
    };
    const refunds: Record<RefundState, number> = {
      NONE: 0,
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
      PROCESSED: 0,
    };
    const vendors = new Set<string>();
    const shops = new Set<string>();
    for (const entry of entries) {
      payments[entry.payment.status] += 1;
      refunds[entry.refundStatus] += 1;
      vendors.add(entry.booking.vendor.id);
      shops.add(entry.booking.shop.id);
    }
    return {
      bookings: entries.length,
      payments,
      refunds,
      vendors: vendors.size,
      shops: shops.size,
    };
  }

  private filters(entries: ReturnType<TransactionsService['prepare']>[]) {
    return {
      events: this.unique(entries, ({ booking }) => ({
        id: booking.event.id,
        name: booking.event.name,
      })),
      zones: this.unique(entries, ({ booking }) => booking.booth.zone),
      vendors: this.unique(entries, ({ booking }) => ({
        id: booking.vendor.id,
        fullName: booking.vendor.fullName,
        email: booking.vendor.email,
      })),
      shops: this.unique(entries, ({ booking }) => booking.shop),
    };
  }

  private unique<T extends { id: string }>(
    entries: ReturnType<TransactionsService['prepare']>[],
    select: (entry: ReturnType<TransactionsService['prepare']>) => T,
  ) {
    return [
      ...new Map(
        entries.map((entry) => {
          const value = select(entry);
          return [value.id, value] as const;
        }),
      ).values(),
    ].sort((left, right) => left.id.localeCompare(right.id));
  }

  private matchesDate(
    entry: ReturnType<TransactionsService['prepare']>,
    view: TransactionView,
    range: DateRange,
  ) {
    if (!range.from && !range.toExclusive) return true;
    if (view === 'PAYMENTS')
      return this.inRange(entry.payment.effectiveAt, range);
    if (view === 'REFUNDS') {
      return entry.booking.refundRequests.some((refund) =>
        this.inRange(refund.createdAt, range),
      );
    }
    return this.inRange(entry.booking.createdAt, range);
  }

  private inRange(date: Date, range: DateRange) {
    return (
      (!range.from || date >= range.from) &&
      (!range.toExclusive || date < range.toExclusive)
    );
  }

  private dateRange(from?: string, to?: string): DateRange {
    const fromDate = from ? this.thailandDate(from) : undefined;
    const toDate = to ? this.thailandDate(to, true) : undefined;
    if (fromDate && toDate && fromDate >= toDate) {
      throw new BadRequestException('ช่วงวันที่ไม่ถูกต้อง');
    }
    return { from: fromDate, toExclusive: toDate };
  }

  private thailandDate(value: string, nextDay = false) {
    const [year, month, day] = value.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (month < 1 || month > 12 || day < 1 || day > lastDay) {
      throw new BadRequestException('วันที่ไม่ถูกต้อง');
    }
    return new Date(Date.UTC(year, month - 1, day + Number(nextDay), -7));
  }

  private stringArray(value: Prisma.JsonValue): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  }

  private payoutNameMismatch(
    accountName: string | null,
    vendorName: string,
    slips: TransactionSlip[],
  ) {
    if (!accountName) return false;
    const normalize = (name: string) =>
      name
        .normalize('NFKC')
        .trim()
        .replace(/\s+/g, ' ')
        .toLocaleLowerCase('th');
    const expected = normalize(accountName);
    return (
      normalize(vendorName) !== expected ||
      slips.some(
        ({ senderName }) =>
          senderName !== null && normalize(senderName) !== expected,
      )
    );
  }
}

interface DateRange {
  from?: Date;
  toExclusive?: Date;
}

function compareResponseDates(
  left: { id: string; createdAt: Date },
  right: { id: string; createdAt: Date },
) {
  return (
    right.createdAt.getTime() - left.createdAt.getTime() ||
    right.id.localeCompare(left.id)
  );
}
