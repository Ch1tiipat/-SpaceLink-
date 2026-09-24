'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  CircleAlert,
  Clock3,
  CreditCard,
  ListChecks,
  Megaphone,
  Settings2,
  ShieldAlert,
  Sparkles,
  Star,
  X,
} from 'lucide-react';

import {
  getNotificationPreferences,
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
  type NotificationPreferences,
  type NotificationRecord,
  type NotificationType,
  type UserRole,
} from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { refundNotificationHref } from '@/lib/refund-notification-route';
import { useAuthState } from '@/lib/use-auth-state';
import { canUseUxPreview, UX_PREVIEW_TOKEN } from '@/lib/ux-preview';
import {
  createWebPushPreviewNotification,
  isWebPushPreviewNotificationId,
  prependWebPushPreview,
  type WebPushPreviewNotification,
} from '@/lib/web-push-preview';

type NotificationKind =
  | 'news'
  | 'booking'
  | 'penalty'
  | 'payment'
  | 'request'
  | 'system';
type NotificationFilter =
  | 'all'
  | 'unread'
  | 'booking'
  | 'payment'
  | 'news'
  | 'request';

const NOTIFICATION_PREFERENCE_TYPES = [
  'BOOKING_STATUS',
  'PAYMENT',
  'ANNOUNCEMENT',
  'PENALTY',
  'REFUND',
  'SUPPORT_TICKET',
  'SYSTEM',
] as const satisfies readonly NotificationType[];

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences =
  Object.fromEntries(
    NOTIFICATION_PREFERENCE_TYPES.map((type) => [type, true]),
  ) as NotificationPreferences;

type UserNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  description: string;
  createdAt: string;
  unread: boolean;
  href?: string;
  actionLabel?: string;
};

type NotificationAccess =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'ready'; token: string }
  | { status: 'error'; message: string };

const KIND_BY_TYPE: Record<NotificationType, NotificationKind> = {
  ANNOUNCEMENT: 'news',
  BOOKING_STATUS: 'booking',
  SUPPORT_TICKET: 'request',
  PENALTY: 'penalty',
  PAYMENT: 'payment',
  REFUND: 'request',
  SYSTEM: 'system',
};

const KIND_META = {
  news: {
    label: 'ข่าวสาร',
    icon: Megaphone,
    tone: 'bg-[#fff5e9] text-[#b35c00]',
  },
  booking: {
    label: 'การจอง',
    icon: CalendarDays,
    tone: 'bg-[#f0eaff] text-[#6d28d9]',
  },
  penalty: {
    label: 'แต้มโทษ',
    icon: ShieldAlert,
    tone: 'bg-[#fff0f0] text-[#b42318]',
  },
  payment: {
    label: 'การชำระเงิน',
    icon: CreditCard,
    tone: 'bg-[#edf6ff] text-[#1d67a8]',
  },
  request: {
    label: 'คำขอ',
    icon: ListChecks,
    tone: 'bg-[#f4efff] text-[#6d28d9]',
  },
  system: {
    label: 'แนะนำสำหรับคุณ',
    icon: Sparkles,
    tone: 'bg-[#ebfaf3] text-[#13795b]',
  },
} satisfies Record<
  NotificationKind,
  { label: string; icon: typeof Bell; tone: string }
>;

const FILTER_OPTIONS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'unread', label: 'ยังไม่ได้อ่าน' },
  { value: 'booking', label: 'การจอง' },
  { value: 'payment', label: 'การชำระเงิน' },
  { value: 'news', label: 'ข่าวสาร' },
  { value: 'request', label: 'คำขอ' },
] as const satisfies ReadonlyArray<{
  value: NotificationFilter;
  label: string;
}>;

const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat('th', {
  numeric: 'auto',
});
const THAILAND_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  dateStyle: 'medium',
  timeStyle: 'short',
});

function toUserNotification(
  notification: NotificationRecord,
  role?: UserRole,
): UserNotification {
  const isReviewInvitation =
    notification.relatedEntityType?.toUpperCase() === 'BOOKING_REVIEW';
  const href = notificationHref(notification, role);
  return {
    id: notification.id,
    kind: KIND_BY_TYPE[notification.type],
    title: notification.title,
    description: notification.body ?? '',
    createdAt: notification.createdAt,
    unread: !notification.isRead,
    href,
    actionLabel: isReviewInvitation
      ? 'เขียนรีวิว'
      : notificationActionLabel(notification.type, Boolean(href)),
  };
}

function notificationActionLabel(
  type: NotificationType,
  hasHref: boolean,
): string | undefined {
  if (!hasHref) return undefined;
  switch (type) {
    case 'BOOKING_STATUS':
      return 'ดูการจอง';
    case 'PAYMENT':
      return 'ดูการชำระเงิน';
    case 'ANNOUNCEMENT':
      return 'ดูข่าวสาร';
    case 'REFUND':
    case 'SUPPORT_TICKET':
      return 'ติดตามคำขอ';
    case 'SYSTEM':
      return 'ดูรายละเอียด';
    case 'PENALTY':
      return undefined;
  }
}

function notificationHref(
  notification: NotificationRecord,
  role?: UserRole,
): string | undefined {
  const refundHref = refundNotificationHref(
    notification.relatedEntityType,
    notification.relatedEntityId,
  );
  if (refundHref) return refundHref;

  if (notification.relatedEntityType?.toUpperCase() === 'BOOKING_REVIEW') {
    return notification.relatedEntityId
      ? `/bookings/${encodeURIComponent(notification.relatedEntityId)}/review`
      : '/bookings?tab=completed';
  }

  const relatedBookingId =
    notification.relatedEntityType?.toUpperCase() === 'BOOKING'
      ? notification.relatedEntityId
      : null;

  if (role === 'ORG_ADMIN') {
    switch (notification.type) {
      case 'PAYMENT':
      case 'REFUND':
        return '/admin/payments';
      case 'BOOKING_STATUS':
        return '/admin/bookings';
    }
  }

  switch (notification.type) {
    case 'ANNOUNCEMENT':
    case 'SYSTEM':
      return '/';
    case 'REFUND':
    case 'BOOKING_STATUS':
      return relatedBookingId
        ? `/bookings/${encodeURIComponent(relatedBookingId)}`
        : '/bookings';
    case 'PAYMENT':
      return relatedBookingId
        ? `/bookings/${encodeURIComponent(relatedBookingId)}/payment`
        : '/bookings?tab=pending';
    case 'SUPPORT_TICKET':
      return '/support';
    case 'PENALTY':
      return undefined;
  }
}

function formatRelativeTime(createdAt: string): string {
  const timestamp = new Date(createdAt).getTime();
  if (!Number.isFinite(timestamp)) return '';

  const difference = timestamp - Date.now();
  const absolute = Math.abs(difference);
  if (absolute < 60_000) return 'เมื่อสักครู่';
  if (absolute < 3_600_000) {
    return RELATIVE_TIME_FORMATTER.format(
      Math.round(difference / 60_000),
      'minute',
    );
  }
  if (absolute < 86_400_000) {
    return RELATIVE_TIME_FORMATTER.format(
      Math.round(difference / 3_600_000),
      'hour',
    );
  }
  if (absolute < 604_800_000) {
    return RELATIVE_TIME_FORMATTER.format(
      Math.round(difference / 86_400_000),
      'day',
    );
  }
  return THAILAND_DATE_TIME_FORMATTER.format(timestamp);
}

function describeError(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

function createPreviewNotifications(): UserNotification[] {
  const now = Date.now();
  return [
    {
      id: 'preview-payment',
      kind: 'payment',
      title: 'การจองกำลังรอชำระเงิน',
      description: 'อัปโหลดสลิปสำหรับบูธ A01 ภายในเวลาที่กำหนด',
      createdAt: new Date(now - 8 * 60_000).toISOString(),
      unread: true,
      href: '/bookings/local-preview-booking/payment',
      actionLabel: 'ดูการชำระเงิน',
    },
    {
      id: 'preview-confirmed',
      kind: 'booking',
      title: 'ยืนยันการจองเรียบร้อยแล้ว',
      description: 'บูธ A01 ในงานเกษตร มทส. 2569 พร้อมสำหรับร้านของคุณ',
      createdAt: new Date(now - 65 * 60_000).toISOString(),
      unread: true,
      href: '/bookings/local-preview-confirmed-booking',
      actionLabel: 'ดูการจอง',
    },
    {
      id: 'preview-event',
      kind: 'news',
      title: 'ประกาศจากผู้จัดงาน',
      description: 'ตรวจสอบเวลาเข้าพื้นที่และกฎร้านค้าก่อนวันเริ่มงาน',
      createdAt: new Date(now - 5 * 3_600_000).toISOString(),
      unread: false,
      href: '/events/demo-event',
      actionLabel: 'ดูข่าวสาร',
    },
    {
      id: 'preview-request',
      kind: 'request',
      title: 'คำขอคืนเงินอยู่ระหว่างตรวจสอบ',
      description: 'ทีมงานรับคำขอ RF-DEMO-001 แล้วและกำลังตรวจสอบข้อมูล',
      createdAt: new Date(now - 26 * 3_600_000).toISOString(),
      unread: false,
      href: '/refunds?requestId=RF-DEMO-001',
      actionLabel: 'ติดตามคำขอ',
    },
    {
      id: 'preview-review',
      kind: 'system',
      title: 'แชร์ประสบการณ์พื้นที่ของคุณ',
      description: 'รายการเสร็จสิ้นแล้ว คุณสามารถรีวิวบูธและพื้นที่ได้',
      createdAt: new Date(now - 2 * 86_400_000).toISOString(),
      unread: false,
      href: '/bookings/local-preview-completed-booking/review',
      actionLabel: 'เขียนรีวิว',
    },
  ];
}

export default function NotificationsPage() {
  const { auth } = useAuthState();
  const signedInRole = auth.status === 'signed-in' ? auth.role : undefined;
  const [access, setAccess] = useState<NotificationAccess>({
    status: 'loading',
  });
  const [reloadVersion, setReloadVersion] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES,
  );
  const [savingPreference, setSavingPreference] = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [webPushPreview, setWebPushPreview] =
    useState<WebPushPreviewNotification | null>(null);
  const [webPushDetails, setWebPushDetails] =
    useState<WebPushPreviewNotification | null>(null);
  const webPushSequenceRef = useRef(0);

  useEffect(() => {
    if (!toastMessage) return;
    const timeout = window.setTimeout(() => setToastMessage(null), 3_500);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  useEffect(() => {
    if (!webPushPreview && !webPushDetails) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (webPushDetails) setWebPushDetails(null);
      else setWebPushPreview(null);
    }

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [webPushDetails, webPushPreview]);

  useEffect(() => {
    if (auth.status === 'loading') {
      setAccess({ status: 'loading' });
      return;
    }
    if (auth.status === 'signed-out') {
      setNotifications([]);
      setPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
      setAccess({ status: 'signed-out' });
      return;
    }

    if (canUseUxPreview()) {
      setNotifications(createPreviewNotifications());
      setPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
      setAccess({ status: 'ready', token: UX_PREVIEW_TOKEN });
      setActionError(null);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setAccess({ status: 'loading' });
    setActionError(null);

    void (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          if (active) {
            setNotifications([]);
            setAccess({ status: 'signed-out' });
          }
          return;
        }

        const [rows, savedPreferences] = await Promise.all([
          getMyNotifications(token, controller.signal),
          getNotificationPreferences(token, controller.signal),
        ]);
        if (!active) return;
        setNotifications(
          rows.map((notification) =>
            toUserNotification(notification, signedInRole),
          ),
        );
        setPreferences(savedPreferences);
        setAccess({ status: 'ready', token });
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError')
          return;
        if (active) {
          setNotifications([]);
          setAccess({
            status: 'error',
            message: describeError(
              cause,
              'โหลดการแจ้งเตือนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
            ),
          });
        }
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [auth.status, reloadVersion, signedInRole]);

  useEffect(() => {
    if (access.status !== 'ready' || access.token === UX_PREVIEW_TOKEN) return;

    const token = access.token;
    let active = true;
    let controller: AbortController | null = null;

    async function refreshNotifications() {
      controller?.abort();
      controller = new AbortController();
      try {
        const rows = await getMyNotifications(token, controller.signal);
        if (active) {
          setNotifications(
            rows.map((notification) =>
              toUserNotification(notification, signedInRole),
            ),
          );
        }
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError')
          return;
      }
    }

    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshNotifications();
    }, 30_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshNotifications();
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
  }, [access, signedInRole]);

  const visibleNotifications = useMemo(() => {
    if (filter === 'unread') {
      return notifications.filter((notification) => notification.unread);
    }
    if (filter !== 'all') {
      return notifications.filter(
        (notification) => notification.kind === filter,
      );
    }
    return notifications;
  }, [filter, notifications]);
  const unreadCount = notifications.filter(
    (notification) => notification.unread,
  ).length;
  const notificationCounts = useMemo<Record<NotificationFilter, number>>(
    () => ({
      all: notifications.length,
      unread: unreadCount,
      booking: notifications.filter(
        (notification) => notification.kind === 'booking',
      ).length,
      payment: notifications.filter(
        (notification) => notification.kind === 'payment',
      ).length,
      news: notifications.filter(
        (notification) => notification.kind === 'news',
      ).length,
      request: notifications.filter(
        (notification) => notification.kind === 'request',
      ).length,
    }),
    [notifications, unreadCount],
  );

  async function markAllAsRead() {
    if (access.status !== 'ready' || unreadCount === 0) return;
    const previous = notifications;
    setActionError(null);
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, unread: false })),
    );

    if (access.token === UX_PREVIEW_TOKEN) return;

    try {
      await markAllNotificationsRead(access.token);
    } catch (cause) {
      setNotifications(previous);
      const message = describeError(
        cause,
        'ทำเครื่องหมายอ่านทั้งหมดไม่สำเร็จ',
      );
      setActionError(message);
      setToastMessage(message);
    }
  }

  async function markAsRead(id: string) {
    if (access.status !== 'ready') return;
    const target = notifications.find((notification) => notification.id === id);
    if (!target?.unread) return;
    setActionError(null);
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id
          ? { ...notification, unread: false }
          : notification,
      ),
    );

    if (
      access.token === UX_PREVIEW_TOKEN ||
      isWebPushPreviewNotificationId(id)
    ) {
      return;
    }

    try {
      await markNotificationRead(id, access.token);
    } catch (cause) {
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === id
            ? { ...notification, unread: true }
            : notification,
        ),
      );
      const message = describeError(
        cause,
        'ทำเครื่องหมายว่าอ่านแล้วไม่สำเร็จ',
      );
      setActionError(message);
      setToastMessage(message);
    }
  }

  async function togglePreference(key: NotificationType | 'all') {
    if (access.status !== 'ready' || savingPreference) return;

    const previous = preferences;
    const patch =
      key === 'all'
        ? (Object.fromEntries(
            NOTIFICATION_PREFERENCE_TYPES.map((type) => [
              type,
              !NOTIFICATION_PREFERENCE_TYPES.every(
                (preferenceType) => previous[preferenceType],
              ),
            ]),
          ) as NotificationPreferences)
        : { [key]: !previous[key] };
    const optimistic = { ...previous, ...patch };
    setActionError(null);
    setSavingPreference(true);
    setPreferences(optimistic);

    if (access.token === UX_PREVIEW_TOKEN) {
      setSavingPreference(false);
      setToastMessage('บันทึกการตั้งค่าการแจ้งเตือนแล้ว');
      return;
    }

    try {
      const saved = await updateNotificationPreferences(patch, access.token);
      setPreferences(saved);
      setToastMessage('บันทึกการตั้งค่าการแจ้งเตือนแล้ว');
    } catch (cause) {
      setPreferences(previous);
      const message = describeError(
        cause,
        'บันทึกการตั้งค่าการแจ้งเตือนไม่สำเร็จ',
      );
      setActionError(message);
      setToastMessage(message);
    } finally {
      setSavingPreference(false);
    }
  }

  function simulateWebPush() {
    webPushSequenceRef.current += 1;
    const preview = createWebPushPreviewNotification(
      webPushSequenceRef.current,
    );
    const notification: UserNotification = {
      ...preview,
      kind: 'news',
      unread: true,
      actionLabel: 'ดูรายละเอียด',
    };

    setNotifications((current) =>
      prependWebPushPreview(current, notification),
    );
    setWebPushDetails(null);
    setWebPushPreview(preview);
    setToastMessage('เพิ่ม Web Push ใหม่ใน Notification Center แล้ว');
  }

  return (
    <main className="sl-page pb-16">
      <div className="sl-page-shell">
        <header className="sl-page-header">
          <div>
            <span className="sl-kicker">
              <Bell className="h-4 w-4" aria-hidden />
              Notification Center
            </span>
            <h1 className="sl-page-title">การแจ้งเตือน</h1>
            <p className="sl-page-subtitle">
              ติดตามข่าวงาน สถานะการจอง และขั้นตอนสำคัญของร้านคุณในที่เดียว
            </p>
          </div>

          {access.status === 'ready' ? (
            <div className="flex flex-wrap items-center gap-2">
              {access.token === UX_PREVIEW_TOKEN ? (
                <button
                  type="button"
                  onClick={simulateWebPush}
                  className="sl-action-secondary"
                >
                  <Megaphone className="h-4 w-4" aria-hidden />
                  จำลอง Web Push
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setSettingsOpen((current) => !current)}
                aria-expanded={settingsOpen}
                aria-controls="notification-settings-panel"
                className="sl-action-secondary"
              >
                <Settings2 className="h-4 w-4" aria-hidden />
                ตั้งค่าการแจ้งเตือน
              </button>
              <button
                type="button"
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
                className="sl-action-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCheck className="h-4 w-4" aria-hidden />
                อ่านทั้งหมด
              </button>
            </div>
          ) : null}
        </header>

        {auth.status === 'loading' || access.status === 'loading' ? (
          <NotificationSkeleton />
        ) : auth.status === 'signed-out' || access.status === 'signed-out' ? (
          <SignedOutState />
        ) : access.status === 'error' ? (
          <NotificationErrorState
            message={access.message}
            onRetry={() => setReloadVersion((current) => current + 1)}
          />
        ) : (
          <>
            {settingsOpen ? (
              <NotificationSettings
                preferences={preferences}
                onToggle={togglePreference}
                onClose={() => setSettingsOpen(false)}
                saving={savingPreference}
              />
            ) : null}

            {actionError ? (
              <p
                role="alert"
                className="mb-4 rounded-2xl border border-[#fecaca] bg-[#fff7f7] px-4 py-3 text-sm font-semibold text-[#b42318]"
              >
                {actionError}
              </p>
            ) : null}

            <NotificationSummary
              unread={unreadCount}
              booking={notificationCounts.booking}
              payment={notificationCounts.payment}
              news={notificationCounts.news}
              onFilter={setFilter}
            />

            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <section className="min-w-0">
                <div
                  className="mb-4 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0"
                  aria-label="กรองการแจ้งเตือน"
                >
                  {FILTER_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilter(value)}
                      aria-pressed={filter === value}
                      className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-extrabold transition ${
                        filter === value
                          ? 'border-violet bg-violet text-white shadow-[0_8px_20px_rgba(124,58,237,.2)]'
                          : 'border-line bg-white text-muted hover:border-[#cfc1ef] hover:text-violet'
                      }`}
                    >
                      {label} ({notificationCounts[value]})
                    </button>
                  ))}
                </div>

                <div className="sl-surface overflow-hidden">
                  <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
                    <div>
                      <h2 className="text-base font-extrabold text-ink">
                        รายการแจ้งเตือน
                      </h2>
                      <span
                        role="status"
                        aria-live="polite"
                        className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-muted"
                      >
                        <Clock3 className="h-3.5 w-3.5" aria-hidden />
                        {visibleNotifications.length} รายการ · ล่าสุดก่อน
                      </span>
                    </div>
                  </div>

                  {visibleNotifications.length > 0 ? (
                    <div className="divide-y divide-[#f0edf4]">
                      {visibleNotifications.map((notification) => (
                        <NotificationRow
                          key={notification.id}
                          notification={notification}
                          onRead={() => markAsRead(notification.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="px-6 py-16 text-center">
                      <span className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-violet-tint text-violet">
                        <CheckCheck className="h-7 w-7" aria-hidden />
                      </span>
                      <h2 className="mt-5 text-xl font-extrabold">
                        {notifications.length === 0
                          ? 'ยังไม่มีการแจ้งเตือน'
                          : 'ไม่มีรายการในหมวดนี้'}
                      </h2>
                      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
                        เมื่อมีข่าวงานหรือสถานะการจองใหม่ รายการจะแสดงที่หน้านี้
                      </p>
                    </div>
                  )}
                </div>
              </section>

              <NotificationSidebar
                bookingCount={notificationCounts.booking}
                paymentCount={notificationCounts.payment}
                reviewCount={notifications.filter(
                  (notification) => notification.actionLabel === 'เขียนรีวิว',
                ).length}
                onOpenSettings={() => setSettingsOpen(true)}
              />
            </div>
          </>
        )}
        {toastMessage ? (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-24 right-4 z-50 max-w-[calc(100vw-2rem)] rounded-2xl bg-[#241638] px-4 py-3 text-sm font-bold text-white shadow-[0_18px_45px_rgba(31,18,49,.28)] sm:right-6"
          >
            {toastMessage}
          </div>
        ) : null}
      </div>
      {webPushPreview ? (
        <WebPushFloatingCard
          notification={webPushPreview}
          onClose={() => setWebPushPreview(null)}
          onOpenDetails={() => {
            setWebPushDetails(webPushPreview);
            setWebPushPreview(null);
          }}
        />
      ) : null}
      {webPushDetails ? (
        <WebPushDetailsDialog
          notification={webPushDetails}
          onClose={() => setWebPushDetails(null)}
        />
      ) : null}
    </main>
  );
}

function WebPushFloatingCard({
  notification,
  onClose,
  onOpenDetails,
}: {
  notification: WebPushPreviewNotification;
  onClose: () => void;
  onOpenDetails: () => void;
}) {
  return (
    <aside
      role="status"
      aria-label="Web Push จาก SpaceLink"
      className="fixed right-3 top-[75px] z-[70] w-[calc(100vw-24px)] max-w-[410px] rounded-[24px] border border-[#ded2f3] bg-white p-5 shadow-[0_24px_70px_rgba(44,25,77,.24)] sm:right-6 sm:top-[84px] sm:p-6"
    >
      <div className="flex items-start gap-3.5">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#eee5ff] text-violet">
          <Megaphone className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 pr-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#f2ebff] px-2.5 py-1 text-[11px] font-extrabold text-violet">
              ประกาศสำคัญ
            </span>
            <time
              dateTime={notification.createdAt}
              className="text-xs font-semibold text-muted"
            >
              เมื่อสักครู่
            </time>
          </div>
          <h2 className="mt-3 text-lg font-black text-ink">
            {notification.title}
          </h2>
          <p className="mt-1 line-clamp-3 text-sm leading-6 text-muted">
            {notification.description}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิด Web Push"
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-violet-tint hover:text-violet"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="mt-5 grid gap-2 min-[390px]:grid-cols-2">
        <button
          type="button"
          onClick={onOpenDetails}
          className="sl-action-primary w-full"
        >
          ดูรายละเอียด
        </button>
        <button
          type="button"
          onClick={onClose}
          className="sl-action-secondary w-full"
        >
          ปิด
        </button>
      </div>
    </aside>
  );
}

function WebPushDetailsDialog({
  notification,
  onClose,
}: {
  notification: WebPushPreviewNotification;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-[#1b1030]/60 p-4 backdrop-blur-[2px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="web-push-details-title"
        className="w-full max-w-[560px] rounded-[26px] border border-[#ded2f3] bg-white p-6 shadow-[0_30px_100px_rgba(28,15,58,.28)] sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <span className="rounded-full bg-violet-tint px-3 py-1 text-xs font-bold text-violet">
            ประกาศสำคัญ
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดรายละเอียดประกาศ"
            className="grid h-9 w-9 place-items-center rounded-full border border-line text-muted transition hover:text-violet"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <h2
          id="web-push-details-title"
          className="mt-5 text-2xl font-black leading-snug text-ink"
        >
          {notification.title}
        </h2>
        <p className="mt-2 text-sm font-semibold text-muted">เมื่อสักครู่</p>
        <p className="mt-6 text-sm leading-7 text-[#514664]">
          {notification.description}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="sl-action-primary mt-7 w-full sm:w-auto"
        >
          รับทราบ
        </button>
      </section>
    </div>
  );
}

function NotificationSummary({
  unread,
  booking,
  payment,
  news,
  onFilter,
}: {
  unread: number;
  booking: number;
  payment: number;
  news: number;
  onFilter: (filter: NotificationFilter) => void;
}) {
  const cards: Array<{
    label: string;
    value: number;
    filter: NotificationFilter;
    icon: typeof Bell;
    tone: string;
  }> = [
    {
      label: 'ยังไม่อ่าน',
      value: unread,
      filter: 'unread',
      icon: Bell,
      tone: 'bg-[#f1eaff] text-violet',
    },
    {
      label: 'การจอง',
      value: booking,
      filter: 'booking',
      icon: CalendarDays,
      tone: 'bg-[#eef5ff] text-[#2563c9]',
    },
    {
      label: 'การชำระเงิน',
      value: payment,
      filter: 'payment',
      icon: CreditCard,
      tone: 'bg-[#fff3df] text-[#c56b00]',
    },
    {
      label: 'ข่าวสาร',
      value: news,
      filter: 'news',
      icon: Megaphone,
      tone: 'bg-[#e8f8f0] text-[#16855f]',
    },
  ];

  return (
    <section
      className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      aria-label="สรุปการแจ้งเตือน"
    >
      {cards.map(({ label, value, filter, icon: Icon, tone }) => (
        <button
          key={filter}
          type="button"
          onClick={() => onFilter(filter)}
          className="sl-surface group flex min-h-[112px] items-center gap-4 px-5 py-5 text-left transition hover:-translate-y-0.5 hover:border-[#d9cdf5] hover:shadow-[0_18px_36px_rgba(71,42,116,.1)]"
        >
          <span
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${tone}`}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-muted">
              {label}
            </span>
            <strong className="mt-1 block text-3xl font-black leading-none text-ink transition group-hover:text-violet">
              {value.toLocaleString('th-TH')}
            </strong>
          </span>
        </button>
      ))}
    </section>
  );
}

function NotificationSidebar({
  bookingCount,
  paymentCount,
  reviewCount,
  onOpenSettings,
}: {
  bookingCount: number;
  paymentCount: number;
  reviewCount: number;
  onOpenSettings: () => void;
}) {
  const tasks = [
    {
      label: 'ตรวจสอบการชำระเงิน',
      detail: `${paymentCount.toLocaleString('th-TH')} รายการแจ้งเตือน`,
      href: '/bookings?tab=pending',
      icon: CreditCard,
      tone: 'bg-[#fff3df] text-[#c56b00]',
    },
    {
      label: 'ติดตามสถานะการจอง',
      detail: `${bookingCount.toLocaleString('th-TH')} รายการแจ้งเตือน`,
      href: '/bookings',
      icon: CalendarDays,
      tone: 'bg-[#eef5ff] text-[#2563c9]',
    },
    {
      label: 'รีวิวที่ยังไม่ได้เขียน',
      detail: `${reviewCount.toLocaleString('th-TH')} รายการ`,
      href: '/reviews',
      icon: Star,
      tone: 'bg-[#e8f8f0] text-[#16855f]',
    },
  ];

  return (
    <aside className="grid gap-4 xl:sticky xl:top-24">
      <section className="sl-surface overflow-hidden p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-violet-tint text-violet">
            <ListChecks className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-ink">ต้องทำวันนี้</h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              ทางลัดไปยังรายการที่ควรติดตาม
            </p>
          </div>
        </div>

        <div className="mt-5 divide-y divide-line">
          {tasks.map(({ label, detail, href, icon: Icon, tone }) => (
            <Link
              key={label}
              href={href}
              className="group flex items-center gap-3 py-4 first:pt-0 last:pb-0"
            >
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${tone}`}
              >
                <Icon className="h-4.5 w-4.5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-sm text-ink">{label}</strong>
                <small className="mt-0.5 block text-xs text-muted">
                  {detail}
                </small>
              </span>
              <ArrowRight
                className="h-4 w-4 shrink-0 text-[#a89db6] transition group-hover:translate-x-0.5 group-hover:text-violet"
                aria-hidden
              />
            </Link>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-[24px] border border-[#dfd2ff] bg-[linear-gradient(145deg,#fbf8ff_0%,#f1e8ff_100%)] p-5 sm:p-6">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-violet shadow-sm">
          <Settings2 className="h-5 w-5" aria-hidden />
        </span>
        <h2 className="mt-4 text-lg font-extrabold text-ink">
          ควบคุมข่าวสารที่ได้รับ
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          เลือกเปิด–ปิดการแจ้งเตือน 7 หมวดให้เหมาะกับการใช้งานของคุณ
        </p>
        <button
          type="button"
          onClick={onOpenSettings}
          className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-extrabold text-violet shadow-sm transition hover:-translate-y-0.5"
        >
          ตั้งค่าการแจ้งเตือน
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </section>
    </aside>
  );
}

function NotificationErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className="sl-surface px-6 py-16 text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-[#fff0f0] text-[#b42318]">
        <CircleAlert className="h-7 w-7" aria-hidden />
      </span>
      <h2 className="mt-5 text-xl font-extrabold">โหลดการแจ้งเตือนไม่สำเร็จ</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="sl-action-primary mt-6"
      >
        ลองใหม่อีกครั้ง
      </button>
    </section>
  );
}

function NotificationSettings({
  preferences,
  onToggle,
  onClose,
  saving,
}: {
  preferences: NotificationPreferences;
  onToggle: (key: NotificationType | 'all') => void;
  onClose: () => void;
  saving: boolean;
}) {
  const options: {
    key: NotificationType;
    title: string;
    description: string;
    icon: typeof Bell;
  }[] = [
    {
      key: 'BOOKING_STATUS',
      title: 'สถานะการจอง',
      description: 'แจ้งเมื่อยืนยัน ยกเลิก หรือมีการเปลี่ยนแปลงบูธ',
      icon: CalendarDays,
    },
    {
      key: 'PAYMENT',
      title: 'การชำระเงิน',
      description: 'เตือนเวลาชำระ ยืนยันสลิป และผลการตรวจสอบ',
      icon: CreditCard,
    },
    {
      key: 'ANNOUNCEMENT',
      title: 'ข่าวสารและประกาศงาน',
      description: 'ประกาศจากผู้จัดงานและงานใหม่ที่เปิดรับร้านค้า',
      icon: Megaphone,
    },
    {
      key: 'PENALTY',
      title: 'แต้มโทษ',
      description: 'แจ้งเมื่อได้รับแต้มโทษและรายละเอียดเวลาที่ออกแต้ม',
      icon: ShieldAlert,
    },
    {
      key: 'REFUND',
      title: 'การคืนเงิน',
      description: 'แจ้งสถานะคำร้องและผลการคืนเงิน',
      icon: CreditCard,
    },
    {
      key: 'SUPPORT_TICKET',
      title: 'การติดต่อฝ่ายสนับสนุน',
      description: 'แจ้งความคืบหน้าของคำร้องและข้อความตอบกลับ',
      icon: Bell,
    },
    {
      key: 'SYSTEM',
      title: 'ระบบและคำแนะนำ',
      description: 'ข้อความสำคัญจากระบบและคำแนะนำสำหรับร้านของคุณ',
      icon: Sparkles,
    },
  ];
  const allEnabled = NOTIFICATION_PREFERENCE_TYPES.every(
    (type) => preferences[type],
  );
  const someEnabled = NOTIFICATION_PREFERENCE_TYPES.some(
    (type) => preferences[type],
  );

  return (
    <section
      id="notification-settings-panel"
      className="sl-surface mb-5 overflow-hidden"
      aria-label="ตั้งค่าการแจ้งเตือน"
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-5 sm:px-7">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-tint text-violet">
            <Settings2 className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-extrabold">ตั้งค่าการแจ้งเตือน</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              เลือกหมวดที่ต้องการรับการแจ้งเตือนภายใน SpaceLink
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิดการตั้งค่าการแจ้งเตือน"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-white text-muted transition hover:border-[#d4c5f5] hover:text-violet"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="flex items-center justify-between gap-4 border-b border-line bg-[#fbf9ff] px-5 py-4 sm:px-7">
        <div>
          <p className="text-sm font-extrabold text-ink">
            เปิดการแจ้งเตือนทั้งหมด
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {allEnabled
              ? 'เปิดครบทั้ง 7 หมวด'
              : someEnabled
                ? 'เปิดบางหมวด'
                : 'ปิดทุกหมวด'}
          </p>
        </div>
        <ToggleSwitch
          checked={allEnabled}
          onClick={() => void onToggle('all')}
          label="เปิดการแจ้งเตือนทั้งหมด"
          disabled={saving}
        />
      </div>

      <div className="grid divide-y divide-line px-5 sm:px-7 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        {options.map(({ key, title, description, icon: Icon }, index) => (
          <div
            key={key}
            className={`flex items-center gap-4 py-4 ${
              index % 2 === 0 ? 'lg:pr-7' : 'lg:pl-7'
            }`}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-violet-tint text-violet">
              <Icon className="h-4.5 w-4.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold">{title}</p>
              <p className="mt-0.5 text-xs leading-5 text-muted">
                {description}
              </p>
            </div>
            <ToggleSwitch
              checked={preferences[key]}
              onClick={() => void onToggle(key)}
              label={title}
              compact
              disabled={saving}
            />
          </div>
        ))}
      </div>

      <p className="border-t border-line bg-[#fbf9ff] px-5 py-3 text-xs leading-5 text-muted sm:px-7">
        การตั้งค่านี้ใช้กับการแจ้งเตือนในระบบเท่านั้น ไม่มีตัวเลือก Email
        หรือ LINE ในรอบนี้
      </p>
    </section>
  );
}

function ToggleSwitch({
  checked,
  onClick,
  label,
  compact = false,
  disabled = false,
}: {
  checked: boolean;
  onClick?: () => void;
  label: string;
  compact?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`relative shrink-0 rounded-full transition ${
        compact ? 'h-7 w-12' : 'h-9 w-[58px]'
      } ${checked ? 'bg-violet' : 'bg-[#d9d4df]'} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <span
        className={`absolute top-1 rounded-full bg-white shadow transition-transform ${
          compact ? 'h-5 w-5' : 'h-7 w-7'
        } ${checked ? (compact ? 'translate-x-6' : 'translate-x-7') : 'translate-x-1'}`}
      />
    </button>
  );
}

function NotificationRow({
  notification,
  onRead,
}: {
  notification: UserNotification;
  onRead: () => void;
}) {
  const meta = KIND_META[notification.kind];
  const Icon = meta.icon;

  return (
    <article
      className={`relative grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-3 px-5 py-5 transition sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-6 ${
        notification.unread ? 'bg-[#fbf9ff]' : 'bg-white'
      }`}
    >
      {notification.unread ? (
        <span
          className="absolute left-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-violet"
          aria-label="ยังไม่ได้อ่าน"
        />
      ) : null}

      <span
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${meta.tone}`}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>

      <div className="min-w-0">
        <span className="inline-flex rounded-full bg-[#f5f1fa] px-2.5 py-1 text-[11px] font-extrabold text-violet">
          {meta.label}
        </span>
        <h3 className="mt-2 text-[15px] font-extrabold text-ink">
          {notification.title}
        </h3>
        {notification.description ? (
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
            {notification.description}
          </p>
        ) : null}
        <time
          dateTime={notification.createdAt}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#8b8296]"
        >
          <Clock3 className="h-3.5 w-3.5" aria-hidden />
          {formatRelativeTime(notification.createdAt)}
        </time>
      </div>

      <div className="col-span-2 flex items-center justify-end gap-2 sm:col-span-1 sm:pl-2">
        {notification.href && notification.actionLabel ? (
          <Link
            href={notification.href}
            onClick={onRead}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#d9c8ff] bg-white px-4 text-xs font-extrabold text-violet transition hover:border-violet hover:bg-violet hover:text-white"
          >
            {notification.actionLabel}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        ) : null}

        {notification.unread ? (
          <button
            type="button"
            onClick={onRead}
            aria-label={`ทำเครื่องหมายว่าอ่านแล้ว: ${notification.title}`}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-white text-muted transition hover:border-[#d8cdf0] hover:text-violet"
          >
            <Check className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </article>
  );
}

function SignedOutState() {
  return (
    <section className="sl-surface px-6 py-14 text-center sm:px-10">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-violet-tint text-violet">
        <Bell className="h-7 w-7" aria-hidden />
      </span>
      <h2 className="mt-5 text-xl font-extrabold">
        เข้าสู่ระบบเพื่อดูการแจ้งเตือน
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
        ข่าวงานและสถานะการจองจะแสดงเฉพาะบัญชีผู้ขายของคุณ
      </p>
      <Link href="/login" className="sl-action-primary mt-6">
        เข้าสู่ระบบ
      </Link>
    </section>
  );
}

function NotificationSkeleton() {
  return (
    <section
      className="sl-surface overflow-hidden"
      aria-label="กำลังโหลดการแจ้งเตือน"
    >
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="flex gap-4 border-b border-line px-5 py-5 last:border-0 sm:px-7"
        >
          <span className="skeleton h-11 w-11 shrink-0 rounded-2xl" />
          <span className="min-w-0 flex-1">
            <span className="skeleton block h-4 w-52 rounded-full" />
            <span className="skeleton mt-3 block h-3 w-full max-w-2xl rounded-full" />
            <span className="skeleton mt-2 block h-3 w-24 rounded-full" />
          </span>
        </div>
      ))}
    </section>
  );
}
