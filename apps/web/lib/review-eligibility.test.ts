/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const reviewAssert: typeof import('node:assert/strict') = require('node:assert/strict');
const { test: reviewTest }: typeof import('node:test') = require('node:test');
const { isBookingReviewEligible } =
  require('./review-eligibility.ts') as typeof import('./review-eligibility');

(['CONFIRMED', 'COMPLETED'] as const).forEach((status) => {
  reviewTest(`allows a ${status} booking immediately`, () => {
    reviewAssert.equal(isBookingReviewEligible({ status }), true);
  });
});

(['PENDING_PAYMENT', 'CANCELLED', 'NO_SHOW'] as const).forEach((status) => {
  reviewTest(`rejects a ${status} booking`, () => {
    reviewAssert.equal(isBookingReviewEligible({ status }), false);
  });
});
