'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  MessageSquareText,
  RotateCcw,
  Star,
} from 'lucide-react';
import { getMyReviews, type MyReview } from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import {
  getUxPreviewMode,
  subscribeToUxPreview,
  UX_PREVIEW_TOKEN,
} from '@/lib/ux-preview';

type AccessState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'ready'; token: string }
  | { status: 'error'; message: string };

const PAGE_SIZE = 8;
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

function reviewTypeLabel(targetType: MyReview['targetType']): string {
  switch (targetType) {
    case 'BOOTH':
      return 'รีวิวพื้นที่บูธ';
    case 'ZONE':
      return 'รีวิวโซน';
    case 'SHOP':
      return 'รีวิวร้านค้า';
    case 'ORGANIZATION':
      return 'รีวิวผู้จัดงาน';
  }
}

export function MyReviewsScreen() {
  const [access, setAccess] = useState<AccessState>({ status: 'loading' });
  const [items, setItems] = useState<MyReview[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const firstPageRequestRef = useRef(0);
  const currentTokenRef = useRef<string | null>(null);

  async function loadFirstPage(token: string, signal?: AbortSignal) {
    const requestId = firstPageRequestRef.current + 1;
    firstPageRequestRef.current = requestId;
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await getMyReviews(token, 1, PAGE_SIZE, signal);
      if (
        signal?.aborted ||
        requestId !== firstPageRequestRef.current ||
        currentTokenRef.current !== token
      ) {
        return;
      }
      setItems(result.items);
      setPage(result.page);
      setTotal(result.total);
      setHasMore(result.hasMore);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      if (
        requestId !== firstPageRequestRef.current ||
        currentTokenRef.current !== token
      ) {
        return;
      }
      setLoadError(
        cause instanceof Error
          ? cause.message
          : 'ไม่สามารถโหลดรายการรีวิวได้',
      );
    } finally {
      if (
        !signal?.aborted &&
        requestId === firstPageRequestRef.current &&
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
          firstPageRequestRef.current += 1;
          currentTokenRef.current = null;
          setAccess({ status: 'signed-out' });
          setItems([]);
          setTotal(0);
        } else {
          const previewItems = previewReviews();
          currentTokenRef.current = UX_PREVIEW_TOKEN;
          setAccess({ status: 'ready', token: UX_PREVIEW_TOKEN });
          setItems(previewItems);
          setTotal(previewItems.length);
        }
        setHasMore(false);
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
        firstPageRequestRef.current += 1;
        currentTokenRef.current = null;
        setAccess({ status: 'signed-out' });
        setItems([]);
        setIsLoading(false);
        return;
      }

      currentTokenRef.current = token;
      setItems([]);
      setPage(1);
      setTotal(0);
      setHasMore(false);
      setAccess({ status: 'ready', token });
      await loadFirstPage(token, controller.signal);
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

  async function loadMore() {
    if (access.status !== 'ready' || !hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    setLoadError(null);
    try {
      const nextPage = page + 1;
      const result = await getMyReviews(
        access.token,
        nextPage,
        PAGE_SIZE,
      );
      if (currentTokenRef.current !== access.token) return;
      setItems((current) => [...current, ...result.items]);
      setPage(result.page);
      setTotal(result.total);
      setHasMore(result.hasMore);
    } catch (cause) {
      if (currentTokenRef.current !== access.token) return;
      setLoadError(
        cause instanceof Error
          ? cause.message
          : 'ไม่สามารถโหลดรายการเพิ่มเติมได้',
      );
    } finally {
      setIsLoadingMore(false);
    }
  }

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
          รวมคะแนนและความคิดเห็นเกี่ยวกับพื้นที่ที่คุณเคยส่งไว้
        </p>

        {access.status === 'loading' || isLoading ? (
          <div className="mt-8 grid gap-4" aria-label="กำลังโหลดรายการรีวิว">
            {[1, 2, 3].map((item) => (
              <div key={item} className="skeleton h-48 rounded-[28px]" />
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

        {access.status === 'ready' && !isLoading && loadError && items.length === 0 ? (
          <section className="sl-surface mt-8 p-8 text-center">
            <h2 className="text-xl font-black">โหลดรายการรีวิวไม่สำเร็จ</h2>
            <p role="alert" className="mt-2 text-danger">
              {loadError}
            </p>
            <button
              type="button"
              onClick={() => void loadFirstPage(access.token)}
              className="sl-action-primary mt-6"
            >
              <RotateCcw className="h-4 w-4" aria-hidden /> ลองอีกครั้ง
            </button>
          </section>
        ) : null}

        {access.status === 'ready' && !isLoading && !loadError && items.length === 0 ? (
          <section className="sl-surface mt-8 p-8 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-tint text-violet">
              <Star className="h-7 w-7" aria-hidden />
            </span>
            <h2 className="mt-5 text-xl font-black">ยังไม่มีรีวิวที่ส่งไว้</h2>
            <p className="mt-2 text-muted">
              เมื่อการจองเข้าเงื่อนไข คุณสามารถเปิดรายการจองและเขียนรีวิวพื้นที่ได้
            </p>
            <Link href="/bookings?tab=completed" className="sl-action-primary mt-6">
              ดูการจองที่เสร็จสิ้น
            </Link>
          </section>
        ) : null}

        {access.status === 'ready' && items.length > 0 ? (
          <section className="mt-8" aria-labelledby="my-review-list-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <span className="sl-kicker">Review history</span>
                <h2 id="my-review-list-title" className="mt-2 text-xl font-black">
                  รีวิวทั้งหมด {total} รายการ
                </h2>
              </div>
              <p className="text-sm text-muted">เรียงจากล่าสุด</p>
            </div>

            <div className="mt-4 grid gap-4">
              {items.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>

            {loadError ? (
              <p role="alert" className="mt-4 text-center text-sm font-bold text-danger">
                {loadError}
              </p>
            ) : null}

            {hasMore ? (
              <button
                type="button"
                disabled={isLoadingMore}
                onClick={() => void loadMore()}
                className="sl-action-secondary mx-auto mt-6 flex"
              >
                {isLoadingMore ? 'กำลังโหลด…' : 'โหลดรีวิวเพิ่มเติม'}
              </button>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}

function ReviewCard({ review }: { review: MyReview }) {
  const context = review.context;
  const zoneName = context?.zone.name ?? context?.zone.code;

  return (
    <article className="sl-surface overflow-hidden p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <span className="sl-kicker">{reviewTypeLabel(review.targetType)}</span>
          <h3 className="mt-2 break-words text-lg font-black text-ink">
            {context?.event.name ?? 'พื้นที่ที่คุณเคยรีวิว'}
          </h3>
          {context ? (
            <p className="mt-1 break-words text-sm text-muted">
              {zoneName} · บูธ {context.booth.code}
            </p>
          ) : null}
          {review.status !== 'PUBLISHED' ? (
            <span className="mt-3 inline-flex rounded-full border border-[#ead8b7] bg-[#fff8e8] px-3 py-1 text-xs font-bold text-[#895b08]">
              {review.status === 'HIDDEN'
                ? 'ถูกซ่อนโดยผู้จัดงาน'
                : 'ถูกลบโดยผู้จัดงาน'}
            </span>
          ) : null}
        </div>

        <div
          className="flex shrink-0 items-center gap-1 rounded-full bg-[#fff8dc] px-3 py-2 text-[#9a6700]"
          aria-label={`${review.rating} จาก 5 ดาว`}
        >
          {Array.from({ length: 5 }, (_, index) => (
            <Star
              key={index}
              className="h-4 w-4"
              fill={index < review.rating ? 'currentColor' : 'none'}
              aria-hidden
            />
          ))}
          <span className="ml-1 text-sm font-black">{review.rating}/5</span>
        </div>
      </div>

      <p className="mt-5 whitespace-pre-wrap break-words rounded-2xl bg-[#faf8fd] px-4 py-4 leading-7 text-[#514b59]">
        {review.comment?.trim() || 'ไม่ได้เขียนความคิดเห็นเพิ่มเติม'}
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="flex items-center gap-2 text-sm text-muted">
          <CalendarDays className="h-4 w-4" aria-hidden />
          ส่งเมื่อ {DATE_FORMATTER.format(new Date(review.createdAt))}
        </p>
        {context ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/events/${encodeURIComponent(context.event.slug)}`}
              className="sl-chip text-violet"
            >
              ดู Event
            </Link>
            <Link
              href={`/bookings/${encodeURIComponent(context.bookingCode)}`}
              className="sl-chip text-violet"
            >
              ดูการจอง <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        ) : null}
      </div>
    </article>
  );
}
