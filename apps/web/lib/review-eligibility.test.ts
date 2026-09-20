/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const reviewAssert: typeof import('node:assert/strict') = require('node:assert/strict');
const { test: reviewTest }: typeof import('node:test') = require('node:test');
const { isBookingReviewEligible } =
  require('./review-eligibility.ts') as typeof import('./review-eligibility');

const endedEvent = {
  id: 'event-1',
  name: 'งานทดสอบ',
  endDate: '2026-09-05T00:00:00.000Z',
  endTime: '20:00',
};
const now = new Date('2026-09-05T13:01:00.000Z');

reviewTest('allows a completed booking after the event end time', () => {
  reviewAssert.equal(
    isBookingReviewEligible(
      { status: 'COMPLETED', event: endedEvent },
      now,
    ),
    true,
  );
});

reviewTest('rejects a booking that is not completed', () => {
  reviewAssert.equal(
    isBookingReviewEligible(
      { status: 'CONFIRMED', event: endedEvent },
      now,
    ),
    false,
  );
});

reviewTest('rejects a completed booking before the event end time', () => {
  reviewAssert.equal(
    isBookingReviewEligible(
      {
        status: 'COMPLETED',
        event: { ...endedEvent, endTime: '20:02' },
      },
      now,
    ),
    false,
  );
});

reviewTest('uses the end of day when an event has no end time', () => {
  reviewAssert.equal(
    isBookingReviewEligible(
      {
        status: 'COMPLETED',
        event: { ...endedEvent, endTime: null },
      },
      now,
    ),
    false,
  );
});
