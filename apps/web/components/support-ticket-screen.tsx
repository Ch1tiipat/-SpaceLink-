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
  getBooths,
  getMyBookings,
  getMe,
  type BookingRecord,
  type BoothOption,
  type MyBooking,
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

type VendorRequestType = 'QUOTA_INCREASE' | 'ISSUE_REPORT';

const ACTIVE_BOOKING_STATUSES = new Set(['PENDING_PAYMENT', 'CONFIRMED']);

const PREVIEW_BOOKINGS: MyBooking[] = [
  {
    id: 'preview-booking-a01',
    bookingCode: 'BK-PREVIEW-A01',
    eventId: 'preview-event',
    boothId: 'preview-booth-a01',
    shopId: 'preview-shop',
    vendorUserId: 'preview-vendor',
    bookingStartDate: '2026-09-10T00:00:00.000Z',
    bookingEndDate: '2026-09-12T00:00:00.000Z',
    boothPrice: '6500',
    isPaymentExempt: false,
    paymentExemptReason: null,
    status: 'CONFIRMED',
    holdExpiresAt: null,
    confirmedAt: '2026-08-31T00:00:00.000Z',
    cancelReason: null,
    cancelledAt: null,
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
    paymentQrDataUri: null,
    event: { id: 'preview-event', name: 'Future Tech Expo 2026' },
    booth: {
      id: 'preview-booth-a01',
      code: 'A01',
      zone: { id: 'preview-zone-a', code: 'A', name: 'โซนอาหาร' },
    },
    shop: { id: 'preview-shop', name: 'ร้านตัวอย่าง' },
  },
];

const PREVIEW_BOOTH_OPTIONS: BoothOption[] = [
  {
    id: 'preview-booth-a02',
    zoneId: 'preview-zone-a',
    code: 'A02',
    boothPrice: '6500',
    widthM: '3',
    heightM: '2.5',
    facilities: null,
    posX: null,
    posY: null,
    status: 'AVAILABLE',
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
  },
  {
    id: 'preview-booth-a03',
    zoneId: 'preview-zone-a',
    code: 'A03',
    boothPrice: '6500',
    widthM: '4',
    heightM: '3',
    facilities: null,
    posX: null,
    posY: null,
    status: 'AVAILABLE',
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
  },
];

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
  const [requestType, setRequestType] =
    useState<VendorRequestType>('QUOTA_INCREASE');
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [quotaContext, setQuotaContext] = useState('');
  const [boothOptions, setBoothOptions] = useState<BoothOption[]>([]);
  const [loadingBooths, setLoadingBooths] = useState(false);
  const [boothError, setBoothError] = useState<string | null>(null);
  const [requestedBoothId, setRequestedBoothId] = useState('');
  const [issueBookingId, setIssueBookingId] = useState('');
  const [subject, setSubject] = useState('ขอโควต้าบูธเพิ่ม');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<SupportTicketRecord | null>(null);

  const activeBookings = bookings.filter((booking) =>
    ACTIVE_BOOKING_STATUSES.has(booking.status),
  );
  const quotaOptions = Array.from(
    new Map(
      activeBookings.map((booking) => {
        const key = `${booking.event.id}:${booking.booth.zone.id}`;
        return [
          key,
          {
            key,
            eventId: booking.event.id,
            eventName: booking.event.name,
            zoneId: booking.booth.zone.id,
            zoneName: booking.booth.zone.name ?? booking.booth.zone.code,
          },
        ];
      }),
    ).values(),
  );
  const selectedQuotaOption = quotaOptions.find(
    (option) => option.key === quotaContext,
  );
  const selectedQuotaZoneId = selectedQuotaOption?.zoneId ?? '';
  const selectedQuotaBookings = selectedQuotaOption
    ? activeBookings.filter(
        (booking) =>
          booking.event.id === selectedQuotaOption.eventId &&
          booking.booth.zone.id === selectedQuotaOption.zoneId,
      )
    : [];

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void (async () => {
      try {
        const loaded = preview
          ? PREVIEW_BOOKINGS
          : await getMyBookings(token, controller.signal);
        if (!active) return;
        setBookings(loaded);
        const firstActive = loaded.find((booking) =>
          ACTIVE_BOOKING_STATUSES.has(booking.status),
        );
        if (firstActive) {
          setQuotaContext(
            `${firstActive.event.id}:${firstActive.booth.zone.id}`,
          );
        }
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        if (active) {
          setBookingsError(
            describeError(cause, 'โหลดข้อมูลการจองไม่สำเร็จ'),
          );
        }
      } finally {
        if (active) setLoadingBookings(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [preview, token]);

  useEffect(() => {
    if (requestType !== 'QUOTA_INCREASE' || !selectedQuotaZoneId) {
      setBoothOptions([]);
      setRequestedBoothId('');
      setBoothError(null);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setLoadingBooths(true);
    setBoothError(null);

    void (async () => {
      try {
        const loaded = preview
          ? PREVIEW_BOOTH_OPTIONS.filter(
              (booth) => booth.zoneId === selectedQuotaZoneId,
            )
          : await getBooths(selectedQuotaZoneId, controller.signal);
        if (!active) return;
        const available = loaded.filter(
          (booth) => booth.status === 'AVAILABLE',
        );
        setBoothOptions(available);
        setRequestedBoothId(available[0]?.id ?? '');
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        if (active) {
          setBoothError(describeError(cause, 'โหลดข้อมูลบูธไม่สำเร็จ'));
          setBoothOptions([]);
          setRequestedBoothId('');
        }
      } finally {
        if (active) setLoadingBooths(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [preview, requestType, selectedQuotaZoneId]);

  function changeRequestType(nextType: VendorRequestType) {
    setRequestType(nextType);
    setSubject(
      nextType === 'QUOTA_INCREASE' ? 'ขอโควต้าบูธเพิ่ม' : '',
    );
    setMessage('');
    setError(null);
    setTicket(null);
  }

  function changeQuotaContext(nextContext: string) {
    setQuotaContext(nextContext);
    setRequestedBoothId('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setError('กรุณากรอกหัวข้อและรายละเอียดให้ครบ');
      return;
    }
    if (
      requestType === 'QUOTA_INCREASE' &&
      (!selectedQuotaOption || !requestedBoothId)
    ) {
      setError('กรุณาเลือกงาน โซน และบูธที่ต้องการเพิ่ม');
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
            type:
              requestType === 'QUOTA_INCREASE' ? 'OTHER' : 'ISSUE_REPORT',
            subject,
            status: 'OPEN' as const,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        : requestType === 'QUOTA_INCREASE' && selectedQuotaOption
          ? await createSupportTicket(
              {
                requestType,
                eventId: selectedQuotaOption.eventId,
                zoneId: selectedQuotaOption.zoneId,
                boothId: requestedBoothId,
                subject,
                message,
              },
              token,
            )
          : await createSupportTicket(
              {
                requestType: 'ISSUE_REPORT',
                bookingId: issueBookingId || undefined,
                subject,
                message,
              },
              token,
            );
      setTicket(created);
    } catch (cause) {
      setError(describeError(cause, 'ส่งคำร้องไม่สำเร็จ'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="vendor-request-heading" className="sl-surface mt-8 p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-tint text-violet">
          <Send className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-violet">Vendor request</p>
          <h2 id="vendor-request-heading" className="mt-1 text-2xl font-black text-ink">
            ติดต่อและขอความช่วยเหลือ
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            เลือกส่งคำขอเพิ่มโควต้าบูธ หรือติดต่อปัญหาที่ต้องการให้ผู้ดูแลช่วยตรวจสอบ
          </p>
          {preview ? (
            <p className="mt-3 rounded-xl bg-violet-tint px-3 py-2 text-xs font-semibold text-violet">
              โหมดตรวจ UX/UI — การส่งแบบฟอร์มจะไม่สร้างคำร้องจริง
            </p>
          ) : null}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
        <Field label="ประเภทคำขอ">
          <select
            value={requestType}
            onChange={(event) =>
              changeRequestType(event.target.value as VendorRequestType)
            }
            className={inputClass}
          >
            <option value="QUOTA_INCREASE">ขอโควต้าบูธเพิ่ม</option>
            <option value="ISSUE_REPORT">ติดต่อปัญหา</option>
          </select>
        </Field>

        {requestType === 'QUOTA_INCREASE' ? (
          <>
            <Field label="งานและโซนที่จองอยู่">
              <select
                value={quotaContext}
                onChange={(event) => changeQuotaContext(event.target.value)}
                className={inputClass}
                disabled={loadingBookings || quotaOptions.length === 0}
                required
              >
                <option value="">
                  {loadingBookings
                    ? 'กำลังโหลดข้อมูลการจอง...'
                    : 'เลือกงานและโซน'}
                </option>
                {quotaOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.eventName} — {option.zoneName}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="บูธที่ต้องการเพิ่ม">
              <select
                value={requestedBoothId}
                onChange={(event) => setRequestedBoothId(event.target.value)}
                className={inputClass}
                disabled={loadingBooths || boothOptions.length === 0}
                required
              >
                <option value="">
                  {loadingBooths ? 'กำลังโหลดบูธ...' : 'เลือกบูธที่ต้องการเพิ่ม'}
                </option>
                {boothOptions.map((booth) => (
                  <option key={booth.id} value={booth.id}>
                    บูธ {booth.code} — {formatBoothSize(booth)}
                  </option>
                ))}
              </select>
            </Field>

            {!loadingBooths && selectedQuotaZoneId && boothOptions.length === 0 ? (
              <ErrorMessage message="ยังไม่มีบูธว่างในโซนนี้" />
            ) : null}

            {selectedQuotaBookings.length > 0 ? (
              <div className="rounded-2xl border border-[#ded5eb] bg-violet-tint/50 p-4">
                <p className="text-sm font-extrabold text-ink">
                  บูธที่คุณจองในงานและโซนนี้
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {selectedQuotaBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="rounded-xl border border-white bg-white px-4 py-3 text-sm"
                    >
                      <p className="font-extrabold text-ink">
                        บูธ {booking.booth.code}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {booking.bookingCode} · {bookingStatusLabel(booking.status)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {!loadingBookings && quotaOptions.length === 0 ? (
              <ErrorMessage message="ยังไม่มีการจองที่ใช้งานอยู่สำหรับส่งคำขอเพิ่มโควต้า" />
            ) : null}
          </>
        ) : (
          <Field label="การจองที่เกี่ยวข้อง (ไม่บังคับ)">
            <select
              value={issueBookingId}
              onChange={(event) => setIssueBookingId(event.target.value)}
              className={inputClass}
              disabled={loadingBookings}
            >
              <option value="">ไม่เกี่ยวข้องกับการจอง</option>
              {bookings.map((booking) => (
                <option key={booking.id} value={booking.id}>
                  {booking.bookingCode} — {booking.event.name} — บูธ {booking.booth.code}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label={requestType === 'ISSUE_REPORT' ? 'หัวข้อปัญหา' : 'หัวข้อคำขอ'}>
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className={inputClass}
            required
          />
        </Field>
        <Field
          label={
            requestType === 'ISSUE_REPORT'
              ? 'รายละเอียดปัญหา'
              : 'เหตุผลและรายละเอียดเพิ่มเติม'
          }
        >
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className={`${inputClass} min-h-28 py-3`}
            placeholder={
              requestType === 'ISSUE_REPORT'
                ? 'อธิบายปัญหาที่พบและข้อมูลที่ช่วยให้ตรวจสอบได้'
                : 'อธิบายเหตุผลที่ต้องการขอโควต้าบูธเพิ่ม'
            }
            required
          />
        </Field>

        {bookingsError && <ErrorMessage message={bookingsError} />}
        {boothError && <ErrorMessage message={boothError} />}
        {error && <ErrorMessage message={error} />}
        {ticket && (
          <SuccessMessage>
            ส่งคำร้องเรียบร้อยแล้ว Ticket ID: <strong className="break-all">{ticket.id}</strong>
          </SuccessMessage>
        )}

        <button type="submit" disabled={submitting} className="sl-action-primary w-fit disabled:opacity-60">
          {submitting
            ? 'กำลังส่งคำร้อง...'
            : requestType === 'QUOTA_INCREASE'
              ? 'ส่งคำขอโควต้าบูธเพิ่ม'
              : 'ส่งเรื่องติดต่อปัญหา'}
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

function bookingStatusLabel(status: MyBooking['status']): string {
  const labels: Record<MyBooking['status'], string> = {
    PENDING_PAYMENT: 'รอชำระเงิน',
    CONFIRMED: 'ยืนยันแล้ว',
    CANCELLED: 'ยกเลิกแล้ว',
    NO_SHOW: 'ไม่เข้าร่วมงาน',
    COMPLETED: 'เสร็จสิ้น',
  };
  return labels[status];
}

function formatBoothSize(booth: BoothOption): string {
  return booth.widthM && booth.heightM
    ? `${booth.widthM} × ${booth.heightM} เมตร`
    : 'ไม่ระบุขนาด';
}

function describeError(cause: unknown, fallback: string): string {
  if (cause instanceof ApiError) return cause.message;
  return fallback;
}
