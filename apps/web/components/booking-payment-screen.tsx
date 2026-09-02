'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { QrCode, ShieldCheck } from 'lucide-react';
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
  const [previewConfirmed, setPreviewConfirmed] = useState(false);
  const [holdExpired, setHoldExpired] = useState(false);

  if (state.status === 'loading') return <BookingPageLoading />;
  if (state.status === 'signed-out') return <BookingPageMessage title="กรุณาเข้าสู่ระบบก่อน" detail="หน้าชำระเงินเปิดได้เฉพาะเจ้าของการจอง" href="/login" action="เข้าสู่ระบบ" />;
  if (state.status === 'error') return <BookingPageMessage title="เปิดหน้าชำระเงินไม่ได้" detail={state.message} />;

  const { booking } = state;
  if (previewConfirmed || booking.status === 'CONFIRMED') {
    return <BookingPageMessage title="ยืนยันการจองเรียบร้อยแล้ว" detail={`ระบบบันทึกการชำระเงินของ ${booking.bookingCode} แล้ว`} href={`/bookings/${booking.id}`} action="ดูรายละเอียดการจอง" />;
  }
  if (booking.status !== 'PENDING_PAYMENT') {
    return <BookingPageMessage title="รายการนี้ไม่อยู่ระหว่างรอชำระเงิน" detail={`สถานะปัจจุบันของรหัส ${booking.bookingCode} ไม่รองรับการอัปโหลดสลิป`} href={`/bookings/${booking.id}`} action="ดูรายละเอียดการจอง" />;
  }

  const expired = holdExpired || !booking.holdExpiresAt || new Date(booking.holdExpiresAt).getTime() <= Date.now();
  const canUpload = state.isPreview || Boolean(booking.paymentQrDataUri);

  return (
    <main className="sl-page pb-16">
      <div className="shell max-w-[1180px] py-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/bookings" className="sl-chip min-h-9 px-3 text-sm">← กลับการจองของฉัน</Link>
          <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-[#d8caeb] bg-white px-3 text-xs font-extrabold tracking-[.1em] text-violet"><ShieldCheck size={13} aria-hidden /> PAYMENT VERIFICATION</span>
        </div>

        <header className="mt-4 flex items-end justify-between gap-5 max-sm:flex-col max-sm:items-start">
          <div><span className="sl-kicker">PAYMENT</span><h1 className="mt-1 text-[30px] font-black tracking-[-0.045em] max-sm:text-2xl">ชำระค่าจอง Booth</h1><p className="mt-1 text-sm text-muted">ตรวจสอบยอด โอนเงิน และแนบสลิปเพื่อให้ระบบตรวจสอบ</p></div>
          <div className={`min-w-[132px] rounded-[14px] border px-4 py-3 text-center ${expired ? 'border-[#fac5bf] bg-[#fff0ee] text-[#b42318]' : 'border-[#d8caeb] bg-white text-violet'}`}>
            <span className="block text-xs font-bold text-muted">เวลาที่เหลือ</span>
            <strong className="mt-1 block text-lg font-black"><BookingCountdown expiresAt={booking.holdExpiresAt} active onExpired={() => setHoldExpired(true)} /></strong>
            <small className="mt-0.5 block text-xs opacity-70">Hold Booth</small>
          </div>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label="สรุปสถานะการชำระเงิน">
          {[
            ['Booking ID', booking.bookingCode, 'REFERENCE'],
            ['Booth', booking.booth.code, 'RESERVATION'],
            ['ยอดชำระ', `${formatBookingMoney(booking.boothPrice)} บาท`, 'TOTAL'],
            ['สถานะ', 'รอชำระเงิน', 'PAYMENT'],
          ].map(([label, value, caption]) => (
            <article key={label} className="rounded-[14px] border border-line bg-white p-3"><span className="text-xs text-muted">{label}</span><strong className={`mt-1 block truncate text-base font-black ${label === 'ยอดชำระ' ? 'text-violet' : ''}`} title={value}>{value}</strong><small className="mt-0.5 block text-xs tracking-[.08em] text-[#aaa0ad]">{caption}</small></article>
          ))}
        </section>

        <div className="mt-3 grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="grid gap-3">
            <article className="sl-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><span className="sl-kicker">BOOKING SUMMARY</span><h2 className="mt-1 text-lg font-black">{booking.event.name}</h2></div><span className="rounded-full bg-[#edf6ff] px-3 py-1.5 text-xs font-extrabold text-[#1d67a8]">PENDING PAYMENT</span></div>
              <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ['Zone', booking.booth.zone.name ?? booking.booth.zone.code],
                  ['Booth', booking.booth.code],
                  ['ร้านค้า', booking.shop.name],
                  ['ยอดชำระ', `${formatBookingMoney(booking.boothPrice)} บาท`],
                ].map(([label, value]) => <div key={label} className="rounded-[11px] bg-[#faf8fc] p-3"><dt className="text-xs text-muted">{label}</dt><dd className={`mt-1 truncate text-sm font-black ${label === 'ยอดชำระ' ? 'text-violet' : ''}`} title={value}>{value}</dd></div>)}
              </dl>
            </article>

            <article className="sl-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><span className="sl-kicker">PAYMENT METHOD</span><h2 className="mt-1 text-lg font-black">เลือกวิธีชำระเงิน</h2></div><small className="text-xs text-muted">ผู้รับเงิน: ผู้จัด Event</small></div>
              <div className="mt-3 grid gap-2">
                <div className="flex min-h-[58px] items-center gap-3 rounded-[12px] border border-violet bg-violet-tint px-3 text-violet"><span className="grid h-9 w-9 place-items-center rounded-[10px] bg-white"><QrCode size={18} aria-hidden /></span><span><strong className="block text-sm">PromptPay QR</strong><small className="mt-0.5 block text-xs opacity-70">สแกนผ่าน Mobile Banking</small></span><b className="ml-auto text-sm">✓</b></div>
              </div>

              <div className="mt-3 grid gap-3 rounded-[14px] bg-[#faf8ff] p-4 md:grid-cols-[260px_minmax(0,1fr)] md:items-center">
                <div className="text-center">
                  {booking.paymentQrDataUri ? <Image src={booking.paymentQrDataUri} alt="QR PromptPay สำหรับชำระค่าบูธ" width={240} height={240} unoptimized className="mx-auto h-[210px] w-[210px] rounded-[14px] border-8 border-white bg-white shadow" /> : state.isPreview ? <span className="mx-auto grid h-[210px] w-[210px] place-items-center rounded-[14px] border-8 border-white bg-[repeating-conic-gradient(#201b2e_0_25%,#fff_0_50%)] bg-[length:16px_16px] shadow"><span className="grid h-14 w-14 place-items-center rounded-xl bg-white text-violet"><QrCode className="h-9 w-9" aria-hidden /></span></span> : <div className="rounded-[12px] border border-[#f0d9a4] bg-[#fff9e8] p-4 text-left text-sm leading-5 text-[#7a5700]">ผู้จัดงานยังไม่ได้ตั้งค่าบัญชี PromptPay จึงยังไม่มี QR รับเงินจริง กรุณาอย่าโอนเงินจากข้อมูลอื่นนอกระบบ</div>}
                  <p className="mt-2 text-xs font-bold text-muted">{state.isPreview ? 'QR ตัวอย่างสำหรับตรวจ UX/UI เท่านั้น — ไม่รับเงินจริง' : booking.paymentQrDataUri ? 'QR ถูกกำหนดยอดตาม Booking นี้' : 'รอข้อมูลรับชำระจากผู้จัดงาน'}</p>
                </div>
                <div className="rounded-[12px] border border-line bg-white p-4"><span className="text-xs font-extrabold tracking-[.1em] text-violet">PAYMENT DETAIL</span><h3 className="mt-1 text-sm font-black">ยอดสำหรับ Booking นี้</h3><dl className="mt-3 divide-y divide-line text-sm"><div className="flex justify-between gap-3 py-2"><dt className="text-muted">รหัสอ้างอิง</dt><dd className="font-bold">{booking.bookingCode}</dd></div><div className="flex justify-between gap-3 py-2"><dt className="text-muted">Booth</dt><dd className="font-bold">{booking.booth.code}</dd></div><div className="flex justify-between gap-3 py-2"><dt className="text-muted">ยอดชำระ</dt><dd className="font-black text-violet">{formatBookingMoney(booking.boothPrice)} บาท</dd></div></dl><p className="mt-3 rounded-[10px] bg-[#f8fcf9] p-3 text-xs leading-4 text-[#4e694f]">ตรวจสอบยอดใน Mobile Banking ให้ตรงกับรายการนี้ก่อนยืนยันทุกครั้ง</p></div>
              </div>
            </article>

            {expired ? <section className="rounded-[14px] border border-[#fac5bf] bg-[#fff0ee] p-4 text-sm font-bold text-[#b42318]">หมดเวลาชำระเงินแล้ว ไม่สามารถอัปโหลดสลิปได้</section> : state.isPreview ? <PreviewSlipUploadPanel disabled={false} onConfirmed={() => setPreviewConfirmed(true)} /> : canUpload ? <SlipUploadPanel bookingId={booking.id} token={state.token} disabled={false} onConfirmed={() => state.refresh()} /> : null}
          </section>

          <aside className="grid gap-3 lg:sticky lg:top-[92px]">
            <article className="sl-surface p-4"><span className="sl-kicker">ORGANIZER</span><div className="mt-3 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-[12px] bg-[linear-gradient(135deg,#8b5cf6,#6831d0)] text-sm font-black text-white">EV</span><div><strong className="block text-sm">ผู้จัด {booking.event.name}</strong><small className="mt-1 block text-xs text-muted">รับชำระผ่านข้อมูลที่แนบกับ Booking</small></div></div></article>

            <article className="sl-surface p-4"><span className="sl-kicker">PAYMENT FLOW</span><ol className="mt-3 space-y-3">
              {[
                ['✓', 'สร้าง Booking', 'Booth ถูก Hold ชั่วคราว', true],
                ['2', 'ชำระเงินและแนบสลิป', 'ส่งหลักฐานเข้าสู่ระบบ', true],
                ['3', 'ระบบตรวจสอบ', 'ตรวจยอดและหลักฐาน', false],
                ['4', 'ยืนยัน Booking', 'Booth เปลี่ยนเป็น Reserved', false],
              ].map(([number, label, detail, active]) => <li key={label as string} className={`flex gap-3 ${active ? 'text-violet' : 'text-muted'}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${active ? 'bg-violet-tint' : 'bg-[#f3f0f5]'}`}>{number as string}</span><div><strong className="block text-sm">{label as string}</strong><small className="mt-0.5 block text-xs opacity-70">{detail as string}</small></div></li>)}
            </ol></article>

            <article className="sl-surface border-[#f0d9a4] bg-[#fffaf0] p-4"><span className="text-xs font-extrabold tracking-[.1em] text-[#9d620c]">IMPORTANT</span><strong className="mt-1 block text-sm">ตรวจสอบยอดก่อนโอน</strong><p className="mt-2 text-xs leading-5 text-[#7a5700]">ยอดในสลิปควรตรงกับราคา Booth และรหัส Booking นี้ เพื่อให้ตรวจสอบได้ถูกต้อง</p></article>

            <article className="sl-surface p-4"><div className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-emerald" aria-hidden /><div><h2 className="text-sm font-black">ชำระเงินอย่างปลอดภัย</h2><p className="mt-1 text-xs leading-5 text-muted">รองรับสลิป JPEG/PNG ไม่เกิน 5 MB และไม่ควรส่งข้อมูลการชำระเงินผ่านช่องทางอื่น</p></div></div></article>
          </aside>
        </div>
      </div>
    </main>
  );
}
