'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  Clock3,
  CreditCard,
  Mail,
  Megaphone,
  Settings2,
  Smartphone,
  Sparkles,
} from 'lucide-react';

import { useAuthState } from '@/lib/use-auth-state';
import { canUseUxPreview } from '@/lib/ux-preview';

type NotificationKind = 'event' | 'booking' | 'payment' | 'system';
type NotificationFilter = 'all' | 'unread';
type NotificationPreference =
  | 'all'
  | 'booking'
  | 'payment'
  | 'event'
  | 'system'
  | 'email'
  | 'line';

type UserNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  description: string;
  time: string;
  unread: boolean;
  href?: string;
};

const DEMO_NOTIFICATIONS: UserNotification[] = [
  {
    id: 'booking-confirmed',
    kind: 'booking',
    title: 'ยืนยันการจองบูธ A12 แล้ว',
    description:
      'งานเกษตร มทส. 2569 ยืนยันการจองของคุณเรียบร้อย เตรียมร้านให้พร้อมก่อนวันงาน',
    time: '10 นาทีที่แล้ว',
    unread: true,
    href: '/bookings',
  },
  {
    id: 'payment-reminder',
    kind: 'payment',
    title: 'เหลือเวลาอัปโหลดสลิปอีก 3 นาที',
    description:
      'การจองบูธ B04 ยังรอชำระเงิน หากหมดเวลาระบบจะคืนบูธให้ผู้ขายรายอื่น',
    time: '25 นาทีที่แล้ว',
    unread: true,
    href: '/bookings',
  },
  {
    id: 'event-announcement',
    kind: 'event',
    title: 'ผู้จัดงานอัปเดตเวลาเข้าพื้นที่',
    description:
      'ผู้ขายสามารถเข้าจัดเตรียมบูธได้ตั้งแต่เวลา 06:00 น. โปรดแสดงรหัสการจองที่จุดลงทะเบียน',
    time: 'เมื่อวาน 18:30',
    unread: false,
  },
  {
    id: 'recommended-event',
    kind: 'system',
    title: 'มีงานใหม่ที่เหมาะกับร้านของคุณ',
    description:
      'งานผ้าไหมปักธงชัยเปิดรับร้านค้าแล้ว หมวดสินค้าและทำเลของงานตรงกับโปรไฟล์ร้านของคุณ',
    time: '2 วันที่แล้ว',
    unread: false,
    href: '/',
  },
];

const KIND_META = {
  event: {
    label: 'ข่าวงาน',
    icon: Megaphone,
    tone: 'bg-[#fff5e9] text-[#b35c00]',
  },
  booking: {
    label: 'การจอง',
    icon: CalendarDays,
    tone: 'bg-[#f0eaff] text-[#6d28d9]',
  },
  payment: {
    label: 'การชำระเงิน',
    icon: CreditCard,
    tone: 'bg-[#edf6ff] text-[#1d67a8]',
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

export default function NotificationsPage() {
  const { auth } = useAuthState();
  const [previewAvailable, setPreviewAvailable] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preferences, setPreferences] = useState<
    Record<NotificationPreference, boolean>
  >({
    all: true,
    booking: true,
    payment: true,
    event: true,
    system: true,
    email: true,
    line: false,
  });
  const [notifications, setNotifications] =
    useState<UserNotification[]>(DEMO_NOTIFICATIONS);

  useEffect(() => {
    setPreviewAvailable(canUseUxPreview());
  }, []);

  const visibleNotifications = useMemo(
    () =>
      filter === 'unread'
        ? notifications.filter((notification) => notification.unread)
        : notifications,
    [filter, notifications],
  );
  const unreadCount = notifications.filter(
    (notification) => notification.unread,
  ).length;

  function markAllAsRead() {
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, unread: false })),
    );
  }

  function markAsRead(id: string) {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id
          ? { ...notification, unread: false }
          : notification,
      ),
    );
  }

  function togglePreference(key: NotificationPreference) {
    setPreferences((current) => {
      if (key === 'all') {
        const enabled = !current.all;
        return {
          all: enabled,
          booking: enabled,
          payment: enabled,
          event: enabled,
          system: enabled,
          email: enabled,
          line: enabled ? current.line : false,
        };
      }

      const next = { ...current, [key]: !current[key] };
      const contentEnabled =
        next.booking && next.payment && next.event && next.system;
      return { ...next, all: contentEnabled };
    });
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

          {auth.status === 'signed-in' && previewAvailable ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSettingsOpen((current) => !current)}
                aria-expanded={settingsOpen}
                className="sl-action-secondary"
              >
                <Settings2 className="h-4 w-4" aria-hidden />
                ตั้งค่าการแจ้งเตือน
              </button>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="sl-action-secondary"
                >
                  <CheckCheck className="h-4 w-4" aria-hidden />
                  อ่านทั้งหมดแล้ว
                </button>
              ) : null}
            </div>
          ) : null}
        </header>

        {auth.status === 'loading' ? (
          <NotificationSkeleton />
        ) : auth.status === 'signed-out' ? (
          <SignedOutState />
        ) : !previewAvailable ? (
          <NotificationUnavailable />
        ) : (
          <>
            {settingsOpen ? (
              <NotificationSettings
                preferences={preferences}
                onToggle={togglePreference}
              />
            ) : null}

            <section className="sl-surface overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-line px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <div className="flex rounded-2xl bg-[#f5f2f9] p-1" role="tablist">
                <FilterButton
                  active={filter === 'all'}
                  onClick={() => setFilter('all')}
                  label="ทั้งหมด"
                  count={notifications.length}
                />
                <FilterButton
                  active={filter === 'unread'}
                  onClick={() => setFilter('unread')}
                  label="ยังไม่ได้อ่าน"
                  count={unreadCount}
                />
              </div>

              <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted">
                <Clock3 className="h-4 w-4" aria-hidden />
                เรียงจากรายการล่าสุด
              </span>
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
                  อ่านการแจ้งเตือนครบแล้ว
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
                  เมื่อมีข่าวงานหรือสถานะการจองใหม่ รายการจะแสดงที่หน้านี้
                </p>
              </div>
            )}
            </section>
          </>
        )}

        {previewAvailable ? (
          <p className="mt-4 text-center text-xs text-muted">
            โหมดตรวจ UX/UI บนเครื่องนี้ใช้ข้อมูลตัวอย่างและไม่ส่งข้อมูลเข้า API
          </p>
        ) : null}
      </div>
    </main>
  );
}

function NotificationUnavailable() {
  return (
    <section className="sl-surface px-6 py-16 text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-violet-tint text-violet">
        <Bell className="h-7 w-7" aria-hidden />
      </span>
      <h2 className="mt-5 text-xl font-extrabold">
        ระบบแจ้งเตือนกำลังเตรียมเชื่อมต่อ
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">
        หน้านี้พร้อมด้าน UX/UI แล้ว แต่จะยังไม่แสดงข้อมูลตัวอย่างในระบบจริง
        จนกว่าทีมจะเชื่อม Notification API และการตั้งค่าผู้ใช้
      </p>
      <Link href="/" className="sl-action-primary mt-6">
        กลับไปค้นหา Event
      </Link>
    </section>
  );
}

function NotificationSettings({
  preferences,
  onToggle,
}: {
  preferences: Record<NotificationPreference, boolean>;
  onToggle: (key: NotificationPreference) => void;
}) {
  const options: {
    key: NotificationPreference;
    title: string;
    description: string;
    icon: typeof Bell;
  }[] = [
    {
      key: 'booking',
      title: 'สถานะการจอง',
      description: 'แจ้งเมื่อยืนยัน ยกเลิก หรือมีการเปลี่ยนแปลงบูธ',
      icon: CalendarDays,
    },
    {
      key: 'payment',
      title: 'การชำระเงิน',
      description: 'เตือนเวลาชำระ ยืนยันสลิป และผลการตรวจสอบ',
      icon: CreditCard,
    },
    {
      key: 'event',
      title: 'ข่าวสารและประกาศงาน',
      description: 'ประกาศจากผู้จัดงานและงานใหม่ที่เปิดรับร้านค้า',
      icon: Megaphone,
    },
    {
      key: 'system',
      title: 'คำแนะนำจาก AI',
      description: 'โซนและบูธที่เหมาะกับข้อมูลร้านในโปรไฟล์',
      icon: Sparkles,
    },
  ];

  return (
    <section className="sl-surface mb-5 overflow-hidden" aria-label="ตั้งค่าการแจ้งเตือน">
      <div className="flex flex-col gap-4 border-b border-line bg-[#fbf9ff] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div>
          <h2 className="text-lg font-extrabold">เลือกสิ่งที่ต้องการรับแจ้ง</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            ปิดหรือเปิดได้ทุกประเภท การตั้งค่านี้เป็นตัวอย่าง UX และยังไม่ส่งเข้า API
          </p>
        </div>
        <ToggleSwitch
          checked={preferences.all}
          onClick={() => onToggle('all')}
          label="เปิดการแจ้งเตือนทั้งหมด"
        />
      </div>

      <div className="grid divide-y divide-line lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        <div className="divide-y divide-line px-5 sm:px-7">
          {options.map(({ key, title, description, icon: Icon }) => (
            <div key={key} className="flex items-center gap-4 py-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-violet-tint text-violet">
                <Icon className="h-4.5 w-4.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold">{title}</p>
                <p className="mt-0.5 text-xs leading-5 text-muted">{description}</p>
              </div>
              <ToggleSwitch
                checked={preferences[key]}
                onClick={() => onToggle(key)}
                label={title}
                compact
              />
            </div>
          ))}
        </div>

        <div className="px-5 py-5 sm:px-7">
          <p className="text-sm font-extrabold">ช่องทางรับแจ้งเตือน</p>
          <div className="mt-3 grid gap-3">
            <ChannelSetting
              icon={Bell}
              title="ภายในเว็บไซต์"
              description="แสดงที่กระดิ่งและหน้าการแจ้งเตือน"
              checked={preferences.all}
              disabled
            />
            <ChannelSetting
              icon={Mail}
              title="อีเมล"
              description="ส่งรายละเอียดสำคัญไปยังอีเมลบัญชี"
              checked={preferences.email}
              onClick={() => onToggle('email')}
            />
            <ChannelSetting
              icon={Smartphone}
              title="LINE"
              description="ต้นแบบช่องทางเสริม รอเชื่อม LINE Official"
              checked={preferences.line}
              onClick={() => onToggle('line')}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function ChannelSetting({
  icon: Icon,
  title,
  description,
  checked,
  disabled = false,
  onClick,
}: {
  icon: typeof Bell;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line p-3.5">
      <Icon className="h-5 w-5 shrink-0 text-violet" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{title}</p>
        <p className="text-xs leading-5 text-muted">{description}</p>
      </div>
      <ToggleSwitch
        checked={checked}
        onClick={onClick}
        label={title}
        compact
        disabled={disabled}
      />
    </div>
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

function FilterButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex min-h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-bold transition sm:px-4 ${
        active
          ? 'bg-white text-violet shadow-[0_5px_16px_rgba(54,36,91,0.09)]'
          : 'text-muted hover:text-ink'
      }`}
    >
      {label}
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] ${
          active ? 'bg-violet-tint text-violet' : 'bg-white/70 text-muted'
        }`}
      >
        {count}
      </span>
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
  const content = (
    <>
      <span
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${meta.tone}`}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <strong className="text-[15px] text-ink">{notification.title}</strong>
          {notification.unread ? (
            <span className="h-2 w-2 rounded-full bg-violet" aria-label="ยังไม่ได้อ่าน" />
          ) : null}
        </span>
        <span className="mt-1.5 block max-w-3xl text-sm leading-6 text-muted">
          {notification.description}
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-[#8b8296]">
          <span>{meta.label}</span>
          <span aria-hidden>•</span>
          <time>{notification.time}</time>
        </span>
      </span>
    </>
  );

  return (
    <article
      className={`relative flex gap-4 px-5 py-5 transition sm:px-7 ${
        notification.unread ? 'bg-[#fbf9ff]' : 'bg-white'
      }`}
    >
      {notification.href ? (
        <Link
          href={notification.href}
          onClick={onRead}
          className="flex min-w-0 flex-1 gap-4 rounded-xl focus-visible:outline-offset-4"
        >
          {content}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onRead}
          className="flex min-w-0 flex-1 gap-4 rounded-xl text-left focus-visible:outline-offset-4"
        >
          {content}
        </button>
      )}

      {notification.unread ? (
        <button
          type="button"
          onClick={onRead}
          aria-label={`ทำเครื่องหมายว่าอ่านแล้ว: ${notification.title}`}
          className="hidden h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-white text-muted transition hover:border-[#d8cdf0] hover:text-violet sm:grid"
        >
          <Check className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </article>
  );
}

function SignedOutState() {
  return (
    <section className="sl-surface px-6 py-14 text-center sm:px-10">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-violet-tint text-violet">
        <Bell className="h-7 w-7" aria-hidden />
      </span>
      <h2 className="mt-5 text-xl font-extrabold">เข้าสู่ระบบเพื่อดูการแจ้งเตือน</h2>
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
    <section className="sl-surface overflow-hidden" aria-label="กำลังโหลดการแจ้งเตือน">
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
