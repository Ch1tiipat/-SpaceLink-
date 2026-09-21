'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  createRefundRequest,
  getMyRefunds,
  type CreateRefundRequestInput,
  type MyBooking,
  type RefundRequest,
} from '@/lib/api';
import {
  canRequestRefund,
  isValidRefundAmount,
} from '@/lib/refund-request-policy';

const statusLabels: Record<RefundRequest['status'], string> = {
  PENDING: 'รอตรวจสอบ',
  APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ไม่อนุมัติ',
  PROCESSED: 'คืนเงินแล้ว',
};

export function RefundRequestPanel({
  booking,
  token,
  isPreview,
  onCreated,
  embedded = false,
}: {
  booking: MyBooking;
  token: string;
  isPreview: boolean;
  onCreated?: (refund: RefundRequest) => void;
  embedded?: boolean;
}) {
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [reason, setReason] = useState('');
  const [requestedAmount, setRequestedAmount] = useState(booking.boothPrice);
  const [payoutAccountName, setPayoutAccountName] = useState('');
  const [payoutPromptPayId, setPayoutPromptPayId] = useState('');

  useEffect(() => {
    if (isPreview) {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setLoadError('');
    getMyRefunds(token, controller.signal)
      .then(setRefunds)
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setLoadError(
          cause instanceof Error
            ? cause.message
            : 'โหลดข้อมูลคำร้องคืนเงินไม่สำเร็จ',
        );
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [isPreview, token]);

  const existingRefund = refunds.find(
    (refund) => refund.bookingId === booking.id,
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedReason = reason.trim();
    const trimmedAccountName = payoutAccountName.trim();
    const trimmedAmount = requestedAmount.trim();

    if (!trimmedReason) {
      setSubmitError('กรุณาระบุเหตุผลที่ขอคืนเงิน');
      return;
    }
    if (!isValidRefundAmount(trimmedAmount, booking.boothPrice)) {
      setSubmitError('ยอดที่ขอคืนต้องมากกว่า 0 และไม่เกินราคาบูธ');
      return;
    }
    if (!trimmedAccountName) {
      setSubmitError('กรุณาระบุชื่อบัญชีผู้รับเงิน');
      return;
    }
    if (!/^(\d{10}|\d{13}|\d{15})$/.test(payoutPromptPayId)) {
      setSubmitError(
        'PromptPay ต้องเป็นเบอร์โทร 10 หลัก หรือเลขประจำตัว 13/15 หลัก',
      );
      return;
    }
    setIsSubmitting(true);
    setSubmitError('');
    try {
      if (isPreview) {
        setSubmitError('โหมดตัวอย่างไม่ส่งคำร้องเข้าสู่ระบบจริง');
        return;
      }
      const input: CreateRefundRequestInput = {
        payoutMethod: 'PROMPTPAY',
        payoutAccountName: trimmedAccountName,
        payoutPromptPayId,
        reason: trimmedReason,
        requestedAmount: trimmedAmount,
      };
      const created = await createRefundRequest(booking.id, input, token);
      setRefunds((current) => [created, ...current]);
      onCreated?.(created);
    } catch (cause) {
      setSubmitError(
        cause instanceof Error ? cause.message : 'ส่งคำร้องคืนเงินไม่สำเร็จ',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (booking.status !== 'CANCELLED') return null;

  return (
    <section className={embedded ? '' : 'sl-surface p-5'}>
      {!embedded ? <h2 className="font-black">ขอคืนเงิน</h2> : null}
      {isLoading ? (
        <p className="mt-2 text-sm text-muted">กำลังตรวจสอบคำร้องเดิม…</p>
      ) : loadError ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {loadError}
        </p>
      ) : existingRefund ? (
        <div className="mt-3 text-sm leading-6">
          <p>
            คำร้องนี้อยู่ในสถานะ{' '}
            <strong>{statusLabels[existingRefund.status]}</strong>
          </p>
          <Link
            href="/refunds"
            className="mt-3 inline-flex font-bold text-violet"
          >
            ดูรายละเอียดคำร้องคืนเงิน
          </Link>
        </div>
      ) : canRequestRefund(booking, refunds) ? (
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="mt-4 grid gap-4"
        >
          <label className="grid gap-1.5 text-sm font-bold">
            ยอดที่ขอคืน (บาท)
            <input
              value={requestedAmount}
              onChange={(event) => setRequestedAmount(event.target.value)}
              inputMode="decimal"
              required
              className="rounded-xl border border-line px-4 py-3 font-normal outline-none focus:border-violet"
            />
          </label>
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
          <label className="grid gap-1.5 text-sm font-bold">
            ชื่อบัญชีผู้รับเงิน
            <input
              value={payoutAccountName}
              onChange={(event) => setPayoutAccountName(event.target.value)}
              maxLength={200}
              required
              className="rounded-xl border border-line px-4 py-3 font-normal outline-none focus:border-violet"
            />
          </label>
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
          {submitError ? (
            <p role="alert" className="text-sm font-semibold text-danger">
              {submitError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="sl-action-primary w-full disabled:opacity-50"
          >
            {isSubmitting ? 'กำลังส่งคำร้อง…' : 'ส่งคำร้องคืนเงิน'}
          </button>
        </form>
      ) : (
        <p className="mt-2 text-sm leading-6 text-muted">
          รายการนี้ไม่เข้าเงื่อนไขการขอคืนเงินออนไลน์
        </p>
      )}
    </section>
  );
}
