'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Mail,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UsersRound,
  X,
} from 'lucide-react';
import {
  ApiError,
  createSuperAdminOrganization,
  getSuperAdminCompanyAdmins,
  getSuperAdminOrganizations,
  updateSuperAdminOrganizationStatus,
  type CreateSuperAdminOrganizationInput,
  type SuperAdminCompanyAdmin,
  type SuperAdminOrganization,
  type SuperAdminOrganizationStatus,
} from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabase';

const PAGE_SIZE = 25;
const STATUS_LABELS: Record<SuperAdminOrganizationStatus, string> = {
  ACTIVE: 'ใช้งาน',
  INACTIVE: 'ปิดใช้งาน',
  SUSPENDED: 'ระงับชั่วคราว',
};
const STATUS_STYLES: Record<SuperAdminOrganizationStatus, string> = {
  ACTIVE: 'border-green-200 bg-green-50 text-green-700',
  INACTIVE: 'border-slate-200 bg-slate-50 text-slate-600',
  SUSPENDED: 'border-amber-200 bg-amber-50 text-amber-800',
};

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
    const timer = window.setTimeout(() => setToast(''), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const adminCountByOrganization = useMemo(() => {
    const counts = new Map<string, number>();
    admins.forEach((admin) => {
      counts.set(
        admin.organization.id,
        (counts.get(admin.organization.id) ?? 0) + 1,
      );
    });
    return counts;
  }, [admins]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('th-TH');
    return organizations.filter((organization) => {
      const matchesStatus = status === 'ALL' || organization.status === status;
      const matchesQuery =
        !normalizedQuery ||
        organization.name.toLocaleLowerCase('th-TH').includes(normalizedQuery) ||
        organization.contactEmail.toLocaleLowerCase('th-TH').includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });
  }, [organizations, query, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleOrganizations = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  async function handleCreate(input: CreateSuperAdminOrganizationInput) {
    const token = await getAccessToken();
    await createSuperAdminOrganization(input, token);
    setCreateOpen(false);
    setToast('สร้างองค์กรเรียบร้อยแล้ว');
    setReloadKey((value) => value + 1);
  }

  async function handleStatusChange(
    organization: SuperAdminOrganization,
    nextStatus: SuperAdminOrganizationStatus,
  ) {
    if (nextStatus === organization.status) return;
    const confirmed = window.confirm(
      `ยืนยันเปลี่ยนสถานะ “${organization.name}” เป็น “${STATUS_LABELS[nextStatus]}” หรือไม่?`,
    );
    if (!confirmed) return;

    setSavingId(organization.id);
    try {
      const token = await getAccessToken();
      await updateSuperAdminOrganizationStatus(organization.id, nextStatus, token);
      setToast(`เปลี่ยนสถานะ ${organization.name} เรียบร้อยแล้ว`);
      setReloadKey((value) => value + 1);
    } catch (cause) {
      setToast(errorMessage(cause, 'เปลี่ยนสถานะองค์กรไม่สำเร็จ'));
    } finally {
      setSavingId('');
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-violet">Organization management</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink sm:text-4xl">องค์กรทั้งหมด</h1>
          <p className="mt-2 text-sm text-muted">ค้นหา สร้าง และควบคุมสถานะองค์กรบน SpaceLink</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet px-5 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(124,58,237,0.22)] transition hover:bg-violet-700"
        >
          <Plus className="h-4 w-4" />
          สร้างองค์กร
        </button>
      </div>

      <section className="mt-7 overflow-hidden rounded-[22px] border border-[#e9e4ef] bg-white shadow-[0_12px_32px_rgba(53,39,76,0.055)]">
        <div className="flex flex-col gap-3 border-b border-[#eeeaf3] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <label className="relative min-w-0 flex-1 sm:max-w-md">
            <span className="sr-only">ค้นหาองค์กร</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#9a93a4]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหาชื่อองค์กรหรืออีเมล"
              className="h-11 w-full rounded-xl border border-[#e3deea] bg-[#fcfbfd] pl-10 pr-4 text-sm outline-none transition focus:border-violet focus:ring-4 focus:ring-violet/10"
            />
          </label>
          <div className="flex gap-2">
            <label className="relative flex-1 sm:flex-none">
              <span className="sr-only">กรองตามสถานะ</span>
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8f8799]" />
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as typeof status)}
                className="h-11 w-full rounded-xl border border-[#e3deea] bg-white pl-9 pr-8 text-sm font-bold text-[#655d70] outline-none focus:border-violet sm:w-auto"
              >
                <option value="ALL">ทุกสถานะ</option>
                <option value="ACTIVE">ใช้งาน</option>
                <option value="INACTIVE">ปิดใช้งาน</option>
                <option value="SUSPENDED">ระงับชั่วคราว</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
              disabled={loading}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#e3deea] text-muted hover:text-violet disabled:opacity-60"
              aria-label="โหลดข้อมูลใหม่"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {error ? (
          <div className="px-5 py-16 text-center">
            <p className="font-bold text-danger">{error}</p>
            <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="mt-3 text-sm font-extrabold text-violet underline">
              ลองอีกครั้ง
            </button>
          </div>
        ) : loading ? (
          <OrganizationTableSkeleton />
        ) : visibleOrganizations.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-tint text-violet">
              <Building2 className="h-7 w-7" />
            </span>
            <p className="mt-4 font-black text-ink">{organizations.length === 0 ? 'ยังไม่มีองค์กรในระบบ' : 'ไม่พบองค์กรที่ตรงกับตัวกรอง'}</p>
            <p className="mt-1 text-sm text-muted">{organizations.length === 0 ? 'เริ่มต้นด้วยการสร้างองค์กรแรก' : 'ลองเปลี่ยนคำค้นหาหรือสถานะ'}</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[820px] border-collapse text-left">
                <thead className="bg-[#faf8fc] text-xs font-extrabold uppercase tracking-[0.08em] text-[#8c8496]">
                  <tr>
                    <th className="px-5 py-3.5">องค์กร</th>
                    <th className="px-5 py-3.5">ผู้ติดต่อ</th>
                    <th className="px-5 py-3.5 text-center">Admin</th>
                    <th className="px-5 py-3.5">สถานะ</th>
                    <th className="px-5 py-3.5">เปลี่ยนสถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0edf4]">
                  {visibleOrganizations.map((organization) => (
                    <tr key={organization.id} className="transition hover:bg-[#fdfcff]">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <OrganizationAvatar organization={organization} />
                          <div className="min-w-0">
                            <p className="max-w-[260px] truncate font-extrabold text-ink">{organization.name}</p>
                            <p className="max-w-[260px] truncate text-xs text-muted">{organization.description || 'ยังไม่มีคำอธิบาย'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-[#655d70]">{organization.contactEmail}</td>
                      <td className="px-5 py-4 text-center font-black text-ink">{adminCountByOrganization.get(organization.id) ?? 0}</td>
                      <td className="px-5 py-4"><StatusBadge status={organization.status} /></td>
                      <td className="px-5 py-4">
                        <StatusSelect organization={organization} disabled={savingId === organization.id} onChange={handleStatusChange} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-[#f0edf4] md:hidden">
              {visibleOrganizations.map((organization) => (
                <article key={organization.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <OrganizationAvatar organization={organization} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-extrabold text-ink">{organization.name}</p>
                      <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted"><Mail className="h-3.5 w-3.5" />{organization.contactEmail}</p>
                    </div>
                    <StatusBadge status={organization.status} />
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-muted"><UsersRound className="h-4 w-4" />Admin {adminCountByOrganization.get(organization.id) ?? 0} คน</span>
                    <StatusSelect organization={organization} disabled={savingId === organization.id} onChange={handleStatusChange} />
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-[#eeeaf3] px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-muted">แสดง {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} จาก {filtered.length} องค์กร</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={safePage === 1} className="grid h-9 w-9 place-items-center rounded-xl border border-[#e3deea] text-muted disabled:opacity-40" aria-label="หน้าก่อนหน้า"><ChevronLeft className="h-4 w-4" /></button>
              <span className="min-w-20 text-center font-bold text-ink">หน้า {safePage} / {totalPages}</span>
              <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={safePage === totalPages} className="grid h-9 w-9 place-items-center rounded-xl border border-[#e3deea] text-muted disabled:opacity-40" aria-label="หน้าถัดไป"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </section>

      {createOpen && <CreateOrganizationDialog onClose={() => setCreateOpen(false)} onCreate={handleCreate} />}

      {toast && (
        <div role="status" className="fixed bottom-5 right-5 z-[70] max-w-[calc(100vw-2.5rem)] rounded-2xl bg-[#241c31] px-4 py-3 text-sm font-bold text-white shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}

function OrganizationAvatar({ organization }: { organization: SuperAdminOrganization }) {
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-violet-tint font-black text-violet">
      {organization.logoUrl ? (
        // Organization URLs are returned by the API and are not guaranteed to be on a configured image host.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={organization.logoUrl} alt="" className="h-full w-full object-cover" />
      ) : organization.name.trim().charAt(0).toUpperCase() || 'O'}
    </span>
  );
}

function StatusBadge({ status }: { status: SuperAdminOrganizationStatus }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>;
}

function StatusSelect({ organization, disabled, onChange }: {
  organization: SuperAdminOrganization;
  disabled: boolean;
  onChange: (
    organization: SuperAdminOrganization,
    status: SuperAdminOrganizationStatus,
  ) => Promise<void>;
}) {
  return (
    <select
      value={organization.status}
      disabled={disabled}
      onChange={(event) => {
        const select = event.currentTarget;
        const nextStatus = event.target.value as SuperAdminOrganizationStatus;
        void onChange(organization, nextStatus).finally(() => {
          select.value = organization.status;
        });
      }}
      className="h-9 rounded-xl border border-[#e3deea] bg-white px-2.5 text-xs font-bold text-[#655d70] outline-none focus:border-violet disabled:opacity-50"
      aria-label={`เปลี่ยนสถานะ ${organization.name}`}
    >
      <option value="ACTIVE">ใช้งาน</option>
      <option value="INACTIVE">ปิดใช้งาน</option>
      <option value="SUSPENDED">ระงับชั่วคราว</option>
    </select>
  );
}

function CreateOrganizationDialog({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (input: CreateSuperAdminOrganizationInput) => Promise<void>;
}) {
  const [form, setForm] = useState({ name: '', contactEmail: '', contactPhone: '', promptpayId: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onCreate({
        name: form.name.trim(),
        contactEmail: form.contactEmail.trim(),
        contactPhone: form.contactPhone.trim() || undefined,
        promptpayId: form.promptpayId.trim() || undefined,
      });
    } catch (cause) {
      setError(errorMessage(cause, 'สร้างองค์กรไม่สำเร็จ'));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-[#211a30]/45 p-4 backdrop-blur-sm">
      <button type="button" onClick={onClose} className="absolute inset-0" aria-label="ปิดหน้าต่างสร้างองค์กร" />
      <section role="dialog" aria-modal="true" aria-labelledby="create-organization-title" className="relative w-full max-w-lg rounded-[24px] bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-violet">New organization</p>
            <h2 id="create-organization-title" className="mt-1 text-2xl font-black text-ink">สร้างองค์กร</h2>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-[#f5f2f8]" aria-label="ปิด"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={submit} className="mt-6 grid gap-4">
          <Field label="ชื่อองค์กร" required value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} />
          <Field label="อีเมลติดต่อ" required type="email" value={form.contactEmail} onChange={(value) => setForm((current) => ({ ...current, contactEmail: value }))} />
          <Field label="เบอร์โทรติดต่อ (ไม่บังคับ)" type="tel" value={form.contactPhone} onChange={(value) => setForm((current) => ({ ...current, contactPhone: value }))} />
          <Field label="PromptPay 10, 13 หรือ 15 หลัก (ไม่บังคับ)" inputMode="numeric" pattern="\d{10}|\d{13}|\d{15}" value={form.promptpayId} onChange={(value) => setForm((current) => ({ ...current, promptpayId: value.replace(/\D/g, '') }))} />

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-danger">{error}</p>}

          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={saving} className="min-h-11 rounded-xl border border-[#e3deea] px-5 text-sm font-bold text-muted">ยกเลิก</button>
            <button type="submit" disabled={saving} className="min-h-11 rounded-xl bg-violet px-5 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(124,58,237,0.2)] disabled:opacity-60">{saving ? 'กำลังสร้าง…' : 'สร้างองค์กร'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required = false, inputMode, pattern }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  inputMode?: 'numeric';
  pattern?: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-bold text-[#504858]">
      {label}
      <input type={type} required={required} inputMode={inputMode} pattern={pattern} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-xl border border-[#ded8e7] px-3.5 font-normal outline-none transition focus:border-violet focus:ring-4 focus:ring-violet/10" />
    </label>
  );
}

function OrganizationTableSkeleton() {
  return <div className="grid gap-3 p-5">{[1, 2, 3, 4, 5].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-[#f2eff5]" />)}</div>;
}

async function getAccessToken() {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('ไม่พบเซสชันผู้ดูแลระบบ กรุณาเข้าสู่ระบบใหม่');
  return token;
}

function errorMessage(cause: unknown, fallback: string) {
  if (cause instanceof ApiError || cause instanceof Error) return cause.message || fallback;
  return fallback;
}
