'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Search,
  ShieldCheck,
  TicketCheck,
} from 'lucide-react';
import {
  ApiError,
  confirmExemptBooking,
  getAdminBookingByCode,
  getMe,
  type BookingRecord,
} from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabase';

type AccessState = 'loading' | 'allowed' | 'denied';

const STATUS_LABELS: Record<BookingRecord['status'], string> = {
  PENDING_PAYMENT: 'รอชำระเงิน',
  CONFIRMED: 'ยืนยันแล้ว',
  CANCELLED: 'ยกเลิกแล้ว',
  NO_SHOW: 'ไม่มาใช้พื้นที่',
  COMPLETED: 'เสร็จสิ้น',
};

export function AdminBookingRescueScreen() {
  const router = useRouter();
  const [access, setAccess] = useState<AccessState>('loading');
  const [token, setToken] = useState('');
  const [bookingCode, setBookingCode] = useState('');
  const [booking, setBooking] = useState<BookingRecord | null>(null);
  const [reason, setReason] = useState('');
  const [searching, setSearching] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;
        if (!accessToken) {
          router.replace('/login');
          return;
        }

        const me = await getMe(accessToken, controller.signal);
        if (!active) return;

        if (me.role !== 'ORG_ADMIN' && me.role !== 'SUPER_ADMIN') {
          setAccess('denied');
          return;
        }

        setToken(accessToken);
        setAccess('allowed');
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        if (active) setAccess('denied');
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [router]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCode = bookingCode.trim().toUpperCase();
    if (!normalizedCode) {
      setError('กรุณากรอกรหัสการจอง');
      return;
    }

    setSearching(true);
    setBooking(null);
    setReason('');
    setError(null);
    setSuccess(null);
    try {
      const result = await getAdminBookingByCode(normalizedCode, token);
      setBooking(result);
      setBookingCode(result.bookingCode);
    } catch (cause) {
      setError(describeError(cause, 'ค้นหาการจองไม่สำเร็จ'));
    } finally {
      setSearching(false);
    }
  }

  async function handleConfirm() {
    if (!booking || booking.status !== 'PENDING_PAYMENT') return;
    if (!reason.trim()) {
      setError('กรุณาระบุเหตุผลที่ยกเว้นการชำระเงิน');
      return;
    }

    setConfirming(true);
    setError(null);
    setSuccess(null);
    try {
      const confirmed = await confirmExemptBooking(
        booking.id,
        reason,
        token,
      );
      setBooking(confirmed);
      setSuccess(`ยืนยันการจอง ${confirmed.bookingCode} เรียบร้อยแล้ว`);
    } catch (cause) {
      setError(describeError(cause, 'ยืนยันการจองไม่สำเร็จ'));
    } finally {
      setConfirming(false);
    }
  }

  if (access === 'loading') {
    return <AdminPageState label="กำลังตรวจสอบสิทธิ์ผู้ดูแลระบบ" />;
  }

  if (access === 'denied') {
    return (
      <main className="grid min-h-[calc(100vh-72px)] place-items-center bg-[#f8f6fb] px-5 py-12">
        <section className="max-w-lg rounded-[28px] border border-[#eadff7] bg-white p-8 text-center shadow-[0_22px_55px_rgba(54,36,91,0.08)]">
          <AlertCircle className="mx-auto h-11 w-11 text-[#dc2626]" aria-hidden />
          <h1 className="mt-4 text-2xl font-black text-ink">ไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
          <p className="mt-2 text-sm leading-6 text-[#756d80]">
            หน้านี้เปิดให้เฉพาะผู้ดูแลองค์กรและผู้ดูแลระบบเท่านั้น
          </p>
          <button
            type="button"
            onClick={() => router.replace('/')}
            className="mt-6 rounded-2xl bg-violet px-5 py-3 text-sm font-extrabold text-white"
          >
            กลับหน้าหลัก
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[radial-gradient(circle_at_top_left,#f2ecff_0,transparent_34%),#f8f7fb] px-4 py-8 sm:px-7 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#eee7ff] px-3 py-1 text-xs font-extrabold uppercase tracking-[0.14em] text-[#6d28d9]">
              <ShieldCheck className="h-4 w-4" aria-hidden />
              Organization Admin
            </span>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink sm:text-4xl">
              ยืนยันการจองที่ค้างชำระ
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#756d80]">
              ค้นหาด้วยรหัสการจองที่ได้รับจากผู้ขาย แล้วตรวจสอบสถานะก่อนยืนยันแบบยกเว้นการชำระเงิน
            </p>
          </div>
        </header>

        <section className="rounded-[28px] border border-[#e9e3f2] bg-white p-5 shadow-[0_22px_55px_rgba(54,36,91,0.07)] sm:p-7">
          <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
            <label className="min-w-0 flex-1">
              <span className="mb-2 block text-sm font-extrabold text-ink">รหัสการจอง</span>
              <span className="flex h-[52px] items-center gap-3 rounded-2xl border border-[#ded5eb] bg-[#fcfbff] px-4 focus-within:border-violet focus-within:ring-4 focus-within:ring-[#7c3aed18]">
                <Search className="h-5 w-5 shrink-0 text-violet" aria-hidden />
                <input
                  value={bookingCode}
                  onChange={(event) => setBookingCode(event.target.value)}
                  placeholder="เช่น BK-1A2B3C4D5E6F"
                  autoComplete="off"
                  className="h-[52px] min-w-0 flex-1 bg-transparent text-sm font-bold uppercase text-ink outline-none placeholder:font-normal placeholder:normal-case placeholder:text-[#aaa2b3]"
                />
              </span>
            </label>
            <button
              type="submit"
              disabled={searching}
              className="mt-auto h-[52px] rounded-2xl bg-violet px-6 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(124,58,237,0.24)] transition hover:bg-[#6d28d9] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {searching ? 'กำลังค้นหา...' : 'ค้นหาการจอง'}
            </button>
          </form>

          {error && <Feedback tone="error">{error}</Feedback>}
          {success && <Feedback tone="success">{success}</Feedback>}
        </section>

        {booking ? (
          <BookingResult
            booking={booking}
            reason={reason}
            onReasonChange={setReason}
            onConfirm={handleConfirm}
            confirming={confirming}
          />
        ) : (
          <section className="mt-6 grid min-h-64 place-items-center rounded-[28px] border border-dashed border-[#dcd3e8] bg-white/70 p-8 text-center">
            <div>
              <TicketCheck className="mx-auto h-10 w-10 text-[#9b83c7]" aria-hidden />
              <h2 className="mt-3 text-lg font-black text-ink">ยังไม่ได้เลือกรายการจอง</h2>
              <p className="mt-1 text-sm text-[#82798d]">กรอกรหัสด้านบนเพื่อดูข้อมูลก่อนยืนยัน</p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function BookingResult({
  booking,
  reason,
  onReasonChange,
  onConfirm,
  confirming,
}: {
  booking: BookingRecord;
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
  confirming: boolean;
}) {
  const canConfirm = booking.status === 'PENDING_PAYMENT';

  return (
    <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <article className="rounded-[28px] border border-[#e9e3f2] bg-white p-6 shadow-[0_22px_55px_rgba(54,36,91,0.06)] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eee9f4] pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8b8197]">Booking code</p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-ink">{booking.bookingCode}</h2>
          </div>
          <StatusBadge status={booking.status} />
        </div>

        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <Detail label="ราคาบูธ" value={`฿${formatMoney(booking.boothPrice)}`} />
          <Detail label="วันเริ่มจอง" value={formatDate(booking.bookingStartDate)} />
          <Detail label="วันสิ้นสุดจอง" value={formatDate(booking.bookingEndDate)} />
          <Detail label="หมดเวลาถือสิทธิ์" value={formatDateTime(booking.holdExpiresAt)} />
          <Detail label="Event ID" value={booking.eventId} compact />
          <Detail label="Booth ID" value={booking.boothId} compact />
        </dl>
      </article>

      <aside className="rounded-[28px] border border-[#e3d7f4] bg-[linear-gradient(145deg,#fff_0%,#f7f2ff_100%)] p-6 shadow-[0_22px_55px_rgba(54,36,91,0.07)]">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eee7ff] text-violet">
            <ShieldCheck className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h2 className="font-black text-ink">ยืนยันโดยผู้ดูแล</h2>
            <p className="text-xs text-[#81778c]">ไม่ต้องแนบสลิปการชำระเงิน</p>
          </div>
        </div>

        {canConfirm ? (
          <>
            <label className="mt-5 block">
              <span className="text-sm font-extrabold text-ink">เหตุผลที่ยกเว้นการชำระเงิน</span>
              <textarea
                value={reason}
                onChange={(event) => onReasonChange(event.target.value)}
                rows={4}
                placeholder="เช่น รับชำระเงินหน้างานโดยเจ้าหน้าที่"
                className="mt-2 w-full resize-none rounded-2xl border border-[#dcd2e9] bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-violet focus:ring-4 focus:ring-[#7c3aed18]"
              />
            </label>
            <p className="mt-3 flex gap-2 rounded-2xl bg-[#fff8e6] p-3 text-xs leading-5 text-[#8a5a00]">
              <Clock3 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              ระบบจะตรวจสถานะอีกครั้งตอนยืนยัน เพื่อป้องกันการชนกับการยกเลิกอัตโนมัติ
            </p>
            <button
              type="button"
              onClick={onConfirm}
              disabled={confirming || !reason.trim()}
              className="mt-4 w-full rounded-2xl bg-[#15803d] px-4 py-3.5 text-sm font-extrabold text-white shadow-[0_12px_26px_rgba(21,128,61,0.18)] transition hover:bg-[#166534] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {confirming ? 'กำลังยืนยัน...' : 'ยืนยันการจองโดยยกเว้นการชำระเงิน'}
            </button>
          </>
        ) : (
          <div className="mt-5 rounded-2xl bg-white p-4 text-sm leading-6 text-[#696071]">
            รายการนี้ไม่ได้อยู่ในสถานะรอชำระเงิน จึงไม่สามารถยืนยันด้วยขั้นตอนนี้ได้
          </div>
        )}
      </aside>
    </section>
  );
}

function StatusBadge({ status }: { status: BookingRecord['status'] }) {
  const pending = status === 'PENDING_PAYMENT';
  const confirmed = status === 'CONFIRMED';
  return (
    <span
      className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${
        pending
          ? 'bg-[#fff3cd] text-[#8a5a00]'
          : confirmed
            ? 'bg-[#dcfce7] text-[#166534]'
            : 'bg-[#f1eef4] text-[#655d70]'
      }`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function Detail({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-[#faf8fd] p-4">
      <dt className="text-xs font-bold text-[#8b8197]">{label}</dt>
      <dd className={`mt-1 font-extrabold text-ink ${compact ? 'break-all text-xs' : 'text-sm'}`}>
        {value}
      </dd>
    </div>
  );
}

function Feedback({
  tone,
  children,
}: {
  tone: 'error' | 'success';
  children: string;
}) {
  const success = tone === 'success';
  const Icon = success ? CheckCircle2 : AlertCircle;
  return (
    <p
      role={success ? 'status' : 'alert'}
      className={`mt-4 flex items-start gap-2 rounded-2xl p-3 text-sm font-semibold ${
        success ? 'bg-[#ecfdf3] text-[#166534]' : 'bg-[#fff1f2] text-[#b91c1c]'
      }`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      {children}
    </p>
  );
}

function AdminPageState({ label }: { label: string }) {
  return (
    <main className="grid min-h-[calc(100vh-72px)] place-items-center bg-[#f8f6fb] px-5">
      <p className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-[#706778] shadow-sm">{label}</p>
    </main>
  );
}

function describeError(cause: unknown, fallback: string): string {
  return cause instanceof ApiError ? cause.message : fallback;
}

function formatMoney(value: string): string {
  const [whole, fraction] = value.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction ? `${grouped}.${fraction.padEnd(2, '0')}` : `${grouped}.00`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value));
}

function formatDateTime(value: string | null): string {
  if (!value) return 'ไม่มีกำหนด';
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value));
}
