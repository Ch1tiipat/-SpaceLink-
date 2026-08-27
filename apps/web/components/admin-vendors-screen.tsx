'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, Store, Ticket, UsersRound } from 'lucide-react';
import {
  AdminAccessGate,
  AdminEmpty,
  AdminError,
  AdminMetric,
  AdminPage,
  AdminPageHeader,
  AdminPanel,
  formatAdminDateTime,
  useAdminPageAccess,
} from '@/components/admin-ui';
import {
  getAdminOrganizationBookings,
  type AdminOrganizationBooking,
} from '@/lib/api';

type VendorRow = {
  id: string;
  fullName: string;
  email: string;
  shops: string[];
  bookingCount: number;
  confirmedCount: number;
  lastBookingAt: string;
};

export function AdminVendorsScreen() {
  const { access, token, organizationId, organization } = useAdminPageAccess();
  const [bookings, setBookings] = useState<AdminOrganizationBooking[]>([]);
  const [query, setQuery] = useState('');
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
          setError(cause instanceof Error ? cause.message : 'โหลดข้อมูลผู้ขายไม่สำเร็จ');
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

  const vendors = useMemo(() => deriveVendors(bookings), [bookings]);
  const visibleVendors = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('th-TH');
    if (!normalized) return vendors;
    return vendors.filter(
      (vendor) =>
        vendor.fullName.toLocaleLowerCase('th-TH').includes(normalized) ||
        vendor.email.toLocaleLowerCase('th-TH').includes(normalized) ||
        vendor.shops.some((shop) => shop.toLocaleLowerCase('th-TH').includes(normalized)),
    );
  }, [query, vendors]);

  const shopCount = new Set(bookings.map((booking) => booking.shop.id)).size;

  return (
    <AdminAccessGate access={access}>
      <AdminPage>
        <AdminPageHeader
          eyebrow="Vendor directory"
          title="ผู้ขายของบริษัท"
          description="สรุปผู้ขายและร้านค้าที่มีประวัติการจองกับองค์กร ข้อมูลนี้สร้างจากรายการ Booking ที่ Backend อนุญาตให้ผู้ดูแลองค์กรอ่าน"
          organizationName={organization?.name}
          actions={
            <button
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#ddd4e7] bg-white px-4 text-xs font-extrabold text-[#655d70] disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
              โหลดใหม่
            </button>
          }
        />

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <AdminMetric icon={UsersRound} label="ผู้ขายที่เคยจอง" value={vendors.length} />
          <AdminMetric icon={Store} label="ร้านค้าที่เกี่ยวข้อง" value={shopCount} tone="blue" />
          <AdminMetric icon={Ticket} label="รายการจองทั้งหมด" value={bookings.length} tone="green" />
        </div>

        <AdminPanel
          title="รายชื่อผู้ขาย"
          description="ไม่มีปุ่ม Blacklist โดยตรง การออกแต้มโทษยังทำผ่าน Booking Rescue ตาม endpoint เดิม"
          className="mt-6"
          actions={<span className="text-xs font-bold text-muted">{visibleVendors.length} ราย</span>}
        >
          <div className="border-b border-[#eee9f3] p-4">
            <label className="flex max-w-xl items-center gap-2 rounded-xl border border-[#ddd4e7] bg-[#fcfbff] px-3">
              <Search className="h-4 w-4 text-violet" aria-hidden />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ค้นหาชื่อ อีเมล หรือชื่อร้าน"
                className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </label>
          </div>
          {error ? <AdminError message={error} /> : null}
          {loading ? (
            <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="skeleton h-40 rounded-[18px]" />
              ))}
            </div>
          ) : visibleVendors.length === 0 ? (
            <AdminEmpty icon={UsersRound} title="ไม่พบผู้ขาย" description="ผู้ขายจะปรากฏเมื่อมีประวัติการจองในองค์กรนี้" />
          ) : (
            <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
              {visibleVendors.map((vendor) => (
                <article key={vendor.id} className="rounded-[18px] border border-[#e8e1ee] bg-[#fcfbff] p-5">
                  <div className="flex items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#b69af5,#6d28d9)] font-black text-white">
                      {[...vendor.fullName.trim()][0] ?? '?'}
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate font-black text-ink">{vendor.fullName}</h2>
                      <p className="mt-1 truncate text-xs text-muted">{vendor.email}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {vendor.shops.map((shop) => (
                      <span key={shop} className="rounded-full bg-[#f1eaff] px-2.5 py-1 text-[11px] font-extrabold text-violet">{shop}</span>
                    ))}
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[#ebe5ef] pt-4 text-xs">
                    <div><dt className="text-muted">การจอง</dt><dd className="mt-1 font-black text-ink">{vendor.bookingCount}</dd></div>
                    <div><dt className="text-muted">ยืนยันแล้ว</dt><dd className="mt-1 font-black text-[#147653]">{vendor.confirmedCount}</dd></div>
                  </dl>
                  <p className="mt-3 text-[11px] text-muted">ล่าสุด {formatAdminDateTime(vendor.lastBookingAt)}</p>
                </article>
              ))}
            </div>
          )}
        </AdminPanel>
      </AdminPage>
    </AdminAccessGate>
  );
}

function deriveVendors(bookings: AdminOrganizationBooking[]): VendorRow[] {
  const vendors = new Map<string, VendorRow>();
  bookings.forEach((booking) => {
    const current = vendors.get(booking.vendor.id);
    if (!current) {
      vendors.set(booking.vendor.id, {
        id: booking.vendor.id,
        fullName: booking.vendor.fullName,
        email: booking.vendor.email,
        shops: [booking.shop.name],
        bookingCount: 1,
        confirmedCount: booking.status === 'CONFIRMED' ? 1 : 0,
        lastBookingAt: booking.createdAt,
      });
      return;
    }

    current.bookingCount += 1;
    if (booking.status === 'CONFIRMED') current.confirmedCount += 1;
    if (!current.shops.includes(booking.shop.name)) current.shops.push(booking.shop.name);
    if (new Date(booking.createdAt) > new Date(current.lastBookingAt)) {
      current.lastBookingAt = booking.createdAt;
    }
  });
  return [...vendors.values()].sort((left, right) =>
    left.fullName.localeCompare(right.fullName, 'th'),
  );
}
