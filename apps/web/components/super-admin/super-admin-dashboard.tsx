'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarCheck2,
  CircleDollarSign,
  RefreshCw,
  ShieldAlert,
  TicketCheck,
} from 'lucide-react';
import {
  getSuperAdminAuditLogs,
  getSuperAdminBookings,
  getSuperAdminOrganizations,
  getSuperAdminPenalties,
  getSuperAdminRefunds,
  getSuperAdminSupportTickets,
  type SuperAdminAuditLog,
  type SuperAdminBooking,
  type SuperAdminOrganization,
  type SuperAdminPenaltiesOverview,
  type SuperAdminRefund,
  type SuperAdminSupportTicket,
} from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabase';

type DashboardData = {
  organizations: SuperAdminOrganization[];
  bookings: SuperAdminBooking[];
  refunds: SuperAdminRefund[];
  tickets: SuperAdminSupportTicket[];
  penalties: SuperAdminPenaltiesOverview;
  auditLogs: SuperAdminAuditLog[];
};

const EMPTY_DATA: DashboardData = {
  organizations: [],
  bookings: [],
  refunds: [],
  tickets: [],
  penalties: { penalties: [], blacklistedUsers: [] },
  auditLogs: [],
};

const THAI_DATE_TIME = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Bangkok',
});

export function SuperAdminDashboard() {
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [failedSections, setFailedSections] = useState<string[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(() => setReloadKey((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setFailedSections([]);

    void (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('ไม่พบเซสชันผู้ดูแลระบบ');

        const results = await Promise.allSettled([
          getSuperAdminOrganizations(token, controller.signal),
          getSuperAdminBookings(token, controller.signal),
          getSuperAdminRefunds(token, controller.signal),
          getSuperAdminSupportTickets(token, controller.signal),
          getSuperAdminPenalties(token, controller.signal),
          getSuperAdminAuditLogs(token, controller.signal),
        ] as const);
        if (!active) return;

        const failed: string[] = [];
        const read = <T,>(
          result: PromiseSettledResult<T>,
          fallback: T,
          label: string,
        ): T => {
          if (result.status === 'fulfilled') return result.value;
          failed.push(label);
          return fallback;
        };

        setData({
          organizations: read(results[0], [], 'องค์กร'),
          bookings: read(results[1], [], 'การจอง'),
          refunds: read(results[2], [], 'คืนเงิน'),
          tickets: read(results[3], [], 'คำร้องช่วยเหลือ'),
          penalties: read(
            results[4],
            { penalties: [], blacklistedUsers: [] },
            'บทลงโทษ',
          ),
          auditLogs: read(results[5], [], 'กิจกรรมระบบ'),
        });
        setFailedSections(failed);
      } catch {
        if (active) {
          setData(EMPTY_DATA);
          setFailedSections(['ข้อมูลทั้งหมด']);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadKey]);

  const activeOrganizations = data.organizations.filter(
    (organization) => organization.status === 'ACTIVE',
  ).length;
  const activeBookings = data.bookings.filter(
    (booking) =>
      booking.status === 'CONFIRMED' ||
      booking.status === 'PENDING_PAYMENT',
  ).length;
  const pendingRefunds = data.refunds.filter(
    (refund) => refund.status === 'PENDING',
  ).length;
  const openTickets = data.tickets.filter(
    (ticket) => ticket.status !== 'CLOSED',
  ).length;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-violet">
            Super Admin Dashboard
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink sm:text-4xl">
            ภาพรวมแพลตฟอร์ม
          </h1>
          <p className="mt-2 text-sm text-muted">
            สถานะทุกองค์กร การจอง และรายการที่ต้องติดตามจากข้อมูลจริง
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#e3dced] bg-white px-4 text-sm font-bold text-[#655d70] shadow-sm transition hover:border-violet-200 hover:text-violet disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          โหลดข้อมูลใหม่
        </button>
      </div>

      {failedSections.length > 0 && (
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              โหลดส่วนต่อไปนี้ไม่สำเร็จ: {failedSections.join(', ')} — ส่วนอื่นยังแสดงผลได้ตามปกติ
            </p>
          </div>
          <button type="button" onClick={load} className="shrink-0 font-extrabold underline">
            ลองอีกครั้ง
          </button>
        </div>
      )}

      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="ตัวชี้วัดหลัก">
        <MetricCard
          title="องค์กรที่ใช้งาน"
          value={activeOrganizations}
          detail={`จากทั้งหมด ${data.organizations.length} องค์กร`}
          icon={Building2}
          tone="violet"
          loading={loading}
        />
        <MetricCard
          title="การจองที่กำลังดำเนินการ"
          value={activeBookings}
          detail={`จากทั้งหมด ${data.bookings.length} รายการ`}
          icon={CalendarCheck2}
          tone="blue"
          loading={loading}
        />
        <MetricCard
          title="คำร้องคืนเงินรอตรวจ"
          value={pendingRefunds}
          detail={`จากทั้งหมด ${data.refunds.length} คำร้อง`}
          icon={CircleDollarSign}
          tone="amber"
          loading={loading}
        />
        <MetricCard
          title="Support ที่ยังไม่ปิด"
          value={openTickets}
          detail={`จากทั้งหมด ${data.tickets.length} คำร้อง`}
          icon={TicketCheck}
          tone="red"
          loading={loading}
        />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
        <section className="overflow-hidden rounded-[22px] border border-[#e9e4ef] bg-white shadow-[0_12px_32px_rgba(53,39,76,0.055)]">
          <div className="flex items-center justify-between border-b border-[#eeeaf3] px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-lg font-black text-ink">กิจกรรมล่าสุด</h2>
              <p className="text-xs text-muted">Audit log จากการจัดการระดับแพลตฟอร์ม</p>
            </div>
            <Activity className="h-5 w-5 text-violet" />
          </div>
          {loading ? (
            <TableSkeleton />
          ) : data.auditLogs.length === 0 ? (
            <EmptyState message="ยังไม่มีกิจกรรมในระบบ" />
          ) : (
            <div className="divide-y divide-[#f0edf4]">
              {data.auditLogs.slice(0, 6).map((log) => (
                <div key={log.id} className="grid gap-1 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-6">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">{humanizeAction(log.action)}</p>
                    <p className="truncate text-xs text-muted">
                      {log.actor.fullName || log.actor.email} · {log.targetType}
                    </p>
                  </div>
                  <time className="text-xs font-medium text-[#918a9b]" dateTime={log.createdAt}>
                    {THAI_DATE_TIME.format(new Date(log.createdAt))}
                  </time>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="grid content-start gap-6">
          <section className="rounded-[22px] border border-[#e9e4ef] bg-white p-5 shadow-[0_12px_32px_rgba(53,39,76,0.055)] sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-red-50 text-red-700">
                <ShieldAlert className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-black text-ink">การกำกับดูแล</h2>
                <p className="text-xs text-muted">ข้อมูลบทลงโทษข้ามองค์กร</p>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-3">
              <SummaryCell label="บทลงโทษทั้งหมด" value={data.penalties.penalties.length} loading={loading} />
              <SummaryCell label="ผู้ใช้ Blacklist" value={data.penalties.blacklistedUsers.length} loading={loading} />
            </dl>
          </section>

          <Link
            href="/super-admin/organizations"
            className="group flex items-center justify-between rounded-[22px] bg-gradient-to-br from-[#6d28d9] to-[#8b5cf6] p-5 text-white shadow-[0_16px_34px_rgba(109,40,217,0.22)] transition hover:-translate-y-0.5 sm:p-6"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-violet-100">Quick action</p>
              <p className="mt-1 text-lg font-black">จัดการองค์กร</p>
              <p className="mt-1 text-sm text-violet-100">สร้าง ค้นหา และเปลี่ยนสถานะองค์กร</p>
            </div>
            <ArrowRight className="h-6 w-6 transition group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </div>
  );
}

const TONES = {
  violet: 'bg-violet-tint text-violet',
  blue: 'bg-blue-50 text-blue-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700',
};

function MetricCard({ title, value, detail, icon: Icon, tone, loading }: {
  title: string;
  value: number;
  detail: string;
  icon: typeof Building2;
  tone: keyof typeof TONES;
  loading: boolean;
}) {
  return (
    <article className="rounded-[22px] border border-[#e9e4ef] bg-white p-5 shadow-[0_10px_28px_rgba(53,39,76,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-[#756e7f]">{title}</p>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${TONES[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      {loading ? <div className="mt-5 h-9 w-20 animate-pulse rounded-lg bg-[#eeeaf3]" /> : <p className="mt-4 text-3xl font-black tracking-[-0.04em] text-ink">{value.toLocaleString('th-TH')}</p>}
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </article>
  );
}

function SummaryCell({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return (
    <div className="rounded-2xl bg-[#faf8fc] p-3">
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-black text-ink">{loading ? '—' : value.toLocaleString('th-TH')}</dd>
    </div>
  );
}

function TableSkeleton() {
  return <div className="grid gap-4 p-6">{[1, 2, 3, 4].map((item) => <div key={item} className="h-10 animate-pulse rounded-xl bg-[#f2eff5]" />)}</div>;
}

function EmptyState({ message }: { message: string }) {
  return <div className="px-6 py-14 text-center text-sm font-semibold text-muted">{message}</div>;
}

function humanizeAction(action: string) {
  return action.toLowerCase().replaceAll('_', ' ');
}
