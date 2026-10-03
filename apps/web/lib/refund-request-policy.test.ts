/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const refundAssert: typeof import('node:assert/strict') = require(
  'node:assert/strict'
);
const { test: refundTest }: typeof import('node:test') = require('node:test');
const {
  canRequestRefund,
  isValidRefundAmount,
  refundFlowAction,
  refundFlowFailureMessage,
  sumRefundAmounts,
} = require('./refund-request-policy.ts') as typeof import('./refund-request-policy');

const booking = {
  id: 'booking-1',
  status: 'CANCELLED' as const,
  isPaymentExempt: false,
  confirmedAt: '2026-09-01T00:00:00.000Z',
};

refundTest('allows a paid, cancelled booking with no existing refund', () => {
  refundAssert.equal(canRequestRefund(booking, []), true);
});

refundTest('rejects non-cancelled, exempt, unpaid, and duplicate requests', () => {
  refundAssert.equal(
    canRequestRefund({ ...booking, status: 'CONFIRMED' }, []),
    false,
  );
  refundAssert.equal(
    canRequestRefund({ ...booking, isPaymentExempt: true }, []),
    false,
  );
  refundAssert.equal(
    canRequestRefund({ ...booking, confirmedAt: null }, []),
    false,
  );
  refundAssert.equal(
    canRequestRefund(booking, [{ bookingId: booking.id }]),
    false,
  );
});

refundTest('offers a direct request for cancelled bookings', () => {
  refundAssert.equal(
    refundFlowAction(
      { ...booking, bookingEndDate: '2026-10-04T00:00:00.000Z' },
      [],
      '2026-10-03T05:00:00.000Z',
    ),
    'REQUEST',
  );
});

refundTest('offers cancel then request for confirmed bookings before the deadline', () => {
  refundAssert.equal(
    refundFlowAction(
      {
        ...booking,
        status: 'CONFIRMED',
        bookingEndDate: '2026-10-03T17:00:00.000Z',
      },
      [],
      '2026-10-03T16:59:59.000Z',
    ),
    'CANCEL_AND_REQUEST',
  );
});

refundTest('does not offer cancellation after the Thailand calendar deadline', () => {
  refundAssert.equal(
    refundFlowAction(
      {
        ...booking,
        status: 'CONFIRMED',
        bookingEndDate: '2026-10-03T16:59:59.000Z',
      },
      [],
      '2026-10-03T17:00:00.000Z',
    ),
    null,
  );
});

refundTest('rejects ineligible and duplicate refund flows', () => {
  const confirmed = {
    ...booking,
    status: 'CONFIRMED' as const,
    bookingEndDate: '2026-10-04T00:00:00.000Z',
  };
  refundAssert.equal(
    refundFlowAction({ ...confirmed, status: 'PENDING_PAYMENT' }, []),
    null,
  );
  refundAssert.equal(
    refundFlowAction({ ...confirmed, status: 'COMPLETED' }, []),
    null,
  );
  refundAssert.equal(
    refundFlowAction({ ...confirmed, isPaymentExempt: true }, []),
    null,
  );
  refundAssert.equal(
    refundFlowAction({ ...confirmed, confirmedAt: null }, []),
    null,
  );
  refundAssert.equal(
    refundFlowAction(confirmed, [{ bookingId: confirmed.id }]),
    null,
  );
});

refundTest(
  'validates a positive decimal amount no greater than the booth price',
  () => {
    refundAssert.equal(isValidRefundAmount('1500', '1500.00'), true);
    refundAssert.equal(isValidRefundAmount('1499.99', '1500.00'), true);
    refundAssert.equal(isValidRefundAmount('1500.01', '1500.00'), false);
    refundAssert.equal(isValidRefundAmount('0', '1500.00'), false);
    refundAssert.equal(isValidRefundAmount('1.001', '1500.00'), false);
  },
);

refundTest('sums selected booth amounts without floating-point money math', () => {
  refundAssert.equal(sumRefundAmounts(['1500', '900.25']), '2400.25');
  refundAssert.equal(sumRefundAmounts(['0.01', '0.02']), '0.03');
  refundAssert.equal(sumRefundAmounts([]), null);
  refundAssert.equal(sumRefundAmounts(['1500', 'invalid']), null);
});

refundTest('explains irreversible partial cancellation and how to retry', () => {
  const message = refundFlowFailureMessage(
    'ยกเลิก Booth A03 ไม่สำเร็จ: กรุณาลองใหม่',
    ['A01', 'A02', 'A01'],
  );

  refundAssert.match(message, /Booth ที่ยกเลิกสำเร็จแล้ว: A01, A02/);
  refundAssert.match(message, /การยกเลิกย้อนกลับไม่ได้/);
  refundAssert.match(message, /ยังไม่ได้ส่งคำขอคืนเงิน/);
  refundAssert.match(message, /กรุณากดยื่นคำขออีกครั้ง/);
});

refundTest('keeps a normal failure concise when no booth was cancelled', () => {
  refundAssert.equal(
    refundFlowFailureMessage('ส่งคำร้องคืนเงินไม่สำเร็จ', []),
    'ส่งคำร้องคืนเงินไม่สำเร็จ',
  );
});
