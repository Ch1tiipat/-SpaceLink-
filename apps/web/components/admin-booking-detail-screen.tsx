'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  MapPinned,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Store,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import {
  AdminAccessGate,
  AdminEmpty,
  AdminError,
  AdminMetric,
  AdminPage,
  AdminPageHeader,
  AdminPanel,
  formatAdminDate,
  formatAdminDateTime,
  formatAdminMoney,
  useAdminPageAccess,
} from '@/components/admin-ui';
import { AdminSlipActions } from '@/components/admin-slip-actions';
import { describeAdminTimelineItem } from '@/lib/admin-booking-timeline';
import {
  getAdminTransactionBookingDetail,
  type AdminPaymentStatus,
  type AdminTransactionBookingDetail,
  type BookingStatus,
} from '@/lib/api';

const BOOKING_LABELS: Record<BookingStatus, string> = {
  PENDING_PAYMENT: 'รอชำระเงิน',
  CONFIRMED: 'ยืนยันแล้ว',
  CANCELLED: 'ยกเลิกแล้ว',
  NO_SHOW: 'ไม่มาใช้พื้นที่',
  COMPLETED: 'เสร็จสิ้น',
};
const PAYMENT_LABELS: Record<AdminPaymentStatus, string> = {
  EXEMPT: 'ยกเว้นชำระเงิน',
  AWAITING_SLIP: 'รอสลิป',
  VERIFIED: 'ตรวจสอบแล้ว',
  FAILED: 'ตรวจสอบไม่ผ่าน',
};
const TIMELINE_TONES = {
  green: 'border-[#b9dfd3] bg-[#eaf8f1] text-[#147653]',
  red: 'border-[#fac5bf] bg-[#fff0ef] text-[#b42318]',
  amber: 'border-[#f1d5a6] bg-[#fff6e6] text-[#9a570f]',
  violet: 'border-[#d9c9f2] bg-[#f4efff] text-violet',
} as const;

export function AdminBookingDetailScreen({ bookingId }: { bookingId: string }) {
  const { access, token, organizationId, organization } =
    useAdminPageAccess('payments');
  const [detail, setDetail] = useState<AdminTransactionBookingDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (access !== 'allowed' || !token || !organizationId) return;
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError('');
    void getAdminTransactionBookingDetail(
      organizationId,
      bookingId,
      token,
      controller.signal,
    )
      .then((value) => {
        if (active) setDetail(value);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        if (active) {
          setDetail(null);
          setError(cause instanceof Error ? cause.message : 'โหลดรายละเอียดการจองไม่สำเร็จ');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [access, bookingId, organizationId, reloadKey, token]);

  return (
    <AdminAccessGate access={access}>
      <AdminPage>
        <AdminPageHeader
          eyebrow="Booking transaction detail"
          title={detail?.booking.bookingCode ?? 'รายละเอียดการจอง'}
          description="ข้อมูลการจอง ผู้ขาย การชำระเงิน สลิป และคืนเงินในหน้าเดียว"
          organizationName={organization?.name}
          actions={
            <>
              <Link
                href="/admin/transactions?tab=bookings"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#ddd4e7] bg-white px-4 text-xs font-extrabold text-[#655d70]"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                กลับรายการจอง
              </Link>
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                disabled={loading}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet px-4 text-xs font-extrabold text-white disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
                โหลดใหม่
              </button>
            </>
          }
        />

        {error ? <div className="mt-6"><AdminError message={error} /></div> : null}
        {loading && !detail ? <DetailSkeleton /> : null}
        {!loading && !error && !detail ? (
          <AdminPanel className="mt-6"><AdminEmpty icon={ReceiptText} title="ไม่พบรายละเอียดการจอง" description="รายการอาจไม่มีอยู่หรือไม่ได้อยู่ในองค์กรที่เลือก" /></AdminPanel>
        ) : null}
        {detail ? <DetailContent detail={detail} /> : null}
      </AdminPage>
    </AdminAccessGate>
  );
}

function DetailContent({ detail }: { detail: AdminTransactionBookingDetail }) {
  const { booking, payment } = detail;
  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetric icon={ReceiptText} label="สถานะการจอง" value={BOOKING_LABELS[booking.status]} />
        <AdminMetric icon={CircleDollarSign} label="สถานะชำระเงิน" value={PAYMENT_LABELS[payment.status]} tone={payment.status === 'VERIFIED' || payment.status === 'EXEMPT' ? 'green' : payment.status === 'FAILED' ? 'red' : 'amber'} />
        <AdminMetric icon={RotateCcw} label="คำร้องคืนเงิน" value={detail.refunds.length} tone="amber" />
        <AdminMetric icon={Clock3} label="Milestone ที่บันทึกได้" value={detail.timeline.length} tone="blue" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.8fr)]">
        <div className="grid content-start gap-6">
          <AdminPanel title="ข้อมูลการจองและพื้นที่">
            <dl className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="รหัสจอง" value={booking.bookingCode} />
              <Detail label="ราคาบูธ" value={formatAdminMoney(booking.boothPrice)} />
              <Detail label="สถานะ" value={BOOKING_LABELS[booking.status]} />
              <Detail label="อีเวนต์" value={detail.event.name} icon={CalendarDays} />
              <Detail label="โซน" value={`${detail.zone.code} · ${detail.zone.name || 'ไม่ระบุชื่อ'}`} icon={MapPinned} />
              <Detail label="บูธ" value={detail.booth.code} />
              <Detail label="วันเริ่มจอง" value={formatAdminDate(booking.bookingStartDate)} />
              <Detail label="วันสิ้นสุดจอง" value={formatAdminDate(booking.bookingEndDate)} />
              <Detail label="สร้างเมื่อ" value={formatAdminDateTime(booking.createdAt)} />
              {booking.confirmedAt ? <Detail label="ยืนยันเมื่อ" value={formatAdminDateTime(booking.confirmedAt)} /> : null}
              {booking.cancelledAt ? <Detail label="ยกเลิกเมื่อ" value={formatAdminDateTime(booking.cancelledAt)} /> : null}
              {booking.cancelReason ? <Detail label="เหตุผลยกเลิก" value={booking.cancelReason} /> : null}
            </dl>
          </AdminPanel>

          <AdminPanel title="ผู้จองและร้านค้า">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <section className="rounded-2xl border border-[#e8e1ee] bg-[#fcfbff] p-4">
                <UserRound className="h-5 w-5 text-violet" aria-hidden />
                <h3 className="mt-3 font-black text-ink">{detail.vendor.fullName}</h3>
                <p className="mt-1 text-sm text-muted">{detail.vendor.email}</p>
                <p className="mt-1 text-sm text-muted">{detail.vendor.phone || 'ไม่ระบุโทรศัพท์'}</p>
              </section>
              <section className="rounded-2xl border border-[#e8e1ee] bg-[#fcfbff] p-4">
                <Store className="h-5 w-5 text-violet" aria-hidden />
                <h3 className="mt-3 font-black text-ink">{detail.shop.name}</h3>
                <p className="mt-1 text-sm text-muted">ร้านค้าที่ใช้ในการจองรายการนี้</p>
              </section>
            </div>
          </AdminPanel>

          <AdminPanel title="การชำระเงิน" description="สถานะคำนวณจากข้อมูลที่บันทึกจริงในระบบ">
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="สถานะ" value={PAYMENT_LABELS[payment.status]} />
              <Detail label="เวลาที่มีผล" value={formatAdminDateTime(payment.effectiveAt)} />
              <Detail label="ช่องทาง" value={booking.isPaymentExempt ? 'ผู้ดูแลยกเว้นชำระเงิน' : payment.group ? 'ชำระรวมหลาย Booking' : 'ชำระราย Booking'} />
              {booking.paymentExemptReason ? <Detail label="เหตุผลยกเว้น" value={booking.paymentExemptReason} /> : null}
              {payment.group ? <><Detail label="รหัสกลุ่มชำระ" value={payment.group.paymentCode} /><Detail label="ยอดรวมกลุ่ม" value={formatAdminMoney(payment.group.totalAmount)} /><Detail label="สถานะกลุ่ม" value={payment.group.status} /></> : null}
            </div>
            {!booking.isPaymentExempt ? <div className="border-t border-[#eee9f3] px-5 py-4"><AdminSlipActions bookingId={booking.id} /></div> : null}
            <SlipTable slips={payment.slips} />
          </AdminPanel>

          <RefundSection refunds={detail.refunds} />
        </div>

        <AdminPanel title="ลำดับเหตุการณ์" description="Persisted milestone timeline จาก timestamp ที่ระบบบันทึกไว้ ไม่ใช่ immutable audit trail ทุก transition" className="h-fit">
          <ol className="p-5">
            {detail.timeline.map((item, index) => {
              const description = describeAdminTimelineItem(item);
              return <li key={`${item.type}-${item.entityId}-${item.timestamp}`} className="relative flex gap-3 pb-6 last:pb-0"><span className={`relative z-[1] mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[11px] font-black ${TIMELINE_TONES[description.tone]}`}>{index + 1}</span>{index < detail.timeline.length - 1 ? <span className="absolute left-[13px] top-7 h-[calc(100%-1.25rem)] w-px bg-[#e4ddec]" /> : null}<div><strong className="text-sm text-ink">{description.label}</strong><p className="mt-1 text-xs text-muted">{formatAdminDateTime(item.timestamp)}</p>{description.detail ? <p className="mt-1 text-xs font-bold text-[#655d70]">{description.detail}</p> : null}</div></li>;
            })}
          </ol>
        </AdminPanel>
      </div>
    </>
  );
}

function SlipTable({ slips }: { slips: AdminTransactionBookingDetail['payment']['slips'] }) {
  if (slips.length === 0) return <p className="border-t border-[#eee9f3] px-5 py-5 text-sm text-muted">ยังไม่มีประวัติการส่งสลิป</p>;
  return <div className="overflow-x-auto border-t border-[#eee9f3]"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-[#faf8fc] text-xs text-muted"><tr><th className="px-5 py-3">แหล่ง</th><th className="px-4 py-3">สถานะ</th><th className="px-4 py-3">ยอด</th><th className="px-4 py-3">ธนาคาร / เลขอ้างอิง</th><th className="px-4 py-3">เวลา</th></tr></thead><tbody>{slips.map((slip) => <tr key={slip.id} className="border-t border-[#eee9f3]"><td className="px-5 py-4 font-bold">{slip.source === 'PAYMENT_GROUP' ? 'สลิปกลุ่ม' : 'สลิป Booking'}</td><td className="px-4 py-4">{slip.status}</td><td className="px-4 py-4 font-extrabold">{formatAdminMoney(slip.amount)}</td><td className="px-4 py-4 text-xs text-muted">{slip.sendingBank || '—'} · {slip.transRef || 'ไม่มีเลขอ้างอิง'}</td><td className="px-4 py-4 text-xs text-muted">{formatAdminDateTime(slip.verifiedAt ?? slip.createdAt)}</td></tr>)}</tbody></table></div>;
}

function RefundSection({ refunds }: { refunds: AdminTransactionBookingDetail['refunds'] }) {
  return <AdminPanel title="คำร้องคืนเงิน" description={`${refunds.length} รายการ`}>
    {refunds.length === 0 ? <AdminEmpty icon={RotateCcw} title="ไม่มีคำร้องคืนเงิน" description="Booking นี้ยังไม่เคยส่งคำร้องคืนเงิน" /> : <div className="divide-y divide-[#eee9f3]">{refunds.map((refund) => <article key={refund.id} className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_auto]"><div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-ink">{refund.status}</strong>{refund.payoutNameMismatch ? <span className="rounded-full bg-[#fff0ef] px-2 py-1 text-[10px] font-extrabold text-[#b42318]">ชื่อบัญชีควรตรวจสอบ</span> : null}</div><p className="mt-2 text-sm text-muted">{refund.reason}</p><p className="mt-2 text-xs text-muted">ผู้ขอ {refund.requestedBy.fullName} · {formatAdminDateTime(refund.createdAt)}</p><p className="mt-1 text-xs text-muted">บัญชีรับเงิน {refund.payoutAccountName || 'ไม่ระบุ'} · {refund.payoutMethod || 'ไม่ระบุวิธี'}</p></div><div className="md:text-right"><strong className="block text-sm text-ink">ขอ {formatAdminMoney(refund.requestedAmount)}</strong><span className="mt-1 block text-xs text-muted">อนุมัติ {refund.approvedAmount ? formatAdminMoney(refund.approvedAmount) : '—'}</span>{refund.reviewedAt ? <span className="mt-2 block text-xs text-muted">ตรวจเมื่อ {formatAdminDateTime(refund.reviewedAt)}</span> : null}</div></article>)}</div>}
  </AdminPanel>;
}

function Detail({ label, value, icon: Icon }: { label: string; value: string; icon?: LucideIcon }) {
  return <div><dt className="flex items-center gap-1.5 text-xs font-bold text-muted">{Icon ? <Icon className="h-3.5 w-3.5 text-violet" aria-hidden /> : null}{label}</dt><dd className="mt-1 text-sm font-extrabold text-ink">{value}</dd></div>;
}

function DetailSkeleton() {
  return <div className="mt-6 grid gap-4"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="skeleton h-32 rounded-[18px]" />)}</div><div className="skeleton h-72 rounded-[20px]" /><div className="skeleton h-96 rounded-[20px]" /></div>;
}
