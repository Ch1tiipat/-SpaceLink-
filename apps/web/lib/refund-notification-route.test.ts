/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const refundRouteAssert: typeof import('node:assert/strict') = require(
  'node:assert/strict',
);
const { test: refundRouteTest }: typeof import('node:test') =
  require('node:test');
const { refundNotificationHref } = require(
  './refund-notification-route.ts'
) as typeof import('./refund-notification-route');

refundRouteTest('routes refund notifications to the matching vendor refund', () => {
  refundRouteAssert.equal(
    refundNotificationHref('REFUND_REQUEST', 'refund id'),
    '/refunds?refundId=refund%20id',
  );
});

refundRouteTest('falls back to the refund list when no refund id is present', () => {
  refundRouteAssert.equal(
    refundNotificationHref('refund_request', null),
    '/refunds',
  );
  refundRouteAssert.equal(
    refundNotificationHref('BOOKING', 'booking-id'),
    null,
  );
});
