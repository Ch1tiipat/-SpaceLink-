'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { BookingCountdown } from '@/components/booking-countdown';
import {
  getPreviewBookings,
  isBookingReviewEligible,
} from '@/components/booking-detail-screen';
import {
  getMyBookings,
  type BookingStatus,
  type MyBooking,
} from '@/lib/api';
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

type BookingFilter = 'ALL' | BookingStatus;
type SortOrder = 'newest' | 'oldest' | 'price-desc' | 'price-asc';

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
  { value: 'PENDING_PAYMENT', label: 'รอชำระ' },
  { value: 'CONFIRMED', label: 'ยืนยันแล้ว' },
  { value: 'COMPLETED', label: 'เสร็จสิ้น' },
  { value: 'CANCELLED', label: 'ยกเลิก' },
  { value: 'NO_SHOW', label: 'ไม่มาเข้าร่วม' },
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
  return fraction && !/^0+$/.test(fraction) ? `${grouped}.${fraction}` : grouped;
}

function isExpired(booking: MyBooking): boolean {
  return (
    booking.status === 'PENDING_PAYMENT' &&
    (!booking.holdExpiresAt ||
      new Date(booking.holdExpiresAt).getTime() <= Date.now())
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

  async function refreshBookings(token: string, signal?: AbortSignal) {
    setIsLoading(true);
    setLoadError(null);
    try {
      const items = await getMyBookings(token, signal);
      setBookings(items);
      setExpiredIds(
        new Set(items.filter((booking) => isExpired(booking)).map(({ id }) => id)),
      );
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setLoadError(
        cause instanceof Error
          ? cause.message
          : 'ไม่สามารถโหลดรายการจองได้',
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
      pending: 'PENDING_PAYMENT',
      pending_payment: 'PENDING_PAYMENT',
      confirmed: 'CONFIRMED',
      completed: 'COMPLETED',
      cancelled: 'CANCELLED',
      no_show: 'NO_SHOW',
    };
    if (requestedTab && filtersByTab[requestedTab]) {
      setStatusFilter(filtersByTab[requestedTab]);
    }
  }, []);

  async function handleExpired(bookingId: string) {
    setExpiredIds((current) => new Set(current).add(bookingId));
    if (access.status !== 'ready') return;

    for (let attempt = 0; attempt < HOLD_STATUS_REFRESH_ATTEMPTS; attempt += 1) {
      try {
        const items = await getMyBookings(access.token);
        const refreshed = items.find((booking) => booking.id === bookingId);
        setBookings(items);
        setExpiredIds(
          new Set(
            items
              .filter((booking) => isExpired(booking))
              .map(({ id }) => id),
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

  const pendingCount = bookings.filter(
    (booking) => booking.status === 'PENDING_PAYMENT',
  ).length;
  const confirmedCount = bookings.filter(
    (booking) => booking.status === 'CONFIRMED',
  ).length;
  const completedCount = bookings.filter(
    (booking) => booking.status === 'COMPLETED',
  ).length;
  const statusCounts = useMemo(() => {
    const counts = new Map<BookingStatus, number>();
    bookings.forEach((booking) => {
      counts.set(booking.status, (counts.get(booking.status) ?? 0) + 1);
    });
    return counts;
  }, [bookings]);
  const visibleBookings = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('th');
    const filtered = bookings.filter((booking) => {
      const matchesStatus =
        statusFilter === 'ALL' || booking.status === statusFilter;
      const matchesKeyword =
        !keyword ||
        `${booking.event.name} ${booking.bookingCode} ${booking.booth.code} ${booking.shop.name}`
          .toLocaleLowerCase('th')
          .includes(keyword);
      return matchesStatus && matchesKeyword;
    });

    return filtered.sort((left, right) => {
      if (sortOrder === 'price-desc') {
        return Number(right.boothPrice) - Number(left.boothPrice);
      }
      if (sortOrder === 'price-asc') {
        return Number(left.boothPrice) - Number(right.boothPrice);
      }

      const difference =
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      return sortOrder === 'oldest' ? -difference : difference;
    });
  }, [bookings, query, sortOrder, statusFilter]);

  return (
    <main className="sl-page pb-16">
      <div className="shell py-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="sl-kicker">
              My bookings
            </span>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
              การจองของฉัน
            </h1>
            <p className="mt-2 text-muted">
              ตรวจสอบสถานะ ชำระเงิน หรือยกเลิกการจองที่ยังดำเนินการอยู่
            </p>
          </div>
          <Link href="/" className="sl-action-secondary mt-4 text-violet sm:mt-0">
            ค้นหา Event เพิ่ม
          </Link>
        </div>

        {access.status === 'ready' && !isLoading && !loadError ? (
          <section className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="สรุปการจอง">
            {[
              ['การจองทั้งหมด', bookings.length, 'bg-[#f4efff] text-violet'],
              ['รอชำระเงิน', pendingCount, 'bg-[#edf6ff] text-[#1d67a8]'],
              ['ยืนยันแล้ว', confirmedCount, 'bg-[#ebfaf3] text-[#13795b]'],
              ['เสร็จสิ้น', completedCount, 'bg-[#eef7fb] text-[#276b87]'],
            ].map(([label, value, tone]) => (
              <div key={label} className="sl-soft-surface p-4 sm:p-5">
                <span className="text-xs font-bold text-muted">{label}</span>
                <strong className={`mt-3 grid h-11 w-11 place-items-center rounded-2xl px-3 text-lg ${tone}`}>
                  {value}
                </strong>
                <p className="mt-2 text-sm font-extrabold tracking-[.1em] text-muted">
                  {label === 'การจองทั้งหมด' ? 'ALL BOOKINGS' : label === 'รอชำระเงิน' ? 'PENDING' : label === 'ยืนยันแล้ว' ? 'CONFIRMED' : 'COMPLETED'}
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
                  onChange={(event) => setSortOrder(event.target.value as SortOrder)}
                  className="min-h-12 w-full rounded-2xl border border-line bg-white px-4 text-base font-bold text-ink outline-none focus:border-violet focus:ring-2 focus:ring-violet/15"
                >
                  <option value="newest">ล่าสุดก่อน</option>
                  <option value="oldest">เก่าก่อน</option>
                  <option value="price-desc">ราคาสูง → ต่ำ</option>
                  <option value="price-asc">ราคาต่ำ → สูง</option>
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
                    ? bookings.length
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
                    <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-sm ${active ? 'bg-violet text-white' : 'bg-[#f1eef5]'}`}>
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
            <p className="mt-2 text-muted">รายการจองจะแสดงเฉพาะของบัญชีผู้ขายปัจจุบัน</p>
            <Link href="/login" className="sl-action-primary mt-6">
              เข้าสู่ระบบ
            </Link>
          </section>
        )}

        {access.status === 'error' && (
          <p role="alert" className="mt-8 rounded-2xl bg-[#fff0ee] px-5 py-4 text-[#b42318]">
            {access.message}
          </p>
        )}

        {access.status !== 'signed-out' && access.status !== 'error' && isLoading && (
          <div className="mt-8 grid gap-5">
            <div className="skeleton h-64 rounded-[28px]" />
            <div className="skeleton h-64 rounded-[28px]" />
          </div>
        )}

        {loadError && !isLoading && (
          <div className="mt-8 rounded-2xl bg-[#fff0ee] px-5 py-4 text-[#b42318]" role="alert">
            <p>{loadError}</p>
            {access.status === 'ready' && (
              <button type="button" onClick={() => void refreshBookings(access.token)} className="mt-3 font-bold underline">
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
              <p className="mt-2 text-muted">เลือก Event และบูธที่เหมาะกับร้านของคุณเพื่อเริ่มต้น</p>
            </section>
          )}

        {access.status === 'ready' && !isLoading && !loadError && (
          <div className="mt-8 grid gap-6">
            {bookings.length > 0 && visibleBookings.length === 0 && (
              <section className="sl-surface p-10 text-center">
                <h2 className="text-xl font-bold">ไม่พบรายการที่ตรงกับตัวกรอง</h2>
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
            {visibleBookings.map((booking) => {
              const holdExpired = expiredIds.has(booking.id) || isExpired(booking);
              return (
                <article key={booking.id} className="sl-surface p-5 sm:p-7">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusTone[booking.status]}`}>
                        {statusLabel[booking.status]}
                      </span>
                      <h2 className="mt-3 text-xl font-bold">{booking.event.name}</h2>
                      <p className="mt-1 text-sm text-muted">
                        รหัสการจอง {booking.bookingCode}
                      </p>
                    </div>
                    {booking.status === 'PENDING_PAYMENT' && (
                      <BookingCountdown
                        expiresAt={booking.holdExpiresAt}
                        active
                        onExpired={() => void handleExpired(booking.id)}
                      />
                    )}
                  </div>

                  <dl className="mt-5 grid gap-3 rounded-[20px] border border-[#ebe5f4] bg-[#faf8ff] p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <BookingDetail label="บูธ" value={booking.booth.code} />
                    <BookingDetail
                      label="โซน"
                      value={booking.booth.zone.name ?? booking.booth.zone.code}
                    />
                    <BookingDetail label="ร้านค้า" value={booking.shop.name} />
                    <BookingDetail
                      label="ราคา"
                      value={`${formatMoney(booking.boothPrice)} บาท`}
                    />
                    <BookingDetail
                      label="วันเริ่มงาน"
                      value={dateFormatter.format(new Date(booking.bookingStartDate))}
                    />
                    <BookingDetail
                      label="วันสิ้นสุด"
                      value={dateFormatter.format(new Date(booking.bookingEndDate))}
                    />
                  </dl>

                  {holdExpired ? (
                    <p className="mt-5 rounded-2xl bg-[#fff0ee] px-4 py-3 text-sm font-bold text-[#b42318]">
                      Hold หมดเวลาแล้ว ระบบกำลังอัปเดตสถานะการจอง
                    </p>
                  ) : null}

                  <div className="mt-5 flex flex-wrap gap-3 border-t border-line pt-5">
                    <Link href={`/bookings/${booking.id}`} className="sl-action-secondary text-violet">
                      ดูรายละเอียด
                    </Link>
                    <Link href={`/events/${booking.event.id}`} className="sl-action-secondary text-violet">
                      ดู Event
                    </Link>
                    {booking.status === 'PENDING_PAYMENT' && !holdExpired ? (
                      <Link href={`/bookings/${booking.id}/payment`} className="sl-action-primary">
                        ชำระเงิน
                      </Link>
                    ) : null}
                    <Link href={`/events/${booking.event.id}/map?zone=${encodeURIComponent(booking.booth.zone.code)}`} className="sl-action-secondary text-violet">
                      ดู Zone Map
                    </Link>
                    {isBookingReviewEligible(booking) ? (
                      <Link href={`/bookings/${booking.id}/review`} className="sl-action-secondary text-violet">
                        รีวิวพื้นที่
                      </Link>
                    ) : null}
                  </div>

                  {booking.status === 'CANCELLED' && booking.cancelReason && (
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
