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
  Calculator,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CircleDollarSign,
  Power,
  Plus,
  RefreshCw,
  Send,
  Search,
  Trash2,
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
  createAdminEvent,
  deleteAdminEvent,
  getAdminOrganizationEvents,
  getAdminVenues,
  openAdminEvent,
  publishAdminEvent,
  quoteAdminEventSubscription,
  type AdminVenue,
  type CreateAdminEventInput,
  type AdminOrganizationEvent,
  type EventSubscriptionQuote,
} from '@/lib/api';

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
      const matchesStatus = status === 'ALL' || event.status === status;
      const matchesQuery =
        !normalized ||
        event.name.toLocaleLowerCase('th-TH').includes(normalized) ||
        event.venue.name.toLocaleLowerCase('th-TH').includes(normalized);
      return matchesStatus && matchesQuery;
    });
  }, [events, query, status]);

  const activeCount = events.filter(
    (event) => event.status === 'PUBLISHED' || event.status === 'ONGOING',
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
              {visibleEvents.map((event) => (
                <article
                  key={event.id}
                  className="rounded-[18px] border border-[#e8e1ee] bg-[#fcfbff] p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${STATUS_STYLES[event.status]}`}
                    >
                      {STATUS_LABELS[event.status]}
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
                  {event.status === 'DRAFT' ? (
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
                  {event.status === 'PUBLISHED' ||
                  event.status === 'ONGOING' ||
                  event.status === 'CANCELLED' ? (
                    <button
                      type="button"
                      onClick={() =>
                        void setEventOpenState(
                          event,
                          event.status === 'CANCELLED' ? 'open' : 'close',
                        )
                      }
                      disabled={Boolean(busyAction)}
                      className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-violet bg-white px-4 text-xs font-extrabold text-violet disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Power className="h-4 w-4" aria-hidden />
                      {busyAction === `open:${event.id}` ||
                      busyAction === `close:${event.id}`
                        ? 'กำลังบันทึก...'
                        : event.status === 'CANCELLED'
                          ? 'เปิดอีเวนต์อีกครั้ง'
                          : 'ปิดอีเวนต์'}
                    </button>
                  ) : null}
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
                </article>
              ))}
            </div>
          )}
        </AdminPanel>

        {createOpen && token && organizationId ? (
          <CreateEventDialog
            venues={venues}
            organizationId={organizationId}
            token={token}
            onClose={() => setCreateOpen(false)}
            onCreated={() => {
              setCreateOpen(false);
              setNotice('สร้าง Event และ Subscription แบบ DRAFT เรียบร้อยแล้ว');
              setReloadKey((value) => value + 1);
            }}
          />
        ) : null}
      </AdminPage>
    </AdminAccessGate>
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
  onCreated: () => void;
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
  const inputRevision = useRef(0);

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
      await createAdminEvent(
        organizationId,
        { ...cleanInput(input), expectedFinalPrice: quote.finalPrice },
        token,
      );
      onCreated();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'สร้างอีเวนต์ไม่สำเร็จ',
      );
    } finally {
      setBusy('');
    }
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

function formatBaht(value: string) {
  const [whole = '0', fraction = ''] = value.split('.');
  return `${BigInt(whole || '0').toLocaleString('th-TH')}.${fraction.padEnd(2, '0').slice(0, 2)} บาท`;
}

const INPUT_CLASS =
  'h-11 w-full rounded-xl border border-[#ddd4e7] bg-[#fcfbff] px-3 text-sm font-medium text-ink outline-none focus:border-violet';
