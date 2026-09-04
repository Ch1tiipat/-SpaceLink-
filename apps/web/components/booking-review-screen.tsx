'use client';

import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { CheckCircle2, MessageSquareText, Star } from 'lucide-react';
import { createReview } from '@/lib/api';
import {
  BookingPageLoading,
  BookingPageMessage,
  isBookingReviewEligible,
  useBookingDetail,
} from '@/components/booking-detail-screen';

const quickTags = ['ทำเลดี', 'พื้นที่สะอาด', 'เข้าออกสะดวก', 'ตรงตามรายละเอียด'];

export function BookingReviewScreen({ bookingId }: { bookingId: string }) {
  const state = useBookingDetail(bookingId);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (state.status === 'loading') return <BookingPageLoading />;
  if (state.status === 'signed-out') return <BookingPageMessage title="กรุณาเข้าสู่ระบบก่อน" detail="การรีวิวเปิดให้เฉพาะเจ้าของการจอง" href="/login" action="เข้าสู่ระบบ" />;
  if (state.status === 'error') return <BookingPageMessage title="เปิดหน้ารีวิวไม่ได้" detail={state.message} />;

  const { booking } = state;
  if (!isBookingReviewEligible(booking)) return <BookingPageMessage title="ยังรีวิวพื้นที่ไม่ได้" detail="สามารถให้คะแนนได้หลังงานสิ้นสุดและรายการอยู่ในสถานะยืนยันหรือเสร็จสิ้น" href={`/bookings/${encodeURIComponent(booking.bookingCode)}`} action="ดูรายละเอียดการจอง" />;
  if (success) {
    return (
      <main className="sl-page pb-16">
        <div className="shell max-w-3xl py-12 sm:py-20">
          <section className="sl-surface overflow-hidden text-center">
            <div className="bg-[linear-gradient(135deg,#f5efff,#ffffff)] px-6 py-10 sm:px-10 sm:py-14">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#ecfdf3] text-[#176c50] shadow-sm">
                <CheckCircle2 className="h-8 w-8" aria-hidden />
              </span>
              <span className="sl-kicker mt-6">Review completed</span>
              <h1 className="mt-3 text-3xl font-black tracking-[-0.045em]">
                ขอบคุณสำหรับรีวิว
              </h1>
              <p className="mx-auto mt-3 max-w-xl leading-7 text-muted">
                ระบบบันทึกความคิดเห็นสำหรับบูธ {booking.booth.code} ใน{' '}
                {booking.event.name} เรียบร้อยแล้ว
              </p>
            </div>
            <div className="grid gap-3 border-t border-line p-5 sm:grid-cols-3 sm:p-6">
              <Link href={`/events/${encodeURIComponent(booking.event.slug ?? '')}`} className="sl-action-secondary">
                ดู Event
              </Link>
              <Link href="/bookings?tab=completed" className="sl-action-secondary text-violet">
                การจองที่เสร็จสิ้น
              </Link>
              <Link href={`/bookings/${encodeURIComponent(booking.bookingCode)}`} className="sl-action-primary">
                ดูรายละเอียดการจอง
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rating < 1) {
      setError('กรุณาเลือกคะแนน 1–5 ดาว');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    const combinedComment = [...tags, comment.trim()].filter(Boolean).join(' · ');
    try {
      if (state.status !== 'ready') return;
      if (!state.isPreview) await createReview({ targetType: 'BOOTH', targetId: booking.booth.id, rating, ...(combinedComment ? { comment: combinedComment } : {}) }, state.token);
      setSuccess(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ไม่สามารถบันทึกรีวิวได้');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="sl-page pb-16">
      <div className="shell max-w-3xl py-8">
        <Link href={`/bookings/${encodeURIComponent(booking.bookingCode)}`} className="sl-chip">← กลับรายละเอียดการจอง</Link>
        <section className="sl-surface mt-6 overflow-hidden">
          <div className="border-b border-line bg-[linear-gradient(135deg,#fbf8ff,#ffffff)] p-6 sm:p-9">
          <span className="sl-kicker"><MessageSquareText className="h-4 w-4" aria-hidden /> Review</span>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.045em]">รีวิวพื้นที่บูธ</h1>
          <p className="mt-2 text-muted">{booking.event.name} · บูธ {booking.booth.code} · {booking.booth.zone.name ?? booking.booth.zone.code}</p>
          </div>
          <form onSubmit={handleSubmit} className="p-6 sm:p-9">
            <fieldset><legend className="text-lg font-black">ประสบการณ์โดยรวมเป็นอย่างไร</legend><div className="mt-4 flex gap-2" aria-label="เลือกคะแนนพื้นที่">{[1,2,3,4,5].map((value) => <button key={value} type="button" aria-label={`${value} ดาว`} aria-pressed={rating === value} onClick={() => { setRating(value); setError(null); }} className={`grid h-12 w-12 place-items-center rounded-2xl border transition ${rating >= value ? 'border-[#f3b61f] bg-[#fff8dc] text-[#b77900]' : 'border-line bg-white text-[#aaa3b2]'}`}><Star className="h-6 w-6" fill={rating >= value ? 'currentColor' : 'none'} aria-hidden /></button>)}</div></fieldset>
            <fieldset className="mt-7"><legend className="text-sm font-bold">เลือกคำที่ตรงกับพื้นที่ (ไม่บังคับ)</legend><div className="mt-3 flex flex-wrap gap-2">{quickTags.map((tag) => { const selected = tags.includes(tag); return <button key={tag} type="button" aria-pressed={selected} onClick={() => setTags((current) => selected ? current.filter((item) => item !== tag) : [...current, tag])} className={`rounded-full border px-4 py-2 text-sm font-bold ${selected ? 'border-violet bg-violet-tint text-violet' : 'border-line bg-white text-muted'}`}>{tag}</button>; })}</div></fieldset>
            <label className="mt-7 block text-sm font-bold">ความคิดเห็นเพิ่มเติม (ไม่บังคับ)<textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} rows={5} placeholder="บอกผู้จัดงานว่าพื้นที่นี้เป็นอย่างไร" className="mt-2 w-full rounded-2xl border border-line px-4 py-3 text-base outline-none focus:border-violet" /></label>
            <p className="mt-2 text-xs text-muted">รีวิวจะแสดงแบบไม่ระบุตัวตน และสามารถส่งซ้ำเพื่ออัปเดตคะแนนเดิมได้</p>
            {error ? <p role="alert" className="mt-4 text-sm font-bold text-danger">{error}</p> : null}
            <button type="submit" disabled={isSubmitting} className="sl-action-primary mt-6 w-full">{isSubmitting ? 'กำลังบันทึก…' : 'ส่งรีวิวพื้นที่'}</button>
          </form>
        </section>
      </div>
    </main>
  );
}
