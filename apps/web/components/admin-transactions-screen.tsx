'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CircleDollarSign, RefreshCw, RotateCcw, Search, Store, Ticket } from 'lucide-react';
import { AdminBookingsScreen } from '@/components/admin-bookings-screen';
import { AdminPaymentsScreen, AdminRefundsScreen } from '@/components/admin-payments-screen';
import { AdminVendorsScreen } from '@/components/admin-vendors-screen';
import { AdminAccessGate, AdminMetric, AdminPage, AdminPageHeader, AdminPanel, useAdminPageAccess } from '@/components/admin-ui';
import {
  getAdminTransactions,
  type AdminTransactionBooking,
  type AdminTransactionQuery,
  type AdminTransactionRefund,
  type AdminTransactionResponse,
  type AdminTransactionVendor,
} from '@/lib/api';
import {
  parseAdminTransactionFilters,
  serializeAdminTransactionFilters,
  transactionViewForTab,
  type AdminTransactionFilters,
  type AdminTransactionTab,
} from '@/lib/admin-transaction-filters';

const TABS: Array<{ value: AdminTransactionTab; label: string }> = [
  { value: 'bookings', label: 'การจอง' }, { value: 'payments', label: 'การชำระเงิน' },
  { value: 'refunds', label: 'คืนเงิน' }, { value: 'vendors', label: 'ผู้ขาย/ร้านค้า' },
];
const BOOKING_STATUS = [['', 'ทุกสถานะการจอง'], ['PENDING_PAYMENT', 'รอชำระเงิน'], ['CONFIRMED', 'ยืนยันแล้ว'], ['CANCELLED', 'ยกเลิกแล้ว'], ['NO_SHOW', 'ไม่มาใช้พื้นที่'], ['COMPLETED', 'เสร็จสิ้น']];
const PAYMENT_STATUS = [['', 'ทุกสถานะชำระ'], ['EXEMPT', 'ยกเว้นชำระ'], ['AWAITING_SLIP', 'รอสลิป'], ['VERIFIED', 'ตรวจสอบแล้ว'], ['FAILED', 'ตรวจสอบไม่ผ่าน']];
const REFUND_STATUS = [['', 'ทุกสถานะคืนเงิน'], ['NONE', 'ไม่มีคำร้อง'], ['PENDING', 'รอตรวจ'], ['APPROVED', 'อนุมัติ'], ['REJECTED', 'ปฏิเสธ'], ['PROCESSED', 'ดำเนินการแล้ว']];

export function AdminTransactionsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseAdminTransactionFilters(searchParams), [searchParams]);
  const [queryDraft, setQueryDraft] = useState(filters.q);
  const [response, setResponse] = useState<AdminTransactionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const { access, token, organizationId, organization } = useAdminPageAccess('payments');

  useEffect(() => setQueryDraft(filters.q), [filters.q]);
  useEffect(() => {
    if (access !== 'allowed' || !token || !organizationId) return;
    const controller = new AbortController();
    let active = true;
    setLoading(true); setError('');
    const query: AdminTransactionQuery = {
      view: transactionViewForTab(filters.tab),
      eventId: filters.eventId || undefined, zoneId: filters.zoneId || undefined,
      vendorUserId: filters.vendorUserId || undefined, shopId: filters.shopId || undefined,
      bookingStatus: filters.bookingStatus as AdminTransactionQuery['bookingStatus'] || undefined,
      paymentStatus: filters.paymentStatus as AdminTransactionQuery['paymentStatus'] || undefined,
      refundStatus: filters.refundStatus as AdminTransactionQuery['refundStatus'] || undefined,
      from: filters.from || undefined, to: filters.to || undefined, q: filters.q || undefined,
      page: filters.page, pageSize: filters.pageSize,
    };
    void getAdminTransactions(organizationId, query, token, controller.signal).then((value) => {
      if (active) setResponse(value);
    }).catch((cause: unknown) => {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      if (active) { setResponse(null); setError(cause instanceof Error ? cause.message : 'โหลดข้อมูลไม่สำเร็จ'); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [access, filters, organizationId, reloadKey, token]);

  function update(next: Partial<AdminTransactionFilters>) {
    const merged = { ...filters, ...next, page: next.page ?? 1 };
    router.replace(`${pathname}?${serializeAdminTransactionFilters(merged)}`, { scroll: false });
  }
  function submitQuery(event: FormEvent) { event.preventDefault(); update({ q: queryDraft }); }

  const summary = response?.summary;
  const totalPages = response ? Math.max(1, Math.ceil(response.total / response.pageSize)) : 1;
  const bookingItems = response?.view === 'BOOKINGS' || response?.view === 'PAYMENTS' ? response.items as AdminTransactionBooking[] : [];
  const refundItems = response?.view === 'REFUNDS' ? response.items as AdminTransactionRefund[] : [];
  const vendorItems = response?.view === 'VENDORS' ? response.items as AdminTransactionVendor[] : [];

  return <AdminAccessGate access={access}><AdminPage>
    <AdminPageHeader eyebrow="Finance operations" title="การเงินและการจอง" description="ศูนย์รวมรายการจอง การชำระเงิน คืนเงิน และผู้ขายขององค์กร พร้อมตัวกรองที่แชร์เป็นลิงก์ได้" organizationName={organization?.name} actions={<button type="button" onClick={() => setReloadKey((value) => value + 1)} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#ddd4e7] bg-white px-4 text-xs font-extrabold text-[#655d70] disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />โหลดใหม่</button>} />
    <nav aria-label="หมวดการเงินและการจอง" className="mt-6 flex gap-2 overflow-x-auto rounded-2xl border border-[#e8e1ee] bg-white p-2">{TABS.map((tab) => <button key={tab.value} type="button" onClick={() => update({ tab: tab.value })} aria-current={filters.tab === tab.value ? 'page' : undefined} className={`min-h-10 shrink-0 rounded-xl px-4 text-sm font-extrabold ${filters.tab === tab.value ? 'bg-violet text-white' : 'text-[#655d70] hover:bg-[#f7f2ff]'}`}>{tab.label}</button>)}</nav>
    <AdminPanel className="mt-4" title="ตัวกรอง" description="ค่าตัวกรองจะอยู่ใน URL เพื่อเปิดซ้ำหรือส่งต่อได้"><form onSubmit={submitQuery} className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4"><label className="flex items-center gap-2 rounded-xl border border-[#ddd4e7] px-3 xl:col-span-2"><Search className="h-4 w-4 text-violet" aria-hidden /><input value={queryDraft} onChange={(event) => setQueryDraft(event.target.value)} maxLength={100} placeholder="ค้นหารหัสจอง ผู้ขาย ร้าน อีเวนต์ หรือกลุ่มชำระ" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" /><button className="text-xs font-extrabold text-violet" type="submit">ค้นหา</button></label>
      <FilterSelect label="อีเวนต์" value={filters.eventId} onChange={(value) => update({ eventId: value })} options={(response?.filters.events ?? []).map((item) => [item.id, item.name])} />
      <FilterSelect label="โซน" value={filters.zoneId} onChange={(value) => update({ zoneId: value })} options={(response?.filters.zones ?? []).map((item) => [item.id, item.name || item.code])} />
      <FilterSelect label="ผู้ขาย" value={filters.vendorUserId} onChange={(value) => update({ vendorUserId: value })} options={(response?.filters.vendors ?? []).map((item) => [item.id, item.fullName])} />
      <FilterSelect label="ร้านค้า" value={filters.shopId} onChange={(value) => update({ shopId: value })} options={(response?.filters.shops ?? []).map((item) => [item.id, item.name])} />
      <FilterSelect label="สถานะการจอง" value={filters.bookingStatus} onChange={(value) => update({ bookingStatus: value })} options={BOOKING_STATUS.slice(1)} first={BOOKING_STATUS[0][1]} />
      <FilterSelect label="สถานะชำระ" value={filters.paymentStatus} onChange={(value) => update({ paymentStatus: value })} options={PAYMENT_STATUS.slice(1)} first={PAYMENT_STATUS[0][1]} />
      <FilterSelect label="สถานะคืนเงิน" value={filters.refundStatus} onChange={(value) => update({ refundStatus: value })} options={REFUND_STATUS.slice(1)} first={REFUND_STATUS[0][1]} />
      <label className="text-xs font-bold text-muted">ตั้งแต่<input type="date" value={filters.from} onChange={(event) => update({ from: event.target.value })} className="mt-1 h-10 w-full rounded-xl border border-[#ddd4e7] bg-white px-3 text-sm text-ink" /></label>
      <label className="text-xs font-bold text-muted">ถึง<input type="date" value={filters.to} onChange={(event) => update({ to: event.target.value })} className="mt-1 h-10 w-full rounded-xl border border-[#ddd4e7] bg-white px-3 text-sm text-ink" /></label>
      <button type="button" onClick={() => { setQueryDraft(''); router.replace(`${pathname}?tab=${filters.tab}`, { scroll: false }); }} className="h-10 self-end rounded-xl border border-[#ddd4e7] px-3 text-xs font-extrabold text-muted">ล้างตัวกรอง</button>
    </form></AdminPanel>
    <div className="my-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><AdminMetric icon={Ticket} label="Booking ในผลลัพธ์" value={summary?.bookings ?? '—'} /><AdminMetric icon={CircleDollarSign} label="ตรวจสอบชำระแล้ว" value={summary?.payments.VERIFIED ?? '—'} tone="green" /><AdminMetric icon={RotateCcw} label="คืนเงินรอตรวจ" value={summary?.refunds.PENDING ?? '—'} tone="amber" /><AdminMetric icon={Store} label="ร้านค้าที่เกี่ยวข้อง" value={summary?.shops ?? '—'} tone="blue" /></div>
    {filters.tab === 'bookings' ? <AdminBookingsScreen items={bookingItems} organizationId={organizationId} loading={loading} error={error} /> : filters.tab === 'payments' ? <AdminPaymentsScreen items={bookingItems} loading={loading} error={error} /> : filters.tab === 'refunds' ? <AdminRefundsScreen items={refundItems} loading={loading} error={error} /> : <AdminVendorsScreen items={vendorItems} loading={loading} error={error} />}
    <div className="mt-4 flex items-center justify-between gap-3 text-xs font-bold text-muted"><span>{response ? `${response.total} รายการ · หน้า ${response.page} จาก ${totalPages}` : 'กำลังเตรียมข้อมูล'}</span><div className="flex gap-2"><button type="button" disabled={loading || filters.page <= 1} onClick={() => update({ page: filters.page - 1 })} className="h-9 rounded-xl border border-[#ddd4e7] bg-white px-3 disabled:opacity-40">ก่อนหน้า</button><button type="button" disabled={loading || filters.page >= totalPages} onClick={() => update({ page: filters.page + 1 })} className="h-9 rounded-xl border border-[#ddd4e7] bg-white px-3 disabled:opacity-40">ถัดไป</button></div></div>
  </AdminPage></AdminAccessGate>;
}

function FilterSelect({ label, value, onChange, options, first = `ทุก${label}` }: { label: string; value: string; onChange: (value: string) => void; options: string[][]; first?: string }) {
  return <label className="text-xs font-bold text-muted">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-[#ddd4e7] bg-white px-3 text-sm text-ink"><option value="">{first}</option>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}
