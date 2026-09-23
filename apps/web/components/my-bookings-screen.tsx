'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  CreditCard,
  FileText,
  Info,
  MapPin,
  Plus,
  ReceiptText,
  Store,
  X,
} from 'lucide-react';
import { BookingCountdown } from '@/components/booking-countdown';
import {
  getPreviewBookings,
  isBookingCancellationOpen,
  isBookingReviewEligible,
} from '@/components/booking-detail-screen';
import { getMyBookings, type BookingStatus, type MyBooking } from '@/lib/api';
import { getEventCoverUrl } from '@/lib/event-cover';
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
type GroupStatus = BookingStatus | 'MIXED';

type BookingGroup = {
  key: string;
  bookings: MyBooking[];
  primary: MyBooking;
  status: GroupStatus;
  totalAmount: string;
};

const statusLabel: Record<BookingStatus, string> = {
  PENDING_PAYMENT: 'รอชำระเงิน',
  CONFIRMED: 'ยืนยันแล้ว',
  CANCELLED: 'ยกเลิกแล้ว',
  NO_SHOW: 'ไม่มาเข้าร่วม',
  COMPLETED: 'เสร็จสิ้น',
};

const groupStatusLabel: Record<GroupStatus, string> = {
  ...statusLabel,
  MIXED: 'หลายสถานะ',
};

const statusTone: Record<GroupStatus, string> = {
  PENDING_PAYMENT: 'border-[#f3ddae] bg-[#fff3d8] text-[#a96800]',
  CONFIRMED: 'border-[#b9dfd3] bg-[#ebfaf3] text-[#13795b]',
  CANCELLED: 'border-[#fac5bf] bg-[#fff0ee] text-[#b42318]',
  NO_SHOW: 'border-[#ead8b7] bg-[#fff8e8] text-[#895b08]',
  COMPLETED: 'border-[#b9dfd3] bg-[#ebfaf3] text-[#13795b]',
  MIXED: 'border-[#d9ccff] bg-[#f4f0ff] text-[#5b2bc9]',
};

const bookingFilters: readonly { value: BookingFilter; label: string }[] = [
  { value: 'ALL', label: 'ทั้งหมด' },
  { value: 'PAYMENT', label: 'รอชำระ' },
  { value: 'CONFIRMATION', label: 'ยืนยันแล้ว' },
  { value: 'COMPLETED', label: 'สำเร็จ' },
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

function formatBookingDateRange(startDate: string, endDate: string): string {
  return `${dateFormatter.format(new Date(startDate))} – ${dateFormatter.format(new Date(endDate))}`;
}

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

function resolveGroupStatus(items: MyBooking[]): GroupStatus {
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
  return items.length === 0 ? 'CANCELLED' : 'MIXED';
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
  const visibleBookings = useMemo(() => {
    const filtered = bookingGroups.filter((group) =>
      matchesFilter(group, statusFilter),
    );

    return filtered.sort((left, right) => {
      const difference =
        new Date(right.primary.createdAt).getTime() -
        new Date(left.primary.createdAt).getTime();
      return sortOrder === 'oldest' ? -difference : difference;
    });
  }, [bookingGroups, sortOrder, statusFilter]);

  return (
    <main className="sl-page pb-16">
      <div className="shell py-7 sm:py-9">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-[-0.045em] sm:text-4xl">
              การจองของฉัน
            </h1>
            <p className="mt-1.5 text-sm text-muted sm:text-base">
              ติดตามสถานะการจอง ชำระเงิน และดูรายละเอียดได้ในที่เดียว
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/refunds"
              className="sl-action-secondary inline-flex min-h-12 items-center gap-2 px-5 text-violet"
            >
              <ReceiptText className="h-4 w-4" aria-hidden />
              ติดตามคำขอคืนเงิน
            </Link>
            <Link
              href="/"
              className="sl-action-primary inline-flex min-h-12 items-center gap-2 px-5"
            >
              <Plus className="h-4 w-4" aria-hidden />
              จองบูธเพิ่ม
            </Link>
          </div>
        </div>

        {access.status === 'ready' && !isLoading && !loadError ? (
          <section
            className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
            aria-label="สรุปการจอง"
          >
            {[
              [
                'การจองทั้งหมด',
                bookingGroups.length,
                'bg-[#f1eaff] text-violet',
                FileText,
              ],
              [
                'รอชำระ',
                pendingCount,
                'bg-[#fff2d8] text-[#c67a00]',
                Clock3,
              ],
              [
                'ยืนยันแล้ว',
                confirmedCount,
                'bg-[#eaf3ff] text-[#2b72d6]',
                Clock3,
              ],
              [
                'สำเร็จ',
                completedCount,
                'bg-[#e8f8ef] text-[#19975a]',
                Check,
              ],
            ].map(([label, value, tone, Icon]) => {
              const SummaryIcon = Icon as typeof FileText;
              return (
                <article
                  key={label as string}
                  className="flex min-h-24 items-center gap-3 rounded-[20px] border border-line bg-white p-4 shadow-[0_12px_32px_rgba(75,47,112,.05)] sm:gap-4 sm:p-5"
                >
                  <span
                    className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl sm:h-14 sm:w-14 ${tone}`}
                  >
                    <SummaryIcon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
                  </span>
                  <div>
                    <span className="block text-xs font-medium text-muted sm:text-sm">
                      {label as string}
                    </span>
                    <strong className="mt-1 block text-2xl font-black leading-none sm:text-3xl">
                      {value as number}
                    </strong>
                  </div>
                </article>
              );
            })}
          </section>
        ) : null}

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
          <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section className="min-w-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <nav
                  className="flex gap-2 overflow-x-auto pb-1"
                  aria-label="กรองสถานะการจอง"
                >
                  {bookingFilters.map((filter) => {
                    const active = statusFilter === filter.value;
                    return (
                      <button
                        key={filter.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setStatusFilter(filter.value)}
                        className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-extrabold transition ${
                          active
                            ? 'border-violet bg-violet text-white shadow-[0_8px_18px_rgba(91,44,207,.2)]'
                            : 'border-line bg-white text-muted hover:border-violet/40 hover:text-violet'
                        }`}
                      >
                        {filter.label}
                      </button>
                    );
                  })}
                </nav>
                <label className="flex shrink-0 items-center justify-end gap-2 text-xs font-medium text-muted">
                  เรียงลำดับ
                  <select
                    value={sortOrder}
                    onChange={(event) =>
                      setSortOrder(event.target.value as SortOrder)
                    }
                    className="min-h-10 rounded-xl border border-line bg-white px-3 pr-8 text-sm font-bold text-ink outline-none focus:border-violet focus:ring-2 focus:ring-violet/15"
                  >
                    <option value="newest">ล่าสุด</option>
                    <option value="oldest">เก่าสุด</option>
                  </select>
                </label>
              </div>

              <div className="mt-3 grid gap-3">
                {bookings.length > 0 && visibleBookings.length === 0 ? (
                  <section className="sl-surface p-10 text-center">
                    <h2 className="text-xl font-bold">
                      ไม่พบการจองในสถานะนี้
                    </h2>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('ALL')}
                      className="sl-action-secondary mt-5 text-violet"
                    >
                      ดูการจองทั้งหมด
                    </button>
                  </section>
                ) : null}

                {visibleBookings.map((group) => {
                  const booking = group.primary;
                  const hasMixedStatuses = group.status === 'MIXED';
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
                      ? group.bookings.find((item) =>
                          isBookingReviewEligible(item),
                        )
                      : undefined;
                  const paymentHref = booking.paymentGroupId
                    ? `/bookings/payment-groups/${encodeURIComponent(booking.paymentGroupId)}/payment`
                    : `/bookings/${encodeURIComponent(booking.bookingCode)}/payment`;

                  return (
                    <article
                      key={group.key}
                      className="overflow-hidden rounded-[20px] border border-line bg-white p-3 shadow-[0_10px_30px_rgba(67,43,91,.05)] sm:p-4"
                    >
                      <div className="grid gap-4 md:grid-cols-[104px_minmax(0,1fr)_170px_178px] md:items-center">
                        <div className="relative h-28 overflow-hidden rounded-2xl md:h-[104px]">
                          <Image
                            src={getEventCoverUrl(booking.event.bannerUrl)}
                            alt={booking.event.name}
                            fill
                            sizes="(max-width: 767px) 100vw, 104px"
                            className="object-cover"
                          />
                        </div>

                        <div className="min-w-0">
                          <h2 className="truncate text-lg font-black">
                            {booking.event.name}
                          </h2>
                          <p className="mt-2 flex items-center gap-2 text-xs text-muted">
                            <CalendarDays className="h-4 w-4 text-violet" aria-hidden />
                            {formatBookingDateRange(
                              booking.bookingStartDate,
                              booking.bookingEndDate,
                            )}
                          </p>
                          <p className="mt-1 flex items-center gap-2 text-xs text-muted">
                            <MapPin className="h-4 w-4 text-violet" aria-hidden />
                            {zoneNames}
                          </p>
                          <p className="mt-2 text-xs text-[#9a92a8]">
                            {group.bookings.length === 1
                              ? booking.bookingCode
                              : `${group.bookings.length} รายการ · ${booking.bookingCode}`}
                          </p>
                          {group.bookings.some(isNearCancelDeadline) ? (
                            <span className="mt-2 inline-flex rounded-full bg-[#fff8e8] px-2.5 py-1 text-[11px] font-bold text-[#895b08]">
                              ใกล้หมดเขตยกเลิก
                            </span>
                          ) : null}
                        </div>

                        <dl className="grid gap-3 border-y border-line py-4 text-xs md:border-x md:border-y-0 md:px-4 md:py-1">
                          <div className="flex items-center gap-2 text-muted">
                            <Store className="h-4 w-4 text-violet" aria-hidden />
                            <dt>Booth</dt>
                            <dd className="font-black text-ink">{boothCodes}</dd>
                          </div>
                          <div className="flex items-center gap-2 text-muted">
                            <CreditCard className="h-4 w-4 text-violet" aria-hidden />
                            <dt>ยอดรวม</dt>
                            <dd className="font-black text-ink">
                              {formatMoney(group.totalAmount)} บาท
                            </dd>
                          </div>
                          <p className="text-[#9a92a8]">
                            {group.bookings.length} บูธ · {zoneNames}
                          </p>
                        </dl>

                        <div className="grid gap-2">
                          <span
                            className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-full border px-3 text-xs font-extrabold ${statusTone[group.status]}`}
                          >
                            {group.status === 'PENDING_PAYMENT' ? (
                              <Clock3 className="h-3.5 w-3.5" aria-hidden />
                            ) : hasMixedStatuses ? (
                              <Info className="h-3.5 w-3.5" aria-hidden />
                            ) : (
                              <Check className="h-3.5 w-3.5" aria-hidden />
                            )}
                            {groupStatusLabel[group.status]}
                          </span>
                          {group.status === 'PENDING_PAYMENT' && !holdExpired ? (
                            <Link
                              href={paymentHref}
                              className="sl-action-primary min-h-10 w-full justify-center py-2 text-sm"
                            >
                              ชำระเงิน
                            </Link>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => setSelectedGroup(group)}
                            className="sl-action-secondary inline-flex min-h-10 w-full items-center justify-center gap-2 py-2 text-sm text-violet"
                          >
                            ดูรายละเอียด
                            <ChevronRight className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                      </div>

                      {group.status === 'PENDING_PAYMENT' ? (
                        <div className="mt-3">
                          <BookingCountdown
                            expiresAt={booking.holdExpiresAt}
                            active
                            onExpired={() => void handleExpired(booking.id)}
                          />
                        </div>
                      ) : null}

                      {holdExpired ? (
                        <p className="mt-3 rounded-xl bg-[#fff0ee] px-4 py-3 text-xs font-bold text-[#b42318]">
                          Hold หมดเวลาแล้ว ระบบกำลังอัปเดตสถานะการจอง
                        </p>
                      ) : null}

                      {!hasMixedStatuses ? (
                        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-3 text-xs font-bold">
                          <Link
                            href={`/events/${encodeURIComponent(booking.event.slug ?? '')}`}
                            className="text-violet hover:underline"
                          >
                            ดู Event
                          </Link>
                          <Link
                            href={`/events/${encodeURIComponent(booking.event.slug ?? '')}/map?zone=${encodeURIComponent(booking.booth.zone.code)}`}
                            className="text-violet hover:underline"
                          >
                            ดู Zone Map
                          </Link>
                          {reviewBooking ? (
                            <Link
                              href={`/bookings/${encodeURIComponent(reviewBooking.bookingCode)}/review`}
                              className="text-violet hover:underline"
                            >
                              เขียนรีวิวพื้นที่
                            </Link>
                          ) : null}
                          {group.status === 'CANCELLED' && booking.cancelReason ? (
                            <span className="font-normal text-muted">
                              เหตุผลที่ยกเลิก: {booking.cancelReason}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>

            <BookingStatusGuide />
          </div>
        )}
      </div>
      {selectedGroup ? (
        <BookingDetailDialog
          group={selectedGroup}
          holdExpired={selectedGroup.bookings.some(
            (item) => expiredIds.has(item.id) || isExpired(item),
          )}
          onClose={() => setSelectedGroup(null)}
        />
      ) : null}
    </main>
  );
}

function BookingStatusGuide() {
  const steps = [
    {
      title: 'ส่งคำขอจอง',
      detail: 'เลือกงานและจองพื้นที่ กรอกข้อมูลให้ครบถ้วน',
    },
    {
      title: 'ชำระเงิน / ตรวจสอบ',
      detail: 'แนบสลิปตามยอดที่กำหนด รอผู้จัดตรวจสอบ',
    },
    {
      title: 'ยืนยันการจอง',
      detail: 'เมื่อผู้จัดงานยืนยัน คุณจะได้รับแจ้งเตือน',
    },
  ];

  return (
    <aside className="sticky top-28 rounded-[22px] border border-line bg-white p-5 shadow-[0_12px_32px_rgba(75,47,112,.05)] xl:p-6">
      <h2 className="flex items-center gap-2 text-xl font-black">
        <Info className="h-5 w-5 text-violet" aria-hidden />
        สถานะการจอง
      </h2>
      <p className="mt-2 text-sm text-muted">
        ขั้นตอนการจองพื้นที่กับ SpaceLink
      </p>
      <ol className="mt-5">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="flex gap-3 border-b border-line py-5 first:pt-0"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#eee5ff] text-sm font-black text-violet">
              {index + 1}
            </span>
            <div>
              <strong className="block text-sm">{step.title}</strong>
              <span className="mt-1 block text-xs leading-5 text-muted">
                {step.detail}
              </span>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-5 flex gap-3 rounded-2xl bg-[#f8f3ff] p-4 text-xs leading-5 text-muted">
        <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-violet" aria-hidden />
        <p>
          หากมีข้อสงสัยเกี่ยวกับการจอง ติดต่อทีมงานผ่านหน้าติดต่อสอบถามได้เลย
        </p>
      </div>
    </aside>
  );
}

function BookingFact({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-[#fcfbfe] px-3 py-3 sm:px-4">
      <dt className="text-xs font-bold text-muted">{label}</dt>
      <dd
        className={`mt-1 text-sm font-black ${accent ? 'text-violet' : 'text-ink'}`}
      >
        {value}
      </dd>
    </div>
  );
}

function BookingKeyValue({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="mt-3 flex items-start justify-between gap-4 border-t border-line pt-3 text-xs first:border-t-0">
      <span className="text-muted">{label}</span>
      <strong className={`text-right ${accent ? 'text-violet' : 'text-ink'}`}>
        {value}
      </strong>
    </div>
  );
}

function BookingDetailDialog({
  group,
  holdExpired,
  onClose,
}: {
  group: BookingGroup;
  holdExpired: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const booking = group.primary;
  const hasMixedStatuses = group.status === 'MIXED';
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
    { label: 'สร้าง Booking', detail: `Booth ${boothCodes}`, done: true },
    {
      label: 'ชำระเงินและแนบสลิป',
      detail: hasPayment ? 'ระบบได้รับหลักฐานการชำระแล้ว' : 'รอการชำระเงิน',
      done: hasPayment,
    },
    {
      label: 'ยืนยัน Booking',
      detail: hasConfirmation ? 'การจองได้รับการยืนยันแล้ว' : 'รอการยืนยัน',
      done: hasConfirmation,
    },
  ];
  const [actionMessage, setActionMessage] = useState('');

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

  async function handleCopy() {
    const summary = [
      booking.event.name,
      booking.bookingCode,
      `Booth ${boothCodes}`,
      booking.booth.zone.name ?? booking.booth.zone.code,
      `${formatMoney(group.totalAmount)} บาท`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(summary);
      setActionMessage('คัดลอกข้อมูลการจองแล้ว');
    } catch {
      setActionMessage('เบราว์เซอร์ไม่อนุญาตให้คัดลอกอัตโนมัติ');
    }
  }

  function handleDownloadSummary() {
    const content = [
      'SpaceLink · สรุปการจอง',
      `Booking: ${booking.bookingCode}`,
      `Event: ${booking.event.name}`,
      `Booth: ${boothCodes}`,
      `Zone: ${booking.booth.zone.name ?? booking.booth.zone.code}`,
      `ยอดรวม: ${formatMoney(group.totalAmount)} บาท`,
      `สถานะรวม: ${groupStatusLabel[group.status]}`,
      ...(hasMixedStatuses
        ? [
            'สถานะแยกรายบูธ:',
            ...group.bookings.map(
              (item) =>
                `- ${item.bookingCode} · Booth ${item.booth.code} · ${statusLabel[item.status]}`,
            ),
          ]
        : []),
    ].join('\n');
    const url = URL.createObjectURL(
      new Blob([content], { type: 'text/plain;charset=utf-8' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `SpaceLink_Booking_Summary_${booking.bookingCode}.txt`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setActionMessage('ดาวน์โหลดสรุปการจองแล้ว');
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-[#201b2e]/65 px-3 pb-3 pt-20 backdrop-blur-[2px] sm:px-5 sm:pb-5 sm:pt-24"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-detail-title"
        className="flex max-h-[calc(100vh-5.75rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl sm:max-h-[calc(100vh-7.25rem)]"
      >
        <header className="flex items-start justify-between gap-4 px-5 pb-4 pt-5 sm:px-7 sm:pt-6">
          <div>
            <h2 id="booking-detail-title" className="text-2xl font-black">
              รายละเอียดการจอง
            </h2>
            <p className="mt-1 text-sm text-muted">
              ตรวจสอบข้อมูลการจองและสถานะการชำระเงิน
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

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-7 sm:pb-6">
          <div className="relative h-28 overflow-hidden rounded-2xl sm:h-36">
            <Image
              src={getEventCoverUrl(booking.event.bannerUrl)}
              alt={`บรรยากาศ ${booking.event.name}`}
              fill
              sizes="(max-width: 896px) 100vw, 840px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#24123f]/75 via-[#4b2488]/40 to-transparent" />
            <strong className="absolute bottom-4 left-4 text-lg text-white sm:left-5 sm:text-xl">
              {booking.event.name}
            </strong>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-xl font-black sm:text-2xl">
                {booking.event.name}
              </h3>
              <p className="mt-1 text-sm text-muted">
                พื้นที่สำหรับผู้ขายในงาน ·{' '}
                {booking.booth.zone.name ?? booking.booth.zone.code}
              </p>
            </div>
            <span
              className={`inline-flex min-h-9 w-fit items-center rounded-full border px-4 text-xs font-extrabold ${statusTone[group.status]}`}
            >
              {groupStatusLabel[group.status]}
            </span>
          </div>

          <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <BookingFact
              label="รหัสการจอง"
              value={
                group.bookings.length === 1
                  ? booking.bookingCode
                  : `${group.bookings.length} รายการ`
              }
            />
            <BookingFact label="Booth" value={boothCodes} />
            <BookingFact
              label="Zone"
              value={booking.booth.zone.name ?? booking.booth.zone.code}
            />
            <BookingFact
              label="วันที่จัดงาน"
              value={formatBookingDateRange(
                booking.bookingStartDate,
                booking.bookingEndDate,
              )}
            />
            <BookingFact label="ร้านค้า" value={booking.shop.name} />
            <BookingFact
              label="ยอดชำระ"
              value={`${formatMoney(group.totalAmount)} บาท`}
              accent
            />
          </section>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <section className="rounded-2xl border border-line p-4 sm:p-5">
              <h3 className="flex items-center gap-2 font-black">
                <FileText className="h-4 w-4 text-violet" aria-hidden />
                ข้อมูลงาน
              </h3>
              <BookingKeyValue label="งาน" value={booking.event.name} />
              <BookingKeyValue
                label="โซน"
                value={booking.booth.zone.name ?? booking.booth.zone.code}
              />
              <BookingKeyValue label="Booth" value={boothCodes} />
              <BookingKeyValue
                label="จำนวน"
                value={`${group.bookings.length} บูธ`}
              />
            </section>
            <section className="rounded-2xl border border-line p-4 sm:p-5">
              <h3 className="flex items-center gap-2 font-black">
                <CreditCard className="h-4 w-4 text-violet" aria-hidden />
                การชำระเงิน
              </h3>
              <BookingKeyValue
                label="ยอดรวม"
                value={`${formatMoney(group.totalAmount)} บาท`}
                accent
              />
              <BookingKeyValue label="ช่องทาง" value="PromptPay QR" />
              <BookingKeyValue
                label="สถานะ"
                value={hasPayment ? 'ชำระเงินแล้ว' : 'รอชำระเงิน'}
              />
              <BookingKeyValue
                label="หลักฐาน"
                value={hasPayment ? 'ระบบบันทึกแล้ว' : 'ยังไม่ได้แนบ'}
              />
            </section>
          </div>

          {hasMixedStatuses ? (
            <section className="mt-5 rounded-2xl border border-[#d9ccff] bg-[#fbf9ff] p-4 sm:p-5">
              <h3 className="flex items-center gap-2 font-black">
                <Info className="h-4 w-4 text-violet" aria-hidden />
                สถานะแยกรายบูธ
              </h3>
              <p className="mt-1 text-xs leading-5 text-muted">
                ชุดจองนี้มีหลายสถานะ โปรดตรวจสอบแต่ละบูธก่อนดำเนินการ
              </p>
              <ul className="mt-3 grid gap-2">
                {group.bookings.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white px-3 py-3 text-xs"
                  >
                    <div>
                      <strong className="block text-sm text-ink">
                        Booth {item.booth.code}
                      </strong>
                      <span className="mt-1 block text-muted">
                        {item.bookingCode}
                      </span>
                    </div>
                    <span
                      className={`inline-flex min-h-8 items-center rounded-full border px-3 font-extrabold ${statusTone[item.status]}`}
                    >
                      {statusLabel[item.status]}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {!hasMixedStatuses ? (
            <section className="mt-5" aria-label="ลำดับสถานะการจอง">
              <h3 className="font-black">ขั้นตอนการจอง</h3>
              <ol className="relative mt-4 grid gap-3 sm:grid-cols-3 before:absolute before:left-[16%] before:right-[16%] before:top-4 before:hidden before:h-px before:bg-line sm:before:block">
                {timeline.map((step, index) => (
                  <li
                    key={step.label}
                    className="relative z-10 flex items-center gap-3 rounded-2xl bg-white sm:flex-col sm:text-center"
                  >
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border-4 border-white shadow-sm ${
                        step.done
                          ? 'bg-violet text-white'
                          : 'bg-[#eee8f5] text-muted'
                      }`}
                    >
                      {step.done ? (
                        <CheckCircle2 className="h-4 w-4" aria-hidden />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <div>
                      <strong className="block text-sm">{step.label}</strong>
                      <p className="mt-1 text-xs leading-5 text-muted">
                        {step.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <div className="mt-5 rounded-2xl bg-[#f8f3ff] px-4 py-3 text-sm leading-6 text-muted">
            {hasMixedStatuses
              ? 'ชุดจองนี้มีหลายสถานะ โปรดตรวจสอบสถานะแยกรายบูธก่อนดำเนินการ'
              : group.status === 'PENDING_PAYMENT'
              ? 'กรุณาชำระเงินตามยอดที่กำหนด และแนบสลิปเพื่อให้ผู้จัดงานตรวจสอบ'
              : hasFinished
                ? 'รายการนี้เสร็จสิ้นแล้ว คุณสามารถเปิดหน้ารายละเอียดเพื่อรีวิวหรือดำเนินการอื่นได้'
                : 'การจองได้รับการยืนยันแล้ว คุณสามารถเก็บสรุปการจองไว้ใช้ตรวจสอบ'}
          </div>

          {actionMessage ? (
            <p role="status" className="mt-3 text-right text-xs font-bold text-violet">
              {actionMessage}
            </p>
          ) : null}

          <footer className="mt-5 flex flex-wrap justify-end gap-3 border-t border-line pt-5">
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="sl-action-secondary text-violet"
            >
              คัดลอกข้อมูล
            </button>
            <button
              type="button"
              onClick={onClose}
              className="sl-action-secondary"
            >
              ปิด
            </button>
            {group.status === 'PENDING_PAYMENT' && !holdExpired ? (
              <Link href={paymentHref} className="sl-action-primary">
                ไปหน้าชำระเงิน
              </Link>
            ) : group.status === 'PENDING_PAYMENT' ? (
              <button
                type="button"
                disabled
                className="sl-action-primary cursor-not-allowed opacity-55"
              >
                หมดเวลาชำระเงิน
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDownloadSummary}
                className="sl-action-primary"
              >
                ดาวน์โหลดสรุปการจอง
              </button>
            )}
            {!hasMixedStatuses ? (
              <Link
                href={`/bookings/${encodeURIComponent(booking.bookingCode)}`}
                className="sl-action-secondary text-violet"
              >
                เปิดหน้ารายละเอียดเต็ม
              </Link>
            ) : null}
          </footer>
        </div>
      </section>
    </div>
  );
}
