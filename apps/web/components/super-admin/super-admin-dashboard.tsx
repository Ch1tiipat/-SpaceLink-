'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarCheck2,
  ChartNoAxesCombined,
  Check,
  Circle,
  CircleDollarSign,
  LoaderCircle,
  Megaphone,
  Minus,
  RefreshCw,
  Send,
  ShieldAlert,
  TicketCheck,
  X,
} from 'lucide-react';
import {
  createSystemBroadcast,
  getSuperAdminAuditLogs,
  getSuperAdminBookings,
  getSuperAdminCompanyAdmins,
  getSuperAdminOrganizations,
  getSuperAdminPenalties,
  getSuperAdminRefunds,
  getSuperAdminSupportTickets,
  type SuperAdminAuditLog,
  type SuperAdminBooking,
  type SuperAdminCompanyAdmin,
  type SuperAdminOrganization,
  type SuperAdminOrganizationStatus,
  type SuperAdminPenaltiesOverview,
  type SuperAdminRefund,
  type SuperAdminSupportTicket,
} from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabase';

type ChartMode = 'donut' | 'bar' | 'line';

const THAI_DATE_TIME = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Bangkok',
});

export function SuperAdminDashboard() {
  const [organizations, setOrganizations] = useState<SuperAdminOrganization[]>([]);
  const [admins, setAdmins] = useState<SuperAdminCompanyAdmin[]>([]);
  const [bookings, setBookings] = useState<SuperAdminBooking[]>([]);
  const [refunds, setRefunds] = useState<SuperAdminRefund[]>([]);
  const [tickets, setTickets] = useState<SuperAdminSupportTicket[]>([]);
  const [penalties, setPenalties] = useState<SuperAdminPenaltiesOverview>({
    penalties: [],
    blacklistedUsers: [],
  });
  const [auditLogs, setAuditLogs] = useState<SuperAdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedSections, setFailedSections] = useState<string[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [chartMode, setChartMode] = useState<ChartMode>('line');
  const [broadcastDialogOpen, setBroadcastDialogOpen] = useState(false);
  const [broadcastNotice, setBroadcastNotice] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setFailedSections([]);

    void (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error('ไม่พบเซสชันผู้ดูแลระบบ');

        const results = await Promise.allSettled([
          getSuperAdminOrganizations(token, controller.signal),
          getSuperAdminCompanyAdmins(token, controller.signal),
          getSuperAdminBookings(token, controller.signal),
          getSuperAdminRefunds(token, controller.signal),
          getSuperAdminSupportTickets(token, controller.signal),
          getSuperAdminPenalties(token, controller.signal),
          getSuperAdminAuditLogs(token, controller.signal),
        ] as const);
        if (!active) return;

        const failed: string[] = [];
        if (results[0].status === 'fulfilled') {
          setOrganizations(results[0].value);
        } else {
          setOrganizations([]);
          failed.push('องค์กร');
        }
        if (results[1].status === 'fulfilled') {
          setAdmins(results[1].value);
        } else {
          setAdmins([]);
          failed.push('แอดมินบริษัท');
        }
        if (results[2].status === 'fulfilled') {
          setBookings(results[2].value);
        } else {
          setBookings([]);
          failed.push('การจอง');
        }
        if (results[3].status === 'fulfilled') {
          setRefunds(results[3].value);
        } else {
          setRefunds([]);
          failed.push('คืนเงิน');
        }
        if (results[4].status === 'fulfilled') {
          setTickets(results[4].value);
        } else {
          setTickets([]);
          failed.push('คำร้องช่วยเหลือ');
        }
        if (results[5].status === 'fulfilled') {
          setPenalties(results[5].value);
        } else {
          setPenalties({ penalties: [], blacklistedUsers: [] });
          failed.push('บทลงโทษ');
        }
        if (results[6].status === 'fulfilled') {
          setAuditLogs(results[6].value);
        } else {
          setAuditLogs([]);
          failed.push('กิจกรรมล่าสุด');
        }
        setFailedSections(failed);
      } catch {
        if (active) {
          setOrganizations([]);
          setAdmins([]);
          setBookings([]);
          setRefunds([]);
          setTickets([]);
          setPenalties({ penalties: [], blacklistedUsers: [] });
          setAuditLogs([]);
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

  const counts = useMemo(() => countStatuses(organizations), [organizations]);
  const activeBookings = useMemo(
    () =>
      bookings.filter(
        (booking) =>
          booking.status === 'CONFIRMED' ||
          booking.status === 'PENDING_PAYMENT',
      ).length,
    [bookings],
  );
  const pendingRefunds = useMemo(
    () => refunds.filter((refund) => refund.status === 'PENDING').length,
    [refunds],
  );
  const openTickets = useMemo(
    () => tickets.filter((ticket) => ticket.status !== 'CLOSED').length,
    [tickets],
  );
  const adminCounts = useMemo(() => {
    const result = new Map<string, number>();
    admins.forEach((admin) => {
      result.set(
        admin.organization.id,
        (result.get(admin.organization.id) ?? 0) + 1,
      );
    });
    return result;
  }, [admins]);
  const watchlist = useMemo(
    () =>
      [...organizations]
        .sort((left, right) => statusPriority(left.status) - statusPriority(right.status))
        .slice(0, 4),
    [organizations],
  );

  return (
    <div className="mx-auto w-full max-w-[1440px] px-[15px] pb-11 pt-[23px] sm:px-[34px] sm:pt-[31px]">
      <section className="flex flex-col items-start justify-between gap-[18px] sm:flex-row sm:items-end">
        <div>
          <span className="text-[11px] font-extrabold tracking-[1.1px] text-[#7c3aed]">
            ORGANIZATION OVERVIEW
          </span>
          <h1 className="mb-[5px] mt-[7px] text-[27px] font-black tracking-[-.8px] text-[#242032]">
            ภาพรวมระบบ
          </h1>
          <p className="m-0 text-[15px] text-[#82788b]">
            สรุปสถานะองค์กรจากข้อมูลจริงที่ Backend รองรับ
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setBroadcastNotice(null);
              setBroadcastDialogOpen(true);
            }}
            className="inline-flex min-h-[38px] items-center gap-2 rounded-lg bg-[#6d28d9] px-[13px] text-[13px] font-bold text-white shadow-[0_8px_20px_rgba(109,40,217,.2)] transition hover:bg-[#5b21b6]"
          >
            <Megaphone className="h-4 w-4" aria-hidden />
            ส่งประกาศระบบ
          </button>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            disabled={loading}
            className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-[#e7dfea] bg-white px-[13px] text-[13px] font-bold text-[#716675] transition hover:border-[#d5c3e8] hover:text-[#6d28d9] disabled:opacity-55"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            โหลดข้อมูลใหม่
          </button>
        </div>
      </section>

      {broadcastNotice ? (
        <p role="status" className="mt-3 rounded-[11px] border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm font-bold text-emerald-800">
          {broadcastNotice}
        </p>
      ) : null}

      <section className="mt-6 flex flex-col gap-3 rounded-[11px] border border-[#e1d5ef] bg-[#fbf8ff] px-3.5 py-3 text-xs text-[#675d70] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#eee5fb] text-[11px] font-extrabold text-[#6d28d9]">
            i
          </span>
          <div>
            <strong className="block text-[13px] text-[#242032]">
              Dashboard ใช้ข้อมูลจริงครบทั้งองค์กร การดำเนินงาน และการกำกับดูแล
            </strong>
            <span className="mt-1 block leading-relaxed">
              GET /organizations, /admins, /bookings, /refunds, /support-tickets, /penalties และ /audit-logs
            </span>
          </div>
        </div>
        <Link href="/super-admin/organizations" className="shrink-0 font-extrabold text-[#6d28d9]">
          ดูองค์กรทั้งหมด →
        </Link>
      </section>

      {failedSections.length > 0 ? (
        <div className="mt-3 flex items-start gap-2 rounded-[11px] border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          โหลด {failedSections.join(', ')} ไม่สำเร็จ ส่วนอื่นยังใช้งานได้ตามปกติ
        </div>
      ) : null}

      <section className="mt-[18px] grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4" aria-label="ตัวเลขสำคัญ">
        <MetricCard label="องค์กรทั้งหมด" value={organizations.length} detail="GET /organizations" tone="purple" icon={Building2} loading={loading} />
        <MetricCard label="ACTIVE" value={counts.ACTIVE} detail={percentage(counts.ACTIVE, organizations.length)} tone="green" icon={Check} loading={loading} />
        <MetricCard label="INACTIVE" value={counts.INACTIVE} detail={percentage(counts.INACTIVE, organizations.length)} tone="orange" icon={Minus} loading={loading} />
        <MetricCard label="SUSPENDED" value={counts.SUSPENDED} detail={percentage(counts.SUSPENDED, organizations.length)} tone="red" icon={AlertTriangle} loading={loading} />
      </section>

      <div className="mt-6">
        <span className="text-[11px] font-extrabold tracking-[.8px] text-[#7c3aed]">
          PLATFORM OPERATIONS
        </span>
        <h2 className="mt-1 text-[17px] font-black text-[#242032]">
          ภาพรวมการดำเนินงาน
        </h2>
      </div>
      <section className="mt-3 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4" aria-label="ตัวเลขการดำเนินงาน">
        <MetricCard label="องค์กรที่ใช้งาน" value={counts.ACTIVE} detail={`จากทั้งหมด ${organizations.length} องค์กร`} tone="green" icon={Building2} loading={loading} />
        <MetricCard label="การจองที่กำลังดำเนินการ" value={activeBookings} detail={`จากทั้งหมด ${bookings.length} รายการ`} tone="blue" icon={CalendarCheck2} loading={loading} />
        <MetricCard label="คำร้องคืนเงินรอตรวจ" value={pendingRefunds} detail={`จากทั้งหมด ${refunds.length} คำร้อง`} tone="orange" icon={CircleDollarSign} loading={loading} />
        <MetricCard label="Support ที่ยังไม่ปิด" value={openTickets} detail={`จากทั้งหมด ${tickets.length} คำร้อง`} tone="red" icon={TicketCheck} loading={loading} />
      </section>

      <section className="mt-[18px] grid gap-[18px] xl:grid-cols-[minmax(0,1.55fr)_minmax(310px,.85fr)]">
        <article className="overflow-hidden rounded-2xl border border-[#e5dcf0] bg-white shadow-[0_16px_38px_rgba(74,48,112,.06)]">
          <header className="flex flex-col gap-3 border-b border-[#eee8f4] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-[11px] font-extrabold tracking-[.8px] text-[#7c3aed]">ORGANIZATION STATUS</span>
              <h2 className="mt-1 text-[17px] font-black text-[#242032]">สถานะองค์กร</h2>
            </div>
            <div className="flex rounded-lg border border-[#e7dfea] bg-[#fbf8ff] p-1" aria-label="เลือกรูปแบบกราฟ">
              <ChartButton active={chartMode === 'donut'} onClick={() => setChartMode('donut')} icon={Circle} label="วงกลม" />
              <ChartButton active={chartMode === 'bar'} onClick={() => setChartMode('bar')} icon={BarChart3} label="แท่ง" />
              <ChartButton active={chartMode === 'line'} onClick={() => setChartMode('line')} icon={ChartNoAxesCombined} label="เส้น" />
            </div>
          </header>
          <div className="flex flex-wrap gap-4 px-5 pt-4 text-[11px] text-[#82788b]">
            <Legend color="#7c3aed" label="ACTIVE" />
            <Legend color="#e29c36" label="INACTIVE" />
            <Legend color="#d14343" label="SUSPENDED" />
          </div>
          <div className="grid min-h-[270px] place-items-center p-5">
            {loading ? <ChartSkeleton /> : <StatusChart mode={chartMode} counts={counts} total={organizations.length} />}
          </div>
        </article>

        <article className="overflow-hidden rounded-2xl border border-[#e5dcf0] bg-white shadow-[0_16px_38px_rgba(74,48,112,.06)]">
          <header className="flex items-center justify-between border-b border-[#eee8f4] px-5 py-4">
            <div>
              <span className="text-[11px] font-extrabold tracking-[.8px] text-[#7c3aed]">NEEDS ATTENTION</span>
              <h2 className="mt-1 text-[17px] font-black text-[#242032]">องค์กรที่ต้องติดตาม</h2>
            </div>
            <Link href="/super-admin/organizations" className="text-xs font-extrabold text-[#6d28d9]">ทั้งหมด →</Link>
          </header>
          <div className="divide-y divide-[#f0ecf3] px-5">
            <AttentionRow label="SUSPENDED" description="ตรวจสอบผลกระทบก่อนเปิดกลับ" value={counts.SUSPENDED} tone="red" />
            <AttentionRow label="INACTIVE" description="องค์กรที่ปิดใช้งานอยู่" value={counts.INACTIVE} tone="orange" />
            <AttentionRow label="บทลงโทษ" description="รายการกำกับดูแลข้ามองค์กร" value={penalties.penalties.length} tone="red" icon={ShieldAlert} />
            <AttentionRow label="ผู้ใช้ Blacklist" description="ผู้ใช้ที่ถูกระงับทั่วทั้งระบบ" value={penalties.blacklistedUsers.length} tone="red" icon={ShieldAlert} />
            <AttentionRow label="แอดมินบริษัท" description="ข้อมูลข้ามทุกองค์กร" value={admins.length} tone="purple" />
          </div>
        </article>

        <article className="overflow-hidden rounded-2xl border border-[#e5dcf0] bg-white shadow-[0_16px_38px_rgba(74,48,112,.06)] xl:col-span-1">
          <header className="flex items-center justify-between border-b border-[#eee8f4] px-5 py-4">
            <div>
              <span className="text-[11px] font-extrabold tracking-[.8px] text-[#7c3aed]">ORGANIZATION WATCHLIST</span>
              <h2 className="mt-1 text-[17px] font-black text-[#242032]">องค์กรที่ควรติดตาม</h2>
            </div>
            <Link href="/super-admin/organizations" className="text-xs font-extrabold text-[#6d28d9]">ดูทั้งหมด →</Link>
          </header>
          {loading ? <RowsSkeleton /> : watchlist.length === 0 ? <EmptyPanel text="ยังไม่มีองค์กรในระบบ" /> : (
            <div className="overflow-x-auto px-4 pb-3">
              <table className="w-full min-w-[620px] border-collapse text-left">
                <thead className="text-[11px] text-[#948a98]"><tr><th className="px-2 py-3">Organization</th><th className="px-2 py-3">Contact</th><th className="px-2 py-3">สถานะ</th><th className="px-2 py-3 text-right">Admins</th></tr></thead>
                <tbody className="divide-y divide-[#f0ecf3]">
                  {watchlist.map((organization) => (
                    <tr key={organization.id} className="text-xs text-[#423b4c]">
                      <td className="px-2 py-3"><div className="flex items-center gap-2.5"><OrganizationMark name={organization.name} /><div className="min-w-0"><strong className="block max-w-[180px] truncate">{organization.name}</strong><small className="mt-0.5 block max-w-[180px] truncate text-[10px] text-[#82788b]">{organization.id}</small></div></div></td>
                      <td className="px-2 py-3">{organization.contactEmail}</td>
                      <td className="px-2 py-3"><StatusPill status={organization.status} /></td>
                      <td className="px-2 py-3 text-right font-extrabold">{adminCounts.get(organization.id) ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="overflow-hidden rounded-2xl border border-[#e5dcf0] bg-white shadow-[0_16px_38px_rgba(74,48,112,.06)]">
          <header className="border-b border-[#eee8f4] px-5 py-4">
            <span className="text-[11px] font-extrabold tracking-[.8px] text-[#7c3aed]">RECENT ACTIVITY</span>
            <h2 className="mt-1 text-[17px] font-black text-[#242032]">กิจกรรมล่าสุด</h2>
          </header>
          {loading ? <RowsSkeleton /> : auditLogs.length === 0 ? <EmptyPanel text="ยังไม่มีกิจกรรมในระบบ" /> : (
            <div className="divide-y divide-[#f0ecf3] px-5">
              {auditLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <strong className="text-xs text-[#423b4c]">{humanizeAction(log.action)}</strong>
                    <time dateTime={log.createdAt} className="shrink-0 text-[10px] text-[#948a98]">{THAI_DATE_TIME.format(new Date(log.createdAt))}</time>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-[#82788b]">{log.actor.fullName || log.actor.email} · {log.targetType}</p>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <SystemBroadcastDialog
        open={broadcastDialogOpen}
        onClose={() => setBroadcastDialogOpen(false)}
        onSent={(title) => {
          setBroadcastDialogOpen(false);
          setBroadcastNotice(`ส่งประกาศ “${title}” แล้ว`);
        }}
      />
    </div>
  );
}

function SystemBroadcastDialog({
  open,
  onClose,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  onSent: (title: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !sending) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose, open, sending]);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextTitle = title.trim();
    const nextBody = body.trim();
    if (!nextTitle || !nextBody) {
      setError('กรุณากรอกหัวข้อและรายละเอียดประกาศให้ครบ');
      return;
    }

    setSending(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('ไม่พบเซสชัน Super Admin');

      await createSystemBroadcast({ title: nextTitle, body: nextBody }, token);
      setTitle('');
      setBody('');
      onSent(nextTitle);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ส่งประกาศระบบไม่สำเร็จ');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-[#241b35]/45 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="system-broadcast-title"
        className="w-full max-w-lg rounded-2xl border border-[#e5dcf0] bg-white p-5 shadow-[0_28px_80px_rgba(36,27,53,.28)] sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-[11px] font-extrabold tracking-[1px] text-[#7c3aed]">SYSTEM BROADCAST</span>
            <h2 id="system-broadcast-title" className="mt-1 text-xl font-black text-[#242032]">
              ส่งประกาศระบบ
            </h2>
            <p className="mt-1 text-sm leading-6 text-[#82788b]">
              ประกาศนี้จะแสดงแก่ผู้ใช้ที่เข้าสู่ระบบและส่งการแจ้งเตือนตามช่องทางที่เปิดไว้
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            aria-label="ปิดหน้าต่างส่งประกาศ"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#e7dfea] text-[#716675] transition hover:bg-[#f7f2fc] disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-1.5 text-sm font-bold text-[#423b4c]">
            หัวข้อประกาศ
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              disabled={sending}
              className="min-h-11 rounded-xl border border-[#ddd3e8] px-3.5 font-normal outline-none transition focus:border-[#7c3aed] focus:ring-2 focus:ring-[#ede4fb]"
              placeholder="เช่น แจ้งปิดปรับปรุงระบบ"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-[#423b4c]">
            รายละเอียด
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={1000}
              rows={5}
              disabled={sending}
              className="resize-y rounded-xl border border-[#ddd3e8] px-3.5 py-3 font-normal outline-none transition focus:border-[#7c3aed] focus:ring-2 focus:ring-[#ede4fb]"
              placeholder="เขียนรายละเอียดที่ผู้ใช้ทุกคนควรทราบ"
            />
          </label>
          {error ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="min-h-10 rounded-lg border border-[#e7dfea] px-4 text-sm font-bold text-[#716675] disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={sending}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#6d28d9] px-4 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
            >
              {sending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
              {sending ? 'กำลังส่ง…' : 'ส่งประกาศ'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

const TONES = {
  purple: { icon: 'bg-[#f1eaff] text-[#6d28d9]', detail: 'text-[#13996a]' },
  green: { icon: 'bg-[#e9f8f1] text-[#13996a]', detail: 'text-[#13996a]' },
  blue: { icon: 'bg-[#eef4ff] text-[#2563eb]', detail: 'text-[#2563eb]' },
  orange: { icon: 'bg-[#fff3e3] text-[#d97812]', detail: 'text-[#d97812]' },
  red: { icon: 'bg-[#fff0f0] text-[#d14343]', detail: 'text-[#d14343]' },
};

function MetricCard({ label, value, detail, tone, icon: Icon, loading }: { label: string; value: number; detail: string; tone: keyof typeof TONES; icon: typeof Building2; loading: boolean }) {
  return (
    <article className="flex items-center gap-3.5 overflow-hidden rounded-[14px] border border-[#e7def4] bg-[linear-gradient(145deg,#fff,#fbf8ff)] p-[17px] shadow-[0_10px_26px_rgba(74,48,112,.05)] transition hover:-translate-y-0.5 hover:border-[#d9c7ef] hover:shadow-[0_17px_35px_rgba(74,48,112,.1)]">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${TONES[tone].icon}`}><Icon className="h-5 w-5" /></span>
      <div><span className="text-[13px] text-[#82788b]">{label}</span>{loading ? <div className="mt-1 h-7 w-14 animate-pulse rounded bg-[#eee8f4]" /> : <strong className="mt-0.5 block text-[24px] leading-tight text-[#242032]">{value.toLocaleString('th-TH')}</strong>}<small className={`text-[11px] font-bold ${TONES[tone].detail}`}>{detail}</small></div>
    </article>
  );
}

function ChartButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Circle; label: string }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-bold transition ${active ? 'bg-white text-[#6d28d9] shadow-sm' : 'text-[#82788b]'}`}><Icon className="h-3.5 w-3.5" />{label}</button>;
}

function StatusChart({ mode, counts, total }: { mode: ChartMode; counts: Record<SuperAdminOrganizationStatus, number>; total: number }) {
  if (total === 0) return <EmptyPanel text="ยังไม่มีข้อมูลสำหรับแสดงกราฟ" />;
  const activeEnd = (counts.ACTIVE / total) * 100;
  const inactiveEnd = activeEnd + (counts.INACTIVE / total) * 100;

  if (mode === 'donut') {
    return <div className="grid w-full gap-6 sm:grid-cols-[190px_minmax(0,1fr)] sm:items-center"><div className="relative mx-auto grid h-[190px] w-[190px] place-items-center rounded-full shadow-[0_14px_30px_rgba(124,58,237,.16)]" style={{ background: `conic-gradient(#7c3aed 0 ${activeEnd}%,#e29c36 ${activeEnd}% ${inactiveEnd}%,#d14343 ${inactiveEnd}% 100%)` }}><div className="grid h-[120px] w-[120px] place-items-center rounded-full bg-white text-center"><div><strong className="block text-[25px]">{total}</strong><span className="text-[11px] text-[#82788b]">องค์กรทั้งหมด</span></div></div></div><div className="grid grid-cols-2 gap-2.5"><ChartSummary label="ACTIVE" value={counts.ACTIVE} /><ChartSummary label="INACTIVE" value={counts.INACTIVE} /><ChartSummary label="SUSPENDED" value={counts.SUSPENDED} /><ChartSummary label="TOTAL" value={total} /></div></div>;
  }

  const values = [
    { label: 'ACTIVE', value: counts.ACTIVE, color: '#7c3aed' },
    { label: 'INACTIVE', value: counts.INACTIVE, color: '#e29c36' },
    { label: 'SUSPENDED', value: counts.SUSPENDED, color: '#d14343' },
  ];
  const max = Math.max(...values.map((item) => item.value), 1);

  if (mode === 'bar') {
    return <div className="flex h-[220px] w-full items-end justify-around gap-5 border-b border-[#ebe6f0] px-4">{values.map((item) => <div key={item.label} className="grid h-full flex-1 grid-rows-[28px_1fr_28px] items-end text-center"><strong className="text-xs text-[#62576c]">{item.value}</strong><div className="relative mx-auto h-full w-[min(58px,72%)] overflow-hidden rounded-t-[9px] bg-[#f2edf8]"><span className="absolute inset-x-0 bottom-0 rounded-t-[9px]" style={{ height: `${(item.value / max) * 100}%`, background: item.color }} /></div><small className="self-center text-[10px] text-[#82788b]">{item.label}</small></div>)}</div>;
  }

  const points = values.map((item, index) => `${80 + index * 250},${220 - (item.value / max) * 160}`).join(' ');
  return <svg viewBox="0 0 660 250" className="h-[240px] w-full" role="img" aria-label="กราฟเส้นจำนวนองค์กรตามสถานะ"><g stroke="#eee8f4" strokeWidth="1"><path d="M55 40H630M55 95H630M55 150H630M55 205H630" /></g><polyline points={points} fill="none" stroke="#7c3aed" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />{values.map((item, index) => { const [x, y] = points.split(' ')[index].split(','); return <g key={item.label}><circle cx={x} cy={y} r="6" fill={item.color} /><text x={x} y="238" textAnchor="middle" fontSize="11" fill="#82788b">{item.label}</text><text x={x} y={Number(y) - 13} textAnchor="middle" fontSize="12" fontWeight="700" fill="#62576c">{item.value}</text></g>; })}</svg>;
}

function ChartSummary({ label, value }: { label: string; value: number }) { return <div className="rounded-[10px] border border-[#eee8f4] bg-white p-3"><span className="block text-[11px] text-[#82788b]">{label}</span><strong className="mt-1 block text-[17px]">{value}</strong></div>; }
function Legend({ color, label }: { color: string; label: string }) { return <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: color }} />{label}</span>; }
function AttentionRow({ label, description, value, tone, icon: Icon = AlertTriangle }: { label: string; description: string; value: number; tone: keyof typeof TONES; icon?: typeof AlertTriangle }) { return <div className="flex items-center gap-3 py-4"><span className={`grid h-8 w-8 place-items-center rounded-[9px] ${TONES[tone].icon}`}><Icon className="h-4 w-4" /></span><div className="min-w-0 flex-1"><strong className="block text-xs text-[#423b4c]">{label}</strong><small className="mt-1 block truncate text-[11px] text-[#82788b]">{description}</small></div><b className="text-sm text-[#242032]">{value}</b><span className="text-[#948a98]">›</span></div>; }
function OrganizationMark({ name }: { name: string }) { return <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[#f1eaff] text-xs font-extrabold text-[#6d28d9]">{name.trim().charAt(0).toUpperCase() || 'O'}</span>; }
function StatusPill({ status }: { status: SuperAdminOrganizationStatus }) { const styles = { ACTIVE: 'bg-[#ecfdf3] text-[#166534]', INACTIVE: 'bg-[#fff7ed] text-[#92400e]', SUSPENDED: 'bg-[#fff1f2] text-[#b91c1c]' }; return <span className={`inline-block rounded-md px-2 py-1 text-[10px] font-extrabold ${styles[status]}`}>{status}</span>; }
function RowsSkeleton() { return <div className="grid gap-3 p-5">{[1, 2, 3].map((item) => <div key={item} className="h-10 animate-pulse rounded-lg bg-[#f2edf8]" />)}</div>; }
function ChartSkeleton() { return <div className="h-[190px] w-[190px] animate-pulse rounded-full bg-[#f2edf8]" />; }
function EmptyPanel({ text }: { text: string }) { return <div className="grid min-h-[150px] place-items-center p-6 text-center text-xs text-[#82788b]">{text}</div>; }
function countStatuses(organizations: SuperAdminOrganization[]) { return organizations.reduce<Record<SuperAdminOrganizationStatus, number>>((result, organization) => { result[organization.status] += 1; return result; }, { ACTIVE: 0, INACTIVE: 0, SUSPENDED: 0 }); }
function statusPriority(status: SuperAdminOrganizationStatus) { return status === 'SUSPENDED' ? 0 : status === 'INACTIVE' ? 1 : 2; }
function percentage(value: number, total: number) { return total === 0 ? '0% ของทั้งหมด' : `${((value / total) * 100).toFixed(1)}% ของทั้งหมด`; }
function humanizeAction(action: string) { return action.toLowerCase().replaceAll('_', ' '); }
