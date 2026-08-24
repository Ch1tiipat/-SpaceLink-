'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Send,
  ShieldCheck,
} from 'lucide-react';
import {
  ApiError,
  approveQuotaException,
  createSupportTicket,
  getMe,
  type BookingRecord,
  type SupportTicketRecord,
  type UserRole,
} from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { canUseUxPreview, UX_PREVIEW_TOKEN } from '@/lib/ux-preview';

type AccessState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'ready'; token: string; role: UserRole }
  | { status: 'error'; message: string };

const inputClass =
  'mt-2 h-12 w-full rounded-2xl border border-[#ded5eb] bg-[#fcfbff] px-4 text-base text-ink outline-none transition focus:border-violet focus:ring-4 focus:ring-[#7c3aed18]';

export function SupportTicketScreen() {
  const router = useRouter();
  const [access, setAccess] = useState<AccessState>({ status: 'loading' });

  useEffect(() => {
    if (canUseUxPreview()) {
      setAccess({ status: 'ready', token: UX_PREVIEW_TOKEN, role: 'VENDOR' });
      return;
    }

    const controller = new AbortController();
    let active = true;

    void (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          if (active) setAccess({ status: 'signed-out' });
          return;
        }

        const me = await getMe(token, controller.signal);
        if (active) setAccess({ status: 'ready', token, role: me.role });
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        if (active) {
          setAccess({
            status: 'error',
            message: describeError(cause, 'ตรวจสอบสิทธิ์ใช้งานไม่สำเร็จ'),
          });
        }
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  if (access.status === 'loading') {
    return (
      <section className="sl-surface mt-8 p-6" aria-busy="true">
        <p className="text-sm font-semibold text-muted">กำลังตรวจสอบสิทธิ์สำหรับคำร้องขอโควตา</p>
      </section>
    );
  }

  if (access.status === 'signed-out') {
    return (
      <section className="sl-soft-surface mt-8 p-6 sm:p-8">
        <h2 className="text-xl font-black text-ink">คำร้องขอเพิ่มโควตาการจอง</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          กรุณาเข้าสู่ระบบก่อนส่งหรือตรวจสอบคำร้อง
        </p>
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="sl-action-primary mt-5"
        >
          เข้าสู่ระบบ
        </button>
      </section>
    );
  }

  if (access.status === 'error') {
    return (
      <section className="mt-8 rounded-3xl border border-red-200 bg-red-50 p-6 text-red-800">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p>{access.message}</p>
        </div>
      </section>
    );
  }

  return access.role === 'VENDOR' ? (
    <VendorTicketForm
      token={access.token}
      preview={access.token === UX_PREVIEW_TOKEN}
    />
  ) : (
    <AdminApprovalForm token={access.token} />
  );
}

function VendorTicketForm({ token, preview }: { token: string; preview: boolean }) {
  const [eventId, setEventId] = useState(preview ? 'demo-event' : '');
  const [subject, setSubject] = useState('ขอเพิ่มโควตาการจองบูธ');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<SupportTicketRecord | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!eventId.trim() || !subject.trim() || !message.trim()) {
      setError('กรุณากรอก Event ID หัวข้อ และรายละเอียดให้ครบ');
      return;
    }

    setSubmitting(true);
    setError(null);
    setTicket(null);
    try {
      const created = preview
        ? {
            id: 'preview-support-ticket',
            userId: 'preview-vendor',
            organizationId: null,
            bookingId: null,
            type: 'QUOTA_EXCEPTION',
            subject,
            status: 'OPEN' as const,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        : await createSupportTicket({ eventId, subject, message }, token);
      setTicket(created);
    } catch (cause) {
      setError(describeError(cause, 'ส่งคำร้องขอเพิ่มโควตาไม่สำเร็จ'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="quota-request-heading" className="sl-surface mt-8 p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-tint text-violet">
          <Send className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-violet">Vendor request</p>
          <h2 id="quota-request-heading" className="mt-1 text-2xl font-black text-ink">
            ขอเพิ่มโควตาการจองบูธ
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            ใช้เมื่อจองครบโควตาแล้ว ระบุ Event และบูธที่ต้องการให้ผู้ดูแลองค์กรพิจารณา
          </p>
          {preview ? (
            <p className="mt-3 rounded-xl bg-violet-tint px-3 py-2 text-xs font-semibold text-violet">
              โหมดตรวจ UX/UI — การส่งแบบฟอร์มจะไม่สร้างคำร้องจริง
            </p>
          ) : null}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
        <Field label="Event ID">
          <input
            value={eventId}
            onChange={(event) => setEventId(event.target.value)}
            className={inputClass}
            placeholder="UUID ของ Event"
            required
          />
        </Field>
        <Field label="หัวข้อ">
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className={inputClass}
            required
          />
        </Field>
        <Field label="รายละเอียดและรหัสบูธที่ต้องการ">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className={`${inputClass} min-h-28 py-3`}
            placeholder="เช่น ต้องการจองบูธ ZZ-A03 เพิ่ม เนื่องจาก..."
            required
          />
        </Field>

        {error && <ErrorMessage message={error} />}
        {ticket && (
          <SuccessMessage>
            ส่งคำร้องเรียบร้อยแล้ว Ticket ID: <strong className="break-all">{ticket.id}</strong>
          </SuccessMessage>
        )}

        <button type="submit" disabled={submitting} className="sl-action-primary w-fit disabled:opacity-60">
          {submitting ? 'กำลังส่งคำร้อง...' : 'ส่งคำร้องขอเพิ่มโควตา'}
        </button>
      </form>
    </section>
  );
}

function AdminApprovalForm({ token }: { token: string }) {
  const [ticketId, setTicketId] = useState('');
  const [eventId, setEventId] = useState('');
  const [boothId, setBoothId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingRecord | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ticketId.trim() || !eventId.trim() || !boothId.trim()) {
      setError('กรุณากรอก Ticket ID, Event ID และ Booth ID ให้ครบ');
      return;
    }

    setSubmitting(true);
    setError(null);
    setBooking(null);
    try {
      const created = await approveQuotaException(
        ticketId,
        { eventId, boothId },
        token,
      );
      setBooking(created);
    } catch (cause) {
      setError(describeError(cause, 'อนุมัติคำร้องขอเพิ่มโควตาไม่สำเร็จ'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="quota-approval-heading" className="sl-surface mt-8 p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-tint text-violet">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-violet">Organization Admin</p>
          <h2 id="quota-approval-heading" className="mt-1 text-2xl font-black text-ink">
            อนุมัติคำร้องขอเพิ่มโควตา
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            ตรวจสอบ Ticket ID, Event ID และ Booth ID ก่อนอนุมัติ ระบบจะสร้าง Booking และปิด Ticket อัตโนมัติ
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Ticket ID">
          <input
            value={ticketId}
            onChange={(event) => setTicketId(event.target.value)}
            className={inputClass}
            placeholder="UUID ของ Ticket"
            required
          />
        </Field>
        <Field label="Event ID">
          <input
            value={eventId}
            onChange={(event) => setEventId(event.target.value)}
            className={inputClass}
            placeholder="UUID ของ Event"
            required
          />
        </Field>
        <Field label="Booth ID">
          <input
            value={boothId}
            onChange={(event) => setBoothId(event.target.value)}
            className={inputClass}
            placeholder="UUID ของ Booth"
            required
          />
        </Field>

        <div className="sm:col-span-2">
          {error && <ErrorMessage message={error} />}
          {booking && (
            <SuccessMessage>
              อนุมัติเรียบร้อยแล้ว Booking code: <strong>{booking.bookingCode}</strong>
            </SuccessMessage>
          )}
        </div>

        <button type="submit" disabled={submitting} className="sl-action-primary w-fit disabled:opacity-60 sm:col-span-2">
          <ClipboardCheck className="h-4 w-4" aria-hidden />
          {submitting ? 'กำลังอนุมัติ...' : 'อนุมัติและสร้าง Booking'}
        </button>
      </form>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-extrabold text-ink">
      {label}
      {children}
    </label>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

function SuccessMessage({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

function describeError(cause: unknown, fallback: string): string {
  if (cause instanceof ApiError) return cause.message;
  return fallback;
}
