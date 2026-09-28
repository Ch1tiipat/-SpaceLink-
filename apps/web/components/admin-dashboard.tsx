'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  LayoutDashboard,
  MapPinned,
  ShieldCheck,
  Store,
  TrendingUp,
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
type ChartRange = 'day' | 'week' | 'month' | 'year';

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
  const [chartRange, setChartRange] = useState<ChartRange>('week');

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
    <main className="relative isolate min-h-[calc(100vh-72px)] overflow-hidden bg-[radial-gradient(circle_at_92%_5%,rgba(167,139,250,.18),transparent_22%),linear-gradient(145deg,#fff_0%,#fbf9ff_48%,#f5f0ff_100%)] pb-10">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-y-[72px] right-0 -z-10 w-1/2 opacity-25 [background-image:radial-gradient(circle,rgba(117,56,238,.22)_1px,transparent_1.2px)] [background-size:26px_26px] [mask-image:linear-gradient(135deg,transparent_8%,#000_42%,transparent_90%)]"
      />
      <div className="shell py-5 sm:py-6">
        <section className="relative overflow-hidden rounded-[24px] border border-white/80 bg-white/90 px-5 py-5 shadow-[0_16px_45px_rgba(74,48,112,.08)] backdrop-blur-sm sm:px-6">
          <div
            aria-hidden
            className="absolute -right-16 -top-20 h-44 w-44 rounded-full border border-violet/15 shadow-[0_0_0_34px_rgba(124,58,237,.045),0_0_0_68px_rgba(124,58,237,.02)]"
          />
          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-violet">
                <LayoutDashboard className="h-3.5 w-3.5" aria-hidden />
                Organization dashboard
              </span>
              <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] text-ink sm:text-[32px]">
                ภาพรวมองค์กร
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm text-muted">
                การจอง พื้นที่ และ Event ของ{' '}
                <strong className="text-[#5b21b6]">
                  {selectedOrganization?.name ?? 'องค์กรที่เลือก'}
                </strong>
              </p>
            </div>
            <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="block min-w-[250px] text-[10px] font-black uppercase tracking-[.12em] text-[#8f8399]">
                องค์กรที่กำลังดู
                <select
                  value={organizationId}
                  onChange={(event) => selectOrganization(event.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-[#ded5eb] bg-white px-3 text-sm font-extrabold normal-case tracking-normal text-[#5b21b6] outline-none focus:border-violet focus:ring-4 focus:ring-[#7c3aed18]"
                >
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => router.push('/admin/transactions')}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet px-4 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(109,40,217,.2)] transition hover:-translate-y-0.5 hover:bg-[#5b21b6]"
              >
                ดูรายการ
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </section>

        {loadingSummary ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="skeleton h-28 rounded-[20px]" />
            ))}
          </div>
        ) : error || !summary ? (
          <section className="mt-4 rounded-[20px] border border-red-100 bg-red-50/90 p-5 text-red-700 shadow-sm">
            <h2 className="font-black">โหลด Dashboard ไม่สำเร็จ</h2>
            <p className="mt-1 text-sm">
              {error ?? 'ไม่พบข้อมูลสรุปขององค์กร'}
            </p>
          </section>
        ) : (
          <>
            <section
              className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
              aria-label="ตัวเลขสำคัญ"
            >
              <MetricCard
                icon={Clock3}
                label="รอชำระเงิน"
                value={summary.bookings.pendingPayment}
                tone="amber"
              />
              <MetricCard
                icon={CheckCircle2}
                label="ยืนยันแล้ว"
                value={summary.bookings.confirmed}
                tone="green"
              />
              <MetricCard
                icon={CalendarCheck2}
                label="Event เผยแพร่"
                value={summary.events.published}
                tone="violet"
              />
              <MetricCard
                icon={Store}
                label="บูธทั้งหมด"
                value={summary.resources.booths}
                tone="blue"
              />
            </section>

            <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(290px,.65fr)]">
              <BookingTrendChart
                trend={summary.analytics.bookingTrend}
                range={chartRange}
                onRangeChange={setChartRange}
                bookings={summary.bookings}
              />

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <article className="rounded-[22px] border border-white/80 bg-[linear-gradient(145deg,#6d28d9,#8b5cf6)] p-5 text-white shadow-[0_18px_45px_rgba(91,33,182,.2)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[.16em] text-white/70">
                        QUICK ACTION
                      </p>
                      <h2 className="mt-1 text-xl font-black">
                        สิ่งที่ควรดูตอนนี้
                      </h2>
                    </div>
                    <TrendingUp className="h-6 w-6 text-white/75" aria-hidden />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        '/admin/transactions?tab=payments&paymentStatus=AWAITING_SLIP',
                      )
                    }
                    className="mt-5 flex w-full items-center justify-between rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-left transition hover:bg-white/15"
                  >
                    <span className="text-sm font-bold">การจองรอชำระเงิน</span>
                    <strong className="text-2xl font-black">
                      {summary.bookings.pendingPayment.toLocaleString('th-TH')}
                    </strong>
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push('/admin/events')}
                    className="mt-2 flex w-full items-center justify-between rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-left transition hover:bg-white/15"
                  >
                    <span className="text-sm font-bold">
                      Event ที่กำลังจะมาถึง
                    </span>
                    <strong className="text-2xl font-black">
                      {summary.events.upcoming.toLocaleString('th-TH')}
                    </strong>
                  </button>
                </article>

                <article className="rounded-[22px] border border-white/80 bg-white/90 p-5 shadow-[0_14px_38px_rgba(54,36,91,.065)] backdrop-blur-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[.16em] text-violet">
                        SPACE INVENTORY
                      </p>
                      <h2 className="mt-1 text-lg font-black text-ink">
                        พื้นที่ขององค์กร
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push('/admin/zones')}
                      className="rounded-lg px-2 py-1 text-xs font-extrabold text-violet hover:bg-[#f2eaff]"
                    >
                      จัดการ
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <ResourceTile
                      icon={Building2}
                      label="สถานที่"
                      value={summary.resources.venues}
                    />
                    <ResourceTile
                      icon={MapPinned}
                      label="โซน"
                      value={summary.resources.zones}
                    />
                    <ResourceTile
                      icon={Store}
                      label="บูธ"
                      value={summary.resources.booths}
                    />
                  </div>
                </article>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

const CHART_RANGES: Array<{
  value: ChartRange;
  label: string;
  period: string;
}> = [
  { value: 'day', label: 'วัน', period: 'วันนี้' },
  { value: 'week', label: 'สัปดาห์', period: '7 วันล่าสุด' },
  { value: 'month', label: 'เดือน', period: '4 สัปดาห์ล่าสุด' },
  { value: 'year', label: 'ปี', period: '12 เดือนล่าสุด' },
];

function BookingTrendChart({
  trend,
  range,
  onRangeChange,
  bookings,
}: {
  trend: AdminDashboardSummary['analytics']['bookingTrend'];
  range: ChartRange;
  onRangeChange: (range: ChartRange) => void;
  bookings: AdminDashboardSummary['bookings'];
}) {
  const series = trend[range];
  const total = useMemo(
    () => series.reduce((sum, point) => sum + point.value, 0),
    [series],
  );
  const chart = useMemo(() => createChartGeometry(series), [series]);
  const period = CHART_RANGES.find((item) => item.value === range)?.period;
  const bookingTotal =
    bookings.pendingPayment + bookings.confirmed + bookings.cancelled;

  return (
    <article className="overflow-hidden rounded-[22px] border border-white/80 bg-white/92 shadow-[0_16px_44px_rgba(54,36,91,.075)] backdrop-blur-sm">
      <div className="flex flex-col gap-3 border-b border-[#eee8f4] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eee5fb] text-violet">
            <BarChart3 className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-black text-ink">จังหวะการจอง</h2>
            <p className="text-xs text-muted">
              {period} · รวม {total.toLocaleString('th-TH')} รายการ
            </p>
          </div>
        </div>
        <div
          className="flex w-fit rounded-xl border border-[#e5ddef] bg-[#faf7ff] p-1"
          role="group"
          aria-label="ช่วงเวลาของกราฟ"
        >
          {CHART_RANGES.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={range === item.value}
              onClick={() => onRangeChange(item.value)}
              className={`min-h-8 rounded-lg px-3 text-[11px] font-extrabold transition ${
                range === item.value
                  ? 'bg-white text-violet shadow-[0_3px_10px_rgba(79,32,140,.1)]'
                  : 'text-muted hover:bg-white/70 hover:text-violet'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto px-3 pt-3 sm:px-5">
        <svg
          key={`${range}-${series.map((point) => point.value).join('-')}`}
          viewBox="0 0 720 250"
          className="h-[250px] min-w-[620px] w-full"
          role="img"
          aria-label={`กราฟจำนวนการจอง ${period} รวม ${total} รายการ`}
        >
          <defs>
            <linearGradient id="admin-booking-line" x1="0" x2="1">
              <stop stopColor="#a16bf8" />
              <stop offset="1" stopColor="#6730db" />
            </linearGradient>
            <linearGradient id="admin-booking-area" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#a16bf8" stopOpacity=".25" />
              <stop offset="1" stopColor="#a16bf8" stopOpacity=".015" />
            </linearGradient>
          </defs>
          {chart.grid.map((line) => (
            <g key={line.label}>
              <line
                x1="48"
                x2="700"
                y1={line.y}
                y2={line.y}
                stroke={line.value === 0 ? '#d9cdec' : '#ece6f3'}
                strokeDasharray={line.value === 0 ? undefined : '4 5'}
              />
              <text x="8" y={line.y + 4} fill="#9b91a7" fontSize="11">
                {line.label}
              </text>
            </g>
          ))}
          <path d={chart.areaPath} fill="url(#admin-booking-area)" opacity="0">
            <animate
              attributeName="opacity"
              from="0"
              to="1"
              dur=".55s"
              fill="freeze"
            />
          </path>
          <path
            d={chart.linePath}
            fill="none"
            stroke="url(#admin-booking-line)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength="1"
            strokeDasharray="1"
            strokeDashoffset="1"
          >
            <animate
              attributeName="stroke-dashoffset"
              from="1"
              to="0"
              dur=".75s"
              fill="freeze"
            />
          </path>
          {chart.points.map((point, index) => (
            <g key={`${point.label}-${index}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r="4.5"
                fill="white"
                stroke="#7939eb"
                strokeWidth="3"
              >
                <title>{`${point.label}: ${point.value} รายการ`}</title>
                <animate
                  attributeName="r"
                  from="0"
                  to="4.5"
                  begin={`${0.2 + index * 0.035}s`}
                  dur=".25s"
                  fill="freeze"
                />
              </circle>
              {point.value > 0 ? (
                <text
                  x={point.x}
                  y={point.y - 13}
                  fill="#6731c7"
                  fontSize="11"
                  fontWeight="800"
                  textAnchor="middle"
                >
                  {point.value}
                </text>
              ) : null}
              <text
                x={point.x}
                y="232"
                fill="#8a7d99"
                fontSize="10.5"
                textAnchor="middle"
              >
                {point.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="grid grid-cols-3 border-t border-[#eee8f4] bg-[#fcfaff]">
        <StatusSummary
          label="รอชำระเงิน"
          value={bookings.pendingPayment}
          total={bookingTotal}
          dot="bg-amber-400"
        />
        <StatusSummary
          label="ยืนยันแล้ว"
          value={bookings.confirmed}
          total={bookingTotal}
          dot="bg-emerald-500"
        />
        <StatusSummary
          label="ยกเลิกแล้ว"
          value={bookings.cancelled}
          total={bookingTotal}
          dot="bg-rose-400"
        />
      </div>
    </article>
  );
}

function createChartGeometry(series: Array<{ label: string; value: number }>) {
  const left = 55;
  const right = 690;
  const top = 25;
  const bottom = 205;
  const maximum = Math.max(0, ...series.map((point) => point.value));
  const ceiling = maximum === 0 ? 4 : Math.max(5, Math.ceil(maximum / 5) * 5);
  const middleValue = Math.round(ceiling / 2);
  const middleY = bottom - (middleValue / ceiling) * (bottom - top);
  const step = series.length > 1 ? (right - left) / (series.length - 1) : 0;
  const points = series.map((point, index) => ({
    ...point,
    x: left + index * step,
    y: bottom - (point.value / ceiling) * (bottom - top),
  }));
  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`)
    .join(' ');
  const areaPath = `${linePath} L${right},${bottom} L${left},${bottom} Z`;

  return {
    points,
    linePath,
    areaPath,
    grid: [
      { value: ceiling, label: String(ceiling), y: top },
      {
        value: middleValue,
        label: String(middleValue),
        y: middleY,
      },
      { value: 0, label: '0', y: bottom },
    ],
  };
}

function StatusSummary({
  label,
  value,
  total,
  dot,
}: {
  label: string;
  value: number;
  total: number;
  dot: string;
}) {
  const percentage = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div className="border-r border-[#eee8f4] px-3 py-3 last:border-r-0 sm:px-4">
      <span className="flex items-center gap-1.5 text-[10px] font-bold text-muted sm:text-xs">
        <i className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
        {label}
      </span>
      <div className="mt-1 flex items-end gap-1.5">
        <strong className="text-lg font-black text-ink">
          {value.toLocaleString('th-TH')}
        </strong>
        <span className="pb-0.5 text-[10px] font-bold text-muted">
          {percentage}%
        </span>
      </div>
    </div>
  );
}

function ResourceTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-[#eee7f4] bg-[#fcfaff] p-3 text-center">
      <span className="mx-auto grid h-9 w-9 place-items-center rounded-xl bg-[#eee5fb] text-violet">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <strong className="mt-2 block text-xl font-black text-ink">
        {value.toLocaleString('th-TH')}
      </strong>
      <span className="mt-0.5 block text-[10px] font-bold text-muted">
        {label}
      </span>
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
