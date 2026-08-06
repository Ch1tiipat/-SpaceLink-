'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';
import {
  Bell,
  House,
  MessageCircle,
  Orbit,
  Ticket,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { useAuthState, type AuthState } from '@/lib/use-auth-state';

/**
 * A destination that exists, or one the design calls for that has no route
 * behind it yet. The second kind renders in full so the navigation matches the
 * approved design, but carries no `href` and no handler — a link that looks
 * live and goes nowhere is worse than one that says it is not ready.
 */
type NavItem =
  | {
      kind: 'link';
      label: string;
      href: string;
      icon: LucideIcon;
      matches: (pathname: string) => boolean;
    }
  | { kind: 'soon'; label: string; icon: LucideIcon };

/**
 * The prototype lists หน้าหลัก and ค้นหา Event separately. Discovery is a
 * single page here, so they are one item; its sibling Event ที่แนะนำ is
 * dropped rather than pointed at a route that does not exist.
 */
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Explore',
    items: [
      {
        kind: 'link',
        label: 'หน้าหลัก',
        href: '/',
        icon: House,
        // Event pages are reached from discovery and have no nav item of their
        // own, so they keep the section they were entered from highlighted.
        matches: (pathname) => pathname === '/' || pathname.startsWith('/events'),
      },
    ],
  },
  {
    label: 'My Space',
    items: [
      {
        kind: 'link',
        label: 'การจองของฉัน',
        href: '/bookings',
        icon: Ticket,
        matches: (pathname) => pathname.startsWith('/bookings'),
      },
      {
        kind: 'link',
        label: 'ช่วยเหลือ',
        href: '/help',
        icon: MessageCircle,
        matches: (pathname) => pathname.startsWith('/help'),
      },
    ],
  },
  {
    label: 'Account',
    items: [
      {
        kind: 'link',
        label: 'โปรไฟล์',
        href: '/profile',
        icon: UserRound,
        matches: (pathname) => pathname.startsWith('/profile'),
      },
    ],
  },
];

/** Below `lg` the sidebar is replaced by this bar, so it repeats its items. */
const BOTTOM_NAV: NavItem[] = [
  NAV_GROUPS[0].items[0],
  NAV_GROUPS[1].items[0],
  NAV_GROUPS[1].items[1],
  NAV_GROUPS[2].items[0],
];

/**
 * Authentication screens supply their own full-bleed layout and are reachable
 * while signed out, where a sidebar offering การจองของฉัน would be pointing at
 * a page the visitor cannot open yet.
 */
const BARE_ROUTES = new Set(['/login', '/register']);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { auth, signOut } = useAuthState();

  if (BARE_ROUTES.has(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="grid min-h-screen lg:grid-cols-[248px_minmax(0,1fr)]">
        <Sidebar auth={auth} pathname={pathname} />

        <div className="min-w-0">
          <Topbar auth={auth} onSignOut={signOut} />
          {/* The viewport minus the topbar, so a short page still fills the
              screen without overflowing it — the pages themselves no longer
              carry `min-h-screen`, which now double-counts the topbar sitting
              outside them. The bottom padding clears the fixed bottom bar,
              which only exists below `lg`. */}
          <div className="min-h-[calc(100vh-63px)] pb-[72px] lg:min-h-[calc(100vh-72px)] lg:pb-0">
            {children}
          </div>
        </div>
      </div>

      <BottomNav pathname={pathname} />
    </>
  );
}

function Sidebar({
  auth,
  pathname,
}: {
  auth: AuthState;
  pathname: string;
}) {
  return (
    <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-card px-3.5 py-[22px] lg:flex">
      <Link
        href="/"
        className="flex items-center gap-2.5 px-2.5 pb-[27px] text-xl font-bold tracking-[-0.5px] text-ink"
      >
        <BrandMark />
        SpaceLink
      </Link>

      <div className="grid gap-0.5">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <span className="block px-3 pb-[7px] pt-[13px] text-[10px] font-bold uppercase tracking-[1.2px] text-[#A39BAC]">
              {group.label}
            </span>
            <nav className="grid gap-[3px]">
              {group.items.map((item) => (
                <SidebarItem
                  key={item.label}
                  item={item}
                  pathname={pathname}
                />
              ))}
            </nav>
          </div>
        ))}
      </div>

      <div className="mt-auto border-t border-line px-2.5 pb-0.5 pt-4">
        <MiniProfile auth={auth} />
      </div>
    </aside>
  );
}

function SidebarItem({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const shared =
    'flex w-full items-center gap-[11px] rounded-xl px-3 py-2.5 text-left font-medium';

  if (item.kind === 'soon') {
    return (
      <button
        type="button"
        disabled
        className={`${shared} cursor-not-allowed text-[#A79FB2]`}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
        {item.label}
        <SoonBadge />
      </button>
    );
  }

  const active = item.matches(pathname);

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`${shared} ${
        active
          ? 'bg-violet-tint font-bold text-[#5B21B6]'
          : 'text-[#675F73] hover:bg-[#FAF8FF] hover:text-violet'
      }`}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
      {item.label}
    </Link>
  );
}

function SoonBadge() {
  return (
    <span className="ml-auto rounded-full bg-[#F3F4F6] px-1.5 py-0.5 text-[9px] font-semibold text-[#6B7280]">
      เร็วๆ นี้
    </span>
  );
}

function MiniProfile({ auth }: { auth: AuthState }) {
  if (auth.status === 'loading') {
    return <span aria-hidden className="skeleton block h-9 rounded-xl" />;
  }

  if (auth.status === 'signed-out') {
    return (
      <div className="grid gap-2">
        <Link
          href="/login"
          className="rounded-xl bg-violet-tint px-3 py-2 text-center text-[13px] font-bold text-[#6331C4]"
        >
          เข้าสู่ระบบ
        </Link>
        <Link
          href="/register"
          className="rounded-xl bg-violet px-3 py-2 text-center text-[13px] font-bold text-white shadow-[0_7px_16px_#7C3AED32]"
        >
          สมัครสมาชิก
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      <Avatar name={auth.fullName} />
      <div className="min-w-0">
        <b className="block truncate text-[13px]">{auth.fullName}</b>
        <small className="block text-muted">Vendor account</small>
      </div>
    </div>
  );
}

function Topbar({
  auth,
  onSignOut,
}: {
  auth: AuthState;
  onSignOut: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-[63px] items-center justify-between gap-3 border-b border-line bg-card/[0.86] px-[18px] backdrop-blur-[14px] lg:h-[72px] lg:px-8">
      {/* The sidebar carries the brand from `lg` up; below that it is the only
          thing identifying the page, so it appears here instead. */}
      <Link href="/" className="flex items-center gap-2.5 lg:hidden">
        <BrandMark />
        <span className="text-lg font-bold tracking-[-0.5px]">SpaceLink</span>
      </Link>
      <span className="hidden lg:block" />

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled
          aria-label="การแจ้งเตือน (เร็วๆ นี้)"
          className="grid h-[38px] w-[38px] cursor-not-allowed place-items-center rounded-xl bg-[#F7F5FA] text-[#655D70]"
        >
          <Bell className="h-[18px] w-[18px]" strokeWidth={2} />
        </button>

        {auth.status === 'loading' && (
          // Holds the footprint the resolved state will take, so the topbar
          // does not jump when it arrives.
          <span
            aria-hidden
            className="skeleton h-[38px] w-[120px] rounded-xl sm:w-[190px]"
          />
        )}

        {auth.status === 'signed-out' && (
          <>
            <Link
              href="/login"
              className="rounded-xl bg-violet-tint px-3 py-2 text-[13px] font-bold text-[#6331C4] sm:px-4"
            >
              เข้าสู่ระบบ
            </Link>
            <Link
              href="/register"
              className="rounded-xl bg-violet px-3 py-2 text-[13px] font-bold text-white shadow-[0_7px_16px_#7C3AED32] sm:px-4"
            >
              สมัครสมาชิก
            </Link>
          </>
        )}

        {auth.status === 'signed-in' && (
          <>
            <span className="flex items-center gap-2 rounded-xl bg-violet-tint px-2.5 py-1.5 text-[13px] font-bold text-[#6331C4]">
              <Avatar name={auth.fullName} className="h-[26px] w-[26px] text-[11px]" />
              <span className="max-w-[84px] truncate sm:max-w-[180px]">
                {auth.fullName}
              </span>
            </span>
            <SignOutButton onSignOut={onSignOut} />
          </>
        )}
      </div>
    </header>
  );
}

function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-[35] flex h-[66px] justify-around border-t border-line bg-card/95 px-[5px] pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur-[12px] lg:hidden">
      {BOTTOM_NAV.map((item) => {
        const Icon = item.icon;

        if (item.kind === 'soon') {
          return (
            <button
              key={item.label}
              type="button"
              disabled
              className="grid min-w-[54px] cursor-not-allowed place-items-center gap-0.5 text-[10px] text-[#BDB6C6]"
            >
              <Icon className="h-[19px] w-[19px]" strokeWidth={2} />
              <span>{item.label}</span>
            </button>
          );
        }

        const active = item.matches(pathname);

        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`grid min-w-[54px] place-items-center gap-0.5 text-[10px] ${
              active ? 'font-bold text-[#6D28D9]' : 'text-[#837B8D]'
            }`}
          >
            <Icon className="h-[19px] w-[19px]" strokeWidth={2} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SignOutButton({ onSignOut }: { onSignOut: () => void }) {
  return (
    <button
      type="button"
      onClick={onSignOut}
      className="rounded-xl border border-line bg-card px-3 py-2 text-[13px] font-bold text-ink sm:px-4"
    >
      ออกจากระบบ
    </button>
  );
}

function BrandMark() {
  return (
    <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#9F7AEA] to-[#6D28D9] text-white shadow-[0_8px_18px_#7C3AED42]">
      <Orbit className="h-[19px] w-[19px]" strokeWidth={2} />
    </span>
  );
}

function Avatar({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#C4B5FD] to-[#6D28D9] font-bold text-white ${className}`}
    >
      {[...name.trim()][0] ?? '?'}
    </span>
  );
}
