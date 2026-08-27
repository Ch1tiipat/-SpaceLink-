'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CircleDollarSign,
  FileClock,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
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
  getAdminOrganizationRefunds,
  type AdminOrganizationBooking,
  type AdminOrganizationRefund,
} from '@/lib/api';

export function AdminPaymentsScreen() {
  const { access, token, organizationId, organization } = useAdminPageAccess();
  const [bookings, setBookings] = useState<AdminOrganizationBooking[]>([]);
  const [refunds, setRefunds] = useState<AdminOrganizationRefund[]>([]);
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

    void Promise.all([
      getAdminOrganizationBookings(organizationId, token, controller.signal),
      getAdminOrganizationRefunds(organizationId, token, controller.signal),
    ])
      .then(([bookingRows, refundRows]) => {
        if (!active) return;
        setBookings(bookingRows);
        setRefunds(refundRows);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        if (active) {
          setBookings([]);
          setRefunds([]);
          setError(cause instanceof Error ? cause.message : 'โหลดบันทึกการชำระเงินไม่สำเร็จ');
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
    if (!normalized) return bookings;
    return bookings.filter(
      (booking) =>
        booking.bookingCode.toLocaleLowerCase('th-TH').includes(normalized) ||
        booking.shop.name.toLocaleLowerCase('th-TH').includes(normalized) ||
        booking.vendor.fullName.toLocaleLowerCase('th-TH').includes(normalized) ||
        booking.event.name.toLocaleLowerCase('th-TH').includes(normalized),
    );
  }, [bookings, query]);

  const confirmed = bookings.filter((booking) => booking.status === 'CONFIRMED').length;
  const exempt = bookings.filter((booking) => booking.isPaymentExempt).length;
  const pendingRefunds = refunds.filter((refund) => refund.status === 'PENDING').length;

  return (
    <AdminAccessGate access={access}>
      <AdminPage>
        <AdminPageHeader
          eyebrow="Payment audit log"
          title="การชำระเงินและคืนเงิน"
          description="บันทึกแบบอ่านอย่างเดียวจาก Booking และ Refund ขององค์กร หน้านี้ไม่มีปุ่ม Reject หรือการเปลี่ยนสถานะเงินจริง"
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

        <div className="mt-6 rounded-[16px] border border-[#dfd3ef] bg-[#f7f2ff] px-4 py-3 text-sm leading-6 text-[#5f3ca1]">
          <strong>Read-only log:</strong> Endpoint ปัจจุบันไม่ส่งรายละเอียดสลิปหรือผล SlipOK ให้หน้า ORG_ADMIN จึงแสดงเฉพาะสถานะ Booking, การยกเว้นชำระ และคำร้องคืนเงินที่ตรวจสอบได้จาก API
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminMetric icon={CircleDollarSign} label="Booking ทั้งหมด" value={bookings.length} />
          <AdminMetric icon={ShieldCheck} label="ยืนยันแล้ว" value={confirmed} tone="green" />
          <AdminMetric icon={FileClock} label="ยกเว้นการชำระ" value={exempt} tone="blue" />
          <AdminMetric icon={RotateCcw} label="คำร้องคืนเงินรอตรวจ" value={pendingRefunds} tone="amber" />
        </div>

        <AdminPanel
          title="บันทึกสถานะการชำระเงิน"
          description="ไม่มี action ปฏิเสธรายการในหน้านี้"
          className="mt-6"
          actions={<span className="text-xs font-bold text-muted">{visibleBookings.length} รายการ</span>}
        >
          <div className="border-b border-[#eee9f3] p-4">
            <label className="flex max-w-xl items-center gap-2 rounded-xl border border-[#ddd4e7] bg-[#fcfbff] px-3">
              <Search className="h-4 w-4 text-violet" aria-hidden />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ค้นหารหัสจอง ร้าน ผู้ขาย หรืออีเวนต์"
                className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </label>
          </div>
          {error ? <AdminError message={error} /> : null}
          {loading ? (
            <div className="grid gap-3 p-5">
              {Array.from({ length: 5 }, (_, index) => <div key={index} className="skeleton h-16 rounded-xl" />)}
            </div>
          ) : visibleBookings.length === 0 ? (
            <AdminEmpty icon={CircleDollarSign} title="ไม่มีบันทึกการชำระเงิน" description="รายการจะปรากฏเมื่อองค์กรมี Booking" />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full border-collapse text-left text-sm">
                <thead className="bg-[#faf8fc] text-[11px] uppercase tracking-[0.08em] text-muted">
                  <tr>
                    <th className="px-5 py-3 font-extrabold">รหัสจอง</th>
                    <th className="px-4 py-3 font-extrabold">ผู้ขาย</th>
                    <th className="px-4 py-3 font-extrabold">อีเวนต์</th>
                    <th className="px-4 py-3 font-extrabold">ยอดตาม Booking</th>
                    <th className="px-4 py-3 font-extrabold">ช่องทางยืนยัน</th>
                    <th className="px-4 py-3 font-extrabold">สถานะ</th>
                    <th className="px-4 py-3 font-extrabold">เวลา</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleBookings.map((booking) => (
                    <tr key={booking.id} className="border-t border-[#eee9f3]">
                      <td className="px-5 py-4 font-black text-ink">{booking.bookingCode}</td>
                      <td className="px-4 py-4"><strong className="block text-ink">{booking.shop.name}</strong><span className="text-xs text-muted">{booking.vendor.fullName}</span></td>
                      <td className="px-4 py-4 text-ink">{booking.event.name}</td>
                      <td className="px-4 py-4 font-extrabold text-ink">{formatAdminMoney(booking.boothPrice)}</td>
                      <td className="px-4 py-4 text-xs font-bold text-[#655d70]">{booking.isPaymentExempt ? 'ผู้ดูแลยกเว้นการชำระ' : 'สถานะจาก Booking API'}</td>
                      <td className="px-4 py-4"><PaymentStatus booking={booking} /></td>
                      <td className="px-4 py-4 text-xs text-muted">{formatAdminDateTime(booking.confirmedAt ?? booking.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminPanel>

        <AdminPanel
          title="คำร้องคืนเงิน"
          description="แสดงผลแบบอ่านอย่างเดียว ไม่มีปุ่ม Approve, Reject หรือ Process"
          className="mt-6"
          actions={<span className="text-xs font-bold text-muted">{refunds.length} คำร้อง</span>}
        >
          {loading ? (
            <div className="skeleton m-5 h-36 rounded-[18px]" />
          ) : refunds.length === 0 ? (
            <AdminEmpty icon={RotateCcw} title="ยังไม่มีคำร้องคืนเงิน" description="ไม่มีรายการคืนเงินสำหรับองค์กรนี้" />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[850px] w-full border-collapse text-left text-sm">
                <thead className="bg-[#faf8fc] text-[11px] uppercase tracking-[0.08em] text-muted">
                  <tr><th className="px-5 py-3">Booking ID</th><th className="px-4 py-3">เหตุผล</th><th className="px-4 py-3">ยอดที่ขอ</th><th className="px-4 py-3">ยอดอนุมัติ</th><th className="px-4 py-3">สถานะ</th><th className="px-4 py-3">สร้างเมื่อ</th></tr>
                </thead>
                <tbody>
                  {refunds.map((refund) => (
                    <tr key={refund.id} className="border-t border-[#eee9f3]">
                      <td className="px-5 py-4 font-mono text-xs text-ink">{refund.bookingId}</td>
                      <td className="max-w-xs px-4 py-4 text-muted">{refund.reason}</td>
                      <td className="px-4 py-4 font-extrabold text-ink">{formatAdminMoney(refund.requestedAmount)}</td>
                      <td className="px-4 py-4 font-extrabold text-ink">{refund.approvedAmount ? formatAdminMoney(refund.approvedAmount) : '—'}</td>
                      <td className="px-4 py-4"><RefundStatus status={refund.status} /></td>
                      <td className="px-4 py-4 text-xs text-muted">{formatAdminDateTime(refund.createdAt)}</td>
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

function PaymentStatus({ booking }: { booking: AdminOrganizationBooking }) {
  const confirmed = booking.status === 'CONFIRMED';
  const pending = booking.status === 'PENDING_PAYMENT';
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${confirmed ? 'bg-[#e7f8ef] text-[#147653]' : pending ? 'bg-[#fff4df] text-[#9a570f]' : 'bg-[#f1eef4] text-[#655d70]'}`}>
      {confirmed ? 'ยืนยันแล้ว' : pending ? 'รอชำระเงิน' : booking.status}
    </span>
  );
}

function RefundStatus({ status }: { status: AdminOrganizationRefund['status'] }) {
  const styles = {
    PENDING: 'bg-[#fff4df] text-[#9a570f]',
    APPROVED: 'bg-[#eaf2ff] text-[#2459b5]',
    REJECTED: 'bg-[#fff0ef] text-[#b42318]',
    PROCESSED: 'bg-[#e7f8ef] text-[#147653]',
  } as const;
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${styles[status]}`}>{status}</span>;
}
