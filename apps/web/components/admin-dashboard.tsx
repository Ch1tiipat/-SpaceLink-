'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Ban,
  Building2,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  LayoutDashboard,
  MapPinned,
  ShieldCheck,
  Store,
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
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
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

    void getAdminDashboardSummary(
      organizationId,
      token,
      controller.signal,
    )
      .then(setSummary)
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setSummary(null);
        setError(cause instanceof Error ? cause.message : 'โหลดข้อมูล Dashboard ไม่สำเร็จ');
      })
      .finally(() => setLoadingSummary(false));

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
    <main className="sl-page pb-16">
      <div className="shell py-8 sm:py-10">
        <section className="overflow-hidden rounded-[30px] bg-gradient-to-br from-[#321465] via-[#7132e8] to-[#267b79] p-7 text-white shadow-xl sm:p-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.16em]">
            <LayoutDashboard className="h-4 w-4" aria-hidden />
            Organization dashboard
          </span>
          <div className="mt-5 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <h1 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                ภาพรวมองค์กร
              </h1>
              <p className="mt-3 text-white/80">
                ติดตามการจอง พื้นที่ และ Event ขององค์กรที่เลือก
              </p>
            </div>
            <label className="block min-w-64 text-sm font-bold">
              องค์กรที่กำลังดู
              <select
                value={organizationId}
                onChange={(event) => selectOrganization(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/25 bg-white px-4 py-3 text-ink outline-none focus:ring-4 focus:ring-white/20"
              >
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <div className="mt-6 flex items-center gap-2 text-sm text-muted">
          <Building2 className="h-4 w-4 text-violet" aria-hidden />
          <span>ข้อมูลของ {selectedOrganization?.name ?? 'องค์กรที่เลือก'}</span>
        </div>

        {loadingSummary ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="skeleton h-36 rounded-[24px]" />
            ))}
          </div>
        ) : error || !summary ? (
          <section className="mt-5 rounded-[24px] border border-red-100 bg-red-50 p-6 text-red-700">
            <h2 className="font-black">โหลด Dashboard ไม่สำเร็จ</h2>
            <p className="mt-2 text-sm">{error ?? 'ไม่พบข้อมูลสรุปขององค์กร'}</p>
          </section>
        ) : (
          <>
            <SectionTitle title="สถานะการจอง" description="จำนวน Booking ขององค์กร แยกตามสถานะหลัก" />
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <MetricCard icon={Clock3} label="รอชำระเงิน" value={summary.bookings.pendingPayment} tone="amber" />
              <MetricCard icon={CheckCircle2} label="ยืนยันแล้ว" value={summary.bookings.confirmed} tone="green" />
              <MetricCard icon={Ban} label="ยกเลิกแล้ว" value={summary.bookings.cancelled} tone="red" />
            </div>

            <SectionTitle title="พื้นที่ขององค์กร" description="จำนวนสถานที่ โซน และบูธทั้งหมด" />
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <MetricCard icon={Building2} label="สถานที่" value={summary.resources.venues} tone="violet" />
              <MetricCard icon={MapPinned} label="โซน" value={summary.resources.zones} tone="blue" />
              <MetricCard icon={Store} label="บูธ" value={summary.resources.booths} tone="slate" />
            </div>

            <SectionTitle title="Event" description="งานที่เผยแพร่และงานที่กำลังจะมาถึง" />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <MetricCard icon={CalendarCheck2} label="เผยแพร่แล้ว" value={summary.events.published} tone="violet" />
              <MetricCard icon={CalendarClock} label="กำลังจะมาถึง" value={summary.events.upcoming} tone="blue" />
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mt-9">
      <h2 className="text-xl font-black">{title}</h2>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </div>
  );
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
    <article className="sl-surface p-5">
      <span className={`grid h-11 w-11 place-items-center rounded-2xl ${TONES[tone]}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="mt-5 text-sm font-bold text-muted">{label}</p>
      <p className="mt-1 text-3xl font-black tracking-[-0.04em]">{value.toLocaleString('th-TH')}</p>
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
