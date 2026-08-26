'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Activity,
  BadgeDollarSign,
  Bell,
  Building2,
  CalendarCheck2,
  ChevronDown,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Megaphone,
  Menu,
  Orbit,
  PanelLeftClose,
  ScrollText,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  UsersRound,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuthState } from '@/lib/use-auth-state';

type NavigationItem = {
  label: string;
  icon: LucideIcon;
  href?: string;
};

type NavigationGroup = {
  label: string;
  collapsible?: boolean;
  items: NavigationItem[];
};

const NAVIGATION: NavigationGroup[] = [
  {
    label: 'SUPER ADMIN',
    items: [
      { label: 'ภาพรวม', icon: LayoutDashboard, href: '/super-admin' },
      {
        label: 'องค์กรทั้งหมด',
        icon: Building2,
        href: '/super-admin/organizations',
      },
      { label: 'แอดมินบริษัท', icon: ShieldCheck },
    ],
  },
  {
    label: 'USERS & TRANSACTIONS',
    items: [
      { label: 'ผู้ใช้ทั้งหมด', icon: UsersRound },
      { label: 'การจองทั้งหมด', icon: CalendarCheck2 },
      { label: 'การเงินและคืนเงิน', icon: WalletCards },
    ],
  },
  {
    label: 'CONTROL CENTER',
    items: [
      { label: 'เคสช่วยเหลือ', icon: LifeBuoy },
      { label: 'รายงานและความปลอดภัย', icon: ShieldAlert },
      { label: 'Audit logs', icon: ScrollText },
    ],
  },
  {
    label: 'PLATFORM',
    collapsible: true,
    items: [
      { label: 'ประกาศกลาง', icon: Megaphone },
      { label: 'Package และ Billing', icon: BadgeDollarSign },
      { label: 'สถานะระบบ', icon: Activity },
      { label: 'บทบาทและสิทธิ์', icon: KeyRound },
      { label: 'ตั้งค่าระบบ', icon: Settings2 },
    ],
  },
];

const THAI_DATE = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Bangkok',
});

export function SuperAdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { auth, signOut } = useAuthState();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [platformOpen, setPlatformOpen] = useState(false);

  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (auth.status === 'signed-out') router.replace('/login');
    if (auth.status === 'signed-in' && auth.role !== 'SUPER_ADMIN') {
      router.replace('/');
    }
  }, [auth, router]);

  if (auth.status !== 'signed-in' || auth.role !== 'SUPER_ADMIN') {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fbfaff] px-6">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#e9ddfa] border-t-[#7c3aed]" />
          <p className="text-sm font-semibold text-[#82788b]">
            กำลังตรวจสอบสิทธิ์ผู้ดูแลระบบ
          </p>
        </div>
      </main>
    );
  }

  const sidebar = (
    <SidebarContent
      authName={auth.fullName}
      pathname={pathname}
      platformOpen={platformOpen}
      onTogglePlatform={() => setPlatformOpen((value) => !value)}
      onCollapse={() => setCollapsed(true)}
      onSignOut={signOut}
    />
  );

  return (
    <div
      className={`min-h-screen bg-[#fbfaff] transition-[grid-template-columns] duration-200 lg:grid ${
        collapsed
          ? 'lg:grid-cols-[0_minmax(0,1fr)]'
          : 'lg:grid-cols-[254px_minmax(0,1fr)]'
      }`}
    >
      <aside
        className={`sticky top-0 hidden h-screen w-[254px] flex-col overflow-y-auto overflow-x-hidden border-r border-[#ebe4ef] bg-[linear-gradient(180deg,#fff_0%,#fdfbff_72%,#faf7ff_100%)] px-[13px] pb-[14px] pt-[18px] transition duration-200 lg:flex ${
          collapsed
            ? 'pointer-events-none -translate-x-3 opacity-0'
            : 'translate-x-0 opacity-100'
        }`}
      >
        {sidebar}
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="ปิดเมนู"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-[#181022]/50 backdrop-blur-[2px]"
          />
          <aside className="relative flex h-full w-[254px] flex-col overflow-y-auto bg-[linear-gradient(180deg,#fff_0%,#fdfbff_72%,#faf7ff_100%)] px-[13px] pb-[14px] pt-[18px] shadow-[12px_0_30px_rgba(15,20,38,.2)]">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-[9px] border border-[#ebe4ef] bg-white text-[#716675]"
              aria-label="ปิดเมนู"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent
              authName={auth.fullName}
              pathname={pathname}
              platformOpen={platformOpen}
              onTogglePlatform={() => setPlatformOpen((value) => !value)}
              onCollapse={() => setDrawerOpen(false)}
              onSignOut={signOut}
              mobile
            />
          </aside>
        </div>
      ) : null}

      <div className="min-w-0 bg-[linear-gradient(180deg,rgba(250,247,255,.82),rgba(255,255,255,.2)_44%,rgba(245,240,255,.52))]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-end gap-5 border-b border-[#ebe4ef] bg-white/90 px-[18px] shadow-[0_8px_24px_rgba(74,48,112,.04)] backdrop-blur-[14px] sm:h-[72px] sm:px-[34px]">
          <button
            type="button"
            onClick={() => {
              if (window.matchMedia('(min-width: 1024px)').matches) {
                setCollapsed(false);
              } else {
                setDrawerOpen(true);
              }
            }}
            className={`h-9 w-9 place-items-center rounded-[9px] border border-[#ebe4ef] bg-white text-[#716675] ${
              collapsed ? 'lg:grid' : 'lg:hidden'
            } grid`}
            aria-label={collapsed ? 'เปิดแถบเมนู' : 'เปิดเมนู'}
          >
            <Menu className="h-[18px] w-[18px]" />
          </button>
          <span className="hidden text-xs text-[#82788b] sm:inline">
            ข้อมูลล่าสุด {THAI_DATE.format(new Date())}
          </span>
          <button
            type="button"
            disabled
            className="grid h-9 w-9 cursor-not-allowed place-items-center rounded-[9px] border border-[#ebe4ef] bg-[#faf8fc] text-[#aaa3b2]"
            aria-label="การแจ้งเตือน (เร็วๆ นี้)"
            title="การแจ้งเตือน — เร็วๆ นี้"
          >
            <Bell className="h-[18px] w-[18px]" />
          </button>
          <div className="flex min-h-11 items-center gap-2 rounded-xl border border-[#e6daf8] bg-[linear-gradient(135deg,#fff,#f6f0ff)] py-1 pl-1.5 pr-2.5 shadow-[0_6px_18px_rgba(124,58,237,.08)]">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[linear-gradient(135deg,#9b5cf6,#6d28d9)] text-[11px] font-extrabold text-white shadow-[0_5px_13px_rgba(124,58,237,.23)]">
              {initials(auth.fullName)}
            </span>
            <span className="hidden min-w-[105px] text-left sm:block">
              <strong className="block truncate text-xs text-[#242032]">
                {auth.fullName}
              </strong>
              <small className="mt-0.5 block text-[11px] text-[#82788b]">
                <i className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#22a06b]" />
                Super Admin
              </small>
            </span>
            <ChevronDown className="hidden h-3.5 w-3.5 text-[#8b5cf6] sm:block" />
          </div>
        </header>
        <main className="min-h-[calc(100vh-64px)] sm:min-h-[calc(100vh-72px)]">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  authName,
  pathname,
  platformOpen,
  onTogglePlatform,
  onCollapse,
  onSignOut,
  mobile = false,
}: {
  authName: string;
  pathname: string;
  platformOpen: boolean;
  onTogglePlatform: () => void;
  onCollapse: () => void;
  onSignOut: () => void;
  mobile?: boolean;
}) {
  return (
    <>
      <div className="flex items-center gap-[7px] px-[5px] pb-3">
        <Link
          href="/super-admin"
          className="flex min-w-0 flex-1 items-center gap-2.5 whitespace-nowrap text-[19px] font-extrabold tracking-[-.4px] text-[#211827]"
        >
          <span className="grid h-[31px] w-[31px] place-items-center rounded-[9px] bg-[linear-gradient(135deg,#9b5cf6,#6d28d9)] text-white">
            <Orbit className="h-[18px] w-[18px]" />
          </span>
          SpaceLink
        </Link>
        {!mobile ? (
          <button
            type="button"
            onClick={onCollapse}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] border border-[#ebe4ef] bg-white text-[#716675]"
            aria-label="พับเมนู"
          >
            <PanelLeftClose className="h-[18px] w-[18px]" />
          </button>
        ) : null}
      </div>

      <div className="grid gap-[3px]">
        {NAVIGATION.map((group) => (
          <NavigationSection
            key={group.label}
            group={group}
            pathname={pathname}
            expanded={!group.collapsible || platformOpen}
            onToggle={group.collapsible ? onTogglePlatform : undefined}
          />
        ))}
      </div>

      <div className="mt-auto pt-5">
        <div className="flex items-center gap-2.5 border-t border-[#ebe4ef] px-2.5 py-3">
          <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-[#e4d8ff] text-[11px] font-extrabold text-[#523ab9]">
            {initials(authName)}
          </span>
          <div className="min-w-0">
            <strong className="block truncate text-xs text-[#242032]">
              {authName}
            </strong>
            <span className="mt-0.5 block text-[11px] text-[#948a98]">
              Platform owner
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="flex min-h-[46px] w-full items-center gap-2.5 rounded-[11px] border border-[#e7dfea] bg-[#faf7ff] px-3 text-left text-[13px] font-extrabold text-[#6d28d9] transition hover:border-[#d5c3e8] hover:bg-[#f2eaff]"
        >
          <LogOut className="h-[18px] w-[18px]" />
          ออกจากระบบ
        </button>
      </div>
    </>
  );
}

function NavigationSection({
  group,
  pathname,
  expanded,
  onToggle,
}: {
  group: NavigationGroup;
  pathname: string;
  expanded: boolean;
  onToggle?: () => void;
}) {
  return (
    <section>
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          className="mt-1 flex min-h-[34px] w-full items-center justify-between px-[11px] py-1 text-left text-[11px] font-extrabold tracking-[.7px] text-[#918697]"
          aria-expanded={expanded}
        >
          {group.label}
          <ChevronDown
            className={`h-4 w-4 transition ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      ) : (
        <p className="mx-[11px] mb-[5px] mt-2 text-[11px] font-extrabold tracking-[.7px] text-[#a49aa9]">
          {group.label}
        </p>
      )}

      {expanded ? (
        <nav className="grid gap-[3px]">
          {group.items.map((item) => (
            <NavigationLink key={item.label} item={item} pathname={pathname} />
          ))}
        </nav>
      ) : null}
    </section>
  );
}

function NavigationLink({
  item,
  pathname,
}: {
  item: NavigationItem;
  pathname: string;
}) {
  const Icon = item.icon;
  const active = item.href
    ? item.href === '/super-admin'
      ? pathname === item.href
      : pathname.startsWith(item.href)
    : false;
  const className = `flex min-h-9 items-center gap-[11px] rounded-[9px] px-[11px] py-[7px] text-sm whitespace-nowrap transition ${
    active
      ? 'bg-[#f2eaff] font-bold text-[#6d28d9] shadow-[inset_3px_0_0_#7c3aed]'
      : 'text-[#716675] hover:translate-x-[3px] hover:bg-[#faf7ff] hover:text-[#6d28d9]'
  }`;

  if (!item.href) {
    return (
      <span
        aria-disabled="true"
        className="flex min-h-9 cursor-not-allowed items-center gap-[11px] whitespace-nowrap rounded-[9px] px-[11px] py-[7px] text-sm text-[#aaa3b2]"
        title="เตรียมเชื่อมใน Phase ถัดไป"
      >
        <Icon className="h-[17px] w-[17px] shrink-0" />
        <span>{item.label}</span>
        <span className="ml-auto rounded bg-[#f1edf5] px-1.5 py-0.5 text-[9px] font-bold text-[#92899a]">
          เร็วๆ นี้
        </span>
      </span>
    );
  }

  return (
    <Link href={item.href} className={className} aria-current={active ? 'page' : undefined}>
      <Icon className="h-[17px] w-[17px] shrink-0" />
      {item.label}
    </Link>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.charAt(0) ?? 'S') + (parts[1]?.charAt(0) ?? 'A');
}
