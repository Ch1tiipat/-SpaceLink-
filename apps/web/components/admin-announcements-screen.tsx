'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  Loader2,
  Megaphone,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { useAdminOrganizationSelection } from '@/components/app-shell';
import {
  ApiError,
  createAdminAnnouncement,
  deleteAdminAnnouncement,
  getAdminAnnouncements,
  getMe,
  updateAdminAnnouncement,
  type AdminAnnouncement,
  type SaveAnnouncementInput,
} from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabase';

type AccessState = 'loading' | 'allowed' | 'denied';
type EditorMode = 'create' | 'edit';

type AnnouncementDraft = {
  title: string;
  body: string;
  isActive: boolean;
  publishedAt: string;
};

const EMPTY_ANNOUNCEMENT: AnnouncementDraft = {
  title: '',
  body: '',
  isActive: true,
  publishedAt: '',
};

const dateTimeFormatter = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function AdminAnnouncementsScreen() {
  const router = useRouter();
  const { selectedOrganizationId } = useAdminOrganizationSelection();
  const [access, setAccess] = useState<AccessState>('loading');
  const [token, setToken] = useState('');
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<EditorMode>('create');
  const [editingId, setEditingId] = useState('');
  const [draft, setDraft] = useState<AnnouncementDraft>(EMPTY_ANNOUNCEMENT);
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
    if (access !== 'allowed' || !token || !selectedOrganizationId) {
      setAnnouncements([]);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setSuccess(null);
    setMode('create');
    setEditingId('');
    setDraft(EMPTY_ANNOUNCEMENT);

    void getAdminAnnouncements(
      selectedOrganizationId,
      token,
      controller.signal,
    )
      .then(setAnnouncements)
      .catch((cause) => {
        if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
          setError(describeError(cause, 'ไม่สามารถโหลดประกาศได้'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [access, selectedOrganizationId, token]);

  function startCreate() {
    setMode('create');
    setEditingId('');
    setDraft(EMPTY_ANNOUNCEMENT);
    clearFeedback();
  }

  function startEdit(announcement: AdminAnnouncement) {
    setMode('edit');
    setEditingId(announcement.id);
    setDraft({
      title: announcement.title,
      body: announcement.body,
      isActive: announcement.isActive,
      publishedAt: toDateTimeLocal(announcement.publishedAt),
    });
    clearFeedback();
  }

  async function refreshAnnouncements() {
    setAnnouncements(
      await getAdminAnnouncements(selectedOrganizationId, token),
    );
  }

  async function submitAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.title.trim() || !draft.body.trim()) {
      setError('กรุณากรอกหัวข้อและรายละเอียดประกาศ');
      return;
    }

    const payload: SaveAnnouncementInput = {
      title: draft.title.trim(),
      body: draft.body.trim(),
      isActive: draft.isActive,
      ...(draft.publishedAt
        ? { publishedAt: new Date(draft.publishedAt).toISOString() }
        : {}),
    };

    setSaving(true);
    clearFeedback();
    try {
      if (mode === 'edit') {
        await updateAdminAnnouncement(
          selectedOrganizationId,
          editingId,
          payload,
          token,
        );
      } else {
        await createAdminAnnouncement(selectedOrganizationId, payload, token);
      }
      await refreshAnnouncements();
      const savedMode = mode;
      startCreate();
      setSuccess(
        savedMode === 'edit' ? 'แก้ไขประกาศเรียบร้อย' : 'สร้างประกาศเรียบร้อย',
      );
    } catch (cause) {
      setError(describeError(cause, 'ไม่สามารถบันทึกประกาศได้'));
    } finally {
      setSaving(false);
    }
  }

  async function removeAnnouncement(announcement: AdminAnnouncement) {
    if (!window.confirm('ยืนยันลบประกาศ “' + announcement.title + '”?')) return;

    setSaving(true);
    clearFeedback();
    try {
      await deleteAdminAnnouncement(
        selectedOrganizationId,
        announcement.id,
        token,
      );
      await refreshAnnouncements();
      startCreate();
      setSuccess('ลบประกาศเรียบร้อยแล้ว');
    } catch (cause) {
      setError(describeError(cause, 'ไม่สามารถลบประกาศได้'));
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

  if (!selectedOrganizationId) return <PageState label="ไม่พบองค์กรที่คุณดูแล" />;

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[#f8f7fb] px-4 py-8 sm:px-7 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header>
          <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-violet">
            <Megaphone className="h-4 w-4" aria-hidden /> Organization Admin
          </span>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink sm:text-4xl">
            จัดการประกาศ
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            สร้างและดูแลข่าวสารที่ผู้ขายจะเห็นบนหน้ารายละเอียด Event ขององค์กร
          </p>
        </header>

        {error && <Feedback tone="error">{error}</Feedback>}
        {success && <Feedback tone="success">{success}</Feedback>}

        <div className="mt-6">
          <AdminPanel
            title="ประกาศขององค์กร"
            count={announcements.length}
            actionLabel="สร้างประกาศ"
            onAction={startCreate}
          >
            <EntityList loading={loading} emptyLabel="ยังไม่มีประกาศขององค์กรนี้">
              {announcements.map((announcement) => (
                <article
                  key={announcement.id}
                  className="rounded-2xl border border-line bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-black text-ink">{announcement.title}</h3>
                      <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm leading-6 text-muted">
                        {announcement.body}
                      </p>
                    </div>
                    <StatusBadge active={announcement.isActive} />
                  </div>
                  <p className="mt-3 text-xs text-muted">
                    {announcement.publishedAt
                      ? 'เผยแพร่ ' + dateTimeFormatter.format(new Date(announcement.publishedAt))
                      : 'ยังไม่ระบุเวลาเผยแพร่'}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <MiniButton label="แก้ไข" icon={Edit3} onClick={() => startEdit(announcement)} />
                    <MiniButton
                      label="ลบ"
                      icon={Trash2}
                      danger
                      onClick={() => void removeAnnouncement(announcement)}
                    />
                  </div>
                </article>
              ))}
            </EntityList>

            <AnnouncementEditor
              mode={mode}
              draft={draft}
              saving={saving}
              onChange={setDraft}
              onSubmit={submitAnnouncement}
              onCancel={startCreate}
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
        <button
          type="button"
          onClick={onAction}
          className="flex items-center gap-2 rounded-xl bg-violet px-4 py-2.5 text-xs font-extrabold text-white"
        >
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
    <div className="mt-5 grid max-h-[430px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
      {loading ? (
        <p className="col-span-full flex items-center justify-center gap-2 rounded-2xl bg-[#faf8fd] p-6 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> กำลังโหลด...
        </p>
      ) : items.length === 0 ? (
        <p className="col-span-full rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
          {emptyLabel}
        </p>
      ) : (
        children
      )}
    </div>
  );
}

function AnnouncementEditor({
  mode,
  draft,
  saving,
  onChange,
  onSubmit,
  onCancel,
}: {
  mode: EditorMode;
  draft: AnnouncementDraft;
  saving: boolean;
  onChange: (draft: AnnouncementDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="mt-6 border-t border-line pt-5">
      <h3 className="font-black text-ink">
        {mode === 'edit' ? 'แก้ไขประกาศ' : 'สร้างประกาศ'}
      </h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-extrabold text-ink sm:col-span-2">
          หัวข้อประกาศ *
          <input
            value={draft.title}
            onChange={(event) => onChange({ ...draft, title: event.target.value })}
            placeholder="เช่น แจ้งเปลี่ยนเวลาเปิดรับผู้ขาย"
            className="mt-1.5 h-10 w-full rounded-xl border border-line px-3 text-sm outline-none focus:border-violet"
          />
        </label>
        <label className="text-xs font-extrabold text-ink sm:col-span-2">
          รายละเอียด *
          <textarea
            value={draft.body}
            onChange={(event) => onChange({ ...draft, body: event.target.value })}
            rows={5}
            placeholder="เขียนรายละเอียดที่ต้องการแจ้งให้ผู้ขายทราบ"
            className="mt-1.5 w-full resize-y rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-violet"
          />
        </label>
        <label className="text-xs font-extrabold text-ink">
          เวลาเผยแพร่
          <input
            type="datetime-local"
            value={draft.publishedAt}
            onChange={(event) =>
              onChange({ ...draft, publishedAt: event.target.value })
            }
            className="mt-1.5 h-10 w-full rounded-xl border border-line px-3 text-sm outline-none focus:border-violet"
          />
        </label>
        <label className="flex min-h-10 items-center gap-3 self-end rounded-xl border border-line px-3 py-2 text-xs font-extrabold text-ink">
          <input
            type="checkbox"
            checked={draft.isActive}
            onChange={(event) =>
              onChange({ ...draft, isActive: event.target.checked })
            }
            className="h-4 w-4 accent-violet"
          />
          แสดงประกาศนี้แก่ผู้ขาย
        </label>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-[#15803d] px-4 py-2.5 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-4 w-4" aria-hidden />
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
        {mode === 'edit' && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-line px-4 py-2.5 text-xs font-extrabold text-ink"
          >
            ยกเลิก
          </button>
        )}
      </div>
    </form>
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
    <button
      type="button"
      onClick={onClick}
      className={
        'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold ' +
        (danger
          ? 'bg-[#fff1f2] text-[#b91c1c]'
          : 'bg-[#f2edfb] text-violet')
      }
    >
      <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
    </button>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={
        'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ' +
        (active
          ? 'bg-[#dcfce7] text-[#166534]'
          : 'bg-[#f1eef4] text-[#655d70]')
      }
    >
      {active ? 'กำลังแสดง' : 'ปิดการแสดง'}
    </span>
  );
}

function Feedback({ tone, children }: { tone: 'error' | 'success'; children: string }) {
  const success = tone === 'success';
  const Icon = success ? CheckCircle2 : AlertCircle;
  return (
    <p
      role={success ? 'status' : 'alert'}
      className={
        'mt-4 flex items-start gap-2 rounded-2xl p-3 text-sm font-semibold ' +
        (success
          ? 'bg-[#ecfdf3] text-[#166534]'
          : 'bg-[#fff1f2] text-[#b91c1c]')
      }
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {children}
    </p>
  );
}

function PageState({ label }: { label: string }) {
  return (
    <main className="grid min-h-[calc(100vh-72px)] place-items-center bg-[#f8f6fb] px-5">
      <p className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-muted shadow-sm">
        {label}
      </p>
    </main>
  );
}

function describeError(cause: unknown, fallback: string): string {
  if (!(cause instanceof ApiError)) return fallback;
  if (cause.status === 404) return 'ไม่พบข้อมูลหรือคุณไม่มีสิทธิ์จัดการรายการนี้';
  return cause.message;
}

function toDateTimeLocal(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 16);
}
