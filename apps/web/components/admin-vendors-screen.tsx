'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye, RefreshCw, Search, Store, Ticket, UsersRound, X } from 'lucide-react';
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
  bookings: AdminOrganizationBooking[];
};

const STATUS_LABELS: Record<AdminOrganizationBooking['status'], string> = {
  PENDING_PAYMENT: 'รอชำระเงิน',
  CONFIRMED: 'ยืนยันแล้ว',
  CANCELLED: 'ยกเลิก',
  NO_SHOW: 'ไม่มาใช้พื้นที่',
  COMPLETED: 'เสร็จสิ้น',
};

const STATUS_STYLES: Record<AdminOrganizationBooking['status'], string> = {
  PENDING_PAYMENT: 'bg-[#fff4df] text-[#9a570f]',
  CONFIRMED: 'bg-[#e9f8f1] text-[#147653]',
  CANCELLED: 'bg-[#f1eef4] text-[#655d70]',
  NO_SHOW: 'bg-[#fff0ef] text-[#b42318]',
  COMPLETED: 'bg-[#eef4ff] text-[#315ea8]',
};

export function AdminVendorsScreen() {
  const { access, token, organizationId, organization } = useAdminPageAccess();
  const [bookings, setBookings] = useState<AdminOrganizationBooking[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);

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
  const selectedVendor = vendors.find((vendor) => vendor.id === selectedVendorId) ?? null;

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
                  <button type="button" onClick={() => setSelectedVendorId(vendor.id)} className="mt-4 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-xl border border-[#d9c9f2] bg-white px-3 text-xs font-extrabold text-violet transition hover:bg-[#f7f2ff]" aria-label={`ดูรายละเอียดผู้ขาย ${vendor.fullName}`}><Eye className="h-4 w-4" aria-hidden />ดูรายละเอียด</button>
                </article>
              ))}
            </div>
          )}
        </AdminPanel>
        {selectedVendor ? <VendorDetailDialog vendor={selectedVendor} onClose={() => setSelectedVendorId(null)} /> : null}
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
        bookings: [booking],
      });
      return;
    }

    current.bookingCount += 1;
    current.bookings.push(booking);
    if (booking.status === 'CONFIRMED') current.confirmedCount += 1;
    if (!current.shops.includes(booking.shop.name)) current.shops.push(booking.shop.name);
    if (new Date(booking.createdAt) > new Date(current.lastBookingAt)) {
      current.lastBookingAt = booking.createdAt;
    }
  });
  return [...vendors.values()]
    .map((vendor) => ({
      ...vendor,
      bookings: vendor.bookings.sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      ),
    }))
    .sort((left, right) => left.fullName.localeCompare(right.fullName, 'th'));
}

function VendorDetailDialog({ vendor, onClose }: { vendor: VendorRow; onClose: () => void }) {
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(31,23,48,.55)] p-4 backdrop-blur-sm"><button type="button" onClick={onClose} className="absolute inset-0" aria-label="ปิดรายละเอียดผู้ขาย" /><section role="dialog" aria-modal="true" aria-labelledby="vendor-detail-title" className="relative max-h-[min(760px,calc(100vh-2rem))] w-full max-w-4xl overflow-y-auto rounded-[22px] border border-[#e4daee] bg-white shadow-[0_28px_90px_rgba(31,23,48,.3)]"><header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#eee8f3] bg-white/95 px-5 py-5 backdrop-blur sm:px-7"><div className="flex min-w-0 items-center gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#b69af5,#6d28d9)] text-lg font-black text-white">{[...vendor.fullName.trim()][0] ?? '?'}</span><div className="min-w-0"><span className="text-[11px] font-extrabold uppercase tracking-[.12em] text-violet">Vendor detail</span><h2 id="vendor-detail-title" className="truncate text-xl font-black text-ink">{vendor.fullName}</h2><p className="mt-1 truncate text-xs text-muted">{vendor.email}</p></div></div><button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#e3dbe9] text-muted hover:bg-[#f7f3fa]" aria-label="ปิด"><X className="h-4 w-4" aria-hidden /></button></header><div className="p-5 sm:p-7"><div className="grid gap-3 sm:grid-cols-3"><DetailMetric label="การจองทั้งหมด" value={`${vendor.bookingCount} รายการ`} /><DetailMetric label="ยืนยันแล้ว" value={`${vendor.confirmedCount} รายการ`} tone="text-[#147653]" /><DetailMetric label="จองล่าสุด" value={formatAdminDateTime(vendor.lastBookingAt)} /></div><section className="mt-6"><h3 className="text-sm font-black text-ink">ร้านค้าที่เกี่ยวข้อง</h3><div className="mt-2 flex flex-wrap gap-2">{vendor.shops.map((shop) => <span key={shop} className="rounded-full bg-[#f1eaff] px-3 py-1.5 text-xs font-extrabold text-violet">{shop}</span>)}</div></section><section className="mt-6"><div className="flex items-end justify-between gap-3"><div><h3 className="text-sm font-black text-ink">ประวัติการจองในองค์กรนี้</h3><p className="mt-1 text-xs text-muted">เรียงจากรายการล่าสุด และไม่รวมข้อมูลจากองค์กรอื่น</p></div><span className="shrink-0 text-xs font-bold text-muted">{vendor.bookings.length} รายการ</span></div><div className="mt-3 overflow-hidden rounded-2xl border border-[#e8e1ee]"><div className="divide-y divide-[#eee9f3]">{vendor.bookings.map((booking) => <article key={booking.id} className="grid gap-3 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-ink">{booking.bookingCode}</strong><span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${STATUS_STYLES[booking.status]}`}>{STATUS_LABELS[booking.status]}</span></div><p className="mt-2 truncate text-sm font-bold text-ink">{booking.event.name}</p><p className="mt-1 text-xs text-muted">{booking.shop.name} · บูธ {booking.booth.code} · โซน {booking.booth.zone.name || booking.booth.zone.code}</p><p className="mt-1 text-[11px] text-muted">สร้างเมื่อ {formatAdminDateTime(booking.createdAt)}</p></div><div className="text-left sm:text-right"><strong className="text-sm text-violet">{formatBaht(booking.boothPrice)}</strong><p className="mt-1 text-[11px] text-muted">{formatAdminDateTime(booking.bookingStartDate)} – {formatAdminDateTime(booking.bookingEndDate)}</p></div></article>)}</div></div></section></div></section></div>;
}

function DetailMetric({ label, value, tone = 'text-ink' }: { label: string; value: string; tone?: string }) {
  return <div className="rounded-2xl border border-[#e8e1ee] bg-[#fcfbff] p-4"><span className="text-xs text-muted">{label}</span><strong className={`mt-1 block text-sm ${tone}`}>{value}</strong></div>;
}

function formatBaht(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${value} บาท`;
  return `${amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`;
}
