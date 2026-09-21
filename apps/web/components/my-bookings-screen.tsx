'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Clock3,
  Plus,
  ReceiptText,
  Search,
  X,
} from 'lucide-react';
import { BookingCountdown } from '@/components/booking-countdown';
import {
  getPreviewBookings,
  isBookingCancellationOpen,
  isBookingReviewEligible,
} from '@/components/booking-detail-screen';
import { getMyBookings, type BookingStatus, type MyBooking } from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import {
  getUxPreviewMode,
  subscribeToUxPreview,
  UX_PREVIEW_TOKEN,
} from '@/lib/ux-preview';

type AccessState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'ready'; token: string }
  | { status: 'error'; message: string };

type BookingFilter =
  'ALL' | 'PAYMENT' | 'CONFIRMATION' | 'COMPLETED' | 'CANCELLED';
type SortOrder = 'newest' | 'oldest';

type BookingGroup = {
  key: string;
  bookings: MyBooking[];
  primary: MyBooking;
  status: BookingStatus;
  totalAmount: string;
};

const statusLabel: Record<BookingStatus, string> = {
  PENDING_PAYMENT: 'รอชำระเงิน',
  CONFIRMED: 'ยืนยันแล้ว',
  CANCELLED: 'ยกเลิกแล้ว',
  NO_SHOW: 'ไม่มาเข้าร่วม',
  COMPLETED: 'เสร็จสิ้น',
};

const statusTone: Record<BookingStatus, string> = {
  PENDING_PAYMENT: 'border-[#d5e6f5] bg-[#edf6ff] text-[#1d67a8]',
  CONFIRMED: 'border-[#b9dfd3] bg-[#ebfaf3] text-[#13795b]',
  CANCELLED: 'border-[#fac5bf] bg-[#fff0ee] text-[#b42318]',
  NO_SHOW: 'border-[#ead8b7] bg-[#fff8e8] text-[#895b08]',
  COMPLETED: 'border-[#d9ccef] bg-[#f4efff] text-violet',
};

const bookingFilters: readonly { value: BookingFilter; label: string }[] = [
  { value: 'ALL', label: 'ทั้งหมด' },
  { value: 'PAYMENT', label: 'การชำระเงิน' },
  { value: 'CONFIRMATION', label: 'การยืนยัน' },
  { value: 'COMPLETED', label: 'เสร็จสิ้น' },
  { value: 'CANCELLED', label: 'ยกเลิก' },
];

const HOLD_STATUS_REFRESH_ATTEMPTS = 13;
const HOLD_STATUS_REFRESH_INTERVAL_MS = 5_000;

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

const dateFormatter = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatMoney(value: string): string {
  const [whole, fraction] = value.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction && !/^0+$/.test(fraction)
    ? `${grouped}.${fraction}`
    : grouped;
}

function toSatang(value: string): bigint {
  const normalized = value.trim();
  const [whole = '0', fraction = ''] = normalized.split('.');
  return (
    BigInt(whole || '0') * BigInt(100) +
    BigInt(fraction.padEnd(2, '0').slice(0, 2))
  );
}

function fromSatang(value: bigint): string {
  return `${value / BigInt(100)}.${(value % BigInt(100)).toString().padStart(2, '0')}`;
}

function resolveGroupStatus(items: MyBooking[]): BookingStatus {
  if (items.some((booking) => booking.status === 'PENDING_PAYMENT')) {
    return 'PENDING_PAYMENT';
  }
  if (items.some((booking) => booking.status === 'CONFIRMED')) {
    return 'CONFIRMED';
  }
  if (items.every((booking) => booking.status === 'COMPLETED')) {
    return 'COMPLETED';
  }
  if (items.every((booking) => booking.status === 'NO_SHOW')) return 'NO_SHOW';
  if (
    items.every(
      (booking) =>
        booking.status === 'CANCELLED' || booking.status === 'NO_SHOW',
    )
  ) {
    return 'CANCELLED';
  }
  return items[0]?.status ?? 'CANCELLED';
}

function groupBookings(bookings: MyBooking[]): BookingGroup[] {
  const groups = new Map<string, MyBooking[]>();
  bookings.forEach((booking) => {
    const key = booking.paymentGroupId
      ? `payment-group:${booking.paymentGroupId}`
      : `booking:${booking.id}`;
    groups.set(key, [...(groups.get(key) ?? []), booking]);
  });

  return Array.from(groups, ([key, items]) => ({
    key,
    bookings: items,
    primary: items[0],
    status: resolveGroupStatus(items),
    totalAmount: fromSatang(
      items.reduce(
        (total, booking) => total + toSatang(booking.boothPrice),
        BigInt(0),
      ),
    ),
  }));
}

function matchesFilter(group: BookingGroup, filter: BookingFilter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'PAYMENT') return group.status === 'PENDING_PAYMENT';
  if (filter === 'CONFIRMATION') return group.status === 'CONFIRMED';
  if (filter === 'COMPLETED') return group.status === 'COMPLETED';
  return group.status === 'CANCELLED' || group.status === 'NO_SHOW';
}

function isExpired(booking: MyBooking): boolean {
  return (
    booking.status === 'PENDING_PAYMENT' &&
    (!booking.holdExpiresAt ||
      new Date(booking.holdExpiresAt).getTime() <= Date.now())
  );
}

function isNearCancelDeadline(booking: MyBooking): boolean {
  return (
    (booking.status === 'PENDING_PAYMENT' || booking.status === 'CONFIRMED') &&
    isBookingCancellationOpen(booking.bookingEndDate) &&
    !isBookingCancellationOpen(
      booking.bookingEndDate,
      Date.now() + 24 * 60 * 60 * 1000,
    )
  );
}

export function MyBookingsScreen() {
  const [access, setAccess] = useState<AccessState>({ status: 'loading' });
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expiredIds, setExpiredIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BookingFilter>('ALL');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [selectedGroup, setSelectedGroup] = useState<BookingGroup | null>(null);

  async function refreshBookings(token: string, signal?: AbortSignal) {
    setIsLoading(true);
    setLoadError(null);
    try {
      const items = await getMyBookings(token, signal);
      setBookings(items);
      setExpiredIds(
        new Set(
          items.filter((booking) => isExpired(booking)).map(({ id }) => id),
        ),
      );
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setLoadError(
        cause instanceof Error ? cause.message : 'ไม่สามารถโหลดรายการจองได้',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const previewMode = getUxPreviewMode();
    if (previewMode) {
      const applyPreview = (mode: 'signed-in' | 'signed-out') => {
        setAccess(
          mode === 'signed-in'
            ? { status: 'ready', token: UX_PREVIEW_TOKEN }
            : { status: 'signed-out' },
        );
        setBookings(mode === 'signed-in' ? getPreviewBookings() : []);
        setLoadError(null);
        setIsLoading(false);
      };
      applyPreview(previewMode);
      return subscribeToUxPreview(applyPreview);
    }

    const controller = new AbortController();
    let active = true;

    let supabase: ReturnType<typeof getSupabaseBrowserClient>;
    try {
      supabase = getSupabaseBrowserClient();
    } catch (cause) {
      setAccess({
        status: 'error',
        message:
          cause instanceof Error
            ? cause.message
            : 'ยังไม่ได้ตั้งค่าระบบเข้าสู่ระบบ',
      });
      setIsLoading(false);
      return;
    }

    async function resolve(token: string | undefined) {
      if (!token) {
        if (active) {
          setAccess({ status: 'signed-out' });
          setBookings([]);
          setIsLoading(false);
        }
        return;
      }

      if (active) setAccess({ status: 'ready', token });
      await refreshBookings(token, controller.signal);
    }

    void supabase.auth
      .getSession()
      .then(({ data: sessionData }) =>
        resolve(sessionData.session?.access_token),
      );
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'INITIAL_SESSION') return;
        void resolve(session?.access_token);
      },
    );

    return () => {
      active = false;
      controller.abort();
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search)
      .get('tab')
      ?.toLowerCase();
    const filtersByTab: Record<string, BookingFilter> = {
      all: 'ALL',
      pending: 'PAYMENT',
      pending_payment: 'PAYMENT',
      payment: 'PAYMENT',
      confirmed: 'CONFIRMATION',
      confirmation: 'CONFIRMATION',
      completed: 'COMPLETED',
      cancelled: 'CANCELLED',
      no_show: 'CANCELLED',
    };
    if (requestedTab && filtersByTab[requestedTab]) {
      setStatusFilter(filtersByTab[requestedTab]);
    }
  }, []);

  async function handleExpired(bookingId: string) {
    setExpiredIds((current) => new Set(current).add(bookingId));
    if (access.status !== 'ready') return;

    for (
      let attempt = 0;
      attempt < HOLD_STATUS_REFRESH_ATTEMPTS;
      attempt += 1
    ) {
      try {
        const items = await getMyBookings(access.token);
        const refreshed = items.find((booking) => booking.id === bookingId);
        setBookings(items);
        setExpiredIds(
          new Set(
            items.filter((booking) => isExpired(booking)).map(({ id }) => id),
          ),
        );

        if (!refreshed || refreshed.status !== 'PENDING_PAYMENT') return;
      } catch {
        return;
      }

      if (attempt < HOLD_STATUS_REFRESH_ATTEMPTS - 1) {
        await wait(HOLD_STATUS_REFRESH_INTERVAL_MS);
      }
    }
  }

  const bookingGroups = useMemo(() => groupBookings(bookings), [bookings]);
  const pendingCount = bookingGroups.filter(
    (group) => group.status === 'PENDING_PAYMENT',
  ).length;
  const confirmedCount = bookingGroups.filter(
    (group) => group.status === 'CONFIRMED',
  ).length;
  const completedCount = bookingGroups.filter(
    (group) => group.status === 'COMPLETED',
  ).length;
  const statusCounts = useMemo(() => {
    const counts = new Map<BookingFilter, number>();
    bookingGroups.forEach((group) => {
      const filter: BookingFilter =
        group.status === 'PENDING_PAYMENT'
          ? 'PAYMENT'
          : group.status === 'CONFIRMED'
            ? 'CONFIRMATION'
            : group.status === 'COMPLETED'
              ? 'COMPLETED'
              : 'CANCELLED';
      counts.set(filter, (counts.get(filter) ?? 0) + 1);
    });
    return counts;
  }, [bookingGroups]);
  const visibleBookings = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('th');
    const filtered = bookingGroups.filter((group) => {
      const searchableBookings = group.bookings
        .map(
          (booking) =>
            `${booking.bookingCode} ${booking.booth.code} ${booking.booth.zone.name ?? booking.booth.zone.code}`,
        )
        .join(' ');
      const matchesKeyword =
        !keyword ||
        `${group.primary.event.name} ${group.primary.shop.name} ${searchableBookings}`
          .toLocaleLowerCase('th')
          .includes(keyword);
      return matchesFilter(group, statusFilter) && matchesKeyword;
    });

    return filtered.sort((left, right) => {
      const difference =
        new Date(right.primary.createdAt).getTime() -
        new Date(left.primary.createdAt).getTime();
      return sortOrder === 'oldest' ? -difference : difference;
    });
  }, [bookingGroups, query, sortOrder, statusFilter]);

  return (
    <main className="sl-page pb-16">
      <div className="shell py-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="sl-kicker">My bookings</span>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
              การจองของฉัน
            </h1>
            <p className="mt-2 text-muted">
              ตรวจสอบสถานะ ชำระเงิน หรือยกเลิกการจองที่ยังดำเนินการอยู่
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="sl-action-primary inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" aria-hidden />
              จองบูธเพิ่ม
            </Link>
            <Link
              href="/refunds"
              className="sl-action-secondary inline-flex items-center gap-2 text-violet"
            >
              <ReceiptText className="h-4 w-4" aria-hidden />
              ติดตามคำขอคืนเงิน
            </Link>
          </div>
        </div>

        {access.status === 'ready' && !isLoading && !loadError ? (
          <section
            className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4"
            aria-label="สรุปการจอง"
          >
            {[
              [
                'การจองทั้งหมด',
                bookingGroups.length,
                'bg-[#f4efff] text-violet',
              ],
              ['รอชำระเงิน', pendingCount, 'bg-[#edf6ff] text-[#1d67a8]'],
              ['รอยืนยัน', confirmedCount, 'bg-[#ebfaf3] text-[#13795b]'],
              ['เสร็จสิ้น', completedCount, 'bg-[#eef7fb] text-[#276b87]'],
            ].map(([label, value, tone]) => (
              <div key={label} className="sl-soft-surface p-4 sm:p-5">
                <span className="text-xs font-bold text-muted">{label}</span>
                <strong
                  className={`mt-3 grid h-11 w-11 place-items-center rounded-2xl px-3 text-lg ${tone}`}
                >
                  {value}
                </strong>
                <p className="mt-2 text-sm font-extrabold tracking-[.1em] text-muted">
                  {label === 'การจองทั้งหมด'
                    ? 'ALL BOOKINGS'
                    : label === 'รอชำระเงิน'
                      ? 'PENDING'
                      : label === 'รอยืนยัน'
                        ? 'AWAITING CONFIRMATION'
                        : 'COMPLETED'}
                </p>
              </div>
            ))}
          </section>
        ) : null}

        {access.status === 'ready' && !isLoading && !loadError && (
          <section className="mt-5" aria-label="ค้นหาและกรองการจอง">
            <div className="sl-surface grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_220px]">
              <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-white px-4 focus-within:border-violet focus-within:ring-2 focus-within:ring-violet/15">
                <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                <span className="sr-only">ค้นหารายการจอง</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ค้นหา Event, รหัสจอง, บูธ หรือร้านค้า"
                  className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
                />
              </label>
              <label>
                <span className="sr-only">เรียงรายการจอง</span>
                <select
                  value={sortOrder}
                  onChange={(event) =>
                    setSortOrder(event.target.value as SortOrder)
                  }
                  className="min-h-12 w-full rounded-2xl border border-line bg-white px-4 text-base font-bold text-ink outline-none focus:border-violet focus:ring-2 focus:ring-violet/15"
                >
                  <option value="newest">ล่าสุดก่อน</option>
                  <option value="oldest">เก่าก่อน</option>
                </select>
              </label>
            </div>

            <nav
              className="mt-3 flex gap-2 overflow-x-auto rounded-[22px] border border-line bg-white p-2 shadow-sm"
              aria-label="กรองสถานะการจอง"
            >
              {bookingFilters.map((filter) => {
                const count =
                  filter.value === 'ALL'
                    ? bookingGroups.length
                    : (statusCounts.get(filter.value) ?? 0);
                const active = statusFilter === filter.value;

                return (
                  <button
                    key={filter.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setStatusFilter(filter.value)}
                    className={`flex min-h-10 shrink-0 items-center gap-2 rounded-2xl px-3.5 text-xs font-extrabold transition ${
                      active
                        ? 'bg-violet-tint text-violet'
                        : 'text-muted hover:bg-mist hover:text-ink'
                    }`}
                  >
                    {filter.label}
                    <span
                      className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-sm ${active ? 'bg-violet text-white' : 'bg-[#f1eef5]'}`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </nav>
          </section>
        )}

        {access.status === 'signed-out' && (
          <section className="sl-surface mt-8 p-8 text-center">
            <h2 className="text-xl font-bold">กรุณาเข้าสู่ระบบก่อน</h2>
            <p className="mt-2 text-muted">
              รายการจองจะแสดงเฉพาะของบัญชีผู้ขายปัจจุบัน
            </p>
            <Link href="/login" className="sl-action-primary mt-6">
              เข้าสู่ระบบ
            </Link>
          </section>
        )}

        {access.status === 'error' && (
          <p
            role="alert"
            className="mt-8 rounded-2xl bg-[#fff0ee] px-5 py-4 text-[#b42318]"
          >
            {access.message}
          </p>
        )}

        {access.status !== 'signed-out' &&
          access.status !== 'error' &&
          isLoading && (
            <div className="mt-8 grid gap-5">
              <div className="skeleton h-64 rounded-[28px]" />
              <div className="skeleton h-64 rounded-[28px]" />
            </div>
          )}

        {loadError && !isLoading && (
          <div
            className="mt-8 rounded-2xl bg-[#fff0ee] px-5 py-4 text-[#b42318]"
            role="alert"
          >
            <p>{loadError}</p>
            {access.status === 'ready' && (
              <button
                type="button"
                onClick={() => void refreshBookings(access.token)}
                className="mt-3 font-bold underline"
              >
                ลองโหลดอีกครั้ง
              </button>
            )}
          </div>
        )}

        {access.status === 'ready' &&
          !isLoading &&
          !loadError &&
          bookings.length === 0 && (
            <section className="sl-surface mt-8 p-10 text-center">
              <h2 className="text-xl font-bold">ยังไม่มีรายการจอง</h2>
              <p className="mt-2 text-muted">
                เลือก Event และบูธที่เหมาะกับร้านของคุณเพื่อเริ่มต้น
              </p>
            </section>
          )}

        {access.status === 'ready' && !isLoading && !loadError && (
          <div className="mt-8 grid gap-6">
            {bookings.length > 0 && visibleBookings.length === 0 && (
              <section className="sl-surface p-10 text-center">
                <h2 className="text-xl font-bold">
                  ไม่พบรายการที่ตรงกับตัวกรอง
                </h2>
                <p className="mt-2 text-muted">
                  ลองเปลี่ยนคำค้นหาหรือเลือกดูสถานะอื่น
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setStatusFilter('ALL');
                  }}
                  className="sl-action-secondary mt-5 text-violet"
                >
                  ล้างตัวกรอง
                </button>
              </section>
            )}
            {visibleBookings.map((group) => {
              const booking = group.primary;
              const holdExpired = group.bookings.some(
                (item) => expiredIds.has(item.id) || isExpired(item),
              );
              const boothCodes = group.bookings
                .map((item) => item.booth.code)
                .join(' + ');
              const zoneNames = Array.from(
                new Set(
                  group.bookings.map(
                    (item) => item.booth.zone.name ?? item.booth.zone.code,
                  ),
                ),
              ).join(', ');
              const reviewBooking =
                group.status === 'COMPLETED'
                  ? group.bookings.find((item) => isBookingReviewEligible(item))
                  : undefined;
              return (
                <article key={group.key} className="sl-surface p-5 sm:p-7">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusTone[group.status]}`}
                        >
                          {statusLabel[group.status]}
                        </span>
                        {group.bookings.some(isNearCancelDeadline) ? (
                          <span className="inline-flex rounded-full border border-[#f5d28c] bg-[#fff8e8] px-3 py-1 text-xs font-bold text-[#895b08]">
                            ใกล้หมดเขตยกเลิก
                          </span>
                        ) : null}
                      </div>
                      <h2 className="mt-3 text-xl font-bold">
                        {booking.event.name}
                      </h2>
                      <p className="mt-1 text-sm text-muted">
                        {group.bookings.length === 1
                          ? `รหัสการจอง ${booking.bookingCode}`
                          : `${group.bookings.length} รายการในชุดชำระเงินเดียว`}
                      </p>
                    </div>
                    {group.status === 'PENDING_PAYMENT' && (
                      <BookingCountdown
                        expiresAt={booking.holdExpiresAt}
                        active
                        onExpired={() => void handleExpired(booking.id)}
                      />
                    )}
                  </div>

                  <dl className="mt-5 grid gap-3 rounded-[20px] border border-[#ebe5f4] bg-[#faf8ff] p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <BookingDetail label="บูธ" value={boothCodes} />
                    <BookingDetail label="พื้นที่" value={zoneNames} />
                    <BookingDetail
                      label="ยอดรวม"
                      value={`${formatMoney(group.totalAmount)} บาท`}
                    />
                    <BookingDetail
                      label="วันที่จัดงาน"
                      value={`${dateFormatter.format(new Date(booking.bookingStartDate))} – ${dateFormatter.format(new Date(booking.bookingEndDate))}`}
                    />
                  </dl>

                  {holdExpired ? (
                    <p className="mt-5 rounded-2xl bg-[#fff0ee] px-4 py-3 text-sm font-bold text-[#b42318]">
                      Hold หมดเวลาแล้ว ระบบกำลังอัปเดตสถานะการจอง
                    </p>
                  ) : null}

                  <div className="mt-5 flex flex-wrap gap-3 border-t border-line pt-5">
                    <button
                      type="button"
                      onClick={() => setSelectedGroup(group)}
                      className="sl-action-secondary text-violet"
                    >
                      ดูรายละเอียด
                    </button>
                    <Link
                      href={`/events/${encodeURIComponent(booking.event.slug ?? '')}`}
                      className="sl-action-secondary text-violet"
                    >
                      ดู Event
                    </Link>
                    {group.status === 'PENDING_PAYMENT' && !holdExpired ? (
                      <Link
                        href={
                          booking.paymentGroupId
                            ? `/bookings/payment-groups/${encodeURIComponent(booking.paymentGroupId)}/payment`
                            : `/bookings/${encodeURIComponent(booking.bookingCode)}/payment`
                        }
                        className="sl-action-primary"
                      >
                        ชำระเงิน
                      </Link>
                    ) : null}
                    <Link
                      href={`/events/${encodeURIComponent(booking.event.slug ?? '')}/map?zone=${encodeURIComponent(booking.booth.zone.code)}`}
                      className="sl-action-secondary text-violet"
                    >
                      ดู Zone Map
                    </Link>
                    {reviewBooking ? (
                      <Link
                        href={`/bookings/${encodeURIComponent(reviewBooking.bookingCode)}/review`}
                        className="sl-action-secondary text-violet"
                      >
                        รีวิวพื้นที่
                      </Link>
                    ) : null}
                  </div>

                  {group.status === 'CANCELLED' && booking.cancelReason && (
                    <p className="mt-5 text-sm text-muted">
                      เหตุผลที่ยกเลิก: {booking.cancelReason}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
      {selectedGroup ? (
        <BookingDetailDialog
          group={selectedGroup}
          onClose={() => setSelectedGroup(null)}
        />
      ) : null}
    </main>
  );
}

function BookingDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold text-muted">{label}</dt>
      <dd className="mt-1 font-bold text-ink">{value}</dd>
    </div>
  );
}

function BookingDetailDialog({
  group,
  onClose,
}: {
  group: BookingGroup;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const booking = group.primary;
  const boothCodes = group.bookings.map((item) => item.booth.code).join(' + ');
  const hasPayment = group.bookings.every(
    (item) =>
      item.isPaymentExempt ||
      Boolean(item.confirmedAt) ||
      item.status === 'CONFIRMED' ||
      item.status === 'COMPLETED' ||
      item.status === 'NO_SHOW',
  );
  const hasConfirmation = group.bookings.every(
    (item) =>
      item.status === 'CONFIRMED' ||
      item.status === 'COMPLETED' ||
      item.status === 'NO_SHOW',
  );
  const hasFinished = group.bookings.every(
    (item) => item.status === 'COMPLETED' || item.status === 'NO_SHOW',
  );
  const timeline = [
    { label: 'ส่งคำขอจอง', detail: `เลือก Booth ${boothCodes}`, done: true },
    {
      label: 'ชำระเงิน / ตรวจสอบ',
      detail: hasPayment ? 'ระบบได้รับและตรวจสอบการชำระแล้ว' : 'รอการชำระเงิน',
      done: hasPayment,
    },
    {
      label: 'ยืนยันการจอง',
      detail: hasConfirmation ? 'การจองได้รับการยืนยันแล้ว' : 'รอการยืนยัน',
      done: hasConfirmation,
    },
    {
      label: 'จบงาน',
      detail: hasFinished ? 'รายการนี้เสร็จสิ้นแล้ว' : 'รอวันสิ้นสุด Event',
      done: hasFinished,
    },
  ];

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href]',
        ),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previousFocusRef.current?.focus();
    };
  }, [onClose]);

  const paymentHref = booking.paymentGroupId
    ? `/bookings/payment-groups/${encodeURIComponent(booking.paymentGroupId)}/payment`
    : `/bookings/${encodeURIComponent(booking.bookingCode)}/payment`;

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-[#201b2e]/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-detail-title"
        className="my-6 w-full max-w-3xl rounded-[28px] bg-white p-5 shadow-2xl sm:p-7"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line pb-5">
          <div>
            <span className="sl-kicker">Booking detail</span>
            <h2 id="booking-detail-title" className="mt-2 text-2xl font-black">
              รายละเอียดการจอง
            </h2>
            <p className="mt-1 text-sm text-muted">
              {booking.event.name} · Booth {boothCodes}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="ปิดรายละเอียดการจอง"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line text-muted transition hover:bg-mist hover:text-ink"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <BookingDetail label="สถานะ" value={statusLabel[group.status]} />
          <BookingDetail label="ร้านค้า" value={booking.shop.name} />
          <BookingDetail
            label="จำนวนบูธ"
            value={`${group.bookings.length} บูธ`}
          />
          <BookingDetail
            label="ยอดรวม"
            value={`${formatMoney(group.totalAmount)} บาท`}
          />
        </section>

        <section className="mt-6 rounded-[22px] border border-line bg-[#faf8ff] p-4 sm:p-5">
          <h3 className="font-black">รายการบูธ</h3>
          <div className="mt-3 divide-y divide-line">
            {group.bookings.map((item) => (
              <div
                key={item.id}
                className="grid gap-1 py-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4"
              >
                <div>
                  <strong>Booth {item.booth.code}</strong>
                  <p className="mt-1 text-muted">
                    {item.booth.zone.name ?? item.booth.zone.code} ·{' '}
                    {item.bookingCode}
                  </p>
                </div>
                <strong>{formatMoney(item.boothPrice)} บาท</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6" aria-label="ลำดับสถานะการจอง">
          <h3 className="font-black">ติดตามสถานะ</h3>
          <ol className="mt-4 grid gap-3 sm:grid-cols-4">
            {timeline.map((step, index) => (
              <li
                key={step.label}
                className="relative rounded-2xl border border-line p-4"
              >
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full ${
                    step.done
                      ? 'bg-violet text-white'
                      : 'bg-[#f1eef5] text-muted'
                  }`}
                >
                  {step.done ? (
                    <Check className="h-4 w-4" aria-hidden />
                  ) : (
                    <Clock3 className="h-4 w-4" aria-hidden />
                  )}
                </span>
                <strong className="mt-3 block text-sm">
                  {index + 1}. {step.label}
                </strong>
                <p className="mt-1 text-xs leading-5 text-muted">
                  {step.detail}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <footer className="mt-6 flex flex-wrap justify-end gap-3 border-t border-line pt-5">
          <button
            type="button"
            onClick={onClose}
            className="sl-action-secondary"
          >
            ปิด
          </button>
          {group.status === 'PENDING_PAYMENT' ? (
            <Link href={paymentHref} className="sl-action-primary">
              ชำระเงิน
            </Link>
          ) : (
            <Link
              href={`/bookings/${encodeURIComponent(booking.bookingCode)}`}
              className="sl-action-primary"
            >
              เปิดหน้ารายละเอียดเต็ม
            </Link>
          )}
        </footer>
      </section>
    </div>
  );
}
