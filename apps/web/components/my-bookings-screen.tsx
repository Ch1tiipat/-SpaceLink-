'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BookingCountdown } from '@/components/booking-countdown';
import { SlipUploadPanel } from '@/components/slip-upload-panel';
import {
  cancelBooking,
  getMyBookings,
  type BookingStatus,
  type MyBooking,
} from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabase';

type AccessState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'ready'; token: string }
  | { status: 'error'; message: string };

const statusLabel: Record<BookingStatus, string> = {
  PENDING_PAYMENT: 'รอชำระเงิน',
  CONFIRMED: 'ยืนยันแล้ว',
  CANCELLED: 'ยกเลิกแล้ว',
  NO_SHOW: 'ไม่มาเข้าร่วม',
  COMPLETED: 'เสร็จสิ้น',
};

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
  const [cancelReasons, setCancelReasons] = useState<Record<string, string>>({});
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [cancellingId, setCancellingId] = useState<string | null>(null);

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

  async function handleCancel(booking: MyBooking) {
    if (access.status !== 'ready') return;
    const reason = cancelReasons[booking.id]?.trim() ?? '';
    if (!reason) {
      setActionErrors((current) => ({
        ...current,
        [booking.id]: 'กรุณาระบุเหตุผลที่ต้องการยกเลิก',
      }));
      return;
    }

    setCancellingId(booking.id);
    setActionErrors((current) => ({ ...current, [booking.id]: '' }));
    try {
      await cancelBooking(booking.id, reason, access.token);
      setCancelReasons((current) => ({ ...current, [booking.id]: '' }));
      await refreshBookings(access.token);
    } catch (cause) {
      setActionErrors((current) => ({
        ...current,
        [booking.id]:
          cause instanceof Error ? cause.message : 'ยกเลิกการจองไม่สำเร็จ',
      }));
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <main className="pb-16">
      <div className="shell py-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-[.14em] text-violet">
              My bookings
            </span>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
              การจองของฉัน
            </h1>
            <p className="mt-2 text-muted">
              ตรวจสอบสถานะ ชำระเงิน หรือยกเลิกการจองที่ยังดำเนินการอยู่
            </p>
          </div>
          <Link href="/" className="mt-4 inline-flex rounded-xl border border-violet px-5 py-3 font-bold text-violet sm:mt-0">
            ค้นหา Event เพิ่ม
          </Link>
        </div>

        {access.status === 'signed-out' && (
          <section className="mt-8 rounded-[28px] border border-line bg-white p-8 text-center shadow-soft">
            <h2 className="text-xl font-bold">กรุณาเข้าสู่ระบบก่อน</h2>
            <p className="mt-2 text-muted">รายการจองจะแสดงเฉพาะของบัญชีผู้ขายปัจจุบัน</p>
            <Link href="/login" className="mt-6 inline-flex rounded-xl bg-violet px-5 py-3 font-bold text-white">
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
            <section className="mt-8 rounded-[28px] border border-line bg-white p-10 text-center shadow-soft">
              <h2 className="text-xl font-bold">ยังไม่มีรายการจอง</h2>
              <p className="mt-2 text-muted">เลือก Event และบูธที่เหมาะกับร้านของคุณเพื่อเริ่มต้น</p>
            </section>
          )}

        {access.status === 'ready' && !isLoading && !loadError && (
          <div className="mt-8 grid gap-6">
            {bookings.map((booking) => {
              const holdExpired = expiredIds.has(booking.id) || isExpired(booking);
              const cancellable =
                (booking.status === 'PENDING_PAYMENT' ||
                  booking.status === 'CONFIRMED') &&
                new Date(booking.bookingStartDate).getTime() > Date.now();

              return (
                <article key={booking.id} className="rounded-[28px] border border-line bg-white p-5 shadow-soft sm:p-7">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <span className="inline-flex rounded-full bg-[#eee8ff] px-3 py-1 text-xs font-bold text-violet">
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

                  <dl className="mt-5 grid gap-3 rounded-2xl bg-mist p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
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

                  {booking.status === 'PENDING_PAYMENT' && (
                    <div className="mt-5">
                      {holdExpired && (
                        <p className="mb-4 rounded-2xl bg-[#fff0ee] px-4 py-3 text-sm font-bold text-[#b42318]">
                          Hold หมดเวลาแล้ว ไม่สามารถอัปโหลดสลิปได้ ระบบกำลังอัปเดตสถานะการจอง
                        </p>
                      )}
                      <SlipUploadPanel
                        bookingId={booking.id}
                        token={access.token}
                        disabled={holdExpired}
                        onConfirmed={() => void refreshBookings(access.token)}
                      />
                    </div>
                  )}

                  {cancellable && (
                    <div className="mt-5 border-t border-line pt-5">
                      <label className="block max-w-xl">
                        <span className="mb-2 block text-sm font-bold">เหตุผลที่ยกเลิก</span>
                        <textarea
                          value={cancelReasons[booking.id] ?? ''}
                          onChange={(event) =>
                            setCancelReasons((current) => ({
                              ...current,
                              [booking.id]: event.target.value,
                            }))
                          }
                          rows={2}
                          className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet focus:ring-offset-2"
                          placeholder="ระบุเหตุผลก่อนยกเลิกการจอง"
                        />
                      </label>
                      {actionErrors[booking.id] && (
                        <p role="alert" className="mt-2 text-sm text-[#b42318]">
                          {actionErrors[booking.id]}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleCancel(booking)}
                        disabled={cancellingId === booking.id}
                        className="mt-3 rounded-xl border border-[#d92d20] px-4 py-2 text-sm font-bold text-[#b42318] disabled:opacity-50"
                      >
                        {cancellingId === booking.id ? 'กำลังยกเลิก…' : 'ยกเลิกการจอง'}
                      </button>
                    </div>
                  )}

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
