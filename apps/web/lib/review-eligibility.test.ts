/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const reviewAssert: typeof import('node:assert/strict') = require('node:assert/strict');
const { test: reviewTest }: typeof import('node:test') = require('node:test');
const { isBookingReviewEligible } = require('./review-eligibility.ts') as typeof import('./review-eligibility');

const reviewEvent = {
  id: 'event-1',
  name: 'งานทดสอบ',
  endDate: '2026-09-05T00:00:00.000Z',
  endTime: '20:30',
};

reviewTest('uses the exact Bangkok event end time', () => {
  reviewAssert.equal(
    isBookingReviewEligible(
      { status: 'CONFIRMED', event: reviewEvent },
      new Date('2026-09-05T13:29:59.000Z').getTime(),
    ),
    false,
  );
  reviewAssert.equal(
    isBookingReviewEligible(
      { status: 'CONFIRMED', event: reviewEvent },
      new Date('2026-09-05T13:30:00.000Z').getTime(),
    ),
    true,
  );
});

reviewTest('falls back to 23:59 for missing or invalid end times', () => {
  for (const endTime of [null, 'invalid', '25:00']) {
    reviewAssert.equal(
      isBookingReviewEligible(
        { status: 'COMPLETED', event: { ...reviewEvent, endTime } },
        new Date('2026-09-05T16:58:59.000Z').getTime(),
      ),
      false,
    );
    reviewAssert.equal(
      isBookingReviewEligible(
        { status: 'COMPLETED', event: { ...reviewEvent, endTime } },
        new Date('2026-09-05T16:59:00.000Z').getTime(),
      ),
      true,
    );
  }
});

reviewTest('rejects statuses outside CONFIRMED and COMPLETED', () => {
  for (const status of ['PENDING_PAYMENT', 'CANCELLED', 'NO_SHOW'] as const) {
    reviewAssert.equal(
      isBookingReviewEligible(
        { status, event: reviewEvent },
        new Date('2026-09-06T00:00:00.000Z').getTime(),
      ),
      false,
    );
  }
});
