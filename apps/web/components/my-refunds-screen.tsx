'use client';

import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  CircleHelp,
  Clock3,
  Landmark,
  Plus,
  ReceiptText,
  RotateCcw,
  X,
  type LucideIcon,
} from 'lucide-react';
import { getPreviewBookings } from '@/components/booking-detail-screen';
import {
  cancelBooking,
  createBatchRefundRequests,
  getMyBookings,
  getMyRefunds,
  getRefundPayoutSlipAccess,
  type CreateBatchRefundRequestsInput,
  type MyBooking,
  type RefundRequest,
} from '@/lib/api';
import {
  isValidRefundAmount,
  refundFlowAction,
  sumRefundAmounts,
} from '@/lib/refund-request-policy';
import { useVendorProfile } from '@/lib/use-vendor-profile';
import { canUseUxPreview } from '@/lib/ux-preview';

const statusLabels: Record<RefundRequest['status'], string> = {
  PENDING: 'รอตรวจสอบ',
  APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ไม่อนุมัติ',
  PROCESSED: 'คืนเงินแล้ว',
};

const statusTones: Record<RefundRequest['status'], string> = {
  PENDING: 'border-[#ead8b7] bg-[#fff8e8] text-[#895b08]',
  APPROVED: 'border-[#b9dfd3] bg-[#ebfaf3] text-[#13795b]',
  REJECTED: 'border-[#fac5bf] bg-[#fff0ee] text-[#b42318]',
  PROCESSED: 'border-[#d9ccef] bg-[#f4efff] text-violet',
};

const dateFormatter = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatMoney(value: string): string {
  const [whole, fraction] = value.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction && !/^0+$/.test(fraction)
    ? `${grouped}.${fraction}`
    : grouped;
}

function maskPromptPayId(value: string | null): string {
  if (!value) return 'ไม่มีหมายเลข PromptPay (คำร้องเดิม)';
  const visibleDigits = value.slice(-4);
  return `${'•'.repeat(Math.max(4, value.length - visibleDigits.length))}${visibleDigits}`;
}

export function MyRefundsScreen() {
  const { state } = useVendorProfile();
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [openingRefundId, setOpeningRefundId] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [createdRefunds, setCreatedRefunds] = useState<RefundRequest[] | null>(
    null,
  );
  const summary = useMemo(
    () => ({
      all: refunds.length,
      pending: refunds.filter((refund) => refund.status === 'PENDING').length,
      approved: refunds.filter((refund) => refund.status === 'APPROVED').length,
      processed: refunds.filter((refund) => refund.status === 'PROCESSED')
        .length,
    }),
    [refunds],
  );

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'ready') {
      setIsLoading(false);
      return;
    }
    if (canUseUxPreview()) {
      setRefunds([]);
      setBookings(getPreviewBookings());
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setIsLoading(true);
    setError('');
    Promise.all([
      getMyRefunds(state.token, controller.signal),
      getMyBookings(state.token, controller.signal),
    ])
      .then(([refundItems, bookingItems]) => {
        if (!active) return;
        setRefunds(refundItems);
        setBookings(bookingItems);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'โหลดรายการคำร้องคืนเงินไม่สำเร็จ',
          );
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [state]);

  const refundCandidates = useMemo(
    () =>
      bookings.filter(
        (booking) => refundFlowAction(booking, refunds) !== null,
      ),
    [bookings, refunds],
  );

  useEffect(() => {
    if (refunds.length === 0) return;
    const refundId = new URLSearchParams(window.location.search).get('refundId');
    if (!refundId) return;
    document
      .getElementById(`refund-${refundId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [refunds]);

  async function openPayoutSlip(refundId: string) {
    if (state.status !== 'ready') return;
    setOpeningRefundId(refundId);
    setError('');
    try {
      const access = await getRefundPayoutSlipAccess(refundId, state.token);
      window.open(access.viewUrl, '_blank', 'noopener,noreferrer');
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'เปิดสลิปการคืนเงินไม่สำเร็จ',
      );
    } finally {
      setOpeningRefundId(null);
    }
  }

  if (state.status === 'signed-out') {
    return (
      <RefundPageMessage
        title="กรุณาเข้าสู่ระบบก่อน"
        detail="คำร้องคืนเงินจะแสดงเฉพาะเจ้าของบัญชี"
      />
    );
  }
  if (state.status === 'error') {
    return (
      <RefundPageMessage
        title="เปิดรายการคืนเงินไม่ได้"
        detail={state.message}
        href="/bookings"
        action="กลับการจองของฉัน"
      />
    );
  }

  return (
    <main className="sl-page pb-16">
      <div className="shell py-7 sm:py-9">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="sl-kicker">My refunds</span>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
              คำขอคืนเงินของฉัน
            </h1>
            <p className="mt-1.5 text-sm text-muted sm:text-base">
              ติดตามสถานะคำขอและยอดเงินคืนจากการจองที่ยกเลิก
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/bookings"
              className="sl-action-secondary inline-flex min-h-12 items-center gap-2 px-5 text-violet"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              กลับการจองของฉัน
            </Link>
            <button
              type="button"
              onClick={() => setRequestOpen(true)}
              className="sl-action-primary inline-flex min-h-12 items-center gap-2 px-5"
            >
              <Plus className="h-4 w-4" aria-hidden />
              ขอคืนเงิน
            </button>
          </div>
        </div>

        {state.status === 'ready' && !isLoading && !error ? (
          <section
            className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4"
            aria-label="สรุปคำขอคืนเงิน"
          >
            <RefundStat
              icon={ReceiptText}
              label="คำขอทั้งหมด"
              value={summary.all}
              tone="violet"
            />
            <RefundStat
              icon={Clock3}
              label="รอตรวจสอบ"
              value={summary.pending}
              tone="amber"
            />
            <RefundStat
              icon={BadgeCheck}
              label="อนุมัติ"
              value={summary.approved}
              tone="green"
            />
            <RefundStat
              icon={Landmark}
              label="โอนคืนแล้ว"
              value={summary.processed}
              tone="blue"
            />
          </section>
        ) : null}

        {state.status === 'loading' || isLoading ? (
          <div className="skeleton mt-7 h-56 rounded-3xl" />
        ) : error ? (
          <section className="sl-surface mt-7 p-6">
            <p role="alert" className="text-danger">
              {error}
            </p>
          </section>
        ) : (
          <div className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="grid gap-4" aria-label="รายการคำขอคืนเงิน">
              {refunds.length === 0 ? (
                <div className="sl-surface grid min-h-[390px] place-items-center p-6 text-center sm:p-8">
                  <div>
                    <span className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-violet-tint text-violet">
                      <RotateCcw className="h-11 w-11" aria-hidden />
                    </span>
                    <h2 className="mt-5 text-2xl font-black">
                      ยังไม่มีคำขอคืนเงิน
                    </h2>
                    <p className="mx-auto mt-2 max-w-lg leading-7 text-muted">
                      หากการจองที่เคยยืนยันถูกยกเลิก
                      คุณสามารถยื่นคำขอจากหน้ารายละเอียดการจองได้
                    </p>
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => setRequestOpen(true)}
                        className="sl-action-primary"
                      >
                        ขอคืนเงิน
                      </button>
                      <button
                        type="button"
                        onClick={() => setTermsOpen(true)}
                        className="sl-action-secondary text-violet"
                      >
                        เงื่อนไขการคืนเงิน
                      </button>
                      <Link
                        href="/bookings"
                        className="sl-action-secondary text-violet"
                      >
                        ดูการจองของฉัน
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                refunds.map((refund) => (
                  <article
                    id={`refund-${refund.id}`}
                    key={refund.id}
                    className="sl-surface scroll-mt-24 p-5 sm:p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-muted">
                          คำร้อง {refund.id}
                        </p>
                        <h2 className="mt-2 text-xl font-black">
                          {formatMoney(refund.requestedAmount)} บาท
                        </h2>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1.5 text-sm font-bold ${statusTones[refund.status]}`}
                      >
                        {statusLabels[refund.status]}
                      </span>
                    </div>
                    <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="font-bold text-muted">เหตุผล</dt>
                        <dd className="mt-1">{refund.reason}</dd>
                      </div>
                      <div>
                        <dt className="font-bold text-muted">
                          หมายเลข PromptPay
                        </dt>
                        <dd className="mt-1 font-semibold tracking-[.08em]">
                          {maskPromptPayId(refund.payoutPromptPayId)}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-bold text-muted">ยอดที่อนุมัติ</dt>
                        <dd className="mt-1">
                          {refund.approvedAmount === null
                            ? 'รอผลการตรวจสอบ'
                            : `${formatMoney(refund.approvedAmount)} บาท`}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-bold text-muted">วันที่ยื่น</dt>
                        <dd className="mt-1">
                          {dateFormatter.format(new Date(refund.createdAt))}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Link
                        href={`/bookings/${encodeURIComponent(refund.bookingId)}`}
                        className="sl-action-secondary text-violet"
                      >
                        เปิดรายละเอียดการจอง
                      </Link>
                      {refund.status === 'PROCESSED' && refund.hasPayoutSlip ? (
                        <button
                          type="button"
                          disabled={openingRefundId === refund.id}
                          onClick={() => void openPayoutSlip(refund.id)}
                          className="sl-action-primary disabled:opacity-50"
                        >
                          {openingRefundId === refund.id
                            ? 'กำลังเปิดสลิป...'
                            : 'ดูสลิปการคืนเงิน'}
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))
              )}
            </section>

            <aside className="grid gap-4">
              <section className="sl-surface p-5 sm:p-6">
                <h2 className="flex items-center gap-2 text-xl font-black">
                  <ReceiptText className="h-5 w-5 text-violet" aria-hidden />
                  ขั้นตอนการคืนเงิน
                </h2>
                <ol className="mt-5 grid gap-4">
                  {[
                    ['1', 'ยื่นคำขอ', 'เลือกการจองที่เข้าเงื่อนไขและระบุ PromptPay'],
                    ['2', 'ทีมงานตรวจสอบ', 'ตรวจสอบเงื่อนไขและแจ้งผลในระบบ'],
                    ['3', 'รับเงินคืน', 'เมื่ออนุมัติ ระบบจะแจ้งสถานะการโอนคืน'],
                  ].map(([step, title, detail]) => (
                    <li key={step} className="flex gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-tint text-sm font-black text-violet">
                        {step}
                      </span>
                      <div>
                        <strong>{title}</strong>
                        <p className="mt-1 text-sm leading-6 text-muted">
                          {detail}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
              <section className="sl-surface p-5 sm:p-6">
                <h2 className="flex items-center gap-2 text-lg font-black">
                  <CircleHelp className="h-5 w-5 text-violet" aria-hidden />
                  สิ่งที่ควรรู้
                </h2>
                <ul className="mt-4 grid gap-3 text-sm leading-6 text-muted">
                  <li>• คืนเงินเฉพาะรายการที่เข้าเงื่อนไข</li>
                  <li>
                    • สถานะคำขอ: รอตรวจสอบ / อนุมัติ / ปฏิเสธ / โอนคืนแล้ว
                  </li>
                  <li>• เลขพร้อมเพย์จะแสดงแบบปกปิดบางส่วน</li>
                </ul>
              </section>
            </aside>
          </div>
        )}
      </div>

      {requestOpen && state.status === 'ready' ? (
        <RefundRequestDialog
          bookings={refundCandidates}
          token={state.token}
          isPreview={canUseUxPreview()}
          onClose={() => setRequestOpen(false)}
          onBookingsCancelled={(cancelledBookings) => {
            const cancelledById = new Map(
              cancelledBookings.map((booking) => [booking.id, booking]),
            );
            setBookings((current) =>
              current.map(
                (booking) => cancelledById.get(booking.id) ?? booking,
              ),
            );
          }}
          onCreated={(created) => {
            const createdIds = new Set(created.map(({ id }) => id));
            setRefunds((current) => [
              ...created,
              ...current.filter((item) => !createdIds.has(item.id)),
            ]);
            setRequestOpen(false);
            setCreatedRefunds(created);
          }}
        />
      ) : null}

      {termsOpen ? (
        <RefundTermsDialog onClose={() => setTermsOpen(false)} />
      ) : null}

      {createdRefunds ? (
        <RefundSuccessDialog
          refunds={createdRefunds}
          onClose={() => setCreatedRefunds(null)}
        />
      ) : null}
    </main>
  );
}

function RefundStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: 'violet' | 'amber' | 'green' | 'blue';
}) {
  const tones = {
    violet: 'bg-violet-tint text-violet',
    amber: 'bg-[#fff3d9] text-[#b86c00]',
    green: 'bg-[#e8f8f0] text-[#16855f]',
    blue: 'bg-[#edf3ff] text-[#4263d9]',
  } as const;

  return (
    <article className="sl-soft-surface flex min-w-0 items-center gap-4 p-4 sm:p-5">
      <span
        className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${tones[tone]}`}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div>
        <p className="text-sm font-bold text-muted">{label}</p>
        <strong className="mt-1 block text-3xl font-black text-violet">
          {value}
        </strong>
      </div>
    </article>
  );
}

function RefundRequestDialog({
  bookings,
  token,
  isPreview,
  onClose,
  onBookingsCancelled,
  onCreated,
}: {
  bookings: MyBooking[];
  token: string;
  isPreview: boolean;
  onClose: () => void;
  onBookingsCancelled: (bookings: MyBooking[]) => void;
  onCreated: (refunds: RefundRequest[]) => void;
}) {
  const [workingBookings, setWorkingBookings] = useState(bookings);
  const [selectedBookingIds, setSelectedBookingIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      bookings.map((booking) => [booking.id, booking.boothPrice]),
    ),
  );
  const [reason, setReason] = useState('');
  const [payoutPromptPayId, setPayoutPromptPayId] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const selectedBookings = workingBookings.filter((booking) =>
    selectedBookingIds.has(booking.id),
  );
  const bookingsToCancel = selectedBookings.filter(
    (booking) => booking.status === 'CONFIRMED',
  );
  const totalAmount = sumRefundAmounts(
    selectedBookings.map((booking) => amounts[booking.id] ?? ''),
  );
  const missingPayerNameBooking = selectedBookings.find(
    (booking) => !booking.refundPayoutAccountName?.trim(),
  );
  const allSelected =
    workingBookings.length > 0 &&
    selectedBookingIds.size === workingBookings.length;

  function toggleBooking(bookingId: string) {
    setSelectedBookingIds((current) => {
      const next = new Set(current);
      if (next.has(bookingId)) next.delete(bookingId);
      else next.add(bookingId);
      return next;
    });
    setSubmitError('');
    setConfirmationOpen(false);
  }

  function validateSubmission(): string | null {
    const trimmedReason = reason.trim();
    const normalizedPromptPayId = payoutPromptPayId.trim();

    if (selectedBookings.length === 0) {
      return 'กรุณาเลือกอย่างน้อย 1 บูธที่ต้องการขอคืนเงิน';
    }
    if (missingPayerNameBooking) {
      return `ไม่พบชื่อผู้โอนสำหรับ Booth ${missingPayerNameBooking.booth.code} กรุณาติดต่อผู้จัดงานหรือฝ่ายสนับสนุน`;
    }
    const invalidBooking = selectedBookings.find((booking) =>
      !isValidRefundAmount(
        (amounts[booking.id] ?? '').trim(),
        booking.boothPrice,
      ),
    );
    if (invalidBooking) {
      return `ยอดคืน Booth ${invalidBooking.booth.code} ต้องมากกว่า 0 และไม่เกินราคาบูธ`;
    }
    if (!trimmedReason) {
      return 'กรุณาระบุเหตุผลที่ขอคืนเงิน';
    }
    if (!/^(\d{10}|\d{13}|\d{15})$/.test(normalizedPromptPayId)) {
      return 'PromptPay ต้องเป็นเบอร์โทร 10 หลัก หรือเลขประจำตัว 13/15 หลัก';
    }
    return null;
  }

  async function submitRequest(allowCancellation: boolean) {
    const validationError = validateSubmission();
    if (validationError) {
      setSubmitError(validationError);
      setConfirmationOpen(false);
      return;
    }
    if (bookingsToCancel.length > 0 && !allowCancellation) {
      setSubmitError('');
      setConfirmationOpen(true);
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    setConfirmationOpen(false);
    try {
      if (isPreview) {
        setSubmitError('โหมดตัวอย่างไม่ส่งคำร้องเข้าสู่ระบบจริง');
        return;
      }
      const cancelledBookings: MyBooking[] = [];
      for (const booking of bookingsToCancel) {
        setProgressMessage(`กำลังยกเลิก Booth ${booking.booth.code}…`);
        try {
          const cancelled = await cancelBooking(booking.id, reason, token);
          cancelledBookings.push({ ...booking, ...cancelled });
        } catch (cause) {
          if (cancelledBookings.length > 0) {
            const cancelledById = new Map(
              cancelledBookings.map((item) => [item.id, item]),
            );
            setWorkingBookings((current) =>
              current.map((item) => cancelledById.get(item.id) ?? item),
            );
            onBookingsCancelled(cancelledBookings);
          }
          const message =
            cause instanceof Error
              ? cause.message
              : 'สถานะการจองเปลี่ยนไป กรุณาลองใหม่';
          setSubmitError(
            `ยกเลิก Booth ${booking.booth.code} ไม่สำเร็จ: ${message}`,
          );
          return;
        }
      }
      if (cancelledBookings.length > 0) {
        const cancelledById = new Map(
          cancelledBookings.map((booking) => [booking.id, booking]),
        );
        setWorkingBookings((current) =>
          current.map((booking) => cancelledById.get(booking.id) ?? booking),
        );
        onBookingsCancelled(cancelledBookings);
      }

      setProgressMessage('กำลังส่งคำร้องคืนเงิน…');
      const trimmedReason = reason.trim();
      const normalizedPromptPayId = payoutPromptPayId.trim();
      const input: CreateBatchRefundRequestsInput = {
        items: selectedBookings.map((booking) => ({
          bookingId: booking.id,
          requestedAmount: (amounts[booking.id] ?? '').trim(),
        })),
        payoutMethod: 'PROMPTPAY',
        payoutPromptPayId: normalizedPromptPayId,
        reason: trimmedReason,
      };
      onCreated(await createBatchRefundRequests(input, token));
    } catch (cause) {
      setSubmitError(
        cause instanceof Error ? cause.message : 'ส่งคำร้องคืนเงินไม่สำเร็จ',
      );
    } finally {
      setIsSubmitting(false);
      setProgressMessage('');
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitRequest(false);
  }

  return (
    <RefundDialogFrame title="ขอคืนเงิน" onClose={onClose}>
      {bookings.length === 0 ? (
        <div className="py-8 text-center">
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-violet-tint text-violet">
            <RotateCcw className="h-9 w-9" aria-hidden />
          </span>
          <h3 className="mt-5 text-xl font-black">
            ยังไม่มีการจองที่ยกเลิกหรือขอคืนเงินได้
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
            รายการต้องชำระเงินและยืนยันแล้ว ยังอยู่ในช่วงยกเลิก
            หรือยกเลิกไว้แล้ว และยังไม่มีคำขอคืนเงินเดิม
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="sl-action-secondary"
            >
              ปิด
            </button>
            <Link
              href="/bookings"
              className="sl-action-primary"
            >
              ดูการจองของฉัน
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-black">เลือกบูธที่ต้องการขอคืนเงิน</h3>
              <p className="mt-1 text-sm text-muted">
                แต่ละบูธจะสร้างคำร้องแยกกันและติดตามสถานะได้รายบูธ
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setSelectedBookingIds(
                  allSelected
                    ? new Set()
                    : new Set(workingBookings.map(({ id }) => id)),
                )
              }
              className="sl-action-secondary text-violet"
            >
              {allSelected ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
            </button>
          </div>

          <div className="mt-4 grid max-h-[310px] gap-3 overflow-y-auto pr-1">
            {workingBookings.map((booking) => {
              const selected = selectedBookingIds.has(booking.id);
              const needsCancellation = booking.status === 'CONFIRMED';
              return (
                <div
                  key={booking.id}
                  className={`rounded-2xl border p-4 transition ${
                    selected
                      ? 'border-violet bg-violet/5'
                      : 'border-line bg-white'
                  }`}
                >
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleBooking(booking.id)}
                      className="mt-1 h-5 w-5 accent-violet"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-black">
                          Booth {booking.booth.code} · Zone{' '}
                          {booking.booth.zone.name ?? booking.booth.zone.code}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                            needsCancellation
                              ? 'bg-[#fff3d9] text-[#895b08]'
                              : 'bg-[#e8f8ef] text-[#176c50]'
                          }`}
                        >
                          {needsCancellation
                            ? 'ยกเลิกก่อนคืนเงิน'
                            : 'พร้อมขอคืนเงิน'}
                        </span>
                      </span>
                      <span className="mt-1 block text-sm text-muted">
                        {booking.event.name} · {booking.bookingCode}
                      </span>
                    </span>
                    <strong className="shrink-0 text-violet">
                      {formatMoney(booking.boothPrice)} บาท
                    </strong>
                  </label>
                  {selected ? (
                    <label className="mt-3 grid gap-1.5 border-t border-line pt-3 text-sm font-bold">
                      ยอดที่ขอคืนสำหรับ Booth {booking.booth.code}
                      <input
                        value={amounts[booking.id] ?? ''}
                        onChange={(event) =>
                          setAmounts((current) => ({
                            ...current,
                            [booking.id]: event.target.value,
                          }))
                        }
                        inputMode="decimal"
                        required
                        className="rounded-xl border border-line bg-white px-4 py-3 font-normal outline-none focus:border-violet"
                      />
                    </label>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#f8f3ff] px-4 py-4">
            <span className="text-sm text-muted">
              เลือกแล้ว <strong>{selectedBookings.length}</strong> บูธ
            </span>
            <strong className="text-xl font-black text-violet">
              รวม {totalAmount ? formatMoney(totalAmount) : '—'} บาท
            </strong>
          </div>

          {bookingsToCancel.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-[#f2d39b] bg-[#fff8e8] px-4 py-3 text-sm leading-6 text-[#79500a]">
              เลือกแล้ว {bookingsToCancel.length} บูธที่ยังยืนยันอยู่
              ระบบจะขอให้คุณยืนยันการยกเลิกเฉพาะบูธเหล่านี้ก่อนส่งคำขอคืนเงิน
            </div>
          ) : null}

          <div className="mt-4 grid gap-4">
            <label className="grid gap-1.5 text-sm font-bold">
              เหตุผล
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                maxLength={1000}
                required
                className="rounded-xl border border-line px-4 py-3 font-normal outline-none focus:border-violet"
              />
            </label>
            <div className="rounded-xl border border-violet/20 bg-violet/5 px-4 py-3 text-sm">
              ช่องทางรับเงิน: <strong>PromptPay เท่านั้น</strong>
            </div>
            <div className="grid gap-2 text-sm">
              <strong>ชื่อผู้รับเงินจากสลิป</strong>
              {selectedBookings.length > 0 ? (
                <div className="grid gap-2 rounded-xl border border-line bg-[#f7f5f9] p-3">
                  {selectedBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="flex flex-wrap justify-between gap-2"
                    >
                      <span className="text-muted">
                        Booth {booking.booth.code}
                      </span>
                      <strong>
                        {booking.refundPayoutAccountName?.trim() || 'ไม่พบชื่อผู้โอน'}
                      </strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-line bg-[#f7f5f9] px-4 py-3 text-muted">
                  เลือกบูธเพื่อดูชื่อผู้รับเงิน
                </p>
              )}
              <p className="text-xs leading-5 text-muted">
                ระบบกำหนดชื่อแต่ละรายการจากสลิปชำระเงินและไม่อนุญาตให้แก้ไข
              </p>
            </div>
            {missingPayerNameBooking ? (
              <p role="alert" className="text-sm font-semibold text-danger">
                ไม่พบชื่อผู้โอนสำหรับ Booth{' '}
                {missingPayerNameBooking.booth.code} กรุณาติดต่อผู้จัดงานหรือฝ่ายสนับสนุน
              </p>
            ) : null}
            <label className="grid gap-1.5 text-sm font-bold">
              หมายเลข PromptPay
              <input
                value={payoutPromptPayId}
                onChange={(event) => setPayoutPromptPayId(event.target.value)}
                inputMode="numeric"
                placeholder="เบอร์โทร หรือเลขประจำตัว"
                required
                className="rounded-xl border border-line px-4 py-3 font-normal outline-none focus:border-violet"
              />
            </label>
            {progressMessage ? (
              <p role="status" className="text-sm font-semibold text-violet">
                {progressMessage}
              </p>
            ) : null}
            {submitError ? (
              <p role="alert" className="text-sm font-semibold text-danger">
                {submitError}
              </p>
            ) : null}
            {confirmationOpen ? (
              <div
                role="alert"
                className="rounded-2xl border border-danger/30 bg-[#fff4f4] p-4"
              >
                <h4 className="font-black text-danger">
                  ยืนยันยกเลิก {bookingsToCancel.length} บูธ
                </h4>
                <p className="mt-1 text-sm leading-6 text-muted">
                  การยกเลิกย้อนกลับไม่ได้ เมื่อยกเลิกสำเร็จระบบจะส่งคำขอคืนเงินต่อทันที
                </p>
                <ul className="mt-2 grid gap-1 text-sm font-semibold">
                  {bookingsToCancel.map((booking) => (
                    <li key={booking.id}>
                      • {booking.event.name} · Booth {booking.booth.code}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setConfirmationOpen(false)}
                    className="sl-action-secondary"
                  >
                    กลับไปตรวจสอบ
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitRequest(true)}
                    className="rounded-xl bg-danger px-4 py-3 font-bold text-white"
                  >
                    ยืนยันยกเลิกและขอคืนเงิน
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  selectedBookings.length === 0 ||
                  Boolean(missingPayerNameBooking)
                }
                className="sl-action-primary w-full disabled:opacity-50"
              >
                {isSubmitting
                  ? 'กำลังดำเนินการ…'
                  : bookingsToCancel.length > 0
                    ? `ยกเลิกบูธและขอคืนเงิน ${selectedBookings.length} บูธ`
                    : `ส่งคำร้องคืนเงิน ${selectedBookings.length} บูธ`}
              </button>
            )}
          </div>
        </form>
      )}
    </RefundDialogFrame>
  );
}

function RefundTermsDialog({ onClose }: { onClose: () => void }) {
  return (
    <RefundDialogFrame title="เงื่อนไขการคืนเงิน" onClose={onClose}>
      <div className="rounded-2xl bg-[#f8f3ff] p-5">
        <h3 className="font-black">รายการที่ยื่นคำขอได้</h3>
        <ul className="mt-3 grid gap-3 text-sm leading-6 text-muted">
          <li>• เป็นการจองที่เคยได้รับการยืนยันและมีการชำระเงินแล้ว</li>
          <li>
            • หากยังยืนยันอยู่ ต้องอยู่ในช่วงยกเลิก
            และคุณต้องยืนยันยกเลิกบูธก่อนส่งคำขอ
          </li>
          <li>• การยกเลิกบูธย้อนกลับไม่ได้ และต้องยังไม่มีคำขอคืนเงินเดิม</li>
          <li>• ยอดที่ขอคืนต้องมากกว่า 0 และไม่เกินราคาบูธที่ชำระ</li>
          <li>• รับเงินคืนผ่านหมายเลข PromptPay ที่ระบุเท่านั้น</li>
        </ul>
      </div>
      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-line p-4 text-sm leading-6 text-muted">
        <CircleHelp className="mt-0.5 h-5 w-5 shrink-0 text-violet" aria-hidden />
        <p>
          ทีมงานจะแจ้งผลผ่านระบบ เมื่ออนุมัติแล้วสถานะจะเปลี่ยนเป็น
          “โอนคืนแล้ว” หลังดำเนินการสำเร็จ
        </p>
      </div>
      <div className="mt-5 flex justify-end">
        <button type="button" onClick={onClose} className="sl-action-primary">
          รับทราบ
        </button>
      </div>
    </RefundDialogFrame>
  );
}

function RefundSuccessDialog({
  refunds,
  onClose,
}: {
  refunds: RefundRequest[];
  onClose: () => void;
}) {
  const total = sumRefundAmounts(
    refunds.map(({ requestedAmount }) => requestedAmount),
  );
  return (
    <RefundDialogFrame title="ส่งคำขอคืนเงินสำเร็จ" onClose={onClose}>
      <div className="py-5 text-center">
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#e8f8ef] text-[#19975a]">
          <Check className="h-10 w-10" aria-hidden />
        </span>
        <h3 className="mt-5 text-2xl font-black">รับคำขอของคุณแล้ว</h3>
        <p className="mt-2 text-sm text-muted">
          สร้างคำร้องแยกรายบูธแล้ว {refunds.length} รายการ
        </p>
        <ul className="mx-auto mt-3 max-w-md text-left text-sm text-muted">
          {refunds.map((refund) => (
            <li key={refund.id} className="mt-1 truncate">
              • หมายเลข {refund.id}
            </li>
          ))}
        </ul>
        <p className="mt-3 font-bold">
          ยอดที่ขอคืนรวม {total ? formatMoney(total) : '—'} บาท ·{' '}
          {statusLabels[refunds[0]?.status ?? 'PENDING']}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="sl-action-primary mt-7"
        >
          ติดตามคำขอคืนเงิน
        </button>
      </div>
    </RefundDialogFrame>
  );
}

function RefundDialogFrame({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input, textarea, select',
        ),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previousFocusRef.current?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-[#201b2e]/65 px-3 pb-3 pt-20 backdrop-blur-[2px] sm:px-5 sm:pb-5 sm:pt-24"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="refund-dialog-title"
        className="flex max-h-[calc(100vh-5.75rem)] w-full max-w-xl flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl sm:max-h-[calc(100vh-7.25rem)]"
      >
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <h2 id="refund-dialog-title" className="text-xl font-black">
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line text-muted transition hover:bg-mist hover:text-ink"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {children}
        </div>
      </section>
    </div>
  );
}

function RefundPageMessage({
  title,
  detail,
  href = '/login',
  action = 'เข้าสู่ระบบ',
}: {
  title: string;
  detail: string;
  href?: string;
  action?: string;
}) {
  return (
    <main>
      <div className="shell py-20 text-center">
        <h1 className="text-2xl font-black">{title}</h1>
        <p className="mt-3 text-muted">{detail}</p>
        <Link href={href} className="sl-action-primary mt-7">
          {action}
        </Link>
      </div>
    </main>
  );
}
