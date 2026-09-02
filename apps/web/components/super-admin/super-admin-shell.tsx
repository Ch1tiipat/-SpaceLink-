'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import {
  Activity,
  BadgeDollarSign,
  Bell,
  Building2,
  CalendarCheck2,
  CheckCheck,
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
import {
  getMyNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRecord,
} from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabase';
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
      {
        label: 'แอดมินบริษัท',
        icon: ShieldCheck,
        href: '/super-admin/admins',
      },
    ],
  },
  {
    label: 'USERS & TRANSACTIONS',
    items: [
      { label: 'ผู้ใช้ทั้งหมด', icon: UsersRound, href: '/super-admin/users' },
      {
        label: 'การจองทั้งหมด',
        icon: CalendarCheck2,
        href: '/super-admin/events-bookings?tab=bookings',
      },
      {
        label: 'การเงินและคืนเงิน',
        icon: WalletCards,
        href: '/super-admin/events-bookings?tab=payments',
      },
    ],
  },
  {
    label: 'CONTROL CENTER',
    items: [
      {
        label: 'เคสช่วยเหลือ',
        icon: LifeBuoy,
        href: '/super-admin/support?tab=tickets',
      },
      {
        label: 'รายงานและความปลอดภัย',
        icon: ShieldAlert,
        href: '/super-admin/support?tab=moderation',
      },
      {
        label: 'Audit logs',
        icon: ScrollText,
        href: '/super-admin/audit-logs',
      },
    ],
  },
  {
    label: 'PLATFORM',
    collapsible: true,
    items: [
      {
        label: 'ประกาศกลาง',
        icon: Megaphone,
        href: '/super-admin/announcements',
      },
      { label: 'Package และ Billing', icon: BadgeDollarSign },
      { label: 'สถานะระบบ', icon: Activity },
      { label: 'บทบาทและสิทธิ์', icon: KeyRound },
      {
        label: 'ตั้งค่าระบบ',
        icon: Settings2,
        href: '/super-admin/settings',
      },
    ],
  },
];

const THAI_DATE = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Bangkok',
});
const THAI_DATE_TIME = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Asia/Bangkok',
});
const NOTIFICATION_PREVIEW_LIMIT = 6;

export function SuperAdminShell({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <SuperAdminShellContent>{children}</SuperAdminShellContent>
    </Suspense>
  );
}

function SuperAdminShellContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const { auth, signOut } = useAuthState();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [platformOpen, setPlatformOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationToken, setNotificationToken] = useState('');
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState('');

  useEffect(() => {
    setDrawerOpen(false);
    setNotificationOpen(false);
  }, [pathname, queryString]);

  useEffect(() => {
    setNotificationToken('');
    setNotifications([]);
    setUnreadCount(null);
    setNotificationError('');
    if (auth.status !== 'signed-in' || auth.role !== 'SUPER_ADMIN') return;

    const controller = new AbortController();
    let active = true;
    void (async () => {
      try {
        const token = await getSessionToken();
        if (!active) return;
        setNotificationToken(token);
        const result = await getUnreadNotificationCount(token, controller.signal);
        if (active) setUnreadCount(result.count);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        if (active) setNotificationError(notificationErrorMessage(cause));
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [auth]);

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

  async function loadNotifications() {
    setNotificationLoading(true);
    setNotificationError('');
    try {
      const token = notificationToken || await getSessionToken();
      setNotificationToken(token);
      const rows = await getMyNotifications(token);
      setNotifications(rows);
      setUnreadCount(rows.filter((notification) => !notification.isRead).length);
    } catch (cause) {
      setNotificationError(notificationErrorMessage(cause));
    } finally {
      setNotificationLoading(false);
    }
  }

  function toggleNotifications() {
    const nextOpen = !notificationOpen;
    setNotificationOpen(nextOpen);
    if (nextOpen) void loadNotifications();
  }

  async function readNotification(notification: NotificationRecord) {
    const previous = notifications;
    if (!notification.isRead) {
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, isRead: true } : item));
      setUnreadCount((current) => current === null ? null : Math.max(0, current - 1));
      try {
        const token = notificationToken || await getSessionToken();
        await markNotificationRead(notification.id, token);
      } catch (cause) {
        setNotifications(previous);
        setUnreadCount(previous.filter((item) => !item.isRead).length);
        setNotificationError(notificationErrorMessage(cause));
      }
    }
    setNotificationOpen(false);
    router.push(superAdminNotificationHref(notification));
  }

  async function readAllNotifications() {
    if (!notifications.some((notification) => !notification.isRead)) return;
    const previous = notifications;
    setNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })));
    setUnreadCount(0);
    setNotificationError('');
    try {
      const token = notificationToken || await getSessionToken();
      await markAllNotificationsRead(token);
    } catch (cause) {
      setNotifications(previous);
      setUnreadCount(previous.filter((notification) => !notification.isRead).length);
      setNotificationError(notificationErrorMessage(cause));
    }
  }

  const sidebar = (
    <SidebarContent
      pathname={pathname}
      queryString={queryString}
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
              pathname={pathname}
              queryString={queryString}
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
              collapsed ? 'lg:absolute lg:left-5 lg:grid' : 'lg:hidden'
            } grid`}
            aria-label={collapsed ? 'เปิดแถบเมนู' : 'เปิดเมนู'}
          >
            <Menu className="h-[18px] w-[18px]" />
          </button>
          <span className="hidden text-xs text-[#82788b] sm:inline">
            ข้อมูลล่าสุด {THAI_DATE.format(new Date())}
          </span>
          <div className="relative">
            <button type="button" onClick={toggleNotifications} className="relative grid h-9 w-9 place-items-center rounded-[9px] border border-[#ebe4ef] bg-white text-[#716675] transition hover:border-[#d8c9ed] hover:bg-[#faf7ff] hover:text-[#6d28d9]" aria-label={`การแจ้งเตือน${unreadCount ? ` ยังไม่ได้อ่าน ${unreadCount} รายการ` : ''}`} aria-expanded={notificationOpen} aria-haspopup="dialog"><Bell className="h-[18px] w-[18px]" />{unreadCount && unreadCount > 0 ? <span className="absolute -right-1.5 -top-1.5 grid min-h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-white bg-[#ef4444] px-1 text-[9px] font-extrabold leading-none text-white">{unreadCount > 99 ? '99+' : unreadCount}</span> : null}</button>
            {notificationOpen ? <><button type="button" className="fixed inset-0 z-30 cursor-default" onClick={() => setNotificationOpen(false)} aria-label="ปิดรายการแจ้งเตือน" /><NotificationMenu notifications={notifications} loading={notificationLoading} error={notificationError} unreadCount={unreadCount ?? 0} onRead={readNotification} onReadAll={readAllNotifications} onClose={() => setNotificationOpen(false)} /></> : null}
          </div>
          <span className="flex items-center gap-2 rounded-xl bg-[#f2eaff] px-2.5 py-1.5 text-[13px] font-bold text-[#6331c4]">
            <span className="grid h-[26px] w-[26px] place-items-center rounded-full bg-[linear-gradient(135deg,#9b5cf6,#6d28d9)] text-[11px] font-extrabold text-white">
              {initials(auth.fullName)}
            </span>
            <span className="hidden max-w-[180px] truncate sm:inline">
              {auth.fullName}
            </span>
          </span>
        </header>
        <main className="min-h-[calc(100vh-64px)] sm:min-h-[calc(100vh-72px)]">
          {children}
        </main>
      </div>
    </div>
  );
}

function NotificationMenu({ notifications, loading, error, unreadCount, onRead, onReadAll, onClose }: { notifications: NotificationRecord[]; loading: boolean; error: string; unreadCount: number; onRead: (notification: NotificationRecord) => Promise<void>; onReadAll: () => Promise<void>; onClose: () => void }) {
  const latest = notifications.slice(0, NOTIFICATION_PREVIEW_LIMIT);
  return <section role="dialog" aria-label="รายการแจ้งเตือน Super Admin" className="absolute right-0 top-12 z-40 w-[min(390px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#e4daee] bg-white text-left shadow-[0_24px_70px_rgba(31,23,48,.22)]"><header className="flex items-start justify-between gap-3 border-b border-[#eee8f3] bg-[linear-gradient(135deg,#fff,#faf7ff)] px-4 py-4"><div><span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#7c3aed]">Notification center</span><h2 className="mt-1 text-base font-black text-[#242032]">การแจ้งเตือน</h2><p className="mt-1 text-[11px] text-[#82788b]">ยังไม่ได้อ่าน {unreadCount.toLocaleString('th-TH')} รายการ</p></div><button type="button" onClick={() => void onReadAll()} disabled={unreadCount === 0 || loading} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[#ded3ec] bg-white px-2.5 text-[11px] font-extrabold text-[#6d28d9] disabled:opacity-45"><CheckCheck className="h-3.5 w-3.5" />อ่านทั้งหมด</button></header>{loading ? <div className="grid gap-2 p-4">{[1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-[#f2edf8]" />)}</div> : error ? <div className="p-5 text-center"><p role="alert" className="text-xs font-bold text-[#b42318]">{error}</p></div> : latest.length === 0 ? <div className="p-7 text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#f1eaff] text-[#6d28d9]"><Bell className="h-5 w-5" /></span><p className="mt-3 text-sm font-bold text-[#242032]">ยังไม่มีการแจ้งเตือน</p></div> : <div className="max-h-[390px] divide-y divide-[#f0ebf4] overflow-y-auto">{latest.map((notification) => <button key={notification.id} type="button" onClick={() => void onRead(notification)} className={`block w-full px-4 py-3.5 text-left transition hover:bg-[#faf7ff] ${notification.isRead ? 'bg-white' : 'bg-[#fbf8ff]'}`}><div className="flex items-start gap-3"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${notification.isRead ? 'bg-[#ddd5e3]' : 'bg-[#7c3aed]'}`} /><div className="min-w-0 flex-1"><strong className="block truncate text-xs text-[#2c2534]">{notification.title}</strong>{notification.body ? <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[#746a7d]">{notification.body}</p> : null}<time dateTime={notification.createdAt} className="mt-1.5 block text-[10px] text-[#978e9e]">{formatNotificationDate(notification.createdAt)}</time></div></div></button>)}</div>}<footer className="border-t border-[#eee8f3] bg-[#fcfaff] p-3"><Link href="/notifications" onClick={onClose} className="block rounded-lg py-2 text-center text-xs font-extrabold text-[#6d28d9] hover:bg-[#f2eaff]">ดูการแจ้งเตือนทั้งหมด</Link></footer></section>;
}

function superAdminNotificationHref(notification: NotificationRecord) {
  switch (notification.type) {
    case 'PAYMENT':
    case 'REFUND':
      return '/super-admin/events-bookings?tab=payments';
    case 'BOOKING_STATUS':
      return '/super-admin/events-bookings?tab=bookings';
    case 'SUPPORT_TICKET':
      return '/super-admin/support?tab=tickets';
    case 'PENALTY':
      return '/super-admin/support?tab=moderation';
    case 'ANNOUNCEMENT':
    case 'SYSTEM':
      return '/super-admin/announcements';
  }
}

function formatNotificationDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? THAI_DATE_TIME.format(date) : value;
}

async function getSessionToken() {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('ไม่พบเซสชันผู้ดูแลระบบ กรุณาเข้าสู่ระบบใหม่');
  return token;
}

function notificationErrorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : 'โหลดการแจ้งเตือนไม่สำเร็จ';
}

function ShellFallback() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#fbfaff] px-6">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#e9ddfa] border-t-[#7c3aed]" />
        <p className="text-sm font-semibold text-[#82788b]">
          กำลังเตรียมเมนูผู้ดูแลระบบ
        </p>
      </div>
    </main>
  );
}

function SidebarContent({
  pathname,
  queryString,
  platformOpen,
  onTogglePlatform,
  onCollapse,
  onSignOut,
  mobile = false,
}: {
  pathname: string;
  queryString: string;
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
            queryString={queryString}
            expanded={!group.collapsible || platformOpen}
            onToggle={group.collapsible ? onTogglePlatform : undefined}
          />
        ))}
      </div>

      <div className="mt-auto border-t border-[#ebe4ef] pt-4">
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
  queryString,
  expanded,
  onToggle,
}: {
  group: NavigationGroup;
  pathname: string;
  queryString: string;
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
            <NavigationLink
              key={item.label}
              item={item}
              pathname={pathname}
              queryString={queryString}
            />
          ))}
        </nav>
      ) : null}
    </section>
  );
}

function NavigationLink({
  item,
  pathname,
  queryString,
}: {
  item: NavigationItem;
  pathname: string;
  queryString: string;
}) {
  const Icon = item.icon;
  const active = item.href
    ? isNavigationActive(item.href, pathname, queryString)
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

function isNavigationActive(
  href: string,
  pathname: string,
  queryString: string,
) {
  const [targetPath, targetQuery = ''] = href.split('?');
  if (targetPath === '/super-admin') return pathname === targetPath;
  if (pathname !== targetPath && !pathname.startsWith(`${targetPath}/`)) {
    return false;
  }
  if (!targetQuery) return true;

  const currentParams = new URLSearchParams(queryString);
  const targetParams = new URLSearchParams(targetQuery);
  return [...targetParams].every(
    ([key, value]) => currentParams.get(key) === value,
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.charAt(0) ?? 'S') + (parts[1]?.charAt(0) ?? 'A');
}
