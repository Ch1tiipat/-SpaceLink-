'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Bell,
  Building2,
  CalendarCheck2,
  CheckCheck,
  ChevronDown,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Megaphone,
  Menu,
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
import { getSuperAdminNotificationHref } from '@/lib/super-admin-notifications';
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
      {
        label: 'ตั้งค่าระบบ',
        icon: Settings2,
        href: '/super-admin/settings',
      },
    ],
  },
];

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
  const [launcherY, setLauncherY] = useState(160);
  const launcherDragRef = useRef({ startY: 0, top: 160, moved: false });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [platformOpen, setPlatformOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [notificationToken, setNotificationToken] = useState('');
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState('');

  useEffect(() => {
    setDrawerOpen(false);
    setNotificationOpen(false);
    setAccountOpen(false);
  }, [pathname, queryString]);

  useEffect(() => {
    if (!accountOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [accountOpen]);

  useEffect(() => {
    setNotificationToken('');
    setNotifications([]);
    setUnreadCount(null);
    setNotificationError('');
    if (auth.status !== 'signed-in' || auth.role !== 'SUPER_ADMIN') return;

    let active = true;
    let controller: AbortController | null = null;
    const refreshUnreadCount = async () => {
      controller?.abort();
      controller = new AbortController();
      try {
        const token = await getSessionToken();
        if (!active) return;
        setNotificationToken(token);
        const result = await getUnreadNotificationCount(
          token,
          controller.signal,
        );
        if (active) {
          setUnreadCount(result.count);
          setNotificationError('');
        }
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError')
          return;
        if (active) setNotificationError(notificationErrorMessage(cause));
      }
    };

    void refreshUnreadCount();
    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshUnreadCount();
    }, 30_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshUnreadCount();
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
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
      const token = notificationToken || (await getSessionToken());
      setNotificationToken(token);
      const rows = await getMyNotifications(token);
      setNotifications(rows);
      setUnreadCount(
        rows.filter((notification) => !notification.isRead).length,
      );
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
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, isRead: true } : item,
        ),
      );
      setUnreadCount((current) =>
        current === null ? null : Math.max(0, current - 1),
      );
      try {
        const token = notificationToken || (await getSessionToken());
        await markNotificationRead(notification.id, token);
      } catch (cause) {
        setNotifications(previous);
        setUnreadCount(previous.filter((item) => !item.isRead).length);
        setNotificationError(notificationErrorMessage(cause));
      }
    }
    setNotificationOpen(false);
    router.push(getSuperAdminNotificationHref(notification));
  }

  async function readAllNotifications() {
    if (!notifications.some((notification) => !notification.isRead)) return;
    const previous = notifications;
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, isRead: true })),
    );
    setUnreadCount(0);
    setNotificationError('');
    try {
      const token = notificationToken || (await getSessionToken());
      await markAllNotificationsRead(token);
    } catch (cause) {
      setNotifications(previous);
      setUnreadCount(
        previous.filter((notification) => !notification.isRead).length,
      );
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
    />
  );

  return (
    <div className="min-h-screen bg-[#fbfaff]">
      <header className="sticky top-0 z-30 flex h-[63px] items-center justify-between gap-3 border-b border-[#e8e1f4] bg-[#eee4ff]/95 px-[18px] shadow-[0_8px_28px_rgba(61,43,88,.045)] backdrop-blur-xl lg:h-[72px] lg:px-[30px]">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#e5deef] bg-white text-[#655d70] transition hover:border-[#d3c6e8] hover:bg-[#f5efff] hover:text-[#7c3aed] lg:hidden"
              aria-label="เปิดเมนูหลัก"
              aria-haspopup="dialog"
              aria-expanded={drawerOpen}
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
            <Link
              href="/super-admin"
              aria-label="SpaceLink ภาพรวม Super Admin"
              className="flex min-w-0 items-center gap-2.5"
            >
              <Image
                src="/brand/spacelink-mark.png"
                alt=""
                width={38}
                height={38}
                className="h-[38px] w-[38px] object-contain"
              />
              <span className="hidden bg-[linear-gradient(100deg,#4c16ad,#8b3df3)] bg-clip-text text-lg font-black tracking-[-.5px] text-transparent min-[390px]:inline sm:text-2xl">
                SpaceLink
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
            <button
              type="button"
              onClick={toggleNotifications}
              className="relative grid h-10 w-10 place-items-center rounded-2xl bg-transparent text-[#655d70] transition hover:bg-white/80 hover:text-[#7c3aed]"
              aria-label={`การแจ้งเตือน${unreadCount ? ` ยังไม่ได้อ่าน ${unreadCount} รายการ` : ''}`}
              aria-expanded={notificationOpen}
              aria-haspopup="dialog"
            >
              <Bell className="h-[18px] w-[18px]" strokeWidth={2} />
              {unreadCount && unreadCount > 0 ? (
                <span
                  aria-hidden
                  className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-[#ef4444]"
                />
              ) : null}
            </button>
            {notificationOpen ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-30 cursor-default"
                  onClick={() => setNotificationOpen(false)}
                  aria-label="ปิดรายการแจ้งเตือน"
                />
                <NotificationMenu
                  notifications={notifications}
                  loading={notificationLoading}
                  error={notificationError}
                  unreadCount={unreadCount ?? 0}
                  onRead={readNotification}
                  onReadAll={readAllNotifications}
                  onClose={() => setNotificationOpen(false)}
                />
              </>
            ) : null}
            </div>
            <div ref={accountMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setAccountOpen((open) => !open)}
                aria-label="เปิดเมนูโปรไฟล์"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                className="flex min-h-10 items-center gap-2 rounded-2xl border border-[#e7daf8] bg-white/75 px-2.5 py-1.5 text-[13px] font-bold text-[#6331c4] shadow-[0_8px_24px_rgba(83,46,128,.07)] backdrop-blur transition hover:-translate-y-0.5 hover:border-[#d7c1f4] hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e9ddff]"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[linear-gradient(135deg,#9b5cf6,#6d28d9)] text-xs font-extrabold text-white">
                  {initials(auth.fullName)}
                </span>
                <span className="hidden max-w-[180px] truncate sm:inline">
                  {auth.fullName}
                </span>
                <ChevronDown className="h-4 w-4" aria-hidden />
              </button>
              {accountOpen ? (
                <div
                  role="menu"
                  aria-label="เมนูบัญชี"
                  className="absolute right-0 top-[calc(100%+10px)] z-50 w-[220px] rounded-2xl border border-[#e7def2] bg-white p-2 shadow-[0_20px_55px_rgba(39,24,63,.18)]"
                >
                  <p className="border-b border-[#ebe4ef] px-3 py-2 text-xs font-bold text-[#82788b]">
                    บัญชีผู้ดูแลแพลตฟอร์ม
                  </p>
                  <Link
                    href="/profile"
                    role="menuitem"
                    onClick={() => setAccountOpen(false)}
                    className="mt-1 flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-[#554b5e] hover:bg-[#f5efff]"
                  >
                    โปรไฟล์ของฉัน
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAccountOpen(false);
                      signOut();
                    }}
                    className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-bold text-[#b42318] hover:bg-[#fff0ee]"
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                    ออกจากระบบ
                  </button>
                </div>
              ) : null}
            </div>
          </div>
      </header>

      <div
        className={`grid min-h-[calc(100vh-63px)] transition-[grid-template-columns] duration-300 lg:min-h-[calc(100vh-72px)] ${
          collapsed
            ? 'lg:grid-cols-[minmax(0,1fr)]'
            : 'lg:grid-cols-[240px_minmax(0,1fr)]'
        }`}
      >
        {!collapsed ? (
          <aside className="sticky top-[72px] hidden h-[calc(100vh-72px)] flex-col overflow-hidden border-r border-[#ebe5ef] bg-[linear-gradient(180deg,#fff_0%,#fefcff_68%,#f8f3ff_100%)] px-4 py-5 shadow-[12px_0_34px_rgba(69,49,99,.045)] lg:flex">
            {sidebar}
          </aside>
        ) : null}

        <div className="relative min-w-0 overflow-hidden bg-[radial-gradient(circle_at_91%_12%,rgba(169,120,255,.16),transparent_26%),linear-gradient(180deg,rgba(250,247,255,.86),rgba(255,255,255,.22)_44%,rgba(245,240,255,.55))]">
          <main className="min-h-[calc(100vh-63px)] lg:min-h-[calc(100vh-72px)]">
          {children}
          </main>
        </div>
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 bg-[rgba(24,16,38,.5)] backdrop-blur-[2px] lg:hidden">
          <button
            type="button"
            aria-label="ปิดเมนู"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0"
          />
          <aside className="relative flex h-full w-[min(88vw,340px)] flex-col overflow-y-auto border-r border-[#ebe5ef] bg-white px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))] shadow-[18px_0_55px_rgba(35,22,56,.2)]">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-4 top-5 z-10 grid h-11 w-11 place-items-center rounded-2xl border border-[#e5deef] bg-white text-[#655d70] transition hover:border-[#d3c6e8] hover:bg-[#f5efff] hover:text-[#7c3aed]"
              aria-label="ปิดเมนูหลัก"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
            <SidebarContent
              pathname={pathname}
              queryString={queryString}
              platformOpen={platformOpen}
              onTogglePlatform={() => setPlatformOpen((value) => !value)}
              onCollapse={() => setDrawerOpen(false)}
              mobile
            />
          </aside>
        </div>
      ) : null}

      {collapsed ? (
        <button
          type="button"
          aria-label="เปิดแถบเมนู (ลากเพื่อย้ายตำแหน่ง)"
          aria-expanded={false}
          title="เปิดแถบเมนู · ลากเพื่อย้ายตำแหน่ง"
          style={{ top: launcherY, touchAction: 'none' }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            launcherDragRef.current = {
              startY: event.clientY,
              top: launcherY,
              moved: false,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
            const offset = event.clientY - launcherDragRef.current.startY;
            if (Math.abs(offset) > 4) launcherDragRef.current.moved = true;
            if (launcherDragRef.current.moved) {
              setLauncherY(
                Math.min(
                  Math.max(launcherDragRef.current.top + offset, 72),
                  Math.max(72, window.innerHeight - 56),
                ),
              );
            }
          }}
          onClick={() => {
            if (launcherDragRef.current.moved) {
              launcherDragRef.current.moved = false;
              return;
            }
            setCollapsed(false);
          }}
          className="fixed left-0 z-40 hidden h-11 w-11 place-items-center rounded-r-2xl border border-l-0 border-[#d8caeb] bg-white/95 text-[#7c3aed] shadow-[0_10px_28px_rgba(54,36,91,.18)] backdrop-blur transition hover:w-12 hover:bg-[#f5efff] lg:grid"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function NotificationMenu({
  notifications,
  loading,
  error,
  unreadCount,
  onRead,
  onReadAll,
  onClose,
}: {
  notifications: NotificationRecord[];
  loading: boolean;
  error: string;
  unreadCount: number;
  onRead: (notification: NotificationRecord) => Promise<void>;
  onReadAll: () => Promise<void>;
  onClose: () => void;
}) {
  const latest = notifications.slice(0, NOTIFICATION_PREVIEW_LIMIT);
  return (
    <section
      role="dialog"
      aria-label="รายการแจ้งเตือน Super Admin"
      className="absolute right-0 top-12 z-40 w-[min(390px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#e4daee] bg-white text-left shadow-[0_24px_70px_rgba(31,23,48,.22)]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-[#eee8f3] bg-[linear-gradient(135deg,#fff,#faf7ff)] px-4 py-4">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#7c3aed]">
            Notification center
          </span>
          <h2 className="mt-1 text-base font-black text-[#242032]">
            การแจ้งเตือน
          </h2>
          <p className="mt-1 text-[11px] text-[#82788b]">
            ยังไม่ได้อ่าน {unreadCount.toLocaleString('th-TH')} รายการ
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onReadAll()}
          disabled={unreadCount === 0 || loading}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[#ded3ec] bg-white px-2.5 text-[11px] font-extrabold text-[#6d28d9] disabled:opacity-45"
        >
          <CheckCheck className="h-3.5 w-3.5" />
          อ่านทั้งหมด
        </button>
      </header>
      {loading ? (
        <div className="grid gap-2 p-4">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-16 animate-pulse rounded-xl bg-[#f2edf8]"
            />
          ))}
        </div>
      ) : error ? (
        <div className="p-5 text-center">
          <p role="alert" className="text-xs font-bold text-[#b42318]">
            {error}
          </p>
        </div>
      ) : latest.length === 0 ? (
        <div className="p-7 text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#f1eaff] text-[#6d28d9]">
            <Bell className="h-5 w-5" />
          </span>
          <p className="mt-3 text-sm font-bold text-[#242032]">
            ยังไม่มีการแจ้งเตือน
          </p>
        </div>
      ) : (
        <div className="max-h-[390px] divide-y divide-[#f0ebf4] overflow-y-auto">
          {latest.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => void onRead(notification)}
              className={`block w-full px-4 py-3.5 text-left transition hover:bg-[#faf7ff] ${notification.isRead ? 'bg-white' : 'bg-[#fbf8ff]'}`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${notification.isRead ? 'bg-[#ddd5e3]' : 'bg-[#7c3aed]'}`}
                />
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-xs text-[#2c2534]">
                    {notification.title}
                  </strong>
                  {notification.body ? (
                    <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[#746a7d]">
                      {notification.body}
                    </p>
                  ) : null}
                  <time
                    dateTime={notification.createdAt}
                    className="mt-1.5 block text-[10px] text-[#978e9e]"
                  >
                    {formatNotificationDate(notification.createdAt)}
                  </time>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      <footer className="border-t border-[#eee8f3] bg-[#fcfaff] p-3">
        <Link
          href="/super-admin/notifications"
          onClick={onClose}
          className="block rounded-lg py-2 text-center text-xs font-extrabold text-[#6d28d9] hover:bg-[#f2eaff]"
        >
          ดูการแจ้งเตือนทั้งหมด
        </Link>
      </footer>
    </section>
  );
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
  mobile = false,
}: {
  pathname: string;
  queryString: string;
  platformOpen: boolean;
  onTogglePlatform: () => void;
  onCollapse: () => void;
  mobile?: boolean;
}) {
  return (
    <>
      {mobile ? (
        <div className="flex items-center gap-3 px-2 pb-5 pr-14">
          <Link
            href="/super-admin"
            onClick={onCollapse}
            aria-label="SpaceLink ภาพรวม Super Admin"
            className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-xl font-black tracking-[-.7px] text-[#242032]"
          >
            <Image
              src="/brand/spacelink-mark.png"
              alt=""
              width={38}
              height={38}
              className="h-[38px] w-[38px] object-contain"
            />
            <span className="truncate">SpaceLink</span>
          </Link>
        </div>
      ) : (
        <div className="flex justify-end pb-4">
          <button
            type="button"
            onClick={onCollapse}
            aria-label="ย่อแถบเมนู"
            aria-expanded={true}
            title="ย่อแถบเมนู"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[#e5dcef] bg-white text-[#655d70] shadow-[0_8px_22px_rgba(54,36,91,.07)] transition hover:-translate-y-0.5 hover:border-[#d3c3ee] hover:bg-[#f5efff] hover:text-[#7c3aed]"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
        </div>
      )}

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
    <Link
      href={item.href}
      className={className}
      aria-current={active ? 'page' : undefined}
    >
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
