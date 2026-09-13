/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const reviewAssert: typeof import('node:assert/strict') = require('node:assert/strict');
const { test: reviewTest }: typeof import('node:test') = require('node:test');
const { isBookingReviewEligible } =
  require('./review-eligibility.ts') as typeof import('./review-eligibility');

reviewTest('allows a review immediately for every booking', () => {
  reviewAssert.equal(isBookingReviewEligible({ id: 'booking-1' }), true);
});
