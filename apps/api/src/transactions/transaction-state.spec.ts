import { Prisma, RefundStatus, SlipStatus } from '@prisma/client';
import {
  buildTransactionTimeline,
  derivePaymentState,
  deriveRefundState,
  uniqueSlips,
  type TransactionRefund,
  type TransactionSlip,
} from './transaction-state';

const CREATED = new Date('2026-09-01T00:00:00.000Z');

function slip(
  id: string,
  status: SlipStatus,
  createdAt = CREATED,
  verifiedAt: Date | null = null,
): TransactionSlip {
  return {
    id,
    slipokStatus: status,
    amount: new Prisma.Decimal('1500.00'),
    transRef: null,
    sendingBank: null,
    senderName: null,
    receiverName: null,
    verifiedAt,
    createdAt,
  };
}

function refund(
  id: string,
  status: RefundStatus,
  createdAt: Date,
): TransactionRefund {
  return {
    id,
    status,
    requestedAmount: new Prisma.Decimal('500.00'),
    approvedAmount: null,
    createdAt,
    reviewedAt: null,
    processedAt: null,
  };
}

describe('transaction state', () => {
  it('prioritizes payment exemption even when slips exist', () => {
    expect(
      derivePaymentState({
        isPaymentExempt: true,
        confirmedAt: new Date('2026-09-02T00:00:00.000Z'),
        createdAt: CREATED,
        slips: [slip('slip-1', SlipStatus.ERROR)],
      }),
    ).toEqual({
      status: 'EXEMPT',
      effectiveAt: new Date('2026-09-02T00:00:00.000Z'),
    });
  });

  it('returns awaiting, failed and verified from real slip status', () => {
    expect(
      derivePaymentState({
        isPaymentExempt: false,
        confirmedAt: null,
        createdAt: CREATED,
        slips: [],
      }).status,
    ).toBe('AWAITING_SLIP');
    expect(
      derivePaymentState({
        isPaymentExempt: false,
        confirmedAt: null,
        createdAt: CREATED,
        slips: [slip('failed', SlipStatus.DUPLICATE)],
      }).status,
    ).toBe('FAILED');
    expect(
      derivePaymentState({
        isPaymentExempt: false,
        confirmedAt: null,
        createdAt: CREATED,
        slips: [
          slip('verified', SlipStatus.VERIFIED),
          slip(
            'newer-failure',
            SlipStatus.ERROR,
            new Date('2026-09-03T00:00:00.000Z'),
          ),
        ],
      }).status,
    ).toBe('VERIFIED');
  });

  it('deduplicates a group slip and marks the group source', () => {
    const shared = slip('shared', SlipStatus.VERIFIED);
    expect(uniqueSlips([shared], [shared])).toEqual([
      expect.objectContaining({ id: 'shared', source: 'PAYMENT_GROUP' }),
    ]);
  });

  it('uses the latest refund deterministically', () => {
    const sameTime = new Date('2026-09-04T00:00:00.000Z');
    expect(
      deriveRefundState([
        refund('a', RefundStatus.PENDING, sameTime),
        refund('b', RefundStatus.APPROVED, sameTime),
      ]),
    ).toBe(RefundStatus.APPROVED);
    expect(deriveRefundState([])).toBe('NONE');
  });

  it('builds only persisted milestones in stable chronological order', () => {
    const rows = buildTransactionTimeline({
      booking: {
        id: 'booking-1',
        createdAt: CREATED,
        confirmedAt: new Date('2026-09-03T00:00:00.000Z'),
        cancelledAt: null,
      },
      paymentGroup: null,
      slips: [
        slip(
          'slip-1',
          SlipStatus.VERIFIED,
          new Date('2026-09-02T00:00:00.000Z'),
        ),
      ],
      refunds: [
        {
          ...refund(
            'refund-1',
            RefundStatus.PROCESSED,
            new Date('2026-09-04T00:00:00.000Z'),
          ),
          reviewedAt: new Date('2026-09-05T00:00:00.000Z'),
          processedAt: new Date('2026-09-06T00:00:00.000Z'),
        },
      ],
    });

    expect(rows.map((row) => row.type)).toEqual([
      'BOOKING_CREATED',
      'SLIP_VERIFIED',
      'BOOKING_CONFIRMED',
      'REFUND_REQUESTED',
      'REFUND_REVIEWED',
      'REFUND_PROCESSED',
    ]);
    expect(rows).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'BOOKING_COMPLETED' }),
      ]),
    );
  });
});
