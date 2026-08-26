'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Orbit,
  Settings2,
  ShieldCheck,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuthState } from '@/lib/use-auth-state';

type NavigationItem = {
  label: string;
  icon: LucideIcon;
  href?: string;
};

const MANAGEMENT_ITEMS: NavigationItem[] = [
  { label: 'ภาพรวม', icon: LayoutDashboard, href: '/super-admin' },
  { label: 'องค์กร', icon: Building2, href: '/super-admin/organizations' },
  { label: 'ผู้ดูแลองค์กร', icon: ShieldCheck },
  { label: 'ผู้ใช้งาน', icon: UsersRound },
];

const PLATFORM_ITEMS: NavigationItem[] = [
  { label: 'บทบาทและสิทธิ์', icon: CircleUserRound },
  { label: 'ตั้งค่าแพลตฟอร์ม', icon: Settings2 },
];

export function SuperAdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { auth, signOut } = useAuthState();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [platformOpen, setPlatformOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (auth.status === 'signed-out') router.replace('/login');
    if (auth.status === 'signed-in' && auth.role !== 'SUPER_ADMIN') {
      router.replace('/');
    }
  }, [auth, router]);

  if (
    auth.status !== 'signed-in' ||
    auth.role !== 'SUPER_ADMIN'
  ) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f8f7fb] px-6">
        <div className="text-center">
          <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-4 border-violet-100 border-t-violet" />
          <p className="font-semibold text-muted">กำลังตรวจสอบสิทธิ์ผู้ดูแลระบบ</p>
        </div>
      </main>
    );
  }

  const sidebar = (
    <>
      <div className="flex h-[72px] items-center border-b border-[#ece8f2] px-4">
        <Link href="/super-admin" className="flex min-w-0 flex-1 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-violet text-white shadow-[0_8px_22px_rgba(124,58,237,0.24)]">
            <Orbit className="h-5 w-5" aria-hidden />
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-lg font-black tracking-[-0.5px] text-ink">
                SpaceLink
              </span>
              <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-violet">
                Super Admin
              </span>
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="hidden h-9 w-9 place-items-center rounded-xl text-muted transition hover:bg-violet-tint hover:text-violet lg:grid"
          aria-label={collapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-5">
        <NavigationGroup
          label="จัดการระบบ"
          items={MANAGEMENT_ITEMS}
          pathname={pathname}
          collapsed={collapsed}
        />
        <div className="mt-6 border-t border-[#eeeaf3] pt-5">
          <button
            type="button"
            onClick={() => setPlatformOpen((value) => !value)}
            className={`flex w-full items-center rounded-xl px-3 py-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[#9790a2] ${collapsed ? 'justify-center' : 'justify-between'}`}
            aria-expanded={platformOpen}
          >
            {collapsed ? <Settings2 className="h-4 w-4" /> : 'Platform'}
            {!collapsed && (
              <ChevronRight className={`h-4 w-4 transition ${platformOpen ? 'rotate-90' : ''}`} />
            )}
          </button>
          {platformOpen && (
            <NavigationGroup
              items={PLATFORM_ITEMS}
              pathname={pathname}
              collapsed={collapsed}
            />
          )}
        </div>
      </div>

      <div className="border-t border-[#ece8f2] p-3">
        {!collapsed && (
          <div className="mb-2 rounded-2xl bg-[#f8f5fd] px-3 py-2.5">
            <p className="truncate text-sm font-bold text-ink">{auth.fullName}</p>
            <p className="text-xs font-semibold text-violet">ผู้ดูแลแพลตฟอร์ม</p>
          </div>
        )}
        <button
          type="button"
          onClick={signOut}
          className={`flex min-h-11 w-full items-center rounded-xl text-sm font-bold text-[#7b7286] transition hover:bg-red-50 hover:text-red-700 ${collapsed ? 'justify-center' : 'gap-3 px-3'}`}
        >
          <LogOut className="h-[18px] w-[18px]" aria-hidden />
          {!collapsed && 'ออกจากระบบ'}
        </button>
      </div>
    </>
  );

  return (
    <div className={`min-h-screen bg-[#f8f7fb] lg:grid ${collapsed ? 'lg:grid-cols-[80px_minmax(0,1fr)]' : 'lg:grid-cols-[260px_minmax(0,1fr)]'}`}>
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-[#e9e5ef] bg-white lg:flex">
        {sidebar}
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="ปิดเมนู"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-[#211a30]/40 backdrop-blur-sm"
          />
          <aside className="relative flex h-full w-[min(310px,86vw)] flex-col bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-4 z-10 grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-[#f5f2f8]"
              aria-label="ปิดเมนู"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-[64px] items-center justify-between border-b border-[#e9e5ef] bg-white/95 px-4 backdrop-blur-xl lg:h-[72px] lg:px-7">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setCollapsed(false);
                setDrawerOpen(true);
              }}
              className="grid h-10 w-10 place-items-center rounded-xl border border-[#e8e3ee] text-muted lg:hidden"
              aria-label="เปิดเมนู"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-violet">Platform console</p>
              <p className="hidden text-sm font-semibold text-muted sm:block">ดูแลทุกองค์กรจากศูนย์กลาง</p>
            </div>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-full bg-violet-tint text-sm font-black text-violet">
            {auth.fullName.trim().charAt(0).toUpperCase() || 'S'}
          </div>
        </header>
        <main className="min-h-[calc(100vh-64px)] lg:min-h-[calc(100vh-72px)]">
          {children}
        </main>
      </div>
    </div>
  );
}

function NavigationGroup({
  label,
  items,
  pathname,
  collapsed,
}: {
  label?: string;
  items: NavigationItem[];
  pathname: string;
  collapsed: boolean;
}) {
  return (
    <div>
      {label && !collapsed && (
        <p className="mb-2 px-3 text-xs font-extrabold uppercase tracking-[0.12em] text-[#a19aa9]">
          {label}
        </p>
      )}
      <nav className="grid gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.href
            ? item.href === '/super-admin'
              ? pathname === item.href
              : pathname.startsWith(item.href)
            : false;
          const className = `flex min-h-11 items-center rounded-xl text-sm font-bold transition ${collapsed ? 'justify-center px-2' : 'gap-3 px-3'} ${active ? 'bg-violet-tint text-violet' : item.href ? 'text-[#716a7c] hover:bg-[#faf8fc] hover:text-violet' : 'cursor-not-allowed text-[#aaa3b2]'}`;

          return item.href ? (
            <Link key={item.label} href={item.href} className={className} title={collapsed ? item.label : undefined}>
              <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
              {!collapsed && item.label}
            </Link>
          ) : (
            <span key={item.label} className={className} title={collapsed ? item.label : 'เตรียมทำใน Phase 2'}>
              <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
              {!collapsed && <><span>{item.label}</span><span className="ml-auto text-[10px] font-bold">เร็วๆ นี้</span></>}
            </span>
          );
        })}
      </nav>
    </div>
  );
}
