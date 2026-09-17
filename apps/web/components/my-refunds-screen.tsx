'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ReceiptText } from 'lucide-react';
import {
  getMyRefunds,
  getRefundPayoutSlipAccess,
  type RefundRequest,
} from '@/lib/api';
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

export function MyRefundsScreen() {
  const { state } = useVendorProfile();
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [openingRefundId, setOpeningRefundId] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'ready') {
      setIsLoading(false);
      return;
    }
    if (canUseUxPreview()) {
      setRefunds([]);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setIsLoading(true);
    setError('');
    getMyRefunds(state.token, controller.signal)
      .then((items) => {
        if (active) setRefunds(items);
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
      <div className="shell py-8">
        <Link href="/bookings" className="sl-chip">
          ← กลับการจองของฉัน
        </Link>
        <span className="sl-kicker mt-6">
          <ReceiptText className="h-4 w-4" aria-hidden /> My refunds
        </span>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
          คำร้องคืนเงินของฉัน
        </h1>
        <p className="mt-2 text-muted">
          ติดตามยอดที่ขอคืน ผลการตรวจสอบ และสถานะการโอนเงิน
        </p>

        {state.status === 'loading' || isLoading ? (
          <div className="skeleton mt-7 h-56 rounded-3xl" />
        ) : error ? (
          <section className="sl-surface mt-7 p-6">
            <p role="alert" className="text-danger">
              {error}
            </p>
          </section>
        ) : refunds.length === 0 ? (
          <section className="sl-surface mt-7 p-8 text-center">
            <h2 className="text-xl font-black">ยังไม่มีคำร้องคืนเงิน</h2>
            <p className="mt-2 text-muted">
              เมื่อยกเลิกการจองที่ชำระเงินแล้ว คุณสามารถยื่นคำร้องจากหน้ารายละเอียดการจอง
            </p>
          </section>
        ) : (
          <section className="mt-7 grid gap-4">
            {refunds.map((refund) => (
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
                    <dt className="font-bold text-muted">ช่องทางรับเงิน</dt>
                    <dd className="mt-1">
                      {refund.payoutMethod === 'PROMPTPAY'
                        ? `PromptPay ${refund.payoutPromptPayId ?? '—'}`
                        : refund.payoutMethod === 'BANK_TRANSFER'
                          ? `${refund.payoutBankName ?? 'ธนาคาร'} · ${refund.payoutAccountNumber ?? '—'}`
                          : 'ไม่ระบุช่องทางรับเงิน (คำร้องเดิม)'}
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
            ))}
          </section>
        )}
      </div>
    </main>
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
