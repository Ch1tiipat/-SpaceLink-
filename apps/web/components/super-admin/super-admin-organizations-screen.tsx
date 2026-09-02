'use client';

import { FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import {
  ApiError,
  createSuperAdminOrganization,
  getSuperAdminCompanyAdmins,
  getSuperAdminOrganizations,
  updateSuperAdminOrganizationPromptPay,
  updateSuperAdminOrganizationStatus,
  type CreateSuperAdminOrganizationInput,
  type SuperAdminCompanyAdmin,
  type SuperAdminOrganization,
  type SuperAdminOrganizationStatus,
} from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabase';

const PAGE_SIZE = 25;
const STATUSES: SuperAdminOrganizationStatus[] = [
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
];

export function SuperAdminOrganizationsScreen() {
  const [organizations, setOrganizations] = useState<SuperAdminOrganization[]>([]);
  const [admins, setAdmins] = useState<SuperAdminCompanyAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'ALL' | SuperAdminOrganizationStatus>('ALL');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingOrganization, setEditingOrganization] =
    useState<SuperAdminOrganization | null>(null);
  const [savingId, setSavingId] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError('');

    void (async () => {
      try {
        const token = await getAccessToken();
        const [organizationRows, adminRows] = await Promise.all([
          getSuperAdminOrganizations(token, controller.signal),
          getSuperAdminCompanyAdmins(token, controller.signal),
        ]);
        if (active) {
          setOrganizations(organizationRows);
          setAdmins(adminRows);
        }
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        if (active) setError(errorMessage(cause, 'โหลดข้อมูลองค์กรไม่สำเร็จ'));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadKey]);

  useEffect(() => setPage(1), [query, status]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const counts = useMemo(
    () =>
      organizations.reduce<Record<SuperAdminOrganizationStatus, number>>(
        (result, organization) => {
          result[organization.status] += 1;
          return result;
        },
        { ACTIVE: 0, INACTIVE: 0, SUSPENDED: 0 },
      ),
    [organizations],
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

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('th-TH');
    return organizations.filter((organization) => {
      const matchesStatus = status === 'ALL' || organization.status === status;
      const matchesQuery =
        !normalized ||
        organization.name.toLocaleLowerCase('th-TH').includes(normalized) ||
        organization.id.toLocaleLowerCase('th-TH').includes(normalized) ||
        organization.contactEmail.toLocaleLowerCase('th-TH').includes(normalized);
      return matchesStatus && matchesQuery;
    });
  }, [organizations, query, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleRows = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  async function createOrganization(input: CreateSuperAdminOrganizationInput) {
    const token = await getAccessToken();
    await createSuperAdminOrganization(input, token);
    setCreateOpen(false);
    setToast('สร้างองค์กรเรียบร้อยแล้ว');
    setReloadKey((value) => value + 1);
  }

  async function updateStatus(
    organization: SuperAdminOrganization,
    nextStatus: SuperAdminOrganizationStatus,
  ) {
    if (organization.status === nextStatus) return;
    if (
      !window.confirm(
        `ยืนยันเปลี่ยนสถานะ “${organization.name}” จาก ${organization.status} เป็น ${nextStatus} หรือไม่?`,
      )
    ) {
      return;
    }

    setSavingId(organization.id);
    try {
      const token = await getAccessToken();
      await updateSuperAdminOrganizationStatus(
        organization.id,
        nextStatus,
        token,
      );
      setToast(`เปลี่ยนสถานะ ${organization.name} เป็น ${nextStatus} แล้ว`);
      setReloadKey((value) => value + 1);
    } catch (cause) {
      setToast(errorMessage(cause, 'เปลี่ยนสถานะองค์กรไม่สำเร็จ'));
    } finally {
      setSavingId('');
    }
  }

  async function updatePromptPay(
    organization: SuperAdminOrganization,
    promptpayId: string,
  ) {
    const token = await getAccessToken();
    await updateSuperAdminOrganizationPromptPay(
      organization.id,
      promptpayId,
      token,
    );
    setEditingOrganization(null);
    setToast(`บันทึก PromptPay ของ ${organization.name} แล้ว`);
  }

  const hasFilters = query.trim().length > 0 || status !== 'ALL';

  return (
    <div className="relative z-0 mx-auto w-full max-w-[1440px] px-[15px] pb-11 pt-[23px] before:absolute before:right-[5%] before:top-[105px] before:-z-10 before:h-[280px] before:w-[280px] before:rounded-full before:bg-[rgba(124,58,237,.055)] before:blur-[10px] sm:px-[34px] sm:pt-[31px]">
      <section className="mb-6 flex flex-col items-start justify-between gap-[18px] sm:flex-row sm:items-end">
        <div>
          <span className="text-[11px] font-extrabold tracking-[1.1px] text-[#7c3aed]">ALL ORGANIZATIONS</span>
          <h1 className="mb-[5px] mt-[7px] text-[27px] font-black tracking-[-.8px] text-[#242032]">องค์กรทั้งหมด</h1>
          <p className="m-0 text-[15px] text-[#82788b]">ค้นหาและจัดการองค์กรจากข้อมูลที่ Backend รองรับแล้ว</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled title="ยังไม่มี Export Endpoint" className="min-h-[38px] rounded-lg border border-[#e7dfea] bg-white px-[13px] text-[13px] font-bold text-[#716675] opacity-55">ส่งออก · รอ Backend</button>
          <button type="button" onClick={() => setCreateOpen(true)} className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[linear-gradient(135deg,#9656f0,#6d28d9)] px-[13px] text-[13px] font-bold text-white shadow-[0_8px_20px_rgba(124,58,237,.2)]"><Plus className="h-4 w-4" />สร้างองค์กร</button>
        </div>
      </section>

      <section className="mb-[18px] flex flex-col gap-2 rounded-[11px] border border-[#e1d5ef] bg-[#fbf8ff] px-3.5 py-3 text-xs text-[#675d70] sm:flex-row sm:items-center">
        <span className="w-fit shrink-0 rounded-full bg-[#eee5fb] px-2.5 py-1 text-[11px] font-extrabold text-[#6d28d9]">Backend พร้อมใช้</span>
        <p className="m-0">รองรับรายชื่อ สร้าง แก้ PromptPay และเปลี่ยนสถานะองค์กร · ทุก action ตรวจ SUPER_ADMIN ฝั่ง Server</p>
      </section>

      <section className="mb-[18px] grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="องค์กรทั้งหมด" value={organizations.length} detail="GET /organizations" tone="green" loading={loading} />
        <SummaryCard label="ACTIVE" value={counts.ACTIVE} detail="กำลังใช้งาน" tone="green" loading={loading} />
        <SummaryCard label="INACTIVE" value={counts.INACTIVE} detail="ปิดใช้งาน" tone="orange" loading={loading} />
        <SummaryCard label="SUSPENDED" value={counts.SUSPENDED} detail="ถูกระงับ" tone="red" loading={loading} />
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#e5dcf0] bg-white/95 shadow-[0_16px_38px_rgba(74,48,112,.06)]">
        <div className="flex flex-col justify-between gap-3 border-b border-[#ebe4ef] p-4 sm:flex-row">
          <label className="relative flex-1 sm:max-w-[360px]">
            <span className="sr-only">ค้นหาองค์กร</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#948a98]" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อองค์กรหรือ Organization ID" className="min-h-[38px] w-full rounded-lg border border-[#e7dfea] bg-white pl-[34px] pr-3 text-[13px] text-[#242032] outline-none focus:border-[#9b6be1] focus:ring-4 focus:ring-[#f0e7ff]" />
          </label>
          <div className="flex gap-2">
            <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} aria-label="กรองสถานะ" className="min-h-[38px] rounded-lg border border-[#e7dfea] bg-white px-2.5 text-[13px] text-[#716675]">
              <option value="ALL">ทุกสถานะ</option>
              {STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <button type="button" onClick={() => setReloadKey((value) => value + 1)} disabled={loading} className="grid h-[38px] w-[38px] place-items-center rounded-lg border border-[#e7dfea] bg-white text-[#716675] disabled:opacity-55" aria-label="โหลดข้อมูลใหม่"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
          </div>
        </div>

        {hasFilters ? (
          <div className="flex flex-wrap gap-2 border-b border-[#eee8f4] bg-[#fcfaff] px-4 py-2.5">
            {query.trim() ? <button type="button" onClick={() => setQuery('')} className="inline-flex min-h-[29px] items-center gap-1 rounded-full border border-[#dfcff8] bg-[#f4ecff] px-2.5 text-[11px] text-[#5f4c71]"><strong className="text-[#6d28d9]">ค้นหา:</strong>{query}<X className="h-3 w-3" /></button> : null}
            {status !== 'ALL' ? <button type="button" onClick={() => setStatus('ALL')} className="inline-flex min-h-[29px] items-center gap-1 rounded-full border border-[#dfcff8] bg-[#f4ecff] px-2.5 text-[11px] text-[#5f4c71]"><strong className="text-[#6d28d9]">สถานะ:</strong>{status}<X className="h-3 w-3" /></button> : null}
          </div>
        ) : null}

        {error ? (
          <StatePanel title={error} detail="ตรวจสอบการเชื่อมต่อแล้วลองใหม่อีกครั้ง" action={() => setReloadKey((value) => value + 1)} />
        ) : loading ? (
          <TableSkeleton />
        ) : visibleRows.length === 0 ? (
          <StatePanel title={organizations.length === 0 ? 'ยังไม่มีองค์กรในระบบ' : 'ไม่พบองค์กรที่ตรงกับตัวกรอง'} detail={organizations.length === 0 ? 'เริ่มต้นด้วยการสร้างองค์กรแรก' : 'ลองเปลี่ยนคำค้นหาหรือสถานะ'} />
        ) : (
          <>
            <p className="px-[17px] pt-2.5 text-[11px] font-bold text-[#6d28d9] md:hidden">← เลื่อนตารางเพื่อดูข้อมูลเพิ่มเติม →</p>
            <div className="overflow-x-auto px-[17px] pb-2.5">
              <table className="w-full min-w-[820px] border-collapse text-left">
                <thead><tr className="border-b border-[#ebe4ef] text-[11px] tracking-[.35px] text-[#948a98]"><th className="px-[7px] py-3.5">Organization</th><th className="px-[7px] py-3.5">Contact</th><th className="px-[7px] py-3.5">สถานะ</th><th className="px-[7px] py-3.5">Admins</th><th className="px-[7px] py-3.5">Action</th></tr></thead>
                <tbody className="divide-y divide-[#f0ecf3]">
                  {visibleRows.map((organization) => (
                    <tr key={organization.id} className="text-[13px] text-[#423b4c] transition hover:translate-x-0.5 hover:bg-[#fdfbff]">
                      <td className="px-[7px] py-[13px]"><div className="flex items-center gap-2.5"><OrganizationLogo organization={organization} /><div className="min-w-0"><strong className="block max-w-[260px] truncate text-[13px]">{organization.name}</strong><small className="mt-0.5 block max-w-[260px] truncate text-[11px] text-[#82788b]">{organization.id}</small></div></div></td>
                      <td className="px-[7px] py-[13px]">{organization.contactEmail}<small className="mt-0.5 block text-[11px] text-[#82788b]">{organization.contactPhone || '—'}</small></td>
                      <td className="px-[7px] py-[13px]"><StatusPill status={organization.status} /></td>
                      <td className="px-[7px] py-[13px] font-bold">{adminCounts.get(organization.id) ?? 0} คน</td>
                      <td className="px-[7px] py-[13px]"><div className="flex items-center gap-2"><StatusSelect organization={organization} disabled={savingId === organization.id} onChange={updateStatus} /><button type="button" onClick={() => setEditingOrganization(organization)} className="inline-flex min-h-8 items-center gap-1 rounded-[7px] border border-[#dac8f3] bg-white px-2 text-[11px] font-bold text-[#6d28d9] hover:bg-[#f8f3ff]" aria-label={`แก้ PromptPay ของ ${organization.name}`}><PencilLine className="h-3.5 w-3.5" />แก้ PromptPay</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && !error && filtered.length > PAGE_SIZE ? (
          <div className="flex flex-col gap-3 border-t border-[#ebe4ef] px-[17px] py-[13px] text-xs text-[#82788b] sm:flex-row sm:items-center sm:justify-between">
            <span>แสดง {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} จาก {filtered.length} รายการ</span>
            <div className="flex gap-1.5">
              <PageButton label="หน้าก่อนหน้า" disabled={safePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft className="h-4 w-4" /></PageButton>
              <span className="grid min-h-8 min-w-8 place-items-center rounded-[7px] border border-[#d7c3f5] bg-[#f2eaff] px-2 font-extrabold text-[#6d28d9]">{safePage}/{totalPages}</span>
              <PageButton label="หน้าถัดไป" disabled={safePage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}><ChevronRight className="h-4 w-4" /></PageButton>
            </div>
          </div>
        ) : null}
      </section>

      {createOpen ? <CreateOrganizationDialog onClose={() => setCreateOpen(false)} onCreate={createOrganization} /> : null}
      {editingOrganization ? <EditPromptPayDialog organization={editingOrganization} onClose={() => setEditingOrganization(null)} onSave={updatePromptPay} /> : null}
      {toast ? <div role="status" className="fixed bottom-6 right-6 z-[70] max-w-[calc(100vw-3rem)] rounded-[10px] bg-[#1f1730] px-4 py-3 text-xs font-bold text-white shadow-[0_14px_35px_rgba(28,14,47,.25)]">{toast}</div> : null}
    </div>
  );
}

const DETAIL_COLORS = { green: 'text-[#13996a]', orange: 'text-[#d97812]', red: 'text-[#d14343]' };
function SummaryCard({ label, value, detail, tone, loading }: { label: string; value: number; detail: string; tone: keyof typeof DETAIL_COLORS; loading: boolean }) { return <article className="relative overflow-hidden rounded-[14px] border border-[#e7def4] bg-[linear-gradient(145deg,#fff,#fbf8ff)] px-[17px] py-[15px] shadow-[0_10px_26px_rgba(74,48,112,.05)] after:absolute after:-right-[18px] after:-top-6 after:h-[70px] after:w-[70px] after:rounded-full after:bg-[rgba(124,58,237,.07)]"><span className="text-[13px] text-[#82788b]">{label}</span>{loading ? <div className="mt-1 h-7 w-14 animate-pulse rounded bg-[#eee8f4]" /> : <strong className="mt-1 block text-[22px] text-[#242032]">{value.toLocaleString('th-TH')}</strong>}<small className={`text-xs font-bold ${DETAIL_COLORS[tone]}`}>{detail}</small></article>; }

function OrganizationLogo({ organization }: { organization: SuperAdminOrganization }) { return <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-[9px] bg-[#f1eaff] text-xs font-extrabold text-[#6d28d9]">{organization.name.trim().charAt(0).toUpperCase() || 'O'}</span>; }
function StatusPill({ status }: { status: SuperAdminOrganizationStatus }) { const styles = { ACTIVE: 'bg-[#ecfdf3] text-[#166534]', INACTIVE: 'bg-[#fff7ed] text-[#92400e]', SUSPENDED: 'bg-[#fff1f2] text-[#b91c1c]' }; return <span className={`inline-block rounded-md px-2 py-1 text-[11px] font-extrabold ${styles[status]}`}>{status}</span>; }

function StatusSelect({ organization, disabled, onChange }: { organization: SuperAdminOrganization; disabled: boolean; onChange: (organization: SuperAdminOrganization, status: SuperAdminOrganizationStatus) => Promise<void> }) { return <select value={organization.status} disabled={disabled} onChange={(event) => { const select = event.currentTarget; void onChange(organization, event.target.value as SuperAdminOrganizationStatus).finally(() => { select.value = organization.status; }); }} className="min-h-8 rounded-[7px] border border-[#dac8f3] bg-[#f8f3ff] px-2 text-[11px] font-bold text-[#6d28d9] disabled:opacity-50" aria-label={`เปลี่ยนสถานะ ${organization.name}`}>{STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}</select>; }

function CreateOrganizationDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (input: CreateSuperAdminOrganizationInput) => Promise<void> }) {
  const [form, setForm] = useState({ name: '', contactEmail: '', contactPhone: '', promptpayId: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(''); try { await onCreate({ name: form.name.trim(), contactEmail: form.contactEmail.trim(), contactPhone: form.contactPhone.trim() || undefined, promptpayId: form.promptpayId.trim() || undefined }); } catch (cause) { setError(errorMessage(cause, 'สร้างองค์กรไม่สำเร็จ')); setSaving(false); } }
  return <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-[rgba(25,17,38,.48)] p-[18px] backdrop-blur-[3px]"><button type="button" onClick={onClose} className="absolute inset-0" aria-label="ปิดหน้าต่างสร้างองค์กร" /><section role="dialog" aria-modal="true" aria-labelledby="create-org-title" className="relative w-full max-w-[520px] overflow-hidden rounded-[18px] border border-[#e3d8f0] bg-white shadow-[0_28px_80px_rgba(28,14,47,.28)]"><header className="flex items-start justify-between border-b border-[#eee8f4] bg-[linear-gradient(135deg,#fff,#faf5ff)] px-[22px] pb-3.5 pt-5"><div><span className="text-[11px] font-extrabold tracking-[1px] text-[#7c3aed]">POST /organizations</span><h2 id="create-org-title" className="mb-0 mt-1 text-xl font-black">สร้างองค์กร</h2></div><button type="button" onClick={onClose} className="grid h-[34px] w-[34px] place-items-center rounded-[9px] border border-[#e7dfea] bg-white text-[#746a7d]" aria-label="ปิด"><X className="h-4 w-4" /></button></header><form onSubmit={submit} className="grid gap-3.5 px-[22px] pb-[22px] pt-[19px]"><Field label="ชื่อองค์กร" required value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} /><Field label="Contact email" type="email" required value={form.contactEmail} onChange={(value) => setForm((current) => ({ ...current, contactEmail: value }))} /><Field label="Contact phone" type="tel" value={form.contactPhone} onChange={(value) => setForm((current) => ({ ...current, contactPhone: value }))} /><Field label="PromptPay ID" inputMode="numeric" pattern="\d{10}|\d{13}|\d{15}" value={form.promptpayId} onChange={(value) => setForm((current) => ({ ...current, promptpayId: value.replace(/\D/g, '') }))} /><p className="m-0 rounded-lg bg-[#fff8e8] px-[11px] py-[9px] text-[11px] text-[#80632a]">สถานะเริ่มต้นคือ ACTIVE · PromptPay ไม่บังคับ</p>{error ? <p className="m-0 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</p> : null}<div className="mt-0.5 flex justify-end gap-2"><button type="button" onClick={onClose} disabled={saving} className="min-h-[38px] rounded-lg border border-[#e7dfea] bg-white px-[13px] text-[13px] font-bold text-[#716675]">ยกเลิก</button><button type="submit" disabled={saving} className="min-h-[38px] rounded-lg bg-[linear-gradient(135deg,#9656f0,#6d28d9)] px-[13px] text-[13px] font-bold text-white disabled:opacity-55">{saving ? 'กำลังสร้าง…' : 'ยืนยันและสร้าง'}</button></div></form></section></div>;
}

function EditPromptPayDialog({ organization, onClose, onSave }: { organization: SuperAdminOrganization; onClose: () => void; onSave: (organization: SuperAdminOrganization, promptpayId: string) => Promise<void> }) {
  const [promptpayId, setPromptpayId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(''); try { await onSave(organization, promptpayId); } catch (cause) { setError(errorMessage(cause, 'บันทึกหมายเลข PromptPay ไม่สำเร็จ')); setSaving(false); } }
  return <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-[rgba(25,17,38,.48)] p-[18px] backdrop-blur-[3px]"><button type="button" onClick={onClose} className="absolute inset-0" aria-label="ปิดหน้าต่างแก้ PromptPay" /><section role="dialog" aria-modal="true" aria-labelledby="edit-promptpay-title" className="relative w-full max-w-[520px] overflow-hidden rounded-[18px] border border-[#e3d8f0] bg-white shadow-[0_28px_80px_rgba(28,14,47,.28)]"><header className="flex items-start justify-between border-b border-[#eee8f4] bg-[linear-gradient(135deg,#fff,#faf5ff)] px-[22px] pb-3.5 pt-5"><div><span className="text-[11px] font-extrabold tracking-[1px] text-[#7c3aed]">PATCH /organizations/:id</span><h2 id="edit-promptpay-title" className="mb-0 mt-1 text-xl font-black">แก้ PromptPay</h2><p className="mb-0 mt-1 text-xs text-[#82788b]">{organization.name}</p></div><button type="button" onClick={onClose} className="grid h-[34px] w-[34px] place-items-center rounded-[9px] border border-[#e7dfea] bg-white text-[#746a7d]" aria-label="ปิด"><X className="h-4 w-4" /></button></header><form onSubmit={submit} className="grid gap-3.5 px-[22px] pb-[22px] pt-[19px]"><Field label="PromptPay ID ใหม่" required inputMode="numeric" pattern="\d{10}|\d{13}|\d{15}" value={promptpayId} onChange={(value) => setPromptpayId(value.replace(/\D/g, ''))} /><p className="m-0 rounded-lg bg-[#fff8e8] px-[11px] py-[9px] text-[11px] text-[#80632a]">กรอกเบอร์โทรศัพท์ 10 หลัก เลขบัตรประชาชน 13 หลัก หรือเลข e-Wallet 15 หลัก · ระบบไม่แสดงค่าเดิมเพื่อปกป้องข้อมูลการรับเงิน</p>{error ? <p className="m-0 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</p> : null}<div className="mt-0.5 flex justify-end gap-2"><button type="button" onClick={onClose} disabled={saving} className="min-h-[38px] rounded-lg border border-[#e7dfea] bg-white px-[13px] text-[13px] font-bold text-[#716675] disabled:opacity-55">ยกเลิก</button><button type="submit" disabled={saving} className="min-h-[38px] rounded-lg bg-[linear-gradient(135deg,#9656f0,#6d28d9)] px-[13px] text-[13px] font-bold text-white disabled:opacity-55">{saving ? 'กำลังบันทึก…' : 'บันทึก PromptPay'}</button></div></form></section></div>;
}

function Field({ label, value, onChange, type = 'text', required = false, inputMode, pattern }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; inputMode?: 'numeric'; pattern?: string }) { return <label className="grid gap-1.5 text-xs font-bold text-[#4d4356]">{label}{required ? <span className="sr-only">จำเป็น</span> : null}<input type={type} required={required} inputMode={inputMode} pattern={pattern} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-[9px] border border-[#ded5e7] bg-white px-[11px] py-2.5 font-medium text-[#28202f] outline-none focus:border-[#9b6be1] focus:ring-4 focus:ring-[#f0e7ff]" /></label>; }
function PageButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) { return <button type="button" onClick={onClick} disabled={disabled} aria-label={label} className="grid min-h-8 min-w-8 place-items-center rounded-[7px] border border-[#e7dfea] bg-white text-[#655d70] disabled:opacity-45">{children}</button>; }
function StatePanel({ title, detail, action }: { title: string; detail: string; action?: () => void }) { return <div className="grid min-h-[190px] place-items-center p-7 text-center"><div><span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#f1eaff] text-[#6d28d9]"><Building2 className="h-5 w-5" /></span><strong className="mt-3 block text-sm text-[#242032]">{title}</strong><span className="mt-1 block text-xs text-[#82788b]">{detail}</span>{action ? <button type="button" onClick={action} className="mt-3 text-xs font-extrabold text-[#6d28d9] underline">ลองอีกครั้ง</button> : null}</div></div>; }
function TableSkeleton() { return <div className="grid gap-3 p-5">{[1, 2, 3, 4].map((item) => <div key={item} className="h-12 animate-pulse rounded-lg bg-[#f2edf8]" />)}</div>; }
async function getAccessToken() { const supabase = getSupabaseBrowserClient(); const { data } = await supabase.auth.getSession(); const token = data.session?.access_token; if (!token) throw new Error('ไม่พบเซสชันผู้ดูแลระบบ กรุณาเข้าสู่ระบบใหม่'); return token; }
function errorMessage(cause: unknown, fallback: string) { return cause instanceof ApiError || cause instanceof Error ? cause.message || fallback : fallback; }
