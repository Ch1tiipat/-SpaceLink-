'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import {
  AlertCircle,
  Boxes,
  Building2,
  CheckCircle2,
  Edit3,
  Loader2,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import {
  ApiError,
  createAdminBooth,
  createAdminZone,
  deleteAdminBooth,
  deleteAdminZone,
  getAdminBooths,
  getAdminVenues,
  getAdminZones,
  getMe,
  updateAdminBooth,
  updateAdminZone,
  type AdminBooth,
  type AdminBoothStatus,
  type AdminVenue,
  type AdminZone,
  type SaveBoothInput,
  type SaveZoneInput,
} from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { useAdminOrganizationSelection } from '@/components/app-shell';

type AccessState = 'loading' | 'allowed' | 'denied';
type EditorMode = 'create' | 'edit';

type ZoneDraft = {
  code: string;
  name: string;
  description: string;
  defaultBoothPrice: string;
  posX: string;
  posY: string;
};

type BoothDraft = {
  code: string;
  boothPrice: string;
  widthM: string;
  heightM: string;
  posX: string;
  posY: string;
  status: AdminBoothStatus;
};

const EMPTY_ZONE: ZoneDraft = {
  code: '',
  name: '',
  description: '',
  defaultBoothPrice: '',
  posX: '',
  posY: '',
};

const EMPTY_BOOTH: BoothDraft = {
  code: '',
  boothPrice: '',
  widthM: '',
  heightM: '',
  posX: '',
  posY: '',
  status: 'AVAILABLE',
};

const STATUS_LABELS: Record<AdminBoothStatus, string> = {
  AVAILABLE: 'ว่างพร้อมจอง',
  BOOKED: 'จองแล้ว',
  MAINTENANCE: 'ปิดปรับปรุง',
  INACTIVE: 'ไม่เปิดใช้งาน',
};

export function AdminZoneBoothScreen() {
  const router = useRouter();
  const { selectedOrganizationId } = useAdminOrganizationSelection();
  const [access, setAccess] = useState<AccessState>('loading');
  const [token, setToken] = useState('');
  const [venues, setVenues] = useState<AdminVenue[]>([]);
  const [zones, setZones] = useState<AdminZone[]>([]);
  const [booths, setBooths] = useState<AdminBooth[]>([]);
  const [venueId, setVenueId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [loadingVenues, setLoadingVenues] = useState(false);
  const [loadingZones, setLoadingZones] = useState(false);
  const [loadingBooths, setLoadingBooths] = useState(false);
  const [saving, setSaving] = useState(false);
  const [zoneMode, setZoneMode] = useState<EditorMode>('create');
  const [boothMode, setBoothMode] = useState<EditorMode>('create');
  const [editingZoneId, setEditingZoneId] = useState('');
  const [editingBoothId, setEditingBoothId] = useState('');
  const [zoneDraft, setZoneDraft] = useState<ZoneDraft>(EMPTY_ZONE);
  const [boothDraft, setBoothDraft] = useState<BoothDraft>(EMPTY_BOOTH);
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

        setToken(accessToken);
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
    if (access !== 'allowed' || !token || !selectedOrganizationId) return;
    const controller = new AbortController();
    setLoadingVenues(true);
    setError(null);
    setSuccess(null);

    void getAdminVenues(token, controller.signal)
      .then((rows) => {
        const organizationVenues = rows.filter(
          (venue) => venue.organizationId === selectedOrganizationId,
        );
        setVenues(organizationVenues);
        setVenueId((current) =>
          organizationVenues.some((venue) => venue.id === current)
            ? current
            : (organizationVenues[0]?.id ?? ''),
        );
      })
      .catch((cause) => {
        if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
          setError(describeError(cause, 'ไม่สามารถโหลดสถานที่จัดงานได้'));
        }
      })
      .finally(() => setLoadingVenues(false));

    return () => controller.abort();
  }, [access, selectedOrganizationId, token]);

  useEffect(() => {
    if (!token || !venueId) {
      setZones([]);
      setZoneId('');
      return;
    }
    const controller = new AbortController();
    setLoadingZones(true);
    setError(null);

    void getAdminZones(venueId, token, controller.signal)
      .then((rows) => {
        setZones(rows);
        setZoneId((current) =>
          rows.some((zone) => zone.id === current) ? current : (rows[0]?.id ?? ''),
        );
      })
      .catch((cause) => {
        if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
          setError(describeError(cause, 'ไม่สามารถโหลดข้อมูลโซนได้'));
        }
      })
      .finally(() => setLoadingZones(false));

    return () => controller.abort();
  }, [token, venueId]);

  useEffect(() => {
    if (!token || !zoneId) {
      setBooths([]);
      return;
    }
    const controller = new AbortController();
    setLoadingBooths(true);

    void getAdminBooths(zoneId, token, controller.signal)
      .then(setBooths)
      .catch((cause) => {
        if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
          setError(describeError(cause, 'ไม่สามารถโหลดข้อมูลบูธได้'));
        }
      })
      .finally(() => setLoadingBooths(false));

    return () => controller.abort();
  }, [token, zoneId]);

  async function refreshZones(preferredId?: string) {
    const rows = await getAdminZones(venueId, token);
    setZones(rows);
    const nextId =
      preferredId && rows.some((zone) => zone.id === preferredId)
        ? preferredId
        : (rows[0]?.id ?? '');
    setZoneId(nextId);
  }

  async function refreshBooths() {
    if (!zoneId) {
      setBooths([]);
      return;
    }
    setBooths(await getAdminBooths(zoneId, token));
  }

  function startCreateZone() {
    setZoneMode('create');
    setEditingZoneId('');
    setZoneDraft(EMPTY_ZONE);
    clearFeedback();
  }

  function startEditZone(zone: AdminZone) {
    setZoneId(zone.id);
    setZoneMode('edit');
    setEditingZoneId(zone.id);
    setZoneDraft({
      code: zone.code,
      name: zone.name ?? '',
      description: zone.description ?? '',
      defaultBoothPrice: zone.defaultBoothPrice ?? '',
      posX: zone.posX ?? '',
      posY: zone.posY ?? '',
    });
    clearFeedback();
  }

  function startCreateBooth() {
    setBoothMode('create');
    setEditingBoothId('');
    setBoothDraft(EMPTY_BOOTH);
    clearFeedback();
  }

  function startEditBooth(booth: AdminBooth) {
    setBoothMode('edit');
    setEditingBoothId(booth.id);
    setBoothDraft({
      code: booth.code,
      boothPrice: booth.boothPrice,
      widthM: booth.widthM ?? '',
      heightM: booth.heightM ?? '',
      posX: booth.posX ?? '',
      posY: booth.posY ?? '',
      status: booth.status,
    });
    clearFeedback();
  }

  async function submitZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!venueId || !zoneDraft.code.trim()) {
      setError('กรุณาเลือกสถานที่และกรอกรหัสโซน');
      return;
    }
    if (
      zoneDraft.defaultBoothPrice &&
      !isMoney(zoneDraft.defaultBoothPrice)
    ) {
      setError('ราคามาตรฐานต้องเป็นจำนวนเงินไม่เกิน 2 ตำแหน่งทศนิยม');
      return;
    }

    const payload: SaveZoneInput = {
      code: zoneDraft.code.trim().toUpperCase(),
      name: zoneDraft.name.trim(),
      description: zoneDraft.description.trim(),
      ...optionalString('defaultBoothPrice', zoneDraft.defaultBoothPrice),
      ...optionalNumber('posX', zoneDraft.posX),
      ...optionalNumber('posY', zoneDraft.posY),
    };

    setSaving(true);
    clearFeedback();
    try {
      const saved =
        zoneMode === 'edit'
          ? await updateAdminZone(editingZoneId, payload, token)
          : await createAdminZone(venueId, payload, token);
      await refreshZones(saved.id);
      startCreateZone();
      setSuccess(zoneMode === 'edit' ? 'แก้ไขโซนเรียบร้อย' : 'สร้างโซนเรียบร้อย');
    } catch (cause) {
      setError(describeError(cause, 'ไม่สามารถบันทึกโซนได้'));
    } finally {
      setSaving(false);
    }
  }

  async function submitBooth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!zoneId || !boothDraft.code.trim() || !isMoney(boothDraft.boothPrice)) {
      setError('กรุณาเลือกโซน กรอกรหัสบูธ และราคาที่มีทศนิยมไม่เกิน 2 ตำแหน่ง');
      return;
    }

    const payload: SaveBoothInput = {
      code: boothDraft.code.trim().toUpperCase(),
      boothPrice: boothDraft.boothPrice.trim(),
      ...optionalNumber('widthM', boothDraft.widthM),
      ...optionalNumber('heightM', boothDraft.heightM),
      ...optionalNumber('posX', boothDraft.posX),
      ...optionalNumber('posY', boothDraft.posY),
    };

    setSaving(true);
    clearFeedback();
    try {
      if (boothMode === 'edit') {
        await updateAdminBooth(
          editingBoothId,
          { ...payload, status: boothDraft.status },
          token,
        );
      } else {
        await createAdminBooth(zoneId, payload, token);
      }
      await refreshBooths();
      startCreateBooth();
      setSuccess(boothMode === 'edit' ? 'แก้ไขบูธเรียบร้อย' : 'สร้างบูธเรียบร้อย');
    } catch (cause) {
      setError(describeError(cause, 'ไม่สามารถบันทึกบูธได้'));
    } finally {
      setSaving(false);
    }
  }

  async function removeZone(zone: AdminZone) {
    if (!window.confirm('ยืนยันลบโซน ' + zone.code + '? ต้องลบบูธทั้งหมดในโซนก่อน')) return;
    setSaving(true);
    clearFeedback();
    try {
      await deleteAdminZone(zone.id, token);
      await refreshZones();
      startCreateZone();
      setSuccess('ลบโซน ' + zone.code + ' เรียบร้อยแล้ว');
    } catch (cause) {
      setError(describeError(cause, 'ไม่สามารถลบโซนได้'));
    } finally {
      setSaving(false);
    }
  }

  async function removeBooth(booth: AdminBooth) {
    if (!window.confirm('ยืนยันลบบูธ ' + booth.code + '?')) return;
    setSaving(true);
    clearFeedback();
    try {
      await deleteAdminBooth(booth.id, token);
      await refreshBooths();
      startCreateBooth();
      setSuccess('ลบบูธ ' + booth.code + ' เรียบร้อยแล้ว');
    } catch (cause) {
      setError(describeError(cause, 'ไม่สามารถลบบูธได้'));
    } finally {
      setSaving(false);
    }
  }

  function clearFeedback() {
    setError(null);
    setSuccess(null);
  }

  if (access === 'loading') return <PageState label="กำลังตรวจสอบสิทธิ์ผู้ดูแล" />;

  if (access === 'denied') {
    return (
      <main className="grid min-h-[calc(100vh-72px)] place-items-center bg-[#f8f6fb] px-5">
        <section className="max-w-lg rounded-[28px] border border-[#eadff7] bg-white p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto h-11 w-11 text-[#dc2626]" aria-hidden />
          <h1 className="mt-4 text-2xl font-black text-ink">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            หน้านี้สำหรับผู้ดูแลองค์กรและผู้ดูแลระบบเท่านั้น
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[radial-gradient(circle_at_top_left,#f2ecff_0,transparent_32%),#f8f7fb] px-4 py-8 sm:px-7 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#eee7ff] px-3 py-1 text-xs font-extrabold uppercase tracking-[0.14em] text-violet">
            <Boxes className="h-4 w-4" aria-hidden /> Organization Admin
          </span>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink sm:text-4xl">
            จัดการโซนและบูธ
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            สร้าง แก้ไข และจัดวางพื้นที่ขาย โดยระบบจะตรวจสอบสิทธิ์องค์กรผ่าน API ทุกครั้ง
          </p>
        </header>

        <section className="mt-6 rounded-[26px] border border-line bg-white p-5 shadow-[0_18px_45px_rgba(54,36,91,0.06)]">
          <label className="block max-w-xl">
            <span className="mb-2 flex items-center gap-2 text-sm font-extrabold text-ink">
              <Building2 className="h-4 w-4 text-violet" aria-hidden /> สถานที่จัดงาน
            </span>
            <select
              value={venueId}
              onChange={(event) => {
                setVenueId(event.target.value);
                startCreateZone();
                startCreateBooth();
              }}
              disabled={loadingVenues}
              className="h-12 w-full rounded-2xl border border-line bg-white px-4 text-sm font-bold text-ink outline-none focus:border-violet"
            >
              {venues.length === 0 && <option value="">ไม่พบสถานที่</option>}
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>{venue.name}</option>
              ))}
            </select>
          </label>
          <p className="mt-3 text-xs leading-5 text-muted">
            รายการสถานที่มาจาก Public Discovery API การสร้างและแก้ไขจะสำเร็จเฉพาะสถานที่ที่บัญชีนี้มีสิทธิ์ดูแล
          </p>
          {error && <Feedback tone="error">{error}</Feedback>}
          {success && <Feedback tone="success">{success}</Feedback>}
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <AdminPanel
            title="โซน"
            count={zones.length}
            actionLabel="เพิ่มโซน"
            onAction={startCreateZone}
          >
            <EntityList loading={loadingZones} emptyLabel="ยังไม่มีโซนในสถานที่นี้">
              {zones.map((zone) => (
                <article
                  key={zone.id}
                  className={
                    'rounded-2xl border p-4 transition ' +
                    (zone.id === zoneId ? 'border-violet bg-[#faf7ff]' : 'border-line bg-white')
                  }
                >
                  <button
                    type="button"
                    onClick={() => {
                      setZoneId(zone.id);
                      startCreateBooth();
                    }}
                    className="w-full text-left"
                  >
                    <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-violet">
                      Zone {zone.code}
                    </span>
                    <h3 className="mt-1 font-black text-ink">{zone.name || 'ยังไม่ได้ตั้งชื่อ'}</h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">
                      {zone.description || 'ไม่มีรายละเอียด'}
                    </p>
                  </button>
                  <div className="mt-3 flex gap-2">
                    <MiniButton label="แก้ไข" icon={Edit3} onClick={() => startEditZone(zone)} />
                    <MiniButton label="ลบ" icon={Trash2} danger onClick={() => void removeZone(zone)} />
                  </div>
                </article>
              ))}
            </EntityList>

            <ZoneEditor
              mode={zoneMode}
              draft={zoneDraft}
              saving={saving}
              disabled={!venueId}
              onChange={setZoneDraft}
              onSubmit={submitZone}
              onCancel={startCreateZone}
            />
          </AdminPanel>

          <AdminPanel
            title={'บูธ' + (zoneId ? ' ในโซน ' + (zones.find((zone) => zone.id === zoneId)?.code ?? '') : '')}
            count={booths.length}
            actionLabel="เพิ่มบูธ"
            onAction={startCreateBooth}
          >
            <EntityList loading={loadingBooths} emptyLabel={zoneId ? 'ยังไม่มีบูธในโซนนี้' : 'กรุณาเลือกโซน'}>
              {booths.map((booth) => (
                <article key={booth.id} className="rounded-2xl border border-line bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-violet">
                        Booth {booth.code}
                      </span>
                      <p className="mt-1 font-black text-ink">฿{formatMoney(booth.boothPrice)}</p>
                    </div>
                    <StatusBadge status={booth.status} />
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {booth.widthM ?? '-'} × {booth.heightM ?? '-'} เมตร
                  </p>
                  <div className="mt-3 flex gap-2">
                    <MiniButton label="แก้ไข" icon={Edit3} onClick={() => startEditBooth(booth)} />
                    <MiniButton label="ลบ" icon={Trash2} danger onClick={() => void removeBooth(booth)} />
                  </div>
                </article>
              ))}
            </EntityList>

            <BoothEditor
              mode={boothMode}
              draft={boothDraft}
              saving={saving}
              disabled={!zoneId}
              onChange={setBoothDraft}
              onSubmit={submitBooth}
              onCancel={startCreateBooth}
            />
          </AdminPanel>
        </div>
      </div>
    </main>
  );
}

function AdminPanel({
  title,
  count,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  count: number;
  actionLabel: string;
  onAction: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-line bg-white p-5 shadow-[0_20px_50px_rgba(54,36,91,0.06)] sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-ink">{title}</h2>
          <p className="text-xs text-muted">{count} รายการ</p>
        </div>
        <button type="button" onClick={onAction} className="flex items-center gap-2 rounded-xl bg-violet px-4 py-2.5 text-xs font-extrabold text-white">
          <Plus className="h-4 w-4" aria-hidden /> {actionLabel}
        </button>
      </div>
      {children}
    </section>
  );
}

function EntityList({
  loading,
  emptyLabel,
  children,
}: {
  loading: boolean;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <div className="mt-5 grid max-h-[360px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
      {loading ? (
        <p className="col-span-full flex items-center justify-center gap-2 rounded-2xl bg-[#faf8fd] p-6 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> กำลังโหลด...
        </p>
      ) : items.length === 0 ? (
        <p className="col-span-full rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">{emptyLabel}</p>
      ) : children}
    </div>
  );
}

function ZoneEditor({
  mode,
  draft,
  saving,
  disabled,
  onChange,
  onSubmit,
  onCancel,
}: {
  mode: EditorMode;
  draft: ZoneDraft;
  saving: boolean;
  disabled: boolean;
  onChange: (draft: ZoneDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="mt-6 border-t border-line pt-5">
      <h3 className="font-black text-ink">{mode === 'edit' ? 'แก้ไขโซน' : 'เพิ่มโซน'}</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="รหัสโซน *" value={draft.code} onChange={(code) => onChange({ ...draft, code })} placeholder="A" />
        <Field label="ชื่อโซน" value={draft.name} onChange={(name) => onChange({ ...draft, name })} placeholder="เช่น โซนอาหาร" />
        <Field label="ราคาบูธเริ่มต้น" value={draft.defaultBoothPrice} onChange={(defaultBoothPrice) => onChange({ ...draft, defaultBoothPrice })} placeholder="1500.00" />
        <Field label="ตำแหน่ง X" value={draft.posX} onChange={(posX) => onChange({ ...draft, posX })} placeholder="0" />
        <Field label="ตำแหน่ง Y" value={draft.posY} onChange={(posY) => onChange({ ...draft, posY })} placeholder="0" />
      </div>
      <label className="mt-3 block text-xs font-extrabold text-ink">
        รายละเอียด
        <textarea value={draft.description} onChange={(event) => onChange({ ...draft, description: event.target.value })} rows={3} className="mt-1.5 w-full resize-none rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-violet" />
      </label>
      <EditorActions mode={mode} saving={saving} disabled={disabled} onCancel={onCancel} />
    </form>
  );
}

function BoothEditor({
  mode,
  draft,
  saving,
  disabled,
  onChange,
  onSubmit,
  onCancel,
}: {
  mode: EditorMode;
  draft: BoothDraft;
  saving: boolean;
  disabled: boolean;
  onChange: (draft: BoothDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="mt-6 border-t border-line pt-5">
      <h3 className="font-black text-ink">{mode === 'edit' ? 'แก้ไขบูธ' : 'เพิ่มบูธ'}</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="รหัสบูธ *" value={draft.code} onChange={(code) => onChange({ ...draft, code })} placeholder="A01" />
        <Field label="ราคา *" value={draft.boothPrice} onChange={(boothPrice) => onChange({ ...draft, boothPrice })} placeholder="1500.00" />
        <Field label="ความกว้าง (เมตร)" value={draft.widthM} onChange={(widthM) => onChange({ ...draft, widthM })} placeholder="3" />
        <Field label="ความลึก (เมตร)" value={draft.heightM} onChange={(heightM) => onChange({ ...draft, heightM })} placeholder="3" />
        <Field label="ตำแหน่ง X" value={draft.posX} onChange={(posX) => onChange({ ...draft, posX })} placeholder="0" />
        <Field label="ตำแหน่ง Y" value={draft.posY} onChange={(posY) => onChange({ ...draft, posY })} placeholder="0" />
        {mode === 'edit' && (
          <label className="text-xs font-extrabold text-ink">
            สถานะ
            <select value={draft.status} onChange={(event) => onChange({ ...draft, status: event.target.value as AdminBoothStatus })} className="mt-1.5 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-violet">
              {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        )}
      </div>
      <EditorActions mode={mode} saving={saving} disabled={disabled} onCancel={onCancel} />
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="text-xs font-extrabold text-ink">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 h-10 w-full rounded-xl border border-line px-3 text-sm outline-none focus:border-violet" />
    </label>
  );
}

function EditorActions({
  mode,
  saving,
  disabled,
  onCancel,
}: {
  mode: EditorMode;
  saving: boolean;
  disabled: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="mt-4 flex gap-2">
      <button type="submit" disabled={saving || disabled} className="flex items-center gap-2 rounded-xl bg-[#15803d] px-4 py-2.5 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50">
        <Save className="h-4 w-4" aria-hidden /> {saving ? 'กำลังบันทึก...' : 'บันทึก'}
      </button>
      {mode === 'edit' && <button type="button" onClick={onCancel} className="rounded-xl border border-line px-4 py-2.5 text-xs font-extrabold text-ink">ยกเลิก</button>}
    </div>
  );
}

function MiniButton({
  label,
  icon: Icon,
  danger = false,
  onClick,
}: {
  label: string;
  icon: typeof Edit3;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold ' + (danger ? 'bg-[#fff1f2] text-[#b91c1c]' : 'bg-[#f2edfb] text-violet')}>
      <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
    </button>
  );
}

function StatusBadge({ status }: { status: AdminBoothStatus }) {
  const tone =
    status === 'AVAILABLE'
      ? 'bg-[#dcfce7] text-[#166534]'
      : status === 'BOOKED'
        ? 'bg-[#ede9fe] text-[#6d28d9]'
        : 'bg-[#f1eef4] text-[#655d70]';
  return <span className={'rounded-full px-2.5 py-1 text-[11px] font-extrabold ' + tone}>{STATUS_LABELS[status]}</span>;
}

function Feedback({ tone, children }: { tone: 'error' | 'success'; children: string }) {
  const success = tone === 'success';
  const Icon = success ? CheckCircle2 : AlertCircle;
  return (
    <p role={success ? 'status' : 'alert'} className={'mt-4 flex items-start gap-2 rounded-2xl p-3 text-sm font-semibold ' + (success ? 'bg-[#ecfdf3] text-[#166534]' : 'bg-[#fff1f2] text-[#b91c1c]')}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {children}
    </p>
  );
}

function PageState({ label }: { label: string }) {
  return (
    <main className="grid min-h-[calc(100vh-72px)] place-items-center bg-[#f8f6fb] px-5">
      <p className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-muted shadow-sm">{label}</p>
    </main>
  );
}

function optionalString<Key extends string>(key: Key, value: string): Partial<Record<Key, string>> {
  return value.trim() ? ({ [key]: value.trim() } as Partial<Record<Key, string>>) : {};
}

function optionalNumber<Key extends string>(key: Key, value: string): Partial<Record<Key, number>> {
  if (!value.trim()) return {};
  const parsed = Number(value);
  return Number.isFinite(parsed) ? ({ [key]: parsed } as Partial<Record<Key, number>>) : {};
}

function isMoney(value: string): boolean {
  return /^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value.trim());
}

function describeError(cause: unknown, fallback: string): string {
  if (!(cause instanceof ApiError)) return fallback;
  if (cause.status === 404) return 'ไม่พบข้อมูลหรือคุณไม่มีสิทธิ์จัดการรายการนี้';
  return cause.message;
}

function formatMoney(value: string): string {
  const [whole, fraction] = value.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction ? grouped + '.' + fraction.padEnd(2, '0') : grouped + '.00';
}
