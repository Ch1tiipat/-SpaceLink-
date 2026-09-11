'use client';

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowDown,
  ArrowUp,
  Calculator,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CircleDollarSign,
  ImageIcon,
  Images,
  Info,
  Pencil,
  Power,
  Plus,
  RefreshCw,
  Send,
  Search,
  Save,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  AdminAccessGate,
  AdminEmpty,
  AdminError,
  AdminMetric,
  AdminPage,
  AdminPageHeader,
  AdminPanel,
  formatAdminDate,
  useAdminPageAccess,
} from '@/components/admin-ui';
import {
  closeAdminEvent,
  createAdminEventInformation,
  createAdminEventJoinInformation,
  createAdminEvent,
  deleteAdminEventBanner,
  deleteAdminEventInformation,
  deleteAdminEventJoinInformation,
  deleteAdminEvent,
  getAdminOrganizationEvents,
  getAdminVenues,
  openAdminEvent,
  publishAdminEvent,
  quoteAdminEventSubscription,
  reorderAdminEventInformation,
  reorderAdminEventJoinInformation,
  updateAdminEventInformation,
  updateAdminEventJoinInformation,
  updateAdminEventGallery,
  uploadAdminEventBanner,
  uploadAdminEventGallery,
  type AdminVenue,
  type CreateAdminEventInput,
  type AdminOrganizationEvent,
  type EventSubscriptionQuote,
  type EventJoinInformation,
  type EventInformation,
  type EventInformationType,
} from '@/lib/api';
import { getEventCoverUrl } from '@/lib/event-cover';

type EventFilter = 'ALL' | AdminOrganizationEvent['status'];

const STATUS_LABELS: Record<AdminOrganizationEvent['status'], string> = {
  DRAFT: 'ฉบับร่าง',
  PUBLISHED: 'เผยแพร่แล้ว',
  ONGOING: 'กำลังจัดงาน',
  COMPLETED: 'จบงานแล้ว',
  CANCELLED: 'ยกเลิก',
};

const STATUS_STYLES: Record<AdminOrganizationEvent['status'], string> = {
  DRAFT: 'bg-[#f1eef4] text-[#655d70]',
  PUBLISHED: 'bg-[#eaf2ff] text-[#2459b5]',
  ONGOING: 'bg-[#e7f8ef] text-[#147653]',
  COMPLETED: 'bg-[#eee8ff] text-[#6734c4]',
  CANCELLED: 'bg-[#fff0ef] text-[#b42318]',
};

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function displayEventStatus(
  event: AdminOrganizationEvent,
  now = new Date(),
): AdminOrganizationEvent['status'] {
  if (event.status !== 'PUBLISHED' && event.status !== 'ONGOING') {
    return event.status;
  }

  const eventEnd = new Date(event.endDate);
  if (Number.isNaN(eventEnd.getTime())) return event.status;

  const bangkokDay = (date: Date) =>
    Math.floor((date.getTime() + BANGKOK_OFFSET_MS) / DAY_MS);
  return bangkokDay(eventEnd) < bangkokDay(now)
    ? 'COMPLETED'
    : event.status;
}

export function AdminEventsScreen() {
  const { access, token, organizationId, organization } = useAdminPageAccess();
  const [events, setEvents] = useState<AdminOrganizationEvent[]>([]);
  const [venues, setVenues] = useState<AdminVenue[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<EventFilter>('ALL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [galleryEvent, setGalleryEvent] =
    useState<AdminOrganizationEvent | null>(null);
  const [bannerEvent, setBannerEvent] =
    useState<AdminOrganizationEvent | null>(null);
  const [joinInfoEvent, setJoinInfoEvent] =
    useState<AdminOrganizationEvent | null>(null);
  const [informationEvent, setInformationEvent] =
    useState<AdminOrganizationEvent | null>(null);

  useEffect(() => {
    if (access !== 'allowed' || !token || !organizationId) return;
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError('');

    void Promise.all([
      getAdminOrganizationEvents(organizationId, token, controller.signal),
      getAdminVenues(token, controller.signal),
    ])
      .then(([eventRows, venueRows]) => {
        if (active) {
          setEvents(eventRows);
          setVenues(
            venueRows.filter(
              (venue) => venue.organizationId === organizationId,
            ),
          );
        }
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError')
          return;
        if (active) {
          setEvents([]);
          setVenues([]);
          setError(
            cause instanceof Error
              ? cause.message
              : 'โหลดรายการอีเวนต์ไม่สำเร็จ',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [access, organizationId, reloadKey, token]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const visibleEvents = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('th-TH');
    return events.filter((event) => {
      const matchesStatus =
        status === 'ALL' || displayEventStatus(event) === status;
      const matchesQuery =
        !normalized ||
        event.name.toLocaleLowerCase('th-TH').includes(normalized) ||
        event.venue.name.toLocaleLowerCase('th-TH').includes(normalized);
      return matchesStatus && matchesQuery;
    });
  }, [events, query, status]);

  const activeCount = events.filter(
    (event) =>
      displayEventStatus(event) === 'PUBLISHED' ||
      displayEventStatus(event) === 'ONGOING',
  ).length;
  const upcomingCount = events.filter(
    (event) => new Date(event.startDate).getTime() > Date.now(),
  ).length;

  async function publishEvent(event: AdminOrganizationEvent) {
    if (!token || !organizationId || event.status !== 'DRAFT') return;
    const confirmed = window.confirm(
      `ยืนยันเผยแพร่อีเวนต์ “${event.name}” ให้ผู้ขายมองเห็นและเริ่มจองได้หรือไม่?`,
    );
    if (!confirmed) return;

    setBusyAction(`publish:${event.id}`);
    setError('');
    setNotice('');
    try {
      const published = await publishAdminEvent(
        organizationId,
        event.id,
        token,
      );
      setEvents((current) =>
        current.map((item) => (item.id === published.id ? published : item)),
      );
      setNotice(`เผยแพร่อีเวนต์ “${event.name}” เรียบร้อยแล้ว`);
      setReloadKey((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'เผยแพร่อีเวนต์ไม่สำเร็จ',
      );
    } finally {
      setBusyAction('');
    }
  }

  async function setEventOpenState(
    event: AdminOrganizationEvent,
    action: 'open' | 'close',
  ) {
    if (!token || !organizationId) return;
    const opening = action === 'open';
    const confirmed = window.confirm(
      opening
        ? `เปิดอีเวนต์ “${event.name}” อีกครั้งให้ผู้ขายมองเห็นและจองได้หรือไม่?`
        : `ปิดอีเวนต์ “${event.name}” หรือไม่? ผู้ขายจะไม่สามารถดูหรือจองอีเวนต์นี้ได้จนกว่าจะเปิดใหม่`,
    );
    if (!confirmed) return;

    setBusyAction(`${action}:${event.id}`);
    setError('');
    setNotice('');
    try {
      const updated = opening
        ? await openAdminEvent(organizationId, event.id, token)
        : await closeAdminEvent(organizationId, event.id, token);
      setEvents((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setNotice(
        `${opening ? 'เปิด' : 'ปิด'}อีเวนต์ “${event.name}” เรียบร้อยแล้ว`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : `${opening ? 'เปิด' : 'ปิด'}อีเวนต์ไม่สำเร็จ`,
      );
    } finally {
      setBusyAction('');
    }
  }

  async function deleteEvent(event: AdminOrganizationEvent) {
    if (!token || !organizationId) return;
    const confirmed = window.confirm(
      `ลบอีเวนต์ “${event.name}” ถาวรหรือไม่? หากอีเวนต์นี้มีประวัติการจอง ระบบจะไม่อนุญาตให้ลบ`,
    );
    if (!confirmed) return;

    setBusyAction(`delete:${event.id}`);
    setError('');
    setNotice('');
    try {
      await deleteAdminEvent(organizationId, event.id, token);
      setEvents((current) => current.filter((item) => item.id !== event.id));
      setNotice(`ลบอีเวนต์ “${event.name}” เรียบร้อยแล้ว`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ลบอีเวนต์ไม่สำเร็จ');
    } finally {
      setBusyAction('');
    }
  }

  return (
    <AdminAccessGate access={access}>
      <AdminPage>
        <AdminPageHeader
          eyebrow="Event management"
          title="อีเวนต์ของบริษัท"
          description="สร้างอีเวนต์ ดูค่าบริการแพลตฟอร์ม และติดตามสถานะ Subscription ขององค์กร"
          organizationName={organization?.name}
          actions={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                disabled={loading}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#ddd4e7] bg-white px-4 text-xs font-extrabold text-[#655d70] disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                  aria-hidden
                />
                โหลดข้อมูลใหม่
              </button>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                disabled={venues.length === 0}
                title={
                  venues.length === 0
                    ? 'องค์กรยังไม่มีสถานที่สำหรับจัดงาน'
                    : undefined
                }
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet px-4 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" aria-hidden />
                สร้างอีเวนต์
              </button>
            </div>
          }
        />

        {notice ? (
          <div className="mt-4 rounded-xl border border-[#cdebdc] bg-[#effbf5] px-4 py-3 text-sm font-bold text-[#147653]">
            {notice}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <AdminMetric
            icon={CalendarDays}
            label="อีเวนต์ทั้งหมด"
            value={events.length}
            detail="GET organization events"
          />
          <AdminMetric
            icon={CalendarCheck2}
            label="กำลังเผยแพร่/จัดงาน"
            value={activeCount}
            tone="green"
          />
          <AdminMetric
            icon={CalendarClock}
            label="กำลังจะมาถึง"
            value={upcomingCount}
            tone="blue"
          />
        </div>

        <AdminPanel
          title="รายการอีเวนต์"
          description="Event ใหม่เริ่มเป็นฉบับร่าง และบันทึกราคาตามค่าระบบ ณ เวลาที่สร้าง"
          className="mt-6"
          actions={
            <span className="rounded-full bg-[#f1eef4] px-3 py-1 text-[11px] font-extrabold text-[#655d70]">
              {visibleEvents.length} รายการ
            </span>
          }
        >
          <div className="flex flex-col gap-3 border-b border-[#eee9f3] p-4 sm:flex-row">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#ddd4e7] bg-[#fcfbff] px-3">
              <Search className="h-4 w-4 text-violet" aria-hidden />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ค้นหาชื่องานหรือสถานที่"
                className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as EventFilter)}
              className="h-10 rounded-xl border border-[#ddd4e7] bg-white px-3 text-sm font-bold text-[#655d70] outline-none"
            >
              <option value="ALL">ทุกสถานะ</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {error ? <AdminError message={error} /> : null}
          {loading ? (
            <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="skeleton h-44 rounded-[18px]" />
              ))}
            </div>
          ) : visibleEvents.length === 0 ? (
            <AdminEmpty
              icon={CalendarDays}
              title="ไม่พบอีเวนต์"
              description="ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ"
            />
          ) : (
            <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
              {visibleEvents.map((event) => {
                const displayedStatus = displayEventStatus(event);
                return (
                  <article
                  key={event.id}
                  className="overflow-hidden rounded-[18px] border border-[#e8e1ee] bg-[#fcfbff]"
                >
                  <div
                    role="img"
                    aria-label={`ภาพปก ${event.name}`}
                    className="aspect-[16/7] bg-cover bg-center"
                    style={{
                      backgroundImage: `linear-gradient(120deg,rgba(36,16,62,.5),rgba(56,101,104,.18)),url(${JSON.stringify(getEventCoverUrl(event.bannerUrl))})`,
                    }}
                  />
                  <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${STATUS_STYLES[displayedStatus]}`}
                    >
                      {STATUS_LABELS[displayedStatus]}
                    </span>
                    <span className="text-[11px] font-bold text-muted">
                      {event.venue.name}
                    </span>
                  </div>
                  <h2 className="mt-4 text-lg font-black text-ink">
                    {event.name}
                  </h2>
                  <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-muted">
                    {event.description || 'ยังไม่มีรายละเอียดอีเวนต์'}
                  </p>
                  <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[#ebe5ef] pt-4 text-xs">
                    <div>
                      <dt className="text-muted">เริ่ม</dt>
                      <dd className="mt-1 font-extrabold text-ink">
                        {formatAdminDate(event.startDate)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">สิ้นสุด</dt>
                      <dd className="mt-1 font-extrabold text-ink">
                        {formatAdminDate(event.endDate)}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex items-center justify-between rounded-xl bg-white px-3 py-2.5 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-bold text-muted">
                      <CircleDollarSign
                        className="h-4 w-4 text-violet"
                        aria-hidden
                      />
                      ค่าบริการแพลตฟอร์ม
                    </span>
                    <strong className="text-sm text-ink">
                      {event.subscription
                        ? formatBaht(event.subscription.finalPrice)
                        : 'Event เดิม · ไม่มีบิล'}
                    </strong>
                  </div>
                  {displayedStatus === 'DRAFT' ? (
                    <button
                      type="button"
                      onClick={() => void publishEvent(event)}
                      disabled={Boolean(busyAction)}
                      className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-violet px-4 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" aria-hidden />
                      {busyAction === `publish:${event.id}`
                        ? 'กำลังเผยแพร่...'
                        : 'เผยแพร่อีเวนต์'}
                    </button>
                  ) : null}
                  {displayedStatus === 'PUBLISHED' ||
                  displayedStatus === 'ONGOING' ||
                  displayedStatus === 'CANCELLED' ? (
                    <button
                      type="button"
                      onClick={() =>
                        void setEventOpenState(
                          event,
                          displayedStatus === 'CANCELLED' ? 'open' : 'close',
                        )
                      }
                      disabled={Boolean(busyAction)}
                      className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-violet bg-white px-4 text-xs font-extrabold text-violet disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Power className="h-4 w-4" aria-hidden />
                      {busyAction === `open:${event.id}` ||
                      busyAction === `close:${event.id}`
                        ? 'กำลังบันทึก...'
                        : displayedStatus === 'CANCELLED'
                          ? 'เปิดอีเวนต์อีกครั้ง'
                          : 'ปิดอีเวนต์'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setBannerEvent(event)}
                    disabled={Boolean(busyAction)}
                    className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#ddd4e7] bg-white px-4 text-xs font-extrabold text-violet disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ImageIcon className="h-4 w-4" aria-hidden />
                    {event.bannerUrl ? 'เปลี่ยน/ลบภาพปก' : 'เพิ่มภาพปก'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGalleryEvent(event)}
                    disabled={Boolean(busyAction)}
                    className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#ddd4e7] bg-white px-4 text-xs font-extrabold text-violet disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Images className="h-4 w-4" aria-hidden />
                    จัดการแกลเลอรี ({event.galleryUrls.length}/10)
                  </button>
                  <button
                    type="button"
                    onClick={() => setJoinInfoEvent(event)}
                    disabled={Boolean(busyAction)}
                    className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#ddd4e7] bg-white px-4 text-xs font-extrabold text-violet disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Info className="h-4 w-4" aria-hidden />
                    ข้อมูลก่อนเข้าร่วม ({event.joinInformation.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setInformationEvent(event)}
                    disabled={Boolean(busyAction)}
                    className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#ddd4e7] bg-white px-4 text-xs font-extrabold text-violet disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Info className="h-4 w-4" aria-hidden />
                    รายละเอียดภายในงาน ({event.information.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteEvent(event)}
                    disabled={Boolean(busyAction)}
                    className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#f0c7c3] bg-white px-4 text-xs font-extrabold text-[#b42318] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    {busyAction === `delete:${event.id}`
                      ? 'กำลังลบ...'
                      : 'ลบอีเวนต์'}
                  </button>
                  </div>
                  </article>
                );
              })}
            </div>
          )}
        </AdminPanel>

        {createOpen && token && organizationId ? (
          <CreateEventDialog
            venues={venues}
            organizationId={organizationId}
            token={token}
            onClose={() => setCreateOpen(false)}
            onCreated={(message) => {
              setCreateOpen(false);
              setNotice(message);
              setReloadKey((value) => value + 1);
            }}
          />
        ) : null}

        {galleryEvent && token && organizationId ? (
          <EventGalleryDialog
            key={galleryEvent.id}
            event={galleryEvent}
            organizationId={organizationId}
            token={token}
            onClose={() => setGalleryEvent(null)}
            onUpdated={(updated, message) => {
              setEvents((current) =>
                current.map((item) =>
                  item.id === updated.id ? updated : item,
                ),
              );
              setGalleryEvent(updated);
              setNotice(message);
            }}
          />
        ) : null}

        {bannerEvent && token && organizationId ? (
          <EventBannerDialog
            key={bannerEvent.id}
            event={bannerEvent}
            organizationId={organizationId}
            token={token}
            onClose={() => setBannerEvent(null)}
            onUpdated={(updated, message) => {
              setEvents((current) =>
                current.map((item) =>
                  item.id === updated.id ? { ...item, ...updated } : item,
                ),
              );
              setBannerEvent((current) =>
                current ? { ...current, ...updated } : updated,
              );
              setNotice(message);
            }}
          />
        ) : null}

        {joinInfoEvent && token && organizationId ? (
          <EventJoinInformationDialog
            key={joinInfoEvent.id}
            event={joinInfoEvent}
            organizationId={organizationId}
            token={token}
            onClose={() => setJoinInfoEvent(null)}
            onUpdated={(joinInformation, message) => {
              setEvents((current) =>
                current.map((item) =>
                  item.id === joinInfoEvent.id
                    ? { ...item, joinInformation }
                    : item,
                ),
              );
              setJoinInfoEvent((current) =>
                current ? { ...current, joinInformation } : current,
              );
              setNotice(message);
            }}
          />
        ) : null}

        {informationEvent && token && organizationId ? (
          <EventInformationDialog
            key={informationEvent.id}
            event={informationEvent}
            organizationId={organizationId}
            token={token}
            onClose={() => setInformationEvent(null)}
            onUpdated={(information, message) => {
              setEvents((current) =>
                current.map((item) =>
                  item.id === informationEvent.id
                    ? { ...item, information }
                    : item,
                ),
              );
              setInformationEvent((current) =>
                current ? { ...current, information } : current,
              );
              setNotice(message);
            }}
          />
        ) : null}
      </AdminPage>
    </AdminAccessGate>
  );
}

const EVENT_INFORMATION_TYPE_LABELS: Record<EventInformationType, string> = {
  ATMOSPHERE: 'บรรยากาศ',
  ACTIVITY: 'กิจกรรม',
  FACILITY: 'สิ่งอำนวยความสะดวก',
};

function EventInformationDialog({
  event,
  organizationId,
  token,
  onClose,
  onUpdated,
}: {
  event: AdminOrganizationEvent;
  organizationId: string;
  token: string;
  onClose: () => void;
  onUpdated: (items: EventInformation[], message: string) => void;
}) {
  const [items, setItems] = useState(event.information);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<EventInformationType>('ATMOSPHERE');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setType('ATMOSPHERE');
  }

  function edit(item: EventInformation) {
    setEditingId(item.id);
    setTitle(item.title);
    setDescription(item.description);
    setType(item.type);
    setError('');
  }

  async function save(formEvent: FormEvent) {
    formEvent.preventDefault();
    const nextTitle = title.trim();
    const nextDescription = description.trim();
    if (!nextTitle || !nextDescription) {
      setError('กรุณากรอกหัวข้อและรายละเอียดให้ครบ');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const input = { title: nextTitle, description: nextDescription, type };
      const saved = editingId
        ? await updateAdminEventInformation(
            organizationId,
            event.id,
            editingId,
            input,
            token,
          )
        : await createAdminEventInformation(
            organizationId,
            event.id,
            input,
            token,
          );
      const nextItems = editingId
        ? items.map((item) => (item.id === saved.id ? saved : item))
        : [...items, saved];
      setItems(nextItems);
      resetForm();
      onUpdated(
        nextItems,
        editingId
          ? 'แก้ไขรายละเอียดภายในงานแล้ว'
          : 'เพิ่มรายละเอียดภายในงานแล้ว',
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'บันทึกรายละเอียดไม่สำเร็จ',
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: EventInformation) {
    if (!window.confirm(`ลบ “${item.title}” หรือไม่?`)) return;
    setBusy(true);
    setError('');
    try {
      await deleteAdminEventInformation(
        organizationId,
        event.id,
        item.id,
        token,
      );
      const nextItems = items
        .filter((current) => current.id !== item.id)
        .map((current, sortOrder) => ({ ...current, sortOrder }));
      setItems(nextItems);
      if (editingId === item.id) resetForm();
      onUpdated(nextItems, 'ลบรายละเอียดภายในงานแล้ว');
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'ลบรายละเอียดไม่สำเร็จ',
      );
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= items.length) return;
    const previous = items;
    const nextItems = [...items];
    [nextItems[index], nextItems[target]] = [nextItems[target], nextItems[index]];
    const normalized = nextItems.map((item, sortOrder) => ({
      ...item,
      sortOrder,
    }));
    setItems(normalized);
    setBusy(true);
    setError('');
    try {
      const saved = await reorderAdminEventInformation(
        organizationId,
        event.id,
        normalized.map((item) => item.id),
        token,
      );
      setItems(saved);
      onUpdated(saved, 'บันทึกลำดับรายละเอียดแล้ว');
    } catch (cause) {
      setItems(previous);
      setError(
        cause instanceof Error ? cause.message : 'จัดลำดับรายละเอียดไม่สำเร็จ',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#24172f]/45 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-information-title"
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[24px] bg-white p-5 shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-violet">
              Event information
            </span>
            <h2
              id="event-information-title"
              className="mt-1 text-xl font-black text-ink"
            >
              รายละเอียดภายในงาน · {event.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="ปิดหน้าต่างรายละเอียดภายในงาน"
            className="grid h-10 w-10 place-items-center rounded-xl border border-[#ddd4e7] text-muted disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {error ? <AdminError message={error} /> : null}

        <div className="mt-5 grid gap-3">
          {items.length === 0 ? (
            <AdminEmpty
              icon={Info}
              title="ยังไม่มีรายละเอียดภายในงาน"
              description="เพิ่มข้อมูลบรรยากาศ กิจกรรม หรือสิ่งอำนวยความสะดวก"
            />
          ) : (
            items.map((item, index) => (
              <article
                key={item.id}
                className="rounded-[16px] border border-[#e8e1ee] bg-[#fcfbff] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="inline-flex rounded-full bg-[#eee8ff] px-2.5 py-1 text-xs font-bold text-violet">
                      {EVENT_INFORMATION_TYPE_LABELS[item.type]}
                    </span>
                    <h3 className="mt-2 break-words font-extrabold text-ink">
                      {item.title}
                    </h3>
                    <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-muted">
                      {item.description}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => void move(index, -1)} disabled={busy || index === 0} aria-label={`เลื่อน ${item.title} ขึ้น`} className="grid h-8 w-8 place-items-center rounded-lg border border-[#ddd4e7] text-violet disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => void move(index, 1)} disabled={busy || index === items.length - 1} aria-label={`เลื่อน ${item.title} ลง`} className="grid h-8 w-8 place-items-center rounded-lg border border-[#ddd4e7] text-violet disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => edit(item)} disabled={busy} aria-label={`แก้ไข ${item.title}`} className="grid h-8 w-8 place-items-center rounded-lg border border-[#ddd4e7] text-violet disabled:opacity-30"><Pencil className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => void remove(item)} disabled={busy} aria-label={`ลบ ${item.title}`} className="grid h-8 w-8 place-items-center rounded-lg border border-[#f0c7c3] text-[#b42318] disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        <form
          onSubmit={(formEvent) => void save(formEvent)}
          className="mt-6 rounded-[18px] border border-[#e8e1ee] p-4"
        >
          <h3 className="font-extrabold text-ink">
            {editingId ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่'}
          </h3>
          <label className="mt-3 block text-sm font-bold text-ink">
            หมวด
            <select
              value={type}
              onChange={(inputEvent) =>
                setType(inputEvent.target.value as EventInformationType)
              }
              disabled={busy}
              className={`${INPUT_CLASS} mt-2`}
            >
              {Object.entries(EVENT_INFORMATION_TYPE_LABELS).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="mt-3 block text-sm font-bold text-ink">
            หัวข้อ
            <input value={title} onChange={(inputEvent) => setTitle(inputEvent.target.value)} maxLength={200} disabled={busy} className={`${INPUT_CLASS} mt-2`} />
          </label>
          <label className="mt-3 block text-sm font-bold text-ink">
            รายละเอียด
            <textarea value={description} onChange={(inputEvent) => setDescription(inputEvent.target.value)} maxLength={5000} rows={4} disabled={busy} className={`${INPUT_CLASS} mt-2 py-3`} />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            {editingId ? <button type="button" onClick={resetForm} disabled={busy} className="sl-action-secondary">ยกเลิกแก้ไข</button> : null}
            <button type="submit" disabled={busy} className="sl-action-primary">{busy ? 'กำลังบันทึก...' : editingId ? 'บันทึกการแก้ไข' : 'เพิ่มรายละเอียด'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function EventJoinInformationDialog({
  event,
  organizationId,
  token,
  onClose,
  onUpdated,
}: {
  event: AdminOrganizationEvent;
  organizationId: string;
  token: string;
  onClose: () => void;
  onUpdated: (items: EventJoinInformation[], message: string) => void;
}) {
  const [items, setItems] = useState(event.joinInformation);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setContent('');
  }

  function edit(item: EventJoinInformation) {
    setEditingId(item.id);
    setTitle(item.title);
    setContent(item.content);
    setError('');
  }

  async function save(formEvent: FormEvent) {
    formEvent.preventDefault();
    const nextTitle = title.trim();
    const nextContent = content.trim();
    if (!nextTitle || !nextContent) {
      setError('กรุณากรอกหัวข้อและรายละเอียดให้ครบ');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const saved = editingId
        ? await updateAdminEventJoinInformation(
            organizationId,
            event.id,
            editingId,
            { title: nextTitle, content: nextContent },
            token,
          )
        : await createAdminEventJoinInformation(
            organizationId,
            event.id,
            { title: nextTitle, content: nextContent },
            token,
          );
      const nextItems = editingId
        ? items.map((item) => (item.id === saved.id ? saved : item))
        : [...items, saved];
      setItems(nextItems);
      resetForm();
      onUpdated(
        nextItems,
        editingId ? 'แก้ไขข้อมูลก่อนเข้าร่วมงานแล้ว' : 'เพิ่มข้อมูลก่อนเข้าร่วมงานแล้ว',
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกข้อมูลไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: EventJoinInformation) {
    if (!window.confirm(`ลบ “${item.title}” หรือไม่?`)) return;
    setBusy(true);
    setError('');
    try {
      await deleteAdminEventJoinInformation(
        organizationId,
        event.id,
        item.id,
        token,
      );
      const nextItems = items
        .filter((current) => current.id !== item.id)
        .map((current, sortOrder) => ({ ...current, sortOrder }));
      setItems(nextItems);
      if (editingId === item.id) resetForm();
      onUpdated(nextItems, 'ลบข้อมูลก่อนเข้าร่วมงานแล้ว');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ลบข้อมูลไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= items.length) return;
    const previous = items;
    const nextItems = [...items];
    [nextItems[index], nextItems[target]] = [nextItems[target], nextItems[index]];
    const normalized = nextItems.map((item, sortOrder) => ({ ...item, sortOrder }));
    setItems(normalized);
    setBusy(true);
    setError('');
    try {
      const saved = await reorderAdminEventJoinInformation(
        organizationId,
        event.id,
        normalized.map((item) => item.id),
        token,
      );
      setItems(saved);
      onUpdated(saved, 'บันทึกลำดับข้อมูลแล้ว');
    } catch (cause) {
      setItems(previous);
      setError(cause instanceof Error ? cause.message : 'จัดลำดับข้อมูลไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#24172f]/45 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="event-join-info-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[24px] bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-violet">Event join information</span>
            <h2 id="event-join-info-title" className="mt-1 text-xl font-black text-ink">ข้อมูลก่อนเข้าร่วม · {event.name}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="ปิดหน้าต่างข้อมูลก่อนเข้าร่วมงาน" className="grid h-10 w-10 place-items-center rounded-xl border border-[#ddd4e7] text-muted disabled:opacity-50"><X className="h-4 w-4" aria-hidden /></button>
        </div>

        {error ? <AdminError message={error} /> : null}

        <div className="mt-5 grid gap-3">
          {items.length === 0 ? <AdminEmpty icon={Info} title="ยังไม่มีข้อมูลก่อนเข้าร่วมงาน" description="เพิ่มเวลา จุดลงทะเบียน ข้อห้าม หรือคำแนะนำสำหรับผู้เข้าร่วม" /> : items.map((item, index) => (
            <article key={item.id} className="rounded-[16px] border border-[#e8e1ee] bg-[#fcfbff] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><span className="text-xs font-bold text-muted">ลำดับ {index + 1}</span><h3 className="mt-1 break-words font-extrabold text-ink">{item.title}</h3><p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-muted">{item.content}</p></div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => void move(index, -1)} disabled={busy || index === 0} aria-label={`เลื่อน ${item.title} ขึ้น`} className="grid h-8 w-8 place-items-center rounded-lg border border-[#ddd4e7] text-violet disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => void move(index, 1)} disabled={busy || index === items.length - 1} aria-label={`เลื่อน ${item.title} ลง`} className="grid h-8 w-8 place-items-center rounded-lg border border-[#ddd4e7] text-violet disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => edit(item)} disabled={busy} aria-label={`แก้ไข ${item.title}`} className="grid h-8 w-8 place-items-center rounded-lg border border-[#ddd4e7] text-violet disabled:opacity-30"><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => void remove(item)} disabled={busy} aria-label={`ลบ ${item.title}`} className="grid h-8 w-8 place-items-center rounded-lg border border-[#f0c7c3] text-[#b42318] disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </article>
          ))}
        </div>

        <form onSubmit={(formEvent) => void save(formEvent)} className="mt-6 rounded-[18px] border border-[#e8e1ee] p-4">
          <h3 className="font-extrabold text-ink">{editingId ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่'}</h3>
          <label className="mt-3 block text-sm font-bold text-ink">หัวข้อ<input value={title} onChange={(inputEvent) => setTitle(inputEvent.target.value)} maxLength={200} disabled={busy} className={`${INPUT_CLASS} mt-2`} /></label>
          <label className="mt-3 block text-sm font-bold text-ink">รายละเอียด<textarea value={content} onChange={(inputEvent) => setContent(inputEvent.target.value)} maxLength={5000} rows={4} disabled={busy} className={`${INPUT_CLASS} mt-2 py-3`} /></label>
          <div className="mt-4 flex justify-end gap-2">{editingId ? <button type="button" onClick={resetForm} disabled={busy} className="sl-action-secondary">ยกเลิกแก้ไข</button> : null}<button type="submit" disabled={busy} className="sl-action-primary">{busy ? 'กำลังบันทึก...' : editingId ? 'บันทึกการแก้ไข' : 'เพิ่มข้อมูล'}</button></div>
        </form>
      </section>
    </div>
  );
}

function EventBannerDialog({
  event,
  organizationId,
  token,
  onClose,
  onUpdated,
}: {
  event: AdminOrganizationEvent;
  organizationId: string;
  token: string;
  onClose: () => void;
  onUpdated: (updated: AdminOrganizationEvent, message: string) => void;
}) {
  const [pending, setPending] = useState<PendingBannerFile | null>(null);
  const [busy, setBusy] = useState<'upload' | 'remove' | ''>('');
  const [error, setError] = useState('');
  const pendingRef = useRef(pending);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(
    () => () => {
      if (pendingRef.current) {
        URL.revokeObjectURL(pendingRef.current.previewUrl);
      }
    },
    [],
  );

  function selectFile(file: File | undefined) {
    if (!file) return;
    const validationError = validateBannerFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (pending) URL.revokeObjectURL(pending.previewUrl);
    setPending({ file, previewUrl: URL.createObjectURL(file) });
    setError('');
  }

  async function upload() {
    if (!pending) return;
    setBusy('upload');
    setError('');
    try {
      const updated = await uploadAdminEventBanner(
        organizationId,
        event.id,
        pending.file,
        token,
      );
      URL.revokeObjectURL(pending.previewUrl);
      setPending(null);
      onUpdated(updated, `บันทึกภาพปก “${event.name}” เรียบร้อยแล้ว`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'อัปโหลดภาพปกไม่สำเร็จ');
    } finally {
      setBusy('');
    }
  }

  async function remove() {
    if (!event.bannerUrl) return;
    if (!window.confirm(`ลบภาพปกของ “${event.name}” หรือไม่?`)) return;
    setBusy('remove');
    setError('');
    try {
      const updated = await deleteAdminEventBanner(
        organizationId,
        event.id,
        token,
      );
      onUpdated(updated, `ลบภาพปก “${event.name}” เรียบร้อยแล้ว`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ลบภาพปกไม่สำเร็จ');
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#24172f]/45 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-banner-title"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[24px] bg-white p-5 shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-violet">
              Event cover
            </span>
            <h2 id="event-banner-title" className="mt-1 text-xl font-black text-ink">
              ภาพปก · {event.name}
            </h2>
            <p className="mt-1 text-sm text-muted">
              JPEG หรือ PNG ขนาดไม่เกิน 2 MB และไม่เกิน 2000 × 2000 พิกเซล
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={Boolean(busy)}
            aria-label="ปิดหน้าต่างจัดการภาพปก"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#ddd4e7] text-muted disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {error ? <AdminError message={error} /> : null}

        <div
          role="img"
          aria-label={pending ? `ตัวอย่าง ${pending.file.name}` : `ภาพปก ${event.name}`}
          className="mt-5 aspect-video rounded-[18px] bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(120deg,rgba(36,16,62,.38),rgba(56,101,104,.16)),url(${JSON.stringify(pending?.previewUrl ?? getEventCoverUrl(event.bannerUrl))})`,
          }}
        />

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className={`inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-violet px-4 text-sm font-extrabold text-violet ${busy ? 'pointer-events-none opacity-40' : ''}`}>
            <UploadCloud className="h-4 w-4" aria-hidden />
            {event.bannerUrl ? 'เลือกภาพใหม่' : 'เลือกภาพปก'}
            <input
              type="file"
              accept="image/jpeg,image/png"
              disabled={Boolean(busy)}
              onChange={(changeEvent) => {
                selectFile(changeEvent.target.files?.[0]);
                changeEvent.target.value = '';
              }}
              className="sr-only"
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            {event.bannerUrl ? (
              <button
                type="button"
                onClick={() => void remove()}
                disabled={Boolean(busy) || Boolean(pending)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#f0c7c3] px-4 text-sm font-extrabold text-[#b42318] disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                {busy === 'remove' ? 'กำลังลบ…' : 'ลบภาพปก'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void upload()}
              disabled={!pending || Boolean(busy)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet px-4 text-sm font-extrabold text-white disabled:opacity-40"
            >
              <Save className="h-4 w-4" aria-hidden />
              {busy === 'upload' ? 'กำลังอัปโหลด…' : 'บันทึกภาพปก'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

type PendingBannerFile = {
  file: File;
  previewUrl: string;
};

type PendingGalleryFile = {
  file: File;
  previewUrl: string;
};

function EventGalleryDialog({
  event,
  organizationId,
  token,
  onClose,
  onUpdated,
}: {
  event: AdminOrganizationEvent;
  organizationId: string;
  token: string;
  onClose: () => void;
  onUpdated: (updated: AdminOrganizationEvent, message: string) => void;
}) {
  const [urls, setUrls] = useState(event.galleryUrls);
  const [savedUrls, setSavedUrls] = useState(event.galleryUrls);
  const [pending, setPending] = useState<PendingGalleryFile[]>([]);
  const [busy, setBusy] = useState<'upload' | 'save' | ''>('');
  const [error, setError] = useState('');
  const pendingRef = useRef(pending);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(
    () => () => {
      pendingRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    },
    [],
  );

  const remaining = 10 - urls.length - pending.length;
  const hasChanges = JSON.stringify(urls) !== JSON.stringify(savedUrls);

  function selectFiles(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    if (selected.length > remaining) {
      setError(`เลือกได้อีกไม่เกิน ${remaining} รูป`);
      return;
    }
    const invalid = selected.find(
      (file) =>
        !['image/jpeg', 'image/png'].includes(file.type) ||
        file.size > 2 * 1024 * 1024,
    );
    if (invalid) {
      setError('แต่ละรูปต้องเป็น JPEG หรือ PNG และมีขนาดไม่เกิน 2 MB');
      return;
    }
    setError('');
    setPending((current) => [
      ...current,
      ...selected.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);
  }

  function removePending(index: number) {
    setPending((current) => {
      URL.revokeObjectURL(current[index].previewUrl);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  function moveUrl(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= urls.length) return;
    setUrls((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function upload() {
    if (pending.length === 0) return;
    setBusy('upload');
    setError('');
    try {
      const updated = await uploadAdminEventGallery(
        organizationId,
        event.id,
        pending.map((item) => item.file),
        token,
      );
      pending.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setPending([]);
      setUrls(updated.galleryUrls);
      setSavedUrls(updated.galleryUrls);
      onUpdated(updated, `เพิ่มรูปในแกลเลอรี “${event.name}” เรียบร้อยแล้ว`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'อัปโหลดรูปภาพไม่สำเร็จ');
    } finally {
      setBusy('');
    }
  }

  async function save() {
    if (!hasChanges) return;
    setBusy('save');
    setError('');
    try {
      const updated = await updateAdminEventGallery(
        organizationId,
        event.id,
        urls,
        token,
      );
      setUrls(updated.galleryUrls);
      setSavedUrls(updated.galleryUrls);
      onUpdated(updated, `บันทึกลำดับแกลเลอรี “${event.name}” เรียบร้อยแล้ว`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกแกลเลอรีไม่สำเร็จ');
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#24172f]/45 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-gallery-title"
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[24px] bg-white p-5 shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-violet">
              Event gallery
            </span>
            <h2 id="event-gallery-title" className="mt-1 text-xl font-black text-ink">
              รูปบรรยากาศ · {event.name}
            </h2>
            <p className="mt-1 text-sm text-muted">
              มี {urls.length + pending.length}/10 รูป · เพิ่มได้อีก {remaining} รูป
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={Boolean(busy)}
            aria-label="ปิดหน้าต่างจัดการแกลเลอรี"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#ddd4e7] text-muted disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {error ? <AdminError message={error} /> : null}

        {urls.length > 0 ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {urls.map((url, index) => (
              <article key={url} className="overflow-hidden rounded-[18px] border border-[#e8e1ee] bg-[#fcfbff]">
                <div
                  role="img"
                  aria-label={`รูปบรรยากาศลำดับ ${index + 1}`}
                  className="aspect-[4/3] bg-[#f3eef7] bg-cover bg-center"
                  style={{ backgroundImage: `url(${JSON.stringify(url)})` }}
                />
                <div className="flex items-center justify-between gap-2 p-2">
                  <span className="pl-1 text-xs font-extrabold text-muted">
                    ลำดับ {index + 1}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => moveUrl(index, -1)}
                      disabled={Boolean(busy) || index === 0}
                      aria-label={`เลื่อนรูปที่ ${index + 1} ขึ้น`}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-[#ddd4e7] text-violet disabled:opacity-30"
                    >
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveUrl(index, 1)}
                      disabled={Boolean(busy) || index === urls.length - 1}
                      aria-label={`เลื่อนรูปที่ ${index + 1} ลง`}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-[#ddd4e7] text-violet disabled:opacity-30"
                    >
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => setUrls((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      disabled={Boolean(busy)}
                      aria-label={`ลบรูปที่ ${index + 1}`}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-[#f0c7c3] text-[#b42318] disabled:opacity-30"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {pending.length > 0 ? (
          <div className="mt-5">
            <h3 className="text-sm font-extrabold text-ink">ตัวอย่างก่อนอัปโหลด</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pending.map((item, index) => (
                <article key={item.previewUrl} className="overflow-hidden rounded-[18px] border border-dashed border-violet bg-[#faf7ff]">
                  <div
                    role="img"
                    aria-label={`ตัวอย่าง ${item.file.name}`}
                    className="aspect-[4/3] bg-cover bg-center"
                    style={{ backgroundImage: `url(${JSON.stringify(item.previewUrl)})` }}
                  />
                  <div className="flex items-center justify-between gap-2 p-2">
                    <span className="min-w-0 truncate pl-1 text-xs font-bold text-muted">
                      {item.file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePending(index)}
                      disabled={Boolean(busy)}
                      aria-label={`ยกเลิก ${item.file.name}`}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#f0c7c3] text-[#b42318] disabled:opacity-30"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 border-t border-[#eee9f3] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <label className={`inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-violet px-4 text-sm font-extrabold text-violet ${remaining === 0 || busy ? 'pointer-events-none opacity-40' : ''}`}>
            <UploadCloud className="h-4 w-4" aria-hidden />
            เลือกรูปหลายไฟล์
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png"
              disabled={remaining === 0 || Boolean(busy)}
              onChange={(changeEvent) => {
                selectFiles(changeEvent.target.files);
                changeEvent.target.value = '';
              }}
              className="sr-only"
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void upload()}
              disabled={pending.length === 0 || Boolean(busy) || hasChanges}
              title={hasChanges ? 'บันทึกลำดับหรือลบรูปก่อนอัปโหลดรูปใหม่' : undefined}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-violet px-4 text-sm font-extrabold text-violet disabled:cursor-not-allowed disabled:opacity-40"
            >
              <UploadCloud className="h-4 w-4" aria-hidden />
              {busy === 'upload' ? 'กำลังอัปโหลด…' : `อัปโหลด ${pending.length} รูป`}
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={!hasChanges || Boolean(busy)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet px-4 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Save className="h-4 w-4" aria-hidden />
              {busy === 'save' ? 'กำลังบันทึก…' : 'บันทึกลำดับ/การลบ'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function CreateEventDialog({
  venues,
  organizationId,
  token,
  onClose,
  onCreated,
}: {
  venues: AdminVenue[];
  organizationId: string;
  token: string;
  onClose: () => void;
  onCreated: (message: string) => void;
}) {
  const [input, setInput] = useState<CreateAdminEventInput>({
    venueId: venues[0]?.id ?? '',
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
  });
  const [quote, setQuote] = useState<EventSubscriptionQuote | null>(null);
  const [busy, setBusy] = useState<'quote' | 'create' | ''>('');
  const [error, setError] = useState('');
  const [banner, setBanner] = useState<PendingBannerFile | null>(null);
  const inputRevision = useRef(0);
  const bannerRef = useRef(banner);

  useEffect(() => {
    bannerRef.current = banner;
  }, [banner]);

  useEffect(
    () => () => {
      if (bannerRef.current) URL.revokeObjectURL(bannerRef.current.previewUrl);
    },
    [],
  );

  function update<K extends keyof CreateAdminEventInput>(
    key: K,
    value: CreateAdminEventInput[K],
  ) {
    setInput((current) => ({ ...current, [key]: value }));
    inputRevision.current += 1;
    setQuote(null);
    setError('');
  }

  async function calculate(event: FormEvent) {
    event.preventDefault();
    setBusy('quote');
    setError('');
    const revision = inputRevision.current;
    try {
      const result = await quoteAdminEventSubscription(
        organizationId,
        cleanInput(input),
        token,
      );
      if (revision === inputRevision.current) setQuote(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'คำนวณราคาไม่สำเร็จ');
    } finally {
      setBusy('');
    }
  }

  async function create() {
    if (!quote) return;
    setBusy('create');
    setError('');
    try {
      const created = await createAdminEvent(
        organizationId,
        { ...cleanInput(input), expectedFinalPrice: quote.finalPrice },
        token,
      );
      if (!banner) {
        onCreated('สร้าง Event และ Subscription แบบ DRAFT เรียบร้อยแล้ว');
        return;
      }

      try {
        await uploadAdminEventBanner(
          organizationId,
          created.id,
          banner.file,
          token,
        );
        URL.revokeObjectURL(banner.previewUrl);
        onCreated('สร้าง Event และบันทึกภาพปกเรียบร้อยแล้ว');
      } catch (uploadError) {
        const detail =
          uploadError instanceof Error
            ? uploadError.message
            : 'อัปโหลดภาพปกไม่สำเร็จ';
        onCreated(
          `สร้าง Event แล้ว แต่ยังบันทึกภาพปกไม่สำเร็จ: ${detail} กรุณาลองใหม่จากเมนูจัดการภาพปก`,
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'สร้างอีเวนต์ไม่สำเร็จ',
      );
    } finally {
      setBusy('');
    }
  }

  function selectBanner(file: File | undefined) {
    if (!file) return;
    const validationError = validateBannerFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (banner) URL.revokeObjectURL(banner.previewUrl);
    setBanner({ file, previewUrl: URL.createObjectURL(file) });
    setError('');
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#24172f]/45 p-4"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-event-title"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[24px] bg-white p-5 shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[1px] text-violet">
              Subscription preview
            </p>
            <h2
              id="create-event-title"
              className="mt-1 text-2xl font-black text-ink"
            >
              สร้างอีเวนต์ใหม่
            </h2>
            <p className="mt-1 text-sm text-muted">
              ระบบจะแสดงค่าบริการให้ตรวจสอบก่อนสร้างจริง
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl border border-[#e4ddea]"
            aria-label="ปิด"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={calculate} className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="ชื่ออีเวนต์" className="sm:col-span-2">
            <input
              required
              maxLength={200}
              value={input.name}
              onChange={(event) => update('name', event.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="สถานที่" className="sm:col-span-2">
            <select
              required
              value={input.venueId}
              onChange={(event) => update('venueId', event.target.value)}
              className={INPUT_CLASS}
            >
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="วันเริ่ม">
            <input
              required
              type="date"
              value={input.startDate}
              onChange={(event) => update('startDate', event.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="วันสิ้นสุด">
            <input
              required
              type="date"
              min={input.startDate || undefined}
              value={input.endDate}
              onChange={(event) => update('endDate', event.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="เวลาเริ่ม">
            <input
              type="time"
              value={input.startTime}
              onChange={(event) => update('startTime', event.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="เวลาสิ้นสุด">
            <input
              type="time"
              value={input.endTime}
              onChange={(event) => update('endTime', event.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="รายละเอียด" className="sm:col-span-2">
            <textarea
              rows={3}
              maxLength={2000}
              value={input.description}
              onChange={(event) => update('description', event.target.value)}
              className={`${INPUT_CLASS} py-3`}
            />
          </Field>

          <div className="sm:col-span-2">
            <span className="text-sm font-bold text-ink">ภาพปกอีเวนต์ (ไม่บังคับ)</span>
            <div
              role="img"
              aria-label={banner ? `ตัวอย่าง ${banner.file.name}` : 'ตัวอย่างภาพปกเริ่มต้น'}
              className="mt-2 aspect-video w-full rounded-[18px] bg-cover bg-center"
              style={{
                backgroundImage: `linear-gradient(120deg,rgba(36,16,62,.38),rgba(56,101,104,.16)),url(${JSON.stringify(banner?.previewUrl ?? getEventCoverUrl(null))})`,
              }}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <label className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-violet px-4 text-sm font-extrabold text-violet ${busy ? 'pointer-events-none opacity-50' : ''}`}>
                <UploadCloud className="h-4 w-4" aria-hidden />
                {banner ? 'เปลี่ยนภาพ' : 'เลือกภาพปก'}
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  disabled={Boolean(busy)}
                  onChange={(changeEvent) => {
                    selectBanner(changeEvent.target.files?.[0]);
                    changeEvent.target.value = '';
                  }}
                  className="sr-only"
                />
              </label>
              {banner ? (
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(banner.previewUrl);
                    setBanner(null);
                  }}
                  disabled={Boolean(busy)}
                  className="h-10 rounded-xl border border-[#ddd4e7] px-4 text-sm font-bold text-muted disabled:opacity-50"
                >
                  ไม่ใช้ภาพนี้
                </button>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-muted">
              JPEG หรือ PNG ขนาดไม่เกิน 2 MB และไม่เกิน 2000 × 2000 พิกเซล
            </p>
          </div>

          {error ? (
            <p className="sm:col-span-2 rounded-xl bg-[#fff0ef] px-4 py-3 text-sm font-bold text-[#b42318]">
              {error}
            </p>
          ) : null}

          {quote ? <QuoteCard quote={quote} /> : null}

          <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-xl border border-[#ddd4e7] px-4 text-sm font-bold text-muted"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={Boolean(busy)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-violet px-4 text-sm font-extrabold text-violet disabled:opacity-50"
            >
              <Calculator className="h-4 w-4" />
              {busy === 'quote'
                ? 'กำลังคำนวณ…'
                : quote
                  ? 'คำนวณใหม่'
                  : 'คำนวณราคา'}
            </button>
            {quote ? (
              <button
                type="button"
                onClick={create}
                disabled={Boolean(busy)}
                className="h-10 rounded-xl bg-violet px-5 text-sm font-extrabold text-white disabled:opacity-50"
              >
                {busy === 'create' ? 'กำลังสร้าง…' : 'ยืนยันสร้าง Event'}
              </button>
            ) : null}
          </div>
        </form>
      </section>
    </div>
  );
}

function QuoteCard({ quote }: { quote: EventSubscriptionQuote }) {
  return (
    <div className="sm:col-span-2 rounded-[18px] border border-[#ddd0f5] bg-[#faf7ff] p-4">
      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <span>
          ค่าพื้นฐาน{' '}
          <strong className="block text-ink">
            {formatBaht(quote.baseFee)}
          </strong>
        </span>
        <span>
          {quote.zoneCount} โซน × {formatBaht(quote.perZoneRate)}
        </span>
        <span>
          {quote.eventDays} วัน × {formatBaht(quote.perDayRate)}
        </span>
      </div>
      <div className="mt-4 flex items-end justify-between border-t border-[#e5d9f6] pt-4">
        <span className="text-sm font-bold text-muted">ราคาที่ต้องชำระ</span>
        <strong className="text-2xl text-violet">
          {formatBaht(quote.finalPrice)}
        </strong>
      </div>
      {quote.isOverMax ? (
        <p className="mt-2 text-xs font-bold text-[#b45309]">
          ราคาก่อนจำกัดเพดาน {formatBaht(quote.calculatedPrice)}{' '}
          ระบบใช้ราคาสูงสุด {formatBaht(quote.priceMax)}
        </p>
      ) : null}
    </div>
  );
}

function Field({
  label,
  className = '',
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`grid gap-1.5 text-sm font-bold text-ink ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function cleanInput(input: CreateAdminEventInput): CreateAdminEventInput {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== ''),
  ) as CreateAdminEventInput;
}

function validateBannerFile(file: File): string | null {
  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    return 'ภาพปกต้องเป็นไฟล์ JPEG หรือ PNG';
  }
  if (file.size === 0) return 'ไฟล์ภาพปกว่างเปล่า';
  if (file.size > 2 * 1024 * 1024) {
    return 'ภาพปกต้องมีขนาดไม่เกิน 2 MB';
  }
  return null;
}

function formatBaht(value: string) {
  const [whole = '0', fraction = ''] = value.split('.');
  return `${BigInt(whole || '0').toLocaleString('th-TH')}.${fraction.padEnd(2, '0').slice(0, 2)} บาท`;
}

const INPUT_CLASS =
  'h-11 w-full rounded-xl border border-[#ddd4e7] bg-[#fcfbff] px-3 text-sm font-medium text-ink outline-none focus:border-violet';
