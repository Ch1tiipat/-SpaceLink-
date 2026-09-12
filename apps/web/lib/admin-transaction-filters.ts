export const ADMIN_TRANSACTION_TABS = [
  'bookings',
  'payments',
  'refunds',
  'vendors',
] as const;

export type AdminTransactionTab = (typeof ADMIN_TRANSACTION_TABS)[number];

export type AdminTransactionFilters = {
  tab: AdminTransactionTab;
  eventId: string;
  zoneId: string;
  vendorUserId: string;
  shopId: string;
  bookingStatus: string;
  paymentStatus: string;
  refundStatus: string;
  from: string;
  to: string;
  q: string;
  page: number;
  pageSize: number;
};

export const DEFAULT_ADMIN_TRANSACTION_FILTERS: AdminTransactionFilters = {
  tab: 'bookings',
  eventId: '',
  zoneId: '',
  vendorUserId: '',
  shopId: '',
  bookingStatus: '',
  paymentStatus: '',
  refundStatus: '',
  from: '',
  to: '',
  q: '',
  page: 1,
  pageSize: 25,
};

const BOOKING_STATUSES = new Set([
  'PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'NO_SHOW', 'COMPLETED',
]);
const PAYMENT_STATUSES = new Set(['EXEMPT', 'AWAITING_SLIP', 'VERIFIED', 'FAILED']);
const REFUND_STATUSES = new Set(['NONE', 'PENDING', 'APPROVED', 'REJECTED', 'PROCESSED']);
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function parseAdminTransactionFilters(
  params: Pick<URLSearchParams, 'get'>,
): AdminTransactionFilters {
  const tab = params.get('tab');
  return {
    tab: isTab(tab) ? tab : 'bookings',
    eventId: text(params, 'eventId'),
    zoneId: text(params, 'zoneId'),
    vendorUserId: text(params, 'vendorUserId'),
    shopId: text(params, 'shopId'),
    bookingStatus: allowed(params.get('bookingStatus'), BOOKING_STATUSES),
    paymentStatus: allowed(params.get('paymentStatus'), PAYMENT_STATUSES),
    refundStatus: allowed(params.get('refundStatus'), REFUND_STATUSES),
    from: date(params.get('from')),
    to: date(params.get('to')),
    q: (params.get('q') ?? '').trim().slice(0, 100),
    page: integer(params.get('page'), 1, Number.MAX_SAFE_INTEGER, 1),
    pageSize: integer(params.get('pageSize'), 1, 100, 25),
  };
}

export function serializeAdminTransactionFilters(
  filters: AdminTransactionFilters,
): URLSearchParams {
  const params = new URLSearchParams();
  params.set('tab', filters.tab);
  const optional: Array<[keyof AdminTransactionFilters, string]> = [
    ['eventId', filters.eventId], ['zoneId', filters.zoneId],
    ['vendorUserId', filters.vendorUserId], ['shopId', filters.shopId],
    ['bookingStatus', filters.bookingStatus], ['paymentStatus', filters.paymentStatus],
    ['refundStatus', filters.refundStatus], ['from', filters.from],
    ['to', filters.to], ['q', filters.q.trim()],
  ];
  optional.forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  if (filters.page !== 1) params.set('page', String(filters.page));
  if (filters.pageSize !== 25) params.set('pageSize', String(filters.pageSize));
  return params;
}

export function transactionViewForTab(tab: AdminTransactionTab) {
  return tab.toUpperCase() as 'BOOKINGS' | 'PAYMENTS' | 'REFUNDS' | 'VENDORS';
}

function isTab(value: string | null): value is AdminTransactionTab {
  return ADMIN_TRANSACTION_TABS.includes(value as AdminTransactionTab);
}

function text(params: Pick<URLSearchParams, 'get'>, key: string) {
  return (params.get(key) ?? '').trim();
}

function allowed(value: string | null, values: Set<string>) {
  return value && values.has(value) ? value : '';
}

function date(value: string | null) {
  return value && DATE_ONLY.test(value) ? value : '';
}

function integer(value: string | null, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}
