'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ShieldCheck, Trash2, UserPlus, UsersRound } from 'lucide-react';
import { useAdminPageAccess } from '@/components/admin-ui';
import {
  addOrganizationAdmin,
  getOrganizationTeam,
  removeOrganizationAdmin,
  updateOrganizationAdminPermissions,
  type OrganizationTeamMember,
} from '@/lib/api';

export function AdminTeamManagement() {
  const { access, token, organizationId, organization } = useAdminPageAccess();
  const [members, setMembers] = useState<OrganizationTeamMember[]>([]);
  const [email, setEmail] = useState('');
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const isOwner = organization?.membershipRole === 'OWNER';

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!token || !organizationId) return;
    setMembers(await getOrganizationTeam(organizationId, token, signal));
  }, [organizationId, token]);

  useEffect(() => {
    if (access !== 'allowed' || !token || !organizationId) return;
    const controller = new AbortController();
    setError('');
    void refresh(controller.signal).catch((cause: unknown) => {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setError(cause instanceof Error ? cause.message : 'โหลดรายชื่อทีมไม่สำเร็จ');
    });
    return () => controller.abort();
  }, [access, organizationId, refresh, token]);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;
    setBusyId('add');
    setError('');
    try {
      await addOrganizationAdmin(organizationId, email.trim(), token);
      setEmail('');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'เพิ่มผู้ดูแลไม่สำเร็จ');
    } finally {
      setBusyId('');
    }
  }

  async function updatePermission(
    member: OrganizationTeamMember,
    key: 'canManagePayments' | 'canManageZones',
  ) {
    setBusyId(member.id);
    setError('');
    try {
      const updated = await updateOrganizationAdminPermissions(
        organizationId,
        member.id,
        {
          canManagePayments:
            key === 'canManagePayments'
              ? !member.canManagePayments
              : member.canManagePayments,
          canManageZones:
            key === 'canManageZones' ? !member.canManageZones : member.canManageZones,
        },
        token,
      );
      setMembers((current) =>
        current.map((item) => (item.id === member.id ? { ...item, ...updated } : item)),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'เปลี่ยนสิทธิ์ไม่สำเร็จ');
    } finally {
      setBusyId('');
    }
  }

  async function removeAdmin(member: OrganizationTeamMember) {
    if (!window.confirm(`ถอด ${member.user.fullName} ออกจากทีมผู้ดูแลหรือไม่`)) return;
    setBusyId(member.id);
    setError('');
    try {
      await removeOrganizationAdmin(organizationId, member.user.id, token);
      setMembers((current) => current.filter((item) => item.id !== member.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ถอดผู้ดูแลไม่สำเร็จ');
    } finally {
      setBusyId('');
    }
  }

  if (access !== 'allowed') return null;

  return (
    <section className="mt-6 rounded-[24px] border border-[#e8e1ee] bg-white p-6 shadow-[0_12px_34px_rgba(54,36,91,0.045)] sm:p-8">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-tint text-violet">
          <UsersRound className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-xl font-black">ทีมผู้ดูแลองค์กร</h2>
          <p className="mt-1 text-sm text-muted">
            OWNER จัดการสมาชิกและมอบสิทธิ์ดูแลการเงินหรือโซนภายในองค์กรนี้
          </p>
        </div>
      </div>

      {isOwner ? (
        <form className="mt-6 flex flex-col gap-3 sm:flex-row" onSubmit={handleAdd}>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="อีเมลพนักงาน"
            className="min-h-11 flex-1 rounded-xl border border-line px-4 outline-none focus:border-violet"
          />
          <button
            type="submit"
            disabled={busyId === 'add'}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet px-5 font-extrabold text-white disabled:opacity-60"
          >
            <UserPlus className="h-4 w-4" aria-hidden />
            เพิ่ม ADMIN
          </button>
        </form>
      ) : (
        <p className="mt-6 rounded-xl bg-[#f8f5fb] px-4 py-3 text-sm text-muted">
          คุณดูรายชื่อและสิทธิ์ของทีมได้ แต่มีเพียง OWNER ที่แก้ไขได้
        </p>
      )}

      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700" aria-live="polite">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-3">
        {members.map((member) => {
          const owner = member.role === 'OWNER';
          const disabled = !isOwner || owner || busyId === member.id;
          return (
            <article key={member.id} className="rounded-2xl border border-line p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
              <div>
                <p className="font-black text-ink">{member.user.fullName}</p>
                <p className="mt-1 text-xs text-muted">{member.user.email}</p>
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-violet-tint px-2.5 py-1 text-[11px] font-black text-violet">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                  {owner ? 'OWNER' : 'ADMIN'}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 sm:mt-0">
                {!owner ? (
                  <>
                    <PermissionToggle label="ดูแลการเงิน" checked={member.canManagePayments} disabled={disabled} onChange={() => void updatePermission(member, 'canManagePayments')} />
                    <PermissionToggle label="ดูแลโซน" checked={member.canManageZones} disabled={disabled} onChange={() => void updatePermission(member, 'canManageZones')} />
                    {isOwner ? (
                      <button type="button" disabled={disabled} onClick={() => void removeAdmin(member)} className="grid h-10 w-10 place-items-center rounded-xl border border-red-200 text-red-600 disabled:opacity-50" aria-label={`ถอด ${member.user.fullName}`}>
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PermissionToggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-2 text-sm font-bold text-[#5f5668]">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} className="h-4 w-4 accent-violet" />
      {label}
    </label>
  );
}
