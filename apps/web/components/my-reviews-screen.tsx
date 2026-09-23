'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  MessageSquareText,
  Pencil,
  Search,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import {
  ReviewEditorPopup,
  type SavedReviewDraft,
} from '@/components/booking-review-screen';
import { getPreviewBookings } from '@/components/booking-detail-screen';
import { EventDetailContent } from '@/components/event-detail-screen';
import {
  getMyBookings,
  getMyReviews,
  type EventMap,
  type MyBooking,
  type MyReview,
} from '@/lib/api';
import { getEventCoverUrl } from '@/lib/event-cover';
import { isBookingReviewEligible } from '@/lib/review-eligibility';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import {
  getUxPreviewMode,
  subscribeToUxPreview,
  UX_PREVIEW_TOKEN,
} from '@/lib/ux-preview';

type AccessState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'ready'; token: string; isPreview: boolean }
  | { status: 'error'; message: string };

type ReviewFilter = 'all' | 'reviewed' | 'pending' | 'five-stars';
type ReviewSort = 'newest' | 'oldest' | 'highest' | 'lowest';
type EditorState = { booking: MyBooking; review: MyReview | null };
type EventPreviewState = { identifier: string; name: string };
type ReviewListItem =
  | { kind: 'reviewed'; review: MyReview; booking: MyBooking | null }
  | { kind: 'pending'; booking: MyBooking };

const PAGE_SIZE = 20;
const DATE_FORMATTER = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  dateStyle: 'long',
});

function previewReviews(): MyReview[] {
  return [
    {
      id: 'preview-review-a01',
      targetType: 'BOOTH',
      rating: 5,
      comment: 'ทำเลดี · พื้นที่สะอาด · เข้าออกสะดวก',
      createdAt: '2026-09-05T10:00:00.000Z',
      status: 'PUBLISHED',
      context: {
        bookingCode: 'local-preview-completed-booking',
        event: { name: 'งานเกษตร มทส. 2569', slug: 'demo-event' },
        booth: { code: 'A01' },
        zone: { code: 'ZONE-A', name: 'โซนอาหาร' },
      },
    },
  ];
}

function bookingMatchesReview(booking: MyBooking, review: MyReview): boolean {
  const bookingCode = review.context?.bookingCode;
  return Boolean(
    bookingCode &&
      (booking.bookingCode === bookingCode || booking.id === bookingCode),
  );
}

function itemSearchText(item: ReviewListItem): string {
  if (item.kind === 'pending') {
    const { booking } = item;
    return [
      booking.bookingCode,
      booking.event.name,
      booking.booth.code,
      booking.booth.zone.code,
      booking.booth.zone.name,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('th');
  }

  const { review } = item;
  return [
    review.context?.bookingCode,
    review.context?.event.name,
    review.context?.booth.code,
    review.context?.zone.code,
    review.context?.zone.name,
    review.comment,
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('th');
}

function itemDate(item: ReviewListItem): number {
  return new Date(
    item.kind === 'reviewed'
      ? item.review.createdAt
      : item.booking.event.endDate,
  ).getTime();
}

function itemRating(item: ReviewListItem): number {
  return item.kind === 'reviewed' ? item.review.rating : 0;
}

export function MyReviewsScreen() {
  const [access, setAccess] = useState<AccessState>({ status: 'loading' });
  const [reviews, setReviews] = useState<MyReview[]>([]);
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [sort, setSort] = useState<ReviewSort>('newest');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [eventPreview, setEventPreview] = useState<EventPreviewState | null>(
    null,
  );
  const requestRef = useRef(0);
  const currentTokenRef = useRef<string | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const eventReturnFocusRef = useRef<HTMLElement | null>(null);

  async function loadDashboard(token: string, signal?: AbortSignal) {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [bookingItems, firstPage] = await Promise.all([
        getMyBookings(token, signal),
        getMyReviews(token, 1, PAGE_SIZE, signal),
      ]);
      const reviewItems = [...firstPage.items];
      let page = firstPage.page;
      let hasMore = firstPage.hasMore;
      while (hasMore && !signal?.aborted) {
        page += 1;
        const nextPage = await getMyReviews(
          token,
          page,
          PAGE_SIZE,
          signal,
        );
        reviewItems.push(...nextPage.items);
        hasMore = nextPage.hasMore;
      }

      if (
        signal?.aborted ||
        requestId !== requestRef.current ||
        currentTokenRef.current !== token
      ) {
        return;
      }
      setBookings(bookingItems);
      setReviews(reviewItems);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      if (
        requestId !== requestRef.current ||
        currentTokenRef.current !== token
      ) {
        return;
      }
      setLoadError(
        cause instanceof Error ? cause.message : 'ไม่สามารถโหลดรายการรีวิวได้',
      );
    } finally {
      if (
        !signal?.aborted &&
        requestId === requestRef.current &&
        currentTokenRef.current === token
      ) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    const previewMode = getUxPreviewMode();
    if (previewMode) {
      const applyPreview = (mode: 'signed-in' | 'signed-out') => {
        if (mode === 'signed-out') {
          requestRef.current += 1;
          currentTokenRef.current = null;
          setAccess({ status: 'signed-out' });
          setReviews([]);
          setBookings([]);
        } else {
          currentTokenRef.current = UX_PREVIEW_TOKEN;
          setAccess({
            status: 'ready',
            token: UX_PREVIEW_TOKEN,
            isPreview: true,
          });
          setReviews(previewReviews());
          setBookings(getPreviewBookings());
        }
        setLoadError(null);
        setIsLoading(false);
      };
      applyPreview(previewMode);
      return subscribeToUxPreview(applyPreview);
    }

    const controller = new AbortController();
    let active = true;
    let supabase: ReturnType<typeof getSupabaseBrowserClient>;

    try {
      supabase = getSupabaseBrowserClient();
    } catch (cause) {
      setAccess({
        status: 'error',
        message:
          cause instanceof Error
            ? cause.message
            : 'ยังไม่ได้ตั้งค่าระบบเข้าสู่ระบบ',
      });
      setIsLoading(false);
      return;
    }

    async function resolve(token: string | undefined) {
      if (!active) return;
      if (!token) {
        requestRef.current += 1;
        currentTokenRef.current = null;
        setAccess({ status: 'signed-out' });
        setReviews([]);
        setBookings([]);
        setIsLoading(false);
        return;
      }

      currentTokenRef.current = token;
      setAccess({ status: 'ready', token, isPreview: false });
      await loadDashboard(token, controller.signal);
    }

    void supabase.auth
      .getSession()
      .then(({ data }) => resolve(data.session?.access_token))
      .catch((cause: unknown) => {
        if (!active) return;
        setAccess({
          status: 'error',
          message:
            cause instanceof Error
              ? cause.message
              : 'ตรวจสอบสถานะเข้าสู่ระบบไม่สำเร็จ',
        });
        setIsLoading(false);
      });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return;
      void resolve(session?.access_token);
    });

    return () => {
      active = false;
      controller.abort();
      data.subscription.unsubscribe();
    };
  }, []);

  const reviewBookingById = useMemo(() => {
    const result = new Map<string, MyBooking>();
    for (const review of reviews) {
      const booking = bookings.find((item) => bookingMatchesReview(item, review));
      if (booking) result.set(review.id, booking);
    }
    return result;
  }, [bookings, reviews]);

  const pendingBookings = useMemo(
    () =>
      bookings.filter(
        (booking) =>
          isBookingReviewEligible(booking) &&
          !reviews.some((review) => bookingMatchesReview(booking, review)),
      ),
    [bookings, reviews],
  );

  const average = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;
  const fiveStarCount = reviews.filter((review) => review.rating === 5).length;

  const visibleItems = useMemo(() => {
    const items: ReviewListItem[] = [
      ...reviews.map(
        (review): ReviewListItem => ({
          kind: 'reviewed',
          review,
          booking: reviewBookingById.get(review.id) ?? null,
        }),
      ),
      ...pendingBookings.map(
        (booking): ReviewListItem => ({ kind: 'pending', booking }),
      ),
    ];
    const normalizedQuery = query.trim().toLocaleLowerCase('th');
    return items
      .filter((item) => {
        if (filter === 'reviewed' && item.kind !== 'reviewed') return false;
        if (filter === 'pending' && item.kind !== 'pending') return false;
        if (
          filter === 'five-stars' &&
          (item.kind !== 'reviewed' || item.review.rating !== 5)
        ) {
          return false;
        }
        return !normalizedQuery || itemSearchText(item).includes(normalizedQuery);
      })
      .sort((left, right) => {
        if (sort === 'oldest') return itemDate(left) - itemDate(right);
        if (sort === 'highest') return itemRating(right) - itemRating(left);
        if (sort === 'lowest') return itemRating(left) - itemRating(right);
        return itemDate(right) - itemDate(left);
      });
  }, [filter, pendingBookings, query, reviewBookingById, reviews, sort]);

  const openEditor = (
    event: React.MouseEvent<HTMLElement>,
    booking: MyBooking,
    review: MyReview | null,
  ) => {
    returnFocusRef.current = event.currentTarget;
    setEditor({ booking, review });
  };

  const closeEditor = useCallback(() => {
    setEditor(null);
    window.setTimeout(() => returnFocusRef.current?.focus(), 0);
  }, []);

  const openEventPreview = (
    event: React.MouseEvent<HTMLElement>,
    identifier: string,
    name: string,
  ) => {
    eventReturnFocusRef.current = event.currentTarget;
    setEventPreview({ identifier, name });
  };

  const closeEventPreview = useCallback(() => {
    setEventPreview(null);
    window.setTimeout(() => eventReturnFocusRef.current?.focus(), 0);
  }, []);

  function handleSaved(draft: SavedReviewDraft) {
    if (!editor) return;
    if (editor.review) {
      setReviews((current) =>
        current.map((review) =>
          review.id === editor.review?.id
            ? { ...review, rating: draft.rating, comment: draft.comment }
            : review,
        ),
      );
      return;
    }

    const { booking } = editor;
    setReviews((current) => [
      {
        id: `local-review-${booking.id}-${Date.now()}`,
        targetType: 'BOOTH',
        rating: draft.rating,
        comment: draft.comment,
        createdAt: new Date().toISOString(),
        status: 'PUBLISHED',
        context: {
          bookingCode: booking.bookingCode,
          event: {
            name: booking.event.name,
            slug: booking.event.slug ?? booking.event.id,
          },
          booth: { code: booking.booth.code },
          zone: {
            code: booking.booth.zone.code,
            name: booking.booth.zone.name,
          },
        },
      },
      ...current,
    ]);
  }

  const filters: Array<{ value: ReviewFilter; label: string; count: number }> = [
    { value: 'all', label: 'ทั้งหมด', count: reviews.length + pendingBookings.length },
    { value: 'reviewed', label: 'รีวิวแล้ว', count: reviews.length },
    { value: 'pending', label: 'รอรีวิว', count: pendingBookings.length },
    { value: 'five-stars', label: 'ให้ 5 ดาว', count: fiveStarCount },
  ];

  return (
    <main className="sl-page pb-16">
      <div className="shell py-8">
        <span className="sl-kicker">
          <MessageSquareText className="h-4 w-4" aria-hidden /> My reviews
        </span>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
          การรีวิวของฉัน
        </h1>
        <p className="mt-2 max-w-2xl leading-7 text-muted">
          รวมคะแนนและความคิดเห็นเกี่ยวกับพื้นที่ที่คุณเคยจองไว้
        </p>

        {access.status === 'loading' || isLoading ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="กำลังโหลดรายการรีวิว">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="skeleton h-32 rounded-[24px]" />
            ))}
          </div>
        ) : null}

        {access.status === 'signed-out' ? (
          <section className="sl-surface mt-8 p-8 text-center">
            <h2 className="text-xl font-black">กรุณาเข้าสู่ระบบก่อน</h2>
            <p className="mt-2 text-muted">
              รายการรีวิวจะแสดงเฉพาะเจ้าของบัญชีที่ส่งรีวิวเท่านั้น
            </p>
            <Link href="/login" className="sl-action-primary mt-6">
              เข้าสู่ระบบ
            </Link>
          </section>
        ) : null}

        {access.status === 'error' ? (
          <section className="sl-surface mt-8 p-8 text-center">
            <h2 className="text-xl font-black">เปิดหน้ารายการรีวิวไม่ได้</h2>
            <p role="alert" className="mt-2 text-danger">
              {access.message}
            </p>
          </section>
        ) : null}

        {access.status === 'ready' && !isLoading && loadError ? (
          <section className="sl-surface mt-8 p-8 text-center">
            <h2 className="text-xl font-black">โหลดรายการรีวิวไม่สำเร็จ</h2>
            <p role="alert" className="mt-2 text-danger">
              {loadError}
            </p>
            <button
              type="button"
              onClick={() => void loadDashboard(access.token)}
              className="sl-action-primary mt-6"
            >
              ลองอีกครั้ง
            </button>
          </section>
        ) : null}

        {access.status === 'ready' && !isLoading && !loadError ? (
          <>
            <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="สรุปการรีวิว">
              <SummaryCard icon={CheckCircle2} label="รีวิวทั้งหมด" value={reviews.length.toString()} tone="violet" />
              <SummaryCard icon={Star} label="คะแนนเฉลี่ย" value={average ? average.toFixed(1) : '0.0'} tone="amber" />
              <SummaryCard icon={Star} label="5 ดาว" value={fiveStarCount.toString()} tone="green" />
              <SummaryCard icon={Clock3} label="รอเขียนรีวิว" value={pendingBookings.length.toString()} tone="blue" />
            </section>

            <section className="sl-surface mt-6 p-4 sm:p-5" aria-label="ค้นหาและกรองรีวิว">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap gap-2">
                  {filters.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      aria-pressed={filter === item.value}
                      onClick={() => setFilter(item.value)}
                      className={`rounded-full border px-4 py-2 text-sm font-bold transition ${filter === item.value ? 'border-violet bg-violet text-white' : 'border-line bg-white text-muted hover:border-violet hover:text-violet'}`}
                    >
                      {item.label} ({item.count})
                    </button>
                  ))}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <label className="relative block min-w-0 sm:w-72">
                    <span className="sr-only">ค้นหารีวิว</span>
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="ค้นหางาน บูธ หรือความคิดเห็น"
                      className="h-11 w-full rounded-xl border border-line bg-white pl-10 pr-4 text-sm outline-none focus:border-violet"
                    />
                  </label>
                  <label>
                    <span className="sr-only">เรียงลำดับรีวิว</span>
                    <select
                      value={sort}
                      onChange={(event) => setSort(event.target.value as ReviewSort)}
                      className="h-11 rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink outline-none focus:border-violet"
                    >
                      <option value="newest">ล่าสุด</option>
                      <option value="oldest">เก่าสุด</option>
                      <option value="highest">คะแนนสูงสุด</option>
                      <option value="lowest">คะแนนต่ำสุด</option>
                    </select>
                  </label>
                </div>
              </div>
            </section>

            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
              <section aria-labelledby="review-list-title">
                <h2 id="review-list-title" className="sr-only">รายการรีวิว</h2>
                {visibleItems.length ? (
                  <div className="grid gap-4">
                    {visibleItems.map((item) =>
                      item.kind === 'reviewed' ? (
                        <ReviewCard
                          key={item.review.id}
                          review={item.review}
                          booking={item.booking}
                          onEdit={openEditor}
                          onViewEvent={openEventPreview}
                        />
                      ) : (
                        <PendingReviewCard
                          key={item.booking.id}
                          booking={item.booking}
                          onReview={openEditor}
                          onViewEvent={openEventPreview}
                        />
                      ),
                    )}
                  </div>
                ) : (
                  <div className="sl-surface px-6 py-14 text-center">
                    <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-tint text-violet">
                      <Search className="h-7 w-7" aria-hidden />
                    </span>
                    <h3 className="mt-5 text-xl font-black">ไม่พบรายการที่ค้นหา</h3>
                    <p className="mt-2 text-muted">ลองเปลี่ยนคำค้นหาหรือตัวกรองอีกครั้ง</p>
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('');
                        setFilter('all');
                      }}
                      className="sl-action-secondary mt-6"
                    >
                      ล้างตัวกรอง
                    </button>
                  </div>
                )}
              </section>

              <aside className="grid h-fit gap-4 lg:sticky lg:top-24">
                <section className="sl-surface p-5">
                  <h2 className="flex items-center gap-2 text-lg font-black">
                    <BarChart3 className="h-5 w-5 text-violet" aria-hidden />
                    สรุปการรีวิว
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    ภาพรวมความคิดเห็นของคุณ
                  </p>
                  <div className="mt-5 flex items-end gap-3">
                    <strong className="text-4xl font-black text-violet">
                      {average ? average.toFixed(1) : '0.0'}
                    </strong>
                    <span className="pb-1 text-sm text-muted">จาก 5 คะแนน</span>
                  </div>
                  <div className="mt-3 flex gap-1 text-[#e9a800]" aria-label={`${average.toFixed(1)} จาก 5 ดาว`}>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Star key={value} className="h-5 w-5" fill={average >= value - 0.5 ? 'currentColor' : 'none'} aria-hidden />
                    ))}
                  </div>
                  <div className="mt-6 grid gap-3">
                    {[5, 4, 3, 2, 1].map((rating) => {
                      const count = reviews.filter(
                        (review) => review.rating === rating,
                      ).length;
                      const width = reviews.length
                        ? (count / reviews.length) * 100
                        : 0;
                      return (
                        <div key={rating} className="grid grid-cols-[36px_1fr_24px] items-center gap-2 text-xs text-muted">
                          <span>{rating} ดาว</span>
                          <span className="h-2 overflow-hidden rounded-full bg-[#eee8f5]">
                            <span className="block h-full rounded-full bg-[linear-gradient(90deg,#6f2ee8,#9c62ff)]" style={{ width: `${width}%` }} />
                          </span>
                          <span className="text-right font-bold text-ink">
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-6 rounded-2xl bg-[#f8f4ff] p-4 text-sm leading-6 text-muted">
                    รีวิวได้เฉพาะการจองที่เสร็จสิ้นและ Event จบแล้วเท่านั้น
                    การแก้ไขจะอัปเดตรีวิวเดิมโดยไม่สร้างรายการซ้ำ
                  </div>
                </section>
                <section className="sl-surface overflow-hidden bg-[linear-gradient(145deg,#fff,#f4edff)] p-5 text-center">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-violet-tint text-violet">
                    <Sparkles className="h-6 w-6" aria-hidden />
                  </span>
                  <h2 className="mt-4 text-base font-black leading-6">
                    ความคิดเห็นของคุณช่วยผู้จัดงานพัฒนาพื้นที่ให้ดีขึ้น
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    การรีวิวเป็นข้อมูลสำคัญสำหรับการเลือกพื้นที่และปรับปรุงงานในอนาคต
                  </p>
                  <div className="mt-4 text-xl tracking-[0.35em] text-violet" aria-hidden>
                    ✦ ★ ✦
                  </div>
                  <p className="mt-3 text-xs font-semibold text-muted">
                    ขอบคุณที่แบ่งปันประสบการณ์บน SpaceLink
                  </p>
                </section>
              </aside>
            </div>
          </>
        ) : null}
      </div>

      {editor && access.status === 'ready' ? (
        <ReviewEditorPopup
          key={`${editor.booking.id}:${editor.review?.id ?? 'new'}`}
          booking={editor.booking}
          token={access.token}
          isPreview={access.isPreview}
          existingReview={editor.review}
          onClose={closeEditor}
          onSaved={handleSaved}
        />
      ) : null}
      {eventPreview ? (
        <ReviewEventPopup
          key={eventPreview.identifier}
          eventId={eventPreview.identifier}
          eventName={eventPreview.name}
          onClose={closeEventPreview}
        />
      ) : null}
    </main>
  );
}

function ReviewEventPopup({
  eventId,
  eventName,
  onClose,
}: {
  eventId: string;
  eventName: string;
  onClose: () => void;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const [resolvedEvent, setResolvedEvent] = useState<EventMap['event'] | null>(
    null,
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setIsMounted(true), []);

  useEffect(() => {
    if (!isMounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMounted, onClose]);

  const handleEventResolved = useCallback(
    ({ event }: { eventId: string; event: EventMap['event'] }) => {
      setResolvedEvent(event);
    },
    [],
  );

  function trapFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
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

  if (!isMounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[210] flex items-start justify-center overflow-y-auto bg-[#171022]/60 px-3 py-3 backdrop-blur-[2px] sm:px-5 sm:py-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-event-popup-title"
        onKeyDown={trapFocus}
        className="flex max-h-[calc(100dvh-24px)] w-full max-w-[1120px] flex-col overflow-hidden rounded-[26px] border border-[#ded2f3] bg-white text-ink shadow-[0_30px_100px_rgba(28,15,58,.32)] sm:max-h-[calc(100dvh-48px)]"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line bg-white px-5 py-4 sm:px-8">
          <div className="min-w-0">
            <p className="sl-kicker">Event preview</p>
            <h2
              id="review-event-popup-title"
              className="mt-1 truncate text-lg font-black"
            >
              {resolvedEvent?.name ?? eventName}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="ปิดรายละเอียด Event"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-white text-muted transition hover:border-violet hover:text-violet"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <EventDetailContent
            eventId={eventId}
            onClose={onClose}
            onEventResolved={handleEventResolved}
            syncCanonicalRoute={false}
          />
        </div>
        <footer className="flex shrink-0 justify-end border-t border-line bg-white px-5 py-4 sm:px-8">
          <button
            type="button"
            onClick={onClose}
            className="sl-action-secondary min-w-32 text-violet"
          >
            ปิด
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Star;
  label: string;
  value: string;
  tone: 'violet' | 'amber' | 'green' | 'blue';
}) {
  const tones = {
    violet: 'bg-[#f1e9ff] text-violet',
    amber: 'bg-[#fff4d8] text-[#ad7300]',
    green: 'bg-[#e7f8f0] text-[#16845e]',
    blue: 'bg-[#eaf3ff] text-[#2f6fd4]',
  };
  return (
    <article className="sl-surface flex items-center gap-4 p-5">
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${tones[tone]}`}>
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <div>
        <p className="text-sm text-muted">{label}</p>
        <strong className="mt-1 block text-3xl font-black text-violet">{value}</strong>
      </div>
    </article>
  );
}

function ReviewCard({
  review,
  booking,
  onEdit,
  onViewEvent,
}: {
  review: MyReview;
  booking: MyBooking | null;
  onEdit: (
    event: React.MouseEvent<HTMLElement>,
    booking: MyBooking,
    review: MyReview | null,
  ) => void;
  onViewEvent: (
    event: React.MouseEvent<HTMLElement>,
    identifier: string,
    name: string,
  ) => void;
}) {
  const context = review.context;
  const zoneName = context?.zone.name ?? context?.zone.code;
  const canEdit = Boolean(booking && review.status !== 'DELETED');
  const eventIdentifier =
    booking?.event.slug ?? context?.event.slug ?? booking?.event.id;
  const eventName = context?.event.name ?? booking?.event.name ?? 'Event';

  return (
    <article className="sl-surface overflow-hidden p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-[112px_minmax(0,1fr)] xl:grid-cols-[112px_minmax(0,1fr)_auto]">
        <div
          role="img"
          aria-label={`ภาพปก ${eventName}`}
          className="h-28 w-full rounded-2xl bg-cover bg-center sm:h-full sm:min-h-32"
          style={{
            backgroundImage: `url("${getEventCoverUrl(booking?.event.bannerUrl)}")`,
          }}
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-violet-tint px-3 py-1 text-xs font-bold text-violet">รีวิวพื้นที่บูธ</span>
            <span className="text-xs font-semibold text-muted">จากผู้เข้าร่วม</span>
            {review.status !== 'PUBLISHED' ? (
              <span className="rounded-full bg-[#fff3dd] px-3 py-1 text-xs font-bold text-[#895b08]">
                {review.status === 'HIDDEN' ? 'ผู้จัดงานซ่อนรีวิว' : 'รีวิวถูกลบ'}
              </span>
            ) : null}
          </div>
          <h3 className="mt-3 break-words text-lg font-black text-ink">
            {eventName}
          </h3>
          {context ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden />
              {zoneName} · Booth {context.booth.code} · {context.bookingCode}
            </p>
          ) : null}
          <p className="mt-4 whitespace-pre-wrap break-words rounded-2xl bg-[#faf8fd] px-4 py-3 leading-7 text-[#514b59]">
            {review.comment?.trim() || 'ไม่มีความคิดเห็น'}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="flex items-center gap-2 text-sm text-muted">
              <CalendarDays className="h-4 w-4" aria-hidden />
              ส่งเมื่อ {DATE_FORMATTER.format(new Date(review.createdAt))}
            </p>
            <div className="flex flex-wrap gap-2 xl:hidden">
              {eventIdentifier ? (
                <button
                  type="button"
                  onClick={(event) =>
                    onViewEvent(event, eventIdentifier, eventName)
                  }
                  className="sl-chip text-violet"
                >
                  ดู Event
                </button>
              ) : null}
              {canEdit && booking ? (
                <button type="button" onClick={(event) => onEdit(event, booking, review)} className="sl-action-secondary text-violet">
                  <Pencil className="h-4 w-4" aria-hidden /> แก้ไขรีวิว
                </button>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-start justify-between gap-3 sm:col-start-2 xl:col-start-auto xl:flex-col xl:items-end">
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-[#fff8dc] px-3 py-2 text-[#9a6700]" aria-label={`${review.rating} จาก 5 ดาว`}>
            {Array.from({ length: 5 }, (_, index) => (
              <Star key={index} className="h-4 w-4" fill={index < review.rating ? 'currentColor' : 'none'} aria-hidden />
            ))}
            <span className="ml-1 text-sm font-black">{review.rating}/5</span>
          </div>
          <div className="hidden flex-wrap justify-end gap-2 xl:flex">
            {eventIdentifier ? (
              <button
                type="button"
                onClick={(event) =>
                  onViewEvent(event, eventIdentifier, eventName)
                }
                className="sl-chip text-violet"
              >
                ดู Event
              </button>
            ) : null}
            {canEdit && booking ? (
              <button type="button" onClick={(event) => onEdit(event, booking, review)} className="sl-action-secondary text-violet">
                <Pencil className="h-4 w-4" aria-hidden /> แก้ไขรีวิว
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function PendingReviewCard({
  booking,
  onReview,
  onViewEvent,
}: {
  booking: MyBooking;
  onReview: (
    event: React.MouseEvent<HTMLElement>,
    booking: MyBooking,
    review: MyReview | null,
  ) => void;
  onViewEvent: (
    event: React.MouseEvent<HTMLElement>,
    identifier: string,
    name: string,
  ) => void;
}) {
  const eventIdentifier = booking.event.slug ?? booking.event.id;
  return (
    <article className="sl-surface overflow-hidden border-violet/20 p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-[112px_minmax(0,1fr)]">
        <div
          role="img"
          aria-label={`ภาพปก ${booking.event.name}`}
          className="h-28 w-full rounded-2xl bg-cover bg-center sm:h-full sm:min-h-32"
          style={{
            backgroundImage: `url("${getEventCoverUrl(booking.event.bannerUrl)}")`,
          }}
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full bg-violet-tint px-3 py-1 text-xs font-bold text-violet">รีวิวพื้นที่บูธ</span>
            <span className="text-xs font-semibold text-muted">ยังไม่ได้รีวิว</span>
          </div>
          <h3 className="mt-3 text-lg font-black">{booking.event.name}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            {booking.booth.zone.name ?? booking.booth.zone.code} · Booth {booking.booth.code} · {booking.bookingCode}
          </p>
          <p className="mt-3 rounded-2xl bg-[#faf8fd] px-4 py-3 text-sm leading-6 text-muted">
            งานจบแล้ว คุณสามารถเขียนรีวิวเพื่อแบ่งปันประสบการณ์ได้
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="flex items-center gap-2 text-sm text-muted">
            <CalendarDays className="h-4 w-4" aria-hidden />
            Event จบเมื่อ {DATE_FORMATTER.format(new Date(booking.event.endDate))}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={(event) =>
                  onViewEvent(event, eventIdentifier, booking.event.name)
                }
                className="sl-chip text-violet"
              >
                ดู Event
              </button>
              <button type="button" onClick={(event) => onReview(event, booking, null)} className="sl-action-primary shrink-0">
                เขียนรีวิว <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
