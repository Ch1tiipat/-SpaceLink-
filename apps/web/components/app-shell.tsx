'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Bell,
  Bot,
  House,
  LogOut,
  Map,
  MapPinned,
  Menu,
  MessageCircle,
  MessagesSquare,
  Orbit,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  Ticket,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuthState, type AuthState } from '@/lib/use-auth-state';
import {
  canUseUxPreview,
  getUxPreviewMode,
  getUxPreviewShopMode,
  setUxPreviewMode,
  setUxPreviewShopMode,
  subscribeToUxPreview,
  subscribeToUxPreviewShop,
  type UxPreviewMode,
  type UxPreviewShopMode,
} from '@/lib/ux-preview';

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

type NavGroup = { label: string; items: NavItem[] };

/**
 * The prototype lists หน้าหลัก and ค้นหา Event separately. Discovery is a
 * single page here, so they are one item; its sibling Event ที่แนะนำ is
 * dropped rather than pointed at a route that does not exist.
 */
const NAV_GROUPS: NavGroup[] = [
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
        label: 'การแจ้งเตือน',
        href: '/notifications',
        icon: Bell,
        matches: (pathname) => pathname.startsWith('/notifications'),
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


const ADMIN_NAV_GROUP: NavGroup = {
  label: 'Admin',
  items: [
    {
      kind: 'link',
      label: 'ยืนยันการจอง',
      href: '/admin/bookings',
      icon: ShieldCheck,
      matches: (pathname) => pathname.startsWith('/admin/bookings'),
    },
    {
      kind: 'link',
      label: 'โซนและบูธ',
      href: '/admin/zones',
      icon: MapPinned,
      matches: (pathname) => pathname.startsWith('/admin/zones'),
    },
    {
      kind: 'link',
      label: 'ออกแบบแผนผัง',
      href: '/admin/map-designer',
      icon: Map,
      matches: (pathname) => pathname.startsWith('/admin/map-designer'),
    },
  ],
};

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (BARE_ROUTES.has(pathname)) {
    return (
      <>
        {children}
        <FloatingSupport hasBottomNav={false} />
      </>
    );
  }

  const hasPrivateNavigation = auth.status === 'signed-in';
  const isAdmin =
    auth.status === 'signed-in' &&
    (auth.role === 'ORG_ADMIN' || auth.role === 'SUPER_ADMIN');
  const navGroups = isAdmin
    ? [NAV_GROUPS[0], ADMIN_NAV_GROUP, NAV_GROUPS[1]]
    : NAV_GROUPS;
  const bottomNavItems = isAdmin
    ? [
        NAV_GROUPS[0].items[0],
        ...ADMIN_NAV_GROUP.items,
        BOTTOM_NAV[2],
      ]
    : BOTTOM_NAV;

  return (
    <>
      <div
        className={
          hasPrivateNavigation
            ? `grid min-h-screen transition-[grid-template-columns] duration-300 ${
                sidebarCollapsed
                  ? 'lg:grid-cols-[minmax(0,1fr)]'
                  : 'lg:grid-cols-[264px_minmax(0,1fr)]'
              }`
            : 'min-h-screen'
        }
      >
        {hasPrivateNavigation && !sidebarCollapsed && (
          <Sidebar
            pathname={pathname}
            navGroups={navGroups}
            collapsed={sidebarCollapsed}
            onSignOut={signOut}
            onToggle={() => setSidebarCollapsed((current) => !current)}
          />
        )}

        <div className="min-w-0">
          <Topbar
            auth={auth}
            hasSidebar={hasPrivateNavigation}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed(false)}
          />
          {/* The viewport minus the topbar, so a short page still fills the
              screen without overflowing it — the pages themselves no longer
              carry `min-h-screen`, which now double-counts the topbar sitting
              outside them. The bottom padding clears the fixed bottom bar,
              which only exists below `lg`. */}
          <div
            className={`min-h-[calc(100vh-63px)] lg:min-h-[calc(100vh-72px)] ${
              hasPrivateNavigation ? 'pb-[72px] lg:pb-0' : ''
            }`}
          >
            {children}
          </div>
        </div>
      </div>

      {hasPrivateNavigation && (
        <BottomNav pathname={pathname} items={bottomNavItems} />
      )}
      <FloatingSupport hasBottomNav={hasPrivateNavigation} />
      <UxReviewPanel auth={auth} pathname={pathname} />
    </>
  );
}

function Sidebar({
  pathname,
  navGroups,
  collapsed,
  onSignOut,
  onToggle,
}: {
  pathname: string;
  navGroups: NavGroup[];
  collapsed: boolean;
  onSignOut: () => void;
  onToggle: () => void;
}) {
  if (collapsed) {
    return (
      <aside className="sticky top-0 hidden h-screen flex-col items-center border-r border-[#e9e3f2] bg-white/90 px-4 py-6 shadow-[12px_0_45px_rgba(49,31,82,0.035)] backdrop-blur-xl lg:flex">
        <button
          type="button"
          onClick={onToggle}
          aria-label="เปิดแถบเมนู"
          aria-expanded={false}
          title="เปิดแถบเมนู"
          className="grid h-11 w-11 place-items-center rounded-2xl border border-[#e5deef] bg-white text-[#655D70] shadow-[0_8px_22px_rgba(54,36,91,0.08)] transition hover:border-[#d3c6e8] hover:bg-violet-tint hover:text-violet"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      </aside>
    );
  }

  return (
    <aside className="sticky top-0 hidden h-screen flex-col border-r border-[#e9e3f2] bg-white/90 px-4 py-6 shadow-[12px_0_45px_rgba(49,31,82,0.035)] backdrop-blur-xl lg:flex">
      <div
        className={`flex pb-7 ${
          collapsed ? 'flex-col items-center gap-3' : 'items-center gap-2'
        }`}
      >
        <Link
          href="/"
          aria-label={collapsed ? 'SpaceLink หน้าแรก' : undefined}
          className={`flex min-w-0 items-center text-xl font-black tracking-[-0.7px] text-ink ${
            collapsed ? 'justify-center' : 'flex-1 gap-3 px-2'
          }`}
        >
          <BrandMark />
          {!collapsed && <span className="truncate">SpaceLink</span>}
        </Link>
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'เปิดแถบเมนู' : 'ย่อแถบเมนู'}
          aria-expanded={!collapsed}
          title={collapsed ? 'เปิดแถบเมนู' : 'ย่อแถบเมนู'}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[#ece7f3] bg-white text-[#655D70] shadow-[0_6px_18px_rgba(54,36,91,0.05)] transition hover:border-[#d9cdf3] hover:bg-violet-tint hover:text-violet"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="grid gap-0.5">
        {navGroups.map((group) => (
          <div key={group.label}>
            {collapsed ? (
              <span aria-hidden className="mx-auto my-3 block h-px w-7 bg-[#ece7f3]" />
            ) : (
              <span className="block px-3 pb-[7px] pt-[13px] text-[10px] font-bold uppercase tracking-[1.2px] text-[#A39BAC]">
                {group.label}
              </span>
            )}
            <nav className="grid gap-[3px]">
              {group.items.map((item) => (
                <SidebarItem
                  key={item.label}
                  item={item}
                  pathname={pathname}
                  collapsed={collapsed}
                />
              ))}
            </nav>
          </div>
        ))}
      </div>

      <div className="mt-auto border-t border-line px-2.5 pb-0.5 pt-4">
        <button
          type="button"
          onClick={onSignOut}
          aria-label={collapsed ? 'ออกจากระบบ' : undefined}
          title={collapsed ? 'ออกจากระบบ' : undefined}
          className={`flex min-h-11 w-full items-center rounded-2xl border border-[#eadff7] bg-[#faf7ff] py-3 text-left text-sm font-extrabold text-[#6331c4] transition hover:border-[#d7c4ef] hover:bg-violet-tint ${
            collapsed ? 'justify-center px-2' : 'gap-3 px-4'
          }`}
        >
          <LogOut aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
          {!collapsed && 'ออกจากระบบ'}
        </button>
      </div>
    </aside>
  );
}

function SidebarItem({
  item,
  pathname,
  collapsed,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  const shared = `flex min-h-11 w-full items-center rounded-2xl py-2.5 text-left text-[14px] font-semibold transition-colors ${
    collapsed ? 'justify-center px-2' : 'gap-[11px] px-3.5'
  }`;

  if (item.kind === 'soon') {
    return (
      <button
        type="button"
        disabled
        title={collapsed ? item.label : undefined}
        className={`${shared} cursor-not-allowed text-[#A79FB2]`}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
        {!collapsed && item.label}
        {!collapsed && <SoonBadge />}
      </button>
    );
  }

  const active = item.matches(pathname);

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={`${shared} ${
        active
          ? 'bg-gradient-to-r from-[#f0eaff] to-[#f8f5ff] font-extrabold text-[#5B21B6] shadow-[inset_0_0_0_1px_rgba(124,58,237,0.08)]'
          : 'text-[#675F73] hover:bg-[#FAF8FF] hover:text-violet'
      }`}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
      {!collapsed && item.label}
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

function Topbar({
  auth,
  hasSidebar,
  sidebarCollapsed,
  onToggleSidebar,
}: {
  auth: AuthState;
  hasSidebar: boolean;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-[63px] items-center justify-between gap-3 border-b border-[#ece7f3] bg-white/[0.82] px-[18px] shadow-[0_8px_28px_rgba(54,36,91,0.035)] backdrop-blur-xl lg:h-[72px] lg:px-8">
      {/* The sidebar carries the brand from `lg` up; below that it is the only
          thing identifying the page, so it appears here instead. */}
      <Link
        href="/"
        className={`flex items-center gap-2.5 ${hasSidebar ? 'lg:hidden' : ''}`}
      >
        <BrandMark />
        <span className="text-lg font-bold tracking-[-0.5px]">SpaceLink</span>
      </Link>
      {hasSidebar && sidebarCollapsed ? (
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="เปิดแถบเมนู"
          aria-expanded={false}
          title="เปิดแถบเมนู"
          className="hidden h-11 w-11 place-items-center rounded-2xl border border-[#e5deef] bg-white text-[#655D70] shadow-[0_8px_22px_rgba(54,36,91,0.08)] transition hover:border-[#d3c6e8] hover:bg-violet-tint hover:text-violet lg:grid"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      ) : (
        <span className="hidden lg:block" />
      )}

      <div className="flex items-center gap-2">
        {auth.status === 'signed-in' && (
          <Link
            href="/notifications"
            aria-label="เปิดการแจ้งเตือน"
            className="relative hidden h-10 w-10 place-items-center rounded-2xl border border-[#ece7f3] bg-white text-[#655D70] shadow-[0_6px_18px_rgba(54,36,91,0.06)] transition hover:border-[#d9cdf3] hover:bg-violet-tint hover:text-violet sm:grid"
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={2} />
            <span
              aria-hidden
              className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-[#ef4444]"
            />
          </Link>
        )}

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
          <span className="flex items-center gap-2 rounded-xl bg-violet-tint px-2.5 py-1.5 text-[13px] font-bold text-[#6331C4]">
            <Avatar name={auth.fullName} className="h-[26px] w-[26px] text-[11px]" />
            <span className="max-w-[84px] truncate sm:max-w-[180px]">
              {auth.fullName}
            </span>
          </span>
        )}
      </div>
    </header>
  );
}

const UX_REVIEW_ROUTES = [
  ['หน้าแรก', '/'],
  ['รายละเอียดงาน', '/events/demo-event'],
  ['แผนผังโซน', '/events/demo-event/map'],
  ['เลือกบูธ', '/events/demo-event/book'],
  ['การจอง', '/bookings'],
  ['แจ้งเตือน', '/notifications'],
  ['ช่วยเหลือ', '/help'],
  ['โปรไฟล์', '/profile'],
] as const;

function UxReviewPanel({ auth, pathname }: { auth: AuthState; pathname: string }) {
  const [available, setAvailable] = useState(false);
  const [mode, setMode] = useState<UxPreviewMode>('signed-out');
  const [shopMode, setShopMode] = useState<UxPreviewShopMode>('with-shop');

  useEffect(() => {
    if (!canUseUxPreview()) return;
    setAvailable(true);
    setMode(getUxPreviewMode() ?? 'signed-out');
    setShopMode(getUxPreviewShopMode());
    const unsubscribeAuth = subscribeToUxPreview(setMode);
    const unsubscribeShop = subscribeToUxPreviewShop(setShopMode);
    return () => {
      unsubscribeAuth();
      unsubscribeShop();
    };
  }, []);

  if (!available) return null;

  return (
    <details className="fixed bottom-4 left-4 z-[80] w-[min(360px,calc(100vw-32px))] rounded-2xl border border-[#d8cef0] bg-white/95 shadow-[0_18px_50px_rgba(44,27,76,0.2)] backdrop-blur-xl">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-extrabold text-violet">
        ตรวจ UX/UI · {auth.status === 'signed-in' ? 'เข้าสู่ระบบแล้ว' : 'ผู้เยี่ยมชม'}
      </summary>
      <div className="border-t border-line p-3">
        <p className="text-xs leading-5 text-muted">
          เครื่องมือนี้แสดงเฉพาะ Local และไม่ส่งข้อมูลเข้า API
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {([
            ['signed-out', 'ยังไม่เข้าสู่ระบบ'],
            ['signed-in', 'เข้าสู่ระบบแล้ว'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setMode(value);
                setUxPreviewMode(value);
              }}
              className={`rounded-xl px-3 py-2 text-xs font-bold ${
                mode === value
                  ? 'bg-violet text-white'
                  : 'border border-line bg-white text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === 'signed-in' && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {([
              ['with-shop', 'มีโปรไฟล์ร้าน'],
              ['no-shop', 'ยังไม่มีร้าน'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setShopMode(value);
                  setUxPreviewShopMode(value);
                }}
                className={`rounded-xl px-3 py-2 text-xs font-bold ${
                  shopMode === value
                    ? 'bg-[#201b2e] text-white'
                    : 'border border-line bg-white text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <nav className="mt-3 flex flex-wrap gap-2" aria-label="หน้าสำหรับตรวจ UX/UI">
          {UX_REVIEW_ROUTES.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                pathname === href
                  ? 'bg-violet-tint text-violet'
                  : 'bg-[#f7f5fa] text-[#625b6d]'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </details>
  );
}

function FloatingSupport({ hasBottomNav }: { hasBottomNav: boolean }) {
  const [open, setOpen] = useState(false);
  const [previewAvailable, setPreviewAvailable] = useState(false);
  const [question, setQuestion] = useState('ร้านคาเฟ่ของฉันเหมาะกับโซนไหน');
  const [answer, setAnswer] = useState(
    'แนะนำโซน A บูธ A01 หรือ A02 เพราะอยู่ใกล้ทางเข้าหลักและกลุ่มร้านอาหาร ลูกค้ามองเห็นง่าย เหมาะกับร้านเครื่องดื่มและขนม',
  );

  useEffect(() => {
    const preview = canUseUxPreview();
    setPreviewAvailable(preview);
    if (!preview) {
      setAnswer(
        'ระบบจะแนะนำโซนและบูธจากข้อมูลร้านค้าของคุณในหน้าแผนผังของแต่ละ Event',
      );
    }
  }, []);

  function askAssistant() {
    const normalized = question.trim();
    if (!normalized) return;
    setAnswer(
      normalized.includes('ผ้า')
        ? 'แนะนำโซน D บูธ D01 หรือ D02 ใกล้กลุ่มผ้าไหมและ OTOP ลูกค้าที่สนใจสินค้าประเภทเดียวกันเดินผ่านมากที่สุด'
        : 'แนะนำโซน A บูธ A01 หรือ A02 เพราะอยู่ใกล้ทางเข้าหลักและกลุ่มร้านอาหาร ลูกค้ามองเห็นง่าย เหมาะกับประเภทร้านในโปรไฟล์ของคุณ',
    );
  }

  return (
    <div
      className={`fixed right-4 z-[75] ${hasBottomNav ? 'bottom-[84px] lg:bottom-5' : 'bottom-5'}`}
      onMouseEnter={() => setOpen(true)}
    >
      {open ? (
        <section
          aria-label="SpaceLink Assistant และช่องทางติดต่อ"
          className="mb-3 w-[min(380px,calc(100vw-32px))] overflow-hidden rounded-[26px] border border-[#ded5f1] bg-white shadow-[0_24px_70px_rgba(45,27,82,0.24)]"
        >
          <div className="bg-gradient-to-br from-[#6d28d9] via-[#7c3aed] to-[#4f7c82] p-5 text-white">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/15">
                  <Bot className="h-6 w-6" aria-hidden />
                </span>
                <div>
                  <p className="text-base font-extrabold">SpaceLink Assistant</p>
                  <p className="mt-1 text-xs leading-5 text-white/75">
                    ช่วยแนะนำโซนและบูธที่เหมาะกับร้านของคุณ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="ปิดหน้าต่างช่วยเหลือ"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-white transition hover:bg-white/20"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>

          <div className="p-4">
            <div className="rounded-2xl bg-[#f6f2ff] p-4 text-sm leading-6 text-[#4d4260]">
              <span className="mb-2 flex items-center gap-2 font-extrabold text-violet">
                <Sparkles className="h-4 w-4" aria-hidden />
                คำแนะนำสำหรับร้านคุณ
              </span>
              {answer}
            </div>

            {previewAvailable ? (
              <div className="mt-3 flex gap-2 rounded-2xl border border-line bg-white p-2 focus-within:border-[#cfc4df]">
                <input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') askAssistant();
                  }}
                  aria-label="พิมพ์คำถามเกี่ยวกับโซนและบูธ"
                  className="min-w-0 flex-1 border-0 bg-transparent px-2 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={askAssistant}
                  aria-label="ส่งคำถาม"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet text-white shadow-[0_7px_16px_rgba(124,58,237,0.24)]"
                >
                  <Send className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ) : (
              <p className="mt-3 rounded-2xl border border-line bg-white px-4 py-3 text-xs leading-5 text-muted">
                เลือก Event แล้วเปิดหน้าแผนผัง จากนั้นกด “แนะนำโซนให้ฉัน”
                เพื่อใช้ระบบแนะนำจริงจากข้อมูลร้านค้าของคุณ
              </p>
            )}

            <Link
              href={previewAvailable ? '/events/demo-event/map' : '/'}
              className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#211a2e] px-4 text-sm font-extrabold text-white transition hover:bg-[#352746]"
            >
              <MapPinned className="h-4 w-4" aria-hidden />
              {previewAvailable
                ? 'ทดลองหน้าแนะนำโซน'
                : 'ไปเลือก Event เพื่อขอคำแนะนำ'}
            </Link>

            <div className="mt-4 border-t border-line pt-4">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">
                ติดต่อเจ้าหน้าที่
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <a
                  href="https://www.facebook.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="grid min-h-14 place-items-center rounded-2xl bg-[#eef4ff] px-2 text-xs font-bold text-[#2459a9]"
                >
                  Facebook
                </a>
                <a
                  href="https://line.me/R/ti/p/"
                  target="_blank"
                  rel="noreferrer"
                  className="grid min-h-14 place-items-center rounded-2xl bg-[#ecfbf1] px-2 text-xs font-bold text-[#168a46]"
                >
                  LINE
                </a>
                <a
                  href="tel:+6644224000"
                  className="grid min-h-14 place-items-center rounded-2xl bg-[#fff5e9] px-2 text-xs font-bold text-[#a85c00]"
                >
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" aria-hidden /> โทร
                  </span>
                </a>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-muted">
                ช่องทาง Facebook และ LINE เป็นตัวอย่าง UX รอผู้ดูแลระบบใส่บัญชีจริง
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <button
        type="button"
        aria-expanded={open}
        aria-label="เปิดตัวช่วยแนะนำโซนและติดต่อ SpaceLink"
        onClick={() => setOpen((current) => !current)}
        className="group flex min-h-14 items-center gap-3 rounded-full bg-[#211a2e] px-4 text-sm font-extrabold text-white shadow-[0_16px_36px_rgba(33,26,46,0.3)] transition hover:-translate-y-0.5 hover:bg-violet"
      >
        <span className="grid h-9 w-9 place-items-center rounded-full bg-white/12">
          <MessagesSquare className="h-5 w-5" aria-hidden />
        </span>
        <span className="hidden pr-1 sm:inline">
          {previewAvailable ? 'ทดลอง AI · ติดต่อเรา' : 'ช่วยเลือกโซน · ติดต่อเรา'}
        </span>
      </button>
    </div>
  );
}

function BottomNav({
  pathname,
  items,
}: {
  pathname: string;
  items: NavItem[];
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-[35] flex h-[68px] justify-around border-t border-[#e9e3f2] bg-white/95 px-[5px] pb-[env(safe-area-inset-bottom)] pt-1.5 shadow-[0_-10px_30px_rgba(54,36,91,0.06)] backdrop-blur-xl lg:hidden">
      {items.map((item) => {
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
            className={`relative grid min-w-[62px] place-items-center gap-0.5 rounded-xl px-2 text-[10px] transition-colors ${
              active
                ? 'bg-violet-tint font-extrabold text-[#6D28D9]'
                : 'text-[#837B8D]'
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
