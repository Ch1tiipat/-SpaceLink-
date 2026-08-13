'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Grip,
  Loader2,
  Map,
  Save,
  Settings2,
} from 'lucide-react';
import {
  ApiError,
  getAdminBooths,
  getAdminVenues,
  getAdminZones,
  getMe,
  updateAdminBooth,
  updateAdminZone,
  type AdminBooth,
  type AdminVenue,
  type AdminZone,
} from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabase';

type AccessState = 'loading' | 'allowed' | 'denied';
type Position = { x: number; y: number };
type PositionedZone = AdminZone & Position;
type PositionedBooth = AdminBooth & Position;
type Selection = { kind: 'zone' | 'booth'; id: string } | null;
type DragState = {
  kind: 'zone' | 'booth';
  id: string;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  width: number;
  height: number;
};

const ZONE_TONES = [
  { border: '#7c3aed', background: '#f5f3ff', text: '#6d28d9' },
  { border: '#ea7800', background: '#fff7e6', text: '#c55f00' },
  { border: '#059669', background: '#ecfdf3', text: '#047857' },
  { border: '#2775ca', background: '#eff6ff', text: '#1d63aa' },
];

export function AdminMapDesigner() {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [access, setAccess] = useState<AccessState>('loading');
  const [token, setToken] = useState('');
  const [venues, setVenues] = useState<AdminVenue[]>([]);
  const [venueId, setVenueId] = useState('');
  const [zones, setZones] = useState<PositionedZone[]>([]);
  const [booths, setBooths] = useState<PositionedBooth[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dirtyZones, setDirtyZones] = useState<Set<string>>(new Set());
  const [dirtyBooths, setDirtyBooths] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

        const venueRows = await getAdminVenues(accessToken, controller.signal);
        if (!active) return;
        setToken(accessToken);
        setVenues(venueRows);
        setVenueId(venueRows[0]?.id ?? '');
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
    if (!token || !venueId) {
      setZones([]);
      setBooths([]);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setSuccess(null);
    setSelection(null);

    void (async () => {
      try {
        const zoneRows = await getAdminZones(venueId, token, controller.signal);
        const boothGroups = await Promise.all(
          zoneRows.map((zone) => getAdminBooths(zone.id, token, controller.signal)),
        );
        setZones(
          zoneRows.map((zone, index) => ({
            ...zone,
            ...zoneFallbackPosition(zone, index),
          })),
        );
        setBooths(
          boothGroups.flatMap((rows) =>
            rows.map((booth, index) => ({
              ...booth,
              ...boothFallbackPosition(booth, index),
            })),
          ),
        );
        setDirtyZones(new Set());
        setDirtyBooths(new Set());
      } catch (cause) {
        if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
          setError(describeError(cause, 'ไม่สามารถโหลดข้อมูลแผนผังได้'));
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [token, venueId]);

  useEffect(() => {
    if (!drag) return;
    const activeDrag = drag;

    function move(event: PointerEvent) {
      const nextX = activeDrag.startX + ((event.clientX - activeDrag.startClientX) / activeDrag.width) * 100;
      const nextY = activeDrag.startY + ((event.clientY - activeDrag.startClientY) / activeDrag.height) * 100;

      if (activeDrag.kind === 'zone') {
        setZones((current) =>
          current.map((zone) =>
            zone.id === activeDrag.id
              ? { ...zone, x: clamp(nextX, 0, 63), y: clamp(nextY, 9, 68) }
              : zone,
          ),
        );
      } else {
        setBooths((current) =>
          current.map((booth) =>
            booth.id === activeDrag.id
              ? { ...booth, x: clamp(nextX, 4, 78), y: clamp(nextY, 31, 68) }
              : booth,
          ),
        );
      }
    }

    function finish() {
      if (activeDrag.kind === 'zone') {
        setDirtyZones((current) => new Set(current).add(activeDrag.id));
      } else {
        setDirtyBooths((current) => new Set(current).add(activeDrag.id));
      }
      setDrag(null);
    }

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish, { once: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
    };
  }, [drag]);

  const beginDrag = useCallback(
    (
      kind: 'zone' | 'booth',
      id: string,
      position: Position,
      event: ReactPointerEvent<HTMLButtonElement>,
    ) => {
      if (event.button !== 0) return;
      const bounds =
        kind === 'zone'
          ? canvasRef.current?.getBoundingClientRect()
          : event.currentTarget.parentElement?.getBoundingClientRect();
      if (!bounds || bounds.width === 0 || bounds.height === 0) return;

      event.preventDefault();
      setSelection({ kind, id });
      setSuccess(null);
      setDrag({
        kind,
        id,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startX: position.x,
        startY: position.y,
        width: bounds.width,
        height: bounds.height,
      });
    },
    [],
  );

  async function saveLayout() {
    if (!token || saving || (dirtyZones.size === 0 && dirtyBooths.size === 0)) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await Promise.all([
        ...zones
          .filter((zone) => dirtyZones.has(zone.id))
          .map((zone) =>
            updateAdminZone(zone.id, { posX: roundPosition(zone.x), posY: roundPosition(zone.y) }, token),
          ),
        ...booths
          .filter((booth) => dirtyBooths.has(booth.id))
          .map((booth) =>
            updateAdminBooth(
              booth.id,
              { posX: roundPosition(booth.x), posY: roundPosition(booth.y) },
              token,
            ),
          ),
      ]);
      setDirtyZones(new Set());
      setDirtyBooths(new Set());
      setSuccess('บันทึกตำแหน่งโซนและบูธเรียบร้อยแล้ว');
    } catch (cause) {
      setError(describeError(cause, 'บันทึกตำแหน่งไม่สำเร็จ'));
    } finally {
      setSaving(false);
    }
  }

  function updateSelectedPosition(axis: 'x' | 'y', rawValue: string) {
    if (!selection) return;
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return;

    if (selection.kind === 'zone') {
      setZones((current) =>
        current.map((zone) =>
          zone.id === selection.id
            ? { ...zone, [axis]: clamp(value, axis === 'y' ? 9 : 0, axis === 'x' ? 63 : 68) }
            : zone,
        ),
      );
      setDirtyZones((current) => new Set(current).add(selection.id));
    } else {
      setBooths((current) =>
        current.map((booth) =>
          booth.id === selection.id
            ? { ...booth, [axis]: clamp(value, axis === 'x' ? 4 : 31, axis === 'x' ? 78 : 68) }
            : booth,
        ),
      );
      setDirtyBooths((current) => new Set(current).add(selection.id));
    }
    setSuccess(null);
  }

  if (access === 'loading') return <PageState label="กำลังตรวจสอบสิทธิ์ผู้ดูแล..." />;
  if (access === 'denied') {
    return <PageState label="บัญชีนี้ไม่มีสิทธิ์จัดการแผนผังขององค์กร" />;
  }

  const venue = venues.find((row) => row.id === venueId);
  const selectedZone =
    selection?.kind === 'zone' ? zones.find((zone) => zone.id === selection.id) : undefined;
  const selectedBooth =
    selection?.kind === 'booth' ? booths.find((booth) => booth.id === selection.id) : undefined;
  const hasChanges = dirtyZones.size > 0 || dirtyBooths.size > 0;

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[radial-gradient(circle_at_90%_4%,rgba(124,58,237,0.09),transparent_28%),#f8f6fb] px-4 py-7 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1320px]">
        <section className="rounded-[30px] bg-gradient-to-br from-[#35156e] via-[#7430e8] to-[#267978] px-6 py-8 text-white shadow-soft sm:px-9 lg:px-11">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-extrabold uppercase tracking-[1.1px]">
                <Map className="h-4 w-4" aria-hidden /> Admin map designer
              </span>
              <h1 className="mt-4 text-3xl font-black tracking-[-1px] sm:text-4xl">
                ออกแบบโซนและบูธด้วยการลากวาง
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-white/80 sm:text-base">
                จัดตำแหน่งจากข้อมูลจริงขององค์กร แล้วบันทึกเฉพาะพิกัดที่เปลี่ยนแปลง
              </p>
            </div>
            <Link href="/admin/zones" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 font-extrabold text-violet shadow-lg transition hover:-translate-y-0.5">
              <Settings2 className="h-5 w-5" aria-hidden /> จัดการข้อมูลโซนและบูธ
            </Link>
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-[28px] border border-[#e8e0f2] bg-white shadow-surface">
          <div className="flex flex-col gap-4 border-b border-line px-5 py-5 sm:px-7 lg:flex-row lg:items-end lg:justify-between">
            <label className="grid max-w-xl flex-1 gap-2 text-sm font-bold text-ink">
              สถานที่จัดงาน
              <select value={venueId} onChange={(event) => setVenueId(event.target.value)} className="min-h-12 rounded-2xl border border-[#ddd4ec] bg-white px-4 text-sm outline-none focus:border-violet focus:ring-2 focus:ring-violet/15">
                {venues.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex min-h-11 items-center rounded-2xl bg-violet-tint px-4 text-xs font-bold text-violet">{zones.length} โซน · {booths.length} บูธ</span>
              <button type="button" onClick={() => void saveLayout()} disabled={!hasChanges || saving} className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-violet px-5 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(124,58,237,0.25)] transition hover:bg-[#6d28d9] disabled:cursor-not-allowed disabled:opacity-45">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'กำลังบันทึก...' : 'บันทึกตำแหน่ง'}
              </button>
            </div>
          </div>

          <div className="px-5 py-5 sm:px-7">
            <p className="mb-4 flex items-center gap-2 rounded-2xl bg-[#f5f0ff] px-4 py-3 text-sm font-semibold text-[#6942a8]">
              <Grip className="h-4 w-4 shrink-0" aria-hidden /> ลากกรอบโซนเพื่อจัดพื้นที่ และลากบูธภายในกรอบเพื่อกำหนดตำแหน่ง
            </p>
            {error && <Feedback tone="error">{error}</Feedback>}
            {success && <Feedback tone="success">{success}</Feedback>}

            <div ref={canvasRef} className="relative h-[680px] overflow-hidden rounded-[24px] border border-[#d9cdef] bg-[linear-gradient(#eee8f6_1px,transparent_1px),linear-gradient(90deg,#eee8f6_1px,transparent_1px),#fbfaff] bg-[size:32px_32px]">
              <div className="absolute inset-x-0 top-0 z-10 flex h-14 items-center justify-center bg-[#5b21b6] px-4 text-center text-sm font-extrabold text-white shadow-sm">ทางเข้า · จุดลงทะเบียน</div>
              {loading ? (
                <div className="absolute inset-0 grid place-items-center pt-14"><Loader2 className="h-8 w-8 animate-spin text-violet" aria-label="กำลังโหลดแผนผัง" /></div>
              ) : zones.length === 0 ? (
                <div className="absolute inset-0 grid place-items-center px-6 pt-14 text-center text-sm font-semibold text-muted">ยังไม่มีโซนในสถานที่นี้ กรุณาสร้างข้อมูลที่หน้าโซนและบูธก่อน</div>
              ) : zones.map((zone, index) => {
                const tone = ZONE_TONES[index % ZONE_TONES.length];
                const zoneBooths = booths.filter((booth) => booth.zoneId === zone.id);
                const active = selection?.kind === 'zone' && selection.id === zone.id;
                return (
                  <div key={zone.id} className="absolute h-[29%] w-[35%] min-w-[270px] rounded-[24px] border-2 border-dashed shadow-[0_12px_30px_rgba(47,32,79,0.08)]" style={{ left: `${zone.x}%`, top: `${zone.y}%`, borderColor: active ? '#201b2e' : tone.border, backgroundColor: tone.background }}>
                    <button type="button" onPointerDown={(event) => beginDrag('zone', zone.id, zone, event)} className="absolute inset-x-0 top-0 flex h-[30%] cursor-grab touch-none items-start gap-2 rounded-t-[22px] px-4 py-3 text-left active:cursor-grabbing" style={{ color: tone.text }} aria-label={`ลากโซน ${zone.code}`}>
                      <Grip className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      <span><strong className="block text-sm">{zone.code} · {zone.name || 'ยังไม่ได้ตั้งชื่อ'}</strong><span className="mt-0.5 block text-[11px] opacity-75">{zone.description || 'ไม่มีรายละเอียด'}</span></span>
                    </button>
                    {zoneBooths.map((booth) => {
                      const boothActive = selection?.kind === 'booth' && selection.id === booth.id;
                      return (
                        <button type="button" key={booth.id} onPointerDown={(event) => beginDrag('booth', booth.id, booth, event)} className="absolute grid h-11 w-[18%] min-w-[58px] cursor-grab touch-none place-items-center rounded-xl border-2 bg-white text-[11px] font-black shadow-[0_5px_12px_rgba(36,25,57,0.1)] active:cursor-grabbing" style={{ left: `${booth.x}%`, top: `${booth.y}%`, borderColor: boothActive ? '#201b2e' : tone.border, color: tone.text }} aria-label={`ลากบูธ ${booth.code}`}>
                          {booth.code}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
              <div className="absolute inset-x-0 bottom-0 flex h-12 items-center justify-center bg-[#4f485c] text-sm font-extrabold text-white">ทางออก · จุดรับส่ง</div>
            </div>
            <p className="mt-3 text-xs text-muted">พิกัดเก็บเป็นเปอร์เซ็นต์ของพื้นที่ แผนผังจึงปรับตามขนาดหน้าจอได้</p>
          </div>
        </section>

        <PropertyPanel venueName={venue?.name ?? ''} zone={selectedZone} booth={selectedBooth} onPositionChange={updateSelectedPosition} />
      </div>
    </main>
  );
}

function PropertyPanel({ venueName, zone, booth, onPositionChange }: { venueName: string; zone?: PositionedZone; booth?: PositionedBooth; onPositionChange: (axis: 'x' | 'y', value: string) => void }) {
  const item = booth ?? zone;
  return (
    <section className="mt-6 rounded-[28px] border border-[#e8e0f2] bg-white p-5 shadow-surface sm:p-7">
      <span className="text-xs font-extrabold uppercase tracking-[1.4px] text-violet">Property panel</span>
      <h2 className="mt-1 text-2xl font-black tracking-[-0.5px] text-ink">ตั้งค่ารายละเอียด</h2>
      {!item ? <p className="mt-5 rounded-2xl bg-[#f7f4fb] p-5 text-sm font-semibold text-muted">เลือกโซนหรือบูธบนแผนผังเพื่อดูตำแหน่งและรายละเอียด</p> : (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <ReadOnlyField label={booth ? 'เลขบูธ' : 'รหัสโซน'} value={item.code} />
          <ReadOnlyField label={booth ? 'สถานะ' : 'ชื่อโซน'} value={booth ? booth.status : (zone?.name || 'ยังไม่ได้ตั้งชื่อ')} />
          <ReadOnlyField label="สถานที่" value={venueName || '-'} />
          <NumberField label="ตำแหน่งแนวนอน (%)" value={item.x} onChange={(value) => onPositionChange('x', value)} />
          <NumberField label="ตำแหน่งแนวตั้ง (%)" value={item.y} onChange={(value) => onPositionChange('y', value)} />
          {booth && <div className="rounded-2xl bg-[#f5f0ff] px-4 py-3 text-sm text-[#63439a] md:col-span-2 xl:col-span-5">บูธ {booth.code} ขนาด {booth.widthM ?? '-'} × {booth.heightM ?? '-'} เมตร · ราคา {formatMoney(booth.boothPrice)} บาท</div>}
        </div>
      )}
    </section>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return <label className="grid gap-2 text-xs font-bold text-ink">{label}<input readOnly value={value} className="min-h-12 rounded-2xl border border-[#e2daec] bg-[#faf9fc] px-4 text-sm" /></label>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) {
  return <label className="grid gap-2 text-xs font-bold text-ink">{label}<input type="number" min="0" max="100" step="0.1" value={roundPosition(value)} onChange={(event) => onChange(event.target.value)} className="min-h-12 rounded-2xl border border-[#ddd4ec] px-4 text-sm outline-none focus:border-violet focus:ring-2 focus:ring-violet/15" /></label>;
}

function Feedback({ tone, children }: { tone: 'error' | 'success'; children: string }) {
  const successful = tone === 'success';
  const Icon = successful ? CheckCircle2 : AlertCircle;
  return <p role={successful ? 'status' : 'alert'} className={`mb-4 flex items-start gap-2 rounded-2xl p-3 text-sm font-semibold ${successful ? 'bg-[#ecfdf3] text-[#166534]' : 'bg-[#fff1f2] text-[#b91c1c]'}`}><Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {children}</p>;
}

function PageState({ label }: { label: string }) {
  return <main className="grid min-h-[calc(100vh-72px)] place-items-center bg-[#f8f6fb] px-5"><p className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-muted shadow-sm">{label}</p></main>;
}

function zoneFallbackPosition(zone: AdminZone, index: number): Position {
  return {
    x: clamp(storedPosition(zone.posX, 4 + (index % 2) * 52), 0, 63),
    y: clamp(storedPosition(zone.posY, 10 + Math.floor(index / 2) * 29), 9, 68),
  };
}

function boothFallbackPosition(booth: AdminBooth, index: number): Position {
  return {
    x: clamp(storedPosition(booth.posX, 6 + (index % 4) * 23), 0, 88),
    y: clamp(storedPosition(booth.posY, 34 + Math.floor(index / 4) * 26), 10, 82),
  };
}

function storedPosition(raw: string | null, fallback: number): number {
  if (raw === null || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed >= 0 && parsed <= 1 ? parsed * 100 : clamp(parsed, 0, 100);
}

function roundPosition(value: number): number { return Math.round(value * 10) / 10; }
function clamp(value: number, minimum: number, maximum: number): number { return Math.min(Math.max(value, minimum), maximum); }

function formatMoney(value: string): string {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numeric) : value;
}

function describeError(cause: unknown, fallback: string): string {
  if (!(cause instanceof ApiError)) return fallback;
  if (cause.status === 404) return 'ไม่พบข้อมูลหรือคุณไม่มีสิทธิ์จัดการรายการนี้';
  return cause.message;
}
