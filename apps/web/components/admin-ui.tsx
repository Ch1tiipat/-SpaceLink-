'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  Building2,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import { useAdminOrganizationSelection } from '@/components/app-shell';
import { getMe, type CurrentUser } from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabase';

export type AdminAccessState =
  | 'loading'
  | 'allowed'
  | 'denied'
  | 'no-organization';

type Organization = CurrentUser['organizations'][number];

export function useAdminPageAccess(): {
  access: AdminAccessState;
  token: string;
  organizationId: string;
  organization: Organization | null;
} {
  const router = useRouter();
  const { selectedOrganizationId } = useAdminOrganizationSelection();
  const [access, setAccess] = useState<AdminAccessState>('loading');
  const [token, setToken] = useState('');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');

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
    if (access !== 'allowed' || organizations.length === 0) return;
    const nextId = organizations.some(
      (organization) => organization.id === selectedOrganizationId,
    )
      ? selectedOrganizationId
      : organizations[0].id;
    setOrganizationId(nextId);
  }, [access, organizations, selectedOrganizationId]);

  return {
    access,
    token,
    organizationId,
    organization:
      organizations.find((item) => item.id === organizationId) ?? null,
  };
}

export function AdminAccessGate({
  access,
  children,
}: {
  access: AdminAccessState;
  children: ReactNode;
}) {
  if (access === 'loading') {
    return <AdminPageState label="กำลังตรวจสอบสิทธิ์ผู้ดูแลองค์กร" />;
  }

  if (access !== 'allowed') {
    return (
      <main className="grid min-h-[calc(100vh-72px)] place-items-center bg-[#f8f7fb] px-5 py-12">
        <section className="max-w-lg rounded-[24px] border border-[#ebe5ef] bg-white p-8 text-center shadow-[0_18px_45px_rgba(54,36,91,0.07)]">
          <AlertCircle className="mx-auto h-11 w-11 text-[#dc2626]" aria-hidden />
          <h1 className="mt-4 text-2xl font-black text-ink">
            {access === 'no-organization'
              ? 'ยังไม่มีองค์กรที่ดูแล'
              : 'ไม่มีสิทธิ์เข้าถึงหน้านี้'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            หน้านี้เปิดให้เฉพาะผู้ดูแลองค์กรและผู้ดูแลระบบเท่านั้น
          </p>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}

export function AdminPage({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-[calc(100vh-72px)] bg-[#f8f7fb] px-4 py-7 sm:px-7 lg:px-9 lg:py-9">
      <div className="mx-auto max-w-[1440px]">{children}</div>
    </main>
  );
}

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  organizationName,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  organizationName?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-violet">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-ink sm:text-[38px]">
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          {description}
        </p>
        {organizationName ? (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#e6ddf2] bg-white px-3 py-1.5 text-xs font-extrabold text-[#655d70]">
            <Building2 className="h-3.5 w-3.5 text-violet" aria-hidden />
            {organizationName}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function AdminPanel({
  title,
  description,
  children,
  actions,
  className = '',
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[20px] border border-[#e8e1ee] bg-white shadow-[0_12px_34px_rgba(54,36,91,0.045)] ${className}`}
    >
      {title || description || actions ? (
        <div className="flex flex-col justify-between gap-3 border-b border-[#eee9f3] px-5 py-4 sm:flex-row sm:items-center">
          <div>
            {title ? <h2 className="text-base font-black text-ink">{title}</h2> : null}
            {description ? (
              <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
            ) : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function AdminMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone = 'violet',
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail?: string;
  tone?: 'violet' | 'green' | 'amber' | 'red' | 'blue';
}) {
  const tones = {
    violet: 'bg-[#f1eaff] text-[#6d28d9]',
    green: 'bg-[#e9f8f0] text-[#16815b]',
    amber: 'bg-[#fff4df] text-[#c56a12]',
    red: 'bg-[#fff0ef] text-[#cf3f3f]',
    blue: 'bg-[#edf4ff] text-[#2563eb]',
  } as const;

  return (
    <article className="rounded-[18px] border border-[#e8e1ee] bg-white p-5 shadow-[0_10px_28px_rgba(54,36,91,0.04)]">
      <span className={`grid h-11 w-11 place-items-center rounded-[14px] ${tones[tone]}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="mt-4 text-xs font-bold text-muted">{label}</p>
      <p className="mt-1 text-[28px] font-black tracking-[-0.04em] text-ink">
        {value}
      </p>
      {detail ? <p className="mt-1 text-[11px] text-muted">{detail}</p> : null}
    </article>
  );
}

export function AdminEmpty({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="grid min-h-56 place-items-center px-6 py-10 text-center">
      <div>
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#f1eaff] text-violet">
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        <h3 className="mt-4 font-black text-ink">{title}</h3>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
    </div>
  );
}

export function AdminPageState({ label }: { label: string }) {
  return (
    <main className="grid min-h-[calc(100vh-72px)] place-items-center bg-[#f8f7fb] px-5">
      <p className="flex items-center gap-2 rounded-2xl border border-[#e8e1ee] bg-white px-5 py-4 text-sm font-bold text-muted shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin text-violet" aria-hidden />
        {label}
      </p>
    </main>
  );
}

export function AdminError({ message }: { message: string }) {
  return (
    <p role="alert" className="m-5 rounded-2xl bg-[#fff1f2] px-4 py-3 text-sm font-bold text-[#b42318]">
      {message}
    </p>
  );
}

export function formatAdminDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value));
}

export function formatAdminDateTime(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value));
}

export function formatAdminMoney(value: string) {
  const [rawWhole = '0', rawFraction = ''] = value.split('.');
  const sign = rawWhole.startsWith('-') ? '-' : '';
  const whole = sign ? rawWhole.slice(1) : rawWhole;
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = rawFraction.padEnd(2, '0').slice(0, 2);
  return `฿${sign}${groupedWhole}.${fraction}`;
}
