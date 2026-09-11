/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const filterAssert: typeof import('node:assert/strict') = require('node:assert/strict');
const { test: filterTest }: typeof import('node:test') = require('node:test');
const {
  DEFAULT_ADMIN_TRANSACTION_FILTERS,
  parseAdminTransactionFilters,
  serializeAdminTransactionFilters,
  transactionViewForTab,
} = require('./admin-transaction-filters.ts') as typeof import('./admin-transaction-filters');

filterTest('parses every supported URL-backed filter', () => {
  const parsed = parseAdminTransactionFilters(new URLSearchParams({
    tab: 'payments', eventId: 'event-1', zoneId: 'zone-1', vendorUserId: 'vendor-1',
    shopId: 'shop-1', bookingStatus: 'CONFIRMED', paymentStatus: 'VERIFIED',
    refundStatus: 'APPROVED', from: '2026-09-01', to: '2026-09-30',
    q: '  BK-101  ', page: '3', pageSize: '50',
  }));
  filterAssert.deepEqual(parsed, {
    tab: 'payments', eventId: 'event-1', zoneId: 'zone-1', vendorUserId: 'vendor-1',
    shopId: 'shop-1', bookingStatus: 'CONFIRMED', paymentStatus: 'VERIFIED',
    refundStatus: 'APPROVED', from: '2026-09-01', to: '2026-09-30',
    q: 'BK-101', page: 3, pageSize: 50,
  });
});

filterTest('falls back for unsupported enums, dates and pagination', () => {
  const parsed = parseAdminTransactionFilters(new URLSearchParams({
    tab: 'audit', bookingStatus: 'PAID', paymentStatus: 'PENDING',
    refundStatus: 'UNKNOWN', from: '01/09/2026', page: '0', pageSize: '101',
  }));
  filterAssert.deepEqual(parsed, DEFAULT_ADMIN_TRANSACTION_FILTERS);
});

filterTest('serializes compact bookmarks and preserves non-default pagination', () => {
  const params = serializeAdminTransactionFilters({
    ...DEFAULT_ADMIN_TRANSACTION_FILTERS,
    tab: 'refunds', refundStatus: 'PENDING', q: '  คืนเงิน  ', page: 2, pageSize: 50,
  });
  filterAssert.equal(params.toString(), 'tab=refunds&refundStatus=PENDING&q=%E0%B8%84%E0%B8%B7%E0%B8%99%E0%B9%80%E0%B8%87%E0%B8%B4%E0%B8%99&page=2&pageSize=50');
});

filterTest('round trips a valid filter set', () => {
  const expected = { ...DEFAULT_ADMIN_TRANSACTION_FILTERS, tab: 'vendors' as const, eventId: 'event-1', q: 'Somchai' };
  filterAssert.deepEqual(parseAdminTransactionFilters(serializeAdminTransactionFilters(expected)), expected);
});

filterTest('maps tabs to API views', () => {
  filterAssert.equal(transactionViewForTab('bookings'), 'BOOKINGS');
  filterAssert.equal(transactionViewForTab('payments'), 'PAYMENTS');
  filterAssert.equal(transactionViewForTab('refunds'), 'REFUNDS');
  filterAssert.equal(transactionViewForTab('vendors'), 'VENDORS');
});
