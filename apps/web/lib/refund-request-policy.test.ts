/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const refundAssert: typeof import('node:assert/strict') = require(
  'node:assert/strict'
);
const { test: refundTest }: typeof import('node:test') = require('node:test');
const {
  canRequestRefund,
  isValidRefundAmount,
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
