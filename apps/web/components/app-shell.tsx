"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Bell,
  CalendarDays,
  CircleDollarSign,
  House,
  Landmark,
  LayoutDashboard,
  LogOut,
  Map,
  MapPinned,
  Megaphone,
  Menu,
  MessageCircle,
  Orbit,
  Phone,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Ticket,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuthState, type AuthState } from "@/lib/use-auth-state";
import {
  askSupportAssistant,
  getEventMap,
  getEvents,
  getActiveSystemBroadcast,
  getMe,
  getUnreadNotificationCount,
  getZoneRecommendations,
  markAllNotificationsRead,
  type CurrentUser,
  type DiscoveryEvent,
  type EventMap,
  type SupportAssistantResponse,
  type SystemBroadcast,
  type VendorShop,
  type ZoneRecommendation,
} from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { isEventBookable } from "@/lib/event-booking-rules";
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
} from "@/lib/ux-preview";

/**
 * A destination that exists, or one the design calls for that has no route
 * behind it yet. The second kind renders in full so the navigation matches the
 * approved design, but carries no `href` and no handler — a link that looks
 * live and goes nowhere is worse than one that says it is not ready.
 */
type NavItem =
  | {
      kind: "link";
      label: string;
      href: string;
      icon: LucideIcon;
      matches: (pathname: string) => boolean;
    }
  | { kind: "soon"; label: string; icon: LucideIcon };

type NavGroup = { label: string; items: NavItem[] };
type AdminOrganization = CurrentUser["organizations"][number];

type AdminOrganizationContextValue = {
  organizations: AdminOrganization[];
  selectedOrganizationId: string;
  selectOrganization: (organizationId: string) => void;
};

const AdminOrganizationContext = createContext<AdminOrganizationContextValue>({
  organizations: [],
  selectedOrganizationId: "",
  selectOrganization: () => undefined,
});
const NO_ADMIN_ORGANIZATIONS: AdminOrganization[] = [];

export function useAdminOrganizationSelection() {
  return useContext(AdminOrganizationContext);
}

/**
 * The prototype lists หน้าหลัก and ค้นหา Event separately. Discovery is a
 * single page here, so they are one item; its sibling Event ที่แนะนำ is
 * dropped rather than pointed at a route that does not exist.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Explore",
    items: [
      {
        kind: "link",
        label: "หน้าหลัก",
        href: "/",
        icon: House,
        // Event pages are reached from discovery and have no nav item of their
        // own, so they keep the section they were entered from highlighted.
        matches: (pathname) =>
          pathname === "/" || pathname.startsWith("/events"),
      },
    ],
  },
  {
    label: "My Space",
    items: [
      {
        kind: "link",
        label: "การจองของฉัน",
        href: "/bookings",
        icon: Ticket,
        matches: (pathname) => pathname.startsWith("/bookings"),
      },
      {
        kind: "link",
        label: "การแจ้งเตือน",
        href: "/notifications",
        icon: Bell,
        matches: (pathname) => pathname.startsWith("/notifications"),
      },
      {
        kind: "link",
        label: "ช่วยเหลือ",
        href: "/help",
        icon: MessageCircle,
        matches: (pathname) => pathname.startsWith("/help"),
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        kind: "link",
        label: "โปรไฟล์",
        href: "/profile",
        icon: UserRound,
        matches: (pathname) => pathname.startsWith("/profile"),
      },
    ],
  },
];

const ADMIN_NAV_GROUP: NavGroup = {
  label: "Admin",
  items: [
    {
      kind: "link",
      label: "ภาพรวม",
      href: "/admin/dashboard",
      icon: LayoutDashboard,
      matches: (pathname) => pathname.startsWith("/admin/dashboard"),
    },
    {
      kind: "link",
      label: "อีเวนต์",
      href: "/admin/events",
      icon: CalendarDays,
      matches: (pathname) => pathname.startsWith("/admin/events"),
    },
    {
      kind: "link",
      label: "การจอง",
      href: "/admin/bookings",
      icon: Ticket,
      matches: (pathname) => pathname.startsWith("/admin/bookings"),
    },
    {
      kind: "link",
      label: "ยืนยันพิเศษ",
      href: "/admin/booking-rescue",
      icon: ShieldCheck,
      matches: (pathname) => pathname.startsWith("/admin/booking-rescue"),
    },
    {
      kind: "link",
      label: "โซนและบูธ",
      href: "/admin/zones",
      icon: MapPinned,
      matches: (pathname) => pathname.startsWith("/admin/zones"),
    },
    {
      kind: "link",
      label: "ออกแบบแผนผัง",
      href: "/admin/map-designer",
      icon: Map,
      matches: (pathname) => pathname.startsWith("/admin/map-designer"),
    },
    {
      kind: "link",
      label: "ประกาศ",
      href: "/admin/announcements",
      icon: Megaphone,
      matches: (pathname) => pathname.startsWith("/admin/announcements"),
    },
    {
      kind: "link",
      label: "รีวิว",
      href: "/admin/reviews",
      icon: Star,
      matches: (pathname) => pathname.startsWith("/admin/reviews"),
    },
    {
      kind: "link",
      label: "ข้อมูลองค์กร",
      href: "/admin/organization",
      icon: Landmark,
      matches: (pathname) => pathname.startsWith("/admin/organization"),
    },
    {
      kind: "link",
      label: "ผู้ขาย",
      href: "/admin/vendors",
      icon: Store,
      matches: (pathname) => pathname.startsWith("/admin/vendors"),
    },
    {
      kind: "link",
      label: "การชำระเงิน",
      href: "/admin/payments",
      icon: CircleDollarSign,
      matches: (pathname) => pathname.startsWith("/admin/payments"),
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
const BARE_ROUTES = new Set(["/login", "/register"]);
const DISMISSED_BROADCAST_KEY = "spacelink:dismissed-system-broadcast-id";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { auth, signOut } = useAuthState();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState<
    number | null
  >(null);
  const [activeBroadcast, setActiveBroadcast] =
    useState<SystemBroadcast | null>(null);

  const isAdmin =
    auth.status === "signed-in" &&
    (auth.role === "ORG_ADMIN" || auth.role === "SUPER_ADMIN");
  const organizations = isAdmin ? auth.organizations : NO_ADMIN_ORGANIZATIONS;
  const isAdminRoute = pathname.startsWith("/admin");
  const isSuperAdminRoute = pathname.startsWith("/super-admin");

  useEffect(() => {
    if (!isAdmin || organizations.length === 0) {
      setSelectedOrganizationId("");
      return;
    }

    const syncFromUrl = () => {
      const query = new URLSearchParams(window.location.search);
      const requestedId = query.get("organization");
      const nextId = organizations.some(
        (organization) => organization.id === requestedId,
      )
        ? requestedId!
        : organizations[0].id;

      setSelectedOrganizationId(nextId);

      if (isAdminRoute && requestedId !== nextId) {
        query.set("organization", nextId);
        router.replace(`${pathname}?${query.toString()}`);
      }
    };

    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, [isAdmin, isAdminRoute, organizations, pathname, router]);

  useEffect(() => {
    setUnreadNotificationCount(null);
    if (auth.status !== "signed-in") return;

    const controller = new AbortController();
    let active = true;

    void (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!active || !token) return;

        if (pathname.startsWith("/notifications")) {
          await markAllNotificationsRead(token);
          if (active) setUnreadNotificationCount(0);
          return;
        }

        const result = await getUnreadNotificationCount(token, controller.signal);
        if (active) setUnreadNotificationCount(result.count);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError")
          return;
        if (active) setUnreadNotificationCount(null);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [auth.status, pathname]);

  useEffect(() => {
    setActiveBroadcast(null);
    if (auth.status !== "signed-in") return;

    const controller = new AbortController();
    let active = true;

    void (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!active || !token) return;

        const broadcast = await getActiveSystemBroadcast(
          token,
          controller.signal,
        );
        if (!active || !broadcast) return;
        if (sessionStorage.getItem(DISMISSED_BROADCAST_KEY) === broadcast.id) {
          return;
        }
        setActiveBroadcast(broadcast);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") {
          return;
        }
        // A broadcast is supplemental. A temporary failure must not block the
        // authenticated application or replace its page-level error handling.
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [auth.status]);

  function selectOrganization(organizationId: string) {
    if (
      !organizations.some((organization) => organization.id === organizationId)
    ) {
      return;
    }

    setSelectedOrganizationId(organizationId);
    const query = new URLSearchParams(window.location.search);
    query.set("organization", organizationId);
    router.replace(`${pathname}?${query.toString()}`);
  }

  function confirmSignOut() {
    setSignOutConfirmOpen(false);
    signOut();
    router.replace("/");
  }

  function dismissBroadcast() {
    if (!activeBroadcast) return;
    sessionStorage.setItem(DISMISSED_BROADCAST_KEY, activeBroadcast.id);
    setActiveBroadcast(null);
  }

  if (isSuperAdminRoute) {
    return (
      <>
        {activeBroadcast ? (
          <SystemBroadcastBanner
            broadcast={activeBroadcast}
            onDismiss={dismissBroadcast}
          />
        ) : null}
        {children}
      </>
    );
  }

  if (BARE_ROUTES.has(pathname)) {
    return <>{children}</>;
  }

  const hasPrivateNavigation = auth.status === "signed-in";
  const navGroups = isAdmin
    ? [NAV_GROUPS[0], ADMIN_NAV_GROUP, NAV_GROUPS[1]]
    : NAV_GROUPS;
  const bottomNavItems = isAdmin
    ? [NAV_GROUPS[0].items[0], ...ADMIN_NAV_GROUP.items, BOTTOM_NAV[2]]
    : BOTTOM_NAV;

  return (
    <AdminOrganizationContext.Provider
      value={{
        organizations,
        selectedOrganizationId,
        selectOrganization,
      }}
    >
      <div
        className={
          hasPrivateNavigation
            ? `grid min-h-screen transition-[grid-template-columns] duration-300 ${
                sidebarCollapsed
                  ? "lg:grid-cols-[minmax(0,1fr)]"
                  : "lg:grid-cols-[280px_minmax(0,1fr)]"
              }`
            : "min-h-screen"
        }
      >
        {hasPrivateNavigation && !sidebarCollapsed && (
          <Sidebar
            pathname={pathname}
            navGroups={navGroups}
            selectedOrganizationId={selectedOrganizationId}
            collapsed={sidebarCollapsed}
            onSignOut={() => setSignOutConfirmOpen(true)}
            onToggle={() => setSidebarCollapsed((current) => !current)}
          />
        )}

        <div className="min-w-0">
          {activeBroadcast ? (
            <SystemBroadcastBanner
              broadcast={activeBroadcast}
              onDismiss={dismissBroadcast}
            />
          ) : null}
          <Topbar
            auth={auth}
            hasSidebar={hasPrivateNavigation}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed(false)}
            showTenantSwitcher={isAdmin && isAdminRoute}
            organizations={organizations}
            selectedOrganizationId={selectedOrganizationId}
            onSelectOrganization={selectOrganization}
            showUnreadNotificationDot={
              unreadNotificationCount !== null && unreadNotificationCount > 0
            }
            onRequestSignOut={() => setSignOutConfirmOpen(true)}
          />
          {/* The viewport minus the topbar, so a short page still fills the
              screen without overflowing it — the pages themselves no longer
              carry `min-h-screen`, which now double-counts the topbar sitting
              outside them. The bottom padding clears the fixed bottom bar,
              which only exists below `lg`. */}
          <div
            className={`min-h-[calc(100vh-63px)] lg:min-h-[calc(100vh-72px)] ${
              hasPrivateNavigation
                ? "pb-[calc(72px+env(safe-area-inset-bottom))] lg:pb-0"
                : ""
            }`}
          >
            {children}
            {!isAdminRoute ? <UserFooter /> : null}
          </div>
        </div>
      </div>

      {hasPrivateNavigation && (
        <BottomNav
          pathname={pathname}
          items={bottomNavItems}
          selectedOrganizationId={selectedOrganizationId}
          showUnreadNotificationDot={
            unreadNotificationCount !== null && unreadNotificationCount > 0
          }
        />
      )}
      <SignOutConfirmDialog
        open={signOutConfirmOpen}
        onCancel={() => setSignOutConfirmOpen(false)}
        onConfirm={confirmSignOut}
      />
      <FloatingSupport auth={auth} hasBottomNav={hasPrivateNavigation} />
      <UxReviewPanel auth={auth} pathname={pathname} />
    </AdminOrganizationContext.Provider>
  );
}

function SystemBroadcastBanner({
  broadcast,
  onDismiss,
}: {
  broadcast: SystemBroadcast;
  onDismiss: () => void;
}) {
  return (
    <aside
      aria-label="ประกาศจาก SpaceLink"
      className="flex items-start gap-3 bg-[linear-gradient(100deg,#5b21b6,#7c3aed)] px-4 py-3 text-white shadow-[0_8px_22px_rgba(91,33,182,.18)] sm:px-6"
    >
      <Megaphone className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <strong className="block text-sm font-extrabold">{broadcast.title}</strong>
        <p className="mt-0.5 text-sm leading-5 text-white/90">{broadcast.body}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="ปิดประกาศนี้สำหรับเซสชันปัจจุบัน"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/85 transition hover:bg-white/15 hover:text-white"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </aside>
  );
}

function Sidebar({
  pathname,
  navGroups,
  selectedOrganizationId,
  collapsed,
  onSignOut,
  onToggle,
}: {
  pathname: string;
  navGroups: NavGroup[];
  selectedOrganizationId: string;
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
    <aside className="sticky top-0 hidden h-screen flex-col border-r border-[#ebe5ef] bg-white px-4 py-6 shadow-[8px_0_30px_rgba(69,49,99,0.025)] lg:flex">
      <div
        className={`flex pb-7 ${
          collapsed ? "flex-col items-center gap-3" : "items-center gap-2"
        }`}
      >
        <Link
          href="/"
          aria-label={collapsed ? "SpaceLink หน้าแรก" : undefined}
          className={`flex min-w-0 items-center text-xl font-black tracking-[-0.7px] text-ink ${
            collapsed ? "justify-center" : "flex-1 gap-3 px-2"
          }`}
        >
          <BrandMark />
          {!collapsed && <span className="truncate">SpaceLink</span>}
        </Link>
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "เปิดแถบเมนู" : "ย่อแถบเมนู"}
          aria-expanded={!collapsed}
          title={collapsed ? "เปิดแถบเมนู" : "ย่อแถบเมนู"}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[#ece7f3] bg-white text-[#655D70] shadow-[0_6px_18px_rgba(54,36,91,0.05)] transition hover:border-[#d9cdf3] hover:bg-violet-tint hover:text-violet"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="grid gap-0.5 overflow-y-auto pb-3">
        {navGroups.map((group) => (
          <div key={group.label}>
            {collapsed ? (
              <span
                aria-hidden
                className="mx-auto my-3 block h-px w-7 bg-[#ece7f3]"
              />
            ) : (
              <span className="block px-3 pb-[7px] pt-[13px] text-sm font-bold uppercase tracking-[1.2px] text-[#A39BAC]">
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
                  selectedOrganizationId={selectedOrganizationId}
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
          aria-label={collapsed ? "ออกจากระบบ" : undefined}
          title={collapsed ? "ออกจากระบบ" : undefined}
          className={`flex min-h-11 w-full items-center rounded-2xl border border-[#eadff7] bg-[#faf7ff] py-3 text-left text-sm font-extrabold text-[#6331c4] transition hover:border-[#d7c4ef] hover:bg-violet-tint ${
            collapsed ? "justify-center px-2" : "gap-3 px-4"
          }`}
        >
          <LogOut aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
          {!collapsed && "ออกจากระบบ"}
        </button>
      </div>
    </aside>
  );
}

function SidebarItem({
  item,
  pathname,
  collapsed,
  selectedOrganizationId,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  selectedOrganizationId: string;
}) {
  const Icon = item.icon;
  const shared = `flex min-h-12 w-full items-center rounded-[13px] py-2.5 text-left text-[14px] font-medium transition-colors ${
    collapsed ? "justify-center px-2" : "gap-[11px] px-3.5"
  }`;

  if (item.kind === "soon") {
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
      href={navItemHref(item, selectedOrganizationId)}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={`${shared} ${
        active
          ? "bg-[#f4edfc] font-semibold text-[#6d28d9]"
          : "text-[#817884] hover:bg-[#faf7ff] hover:text-[#6d28d9]"
      }`}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
      {!collapsed && item.label}
    </Link>
  );
}

function SoonBadge() {
  return (
    <span className="ml-auto rounded-full bg-[#F3F4F6] px-1.5 py-0.5 text-sm font-semibold text-[#6B7280]">
      เร็วๆ นี้
    </span>
  );
}

function Topbar({
  auth,
  hasSidebar,
  sidebarCollapsed,
  onToggleSidebar,
  showTenantSwitcher,
  organizations,
  selectedOrganizationId,
  onSelectOrganization,
  showUnreadNotificationDot,
  onRequestSignOut,
}: {
  auth: AuthState;
  hasSidebar: boolean;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  showTenantSwitcher: boolean;
  organizations: AdminOrganization[];
  selectedOrganizationId: string;
  onSelectOrganization: (organizationId: string) => void;
  showUnreadNotificationDot: boolean;
  onRequestSignOut: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-[63px] items-center justify-between gap-3 border-b border-[#ebe5ef] bg-white/95 px-[18px] shadow-[0_5px_20px_rgba(61,43,88,0.025)] backdrop-blur-xl lg:h-[72px] lg:px-[26px]">
      {/* The sidebar carries the brand from `lg` up; below that it is the only
          thing identifying the page, so it appears here instead. */}
      <Link
        href="/"
        className={`flex items-center gap-2.5 ${hasSidebar ? "lg:hidden" : ""}`}
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
        {showTenantSwitcher && organizations.length > 0 && (
          <label className="min-w-0">
            <span className="sr-only">องค์กรที่กำลังจัดการ</span>
            <select
              aria-label="องค์กรที่กำลังจัดการ"
              value={selectedOrganizationId}
              onChange={(event) => onSelectOrganization(event.target.value)}
              className="h-10 max-w-[130px] rounded-xl border border-[#ded5ec] bg-white px-3 text-base font-extrabold text-[#5b21b6] outline-none transition focus:border-violet focus:ring-4 focus:ring-violet/10 sm:max-w-[240px]"
            >
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {auth.status === "signed-in" && (
          <Link
            href="/notifications"
            aria-label="เปิดการแจ้งเตือน"
            className="relative hidden h-10 w-10 place-items-center rounded-2xl border border-[#ece7f3] bg-white text-[#655D70] shadow-[0_6px_18px_rgba(54,36,91,0.06)] transition hover:border-[#d9cdf3] hover:bg-violet-tint hover:text-violet sm:grid"
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={2} />
            {showUnreadNotificationDot ? (
              <span
                aria-hidden
                className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-[#ef4444]"
              />
            ) : null}
          </Link>
        )}

        {auth.status === "loading" && (
          // Holds the footprint the resolved state will take, so the topbar
          // does not jump when it arrives.
          <span
            aria-hidden
            className="skeleton h-[38px] w-[120px] rounded-xl sm:w-[190px]"
          />
        )}

        {auth.status === "signed-out" && (
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

        {auth.status === "signed-in" && (
          <AccountMenu
            fullName={auth.fullName}
            compact={showTenantSwitcher}
            onRequestSignOut={onRequestSignOut}
          />
        )}
      </div>
    </header>
  );
}

function AccountMenu({
  fullName,
  compact,
  onRequestSignOut,
}: {
  fullName: string;
  compact: boolean;
  onRequestSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsidePress(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="เปิดเมนูโปรไฟล์"
        className="flex min-h-10 items-center gap-2 rounded-xl bg-violet-tint px-2.5 py-1.5 text-[13px] font-bold text-[#6331C4] transition hover:bg-[#eee4ff] focus-visible:outline-offset-2"
      >
        <Avatar name={fullName} className="h-[28px] w-[28px] text-sm" />
        <span
          className={`max-w-[84px] truncate sm:max-w-[180px] ${
            compact ? "hidden md:inline" : ""
          }`}
        >
          {fullName}
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="เมนูบัญชี"
          className="absolute right-0 top-[calc(100%+10px)] z-50 w-[220px] overflow-hidden rounded-2xl border border-[#e7def2] bg-white p-2 shadow-[0_20px_55px_rgba(39,24,63,.18)]"
        >
          <div className="border-b border-line px-3 pb-2.5 pt-1.5">
            <p className="truncate text-sm font-extrabold text-ink">{fullName}</p>
            <p className="mt-0.5 text-xs text-muted">บัญชีผู้ขาย SpaceLink</p>
          </div>
          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="mt-1.5 flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold text-[#554b5e] transition hover:bg-violet-tint hover:text-violet"
          >
            <UserRound className="h-[18px] w-[18px]" aria-hidden />
            โปรไฟล์ของฉัน
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onRequestSignOut();
            }}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-extrabold text-[#b42318] transition hover:bg-[#fff0ee]"
          >
            <LogOut className="h-[18px] w-[18px]" aria-hidden />
            ออกจากระบบ
          </button>
        </div>
      ) : null}
    </div>
  );
}

const UX_REVIEW_ROUTES = [
  ["หน้าแรก", "/"],
  ["รายละเอียดงาน", "/events/demo-event"],
  ["แผนผังโซน", "/events/demo-event/map"],
  ["เลือกบูธ", "/events/demo-event/book"],
  ["การจอง", "/bookings"],
  ["รายละเอียดจอง", "/bookings/local-preview-confirmed-booking"],
  ["ชำระเงิน", "/bookings/local-preview-booking/payment"],
  ["รีวิว", "/bookings/local-preview-completed-booking/review"],
  ["แจ้งเตือน", "/notifications"],
  ["ช่วยเหลือ", "/help"],
  ["โปรไฟล์", "/profile"],
  ["เข้าสู่ระบบ", "/login"],
  ["สมัครสมาชิก", "/register"],
] as const;

function UxReviewPanel({
  auth,
  pathname,
}: {
  auth: AuthState;
  pathname: string;
}) {
  const [available, setAvailable] = useState(false);
  const [mode, setMode] = useState<UxPreviewMode>("signed-out");
  const [shopMode, setShopMode] = useState<UxPreviewShopMode>("with-shop");

  useEffect(() => {
    if (!canUseUxPreview()) return;
    setAvailable(true);
    setMode(getUxPreviewMode() ?? "signed-out");
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
    <details className="fixed bottom-[84px] left-4 z-[80] w-[min(360px,calc(100vw-32px))] rounded-2xl border border-[#d8cef0] bg-white/95 shadow-[0_18px_50px_rgba(44,27,76,0.2)] backdrop-blur-xl lg:bottom-4">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-extrabold text-violet">
        ตรวจ UX/UI ·{" "}
        {auth.status === "signed-in" ? "เข้าสู่ระบบแล้ว" : "ผู้เยี่ยมชม"}
      </summary>
      <div className="border-t border-line p-3">
        <p className="text-xs leading-5 text-muted">
          เครื่องมือนี้แสดงเฉพาะ Local และไม่ส่งข้อมูลเข้า API
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(
            [
              ["signed-out", "ยังไม่เข้าสู่ระบบ"],
              ["signed-in", "เข้าสู่ระบบแล้ว"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setMode(value);
                setUxPreviewMode(value);
              }}
              className={`rounded-xl px-3 py-2 text-xs font-bold ${
                mode === value
                  ? "bg-violet text-white"
                  : "border border-line bg-white text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === "signed-in" && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(
              [
                ["with-shop", "มีโปรไฟล์ร้าน"],
                ["no-shop", "ยังไม่มีร้าน"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setShopMode(value);
                  setUxPreviewShopMode(value);
                }}
                className={`rounded-xl px-3 py-2 text-xs font-bold ${
                  shopMode === value
                    ? "bg-[#201b2e] text-white"
                    : "border border-line bg-white text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <nav
          className="mt-3 flex flex-wrap gap-2"
          aria-label="หน้าสำหรับตรวจ UX/UI"
        >
          {UX_REVIEW_ROUTES.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                pathname === href
                  ? "bg-violet-tint text-violet"
                  : "bg-[#f7f5fa] text-[#625b6d]"
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

type ZoneAssistantStep =
  | "idle"
  | "loading"
  | "select-event"
  | "select-zone"
  | "select-facilities"
  | "result";

const ASSISTANT_FACILITIES = [
  { value: "ปลั๊กไฟ", label: "ปลั๊กไฟ" },
  { value: "โต๊ะ", label: "โต๊ะ" },
  { value: "น้ำประปา", label: "น้ำประปา" },
  { value: "Wi-Fi", label: "Wi-Fi" },
] as const;

function FloatingSupport({
  auth,
  hasBottomNav,
}: {
  auth: AuthState;
  hasBottomNav: boolean;
}) {
  const initialAnswer =
    "สวัสดีครับ 👋 ผมคือ AI ช่วยคุณได้ ถามเรื่อง Event การเลือกโซนและบูธ การจอง การชำระเงิน หรือวิธีใช้งาน SpaceLink ได้เลยครับ";
  const [view, setView] = useState<"closed" | "menu" | "chat">("closed");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(initialAnswer);
  const [answerSource, setAnswerSource] = useState<
    SupportAssistantResponse["source"] | null
  >(null);
  const [isAsking, setIsAsking] = useState(false);
  const [zoneStep, setZoneStep] = useState<ZoneAssistantStep>("idle");
  const [assistantEvents, setAssistantEvents] = useState<DiscoveryEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<DiscoveryEvent | null>(
    null,
  );
  const [selectedMap, setSelectedMap] = useState<EventMap | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);
  const [selectedShop, setSelectedShop] = useState<VendorShop | null>(null);
  const [recommendations, setRecommendations] = useState<ZoneRecommendation[]>(
    [],
  );
  const requestController = useRef<AbortController | null>(null);

  const quickQuestions = [
    "เริ่มจองบูธอย่างไร",
    "อัปโหลดสลิปที่ไหน",
    "แนะนำโซนและบูธให้ร้านฉัน",
  ];

  useEffect(
    () => () => {
      requestController.current?.abort();
    },
    [],
  );

  async function askAssistant(nextQuestion = question) {
    const normalized = nextQuestion.trim();
    if (!normalized || isAsking) return;

    if (isZoneRecommendationQuestion(normalized)) {
      await startZoneAssistant(normalized);
      return;
    }

    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setQuestion(normalized);
    setAnswer("กำลังค้นหาคำตอบจากข้อมูล SpaceLink…");
    setAnswerSource(null);
    setIsAsking(true);

    try {
      const result = await askSupportAssistant(normalized, controller.signal);
      if (controller.signal.aborted) return;
      setAnswer(result.answer);
      setAnswerSource(result.source);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setAnswer(
        cause instanceof Error
          ? cause.message
          : "AI ช่วยคุณได้ยังไม่พร้อมใช้งาน กรุณาลองใหม่อีกครั้งครับ",
      );
      setAnswerSource(null);
    } finally {
      if (requestController.current === controller) {
        requestController.current = null;
        setIsAsking(false);
      }
    }
  }

  async function startZoneAssistant(nextQuestion: string) {
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setQuestion(nextQuestion);
    setAnswerSource(null);
    setRecommendations([]);
    setSelectedEvent(null);
    setSelectedMap(null);
    setSelectedZoneId("");
    setSelectedFacilities([]);

    if (auth.status !== "signed-in") {
      setZoneStep("idle");
      setAnswer(
        "กรุณาเข้าสู่ระบบก่อนครับ เพื่อให้ผมอ่านเฉพาะข้อมูลร้านของคุณและแนะนำบูธที่ยังว่างได้อย่างปลอดภัย",
      );
      return;
    }

    setZoneStep("loading");
    setAnswer("กำลังตรวจสอบร้านของคุณและโหลด Event ที่เปิดให้เลือก…");
    setIsAsking(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้งครับ");
      }

      const [profile, events] = await Promise.all([
        getMe(token, controller.signal),
        getEvents(controller.signal),
      ]);
      if (controller.signal.aborted) return;

      const shop = profile.shops[0];
      if (!shop) {
        setZoneStep("idle");
        setAnswer(
          "ยังไม่พบข้อมูลร้านของคุณครับ กรุณาสร้างโปรไฟล์ร้านและเลือกหมวดสินค้าก่อน แล้วกลับมาขอคำแนะนำอีกครั้ง",
        );
        return;
      }
      const bookableEvents = events.filter((event) => isEventBookable(event));
      if (bookableEvents.length === 0) {
        setZoneStep("idle");
        setAnswer("ตอนนี้ยังไม่มี Event ที่เปิดให้เลือกบูธครับ");
        return;
      }

      setSelectedShop(shop);
      setAssistantEvents(bookableEvents);
      setZoneStep("select-event");
      setAnswer(
        `ผมพบร้าน “${shop.name}” และจะใช้หมวดสินค้า ${shop.categories.map((category) => category.name).join(", ") || "ที่บันทึกไว้"} เพื่อวิเคราะห์ครับ เลือก Event ที่สนใจก่อน`,
      );
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setZoneStep("idle");
      setAnswer(
        assistantErrorMessage(
          cause,
          "ไม่สามารถโหลดข้อมูลร้านเพื่อแนะนำโซนได้ กรุณาลองใหม่ครับ",
        ),
      );
    } finally {
      if (requestController.current === controller) {
        requestController.current = null;
        setIsAsking(false);
      }
    }
  }

  async function chooseEvent(event: DiscoveryEvent) {
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setSelectedEvent(event);
    setSelectedZoneId("");
    setSelectedFacilities([]);
    setZoneStep("loading");
    setAnswer(`กำลังโหลดแผนผังของ ${event.name}…`);
    setIsAsking(true);

    try {
      const eventMap = await getEventMap(event.id, controller.signal);
      if (controller.signal.aborted) return;
      setSelectedMap(eventMap);
      setZoneStep("select-zone");
      setAnswer(
        "สนใจโซนไหนเป็นพิเศษครับ? เลือกโซนได้เลย หรือให้ AI เปรียบเทียบทุกโซนก็ได้",
      );
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setZoneStep("select-event");
      setAnswer(
        cause instanceof Error
          ? cause.message
          : "โหลดแผนผังไม่สำเร็จ กรุณาเลือก Event อีกครั้งครับ",
      );
    } finally {
      if (requestController.current === controller) {
        requestController.current = null;
        setIsAsking(false);
      }
    }
  }

  function chooseZone(zoneId: string) {
    setSelectedZoneId(zoneId);
    setSelectedFacilities([]);
    setZoneStep("select-facilities");
    setAnswer(
      "ต้องการอุปกรณ์อะไรที่บูธบ้างครับ? เลือกได้หลายรายการ หรือกดประมวลผลได้เลยถ้าไม่จำเป็น",
    );
  }

  function toggleFacility(facility: string) {
    setSelectedFacilities((current) =>
      current.includes(facility)
        ? current.filter((item) => item !== facility)
        : [...current, facility],
    );
  }

  async function requestZoneRecommendations() {
    if (!selectedEvent || !selectedShop || isAsking) return;
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setZoneStep("loading");
    setAnswer("กำลังวิเคราะห์หมวดร้าน โซนที่สนใจ อุปกรณ์ และบูธว่างจริง…");
    setIsAsking(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้งครับ");
      }

      const result = await getZoneRecommendations(
        selectedEvent.id,
        {
          shopId: selectedShop.id,
          preferredZoneId: selectedZoneId || undefined,
          requiredFacilities:
            selectedFacilities.length > 0 ? selectedFacilities : undefined,
          limit: 3,
        },
        token,
        controller.signal,
      );
      if (controller.signal.aborted) return;

      setRecommendations(result);
      setZoneStep("result");
      setAnswer(
        result.length > 0
          ? `พบ ${result.length} บูธที่เหมาะกับร้าน “${selectedShop.name}” จากบูธที่ยังว่างครับ`
          : "ยังไม่พบบูธว่างที่ตรงกับเงื่อนไขนี้ ลองเลือกทุกโซนหรือลดเงื่อนไขอุปกรณ์ครับ",
      );
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setZoneStep("select-facilities");
      setAnswer(
        assistantErrorMessage(
          cause,
          "ประมวลผลคำแนะนำไม่สำเร็จ กรุณาลองใหม่ครับ",
        ),
      );
    } finally {
      if (requestController.current === controller) {
        requestController.current = null;
        setIsAsking(false);
      }
    }
  }

  function resetAssistant() {
    requestController.current?.abort();
    requestController.current = null;
    setQuestion("");
    setAnswer(initialAnswer);
    setAnswerSource(null);
    setIsAsking(false);
    setZoneStep("idle");
    setAssistantEvents([]);
    setSelectedEvent(null);
    setSelectedMap(null);
    setSelectedZoneId("");
    setSelectedFacilities([]);
    setSelectedShop(null);
    setRecommendations([]);
  }

  const expanded = view !== "closed";

  return (
    <div
      className={`sl-floating-support fixed z-[75] ${hasBottomNav ? "sl-floating-support--with-bottom-nav" : ""}`}
    >
      {view === "menu" ? (
        <section
          aria-label="ช่องทางติดต่อ SpaceLink"
          className="mb-3 grid w-[min(305px,calc(100vw-32px))] gap-2"
        >
          <button
            type="button"
            onClick={() => setView("chat")}
            className="group flex min-h-[70px] items-center justify-end gap-3 rounded-[18px] border border-line bg-white px-2.5 text-right shadow-[0_10px_28px_rgba(45,27,82,.10)] transition hover:-translate-y-0.5 hover:border-[#d3c3ef]"
          >
            <span>
              <strong className="block text-sm text-ink">AI ช่วยคุณได้</strong>
              <small className="mt-1 block text-xs text-muted">
                ถามข้อมูลและวิธีใช้งาน
              </small>
            </span>
            <span className="grid h-[54px] w-[54px] place-items-center rounded-[15px] bg-[linear-gradient(135deg,#8b5cf6,#6d28d9)] text-white">
              <Sparkles className="h-5 w-5" aria-hidden />
            </span>
          </button>
          <a
            href="https://line.me/R/ti/p/"
            target="_blank"
            rel="noreferrer"
            aria-label="ติดต่อผ่าน LINE"
            className="flex min-h-[70px] items-center justify-end gap-3 rounded-[18px] border border-line bg-white px-2.5 text-right shadow-[0_10px_28px_rgba(45,27,82,.10)] transition hover:-translate-y-0.5 hover:border-[#c8ead4]"
          >
            <span>
              <strong className="block text-sm text-ink">LINE</strong>
              <small className="mt-1 block text-xs text-muted">
                @spacelink
              </small>
            </span>
            <span className="grid h-[54px] w-[54px] place-items-center rounded-[15px] bg-[#20b955] text-white">
              <MessageCircle className="h-5 w-5" aria-hidden />
            </span>
          </a>
          <a
            href="https://www.facebook.com/"
            target="_blank"
            rel="noreferrer"
            aria-label="ติดต่อผ่าน Facebook"
            className="flex min-h-[70px] items-center justify-end gap-3 rounded-[18px] border border-line bg-white px-2.5 text-right shadow-[0_10px_28px_rgba(45,27,82,.10)] transition hover:-translate-y-0.5 hover:border-[#c9dcfb]"
          >
            <span>
              <strong className="block text-sm text-ink">Facebook</strong>
              <small className="mt-1 block text-xs text-muted">SpaceLink</small>
            </span>
            <span className="grid h-[54px] w-[54px] place-items-center rounded-[15px] bg-[#1877f2] text-lg font-black text-white">
              f
            </span>
          </a>
          <a
            href="tel:+6644223000"
            aria-label="โทรหาเจ้าหน้าที่ SpaceLink"
            className="flex min-h-[70px] items-center justify-end gap-3 rounded-[18px] border border-line bg-white px-2.5 text-right shadow-[0_10px_28px_rgba(45,27,82,.10)] transition hover:-translate-y-0.5 hover:border-[#bfe3d4]"
          >
            <span>
              <strong className="block text-sm text-ink">โทรหาเรา</strong>
              <small className="mt-1 block text-xs text-muted">
                044-223-000
              </small>
            </span>
            <span className="grid h-[54px] w-[54px] place-items-center rounded-[15px] bg-[#278b68] text-white">
              <Phone className="h-5 w-5" aria-hidden />
            </span>
          </a>
        </section>
      ) : null}

      {view === "chat" ? (
        <section
          aria-label="AI ช่วยคุณได้ SpaceLink"
          aria-busy={isAsking}
          className="sl-floating-chat mb-3 flex w-[min(445px,calc(100vw-32px))] flex-col overflow-hidden rounded-[22px] border border-[#ded5f1] bg-white shadow-[0_24px_70px_rgba(45,27,82,.24)]"
        >
          <header className="flex min-h-[68px] shrink-0 items-center gap-2 border-b border-line px-3 sm:min-h-[86px] sm:gap-3 sm:px-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-[linear-gradient(135deg,#8b5cf6,#6d28d9)] text-white sm:h-12 sm:w-12 sm:rounded-[15px]">
              <Sparkles className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <strong className="block text-sm font-black">
                AI ช่วยคุณได้
              </strong>
              <small className="mt-1 block text-xs text-muted">
                ถามข้อมูลการใช้งาน SpaceLink
              </small>
            </div>
            <button
              type="button"
              onClick={resetAssistant}
              aria-label="เริ่มบทสนทนาใหม่"
              title="เริ่มบทสนทนาใหม่"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] border border-line text-muted transition hover:border-violet hover:text-violet sm:h-10 sm:w-10 sm:rounded-[12px]"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setView("closed")}
              aria-label="ปิดหน้าต่าง AI ช่วยคุณได้"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] border border-line text-muted transition hover:border-violet hover:text-violet sm:h-10 sm:w-10 sm:rounded-[12px]"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#fcfbff] p-3 sm:p-4">
            <div className="mb-3 rounded-xl border border-[#e6ddf2] bg-[#f7f2ff] px-3 py-2 text-xs text-muted">
              ถามเรื่อง Event · การจองบูธ · การชำระเงิน · ติดต่อผู้จัด
            </div>
            {question.trim() ? (
              <div className="ml-auto max-w-[82%] rounded-[14px_14px_3px_14px] bg-violet px-3 py-2.5 text-sm leading-5 text-white">
                {question}
              </div>
            ) : null}
            <div
              aria-live="polite"
              className="mt-3 max-w-[84%] rounded-[14px_14px_14px_3px] border border-[#e5dcf0] bg-white px-3 py-2.5 text-sm leading-5 text-ink"
            >
              <p>{answer}</p>
              {answerSource ? (
                <small className="mt-2 block text-[11px] font-bold text-muted">
                  {answerSource === "AI_GEMINI"
                    ? "ตอบโดย Gemini 3.6 Flash"
                    : "คำตอบสำรองจากข้อมูล SpaceLink"}
                </small>
              ) : null}
            </div>
            {zoneStep === "select-event" ? (
              <div className="mt-3 grid gap-2" aria-label="เลือก Event">
                {assistantEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => void chooseEvent(event)}
                    className="rounded-xl border border-[#d9cbed] bg-white px-3 py-2.5 text-left text-sm font-bold text-ink transition hover:border-violet hover:bg-[#faf7ff]"
                  >
                    <span className="block">{event.name}</span>
                    <small className="mt-1 block font-normal text-muted">
                      {event.venue.name}
                    </small>
                  </button>
                ))}
              </div>
            ) : null}

            {zoneStep === "select-zone" && selectedMap ? (
              <div className="mt-3 flex flex-wrap gap-2" aria-label="เลือกโซน">
                <button
                  type="button"
                  onClick={() => chooseZone("")}
                  className="rounded-full border border-violet bg-violet px-3 py-2 text-xs font-bold text-white"
                >
                  ให้ AI เลือกทุกโซน
                </button>
                {selectedMap.zones.map((zone) => (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => chooseZone(zone.id)}
                    className="rounded-full border border-[#d9cbed] bg-white px-3 py-2 text-xs font-bold text-violet transition hover:border-violet"
                  >
                    โซน {zone.code}
                    {zone.name ? ` · ${zone.name}` : ""}
                  </button>
                ))}
              </div>
            ) : null}

            {zoneStep === "select-facilities" ? (
              <div className="mt-3 rounded-2xl border border-[#e5dcf0] bg-white p-3">
                <div
                  className="flex flex-wrap gap-2"
                  aria-label="เลือกอุปกรณ์บูธ"
                >
                  {ASSISTANT_FACILITIES.map((facility) => {
                    const selected = selectedFacilities.includes(
                      facility.value,
                    );
                    return (
                      <button
                        key={facility.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleFacility(facility.value)}
                        className={`rounded-full border px-3 py-2 text-xs font-bold transition ${selected ? "border-violet bg-violet text-white" : "border-[#d9cbed] text-violet hover:border-violet"}`}
                      >
                        {facility.label}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => void requestZoneRecommendations()}
                  className="mt-3 w-full rounded-xl bg-violet px-4 py-3 text-sm font-bold text-white transition hover:bg-[#6d28d9]"
                >
                  วิเคราะห์บูธที่เหมาะกับร้านฉัน
                </button>
              </div>
            ) : null}

            {zoneStep === "result" && selectedEvent ? (
              <div className="mt-3 grid gap-2" aria-label="บูธที่ AI แนะนำ">
                {recommendations.map((recommendation, index) => {
                  const matched = findRecommendedBooth(
                    selectedMap,
                    recommendation.boothId,
                  );
                  return (
                    <Link
                      key={recommendation.boothId}
                      href={`/events/${selectedEvent.id}/map${matched ? `?zone=${encodeURIComponent(matched.zone.id)}` : ""}`}
                      className="rounded-xl border border-[#d9cbed] bg-white p-3 text-ink transition hover:border-violet hover:bg-[#faf7ff]"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <strong className="text-sm">
                          {index + 1}. บูธ {matched?.booth.code ?? "ที่แนะนำ"}
                          {matched ? ` · โซน ${matched.zone.code}` : ""}
                        </strong>
                        <small className="shrink-0 rounded-full bg-[#f1ebff] px-2 py-1 text-[10px] font-bold text-violet">
                          {recommendation.source === "AI_GEMINI"
                            ? "Gemini Flash"
                            : "Rule-based"}
                        </small>
                      </span>
                      <span className="mt-1.5 block text-xs leading-5 text-muted">
                        {recommendation.reason}
                      </span>
                      <span className="mt-2 block text-xs font-bold text-violet">
                        เปิดแผนผังและเลือกบูธ →
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : null}

            {zoneStep === "idle" &&
            auth.status !== "signed-in" &&
            isZoneRecommendationQuestion(question) ? (
              <Link
                href="/login"
                className="mt-3 inline-flex rounded-full bg-violet px-4 py-2 text-xs font-bold text-white"
              >
                เข้าสู่ระบบเพื่อรับคำแนะนำ
              </Link>
            ) : null}

            {zoneStep === "idle" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {quickQuestions.map((quickQuestion) => (
                  <button
                    key={quickQuestion}
                    type="button"
                    disabled={isAsking}
                    onClick={() => void askAssistant(quickQuestion)}
                    className="rounded-full border border-[#d9cbed] bg-[#faf7ff] px-3 py-2 text-xs font-bold text-violet transition hover:border-violet disabled:cursor-wait disabled:opacity-55"
                  >
                    {quickQuestion}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="shrink-0 border-t border-line bg-white p-2 sm:p-3">
            <div className="flex gap-2 rounded-[14px] border border-line bg-white p-2 focus-within:border-violet focus-within:ring-2 focus-within:ring-[#efe8ff]">
              <input
                value={question}
                disabled={isAsking}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void askAssistant();
                  }
                }}
                placeholder="พิมพ์คำถามเกี่ยวกับ SpaceLink"
                aria-label="พิมพ์คำถามให้ AI ช่วยคุณได้"
                className="min-w-0 flex-1 border-0 bg-transparent px-2 text-base outline-none placeholder:text-[#978ba5] disabled:cursor-wait"
              />
              <button
                type="button"
                disabled={isAsking || !question.trim()}
                onClick={() => void askAssistant()}
                aria-label="ส่งคำถามให้ AI"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-violet text-white shadow-[0_7px_16px_rgba(124,58,237,.24)] transition hover:bg-[#6d28d9] disabled:cursor-not-allowed disabled:opacity-55"
              >
                <Send className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <button
        type="button"
        aria-expanded={expanded}
        aria-label={
          expanded
            ? "ปิดเมนูช่วยเหลือ SpaceLink"
            : "เปิด AI ช่วยคุณได้และช่องทางติดต่อ SpaceLink"
        }
        title={expanded ? "ปิดเมนูช่วยเหลือ" : "AI ช่วยคุณได้ · ติดต่อเรา"}
        onClick={() =>
          setView((current) => (current === "closed" ? "menu" : "closed"))
        }
        className="ml-auto grid h-14 w-14 place-items-center rounded-[18px] bg-[linear-gradient(135deg,#8b5cf6,#6d28d9)] text-white shadow-[0_16px_36px_rgba(109,40,217,0.34)] transition hover:-translate-y-1 hover:shadow-[0_20px_42px_rgba(109,40,217,0.4)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#d9c8ff]"
      >
        {expanded ? (
          <X className="h-5 w-5" aria-hidden />
        ) : (
          <Sparkles className="h-5 w-5" aria-hidden />
        )}
      </button>
    </div>
  );
}

function isZoneRecommendationQuestion(question: string) {
  return /(แนะนำ|เลือก|หา).*(โซน|บูธ)|(โซน|บูธ).*(เหมาะ|แนะนำ|เลือก)/i.test(
    question,
  );
}

function assistantErrorMessage(cause: unknown, fallback: string) {
  if (
    cause instanceof Error &&
    cause.message.includes("NEXT_PUBLIC_SUPABASE")
  ) {
    return "การแนะนำจากข้อมูลร้านจริงต้องเปิดผ่านระบบที่เชื่อม Supabase และเข้าสู่ระบบด้วยบัญชีจริงครับ";
  }

  return cause instanceof Error ? cause.message : fallback;
}

function findRecommendedBooth(eventMap: EventMap | null, boothId: string) {
  for (const zone of eventMap?.zones ?? []) {
    const booth = zone.booths.find((candidate) => candidate.id === boothId);
    if (booth) return { booth, zone };
  }
  return null;
}

function UserFooter() {
  return (
    <footer
      className="border-t border-white/10 bg-[#211b2f] text-white"
      aria-label="ข้อมูลส่วนท้าย SpaceLink"
    >
      <div className="mx-auto max-w-[1180px] px-5 py-10 sm:px-7 lg:py-12">
        <div className="grid gap-9 sm:grid-cols-2 lg:grid-cols-[1.45fr_1fr_1fr_1fr] lg:gap-12">
          <section>
            <Link
              href="/"
              className="inline-flex items-center gap-3"
              aria-label="SpaceLink หน้าแรก"
            >
              <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-[linear-gradient(135deg,#9f7aea,#6d28d9)] text-sm font-black text-white shadow-[0_10px_25px_rgba(124,58,237,.25)]">
                SL
              </span>
              <strong className="text-lg font-black tracking-[-.02em]">
                SpaceLink
              </strong>
            </Link>
            <p className="mt-4 max-w-[320px] text-sm leading-6 text-white/70">
              แพลตฟอร์มค้นหางาน เลือกโซน จองบูธ
              และติดตามสถานะสำหรับผู้ขายและผู้จัดงานในที่เดียว
            </p>
          </section>

          <FooterColumn title="สำรวจแพลตฟอร์ม">
            <Link href="/">ค้นหา Event</Link>
            <Link href="/bookings">การจองของฉัน</Link>
            <Link href="/profile">โปรไฟล์ร้านค้า</Link>
          </FooterColumn>

          <FooterColumn title="บริการช่วยเหลือ">
            <Link href="/help">ศูนย์ช่วยเหลือ</Link>
            <Link href="/notifications">การแจ้งเตือน</Link>
            <Link href="/login">เข้าสู่ระบบ</Link>
          </FooterColumn>

          <FooterColumn title="ติดต่อ SpaceLink">
            <a href="tel:+6644224000">โทร 044-224-000</a>
            <span>LINE Official</span>
            <span>Facebook Page</span>
          </FooterColumn>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5 text-sm text-white/45">
          <span>© 2026 SpaceLink · Multi-tenant Event Space Platform</span>
          <div className="flex flex-wrap gap-x-2 gap-y-1">
            <span>ความเป็นส่วนตัว</span>
            <span>·</span>
            <span>เงื่อนไขการใช้งาน</span>
            <span>·</span>
            <span>การเข้าถึงสำหรับทุกคน</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function SignOutConfirmDialog({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    cancelRef.current?.focus();

    function handleDialogKeyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key !== "Tab") return;
      const focusableElements = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);
      if (!firstElement || !lastElement) return;

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleDialogKeyboard);
    return () => {
      document.removeEventListener("keydown", handleDialogKeyboard);
      const previousFocus = previousFocusRef.current;
      if (previousFocus?.isConnected && previousFocus !== document.body) {
        previousFocus.focus();
      } else {
        document
          .querySelector<HTMLElement>('[aria-label="เปิดเมนูโปรไฟล์"]')
          ?.focus();
      }
    };
  }, [onCancel, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-[rgba(24,16,38,.5)] p-5 backdrop-blur-[3px]">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="ปิดหน้าต่างยืนยันออกจากระบบ"
        onClick={onCancel}
      />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sign-out-dialog-title"
        aria-describedby="sign-out-dialog-description"
        className="relative w-full max-w-[390px] rounded-[24px] border border-[#e7def2] bg-white p-6 text-center shadow-[0_28px_80px_rgba(28,14,47,.3)]"
      >
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-[20px] bg-[#fff0ee] text-[#b42318]">
          <LogOut className="h-6 w-6" aria-hidden />
        </span>
        <h2 id="sign-out-dialog-title" className="mt-4 text-xl font-black text-ink">
          ยืนยันออกจากระบบไหม?
        </h2>
        <p
          id="sign-out-dialog-description"
          className="mx-auto mt-2 max-w-[30ch] text-sm leading-6 text-muted"
        >
          คุณจะต้องเข้าสู่ระบบด้วย Email OTP อีกครั้งเมื่อต้องการใช้งานบัญชี
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-xl border border-line bg-white px-4 text-sm font-extrabold text-[#655d70] transition hover:border-[#d4c7e7]"
          >
            อยู่ในระบบต่อ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-11 rounded-xl bg-[#b42318] px-4 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(180,35,24,.2)] transition hover:bg-[#951f16]"
          >
            ออกจากระบบ
          </button>
        </div>
      </section>
    </div>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-sm font-extrabold text-white">{title}</h2>
      <div className="mt-4 grid gap-3 text-sm text-white/58 [&_a]:transition [&_a:hover]:text-white">
        {children}
      </div>
    </section>
  );
}

function BottomNav({
  pathname,
  items,
  selectedOrganizationId,
  showUnreadNotificationDot,
}: {
  pathname: string;
  items: NavItem[];
  selectedOrganizationId: string;
  showUnreadNotificationDot: boolean;
}) {
  return (
    <nav className="sl-bottom-nav fixed inset-x-0 bottom-0 z-[35] flex items-stretch justify-start overflow-x-auto overscroll-x-contain border-t border-[#e9e3f2] bg-white/95 px-[5px] pt-1.5 shadow-[0_-10px_30px_rgba(54,36,91,0.06)] backdrop-blur-xl lg:hidden">
      {items.map((item) => {
        const Icon = item.icon;

        if (item.kind === "soon") {
          return (
            <button
              key={item.label}
              type="button"
              disabled
              className="grid min-w-[72px] flex-1 cursor-not-allowed place-items-center gap-0.5 px-1 text-sm text-[#BDB6C6]"
            >
              <Icon className="h-[19px] w-[19px]" strokeWidth={2} />
              <span className="whitespace-nowrap leading-6">{item.label}</span>
            </button>
          );
        }

        const active = item.matches(pathname);

        return (
          <Link
            key={item.label}
            href={navItemHref(item, selectedOrganizationId)}
            aria-current={active ? "page" : undefined}
            className={`relative grid min-w-[72px] flex-1 place-items-center gap-0.5 rounded-xl px-1 text-sm transition-colors ${
              active
                ? "bg-violet-tint font-extrabold text-[#6D28D9]"
                : "text-[#837B8D]"
            }`}
          >
            <Icon className="h-[19px] w-[19px]" strokeWidth={2} />
            {item.href === "/notifications" && showUnreadNotificationDot ? (
              <span
                aria-label="มีการแจ้งเตือนใหม่"
                className="absolute left-[calc(50%+7px)] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#ef4444]"
              />
            ) : null}
            <span className="whitespace-nowrap leading-6">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function navItemHref(
  item: Extract<NavItem, { kind: "link" }>,
  organizationId: string,
) {
  if (!organizationId || !item.href.startsWith("/admin")) {
    return item.href;
  }

  return `${item.href}?${new URLSearchParams({ organization: organizationId }).toString()}`;
}

function BrandMark() {
  return (
    <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#9F7AEA] to-[#6D28D9] text-white shadow-[0_8px_18px_#7C3AED42]">
      <Orbit className="h-[19px] w-[19px]" strokeWidth={2} />
    </span>
  );
}

function Avatar({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#C4B5FD] to-[#6D28D9] font-bold text-white ${className}`}
    >
      {[...name.trim()][0] ?? "?"}
    </span>
  );
}
