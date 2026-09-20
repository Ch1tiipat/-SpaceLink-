'use client';

import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  CheckCircle2,
  MessageSquareText,
  Star,
  X,
} from 'lucide-react';
import {
  createReview,
  type MyBooking,
  type MyReview,
} from '@/lib/api';
import { isBookingReviewEligible } from '@/lib/review-eligibility';
import {
  BookingPageLoading,
  BookingPageMessage,
  useBookingDetail,
} from '@/components/booking-detail-screen';

const quickTags = [
  'ทำเลดี',
  'พื้นที่สะอาด',
  'เข้าออกสะดวก',
  'ตรงตามรายละเอียด',
] as const;

export type SavedReviewDraft = {
  rating: number;
  comment: string;
};

type ReviewEditorPopupProps = {
  booking: MyBooking;
  token: string;
  isPreview?: boolean;
  existingReview?: Pick<MyReview, 'rating' | 'comment'> | null;
  onClose: () => void;
  onSaved?: (draft: SavedReviewDraft) => void;
};

function splitExistingComment(comment: string | null | undefined): {
  tags: string[];
  comment: string;
} {
  const parts = comment
    ?.split(' · ')
    .map((part) => part.trim())
    .filter(Boolean) ?? [];

  return {
    tags: parts.filter((part) =>
      quickTags.includes(part as (typeof quickTags)[number]),
    ),
    comment: parts
      .filter((part) => !quickTags.includes(part as (typeof quickTags)[number]))
      .join(' · '),
  };
}

export function ReviewEditorPopup({
  booking,
  token,
  isPreview = false,
  existingReview = null,
  onClose,
  onSaved,
}: ReviewEditorPopupProps) {
  const initial = useMemo(
    () => splitExistingComment(existingReview?.comment),
    [existingReview?.comment],
  );
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [comment, setComment] = useState(initial.comment);
  const [tags, setTags] = useState<string[]>(initial.tags);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setIsMounted(true), []);

  useEffect(() => {
    if (!isMounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape' && !isSubmitting) onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMounted, isSubmitting, onClose]);

  function trapFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
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
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const combinedComment = [...tags, comment.trim()]
      .filter(Boolean)
      .join(' · ');
    if (rating < 1 || rating > 5) {
      setError('กรุณาเลือกคะแนน 1–5 ดาว');
      return;
    }
    if (!combinedComment) {
      setError('กรุณาเขียนความคิดเห็นก่อนส่งรีวิว');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      if (!isPreview) {
        await createReview(
          {
            bookingId: booking.id,
            targetType: 'BOOTH',
            targetId: booking.booth.id,
            rating,
            comment: combinedComment,
          },
          token,
        );
      }
      onSaved?.({ rating, comment: combinedComment });
      setSuccess(true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'ไม่สามารถบันทึกรีวิวได้',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const zoneName = booking.booth.zone.name ?? booking.booth.zone.code;
  const isEditing = Boolean(existingReview);
  if (!isMounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-[#171022]/55 px-4 py-8 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-popup-title"
        onKeyDown={trapFocus}
        className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-[#e6dcf5] bg-white shadow-[0_28px_90px_rgba(56,34,92,.28)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line bg-[linear-gradient(135deg,#f4ecff,#ffffff)] px-6 py-5 sm:px-8">
          <div>
            <span className="sl-kicker">
              <MessageSquareText className="h-4 w-4" aria-hidden />{' '}
              {isEditing ? 'Edit review' : 'Write a review'}
            </span>
            <h2
              id="review-popup-title"
              className="mt-2 text-2xl font-black tracking-[-0.035em] text-ink"
            >
              {isEditing ? 'แก้ไขรีวิวของคุณ' : 'รีวิวพื้นที่บูธ'}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              {booking.event.name} · บูธ {booking.booth.code} · {zoneName}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="ปิดหน้าต่างรีวิว"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-white text-muted transition hover:border-violet hover:text-violet disabled:opacity-50"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {success ? (
          <div className="px-6 py-10 text-center sm:px-10 sm:py-12">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#eaf9f2] text-[#16845e]">
              <CheckCircle2 className="h-9 w-9" aria-hidden />
            </span>
            <h3 className="mt-5 text-2xl font-black">
              {isEditing ? 'แก้ไขรีวิวเรียบร้อยแล้ว' : 'ขอบคุณสำหรับรีวิว'}
            </h3>
            <p className="mx-auto mt-2 max-w-md leading-7 text-muted">
              คะแนนและความคิดเห็นของคุณถูกบันทึกแล้ว
              และสรุปในหน้าการรีวิวได้รับการอัปเดตทันที
            </p>
            <button
              type="button"
              onClick={onClose}
              className="sl-action-primary mt-7 min-w-48"
            >
              กลับหน้าการรีวิวของฉัน
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-6 sm:px-8 sm:py-7">
            <fieldset>
              <legend className="text-base font-black">
                ให้คะแนนประสบการณ์ของคุณ <span className="text-danger">*</span>
              </legend>
              <div className="mt-3 flex flex-wrap gap-2" aria-label="เลือกคะแนนพื้นที่">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={`${value} ดาว`}
                    aria-pressed={rating === value}
                    onClick={() => {
                      setRating(value);
                      setError(null);
                    }}
                    className={`grid h-12 w-12 place-items-center rounded-2xl border transition ${rating >= value ? 'border-[#f3b61f] bg-[#fff8dc] text-[#b77900]' : 'border-line bg-white text-[#aaa3b2] hover:border-[#f3b61f]'}`}
                  >
                    <Star
                      className="h-6 w-6"
                      fill={rating >= value ? 'currentColor' : 'none'}
                      aria-hidden
                    />
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-6">
              <legend className="text-sm font-bold text-ink">
                เลือกคำที่ตรงกับพื้นที่
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {quickTags.map((tag) => {
                  const selected = tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setTags((current) =>
                          selected
                            ? current.filter((item) => item !== tag)
                            : [...current, tag],
                        );
                        setError(null);
                      }}
                      className={`rounded-full border px-4 py-2 text-sm font-bold transition ${selected ? 'border-violet bg-violet-tint text-violet' : 'border-line bg-white text-muted hover:border-violet'}`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <label className="mt-6 block text-sm font-bold">
              ความคิดเห็น <span className="text-danger">*</span>
              <textarea
                value={comment}
                onChange={(event) => {
                  setComment(event.target.value);
                  setError(null);
                }}
                maxLength={1000}
                rows={5}
                placeholder="เล่าประสบการณ์เกี่ยวกับทำเล พื้นที่ หรือการให้บริการ"
                className="mt-2 w-full resize-none rounded-2xl border border-line px-4 py-3 text-base outline-none transition focus:border-violet focus:ring-4 focus:ring-violet/10"
              />
            </label>
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted">
              <span>รีวิวจะแสดงโดยไม่เปิดเผยข้อมูลติดต่อของคุณ</span>
              <span>{comment.length}/1,000</span>
            </div>

            {error ? (
              <p role="alert" className="mt-4 text-sm font-bold text-danger">
                {error}
              </p>
            ) : null}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="sl-action-secondary"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="sl-action-primary"
              >
                {isSubmitting
                  ? 'กำลังบันทึก…'
                  : isEditing
                    ? 'บันทึกการแก้ไข'
                    : 'ส่งรีวิวพื้นที่'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function BookingReviewScreen({ bookingId }: { bookingId: string }) {
  const state = useBookingDetail(bookingId);
  const router = useRouter();

  if (state.status === 'loading') return <BookingPageLoading />;
  if (state.status === 'signed-out') {
    return (
      <BookingPageMessage
        title="กรุณาเข้าสู่ระบบก่อน"
        detail="การรีวิวเปิดให้เฉพาะเจ้าของการจอง"
        href="/login"
        action="เข้าสู่ระบบ"
      />
    );
  }
  if (state.status === 'error') {
    return (
      <BookingPageMessage title="เปิดหน้ารีวิวไม่ได้" detail={state.message} />
    );
  }

  const { booking } = state;
  const bookingHref = `/bookings/${encodeURIComponent(booking.bookingCode)}`;
  if (!isBookingReviewEligible(booking)) {
    return (
      <BookingPageMessage
        title="ยังเขียนรีวิวไม่ได้"
        detail="เขียนรีวิวได้เมื่อการจองเสร็จสิ้นและ Event จบแล้วเท่านั้น"
        href={bookingHref}
        action="กลับรายละเอียดการจอง"
      />
    );
  }

  return (
    <main className="sl-page min-h-[70vh] pb-16">
      <div className="shell py-10">
        <span className="sl-kicker">My reviews</span>
        <h1 className="mt-3 text-3xl font-black">การรีวิวของฉัน</h1>
        <p className="mt-2 text-muted">กรอกคะแนนและความคิดเห็นใน Popup</p>
      </div>
      <ReviewEditorPopup
        booking={booking}
        token={state.token}
        isPreview={state.isPreview}
        onClose={() => router.push(bookingHref)}
        onSaved={() => undefined}
      />
    </main>
  );
}
