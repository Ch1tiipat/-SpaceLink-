'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, MapPinned, ReceiptText, Store } from 'lucide-react';
import { BookingCountdown } from '@/components/booking-countdown';
import {
  cancelBooking,
  getMyBookings,
  type BookingStatus,
  type MyBooking,
} from '@/lib/api';
import { isUuid } from '@/lib/route-identifier';
import { useVendorProfile } from '@/lib/use-vendor-profile';
import { canUseUxPreview, UX_PREVIEW_SHOP } from '@/lib/ux-preview';

export type BookingDetailState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      booking: MyBooking;
      token: string;
      isPreview: boolean;
      refresh: () => void;
    };

const statusLabels: Record<BookingStatus, string> = {
  PENDING_PAYMENT: 'รอชำระเงิน',
  CONFIRMED: 'ยืนยันแล้ว',
  CANCELLED: 'ยกเลิกแล้ว',
  NO_SHOW: 'ไม่มาเข้าร่วม',
  COMPLETED: 'เสร็จสิ้น',
};

const statusTones: Record<BookingStatus, string> = {
  PENDING_PAYMENT: 'border-[#d5e6f5] bg-[#edf6ff] text-[#1d67a8]',
  CONFIRMED: 'border-[#b9dfd3] bg-[#ebfaf3] text-[#13795b]',
  CANCELLED: 'border-[#fac5bf] bg-[#fff0ee] text-[#b42318]',
  NO_SHOW: 'border-[#ead8b7] bg-[#fff8e8] text-[#895b08]',
  COMPLETED: 'border-[#d9ccef] bg-[#f4efff] text-violet',
};

const dateFormatter = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function formatBookingMoney(value: string): string {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(numeric)
    : value;
}

export function formatBookingDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

export function isBookingReviewEligible(booking: MyBooking): boolean {
  const eligibleFrom = new Date(booking.bookingEndDate).getTime() + 17 * 60 * 60 * 1000;
  return (
    (booking.status === 'CONFIRMED' || booking.status === 'COMPLETED') &&
    eligibleFrom <= Date.now()
  );
}

function createPreviewBooking(bookingId: string): MyBooking | null {
  const previewStatuses: Record<string, BookingStatus> = {
    'local-preview-booking': 'PENDING_PAYMENT',
    'local-preview-confirmed-booking': 'CONFIRMED',
    'local-preview-completed-booking': 'COMPLETED',
    'local-preview-cancelled-booking': 'CANCELLED',
  };
  const status = previewStatuses[bookingId];
  if (!status) return null;

  const completed = status === 'COMPLETED';
  const cancelled = status === 'CANCELLED';
  const pending = status === 'PENDING_PAYMENT';
  const now = Date.now();
  return {
    id: bookingId,
    bookingCode:
      status === 'PENDING_PAYMENT'
        ? 'SL-DEMO-2569'
        : status === 'CONFIRMED'
          ? 'SL-DEMO-CFM'
          : status === 'COMPLETED'
            ? 'SL-DEMO-REVIEW'
            : 'SL-DEMO-CANCEL',
    eventId: 'demo-event',
    boothId: 'demo-booth-a01',
    shopId: UX_PREVIEW_SHOP.id,
    vendorUserId: '00000000-0000-4000-8000-000000000051',
    bookingStartDate: new Date(now + (completed ? -4 : 20) * 86_400_000).toISOString(),
    bookingEndDate: new Date(now + (completed ? -2 : 22) * 86_400_000).toISOString(),
    boothPrice: '3500.00',
    isPaymentExempt: false,
    paymentExemptReason: null,
    status,
    holdExpiresAt: pending ? new Date(now + 15 * 60_000).toISOString() : null,
    confirmedAt:
      status === 'CONFIRMED' || completed
        ? new Date(now - 5 * 86_400_000).toISOString()
        : null,
    cancelReason: cancelled ? 'เปลี่ยนแผนการเข้าร่วมงาน (ข้อมูลจำลอง)' : null,
    cancelledAt: cancelled ? new Date(now - 2 * 86_400_000).toISOString() : null,
    createdAt: new Date(now - 60_000).toISOString(),
    updatedAt: new Date(now - 60_000).toISOString(),
    paymentQrDataUri: null,
    event: {
      id: 'demo-event',
      slug: 'demo-event',
      name: 'งานเกษตร มทส. 2569',
    },
    booth: {
      id: 'demo-booth-a01',
      code: 'A01',
      zone: { id: 'demo-zone-a', code: 'A', name: 'โซนอาหารและเครื่องดื่ม' },
    },
    shop: { id: UX_PREVIEW_SHOP.id, name: UX_PREVIEW_SHOP.name },
  };
}

export function getPreviewBookings(): MyBooking[] {
  return [
    'local-preview-booking',
    'local-preview-confirmed-booking',
    'local-preview-completed-booking',
    'local-preview-cancelled-booking',
  ]
    .map(createPreviewBooking)
    .filter((booking): booking is MyBooking => booking !== null);
}

export function useBookingDetail(bookingId: string): BookingDetailState {
  const router = useRouter();
  const pathname = usePathname();
  const { state: vendor } = useVendorProfile();
  const [booking, setBooking] = useState<MyBooking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (vendor.status === 'loading') return;
    if (vendor.status !== 'ready') {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    if (canUseUxPreview()) {
      const preview =
        getPreviewBookings().find(
          (item) => item.bookingCode === bookingId,
        ) ?? createPreviewBooking(bookingId);
      setBooking(preview);
      setError(preview ? null : 'ไม่พบรายการจองตัวอย่างนี้');
      setIsLoading(false);
      return () => controller.abort();
    }

    getMyBookings(vendor.token, controller.signal)
      .then((items) => {
        const legacyUuid = isUuid(bookingId);
        const match =
          items.find((item) =>
            legacyUuid
              ? item.id === bookingId
              : item.bookingCode === bookingId,
          ) ?? null;
        setBooking(match);
        setError(match ? null : 'ไม่พบรายการจอง หรือรายการนี้ไม่ได้เป็นของบัญชีปัจจุบัน');
        if (match && legacyUuid) {
          const currentPrefix = `/bookings/${bookingId}`;
          const suffix = pathname.startsWith(currentPrefix)
            ? pathname.slice(currentPrefix.length)
            : '';
          router.replace(
            `/bookings/${encodeURIComponent(match.bookingCode)}${suffix}${window.location.search}`,
          );
        }
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'โหลดข้อมูลการจองไม่สำเร็จ');
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [bookingId, pathname, reloadCount, router, vendor]);

  if (vendor.status === 'signed-out') return { status: 'signed-out' };
  if (vendor.status === 'error') return { status: 'error', message: vendor.message };
  if (vendor.status === 'loading' || isLoading) return { status: 'loading' };
  if (error || !booking) return { status: 'error', message: error ?? 'ไม่พบรายการจอง' };

  return {
    status: 'ready',
    booking,
    token: vendor.token,
    isPreview: canUseUxPreview(),
    refresh: () => setReloadCount((current) => current + 1),
  };
}

export function BookingDetailScreen({ bookingId }: { bookingId: string }) {
  const state = useBookingDetail(bookingId);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [previewCancelled, setPreviewCancelled] = useState(false);

  if (state.status === 'loading') return <BookingPageLoading />;
  if (state.status === 'signed-out') return <BookingPageMessage title="กรุณาเข้าสู่ระบบก่อน" detail="รายละเอียดการจองจะแสดงเฉพาะเจ้าของบัญชี" href="/login" action="เข้าสู่ระบบ" />;
  if (state.status === 'error') return <BookingPageMessage title="เปิดรายละเอียดการจองไม่ได้" detail={state.message} />;

  const booking = previewCancelled
    ? { ...state.booking, status: 'CANCELLED' as const, cancelReason }
    : state.booking;
  const cancellable =
    (booking.status === 'PENDING_PAYMENT' || booking.status === 'CONFIRMED') &&
    new Date(booking.bookingStartDate).getTime() > Date.now();
  const pastCancelDeadline =
    (booking.status === 'PENDING_PAYMENT' || booking.status === 'CONFIRMED') &&
    new Date(booking.bookingStartDate).getTime() <= Date.now();

  async function handleCancel() {
    const reason = cancelReason.trim();
    if (!reason) {
      setCancelError('กรุณาระบุเหตุผลที่ต้องการยกเลิก');
      return;
    }
    setIsCancelling(true);
    setCancelError(null);
    try {
      if (state.status !== 'ready') return;
      if (state.isPreview) setPreviewCancelled(true);
      else {
        await cancelBooking(booking.id, reason, state.token);
        state.refresh();
      }
    } catch (cause) {
      setCancelError(cause instanceof Error ? cause.message : 'ยกเลิกการจองไม่สำเร็จ');
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <main className="sl-page pb-16">
      <div className="shell py-8">
        <Link href="/bookings" className="sl-chip">← กลับการจองของฉัน</Link>
        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="sl-kicker"><ReceiptText className="h-4 w-4" aria-hidden /> Booking detail</span>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.045em] sm:text-4xl">รายละเอียดการจอง</h1>
            <p className="mt-2 text-muted">รหัสการจอง {booking.bookingCode}</p>
          </div>
          <span className={`rounded-full border px-4 py-2 text-sm font-extrabold ${statusTones[booking.status]}`}>{statusLabels[booking.status]}</span>
        </div>

        <BookingProgress status={booking.status} />

        <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="sl-surface p-5 sm:p-7">
            <h2 className="text-2xl font-black">{booking.event.name}</h2>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <Detail icon={MapPinned} label="บูธ / โซน" value={`${booking.booth.code} · ${booking.booth.zone.name ?? booking.booth.zone.code}`} />
              <Detail icon={Store} label="ร้านค้า" value={booking.shop.name} />
              <Detail icon={CalendarDays} label="วันเริ่มงาน" value={formatBookingDate(booking.bookingStartDate)} />
              <Detail icon={CalendarDays} label="วันสิ้นสุด" value={formatBookingDate(booking.bookingEndDate)} />
            </dl>
            <div className="mt-6 flex flex-wrap gap-3 border-t border-line pt-6">
              <Link href={`/events/${encodeURIComponent(booking.event.slug ?? '')}`} className="sl-action-secondary text-violet">ดู Event</Link>
              <Link href={`/events/${encodeURIComponent(booking.event.slug ?? '')}/map?zone=${encodeURIComponent(booking.booth.zone.code)}`} className="sl-action-secondary text-violet">ดูตำแหน่งบน Zone Map</Link>
              {booking.status === 'PENDING_PAYMENT' ? <Link href={`/bookings/${encodeURIComponent(booking.bookingCode)}/payment`} className="sl-action-primary">ไปหน้าชำระเงิน</Link> : null}
              {isBookingReviewEligible(booking) ? <Link href={`/bookings/${encodeURIComponent(booking.bookingCode)}/review`} className="sl-action-primary">เขียนรีวิวพื้นที่</Link> : null}
            </div>
          </section>

          <aside className="grid gap-5">
            <section className="sl-surface p-5">
              <p className="text-sm font-bold text-muted">ยอดชำระทั้งหมด</p>
              <strong className="mt-2 block text-3xl font-black">{formatBookingMoney(booking.boothPrice)} บาท</strong>
              {booking.status === 'PENDING_PAYMENT' ? <BookingCountdown expiresAt={booking.holdExpiresAt} active /> : null}
            </section>
            {cancellable ? (
              <section className="sl-surface p-5">
                <h2 className="font-black">ยกเลิกการจอง</h2>
                <p className="mt-1 text-sm leading-6 text-muted">การยกเลิกจะส่งผลกับรายการจริง กรุณาระบุเหตุผลก่อนยืนยัน</p>
                <p className="mt-2 text-sm font-bold text-[#895b08]">ยกเลิกได้ถึงวันที่ {formatBookingDate(booking.bookingStartDate)}</p>
                <textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} rows={3} placeholder="เหตุผลที่ต้องการยกเลิก" className="mt-4 w-full rounded-xl border border-line px-4 py-3 text-base outline-none focus:border-violet" />
                {cancelError ? <p role="alert" className="mt-2 text-sm text-danger">{cancelError}</p> : null}
                <button type="button" onClick={() => void handleCancel()} disabled={isCancelling} className="mt-3 w-full rounded-xl border border-danger px-4 py-2.5 text-sm font-bold text-danger disabled:opacity-50">{isCancelling ? 'กำลังยกเลิก…' : 'ยืนยันยกเลิกการจอง'}</button>
              </section>
            ) : pastCancelDeadline ? (
              <section className="sl-surface p-5">
                <p className="text-sm font-bold leading-6 text-[#895b08]">พ้นกำหนดยกเลิกแล้ว (ยกเลิกได้ถึงวันที่ {formatBookingDate(booking.bookingStartDate)})</p>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}

function BookingProgress({ status }: { status: BookingStatus }) {
  const cancelled = status === 'CANCELLED' || status === 'NO_SHOW';
  const paid = status !== 'PENDING_PAYMENT' && !cancelled;
  const confirmed = status === 'CONFIRMED' || status === 'COMPLETED';
  const steps = [
    { label: 'สร้างรายการจอง', complete: true },
    { label: 'ชำระเงิน', complete: paid },
    { label: 'ยืนยันพื้นที่', complete: confirmed },
  ];

  return (
    <section className="sl-surface mt-6 p-2" aria-label="ความคืบหน้าการจอง">
      <ol className="grid gap-2 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={step.label}
            className={`flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold ${
              step.complete
                ? 'bg-[#effaf6] text-[#176c50]'
                : cancelled
                  ? 'bg-[#fff4f4] text-[#b42318]'
                  : 'bg-[#faf8ff] text-muted'
            }`}
          >
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                step.complete ? 'bg-[#176c50] text-white' : 'bg-white text-violet shadow-sm'
              }`}
            >
              {step.complete ? (
                <CheckCircle2 className="h-4 w-4" aria-hidden />
              ) : (
                index + 1
              )}
            </span>
            {step.label}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Detail({ icon: Icon, label, value }: { icon: typeof MapPinned; label: string; value: string }) {
  return <div className="rounded-2xl border border-line bg-[#faf8ff] p-4"><Icon className="h-5 w-5 text-violet" aria-hidden /><dt className="mt-3 text-xs font-bold text-muted">{label}</dt><dd className="mt-1 font-extrabold">{value}</dd></div>;
}

export function BookingPageLoading() {
  return <main><div className="shell py-10"><div className="skeleton h-24 rounded-3xl" /><div className="skeleton mt-6 h-[460px] rounded-3xl" /></div></main>;
}

export function BookingPageMessage({ title, detail, href = '/bookings', action = 'กลับการจองของฉัน' }: { title: string; detail: string; href?: string; action?: string }) {
  return <main><div className="shell py-20 text-center"><h1 className="text-2xl font-black">{title}</h1><p className="mt-3 text-muted">{detail}</p><Link href={href} className="sl-action-primary mt-7">{action}</Link></div></main>;
}
