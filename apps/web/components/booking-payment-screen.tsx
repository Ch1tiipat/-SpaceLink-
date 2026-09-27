'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  FileText,
  LayoutGrid,
  Lightbulb,
  QrCode,
  ShieldCheck,
  Sparkles,
  Store,
  WalletCards,
} from 'lucide-react';
import { BookingCountdown } from '@/components/booking-countdown';
import { PreviewSlipUploadPanel } from '@/components/booking-screen';
import {
  BookingPageLoading,
  BookingPageMessage,
  formatBookingMoney,
  useBookingDetail,
} from '@/components/booking-detail-screen';
import { SlipUploadPanel } from '@/components/slip-upload-panel';

export function BookingPaymentScreen({ bookingId }: { bookingId: string }) {
  const state = useBookingDetail(bookingId);
  const [paymentSucceeded, setPaymentSucceeded] = useState(false);
  const [holdExpired, setHoldExpired] = useState(false);

  if (state.status === 'loading') return <BookingPageLoading />;
  if (state.status === 'signed-out')
    return (
      <BookingPageMessage
        title="กรุณาเข้าสู่ระบบก่อน"
        detail="หน้าชำระเงินเปิดได้เฉพาะเจ้าของการจอง"
        href="/login"
        action="เข้าสู่ระบบ"
      />
    );
  if (state.status === 'error')
    return (
      <BookingPageMessage
        title="เปิดหน้าชำระเงินไม่ได้"
        detail={state.message}
      />
    );

  const { booking } = state;
  if (booking.paymentGroupId) {
    return (
      <BookingPageMessage
        title="รายการนี้ต้องชำระพร้อมกันทั้งกลุ่ม"
        detail="ระบบรวมยอดของ Booking ชุดนี้ไว้ในรายการชำระเงินเดียว"
        href={`/bookings/payment-groups/${encodeURIComponent(booking.paymentGroupId)}/payment`}
        action="ไปหน้าชำระเงินรวม"
      />
    );
  }
  if (paymentSucceeded || booking.status === 'CONFIRMED') {
    const eventMapHref = `/events/${encodeURIComponent(booking.event.slug ?? booking.event.id)}/map`;

    return (
      <>
        <main
          className="sl-page min-h-[calc(100vh-72px)]"
          aria-hidden="true"
        >
          <div className="shell max-w-[1180px] py-6">
            <div className="h-56 rounded-[24px] border border-line bg-[radial-gradient(circle_at_top,#f0e8ff,white_68%)]" />
          </div>
        </main>
        <BookingPaymentSuccessDialog
          bookingCode={booking.bookingCode}
          eventMapHref={eventMapHref}
        />
      </>
    );
  }
  if (booking.status !== 'PENDING_PAYMENT') {
    return (
      <BookingPageMessage
        title="รายการนี้ไม่อยู่ระหว่างรอชำระเงิน"
        detail={`สถานะปัจจุบันของรหัส ${booking.bookingCode} ไม่รองรับการอัปโหลดสลิป`}
        href={`/bookings/${encodeURIComponent(booking.bookingCode)}`}
        action="ดูรายละเอียดการจอง"
      />
    );
  }

  const expired =
    holdExpired ||
    !booking.holdExpiresAt ||
    new Date(booking.holdExpiresAt).getTime() <= Date.now();
  const canUpload = state.isPreview || Boolean(booking.paymentQrDataUri);

  return (
    <main className="sl-page pb-16">
      <div className="shell max-w-[1180px] py-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/bookings" className="sl-chip min-h-9 px-3 text-sm">
            ← กลับการจองของฉัน
          </Link>
          <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-[#d8caeb] bg-white px-3 text-xs font-extrabold tracking-[.1em] text-violet">
            <ShieldCheck size={13} aria-hidden /> PAYMENT VERIFICATION
          </span>
        </div>

        <header className="mt-4">
          <span className="sl-kicker">PAYMENT</span>
          <h1 className="mt-1 text-[30px] font-black tracking-[-0.045em] max-sm:text-2xl">
            ชำระค่าจอง Booth
          </h1>
          <p className="mt-1 text-sm text-muted">
            กรุณาชำระเงินและอัปโหลดสลิปเพื่อยืนยันการจองของคุณ
          </p>
        </header>

        <section
          className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4"
          aria-label="สรุปสถานะการชำระเงิน"
        >
          <article className="flex min-h-[78px] items-center gap-3 rounded-[14px] border border-line bg-white p-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-violet-tint text-violet">
              <FileText className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <span className="text-xs text-muted">Booking ID</span>
              <strong className="block truncate text-base font-black" title={booking.bookingCode}>
                {booking.bookingCode}
              </strong>
            </div>
          </article>
          <article className="flex min-h-[78px] items-center gap-3 rounded-[14px] border border-line bg-white p-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-violet-tint text-violet">
              <Store className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <span className="text-xs text-muted">Booth</span>
              <strong className="block text-base font-black">{booking.booth.code}</strong>
            </div>
          </article>
          <article className="flex min-h-[78px] items-center gap-3 rounded-[14px] border border-line bg-white p-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-[#fff5df] text-[#d18400]">
              <WalletCards className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <span className="text-xs text-muted">ยอดชำระ</span>
              <strong className="block text-base font-black text-violet">
                {formatBookingMoney(booking.boothPrice)} บาท
              </strong>
            </div>
          </article>
          <article
            className={`flex min-h-[78px] items-center gap-3 rounded-[14px] border p-3 ${expired ? 'border-[#fac5bf] bg-[#fff0ee] text-[#b42318]' : 'border-line bg-white'}`}
          >
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[11px] ${expired ? 'bg-white/70' : 'bg-[#fff0f4] text-[#df365e]'}`}>
              <Clock3 className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <span className="text-xs text-muted">เวลาที่เหลือ</span>
              <strong className="block text-base font-black text-[#df365e]">
                <BookingCountdown
                  expiresAt={booking.holdExpiresAt}
                  active
                  onExpired={() => setHoldExpired(true)}
                />
              </strong>
            </div>
          </article>
        </section>

        <div className="mt-3 grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="grid gap-3">
            <article className="sl-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="sl-kicker">PAYMENT METHOD</span>
                  <h2 className="mt-1 text-lg font-black">เลือกวิธีชำระเงิน</h2>
                </div>
                <small className="text-xs text-muted">
                  ผู้รับเงิน: ผู้จัด Event
                </small>
              </div>
              <div className="mt-3 grid gap-2">
                <div className="flex min-h-[58px] items-center gap-3 rounded-[12px] border border-violet bg-violet-tint px-3 text-violet">
                  <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-white">
                    <QrCode size={18} aria-hidden />
                  </span>
                  <span>
                    <strong className="block text-sm">PromptPay QR</strong>
                    <small className="mt-0.5 block text-xs opacity-70">
                      สแกนผ่าน Mobile Banking
                    </small>
                  </span>
                  <b className="ml-auto text-sm">✓</b>
                </div>
              </div>

              <div className="mt-3 grid gap-3 rounded-[14px] bg-[#faf8ff] p-4 md:grid-cols-[260px_minmax(0,1fr)] md:items-center">
                <div className="text-center">
                  {booking.paymentQrDataUri ? (
                    <Image
                      src={booking.paymentQrDataUri}
                      alt="QR PromptPay สำหรับชำระค่าบูธ"
                      width={240}
                      height={240}
                      unoptimized
                      className="mx-auto h-[210px] w-[210px] rounded-[14px] border-8 border-white bg-white shadow"
                    />
                  ) : state.isPreview ? (
                    <span className="mx-auto grid h-[210px] w-[210px] place-items-center rounded-[14px] border-8 border-white bg-[repeating-conic-gradient(#201b2e_0_25%,#fff_0_50%)] bg-[length:16px_16px] shadow">
                      <span className="grid h-14 w-14 place-items-center rounded-xl bg-white text-violet">
                        <QrCode className="h-9 w-9" aria-hidden />
                      </span>
                    </span>
                  ) : (
                    <div className="rounded-[12px] border border-[#f0d9a4] bg-[#fff9e8] p-4 text-left text-sm leading-5 text-[#7a5700]">
                      ผู้จัดงานยังไม่ได้ตั้งค่าบัญชี PromptPay จึงยังไม่มี QR
                      รับเงินจริง กรุณาอย่าโอนเงินจากข้อมูลอื่นนอกระบบ
                    </div>
                  )}
                  <p className="mt-2 text-xs font-bold text-muted">
                    {state.isPreview
                      ? 'QR ตัวอย่างสำหรับตรวจ UX/UI เท่านั้น — ไม่รับเงินจริง'
                      : booking.paymentQrDataUri
                        ? 'QR ถูกกำหนดยอดตาม Booking นี้'
                        : 'รอข้อมูลรับชำระจากผู้จัดงาน'}
                  </p>
                </div>
                <div className="rounded-[12px] border border-line bg-white p-4">
                  <span className="text-xs font-extrabold tracking-[.1em] text-violet">
                    PAYMENT DETAIL
                  </span>
                  <h3 className="mt-1 text-sm font-black">
                    ยอดสำหรับ Booking นี้
                  </h3>
                  <dl className="mt-3 divide-y divide-line text-sm">
                    <div className="flex justify-between gap-3 py-2">
                      <dt className="text-muted">รหัสอ้างอิง</dt>
                      <dd className="font-bold">{booking.bookingCode}</dd>
                    </div>
                    <div className="flex justify-between gap-3 py-2">
                      <dt className="text-muted">Booth</dt>
                      <dd className="font-bold">{booking.booth.code}</dd>
                    </div>
                    <div className="flex justify-between gap-3 py-2">
                      <dt className="text-muted">ยอดชำระ</dt>
                      <dd className="font-black text-violet">
                        {formatBookingMoney(booking.boothPrice)} บาท
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-3 rounded-[10px] bg-[#f8fcf9] p-3 text-xs leading-4 text-[#4e694f]">
                    ตรวจสอบยอดใน Mobile Banking
                    ให้ตรงกับรายการนี้ก่อนยืนยันทุกครั้ง
                  </p>
                </div>
              </div>
            </article>

            {expired ? (
              <section className="rounded-[14px] border border-[#fac5bf] bg-[#fff0ee] p-4 text-sm font-bold text-[#b42318]">
                หมดเวลาชำระเงินแล้ว ไม่สามารถอัปโหลดสลิปได้
              </section>
            ) : state.isPreview ? (
              <PreviewSlipUploadPanel
                disabled={false}
                onConfirmed={() => {
                  setPaymentSucceeded(true);
                }}
              />
            ) : canUpload ? (
              <SlipUploadPanel
                bookingId={booking.id}
                token={state.token}
                disabled={false}
                onConfirmed={() => {
                  setPaymentSucceeded(true);
                }}
              />
            ) : null}
          </section>

          <aside className="grid gap-3 lg:sticky lg:top-[92px]">
            <article className="sl-surface overflow-hidden p-4">
              <div className="flex items-center gap-2 border-b border-line pb-3">
                <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-violet-tint text-violet">
                  <FileText className="h-4.5 w-4.5" aria-hidden />
                </span>
                <h2 className="text-base font-black">สรุปรายการ</h2>
              </div>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted">ชื่องาน</dt>
                  <dd className="max-w-[180px] text-right font-bold">{booking.event.name}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted">โซน</dt>
                  <dd className="text-right font-bold">
                    {booking.booth.zone.name ?? booking.booth.zone.code}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted">Booth</dt>
                  <dd className="font-bold">{booking.booth.code}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted">ร้านค้า</dt>
                  <dd className="font-bold">{booking.shop.name}</dd>
                </div>
              </dl>
              <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                <strong className="text-sm">ยอดรวมทั้งสิ้น</strong>
                <strong className="text-xl font-black text-violet">
                  {formatBookingMoney(booking.boothPrice)} บาท
                </strong>
              </div>
            </article>

            <article className="sl-surface p-4">
              <span className="sl-kicker">PAYMENT FLOW</span>
              <ol className="mt-3 space-y-3">
                {[
                  ['✓', 'สร้าง Booking', 'Booth ถูก Hold ชั่วคราว', true],
                  ['2', 'ชำระเงินและแนบสลิป', 'ส่งหลักฐานเข้าสู่ระบบ', true],
                  ['3', 'ระบบตรวจสอบ', 'ตรวจยอดและหลักฐาน', false],
                  ['4', 'ยืนยัน Booking', 'Booth เปลี่ยนเป็น Reserved', false],
                ].map(([number, label, detail, active]) => (
                  <li
                    key={label as string}
                    className={`flex gap-3 ${active ? 'text-violet' : 'text-muted'}`}
                  >
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${active ? 'bg-violet-tint' : 'bg-[#f3f0f5]'}`}
                    >
                      {number as string}
                    </span>
                    <div>
                      <strong className="block text-sm">
                        {label as string}
                      </strong>
                      <small className="mt-0.5 block text-xs opacity-70">
                        {detail as string}
                      </small>
                    </div>
                  </li>
                ))}
              </ol>
            </article>

            <article className="sl-surface p-4">
              <div className="flex items-center gap-2 border-b border-line pb-3">
                <Lightbulb className="h-5 w-5 text-violet" aria-hidden />
                <h2 className="text-base font-black">คำแนะนำ</h2>
              </div>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-muted">
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-violet" aria-hidden />
                  ชำระเงินภายในเวลาที่กำหนด
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-violet" aria-hidden />
                  อัปโหลดสลิป JPEG หรือ PNG ขนาดไม่เกิน 5 MB
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-violet" aria-hidden />
                  ตรวจสอบยอดและรหัส Booking ก่อนโอนทุกครั้ง
                </li>
              </ul>
            </article>

            <article className="sl-surface border-[#d9e6dc] bg-[#f8fcf9] p-4">
              <div className="flex gap-3">
                <ShieldCheck className="h-5 w-5 shrink-0 text-emerald" aria-hidden />
                <p className="text-xs leading-5 text-[#4e694f]">
                  ใช้ QR ที่ระบบแสดงเท่านั้น และไม่ส่งข้อมูลการชำระเงินผ่านช่องทางอื่น
                </p>
              </div>
            </article>
          </aside>
        </div>
      </div>
    </main>
  );
}

function BookingPaymentSuccessDialog({
  bookingCode,
  eventMapHref,
}: {
  bookingCode: string;
  eventMapHref: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryActionRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    primaryActionRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        window.location.assign('/bookings');
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-[#1d1230]/55 p-4 backdrop-blur-[5px]"
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-payment-success-title"
        aria-describedby="booking-payment-success-detail"
        className="relative w-full max-w-[480px] overflow-hidden rounded-[26px] border border-white/70 bg-white p-6 text-center shadow-[0_28px_90px_rgba(35,18,56,.32)] sm:p-8"
      >
        <div className="pointer-events-none absolute -left-12 -top-14 h-36 w-36 rounded-full bg-violet/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -right-10 h-40 w-40 rounded-full bg-emerald/10 blur-2xl" />

        <div className="relative mx-auto grid h-24 w-24 place-items-center">
          <span className="absolute inset-2 rounded-full bg-[#dff7e9] motion-safe:animate-ping" />
          <span className="relative grid h-20 w-20 place-items-center rounded-full bg-[linear-gradient(145deg,#25a768,#138653)] text-white shadow-[0_12px_30px_rgba(21,139,86,.28)]">
            <CheckCircle2 className="h-11 w-11" strokeWidth={2.4} aria-hidden />
          </span>
          <Sparkles className="absolute -right-1 top-1 h-6 w-6 text-violet motion-safe:animate-pulse" aria-hidden />
        </div>

        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#eaf8f0] px-3 py-1 text-xs font-extrabold tracking-[.08em] text-[#15794a]">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> PAYMENT VERIFIED
        </span>
        <h1
          id="booking-payment-success-title"
          className="mt-3 text-2xl font-black tracking-[-.035em] text-ink sm:text-[28px]"
        >
          ยืนยันการชำระเงินสำเร็จ
        </h1>
        <p
          id="booking-payment-success-detail"
          className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted"
        >
          ระบบตรวจสอบสลิปและยืนยันการจองเรียบร้อยแล้ว คุณสามารถดูรายการเดิมหรือเลือกพื้นที่เพิ่มได้ทันที
        </p>

        <div className="mt-5 rounded-[14px] border border-[#dfd2f1] bg-[#faf8ff] px-4 py-3 text-left">
          <span className="block text-xs font-bold text-muted">รหัสอ้างอิง Booking</span>
          <strong className="mt-1 block break-all text-base font-black text-violet">
            {bookingCode}
          </strong>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Link
            ref={primaryActionRef}
            href="/bookings"
            className="sl-action-primary min-h-12 w-full text-sm"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            ไปการจองของฉัน
          </Link>
          <Link
            href={eventMapHref}
            className="sl-action-secondary min-h-12 w-full text-sm"
          >
            <LayoutGrid className="h-4 w-4" aria-hidden />
            เลือกบูธเพิ่ม
          </Link>
        </div>
        <p className="mt-4 text-xs leading-5 text-muted">
          หน้านี้จะไม่ย้อนกลับไปยังหน้าสำเร็จแบบเดิม กด Esc เพื่อไปหน้าการจองของฉัน
        </p>
      </div>
    </div>
  );
}
