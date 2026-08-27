'use client';

import { useEffect, useMemo, useState } from 'react';
import { MessageSquareText, RefreshCw, Star, Store, Tags } from 'lucide-react';
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
  getAdminOrganizationBookings,
  getAverageRating,
  type AdminOrganizationBooking,
  type ReviewTargetType,
} from '@/lib/api';

type ReviewAggregate = {
  key: string;
  targetType: 'ZONE' | 'SHOP';
  targetId: string;
  label: string;
  average: number | null;
  count: number;
};

export function AdminReviewsScreen() {
  const { access, token, organizationId, organization } = useAdminPageAccess();
  const [rows, setRows] = useState<ReviewAggregate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (access !== 'allowed' || !token || !organizationId) return;
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError('');

    void (async () => {
      try {
        const bookings = await getAdminOrganizationBookings(
          organizationId,
          token,
          controller.signal,
        );
        const targets = deriveTargets(bookings);
        const results = await Promise.allSettled(
          targets.map((target) =>
            getAverageRating(target.targetType, target.targetId, controller.signal),
          ),
        );
        if (!active) return;
        setRows(
          targets.map((target, index) => {
            const result = results[index];
            return {
              ...target,
              average: result.status === 'fulfilled' ? result.value.average : null,
              count: result.status === 'fulfilled' ? result.value.count : 0,
            };
          }),
        );
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        if (active) {
          setRows([]);
          setError(cause instanceof Error ? cause.message : 'โหลดข้อมูลรีวิวไม่สำเร็จ');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [access, organizationId, reloadKey, token]);

  const totalReviews = rows.reduce((total, row) => total + row.count, 0);
  const weightedScore = rows.reduce(
    (total, row) => total + (row.average ?? 0) * row.count,
    0,
  );
  const overallAverage = totalReviews > 0 ? weightedScore / totalReviews : null;
  const zoneRows = useMemo(() => rows.filter((row) => row.targetType === 'ZONE'), [rows]);
  const shopRows = useMemo(() => rows.filter((row) => row.targetType === 'SHOP'), [rows]);

  return (
    <AdminAccessGate access={access}>
      <AdminPage>
        <AdminPageHeader
          eyebrow="Review insights"
          title="ภาพรวมรีวิว"
          description="ดูคะแนนเฉลี่ยของโซนและร้านค้าที่เกี่ยวข้องกับองค์กรจาก endpoint รีวิวปัจจุบัน"
          organizationName={organization?.name}
          actions={
            <button
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#ddd4e7] bg-white px-4 text-xs font-extrabold text-[#655d70] disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
              โหลดใหม่
            </button>
          }
        />

        <div className="mt-6 rounded-[16px] border border-[#dfd3ef] bg-[#f7f2ff] px-4 py-3 text-sm leading-6 text-[#5f3ca1]">
          Backend ยังไม่มี endpoint รายการความคิดเห็นสำหรับ ORG_ADMIN หน้านี้จึงแสดงเฉพาะคะแนนเฉลี่ยและจำนวนรีวิว ไม่มีปุ่มซ่อน/ลบรีวิวที่ทำงานจริง
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <AdminMetric icon={Star} label="คะแนนเฉลี่ยรวม" value={overallAverage === null ? '—' : overallAverage.toFixed(1)} tone="amber" />
          <AdminMetric icon={MessageSquareText} label="จำนวนรีวิวรวม" value={totalReviews} />
          <AdminMetric icon={Tags} label="เป้าหมายที่ตรวจ" value={rows.length} tone="blue" />
        </div>

        {error ? <div className="mt-6"><AdminError message={error} /></div> : null}
        {loading ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="skeleton h-80 rounded-[20px]" />
            <div className="skeleton h-80 rounded-[20px]" />
          </div>
        ) : rows.length === 0 ? (
          <AdminPanel className="mt-6"><AdminEmpty icon={Star} title="ยังไม่มีข้อมูลคะแนน" description="ระบบจะสรุปคะแนนเมื่อมี Booking และรีวิวที่เกี่ยวข้อง" /></AdminPanel>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <RatingPanel title="คะแนนตามโซน" icon={Tags} rows={zoneRows} />
            <RatingPanel title="คะแนนตามร้านค้า" icon={Store} rows={shopRows} />
          </div>
        )}
      </AdminPage>
    </AdminAccessGate>
  );
}

function RatingPanel({
  title,
  icon: Icon,
  rows,
}: {
  title: string;
  icon: typeof Tags;
  rows: ReviewAggregate[];
}) {
  return (
    <AdminPanel title={title} description="ข้อมูล aggregate จาก GET /reviews/average">
      {rows.length === 0 ? (
        <AdminEmpty icon={Icon} title="ยังไม่มีรายการ" description="ไม่พบเป้าหมายประเภทนี้ใน Booking ขององค์กร" />
      ) : (
        <ul className="divide-y divide-[#eee9f3]">
          {rows.map((row) => (
            <li key={row.key} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="truncate font-extrabold text-ink">{row.label}</p>
                <p className="mt-1 text-xs text-muted">{row.count} รีวิว</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#fff4df] px-3 py-1.5 text-sm font-black text-[#9a570f]">
                <Star className="h-4 w-4 fill-current" aria-hidden />
                {row.average === null ? '—' : row.average.toFixed(1)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </AdminPanel>
  );
}

function deriveTargets(bookings: AdminOrganizationBooking[]) {
  const targets = new Map<
    string,
    Omit<ReviewAggregate, 'average' | 'count'>
  >();
  bookings.forEach((booking) => {
    const zoneKey = `ZONE:${booking.booth.zone.id}`;
    if (!targets.has(zoneKey)) {
      targets.set(zoneKey, {
        key: zoneKey,
        targetType: 'ZONE',
        targetId: booking.booth.zone.id,
        label: booking.booth.zone.name || `โซน ${booking.booth.zone.code}`,
      });
    }
    const shopKey = `SHOP:${booking.shop.id}`;
    if (!targets.has(shopKey)) {
      targets.set(shopKey, {
        key: shopKey,
        targetType: 'SHOP',
        targetId: booking.shop.id,
        label: booking.shop.name,
      });
    }
  });
  return [...targets.values()].slice(0, 50) as Array<{
    key: string;
    targetType: Extract<ReviewTargetType, 'ZONE' | 'SHOP'>;
    targetId: string;
    label: string;
  }>;
}
