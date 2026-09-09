'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { QrCode, ShieldCheck } from 'lucide-react';
import { BookingCountdown } from '@/components/booking-countdown';
import {
  BookingPageLoading,
  BookingPageMessage,
  formatBookingMoney,
} from '@/components/booking-detail-screen';
import { PaymentGroupSlipUploadPanel } from '@/components/slip-upload-panel';
import { getPaymentGroup, type PaymentGroupRecord } from '@/lib/api';
import { useVendorProfile } from '@/lib/use-vendor-profile';

type GroupState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'error'; message: string }
  | { status: 'ready'; group: PaymentGroupRecord; token: string };

export function BookingPaymentGroupScreen({
  paymentGroupId,
}: {
  paymentGroupId: string;
}) {
  const { state: vendor } = useVendorProfile();
  const [group, setGroup] = useState<PaymentGroupRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const [holdExpired, setHoldExpired] = useState(false);

  useEffect(() => {
    if (vendor.status !== 'ready') return;
    const controller = new AbortController();
    setError(null);

    getPaymentGroup(paymentGroupId, vendor.token, controller.signal)
      .then((response) => {
        setGroup(response);
        setHoldExpired(false);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(
          cause instanceof Error
            ? cause.message
            : 'โหลดรายการชำระเงินรวมไม่สำเร็จ',
        );
      });

    return () => controller.abort();
  }, [paymentGroupId, reloadCount, vendor]);

  let state: GroupState;
  if (vendor.status === 'signed-out') state = { status: 'signed-out' };
  else if (vendor.status === 'error') {
    state = { status: 'error', message: vendor.message };
  } else if (vendor.status === 'loading' || (!group && !error)) {
    state = { status: 'loading' };
  } else if (error || !group) {
    state = {
      status: 'error',
      message: error ?? 'ไม่พบรายการชำระเงินรวม',
    };
  } else {
    state = { status: 'ready', group, token: vendor.token };
  }

  if (state.status === 'loading') return <BookingPageLoading />;
  if (state.status === 'signed-out') {
    return (
      <BookingPageMessage
        title="กรุณาเข้าสู่ระบบก่อน"
        detail="หน้าชำระเงินรวมเปิดได้เฉพาะเจ้าของรายการจอง"
        href="/login"
        action="เข้าสู่ระบบ"
      />
    );
  }
  if (state.status === 'error') {
    return (
      <BookingPageMessage
        title="เปิดหน้าชำระเงินรวมไม่ได้"
        detail={state.message}
        href="/bookings"
        action="กลับการจองของฉัน"
      />
    );
  }

  const currentGroup = state.group;
  if (currentGroup.status === 'CONFIRMED') {
    return (
      <BookingPageMessage
        title="ยืนยันการจองทั้งหมดเรียบร้อยแล้ว"
        detail={`ระบบบันทึกการชำระเงิน ${currentGroup.paymentCode} ครบ ${currentGroup.bookings.length} รายการแล้ว`}
        href="/bookings"
        action="ดูการจองของฉัน"
      />
    );
  }
  if (currentGroup.status !== 'PENDING_PAYMENT') {
    return (
      <BookingPageMessage
        title="รายการชำระเงินนี้ถูกยกเลิกแล้ว"
        detail={`รหัสชำระเงิน ${currentGroup.paymentCode} ไม่สามารถแนบสลิปได้`}
        href="/bookings"
        action="กลับการจองของฉัน"
      />
    );
  }

  const expired =
    holdExpired ||
    !currentGroup.holdExpiresAt ||
    new Date(currentGroup.holdExpiresAt).getTime() <= Date.now();

  return (
    <main className="sl-page pb-16">
      <div className="shell max-w-[1180px] py-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/bookings" className="sl-chip min-h-9 px-3 text-sm">
            ← กลับการจองของฉัน
          </Link>
          <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-[#d8caeb] bg-white px-3 text-xs font-extrabold tracking-[.1em] text-violet">
            <ShieldCheck size={13} aria-hidden /> GROUP PAYMENT
          </span>
        </div>

        <header className="mt-4 flex items-end justify-between gap-5 max-sm:flex-col max-sm:items-start">
          <div>
            <span className="sl-kicker">PAYMENT GROUP</span>
            <h1 className="mt-1 text-[30px] font-black tracking-[-0.045em] max-sm:text-2xl">
              ชำระค่าจองหลายบูธพร้อมกัน
            </h1>
            <p className="mt-1 text-sm text-muted">
              โอนยอดรวมและแนบสลิปหนึ่งครั้งเพื่อยืนยันทุก Booking ในกลุ่ม
            </p>
          </div>
          <div
            className={`min-w-[150px] rounded-[14px] border px-4 py-3 text-center ${
              expired
                ? 'border-[#fac5bf] bg-[#fff0ee] text-[#b42318]'
                : 'border-[#d8caeb] bg-white text-violet'
            }`}
          >
            <span className="block text-xs font-bold text-muted">เวลาที่เหลือ</span>
            <strong className="mt-1 block text-lg font-black">
              <BookingCountdown
                expiresAt={currentGroup.holdExpiresAt}
                active
                onExpired={() => setHoldExpired(true)}
              />
            </strong>
            <small className="mt-0.5 block text-xs opacity-70">Hold ทั้งกลุ่ม</small>
          </div>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            ['รหัสชำระเงิน', currentGroup.paymentCode],
            ['จำนวน Booking', `${currentGroup.bookings.length} รายการ`],
            ['ยอดชำระรวม', `${formatBookingMoney(currentGroup.totalAmount)} บาท`],
            ['สถานะ', 'รอชำระเงิน'],
          ].map(([label, value]) => (
            <article key={label} className="rounded-[14px] border border-line bg-white p-3">
              <span className="text-xs text-muted">{label}</span>
              <strong className="mt-1 block truncate text-base font-black" title={value}>
                {value}
              </strong>
            </article>
          ))}
        </section>

        <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="grid gap-4">
            <article className="sl-surface p-5">
              <h2 className="text-lg font-black">รายการจองในกลุ่ม</h2>
              <div className="mt-4 grid gap-2">
                {currentGroup.bookings.map((booking, index) => (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between gap-4 rounded-xl bg-[#faf8ff] px-4 py-3 text-sm"
                  >
                    <div>
                      <span className="text-xs text-muted">Booking {index + 1}</span>
                      <strong className="block">{booking.bookingCode}</strong>
                    </div>
                    <strong className="text-violet">
                      {formatBookingMoney(booking.boothPrice)} บาท
                    </strong>
                  </div>
                ))}
              </div>
            </article>

            {expired ? (
              <section className="rounded-[14px] border border-[#fac5bf] bg-[#fff0ee] p-4 text-sm font-bold text-[#b42318]">
                หมดเวลาชำระเงินแล้ว กลุ่มการจองนี้ไม่สามารถอัปโหลดสลิปได้
              </section>
            ) : currentGroup.paymentQrDataUri ? (
              <PaymentGroupSlipUploadPanel
                paymentGroupId={currentGroup.id}
                token={state.token}
                onConfirmed={() => setReloadCount((value) => value + 1)}
              />
            ) : null}
          </section>

          <aside className="grid gap-4 lg:sticky lg:top-[92px]">
            <article className="sl-surface p-5 text-center">
              <span className="sl-kicker">PROMPTPAY QR</span>
              <div className="mt-4">
                {currentGroup.paymentQrDataUri ? (
                  <Image
                    src={currentGroup.paymentQrDataUri}
                    alt="QR PromptPay สำหรับชำระค่าจองทั้งกลุ่ม"
                    width={240}
                    height={240}
                    unoptimized
                    className="mx-auto h-[220px] w-[220px] rounded-[14px] border-8 border-white bg-white shadow"
                  />
                ) : (
                  <div className="rounded-xl border border-[#f0d9a4] bg-[#fff9e8] p-4 text-left text-sm text-[#7a5700]">
                    <QrCode className="mb-2 h-6 w-6" aria-hidden />
                    ผู้จัดงานยังไม่ได้ตั้งค่า PromptPay กรุณาอย่าโอนเงินจากข้อมูลอื่นนอกระบบ
                  </div>
                )}
              </div>
              <p className="mt-3 text-sm text-muted">ยอดที่กำหนดใน QR</p>
              <strong className="mt-1 block text-2xl font-black text-violet">
                {formatBookingMoney(currentGroup.totalAmount)} บาท
              </strong>
            </article>

            <article className="sl-surface border-[#f0d9a4] bg-[#fffaf0] p-4 text-sm leading-6 text-[#7a5700]">
              ต้องชำระยอดรวมเต็มจำนวนและใช้สลิปเดียว ระบบจะยืนยันหรือยกเลิกทุก Booking ในกลุ่มพร้อมกัน
            </article>
          </aside>
        </div>
      </div>
    </main>
  );
}
