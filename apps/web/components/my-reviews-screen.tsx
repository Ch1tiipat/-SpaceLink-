'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MessageSquareText,
  Search,
  Star,
} from 'lucide-react';
import {
  ReviewEditorPopup,
  type SavedReviewDraft,
} from '@/components/booking-review-screen';
import { getPreviewBookings } from '@/components/booking-detail-screen';
import {
  getMyBookings,
  getMyReviews,
  type MyBooking,
  type MyReview,
} from '@/lib/api';
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
  const requestRef = useRef(0);
  const currentTokenRef = useRef<string | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

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
          จัดการคะแนนและความคิดเห็นของงานที่จบแล้วได้ในที่เดียว
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
              <SummaryCard icon={CheckCircle2} label="รีวิวแล้ว" value={reviews.length.toString()} tone="violet" />
              <SummaryCard icon={Star} label="คะแนนเฉลี่ย" value={average ? average.toFixed(1) : '0.0'} tone="amber" />
              <SummaryCard icon={Star} label="รีวิว 5 ดาว" value={fiveStarCount.toString()} tone="green" />
              <SummaryCard icon={Clock3} label="รอรีวิว" value={pendingBookings.length.toString()} tone="blue" />
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
                        />
                      ) : (
                        <PendingReviewCard
                          key={item.booking.id}
                          booking={item.booking}
                          onReview={openEditor}
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

              <aside className="sl-surface h-fit p-5 lg:sticky lg:top-24">
                <h2 className="text-lg font-black">สรุปการให้คะแนน</h2>
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
                    const count = reviews.filter((review) => review.rating === rating).length;
                    const width = reviews.length ? (count / reviews.length) * 100 : 0;
                    return (
                      <div key={rating} className="grid grid-cols-[36px_1fr_24px] items-center gap-2 text-xs text-muted">
                        <span>{rating} ดาว</span>
                        <span className="h-2 overflow-hidden rounded-full bg-[#eee8f5]">
                          <span className="block h-full rounded-full bg-[linear-gradient(90deg,#6f2ee8,#9c62ff)]" style={{ width: `${width}%` }} />
                        </span>
                        <span className="text-right font-bold text-ink">{count}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 rounded-2xl bg-[#f8f4ff] p-4 text-sm leading-6 text-muted">
                  รีวิวได้เฉพาะการจองที่เสร็จสิ้นและ Event จบแล้วเท่านั้น
                  การแก้ไขจะอัปเดตรีวิวเดิมโดยไม่สร้างรายการซ้ำ
                </div>
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
    </main>
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
}: {
  review: MyReview;
  booking: MyBooking | null;
  onEdit: (
    event: React.MouseEvent<HTMLElement>,
    booking: MyBooking,
    review: MyReview | null,
  ) => void;
}) {
  const context = review.context;
  const zoneName = context?.zone.name ?? context?.zone.code;
  const canEdit = Boolean(booking && review.status !== 'DELETED');

  return (
    <article className="sl-surface overflow-hidden p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-violet-tint px-3 py-1 text-xs font-bold text-violet">รีวิวแล้ว</span>
            {review.status !== 'PUBLISHED' ? (
              <span className="rounded-full bg-[#fff3dd] px-3 py-1 text-xs font-bold text-[#895b08]">
                {review.status === 'HIDDEN' ? 'ผู้จัดงานซ่อนรีวิว' : 'รีวิวถูกลบ'}
              </span>
            ) : null}
          </div>
          <h3 className="mt-3 break-words text-lg font-black text-ink">
            {context?.event.name ?? 'พื้นที่ที่คุณเคยรีวิว'}
          </h3>
          {context ? (
            <p className="mt-1 text-sm text-muted">
              {context.bookingCode} · บูธ {context.booth.code} · {zoneName}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-full bg-[#fff8dc] px-3 py-2 text-[#9a6700]" aria-label={`${review.rating} จาก 5 ดาว`}>
          {Array.from({ length: 5 }, (_, index) => (
            <Star key={index} className="h-4 w-4" fill={index < review.rating ? 'currentColor' : 'none'} aria-hidden />
          ))}
          <span className="ml-1 text-sm font-black">{review.rating}/5</span>
        </div>
      </div>

      <p className="mt-5 whitespace-pre-wrap break-words rounded-2xl bg-[#faf8fd] px-4 py-4 leading-7 text-[#514b59]">
        {review.comment?.trim() || 'ไม่มีความคิดเห็น'}
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="flex items-center gap-2 text-sm text-muted">
          <CalendarDays className="h-4 w-4" aria-hidden />
          ส่งเมื่อ {DATE_FORMATTER.format(new Date(review.createdAt))}
        </p>
        <div className="flex flex-wrap gap-2">
          {context ? (
            <Link href={`/events/${encodeURIComponent(context.event.slug)}`} className="sl-chip text-violet">
              ดู Event
            </Link>
          ) : null}
          {canEdit && booking ? (
            <button type="button" onClick={(event) => onEdit(event, booking, review)} className="sl-action-secondary text-violet">
              แก้ไขรีวิว
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function PendingReviewCard({
  booking,
  onReview,
}: {
  booking: MyBooking;
  onReview: (
    event: React.MouseEvent<HTMLElement>,
    booking: MyBooking,
    review: MyReview | null,
  ) => void;
}) {
  return (
    <article className="sl-surface overflow-hidden border-violet/20 p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="inline-flex rounded-full bg-[#fff3dd] px-3 py-1 text-xs font-bold text-[#986200]">รอรีวิว</span>
          <h3 className="mt-3 text-lg font-black">{booking.event.name}</h3>
          <p className="mt-1 text-sm text-muted">
            {booking.bookingCode} · บูธ {booking.booth.code} · {booking.booth.zone.name ?? booking.booth.zone.code}
          </p>
          <p className="mt-3 flex items-center gap-2 text-sm text-muted">
            <CalendarDays className="h-4 w-4" aria-hidden />
            Event จบเมื่อ {DATE_FORMATTER.format(new Date(booking.event.endDate))}
          </p>
        </div>
        <button type="button" onClick={(event) => onReview(event, booking, null)} className="sl-action-primary shrink-0">
          เขียนรีวิว <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </article>
  );
}
