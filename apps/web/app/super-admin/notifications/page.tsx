'use client';

import {
  Bell,
  CalendarCheck2,
  CheckCheck,
  CircleAlert,
  CreditCard,
  LifeBuoy,
  Megaphone,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  deleteNotification,
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRecord,
  type NotificationType,
} from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { getSuperAdminNotificationHref } from '@/lib/super-admin-notifications';

const THAI_DATE_TIME = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Bangkok',
});

const TYPE_META = {
  ANNOUNCEMENT: {
    label: 'ประกาศ',
    icon: Megaphone,
    tone: 'bg-[#fff5e9] text-[#b35c00]',
  },
  BOOKING_STATUS: {
    label: 'การจอง',
    icon: CalendarCheck2,
    tone: 'bg-[#f0eaff] text-[#6d28d9]',
  },
  SUPPORT_TICKET: {
    label: 'เคสช่วยเหลือ',
    icon: LifeBuoy,
    tone: 'bg-[#eef8ff] text-[#1769aa]',
  },
  PENALTY: {
    label: 'ความปลอดภัย',
    icon: ShieldAlert,
    tone: 'bg-[#fff0f0] text-[#b42318]',
  },
  PAYMENT: {
    label: 'การชำระเงิน',
    icon: CreditCard,
    tone: 'bg-[#edf6ff] text-[#1d67a8]',
  },
  REFUND: {
    label: 'คืนเงิน',
    icon: CreditCard,
    tone: 'bg-[#ebfaf3] text-[#13795b]',
  },
  SYSTEM: {
    label: 'ระบบ',
    icon: Bell,
    tone: 'bg-[#f2edf8] text-[#716675]',
  },
} satisfies Record<
  NotificationType,
  { label: string; icon: typeof Bell; tone: string }
>;

export default function SuperAdminNotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [deletingNotificationId, setDeletingNotificationId] = useState<
    string | null
  >(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError('');

    void (async () => {
      try {
        const token = await getAccessToken();
        const rows = await getMyNotifications(token, controller.signal);
        if (active) setNotifications(rows);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError')
          return;
        if (active) setError(errorMessage(cause));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadKey]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications],
  );

  async function markAllRead() {
    if (unreadCount === 0) return;
    const previous = notifications;
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, isRead: true })),
    );
    try {
      await markAllNotificationsRead(await getAccessToken());
    } catch (cause) {
      setNotifications(previous);
      setError(errorMessage(cause));
    }
  }

  async function openNotification(notification: NotificationRecord) {
    if (!notification.isRead) {
      const previous = notifications;
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, isRead: true } : item,
        ),
      );
      try {
        await markNotificationRead(notification.id, await getAccessToken());
      } catch (cause) {
        setNotifications(previous);
        setError(errorMessage(cause));
        return;
      }
    }
    router.push(getSuperAdminNotificationHref(notification));
  }

  async function removeNotification(notification: NotificationRecord) {
    if (deletingNotificationId) return;
    const confirmed = window.confirm(
      'ยืนยันการลบการแจ้งเตือนนี้? หากรายการนี้เชื่อมกับเหตุการณ์เดียวกัน การแจ้งเตือนที่เกี่ยวข้องของผู้ใช้ทุกคนจะถูกลบด้วย',
    );
    if (!confirmed) return;

    setDeletingNotificationId(notification.id);
    setError('');
    try {
      await deleteNotification(notification.id, await getAccessToken());
      setReloadKey((value) => value + 1);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setDeletingNotificationId(null);
    }
  }

  return (
    <div className="relative z-0 mx-auto w-full max-w-[1440px] px-[15px] pb-11 pt-[23px] sm:px-[34px] sm:pt-[31px]">
      <header className="mb-6 flex flex-col items-start justify-between gap-[18px] sm:flex-row sm:items-end">
        <div>
          <span className="text-[11px] font-extrabold tracking-[1.1px] text-[#7c3aed]">
            NOTIFICATION CENTER
          </span>
          <h1 className="mb-[5px] mt-[7px] text-[27px] font-black tracking-[-.8px] text-[#242032]">
            การแจ้งเตือน Super Admin
          </h1>
          <p className="m-0 text-[15px] text-[#82788b]">
            ติดตามเคสช่วยเหลือ คำร้องคืนเงิน และเหตุการณ์สำคัญของแพลตฟอร์ม
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            disabled={loading}
            className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-[#e7dfea] bg-white px-[13px] text-[13px] font-bold text-[#716675] disabled:opacity-55"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            โหลดข้อมูลใหม่
          </button>
          <button
            type="button"
            onClick={() => void markAllRead()}
            disabled={loading || unreadCount === 0}
            className="inline-flex min-h-[38px] items-center gap-2 rounded-lg bg-[#6d28d9] px-[13px] text-[13px] font-extrabold text-white disabled:opacity-45"
          >
            <CheckCheck className="h-4 w-4" />
            อ่านทั้งหมด
          </button>
        </div>
      </header>

      <section className="overflow-hidden rounded-[15px] border border-[#e7dfea] bg-white shadow-[0_12px_32px_rgba(65,43,85,.055)]">
        <div className="flex items-center justify-between gap-4 border-b border-[#eee8f3] bg-[#fcfaff] px-5 py-4">
          <div>
            <h2 className="text-sm font-black text-[#242032]">รายการล่าสุด</h2>
            <p className="mt-1 text-xs text-[#82788b]">
              ยังไม่ได้อ่าน {unreadCount.toLocaleString('th-TH')} รายการ
            </p>
          </div>
          <span className="rounded-full bg-[#f1eaff] px-3 py-1 text-xs font-extrabold text-[#6d28d9]">
            {notifications.length.toLocaleString('th-TH')} รายการ
          </span>
        </div>

        {loading ? (
          <div className="grid gap-3 p-5" aria-label="กำลังโหลดการแจ้งเตือน">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-24 animate-pulse rounded-xl bg-[#f2edf8]"
              />
            ))}
          </div>
        ) : error ? (
          <div className="p-10 text-center">
            <CircleAlert className="mx-auto h-10 w-10 text-[#b42318]" />
            <p role="alert" className="mt-3 text-sm font-bold text-[#b42318]">
              {error}
            </p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="mx-auto h-10 w-10 text-[#9d90a6]" />
            <h2 className="mt-3 text-base font-black text-[#242032]">
              ยังไม่มีการแจ้งเตือน
            </h2>
            <p className="mt-1 text-sm text-[#82788b]">
              เมื่อมีรายการที่ต้องตรวจสอบ ระบบจะแสดงที่หน้านี้
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#f0ebf4]">
            {notifications.map((notification) => {
              const meta = TYPE_META[notification.type];
              const Icon = meta.icon;
              return (
                <div
                  key={notification.id}
                  className={`flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-[#faf7ff] ${
                    notification.isRead ? 'bg-white' : 'bg-[#fbf8ff]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => void openNotification(notification)}
                    className="flex min-w-0 flex-1 items-start gap-4 text-left"
                  >
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${meta.tone}`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm text-[#242032]">
                          {notification.title}
                        </strong>
                        <span className="rounded-full bg-[#f2edf8] px-2 py-0.5 text-[10px] font-bold text-[#716675]">
                          {meta.label}
                        </span>
                        {!notification.isRead ? (
                          <span
                            className="h-2 w-2 rounded-full bg-[#7c3aed]"
                            aria-label="ยังไม่ได้อ่าน"
                          />
                        ) : null}
                      </span>
                      {notification.body ? (
                        <span className="mt-1 block text-[13px] leading-6 text-[#716675]">
                          {notification.body}
                        </span>
                      ) : null}
                      <time
                        dateTime={notification.createdAt}
                        className="mt-1.5 block text-[11px] text-[#978e9e]"
                      >
                        {formatDate(notification.createdAt)}
                      </time>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeNotification(notification)}
                    disabled={deletingNotificationId !== null}
                    aria-label={`ลบการแจ้งเตือน ${notification.title}`}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#978e9e] transition hover:bg-[#fff0f0] hover:text-[#b42318] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Trash2
                      className={`h-4 w-4 ${
                        deletingNotificationId === notification.id
                          ? 'animate-pulse'
                          : ''
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

async function getAccessToken() {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('ไม่พบเซสชัน Super Admin กรุณาเข้าสู่ระบบใหม่');
  return token;
}

function errorMessage(cause: unknown) {
  return cause instanceof Error && cause.message
    ? cause.message
    : 'โหลดการแจ้งเตือนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? THAI_DATE_TIME.format(date) : value;
}
