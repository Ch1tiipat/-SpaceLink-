'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  CircleHelp,
  Clock3,
  Landmark,
  Plus,
  ReceiptText,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react';
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
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="sl-kicker">
              <ReceiptText className="h-4 w-4" aria-hidden /> My refunds
            </span>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
              คำขอคืนเงินของฉัน
            </h1>
            <p className="mt-2 text-muted">
              ติดตามสถานะคำขอและยอดเงินคืนจากการจองที่ยกเลิก
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/bookings?tab=cancelled"
              className="sl-action-primary inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" aria-hidden />
              ขอคืนเงิน
            </Link>
            <Link
              href="/bookings"
              className="sl-action-secondary inline-flex items-center gap-2 text-violet"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              กลับการจองของฉัน
            </Link>
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
                <div className="sl-surface grid min-h-[390px] place-items-center p-8 text-center">
                  <div>
                    <span className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-violet-tint text-violet">
                      <RotateCcw className="h-11 w-11" aria-hidden />
                    </span>
                    <h2 className="mt-5 text-2xl font-black">
                      ยังไม่มีคำขอคืนเงิน
                    </h2>
                    <p className="mx-auto mt-2 max-w-lg leading-7 text-muted">
                      หากการจองที่เคยชำระเงินถูกยกเลิก
                      คุณสามารถยื่นคำขอจากหน้ารายละเอียดการจองได้
                    </p>
                    <Link
                      href="/bookings?tab=cancelled"
                      className="sl-action-primary mt-6"
                    >
                      ดูการจองที่ยกเลิก
                    </Link>
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
                        <dd className="mt-1">
                          {refund.payoutPromptPayId ??
                            'ไม่มีหมายเลข PromptPay (คำร้องเดิม)'}
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
                  <li>• ระยะเวลาตรวจสอบประมาณ 3–7 วันทำการ</li>
                  <li>• รับเงินคืนผ่านหมายเลข PromptPay ที่ระบุ</li>
                </ul>
              </section>
            </aside>
          </div>
        )}
      </div>
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
