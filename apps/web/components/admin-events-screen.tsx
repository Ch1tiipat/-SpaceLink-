'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  AdminAccessGate,
  AdminEmpty,
  AdminError,
  AdminMetric,
  AdminPage,
  AdminPageHeader,
  AdminPanel,
  formatAdminDate,
  useAdminPageAccess,
} from '@/components/admin-ui';
import {
  getAdminOrganizationEvents,
  type AdminOrganizationEvent,
} from '@/lib/api';

type EventFilter = 'ALL' | AdminOrganizationEvent['status'];

const STATUS_LABELS: Record<AdminOrganizationEvent['status'], string> = {
  DRAFT: 'ฉบับร่าง',
  PUBLISHED: 'เผยแพร่แล้ว',
  ONGOING: 'กำลังจัดงาน',
  COMPLETED: 'จบงานแล้ว',
  CANCELLED: 'ยกเลิก',
};

const STATUS_STYLES: Record<AdminOrganizationEvent['status'], string> = {
  DRAFT: 'bg-[#f1eef4] text-[#655d70]',
  PUBLISHED: 'bg-[#eaf2ff] text-[#2459b5]',
  ONGOING: 'bg-[#e7f8ef] text-[#147653]',
  COMPLETED: 'bg-[#eee8ff] text-[#6734c4]',
  CANCELLED: 'bg-[#fff0ef] text-[#b42318]',
};

export function AdminEventsScreen() {
  const { access, token, organizationId, organization } = useAdminPageAccess();
  const [events, setEvents] = useState<AdminOrganizationEvent[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<EventFilter>('ALL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (access !== 'allowed' || !token || !organizationId) return;
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError('');

    void getAdminOrganizationEvents(organizationId, token, controller.signal)
      .then((rows) => {
        if (active) setEvents(rows);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        if (active) {
          setEvents([]);
          setError(cause instanceof Error ? cause.message : 'โหลดรายการอีเวนต์ไม่สำเร็จ');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [access, organizationId, reloadKey, token]);

  const visibleEvents = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('th-TH');
    return events.filter((event) => {
      const matchesStatus = status === 'ALL' || event.status === status;
      const matchesQuery =
        !normalized ||
        event.name.toLocaleLowerCase('th-TH').includes(normalized) ||
        event.venue.name.toLocaleLowerCase('th-TH').includes(normalized);
      return matchesStatus && matchesQuery;
    });
  }, [events, query, status]);

  const activeCount = events.filter(
    (event) => event.status === 'PUBLISHED' || event.status === 'ONGOING',
  ).length;
  const upcomingCount = events.filter(
    (event) => new Date(event.startDate).getTime() > Date.now(),
  ).length;

  return (
    <AdminAccessGate access={access}>
      <AdminPage>
        <AdminPageHeader
          eyebrow="Event management"
          title="อีเวนต์ของบริษัท"
          description="ดูรายการอีเวนต์ สถานที่ และช่วงเวลาจากข้อมูลจริงขององค์กร ปัจจุบัน Backend เปิดเฉพาะการอ่านรายการ"
          organizationName={organization?.name}
          actions={
            <button
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#ddd4e7] bg-white px-4 text-xs font-extrabold text-[#655d70] disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
              โหลดข้อมูลใหม่
            </button>
          }
        />

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <AdminMetric icon={CalendarDays} label="อีเวนต์ทั้งหมด" value={events.length} detail="GET organization events" />
          <AdminMetric icon={CalendarCheck2} label="กำลังเผยแพร่/จัดงาน" value={activeCount} tone="green" />
          <AdminMetric icon={CalendarClock} label="กำลังจะมาถึง" value={upcomingCount} tone="blue" />
        </div>

        <AdminPanel
          title="รายการอีเวนต์"
          description="Read-only — ไม่มีปุ่มสร้างหรือแก้ไขจนกว่า Backend จะเปิด write endpoint"
          className="mt-6"
          actions={
            <span className="rounded-full bg-[#f1eef4] px-3 py-1 text-[11px] font-extrabold text-[#655d70]">
              {visibleEvents.length} รายการ
            </span>
          }
        >
          <div className="flex flex-col gap-3 border-b border-[#eee9f3] p-4 sm:flex-row">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#ddd4e7] bg-[#fcfbff] px-3">
              <Search className="h-4 w-4 text-violet" aria-hidden />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ค้นหาชื่องานหรือสถานที่"
                className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as EventFilter)}
              className="h-10 rounded-xl border border-[#ddd4e7] bg-white px-3 text-sm font-bold text-[#655d70] outline-none"
            >
              <option value="ALL">ทุกสถานะ</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {error ? <AdminError message={error} /> : null}
          {loading ? (
            <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="skeleton h-44 rounded-[18px]" />
              ))}
            </div>
          ) : visibleEvents.length === 0 ? (
            <AdminEmpty icon={CalendarDays} title="ไม่พบอีเวนต์" description="ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ" />
          ) : (
            <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
              {visibleEvents.map((event) => (
                <article key={event.id} className="rounded-[18px] border border-[#e8e1ee] bg-[#fcfbff] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${STATUS_STYLES[event.status]}`}>
                      {STATUS_LABELS[event.status]}
                    </span>
                    <span className="text-[11px] font-bold text-muted">{event.venue.name}</span>
                  </div>
                  <h2 className="mt-4 text-lg font-black text-ink">{event.name}</h2>
                  <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-muted">
                    {event.description || 'ยังไม่มีรายละเอียดอีเวนต์'}
                  </p>
                  <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[#ebe5ef] pt-4 text-xs">
                    <div><dt className="text-muted">เริ่ม</dt><dd className="mt-1 font-extrabold text-ink">{formatAdminDate(event.startDate)}</dd></div>
                    <div><dt className="text-muted">สิ้นสุด</dt><dd className="mt-1 font-extrabold text-ink">{formatAdminDate(event.endDate)}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          )}
        </AdminPanel>
      </AdminPage>
    </AdminAccessGate>
  );
}
