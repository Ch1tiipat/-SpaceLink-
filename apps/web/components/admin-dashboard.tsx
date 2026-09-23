'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Building2,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  LayoutDashboard,
  MapPinned,
  ShieldCheck,
  Store,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import {
  getAdminDashboardSummary,
  getMe,
  type AdminDashboardSummary,
  type CurrentUser,
} from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { useAdminOrganizationSelection } from '@/components/app-shell';

type AccessState = 'loading' | 'allowed' | 'denied' | 'no-organization';
type OrganizationOption = CurrentUser['organizations'][number];

export function AdminDashboard() {
  const router = useRouter();
  const {
    selectedOrganizationId,
    selectOrganization: selectGlobalOrganization,
  } = useAdminOrganizationSelection();
  const [access, setAccess] = useState<AccessState>('loading');
  const [token, setToken] = useState('');
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;
        if (!accessToken) {
          router.replace('/login');
          return;
        }

        const me = await getMe(accessToken, controller.signal);
        if (!active) return;
        if (me.role !== 'ORG_ADMIN' && me.role !== 'SUPER_ADMIN') {
          setAccess('denied');
          return;
        }
        if (me.organizations.length === 0) {
          setAccess('no-organization');
          return;
        }

        setToken(accessToken);
        setOrganizations(me.organizations);
        setAccess('allowed');
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError')
          return;
        if (active) setAccess('denied');
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [router]);

  useEffect(() => {
    if (
      access !== 'allowed' ||
      !organizations.some(
        (organization) => organization.id === selectedOrganizationId,
      )
    ) {
      return;
    }
    setOrganizationId(selectedOrganizationId);
  }, [access, organizations, selectedOrganizationId]);

  useEffect(() => {
    if (access !== 'allowed' || !token || !organizationId) return;
    const controller = new AbortController();
    setLoadingSummary(true);
    setError(null);

    void getAdminDashboardSummary(organizationId, token, controller.signal)
      .then(setSummary)
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === 'AbortError')
          return;
        setSummary(null);
        setError(
          cause instanceof Error
            ? cause.message
            : 'โหลดข้อมูล Dashboard ไม่สำเร็จ',
        );
      })
      .finally(() => {
        // A stale request aborted by a fast org switch still settles its
        // promise chain — without this check its `finally` would clear
        // loadingSummary for the *newer* request that is still in flight,
        // flashing the error state before the new data arrives.
        if (!controller.signal.aborted) {
          setLoadingSummary(false);
        }
      });

    return () => controller.abort();
  }, [access, organizationId, token]);

  function selectOrganization(nextId: string) {
    if (!organizations.some((organization) => organization.id === nextId)) {
      return;
    }
    setOrganizationId(nextId);
    selectGlobalOrganization(nextId);
  }

  if (access === 'loading') {
    return <PageState label="กำลังตรวจสอบสิทธิ์ผู้ดูแลองค์กร" />;
  }

  if (access !== 'allowed') {
    return (
      <main className="sl-page">
        <div className="shell py-20 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-violet" aria-hidden />
          <h1 className="mt-5 text-2xl font-black">
            {access === 'no-organization'
              ? 'ยังไม่มีองค์กรที่ดูแล'
              : 'ไม่มีสิทธิ์เข้าถึงหน้านี้'}
          </h1>
          <p className="mt-3 text-muted">
            เฉพาะผู้ดูแลองค์กรและผู้ดูแลระบบเท่านั้นที่ดู Dashboard ได้
          </p>
        </div>
      </main>
    );
  }

  const selectedOrganization = organizations.find(
    (organization) => organization.id === organizationId,
  );

  return (
    <main className="relative isolate min-h-[calc(100vh-72px)] overflow-hidden bg-[radial-gradient(circle_at_90%_8%,rgba(169,120,255,.2),transparent_26%),radial-gradient(circle_at_8%_88%,rgba(218,195,255,.25),transparent_30%),linear-gradient(145deg,#fff_0%,#fbf9ff_44%,#f3edff_100%)] pb-16">
      <div aria-hidden className="pointer-events-none fixed inset-y-[72px] right-0 -z-10 w-[70%] opacity-30 [background-image:radial-gradient(circle,rgba(117,56,238,.2)_1px,transparent_1.2px)] [background-size:28px_28px] [mask-image:linear-gradient(135deg,transparent_8%,#000_44%,transparent_88%)]" />
      <div className="shell py-7 sm:py-9">
        <section className="overflow-hidden rounded-[28px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,.96),rgba(244,237,255,.92))] shadow-[0_22px_60px_rgba(74,48,112,.1)] backdrop-blur-sm">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
            <div className="relative overflow-hidden p-7 sm:p-10">
              <div aria-hidden className="absolute -right-20 -top-24 h-64 w-64 rounded-full border border-violet/15 shadow-[0_0_0_45px_rgba(124,58,237,.05),0_0_0_90px_rgba(124,58,237,.025)]" />
              <span className="relative inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-violet">
                <LayoutDashboard className="h-4 w-4" aria-hidden />
                Organization dashboard
              </span>
              <h1 className="relative mt-5 max-w-2xl text-3xl font-black tracking-[-0.05em] text-ink sm:text-[42px] sm:leading-[1.12]">
                บริหารงานวันนี้ให้จบ
                <span className="block bg-[linear-gradient(100deg,#5b21b6,#9b5cf6)] bg-clip-text text-transparent">ในหน้าจอเดียว</span>
              </h1>
              <p className="relative mt-4 max-w-xl text-sm leading-6 text-muted">
                ติดตามการจอง พื้นที่ และ Event ของ {selectedOrganization?.name ?? 'องค์กรที่เลือก'} จากข้อมูลจริงในระบบ
              </p>
              <div className="relative mt-7 flex flex-wrap gap-2.5">
                <button type="button" onClick={() => router.push('/admin/transactions')} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet px-4 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(109,40,217,.24)] transition hover:-translate-y-0.5 hover:bg-[#5b21b6]">
                  ดูการเงินและการจอง <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
                <button type="button" onClick={() => router.push('/admin/zones')} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#dfd3ef] bg-white px-4 text-sm font-extrabold text-[#5f536b] transition hover:-translate-y-0.5 hover:border-[#cbb5eb] hover:text-violet">
                  จัดการพื้นที่
                </button>
              </div>
            </div>
            <aside className="border-t border-[#eadff4] bg-white/65 p-6 lg:border-l lg:border-t-0 sm:p-8">
              <label className="block text-xs font-black uppercase tracking-[.12em] text-[#8f8399]">
                องค์กรที่กำลังดู
                <select value={organizationId} onChange={(event) => selectOrganization(event.target.value)} className="mt-3 w-full rounded-2xl border border-[#ded5eb] bg-white px-4 py-3 text-sm font-extrabold normal-case tracking-normal text-[#5b21b6] outline-none focus:border-violet focus:ring-4 focus:ring-[#7c3aed18]">
                  {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
                </select>
              </label>
              <div className="mt-6 rounded-2xl border border-[#eadff4] bg-[#faf7ff] p-4">
                <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eee5fb] text-violet"><Building2 className="h-5 w-5" aria-hidden /></span><div><p className="text-xs font-bold text-muted">สถานะข้อมูล</p><p className="mt-0.5 text-sm font-black text-ink">เชื่อมต่อ Backend แล้ว</p></div></div>
              </div>
            </aside>
          </div>
        </section>

        {loadingSummary ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="skeleton h-36 rounded-[24px]" />)}</div>
        ) : error || !summary ? (
          <section className="mt-5 rounded-[24px] border border-red-100 bg-red-50/90 p-6 text-red-700 shadow-sm"><h2 className="font-black">โหลด Dashboard ไม่สำเร็จ</h2><p className="mt-2 text-sm">{error ?? 'ไม่พบข้อมูลสรุปขององค์กร'}</p></section>
        ) : (
          <>
            <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="ตัวเลขสำคัญ">
              <MetricCard icon={Clock3} label="รอชำระเงิน" value={summary.bookings.pendingPayment} tone="amber" />
              <MetricCard icon={CheckCircle2} label="ยืนยันแล้ว" value={summary.bookings.confirmed} tone="green" />
              <MetricCard icon={CalendarCheck2} label="Event เผยแพร่" value={summary.events.published} tone="violet" />
              <MetricCard icon={Store} label="บูธทั้งหมด" value={summary.resources.booths} tone="blue" />
            </section>

            <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
              <article className="rounded-[24px] border border-white/75 bg-white/90 p-6 shadow-[0_18px_50px_rgba(54,36,91,.07)] backdrop-blur-sm sm:p-7">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-[11px] font-black uppercase tracking-[.16em] text-violet">BOOKING STATUS</p><h2 className="mt-1 text-xl font-black text-ink">สถานะการจอง</h2><p className="mt-1 text-xs text-muted">สัดส่วนจาก Booking ขององค์กรที่เลือก</p></div><WalletCards className="h-7 w-7 text-[#9b72df]" aria-hidden /></div>
                <div className="mt-7 grid gap-5">
                  <BookingProgress label="รอชำระเงิน" value={summary.bookings.pendingPayment} total={summary.bookings.pendingPayment + summary.bookings.confirmed + summary.bookings.cancelled} color="bg-amber-400" />
                  <BookingProgress label="ยืนยันแล้ว" value={summary.bookings.confirmed} total={summary.bookings.pendingPayment + summary.bookings.confirmed + summary.bookings.cancelled} color="bg-emerald-500" />
                  <BookingProgress label="ยกเลิกแล้ว" value={summary.bookings.cancelled} total={summary.bookings.pendingPayment + summary.bookings.confirmed + summary.bookings.cancelled} color="bg-rose-400" />
                </div>
              </article>
              <article className="rounded-[24px] border border-white/75 bg-white/90 p-6 shadow-[0_18px_50px_rgba(54,36,91,.07)] backdrop-blur-sm sm:p-7">
                <p className="text-[11px] font-black uppercase tracking-[.16em] text-violet">SPACE INVENTORY</p><h2 className="mt-1 text-xl font-black text-ink">พื้นที่ขององค์กร</h2><div className="mt-6 grid gap-3">
                  <ResourceRow icon={Building2} label="สถานที่" value={summary.resources.venues} />
                  <ResourceRow icon={MapPinned} label="โซน" value={summary.resources.zones} />
                  <ResourceRow icon={Store} label="บูธ" value={summary.resources.booths} />
                  <ResourceRow icon={CalendarClock} label="Event ที่กำลังจะมาถึง" value={summary.events.upcoming} />
                </div>
              </article>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function BookingProgress({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const width = total > 0 ? Math.max(4, Math.round((value / total) * 100)) : 0;
  return <div><div className="mb-2 flex items-center justify-between text-sm"><span className="font-bold text-[#655d70]">{label}</span><strong className="text-ink">{value.toLocaleString('th-TH')}</strong></div><div className="h-2.5 overflow-hidden rounded-full bg-[#f0e9f6]"><span className={`block h-full rounded-full ${color} transition-[width] duration-700`} style={{ width: `${width}%` }} /></div></div>;
}

function ResourceRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-[#eee7f4] bg-[#fcfaff] p-3.5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eee5fb] text-violet"><Icon className="h-5 w-5" aria-hidden /></span><span className="min-w-0 flex-1 text-sm font-bold text-[#655d70]">{label}</span><strong className="text-xl font-black text-ink">{value.toLocaleString('th-TH')}</strong></div>;
}

const TONES = {
  amber: 'bg-amber-50 text-amber-700',
  green: 'bg-emerald-50 text-emerald-700',
  red: 'bg-red-50 text-red-700',
  violet: 'bg-violet-tint text-violet',
  blue: 'bg-blue-50 text-blue-700',
  slate: 'bg-slate-100 text-slate-700',
} as const;

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: keyof typeof TONES;
}) {
  return (
    <article className="group rounded-[20px] border border-white/75 bg-white/90 p-5 shadow-[0_14px_34px_rgba(54,36,91,.055)] backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#dcccf5] hover:shadow-[0_18px_42px_rgba(90,48,145,.1)]">
      <span
        className={`grid h-11 w-11 place-items-center rounded-2xl transition-transform duration-200 group-hover:scale-105 ${TONES[tone]}`}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="mt-5 text-sm font-bold text-muted">{label}</p>
      <p className="mt-1 text-3xl font-black tracking-[-0.04em]">
        {value.toLocaleString('th-TH')}
      </p>
    </article>
  );
}

function PageState({ label }: { label: string }) {
  return (
    <main className="sl-page">
      <div className="shell py-10">
        <div className="skeleton h-64 rounded-[28px]" aria-label={label} />
      </div>
    </main>
  );
}
