'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  Ticket,
} from 'lucide-react';
import {
  AdminAccessGate,
  AdminEmpty,
  AdminError,
  AdminMetric,
  AdminPage,
  AdminPageHeader,
  AdminPanel,
  formatAdminDateTime,
  formatAdminMoney,
  useAdminPageAccess,
} from '@/components/admin-ui';
import {
  getAdminOrganizationBookings,
  type AdminOrganizationBooking,
  type BookingStatus,
} from '@/lib/api';

type BookingFilter = 'ALL' | BookingStatus;

const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING_PAYMENT: 'รอชำระเงิน',
  CONFIRMED: 'ยืนยันแล้ว',
  CANCELLED: 'ยกเลิกแล้ว',
  NO_SHOW: 'ไม่มาใช้พื้นที่',
  COMPLETED: 'เสร็จสิ้น',
};

const STATUS_STYLES: Record<BookingStatus, string> = {
  PENDING_PAYMENT: 'bg-[#fff4df] text-[#9a570f]',
  CONFIRMED: 'bg-[#e7f8ef] text-[#147653]',
  CANCELLED: 'bg-[#fff0ef] text-[#b42318]',
  NO_SHOW: 'bg-[#fff0ef] text-[#b42318]',
  COMPLETED: 'bg-[#eee8ff] text-[#6734c4]',
};

export function AdminBookingsScreen() {
  const { access, token, organizationId, organization } = useAdminPageAccess();
  const [bookings, setBookings] = useState<AdminOrganizationBooking[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<BookingFilter>('ALL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (access !== 'allowed' || !token || !organizationId) return;
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError('');

    void getAdminOrganizationBookings(organizationId, token, controller.signal)
      .then((rows) => {
        if (active) setBookings(rows);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        if (active) {
          setBookings([]);
          setError(cause instanceof Error ? cause.message : 'โหลดรายการจองไม่สำเร็จ');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [access, organizationId, reloadKey, token]);

  const visibleBookings = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('th-TH');
    return bookings.filter((booking) => {
      const matchesStatus = status === 'ALL' || booking.status === status;
      const matchesQuery =
        !normalized ||
        booking.bookingCode.toLocaleLowerCase('th-TH').includes(normalized) ||
        booking.vendor.fullName.toLocaleLowerCase('th-TH').includes(normalized) ||
        booking.vendor.email.toLocaleLowerCase('th-TH').includes(normalized) ||
        booking.shop.name.toLocaleLowerCase('th-TH').includes(normalized) ||
        booking.event.name.toLocaleLowerCase('th-TH').includes(normalized) ||
        booking.booth.code.toLocaleLowerCase('th-TH').includes(normalized);
      return matchesStatus && matchesQuery;
    });
  }, [bookings, query, status]);

  const pending = bookings.filter((booking) => booking.status === 'PENDING_PAYMENT').length;
  const confirmed = bookings.filter((booking) => booking.status === 'CONFIRMED').length;
  const cancelled = bookings.filter((booking) => booking.status === 'CANCELLED').length;

  return (
    <AdminAccessGate access={access}>
      <AdminPage>
        <AdminPageHeader
          eyebrow="Booking operations"
          title="การจองทั้งหมด"
          description="ติดตามการจองของทุกอีเวนต์ในองค์กร พร้อมค้นหาผู้ขาย ร้านค้า และหมายเลขบูธ"
          organizationName={organization?.name}
          actions={
            <>
              <Link
                href={`/admin/booking-rescue?${new URLSearchParams({ organization: organizationId }).toString()}`}
                className="inline-flex h-10 items-center rounded-xl bg-violet px-4 text-xs font-extrabold text-white"
              >
                ยืนยันแบบยกเว้นชำระเงิน
              </Link>
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                disabled={loading}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#ddd4e7] bg-white px-4 text-xs font-extrabold text-[#655d70] disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
                โหลดใหม่
              </button>
            </>
          }
        />

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminMetric icon={Ticket} label="การจองทั้งหมด" value={bookings.length} />
          <AdminMetric icon={Clock3} label="รอชำระเงิน" value={pending} tone="amber" />
          <AdminMetric icon={CheckCircle2} label="ยืนยันแล้ว" value={confirmed} tone="green" />
          <AdminMetric icon={Ban} label="ยกเลิกแล้ว" value={cancelled} tone="red" />
        </div>

        <AdminPanel
          title="รายการจอง"
          description="ข้อมูลถูกจำกัดตามองค์กรที่เลือกจาก Tenant Switcher"
          className="mt-6"
          actions={<span className="text-xs font-bold text-muted">{visibleBookings.length} รายการ</span>}
        >
          <div className="flex flex-col gap-3 border-b border-[#eee9f3] p-4 sm:flex-row">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#ddd4e7] bg-[#fcfbff] px-3">
              <Search className="h-4 w-4 text-violet" aria-hidden />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ค้นหารหัสจอง ผู้ขาย ร้าน อีเวนต์ หรือบูธ"
                className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as BookingFilter)}
              className="h-10 rounded-xl border border-[#ddd4e7] bg-white px-3 text-sm font-bold text-[#655d70] outline-none"
            >
              <option value="ALL">ทุกสถานะ</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {error ? <AdminError message={error} /> : null}
          {loading ? (
            <div className="grid gap-3 p-5">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="skeleton h-16 rounded-xl" />
              ))}
            </div>
          ) : visibleBookings.length === 0 ? (
            <AdminEmpty icon={Ticket} title="ไม่พบรายการจอง" description="ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ" />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1080px] w-full border-collapse text-left text-sm">
                <thead className="bg-[#faf8fc] text-[11px] uppercase tracking-[0.08em] text-muted">
                  <tr>
                    <th className="px-5 py-3 font-extrabold">รหัสจอง</th>
                    <th className="px-4 py-3 font-extrabold">ผู้ขาย / ร้าน</th>
                    <th className="px-4 py-3 font-extrabold">อีเวนต์ / บูธ</th>
                    <th className="px-4 py-3 font-extrabold">ยอด</th>
                    <th className="px-4 py-3 font-extrabold">สถานะ</th>
                    <th className="px-4 py-3 font-extrabold">สร้างเมื่อ</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleBookings.map((booking) => (
                    <tr key={booking.id} className="border-t border-[#eee9f3] align-top">
                      <td className="px-5 py-4 font-black text-ink">{booking.bookingCode}</td>
                      <td className="px-4 py-4">
                        <strong className="block text-ink">{booking.shop.name}</strong>
                        <span className="mt-1 block text-xs text-muted">{booking.vendor.fullName} · {booking.vendor.email}</span>
                      </td>
                      <td className="px-4 py-4">
                        <strong className="block text-ink">{booking.event.name}</strong>
                        <span className="mt-1 block text-xs text-muted">{booking.booth.zone.code} · บูธ {booking.booth.code}</span>
                      </td>
                      <td className="px-4 py-4 font-extrabold text-ink">{formatAdminMoney(booking.boothPrice)}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-extrabold ${STATUS_STYLES[booking.status]}`}>
                          {STATUS_LABELS[booking.status]}
                        </span>
                        {booking.isPaymentExempt ? <span className="mt-1 block text-[10px] font-bold text-[#7c3aed]">ยกเว้นการชำระเงิน</span> : null}
                      </td>
                      <td className="px-4 py-4 text-xs text-muted">{formatAdminDateTime(booking.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminPanel>
      </AdminPage>
    </AdminAccessGate>
  );
}
