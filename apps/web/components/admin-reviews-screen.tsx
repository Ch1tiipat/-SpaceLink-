'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  EyeOff,
  MessageSquareText,
  RefreshCw,
  RotateCcw,
  Star,
  Trash2,
} from 'lucide-react';
import {
  AdminAccessGate,
  AdminEmpty,
  AdminError,
  AdminMetric,
  AdminPage,
  AdminPageHeader,
  AdminPanel,
  useAdminPageAccess,
} from '@/components/admin-ui';
import {
  deleteReview,
  getOrganizationReviews,
  hideReview,
  restoreReview,
  type AdminReview,
  type AdminReviewsPage,
  type ReviewStatus,
} from '@/lib/api';

const STATUS_LABELS: Record<ReviewStatus, string> = {
  PUBLISHED: 'เผยแพร่',
  HIDDEN: 'ซ่อนอยู่',
  DELETED: 'ลบแล้ว',
};

type ModerationAction = 'hide' | 'restore' | 'delete';

export function AdminReviewsScreen() {
  const { access, token, organizationId, organization } = useAdminPageAccess();
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get('event') ?? '';
  const statusValue = searchParams.get('status');
  const status = isReviewStatus(statusValue) ? statusValue : undefined;
  const ratingValue = Number(searchParams.get('rating'));
  const rating = ratingValue >= 1 && ratingValue <= 5 ? ratingValue : undefined;
  const pageValue = Number(searchParams.get('page'));
  const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const [result, setResult] = useState<AdminReviewsPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [moderation, setModeration] = useState<{
    review: AdminReview;
    action: ModerationAction;
  } | null>(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (access !== 'allowed' || !token || !organizationId) return;
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError('');
    getOrganizationReviews(
      organizationId,
      token,
      { eventId: eventId || undefined, status, rating, page, limit: 25 },
      controller.signal,
    )
      .then((data) => {
        if (active) setResult(data);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        if (active) {
          setResult(null);
          setError(cause instanceof Error ? cause.message : 'โหลดข้อมูลรีวิวไม่สำเร็จ');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [access, eventId, organizationId, page, rating, reloadKey, status, token]);

  const average = useMemo(() => {
    if (!result?.items.length) return null;
    return result.items.reduce((sum, review) => sum + review.rating, 0) / result.items.length;
  }, [result]);

  function setFilter(key: 'event' | 'status' | 'rating' | 'page', value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    const query = next.toString();
    router.replace(query ? `/admin/reviews?${query}` : '/admin/reviews');
  }

  function openModeration(review: AdminReview, action: ModerationAction) {
    setModeration({ review, action });
    setReason('');
    setActionError('');
  }

  async function submitModeration() {
    if (!moderation || !token) return;
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setActionError('กรุณาระบุเหตุผล');
      return;
    }
    setSubmitting(true);
    setActionError('');
    try {
      if (moderation.action === 'hide') {
        await hideReview(moderation.review.id, trimmedReason, token);
      } else if (moderation.action === 'restore') {
        await restoreReview(moderation.review.id, trimmedReason, token);
      } else {
        await deleteReview(moderation.review.id, trimmedReason, token);
      }
      setModeration(null);
      setReloadKey((value) => value + 1);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'ดำเนินการไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminAccessGate access={access}>
      <AdminPage>
        <AdminPageHeader
          eyebrow="Review moderation"
          title="จัดการรีวิว"
          description="ตรวจสอบ ซ่อน คืนสถานะ หรือลบรีวิวของ Event ในองค์กร"
          organizationName={organization?.name}
          actions={
            <button type="button" onClick={() => setReloadKey((value) => value + 1)} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#ddd4e7] bg-white px-4 text-xs font-extrabold text-[#655d70] disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden /> โหลดใหม่
            </button>
          }
        />

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <AdminMetric icon={Star} label="คะแนนเฉลี่ยในหน้านี้" value={average === null ? '—' : average.toFixed(1)} tone="amber" />
          <AdminMetric icon={MessageSquareText} label="รีวิวตามตัวกรอง" value={result?.total ?? 0} />
          <AdminMetric icon={EyeOff} label="ซ่อนอยู่ในหน้านี้" value={result?.items.filter((item) => item.status === 'HIDDEN').length ?? 0} tone="blue" />
        </div>

        <AdminPanel className="mt-6" title="ตัวกรองรีวิว" description="ตัวกรองจะถูกเก็บใน URL เพื่อเปิดกลับมาดูชุดเดิมได้">
          <div className="grid gap-3 p-5 md:grid-cols-3">
            <label className="text-sm font-bold">Event
              <select value={eventId} onChange={(event) => setFilter('event', event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-line bg-white px-3">
                <option value="">ทุก Event</option>
                {result?.filters.events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-bold">สถานะ
              <select value={status ?? ''} onChange={(event) => setFilter('status', event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-line bg-white px-3">
                <option value="">ทุกสถานะ</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="text-sm font-bold">คะแนน
              <select value={rating ?? ''} onChange={(event) => setFilter('rating', event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-line bg-white px-3">
                <option value="">ทุกคะแนน</option>
                {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} ดาว</option>)}
              </select>
            </label>
          </div>
        </AdminPanel>

        {error ? <div className="mt-6"><AdminError message={error} /></div> : null}
        {loading ? <div className="skeleton mt-6 h-80 rounded-[20px]" /> : null}
        {!loading && !error && result?.items.length === 0 ? (
          <AdminPanel className="mt-6"><AdminEmpty icon={Star} title="ไม่พบรีวิว" description="ลองเปลี่ยนตัวกรอง หรือรอให้ผู้เข้าร่วมส่งรีวิวหลัง Event จบ" /></AdminPanel>
        ) : null}
        {!loading && result && result.items.length > 0 ? (
          <AdminPanel className="mt-6" title="รายการรีวิว" description="ชื่อผู้รีวิวถูกซ่อนเพื่อคงความเป็นส่วนตัว">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-line bg-[#faf8fd] text-xs text-muted"><tr><th className="px-5 py-3">ผู้รีวิว / ความคิดเห็น</th><th className="px-5 py-3">Event / บูธ</th><th className="px-5 py-3">คะแนน</th><th className="px-5 py-3">สถานะ</th><th className="px-5 py-3">จัดการ</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {result.items.map((review) => (
                    <tr key={review.id} className="align-top">
                      <td className="max-w-sm px-5 py-4"><strong>ผู้ใช้ SpaceLink</strong><p className="mt-2 whitespace-pre-wrap break-words leading-6 text-muted">{review.comment?.trim() || 'ไม่ได้เขียนความคิดเห็นเพิ่มเติม'}</p><p className="mt-2 text-xs text-muted">{new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' }).format(new Date(review.createdAt))}</p></td>
                      <td className="px-5 py-4"><strong>{review.event?.name ?? 'ข้อมูล Event เดิม'}</strong><p className="mt-1 text-muted">{review.booking ? `บูธ ${review.booking.booth.code} · ${review.booking.booth.zone.name ?? review.booking.booth.zone.code}` : 'ไม่มีข้อมูลการจองเดิม'}</p></td>
                      <td className="px-5 py-4 font-black text-[#9a6700]">{review.rating}/5 ★</td>
                      <td className="px-5 py-4"><span className="rounded-full bg-[#f4efff] px-3 py-1 text-xs font-bold text-violet">{STATUS_LABELS[review.status]}</span></td>
                      <td className="px-5 py-4"><div className="flex min-w-40 flex-wrap gap-2">
                        {review.status === 'PUBLISHED' ? <button type="button" onClick={() => openModeration(review, 'hide')} className="sl-chip"><EyeOff className="h-4 w-4" aria-hidden /> ซ่อน</button> : null}
                        {review.status === 'HIDDEN' ? <button type="button" onClick={() => openModeration(review, 'restore')} className="sl-chip"><RotateCcw className="h-4 w-4" aria-hidden /> คืนสถานะ</button> : null}
                        {review.status !== 'DELETED' ? <button type="button" onClick={() => openModeration(review, 'delete')} className="sl-chip text-danger"><Trash2 className="h-4 w-4" aria-hidden /> ลบ</button> : null}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-line p-5">
              <button type="button" disabled={page <= 1} onClick={() => setFilter('page', String(page - 1))} className="sl-action-secondary disabled:opacity-40">หน้าก่อนหน้า</button>
              <span className="text-sm text-muted">หน้า {result.page}</span>
              <button type="button" disabled={!result.hasMore} onClick={() => setFilter('page', String(page + 1))} className="sl-action-secondary disabled:opacity-40">หน้าถัดไป</button>
            </div>
          </AdminPanel>
        ) : null}

        {moderation ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" role="presentation" onMouseDown={() => !submitting && setModeration(null)}>
            <section role="dialog" aria-modal="true" aria-labelledby="moderation-title" className="w-full max-w-lg rounded-[24px] bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
              <h2 id="moderation-title" className="text-xl font-black">{moderation.action === 'hide' ? 'ซ่อนรีวิว' : moderation.action === 'restore' ? 'คืนสถานะรีวิว' : 'ลบรีวิว'}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">การดำเนินการนี้จะบันทึกผู้ดำเนินการ เวลา เหตุผล และสถานะก่อน–หลังใน Audit Log</p>
              <label className="mt-5 block text-sm font-bold">เหตุผล<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={4} className="mt-2 w-full rounded-2xl border border-line px-4 py-3" placeholder="ระบุเหตุผลในการจัดการรีวิว" /></label>
              {actionError ? <p role="alert" className="mt-3 text-sm font-bold text-danger">{actionError}</p> : null}
              <div className="mt-5 flex justify-end gap-3"><button type="button" disabled={submitting} onClick={() => setModeration(null)} className="sl-action-secondary">ยกเลิก</button><button type="button" disabled={submitting} onClick={() => void submitModeration()} className="sl-action-primary">{submitting ? 'กำลังบันทึก…' : 'ยืนยัน'}</button></div>
            </section>
          </div>
        ) : null}
      </AdminPage>
    </AdminAccessGate>
  );
}

function isReviewStatus(value: string | null): value is ReviewStatus {
  return value === 'PUBLISHED' || value === 'HIDDEN' || value === 'DELETED';
}
