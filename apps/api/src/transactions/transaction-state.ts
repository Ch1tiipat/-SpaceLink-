import { RefundStatus, SlipStatus } from '@prisma/client';

export const TRANSACTION_VIEWS = [
  'BOOKINGS',
  'PAYMENTS',
  'REFUNDS',
  'VENDORS',
] as const;
export type TransactionView = (typeof TRANSACTION_VIEWS)[number];

export const PAYMENT_STATES = [
  'EXEMPT',
  'AWAITING_SLIP',
  'VERIFIED',
  'FAILED',
] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

export const REFUND_STATES = ['NONE', ...Object.values(RefundStatus)] as const;
export type RefundState = 'NONE' | RefundStatus;

export interface TransactionSlip {
  id: string;
  slipokStatus: SlipStatus;
  amount: { toString(): string };
  transRef: string | null;
  sendingBank: string | null;
  senderName: string | null;
  receiverName: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
  source?: 'BOOKING' | 'PAYMENT_GROUP';
}

export interface TransactionRefund {
  id: string;
  status: RefundStatus;
  requestedAmount: { toString(): string };
  approvedAmount: { toString(): string } | null;
  createdAt: Date;
  reviewedAt: Date | null;
  processedAt: Date | null;
}

export interface TimelineInput {
  booking: {
    id: string;
    createdAt: Date;
    confirmedAt: Date | null;
    cancelledAt: Date | null;
  };
  paymentGroup: {
    id: string;
    createdAt: Date;
    confirmedAt: Date | null;
    cancelledAt: Date | null;
  } | null;
  slips: TransactionSlip[];
  refunds: TransactionRefund[];
}

export interface TransactionTimelineItem {
  type:
    | 'BOOKING_CREATED'
    | 'PAYMENT_GROUP_CREATED'
    | 'SLIP_VERIFIED'
    | 'SLIP_FAILED'
    | 'BOOKING_CONFIRMED'
    | 'BOOKING_CANCELLED'
    | 'PAYMENT_GROUP_CONFIRMED'
    | 'PAYMENT_GROUP_CANCELLED'
    | 'REFUND_REQUESTED'
    | 'REFUND_REVIEWED'
    | 'REFUND_PROCESSED';
  timestamp: Date;
  entityId: string;
  status?: string;
  amount?: string;
}

export function uniqueSlips(
  bookingSlips: TransactionSlip[],
  paymentGroupSlips: TransactionSlip[],
): TransactionSlip[] {
  const slips = new Map<string, TransactionSlip>();
  for (const slip of bookingSlips) {
    slips.set(slip.id, { ...slip, source: 'BOOKING' });
  }
  for (const slip of paymentGroupSlips) {
    slips.set(slip.id, { ...slip, source: 'PAYMENT_GROUP' });
  }
  return [...slips.values()].sort(compareNewest);
}

export function derivePaymentState(input: {
  isPaymentExempt: boolean;
  confirmedAt: Date | null;
  createdAt: Date;
  slips: TransactionSlip[];
}): { status: PaymentState; effectiveAt: Date } {
  if (input.isPaymentExempt) {
    return {
      status: 'EXEMPT',
      effectiveAt: input.confirmedAt ?? input.createdAt,
    };
  }

  const ordered = [...input.slips].sort(compareNewest);
  const verified = ordered.find(
    (slip) => slip.slipokStatus === SlipStatus.VERIFIED,
  );
  if (verified) {
    return {
      status: 'VERIFIED',
      effectiveAt: verified.verifiedAt ?? verified.createdAt,
    };
  }

  const latest = ordered[0];
  if (latest) {
    return { status: 'FAILED', effectiveAt: latest.createdAt };
  }

  return { status: 'AWAITING_SLIP', effectiveAt: input.createdAt };
}

export function deriveRefundState(refunds: TransactionRefund[]): RefundState {
  return [...refunds].sort(compareNewest)[0]?.status ?? 'NONE';
}

export function buildTransactionTimeline(
  input: TimelineInput,
): TransactionTimelineItem[] {
  const items: TransactionTimelineItem[] = [
    {
      type: 'BOOKING_CREATED',
      timestamp: input.booking.createdAt,
      entityId: input.booking.id,
    },
  ];

  addOptional(
    items,
    'BOOKING_CONFIRMED',
    input.booking.confirmedAt,
    input.booking.id,
  );
  addOptional(
    items,
    'BOOKING_CANCELLED',
    input.booking.cancelledAt,
    input.booking.id,
  );

  if (input.paymentGroup) {
    items.push({
      type: 'PAYMENT_GROUP_CREATED',
      timestamp: input.paymentGroup.createdAt,
      entityId: input.paymentGroup.id,
    });
    addOptional(
      items,
      'PAYMENT_GROUP_CONFIRMED',
      input.paymentGroup.confirmedAt,
      input.paymentGroup.id,
    );
    addOptional(
      items,
      'PAYMENT_GROUP_CANCELLED',
      input.paymentGroup.cancelledAt,
      input.paymentGroup.id,
    );
  }

  for (const slip of input.slips) {
    items.push({
      type:
        slip.slipokStatus === SlipStatus.VERIFIED
          ? 'SLIP_VERIFIED'
          : 'SLIP_FAILED',
      timestamp: slip.verifiedAt ?? slip.createdAt,
      entityId: slip.id,
      status: slip.slipokStatus,
      amount: slip.amount.toString(),
    });
  }

  for (const refund of input.refunds) {
    items.push({
      type: 'REFUND_REQUESTED',
      timestamp: refund.createdAt,
      entityId: refund.id,
      status: refund.status,
      amount: refund.requestedAmount.toString(),
    });
    if (refund.reviewedAt) {
      items.push({
        type: 'REFUND_REVIEWED',
        timestamp: refund.reviewedAt,
        entityId: refund.id,
        status: refund.status,
        amount: refund.approvedAmount?.toString(),
      });
    }
    if (refund.processedAt) {
      items.push({
        type: 'REFUND_PROCESSED',
        timestamp: refund.processedAt,
        entityId: refund.id,
        status: refund.status,
        amount: refund.approvedAmount?.toString(),
      });
    }
  }

  return items.sort(
    (left, right) =>
      left.timestamp.getTime() - right.timestamp.getTime() ||
      left.type.localeCompare(right.type) ||
      left.entityId.localeCompare(right.entityId),
  );
}

function addOptional(
  items: TransactionTimelineItem[],
  type: TransactionTimelineItem['type'],
  timestamp: Date | null,
  entityId: string,
) {
  if (timestamp) items.push({ type, timestamp, entityId });
}

function compareNewest(
  left: { id: string; createdAt: Date },
  right: { id: string; createdAt: Date },
) {
  return (
    right.createdAt.getTime() - left.createdAt.getTime() ||
    right.id.localeCompare(left.id)
  );
}
