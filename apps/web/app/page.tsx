'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CalendarSearch,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CircleHelp,
  Clock3,
  CreditCard,
  FileText,
  Grid2X2,
  Home,
  Mail,
  Map as MapIcon,
  MapPin,
  Megaphone,
  MessageCircle,
  Minus,
  Phone,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Store,
  UserRoundCheck,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react';
import { SelectMenu, type SelectMenuOption } from '@/components/select-menu';
import {
  getEventMap,
  getEvents,
  getPublicAnnouncements,
  getSavedEventIds,
  unsaveEvent,
  type AdminAnnouncement,
  type DiscoveryEvent,
  type EventMap,
  type EventZone,
} from '@/lib/api';
import { SavedEventsSection } from '@/components/saved-events-section';
import { getEventCoverUrl } from '@/lib/event-cover';
import { hasEventEndCalendarDayPassed } from '@/lib/event-time';
import {
  buildHomeAreaFilterOptions,
  buildHomeEventFilterOptions,
  EMPTY_HOME_EVENT_FILTERS,
  filterHomeEvents,
  provinceFromAddress,
  type EventStatusFilter,
  type HomeEventFilters,
} from '@/lib/home-event-filters';
import {
  filterHomeAnnouncements,
  resolveAnnouncementLoad,
  type AnnouncementFilter,
  type AnnouncementLoadStatus,
} from '@/lib/home-announcement-filters';
import { isEventBookable } from '@/lib/event-booking-rules';
import { summarizeEventZones } from '@/lib/event-detail-view-model';
import { resolveSavedEvents, withoutSavedEvent } from '@/lib/saved-events';
import { getSupabaseBrowserClient } from '@/lib/supabase';

type PublicAnnouncement = AdminAnnouncement & { organizationName: string };
type SavedEventsAccess =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'ready'; token: string; eventIds: string[] }
  | { status: 'error'; message: string };

const dateFormatter = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatDateRange(event: DiscoveryEvent) {
  return `${dateFormatter.format(new Date(event.startDate))} – ${dateFormatter.format(
    new Date(event.endDate),
  )}`;
}

export default function DiscoveryPage() {
  const [events, setEvents] = useState<DiscoveryEvent[]>([]);
  const [announcements, setAnnouncements] = useState<PublicAnnouncement[]>([]);
  const [announcementFilter, setAnnouncementFilter] =
    useState<AnnouncementFilter>('all');
  const [announcementLoadStatus, setAnnouncementLoadStatus] =
    useState<AnnouncementLoadStatus>('success');
  const [draftFilters, setDraftFilters] = useState<HomeEventFilters>(
    EMPTY_HOME_EVENT_FILTERS,
  );
  const [appliedFilters, setAppliedFilters] = useState<HomeEventFilters>(
    EMPTY_HOME_EVENT_FILTERS,
  );
  const [selectedAnnouncement, setSelectedAnnouncement] =
    useState<PublicAnnouncement | null>(null);
  const [loading, setLoading] = useState(true);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedEvents, setSavedEvents] = useState<SavedEventsAccess>({
    status: 'loading',
  });
  const [savedLoadAttempt, setSavedLoadAttempt] = useState(0);
  const [pendingSavedEventId, setPendingSavedEventId] = useState<string | null>(
    null,
  );
  const [savedNotice, setSavedNotice] = useState<{
    kind: 'success' | 'error';
    message: string;
  } | null>(null);
  const announcementsScrollerRef = useRef<HTMLDivElement>(null);
  const announcementDialogRef = useRef<HTMLDialogElement>(null);
  const announcementOpenerRef = useRef<HTMLButtonElement | null>(null);
  const eventDialogRef = useRef<HTMLDialogElement>(null);
  const eventOpenerRef = useRef<HTMLButtonElement | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<DiscoveryEvent | null>(
    null,
  );

  useEffect(() => {
    const controller = new AbortController();
    getEvents(controller.signal)
      .then(setEvents)
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError')
          return;
        setError(
          cause instanceof Error ? cause.message : 'โหลดข้อมูลไม่สำเร็จ',
        );
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const organizations = uniqueOrganizations(events);
    if (organizations.length === 0) {
      setAnnouncements([]);
      setAnnouncementLoadStatus('success');
      setAnnouncementsLoading(false);
      return () => controller.abort();
    }

    setAnnouncementsLoading(true);
    setAnnouncementLoadStatus('success');

    Promise.allSettled(
      organizations.map(async (organization) => {
        const items = await getPublicAnnouncements(
          organization.id,
          controller.signal,
        );
        return items.map((item) => ({
          ...item,
          organizationName: organization.name,
        }));
      }),
    )
      .then((results) => {
        if (controller.signal.aborted) return;
        const resolved = resolveAnnouncementLoad(results);
        setAnnouncementLoadStatus(resolved.status);
        setAnnouncements(
          resolved.items
            .filter((announcement) => announcement.isActive)
            .sort(
              (left, right) =>
                announcementTimestamp(right) - announcementTimestamp(left),
            ),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setAnnouncementsLoading(false);
      });

    return () => controller.abort();
  }, [events]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let supabase: ReturnType<typeof getSupabaseBrowserClient>;

    setSavedEvents({ status: 'loading' });
    try {
      supabase = getSupabaseBrowserClient();
    } catch {
      setSavedEvents({ status: 'signed-out' });
      return;
    }

    void (async () => {
      try {
        const { data, error: sessionError } =
          await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        const token = data.session?.access_token;
        if (!token) {
          if (active) setSavedEvents({ status: 'signed-out' });
          return;
        }

        const eventIds = await getSavedEventIds(token, controller.signal);
        if (active) setSavedEvents({ status: 'ready', token, eventIds });
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') {
          return;
        }
        if (active) {
          setSavedEvents({
            status: 'error',
            message:
              cause instanceof Error
                ? cause.message
                : 'โหลดรายการโปรดไม่สำเร็จ',
          });
        }
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [savedLoadAttempt]);

  useEffect(() => {
    if (!savedNotice) return;
    const timeout = window.setTimeout(() => setSavedNotice(null), 3_500);
    return () => window.clearTimeout(timeout);
  }, [savedNotice]);

  const filters = useMemo(
    () => ({
      events: buildHomeEventFilterOptions(events),
      areas: buildHomeAreaFilterOptions(events),
      categories: uniqueOptions(
        events.flatMap((event) =>
          event.categories.map((category) => ({
            value: category.id,
            label: category.name,
          })),
        ),
      ),
    }),
    [events],
  );

  const eventFilterOptions = loading
    ? [{ value: '', label: 'กำลังโหลดงานและสถานที่…' }]
    : error
      ? [{ value: '', label: 'โหลดงานหรือสถานที่ไม่สำเร็จ' }]
      : withAllOption(
          filters.events,
          filters.events.length > 0
            ? 'ทุกงานหรือสถานที่'
            : 'ยังไม่มีงานหรือสถานที่',
        );
  const areaFilterOptions = loading
    ? [{ value: '', label: 'กำลังโหลดพื้นที่…' }]
    : error
      ? [{ value: '', label: 'โหลดพื้นที่ไม่สำเร็จ' }]
      : withAllOption(
          filters.areas,
          filters.areas.length > 0 ? 'ทุกพื้นที่' : 'ยังไม่มีข้อมูลพื้นที่',
        );

  const visibleEvents = useMemo(
    () =>
      filterHomeEvents(
        events,
        {
          ...appliedFilters,
          query: draftFilters.query,
          area: draftFilters.area,
        },
        isEventBookable,
      ),
    [appliedFilters, draftFilters.area, draftFilters.query, events],
  );
  const featuredEvent = visibleEvents.find((event) => isEventBookable(event));
  const favoriteEvents = useMemo(
    () =>
      savedEvents.status === 'ready'
        ? resolveSavedEvents(events, savedEvents.eventIds)
        : [],
    [events, savedEvents],
  );
  const visibleAnnouncements = useMemo(
    () => filterHomeAnnouncements(announcements, announcementFilter),
    [announcementFilter, announcements],
  );

  useEffect(() => {
    const dialog = announcementDialogRef.current;
    if (selectedAnnouncement && dialog && !dialog.open) dialog.showModal();
  }, [selectedAnnouncement]);

  useEffect(() => {
    const dialog = eventDialogRef.current;
    if (selectedEvent && dialog && !dialog.open) dialog.showModal();
  }, [selectedEvent]);

  function scrollUpdates(direction: -1 | 1) {
    const scroller = announcementsScrollerRef.current;
    if (!scroller) return;
    scroller.scrollBy({
      left: direction * Math.max(scroller.clientWidth * 0.82, 280),
      behavior: 'smooth',
    });
  }

  function runSearch() {
    setAppliedFilters(draftFilters);
    window.requestAnimationFrame(() => {
      document
        .getElementById('events')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function applyEventStatus(eventStatus: EventStatusFilter) {
    setDraftFilters((current) => ({ ...current, eventStatus }));
    setAppliedFilters((current) => ({ ...current, eventStatus }));
  }

  async function removeSavedEvent(event: DiscoveryEvent) {
    if (savedEvents.status !== 'ready' || pendingSavedEventId) return;

    const previousEventIds = savedEvents.eventIds;
    const { token } = savedEvents;
    setPendingSavedEventId(event.id);
    setSavedNotice(null);
    setSavedEvents({
      status: 'ready',
      token,
      eventIds: withoutSavedEvent(previousEventIds, event.id),
    });

    try {
      await unsaveEvent(event.id, token);
      setSavedNotice({
        kind: 'success',
        message: `นำ ${event.name} ออกจากรายการโปรดแล้ว`,
      });
    } catch (cause) {
      setSavedEvents({ status: 'ready', token, eventIds: previousEventIds });
      setSavedNotice({
        kind: 'error',
        message:
          cause instanceof Error
            ? cause.message
            : 'นำ Event ออกจากรายการโปรดไม่สำเร็จ',
      });
    } finally {
      setPendingSavedEventId(null);
    }
  }

  function openAnnouncement(
    announcement: PublicAnnouncement,
    opener: HTMLButtonElement,
  ) {
    announcementOpenerRef.current = opener;
    setSelectedAnnouncement(announcement);
  }

  function closeAnnouncement() {
    announcementDialogRef.current?.close();
  }

  function openEventPopup(
    event: DiscoveryEvent,
    opener: HTMLButtonElement,
  ) {
    eventOpenerRef.current = opener;
    setSelectedEvent(event);
  }

  function closeEventPopup() {
    eventDialogRef.current?.close();
  }

  return (
    <main id="home-top" className="sl-page sl-homepage overflow-hidden text-[#1f1730]">
      <style jsx global>{`
        main.sl-homepage + footer[aria-label='ข้อมูลส่วนท้าย SpaceLink'] {
          display: none;
        }
      `}</style>
      <section className="relative">
        <section className="relative flex min-h-[470px] items-center overflow-hidden sm:min-h-[520px]">
          <Image
            src="/home-hero-spacelink-market.png"
            alt="ร้านค้าและบูธภายในงาน SpaceLink"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,.96)_0%,rgba(252,248,255,.88)_34%,rgba(246,232,255,.56)_57%,rgba(139,83,218,.18)_78%,rgba(92,39,167,.06)_100%)] max-md:bg-[linear-gradient(180deg,rgba(255,255,255,.96)_0%,rgba(252,246,255,.90)_55%,rgba(224,200,255,.32)_100%)]"
          />
          <div className="relative z-[1] flex min-h-[470px] w-full max-w-[760px] flex-col justify-center px-7 pb-28 pt-10 sm:min-h-[520px] sm:px-14 lg:px-[clamp(64px,7vw,110px)]">
            <h1 className="max-w-[660px] text-[clamp(40px,5.4vw,76px)] font-black leading-[.98] tracking-[-.055em] text-[#1c1427]">
              ค้นหาพื้นที่ขาย
              <span className="mt-1 block bg-[linear-gradient(90deg,#5724c8,#7d3ff2,#a765ff)] bg-clip-text text-transparent">
                ที่เหมาะกับร้านคุณ
              </span>
            </h1>
            <p className="mt-5 max-w-[560px] text-sm font-medium leading-7 text-[#51465d] sm:text-base">
              รวมงานแฟร์และอีเวนต์น่าสนใจ เลือกโซน ดูบูธว่าง
              และตรวจสอบพื้นที่ได้จากแผนผังจริง
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#eventSearch"
                className="inline-flex min-h-12 items-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#8b52f4,#6a2ed7)] px-5 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(105,45,215,.25)] transition hover:-translate-y-0.5"
              >
                เริ่มสำรวจพื้นที่ <ArrowRight aria-hidden className="h-4 w-4" />
              </a>
              <a
                href="#events"
                className="inline-flex min-h-12 items-center gap-2 rounded-[14px] border border-white/80 bg-white/80 px-5 text-sm font-extrabold text-[#6530c9] shadow-[0_10px_26px_rgba(62,33,103,.12)] backdrop-blur-md transition hover:bg-white"
              >
                ค้นหา Event <CalendarSearch aria-hidden className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>

        <form
          id="eventSearch"
          className="relative z-30 mx-auto -mt-[66px] grid w-[min(1180px,calc(100%-32px))] scroll-mt-24 gap-2.5 overflow-visible rounded-[24px] border border-[#d8cde5] bg-white/95 p-4 shadow-[0_18px_50px_rgba(72,38,120,.16)] backdrop-blur-xl sm:w-[min(1180px,calc(100%-72px))] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)_minmax(0,1fr)_minmax(0,.8fr)_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            runSearch();
          }}
        >
          <SelectMenu
            label="งานหรือสถานที่"
            placeholder="ทุกงานหรือสถานที่"
            searchable
            searchPlaceholder="พิมพ์ชื่องานหรือสถานที่"
            className="[&_button]:min-h-[58px] [&_input]:min-h-[58px]"
            value={draftFilters.query}
            onChange={(query) =>
              setDraftFilters((current) => ({ ...current, query }))
            }
            options={eventFilterOptions}
          />
          <SelectMenu
            label="พื้นที่"
            placeholder="ทุกพื้นที่"
            searchable
            searchPlaceholder="พิมพ์จังหวัดหรือสถานที่"
            className="[&_button]:min-h-[58px] [&_input]:min-h-[58px]"
            value={draftFilters.area}
            onChange={(area) =>
              setDraftFilters((current) => ({ ...current, area }))
            }
            options={areaFilterOptions}
          />
          <SelectMenu
            label="หมวดสินค้า"
            placeholder="ทุกหมวดสินค้า"
            className="[&_button]:min-h-[58px]"
            value={draftFilters.categoryId}
            onChange={(categoryId) =>
              setDraftFilters((current) => ({ ...current, categoryId }))
            }
            options={withAllOption(filters.categories, 'ทุกหมวดสินค้า')}
          />
          <SelectMenu
            label="สถานะ Event"
            placeholder="ทุกสถานะ"
            className="[&_button]:min-h-[58px]"
            value={draftFilters.eventStatus}
            onChange={(value) => applyEventStatus(value as EventStatusFilter)}
            options={[
              { value: 'all', label: 'ทุกสถานะ' },
              { value: 'bookable', label: 'เปิดจอง' },
              { value: 'closed', label: 'ปิดจอง' },
            ]}
          />
          <button
            type="submit"
            className="inline-flex min-h-[58px] self-end items-center justify-center whitespace-nowrap rounded-[15px] bg-[linear-gradient(135deg,#8a4cf5,#6126d9)] px-5 text-sm font-extrabold text-white shadow-[0_12px_24px_rgba(109,40,217,.22)] transition hover:-translate-y-0.5"
          >
            ดูผลการค้นหา
          </button>
        </form>
      </section>

      <section
        id="announcements"
        className="shell !mt-[52px] max-sm:!mt-[38px]"
        aria-labelledby="announcements-heading"
      >
        <div className="relative mb-[18px] text-center">
          <div>
            <h2
              id="announcements-heading"
              className="text-[clamp(26px,3vw,34px)] font-black tracking-[-0.035em] text-[#432687]"
            >
              ประกาศข่าวสาร
            </h2>
          </div>
          {visibleAnnouncements.length > 1 ? (
            <div
              className="absolute right-0 top-0 flex gap-1 max-sm:relative max-sm:mt-3 max-sm:justify-center"
              role="group"
              aria-label="เลื่อนดูประกาศ"
            >
              <button
                type="button"
                onClick={() => scrollUpdates(-1)}
                aria-label="ดูประกาศก่อนหน้า"
                className="grid h-9 w-9 place-items-center rounded-full border border-line bg-white text-ink transition hover:border-violet hover:text-violet"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => scrollUpdates(1)}
                aria-label="ดูประกาศถัดไป"
                className="grid h-9 w-9 place-items-center rounded-full border border-line bg-white text-ink transition hover:border-violet hover:text-violet"
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ) : null}
        </div>
        <div
          className="mb-7 flex flex-wrap justify-center gap-2"
          role="group"
          aria-label="กรองประกาศตามประเภท"
        >
          {(
            [
              { value: 'all', label: 'ทั้งหมด' },
              { value: 'EVENT', label: 'Event' },
              { value: 'ANNOUNCEMENT', label: 'ประกาศ' },
            ] as const
          ).map((option) => {
            const active = announcementFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => setAnnouncementFilter(option.value)}
                className={`min-h-9 rounded-full border px-3.5 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet ${
                  active
                    ? 'border-[#b699f2] bg-[#b699f2] text-white'
                    : 'border-[#c8b0fa] bg-[#c8b0fa] text-white hover:bg-[#a984ed]'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {!announcementsLoading && announcementLoadStatus === 'partial-error' ? (
          <div
            className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900"
            role="alert"
          >
            โหลดประกาศจากบางองค์กรไม่สำเร็จ ขณะนี้กำลังแสดงเฉพาะข้อมูลที่โหลดได้
          </div>
        ) : null}
        {announcementsLoading ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <span
                key={item}
                className="skeleton block h-[130px] rounded-[12px]"
              />
            ))}
          </div>
        ) : announcementLoadStatus === 'error' ? (
          <div
            className="sl-surface p-8 text-center text-sm text-red-700"
            role="alert"
          >
            โหลดประกาศไม่สำเร็จ กรุณาลองใหม่อีกครั้ง
          </div>
        ) : visibleAnnouncements.length === 0 ? (
          <div className="sl-surface p-8 text-center text-sm text-muted">
            {announcementLoadStatus === 'partial-error'
              ? 'ไม่พบรายการประเภทนี้ในข้อมูลที่โหลดสำเร็จ'
              : announcementFilter === 'EVENT'
                ? 'ยังไม่มีข่าว Event ในขณะนี้'
                : announcementFilter === 'ANNOUNCEMENT'
                  ? 'ยังไม่มีประกาศทั่วไปในขณะนี้'
                  : 'ยังไม่มีประกาศใหม่ในขณะนี้'}
          </div>
        ) : (
          <div
            ref={announcementsScrollerRef}
            className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-3 [scrollbar-width:thin] [scrollbar-color:#c4b5fd_transparent]"
            aria-label="ประกาศล่าสุด เลื่อนซ้ายหรือขวาเพื่อดูเพิ่มเติม"
          >
            {visibleAnnouncements.map((announcement) => (
              <div
                key={announcement.id}
                className="w-[min(360px,88vw)] shrink-0 snap-start sm:w-[min(420px,72vw)] lg:w-[calc((100%-20px)/2)] xl:w-[calc((100%-40px)/3)]"
              >
                <AnnouncementCard
                  announcement={announcement}
                  onOpen={openAnnouncement}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {savedEvents.status !== 'signed-out' ? (
        <SavedEventsSection
          status={savedEvents.status}
          events={favoriteEvents}
          pendingEventId={pendingSavedEventId}
          errorMessage={
            savedEvents.status === 'error' ? savedEvents.message : undefined
          }
          onRetry={() => setSavedLoadAttempt((attempt) => attempt + 1)}
          onUnsave={(event) => void removeSavedEvent(event)}
        />
      ) : null}

      <section
        id="events"
        className="shell !mt-[56px] scroll-mt-24 max-sm:!mt-[42px]"
        aria-labelledby="events-heading"
      >
        <div className="mb-[18px] flex items-end justify-between gap-5 max-md:flex-col max-md:items-start">
          <div>
            <span className="sl-kicker">ค้นหา Event</span>
            <h2
              id="events-heading"
              className="mt-[7px] text-[26px] font-black tracking-[-0.025em] text-[#432687]"
            >
              งานที่เหมาะกับร้านของคุณ
            </h2>
          </div>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="กรองงานที่เหมาะกับร้านของคุณตามสถานะ"
          >
            {(
              [
                { value: 'all', label: 'ทั้งหมด' },
                { value: 'bookable', label: 'เปิดจอง' },
                { value: 'closed', label: 'ปิดจอง' },
              ] as const
            ).map((option) => {
              const active = appliedFilters.eventStatus === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => applyEventStatus(option.value)}
                  className={`min-h-11 rounded-full border px-5 text-sm font-extrabold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet ${
                    active
                      ? 'border-[#b699f2] bg-[#b699f2] text-white shadow-[0_8px_20px_rgba(109,40,217,.12)]'
                      : 'border-[#c8b0fa] bg-[#c8b0fa] text-white hover:border-[#a984ed] hover:bg-[#a984ed]'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        {loading ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <span
                key={item}
                className="skeleton block h-[260px] rounded-[22px]"
              />
            ))}
          </div>
        ) : error ? (
          <div className="sl-surface p-8 text-center text-sm text-red-700">
            โหลดข้อมูลไม่สำเร็จ: {error}
          </div>
        ) : visibleEvents.length === 0 ? (
          <div className="sl-surface p-8 text-center">
            <CalendarSearch
              aria-hidden
              className="mx-auto h-9 w-9 text-violet"
            />
            <h3 className="mt-3 text-lg font-extrabold">
              ไม่พบ Event ตามเงื่อนไขที่เลือก
            </h3>
            <p className="mt-1 text-sm text-muted">
              ลองเปลี่ยนงาน พื้นที่ หมวดสินค้า หรือสถานะ แล้วค้นหาอีกครั้ง
            </p>
            <button
              type="button"
              onClick={() => {
                setDraftFilters(EMPTY_HOME_EVENT_FILTERS);
                setAppliedFilters(EMPTY_HOME_EVENT_FILTERS);
              }}
              className="mt-4 rounded-xl border border-violet px-4 py-2 text-sm font-bold text-violet"
            >
              ล้างตัวกรอง
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onOpen={openEventPopup}
              />
            ))}
          </div>
        )}
      </section>

      {featuredEvent && <PopularAreaRecommendations event={featuredEvent} />}

      <BookingJourney event={featuredEvent} />
      <PlatformBenefits />
      {savedNotice ? (
        <div
          role={savedNotice.kind === 'error' ? 'alert' : 'status'}
          className={`fixed bottom-5 right-5 z-50 max-w-[min(360px,calc(100%-40px))] rounded-2xl px-5 py-3 text-sm font-bold text-white shadow-[0_18px_50px_rgba(27,16,48,.28)] ${
            savedNotice.kind === 'error' ? 'bg-[#9f1239]' : 'bg-[#241438]'
          }`}
        >
          {savedNotice.message}
        </div>
      ) : null}
      <dialog
        ref={announcementDialogRef}
        aria-modal="true"
        aria-labelledby="announcement-dialog-title"
        onClose={() => {
          setSelectedAnnouncement(null);
          announcementOpenerRef.current?.focus();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeAnnouncement();
        }}
        className="w-[min(680px,calc(100%-24px))] max-h-[calc(100dvh-24px)] overflow-hidden rounded-[24px] border border-[#ded2f3] bg-white p-0 text-ink shadow-[0_30px_100px_rgba(28,15,58,.28)] backdrop:bg-[#1b1030]/65"
      >
        {selectedAnnouncement ? (
          <div className="flex max-h-[calc(100dvh-24px)] flex-col">
            <div className="flex items-center justify-between gap-4 border-b border-[#eee8f7] px-5 py-4 sm:px-7">
              <span className="rounded-full bg-[#f1ebff] px-3 py-1.5 text-[11px] font-extrabold text-[#6d28d9]">
                ประกาศจากผู้จัดงาน
              </span>
              <button
                type="button"
                onClick={closeAnnouncement}
                aria-label="ปิดประกาศ"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-[#f5f1fb] hover:text-violet focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
              <div className="flex items-center gap-3.5">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-[#e5ddf3] bg-[linear-gradient(145deg,#ffffff,#f0e9ff)] text-lg font-black text-[#6d28d9] shadow-[0_6px_18px_rgba(109,40,217,.10)]">
                  {selectedAnnouncement.organizationName.trim().charAt(0).toLocaleUpperCase('th-TH') || 'อ'}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-[#2f2342]">
                    {selectedAnnouncement.organizationName}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">โดย ทีมผู้จัดงาน</p>
                </div>
              </div>

              <div className="my-5 h-px bg-[#eee8f7]" />

              <h2
                id="announcement-dialog-title"
                className="text-[clamp(22px,4vw,28px)] font-black leading-[1.35] tracking-[-0.025em] text-[#2f2342]"
              >
                {selectedAnnouncement.title}
              </h2>
              <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-[#81778f]">
                <CalendarDays className="h-4 w-4 text-[#7350cc]" aria-hidden />
                {dateFormatter.format(
                  new Date(
                    selectedAnnouncement.publishedAt ??
                      selectedAnnouncement.createdAt,
                  ),
                )}
              </p>

              <div className="mt-5 whitespace-pre-wrap text-sm leading-7 text-[#544961]">
                {selectedAnnouncement.body}
              </div>

              <div className="mt-5 rounded-[18px] border border-[#ded3f3] bg-[linear-gradient(145deg,#fbfaff,#f4efff)] p-4 sm:p-5">
                <AnnouncementDetailRow
                  icon={Megaphone}
                  label="ประเภท"
                  content={selectedAnnouncement.type === 'EVENT' ? 'ข่าว Event' : 'ประกาศทั่วไป'}
                />
                <AnnouncementDetailRow
                  icon={CalendarDays}
                  label="เผยแพร่เมื่อ"
                  content={dateFormatter.format(
                    new Date(
                      selectedAnnouncement.publishedAt ??
                        selectedAnnouncement.createdAt,
                    ),
                  )}
                />
                <AnnouncementDetailRow
                  icon={Store}
                  label="ผู้จัดงาน"
                  content={selectedAnnouncement.organizationName}
                  isLast
                />
              </div>

              <p className="mt-5 text-xs leading-6 text-[#6f647d]">
                หากมีข้อสงสัยเพิ่มเติม สามารถติดต่อผู้จัดงานผ่านช่องทางที่ระบุไว้ในหน้า Event ที่เกี่ยวข้อง
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[#eee8f7] bg-white px-5 py-4 sm:px-7">
              <a
                href="#announcements"
                onClick={closeAnnouncement}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-xs font-extrabold text-[#6d28d9] transition hover:bg-[#f5f1fb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet"
              >
                ดูประกาศอื่น
                <ChevronRight className="h-4 w-4" aria-hidden />
              </a>
              <button
                type="button"
                onClick={closeAnnouncement}
                className="sl-action-primary min-h-11 min-w-[118px] px-6"
              >
                ปิด
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
      {selectedEvent ? (
        <EventPopup
          dialogRef={eventDialogRef}
          event={selectedEvent}
          onRequestClose={closeEventPopup}
          onClosed={() => {
            setSelectedEvent(null);
            eventOpenerRef.current?.focus();
          }}
        />
      ) : null}
      <HomepageFooter />
    </main>
  );
}

function HomepageFooter() {
  const navigation: { label: string; href: string; icon: LucideIcon }[] = [
    { label: 'หน้าหลัก', href: '#home-top', icon: Home },
    { label: 'ค้นหาพื้นที่', href: '#eventSearch', icon: Search },
    { label: 'งานแนะนำ', href: '#events', icon: CalendarDays },
    { label: 'ประกาศข่าวสาร', href: '#announcements', icon: Megaphone },
  ];
  const support: { label: string; href: string; icon: LucideIcon }[] = [
    { label: 'ติดต่อสอบถาม', href: '/support', icon: MessageCircle },
    { label: 'ศูนย์ช่วยเหลือ', href: '/help', icon: CircleHelp },
    { label: 'คำถามที่พบบ่อย', href: '/help', icon: FileText },
    { label: 'นโยบายความเป็นส่วนตัว', href: '/privacy', icon: ShieldCheck },
  ];

  return (
    <footer
      id="home-footer"
      aria-label="ข้อมูลส่วนท้าย SpaceLink"
      className="relative mt-16 overflow-hidden bg-[linear-gradient(120deg,#f9f7ff,#f2ecff_52%,#f8f5ff)] text-[#402a80]"
    >
      <span aria-hidden className="pointer-events-none absolute -left-24 -top-20 h-52 w-52 rounded-full bg-[#e7d9ff]/45" />
      <span aria-hidden className="pointer-events-none absolute -right-14 -top-20 h-44 w-44 rounded-full bg-[#e1d3ff]/50" />
      <span aria-hidden className="pointer-events-none absolute -bottom-28 -left-20 h-48 w-48 rounded-full bg-[#d9c8ff]/45" />
      <span aria-hidden className="pointer-events-none absolute -bottom-24 -right-16 h-48 w-48 rounded-full bg-[#e5d9ff]/55" />
      <div className="relative mx-auto max-w-[1180px] px-5 pb-5 pt-12 sm:px-7 lg:px-8">
        <div className="grid gap-9 sm:grid-cols-2 lg:grid-cols-[1.18fr_1fr_1fr_1fr] lg:gap-0">
          <section className="lg:pr-7">
            <Link href="#home-top" className="inline-flex items-center gap-2" aria-label="SpaceLink หน้าแรก">
              <Image
                src="/brand/spacelink-mark.png"
                alt=""
                width={56}
                height={56}
                className="h-14 w-14 object-contain"
              />
              <strong className="bg-[linear-gradient(90deg,#5421bd,#9153e7)] bg-clip-text text-[27px] font-black tracking-[-0.04em] text-transparent">
                SpaceLink
              </strong>
            </Link>
            <h2 className="mt-3 text-base font-black text-[#321970]">เกี่ยวกับเรา</h2>
            <p className="mt-2 max-w-[260px] text-sm leading-6 text-[#615785]">
              แพลตฟอร์มค้นหางาน เลือกโซนจองบูธ และติดตามสถานะ
              สำหรับผู้ขายและผู้จัดงานในที่เดียว
            </p>
          </section>

          <section className="lg:border-l lg:border-[#e5dcfa] lg:px-7">
            <h2 className="mb-5 text-base font-black text-[#321970]">สำรวจแพลตฟอร์ม</h2>
            <div className="grid gap-4">
              {navigation.map((item) => <HomepageFooterLink key={item.label} {...item} />)}
            </div>
          </section>

          <section className="lg:border-l lg:border-[#e5dcfa] lg:px-7">
            <h2 className="mb-5 text-base font-black text-[#321970]">บริการช่วยเหลือ</h2>
            <div className="grid gap-4">
              {support.map((item) => <HomepageFooterLink key={item.label} {...item} />)}
            </div>
          </section>

          <section className="lg:border-l lg:border-[#e5dcfa] lg:pl-7">
            <h2 className="mb-5 text-base font-black text-[#321970]">ติดต่อ SpaceLink</h2>
            <div className="grid gap-3">
              <HomepageFooterLink href="mailto:support@spacelink.co" label="support@spacelink.co" icon={Mail} contact />
              <HomepageFooterLink href="tel:+66935275899" label="093-527-5899" icon={Phone} contact />
            </div>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[#d6c6f2] pt-4 text-[11px] text-[#8272b2]">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>© {new Date().getFullYear() + 543} SpaceLink. สงวนลิขสิทธิ์ทุกประการ</span>
            <Link href="/terms" className="hover:text-[#6d28d9]">เงื่อนไขการใช้งาน</Link>
            <Link href="/accessibility" className="hover:text-[#6d28d9]">การเข้าถึงสำหรับทุกคน</Link>
          </div>
          <span className="italic text-[#8a5ce8]">Good Booth Better Business.</span>
        </div>
      </div>
    </footer>
  );
}

function HomepageFooterLink({
  href,
  label,
  icon: Icon,
  contact = false,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  contact?: boolean;
}) {
  const content = (
    <>
      <span className={contact
        ? 'grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e7dcff] text-[#753fe1]'
        : 'grid h-6 w-6 shrink-0 place-items-center text-[#8249ee]'}>
        <Icon aria-hidden className="h-[18px] w-[18px]" />
      </span>
      <span>{label}</span>
    </>
  );

  const className = "inline-flex min-w-0 items-center gap-3 text-[13px] text-[#615785] transition hover:text-[#6d28d9] focus-visible:rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet";
  return href.startsWith('http') ? (
    <a href={href} target="_blank" rel="noreferrer" className={className}>{content}</a>
  ) : (
    <Link href={href} className={className}>{content}</Link>
  );
}

function AnnouncementCard({
  announcement,
  onOpen,
}: {
  announcement: PublicAnnouncement;
  onOpen: (announcement: PublicAnnouncement, opener: HTMLButtonElement) => void;
}) {
  const organizationInitial =
    announcement.organizationName.trim().charAt(0).toLocaleUpperCase('th-TH') || 'อ';

  return (
    <article className="group relative flex h-[174px] overflow-hidden rounded-[20px] border border-[#ded3ee] bg-white text-[#352344] shadow-[0_10px_28px_rgba(75,46,125,.08)] transition duration-200 hover:-translate-y-1 hover:border-[#bda6ea] hover:shadow-[0_18px_38px_rgba(92,52,155,.14)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#8b5cf6,#c4b5fd,#ede9fe)]" />
      <div className="flex w-[116px] shrink-0 flex-col items-center justify-center border-r border-[#eee8f7] bg-[linear-gradient(155deg,#fbfaff,#f4efff)] px-3 pt-4">
        <span
          aria-hidden
          className="grid h-14 w-14 place-items-center rounded-full border border-white bg-white text-xl font-black text-[#6d28d9] shadow-[0_8px_22px_rgba(109,40,217,.12)]"
        >
          {organizationInitial}
        </span>
        <span
          aria-hidden
          className="mt-2 line-clamp-2 text-center text-[10px] font-bold leading-4 text-[#6d28d9]"
        >
          {announcement.organizationName}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="rounded-full bg-[#f1ebff] px-2.5 py-1 text-[10px] font-extrabold text-[#6d28d9]">
            {announcement.type === 'EVENT' ? 'ข่าว Event' : 'ประกาศ'}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-[#8b8195]">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            {dateFormatter.format(
              new Date(announcement.publishedAt ?? announcement.createdAt),
            )}
          </span>
        </div>
        <h3 className="mt-3 line-clamp-2 text-[16px] font-black leading-6 tracking-[-0.015em] text-[#352344]">
          {announcement.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[#756a80]">
          {announcement.body}
        </p>
        <button
          type="button"
          onClick={(event) => onOpen(announcement, event.currentTarget)}
          className="mt-auto inline-flex min-h-8 items-center self-end rounded-full bg-[#f1ebff] px-3 text-[11px] font-extrabold text-[#6d28d9] transition group-hover:bg-[#6d28d9] group-hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet"
        >
          อ่านประกาศ
          <ChevronRight className="ml-1 h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </article>
  );
}

function AnnouncementDetailRow({
  icon: Icon,
  label,
  content,
  isLast = false,
}: {
  icon: LucideIcon;
  label: string;
  content: ReactNode;
  isLast?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[34px_92px_minmax(0,1fr)] gap-2.5 py-3 text-xs leading-5 sm:grid-cols-[36px_108px_minmax(0,1fr)] ${
        isLast ? '' : 'border-b border-[#e8e0f5]'
      }`}
    >
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-[#6d28d9] shadow-[0_4px_12px_rgba(109,40,217,.08)]">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="pt-1 font-extrabold text-[#5d526b]">{label}</span>
      <div className="min-w-0 pt-1 font-semibold text-[#352344]">{content}</div>
    </div>
  );
}

function EventCard({
  event,
  onOpen,
}: {
  event: DiscoveryEvent;
  onOpen: (event: DiscoveryEvent, opener: HTMLButtonElement) => void;
}) {
  const bookable = isEventBookable(event);
  return (
    <button
      type="button"
      onClick={(clickEvent) => onOpen(event, clickEvent.currentTarget)}
      className="sl-surface relative block h-full w-full overflow-hidden text-left text-inherit transition hover:-translate-y-0.5 hover:shadow-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet"
      aria-label={`ดูรายละเอียด ${event.name}`}
    >
      <div
        className="flex min-h-[130px] items-end bg-cover bg-center p-[17px] text-white"
        style={{
          backgroundImage: `linear-gradient(120deg,rgba(36,16,62,.82),rgba(78,30,150,.48),rgba(56,101,104,.38)),url(${JSON.stringify(getEventCoverUrl(event.bannerUrl))})`,
        }}
      >
        <strong className="text-[23px]">{formatDateRange(event)}</strong>
      </div>
      <span
        className={`absolute right-[13px] top-[13px] rounded-full px-[9px] py-[5px] text-sm font-bold ${bookable ? 'bg-[#ecfff3] text-[#16723f]' : 'bg-[#f1eef2] text-[#756c79]'}`}
      >
        {hasEventEndCalendarDayPassed(event.endDate)
          ? 'สิ้นสุดแล้ว'
          : bookable
            ? 'เปิดจอง'
            : 'ปิดรับจอง'}
      </span>
      <div className="p-[17px]">
        <h3 className="text-[15px] font-extrabold">{event.name}</h3>
        <p className="mt-1.5 min-h-[38px] text-sm leading-[1.65] text-muted">
          {event.venue.name} · {provinceFromAddress(event.venue.address ?? '')}
        </p>
        <span className="mt-3 inline-block text-sm font-bold text-[#6d28d9]">
          ดูเพิ่มเติม →
        </span>
      </div>
    </button>
  );
}

type EventPopupLoadState =
  | { status: 'loading' }
  | { status: 'ready'; map: EventMap }
  | { status: 'error'; message: string };

function EventPopup({
  dialogRef,
  event,
  onRequestClose,
  onClosed,
}: {
  dialogRef: RefObject<HTMLDialogElement>;
  event: DiscoveryEvent;
  onRequestClose: () => void;
  onClosed: () => void;
}) {
  const [loadState, setLoadState] = useState<EventPopupLoadState>({
    status: 'loading',
  });
  const [mapViewerOpen, setMapViewerOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    setLoadState({ status: 'loading' });
    setMapViewerOpen(false);
    setZoom(1);
    getEventMap(event.id, controller.signal)
      .then((map) => setLoadState({ status: 'ready', map }))
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setLoadState({
          status: 'error',
          message:
            cause instanceof Error
              ? cause.message
              : 'โหลดข้อมูลแผนผังไม่สำเร็จ',
        });
      });
    return () => controller.abort();
  }, [event.id]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const eventMap = loadState.status === 'ready' ? loadState.map : null;
  const summary = eventMap ? summarizeEventZones(eventMap.zones) : null;
  const mapHref = `/events/${encodeURIComponent(event.slug)}/map`;
  const detailHref = `/events/${encodeURIComponent(event.slug)}`;
  const categories = [
    ...new Set([
      ...event.categories.map((category) => category.name),
      ...(summary?.categories ?? []),
    ]),
  ].slice(0, 4);
  const statusLabel = hasEventEndCalendarDayPassed(event.endDate)
    ? 'สิ้นสุดแล้ว'
    : isEventBookable(event)
      ? 'เปิดจอง'
      : 'ปิดรับจอง';

  function changeZoom(delta: number) {
    setZoom((current) =>
      Math.min(1.75, Math.max(1, Math.round((current + delta) * 4) / 4)),
    );
  }

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby="event-popup-title"
      onClose={onClosed}
      onCancel={(cancelEvent) => {
        if (mapViewerOpen) {
          cancelEvent.preventDefault();
          setMapViewerOpen(false);
          setZoom(1);
        }
      }}
      onClick={(clickEvent) => {
        if (clickEvent.target === clickEvent.currentTarget) onRequestClose();
      }}
      className="w-[min(1120px,calc(100%-24px))] max-h-[calc(100dvh-24px)] overflow-hidden rounded-[24px] border border-white/70 bg-[#faf9ff] p-0 text-[#1e1638] shadow-[0_36px_120px_rgba(24,17,54,.4)] backdrop:bg-[#201b3b]/55 backdrop:backdrop-blur-[5px] sm:w-[min(1120px,calc(100%-64px))] sm:max-h-[calc(100dvh-48px)]"
    >
      <div className="relative flex max-h-[calc(100dvh-24px)] flex-col sm:max-h-[calc(100dvh-48px)]">
        <header className="flex min-h-16 shrink-0 items-center justify-between border-b border-[#e9e3f6] bg-[linear-gradient(90deg,#ffffff,#f4f0ff)] px-4 sm:px-6">
          <div className="inline-flex items-center gap-2.5 text-[#5d27db]">
            <Image
              src="/brand/spacelink-mark.png"
              alt=""
              aria-hidden
              width={38}
              height={38}
              className="h-8 w-8 object-contain"
            />
            <span className="text-lg font-black tracking-[-0.03em]">SpaceLink</span>
          </div>
          <button
            type="button"
            autoFocus
            onClick={onRequestClose}
            aria-label="ปิดรายละเอียด Event"
            className="grid h-10 w-10 place-items-center rounded-full text-[#5f5875] transition hover:bg-[#eee7fb] hover:text-[#5f27d7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-4">
          <section className="grid overflow-hidden rounded-[18px] border border-[#e4dcf3] bg-white shadow-[0_12px_32px_rgba(78,55,121,.08)] lg:grid-cols-[.95fr_1.05fr]">
            <div className="flex min-h-[240px] flex-col justify-center p-5 sm:p-7">
              <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-extrabold ${isEventBookable(event) ? 'bg-[#d9f8e4] text-[#16834e]' : 'bg-[#efedf2] text-[#6f6879]'}`}>
                {statusLabel}
              </span>
              <h1
                id="event-popup-title"
                className="mt-3 text-[clamp(28px,3.2vw,42px)] font-black leading-[1.08] tracking-[-0.045em] text-[#16102c]"
              >
                {event.name}
              </h1>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-[#665d7c] sm:text-sm">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays aria-hidden className="h-4 w-4 text-[#6d28d9]" />
                  {formatDateRange(event)}
                </span>
                <span className="inline-flex items-center gap-2">
                  <MapPin aria-hidden className="h-4 w-4 text-[#6d28d9]" />
                  {event.venue.name}
                </span>
              </div>
              <p className="mt-4 line-clamp-3 text-sm leading-6 text-[#5d5670]">
                {event.description || 'ผู้จัดงานยังไม่ได้เพิ่มรายละเอียด Event นี้'}
              </p>
              {categories.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <span key={category} className="rounded-full bg-[#f3effd] px-3 py-1.5 text-xs font-bold text-[#6630cb]">
                      {category}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <div
              role="img"
              aria-label={`ภาพประกอบ ${event.name}`}
              className="relative min-h-[220px] bg-cover bg-center lg:min-h-[240px]"
              style={{
                backgroundImage: `url(${JSON.stringify(getEventCoverUrl(event.bannerUrl))})`,
              }}
            >
              <div className="absolute inset-0 bg-[linear-gradient(180deg,#fff_0%,rgba(255,255,255,.5)_8%,transparent_24%)] lg:bg-[linear-gradient(90deg,#fff_0%,rgba(255,255,255,.92)_10%,rgba(255,255,255,.5)_24%,transparent_42%)]" />
              <span className="absolute bottom-4 right-4 rounded-full border border-white/70 bg-white/85 px-3 py-1.5 text-[11px] font-extrabold text-[#5b2bc1] shadow-lg backdrop-blur">
                Good Booth Better Business
              </span>
            </div>
          </section>

          <section className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4" aria-label="ข้อมูลสำคัญของ Event">
            <EventPopupStat icon={CalendarDays} label="วันที่จัดงาน" value={formatDateRange(event)} />
            <EventPopupStat icon={MapPin} label="สถานที่" value={event.venue.name} />
            <EventPopupStat
              icon={Store}
              label="บูธว่าง"
              value={summary ? `${summary.availableBooths} จาก ${summary.totalBooths} บูธ` : loadState.status === 'loading' ? 'กำลังโหลด…' : 'ไม่มีข้อมูล'}
            />
            <EventPopupStat
              icon={CircleDollarSign}
              label="ราคาเริ่มต้น"
              value={summary?.startingPrice === null || summary?.startingPrice === undefined ? (loadState.status === 'loading' ? 'กำลังโหลด…' : 'ไม่มีข้อมูล') : `${new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(summary.startingPrice)} บาท`}
            />
          </section>

          <div className="mt-3 grid gap-3 lg:grid-cols-[.85fr_1.15fr]">
            <section className="rounded-[16px] border border-[#e5ddf1] bg-white p-4 shadow-[0_8px_24px_rgba(78,55,121,.045)]">
              <h2 className="inline-flex items-center gap-2 text-sm font-black text-[#5520ca]">
                <FileText aria-hidden className="h-5 w-5" /> เกี่ยวกับงานนี้
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-[#655e77]">
                {event.description || 'ผู้จัดงานยังไม่ได้เพิ่มรายละเอียด Event นี้'}
              </p>
              <div className="mt-4 border-t border-[#eee8f6] pt-4">
                <p className="text-[11px] font-extrabold text-[#31254b]">ผู้จัดงาน</p>
                <p className="mt-1 text-xs text-[#655e77]">{event.organization.name}</p>
                <p className="mt-1 text-xs text-[#81798f]">{event.venue.address || 'ยังไม่ได้ระบุที่อยู่'}</p>
              </div>
              {eventMap?.event.policy?.generalRules ? (
                <div className="mt-4 rounded-xl bg-[#f8f6fc] p-3">
                  <p className="inline-flex items-center gap-2 text-[11px] font-extrabold text-[#5520ca]">
                    <ShieldCheck aria-hidden className="h-4 w-4" /> กฎและเงื่อนไข
                  </p>
                  <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-[10px] leading-5 text-[#716a80]">
                    {eventMap.event.policy.generalRules}
                  </p>
                </div>
              ) : null}
            </section>

            <section className="rounded-[16px] border border-[#e5ddf1] bg-white p-4 shadow-[0_8px_24px_rgba(78,55,121,.045)]">
              <div className="flex items-center justify-between gap-3">
                <h2 className="inline-flex items-center gap-2 text-sm font-black text-[#5520ca]">
                  <MapIcon aria-hidden className="h-5 w-5" /> พื้นที่ภายในงาน
                </h2>
                {eventMap ? (
                  <span className="text-[10px] font-bold text-[#81798f]">{eventMap.zones.length} โซน</span>
                ) : null}
              </div>
              {loadState.status === 'loading' ? (
                <div className="skeleton mt-3 h-[220px] rounded-[14px]" />
              ) : loadState.status === 'error' ? (
                <div role="alert" className="mt-3 rounded-[14px] bg-[#fff1f2] p-4 text-xs leading-5 text-[#a5263d]">
                  {loadState.message}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setMapViewerOpen(true)}
                  className="group relative mt-3 block min-h-[220px] w-full overflow-hidden rounded-[14px] border border-[#ddd4ea] bg-[#f6f3fb] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet"
                  aria-label="เปิดภาพแผนผังโซนแบบซูมได้"
                >
                  <RuntimeZoneMapVisual map={loadState.map} />
                  <span className="absolute inset-x-3 bottom-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-white/95 px-4 text-xs font-extrabold text-[#6330c6] shadow-lg backdrop-blur transition group-hover:bg-[#f4eeff]">
                    กดดูและซูมแผนผังโซน
                  </span>
                </button>
              )}
              <Link
                href={mapHref}
                className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#7440e7] bg-white px-4 text-xs font-extrabold text-[#6330c6] transition hover:bg-[#f5f0ff]"
              >
                <MapIcon aria-hidden className="h-4 w-4" /> เปิดแผนผังจริง
              </Link>
            </section>
          </div>
        </div>

        <footer className="grid shrink-0 grid-cols-2 gap-3 border-t border-[#e6dff1] bg-white/95 px-4 py-3 backdrop-blur sm:flex sm:justify-center sm:px-6">
          <Link
            href={detailHref}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] border-2 border-[#7440e7] px-5 text-sm font-extrabold text-[#6330c6] transition hover:bg-[#f5f0ff] sm:min-w-[250px]"
          >
            ดูรายละเอียด Event
          </Link>
          <Link
            href={mapHref}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#8752ef,#5e20e0)] px-5 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(101,44,215,.25)] transition hover:-translate-y-0.5 sm:min-w-[250px]"
          >
            {isEventBookable(event) ? 'จองพื้นที่' : 'ดูแผนผังโซน'} <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        </footer>

        {mapViewerOpen && eventMap ? (
          <section aria-labelledby="event-map-viewer-title" className="absolute inset-0 z-50 flex min-h-0 flex-col bg-[#f8f7fc]">
            <header className="flex min-h-16 shrink-0 items-center justify-between border-b border-[#e4dcef] bg-white px-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMapViewerOpen(false);
                    setZoom(1);
                  }}
                  aria-label="กลับไปหน้ารายละเอียด Event"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#dfd4f2] text-[#6430cb] transition hover:bg-[#f4efff]"
                >
                  <ChevronLeft aria-hidden className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <h2 id="event-map-viewer-title" className="truncate text-base font-black text-[#241943] sm:text-lg">แผนผังโซน</h2>
                  <p className="truncate text-[10px] text-[#7d748c] sm:text-xs">{event.name}</p>
                </div>
              </div>
              <span className="hidden rounded-full bg-[#eee7ff] px-3 py-1.5 text-xs font-bold text-[#6430cb] sm:inline-flex">
                กดภาพเพื่อซูม · ใช้ปุ่ม +/− เพื่อปรับขนาด
              </span>
            </header>

            <div className="relative grid min-h-0 flex-1 content-start gap-3 overflow-y-auto p-3 sm:p-4">
              <div className="relative min-h-[430px] overflow-auto rounded-[20px] border border-[#ddd4ea] bg-[#eeebf3]">
                <button
                  type="button"
                  onClick={() => setZoom((current) => (current >= 1.75 ? 1 : current + 0.25))}
                  aria-label="กดภาพแผนที่เพื่อซูม"
                  className="relative mx-auto block min-h-[430px] min-w-[560px] origin-center transition-[width] duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-violet"
                  style={{ width: `${zoom * 100}%` }}
                >
                  <RuntimeZoneMapVisual map={eventMap} expanded />
                </button>
                <div className="sticky left-3 top-3 z-30 grid w-fit gap-1.5 rounded-xl border border-[#ddd4ea] bg-white/95 p-1.5 shadow-lg backdrop-blur">
                  <button type="button" onClick={() => changeZoom(0.25)} disabled={zoom >= 1.75} aria-label="ซูมเข้า" className="grid h-9 w-9 place-items-center rounded-lg text-[#5f2bc7] transition hover:bg-[#f1ebff] disabled:opacity-35">
                    <Plus aria-hidden className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => changeZoom(-0.25)} disabled={zoom <= 1} aria-label="ซูมออก" className="grid h-9 w-9 place-items-center rounded-lg text-[#5f2bc7] transition hover:bg-[#f1ebff] disabled:opacity-35">
                    <Minus aria-hidden className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setZoom(1)} aria-label="รีเซ็ตขนาดแผนที่" className="grid h-9 w-9 place-items-center rounded-lg text-[#5f2bc7] transition hover:bg-[#f1ebff]">
                    <RotateCcw aria-hidden className="h-4 w-4" />
                  </button>
                </div>
                <span className="sticky bottom-3 left-3 z-30 rounded-full border border-white bg-white/90 px-3 py-1.5 text-[10px] font-extrabold text-[#62596f] shadow-md backdrop-blur">
                  ซูม {Math.round(zoom * 100)}%
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[#ded5eb] bg-white px-4 py-3">
                <p className="text-xs leading-5 text-[#71687f]">แผนผังนี้ใช้สำหรับดูตำแหน่งเท่านั้น เลือกบูธต่อได้ในหน้าแผนผังจริง</p>
                <Link href={mapHref} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#6d28d9] px-4 text-xs font-extrabold text-white transition hover:bg-[#5b21b6]">
                  เปิดแผนผังจริง <ArrowRight aria-hidden className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </dialog>
  );
}

function EventPopupStat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <article className="flex min-w-0 items-center gap-3 rounded-[15px] border border-[#e5ddf1] bg-white p-3 shadow-[0_8px_24px_rgba(78,55,121,.05)] sm:p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eee7ff] text-[#6d28d9]">
        <Icon aria-hidden className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] text-[#81798f]">{label}</span>
        <strong className="mt-0.5 line-clamp-2 block text-xs leading-5 text-[#241943] sm:text-sm">{value}</strong>
      </span>
    </article>
  );
}

function RuntimeZoneMapVisual({
  map,
  expanded = false,
}: {
  map: EventMap;
  expanded?: boolean;
}) {
  const zones = map.zones.slice(0, expanded ? 12 : 6);
  const mapImageUrl = map.event.mapImageUrl;

  return (
    <div
      className={`relative grid h-full min-h-[220px] w-full gap-3 overflow-hidden bg-[#f5f3fa] p-4 ${expanded ? 'min-h-[430px] grid-cols-2 content-center sm:grid-cols-3' : 'grid-cols-2 content-center sm:grid-cols-3'}`}
      style={
        mapImageUrl
          ? {
              backgroundImage: `linear-gradient(rgba(247,244,252,.18),rgba(247,244,252,.18)),url(${JSON.stringify(mapImageUrl)})`,
              backgroundPosition: 'center',
              backgroundSize: 'cover',
            }
          : undefined
      }
    >
      {mapImageUrl ? (
        <span className="absolute inset-x-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-center text-[10px] font-bold text-[#5f5870] shadow-sm backdrop-blur">
          ภาพแผนผังจากผู้จัดงาน
        </span>
      ) : zones.length > 0 ? (
        zones.map((zone, index) => {
          const available = zone.booths.filter(
            (booth) => booth.availability === 'AVAILABLE',
          ).length;
          const tones = [
            'border-[#f1ae54] bg-[#fff2d7] text-[#86520e]',
            'border-[#aa83eb] bg-[#eee5ff] text-[#5f2bc7]',
            'border-[#55bca8] bg-[#dff8f2] text-[#176b5c]',
            'border-[#6fa8df] bg-[#e2f0ff] text-[#245f99]',
          ];
          return (
            <span key={zone.id} className={`rounded-xl border-2 p-3 text-left shadow-sm ${tones[index % tones.length]}`}>
              <strong className="block text-xs">{zone.code}</strong>
              <span className="mt-1 line-clamp-1 block text-[10px] font-semibold">{zone.name || `โซน ${zone.code}`}</span>
              <span className="mt-2 block text-[9px] opacity-75">{available} บูธว่าง</span>
            </span>
          );
        })
      ) : (
        <span className="col-span-full text-center text-xs font-semibold text-[#756d82]">ผู้จัดงานยังไม่ได้เพิ่มแผนผังโซน</span>
      )}
    </div>
  );
}

function PopularAreaRecommendations({ event }: { event: DiscoveryEvent }) {
  const [zones, setZones] = useState<EventZone[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    getEventMap(event.id, controller.signal)
      .then((map) => {
        const featured = [map.zones[0], map.zones[3], map.zones[5]].filter(
          (zone): zone is EventZone => Boolean(zone),
        );
        setZones(featured.length === 3 ? featured : map.zones.slice(0, 3));
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError')
          return;
        setZones([]);
      });
    return () => controller.abort();
  }, [event.id]);

  if (zones.length === 0) return null;

  return (
    <section
      className="shell !mt-[56px] max-sm:!mt-[42px]"
      aria-labelledby="recommended-heading"
    >
      <span className="sl-kicker">พื้นที่แนะนำ</span>
      <h2
        id="recommended-heading"
        className="mt-[7px] text-[26px] font-black tracking-[-0.025em]"
      >
        พื้นที่นิยมที่เหมาะกับร้าน
      </h2>
      <p className="mt-1 text-xs text-muted">
        ดูตำแหน่งบูธยอดนิยม และเลือกพื้นที่ที่เหมาะกับสินค้าของคุณ
      </p>

      <div className="mt-[18px] grid gap-4 lg:grid-cols-3">
        {zones.map((zone) => {
          const available = zone.booths.filter(
            (booth) => booth.availability === 'AVAILABLE',
          ).length;
          return (
            <Link
              key={zone.id}
              href={`/events/${encodeURIComponent(event.slug)}/map?zone=${encodeURIComponent(zone.code)}`}
              className="sl-surface flex items-start gap-[14px] p-5 text-inherit transition hover:-translate-y-0.5 hover:shadow-soft"
            >
              <span className="grid h-[43px] min-w-[76px] shrink-0 place-items-center whitespace-nowrap rounded-[13px] bg-[#f3edff] px-2 font-extrabold text-[#6d28d9]">
                {zone.code}
              </span>
              <span className="min-w-0">
                <strong className="block text-sm">
                  โซน {zone.code} · {zone.name ?? `โซน ${zone.code}`}
                </strong>
                <span className="mt-1.5 block text-sm leading-[1.7] text-muted">
                  มี {available} บูธว่าง ตรวจสอบตำแหน่งและราคาจากแผนผังจริง
                </span>
                <span className="mt-2.5 inline-block text-sm font-bold text-[#6d28d9]">
                  ดูตำแหน่งบูธ →
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function BookingJourney({ event }: { event?: DiscoveryEvent }) {
  const steps: Array<{
    number: string;
    title: string;
    description: string;
    icon: LucideIcon;
    href: string;
  }> = [
    {
      number: '1',
      title: 'ค้นหางานและพื้นที่',
      description:
        'เลือกงานที่สนใจและค้นหาพื้นที่ที่เหมาะกับร้านของคุณ',
      icon: CalendarSearch,
      href: '#eventSearch',
    },
    {
      number: '2',
      title: 'จองและชำระเงิน',
      description:
        'เลือกบูธ เช็กข้อมูล และชำระเงินได้อย่างปลอดภัย',
      icon: CreditCard,
      href: event ? `/events/${encodeURIComponent(event.slug)}/map` : '#events',
    },
    {
      number: '3',
      title: 'เตรียมร้านและเข้าร่วมงาน',
      description:
        'รับข้อมูลการจัดงานและเตรียมความพร้อมก่อนวันขาย',
      icon: Store,
      href: '/bookings',
    },
  ];

  return (
    <section
      className="shell !mt-[72px] max-sm:!mt-[48px]"
      aria-labelledby="booking-journey-heading"
    >
      <div className="rounded-[16px] border border-[#a68ce1] bg-white/35 px-7 py-6 max-sm:px-5">
        <div className="text-center">
          <h2
            id="booking-journey-heading"
            className="text-[clamp(27px,3vw,36px)] font-black tracking-[-0.035em] text-[#432687]"
          >
            จองพื้นที่ขายได้ใน 3 ขั้นตอน
          </h2>
          <p className="mt-1 text-sm text-[#55505d]">ง่าย ครบ จบในที่เดียว</p>
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <Link
                key={step.number}
                href={step.href}
                className="group flex min-w-0 items-center gap-3 rounded-xl p-2 text-inherit transition hover:bg-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet"
              >
                <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#d5bcff] text-[#6540a8]">
                  <Icon aria-hidden className="h-7 w-7 stroke-[1.6]" />
                  <span className="absolute -left-1 -top-2 grid h-7 w-7 place-items-center rounded-full bg-[#9564ef] text-xs font-bold text-white">
                    {step.number}
                  </span>
                </span>
                <span className="min-w-0">
                  <strong className="block text-sm font-extrabold group-hover:text-[#6d28d9]">
                    {step.title}
                  </strong>
                  <span className="mt-0.5 block text-xs leading-[1.5] text-muted">
                    {step.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PlatformBenefits() {
  const benefits: Array<{
    title: string;
    description: string;
    icon: LucideIcon;
  }> = [
    {
      title: 'จัดการโซนและบูธได้ในที่เดียว',
      description: 'สร้าง แก้ไข จัดโซน และกำหนดจำนวนบูธได้อย่างยืดหยุ่น',
      icon: Grid2X2,
    },
    {
      title: 'ดูสถานะบูธแบบเรียลไทม์',
      description: 'ตรวจสอบบูธว่าง สำรอง และจองแล้วได้ทันทีบนแผนผังพื้นที่',
      icon: Clock3,
    },
    {
      title: 'ลดขั้นตอนการรับจองออนไลน์',
      description: 'ผู้ค้าสามารถจองบูธได้เองผ่านระบบ ลดงานเอกสารและการสื่อสารซ้ำซ้อน',
      icon: FileText,
    },
    {
      title: 'ลดปัญหาการจองบูธซ้ำ',
      description: 'ระบบตรวจสอบและป้องกันการจองซ้ำโดยอัตโนมัติ',
      icon: ShieldCheck,
    },
    {
      title: 'ตรวจสอบข้อมูลร้านค้าก่อนอนุมัติ',
      description: 'ดูรายละเอียดร้านค้า เอกสาร และประวัติก่อนยืนยันการจอง',
      icon: UserRoundCheck,
    },
    {
      title: 'จัดการข้อมูลผู้ค้าอย่างเป็นระบบ',
      description: 'เก็บข้อมูลร้านค้า การติดต่อ และเอกสารไว้ในที่เดียว',
      icon: Store,
    },
    {
      title: 'กำหนดราคาแต่ละโซนได้',
      description: 'ตั้งราคาตามโซน ประเภทพื้นที่ หรือช่วงเวลาได้อย่างอิสระ',
      icon: WalletCards,
    },
    {
      title: 'ตรวจสอบประวัติการจองย้อนหลัง',
      description: 'ดูข้อมูลการจอง รายได้ และสรุปผลหลังจบงานได้ง่าย',
      icon: BarChart3,
    },
  ];

  return (
    <section
      className="shell !mb-[56px] !mt-[56px] max-sm:!mb-[42px] max-sm:!mt-[42px]"
      aria-labelledby="benefit-heading"
    >
      <div className="relative overflow-hidden rounded-[26px] bg-[linear-gradient(120deg,rgba(255,255,255,.68),rgba(244,238,255,.82))] px-8 py-9 shadow-[0_16px_45px_rgba(92,52,155,.07)] max-sm:px-5 max-sm:py-7">
        <span
          aria-hidden
          className="absolute -bottom-32 -left-24 h-56 w-56 rounded-full border-[36px] border-[#d7c4ff]/30"
        />
        <div className="relative grid items-center gap-8 lg:grid-cols-[.76fr_1.24fr]">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#7943d9]">
              WHY SPACE LINK
            </span>
            <h2
              id="benefit-heading"
              className="mt-3 text-[clamp(27px,3vw,37px)] font-black leading-[1.18] tracking-[-0.04em] text-[#201751]"
            >
              ทำไมผู้จัดงานและ
              <br className="max-lg:hidden" /> เจ้าของพื้นที่ควรเลือกใช้
              <br />
              <span className="text-[#7943e7]">SpaceLink?</span>
            </h2>
            <p className="mt-4 max-w-[430px] text-sm leading-7 text-[#6d667d]">
              SpaceLink ช่วยให้ผู้จัดงานบริหารพื้นที่ โซน บูธ ผู้ค้า และการจองได้จากระบบเดียว
              ลดขั้นตอนการทำงาน และช่วยให้ผู้ค้าค้นหาและจองพื้นที่ได้ง่ายยิ่งขึ้น
            </p>
            <Link
              href="/support"
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-[linear-gradient(135deg,#8752ef,#642bd7)] px-6 text-sm font-bold text-white shadow-[0_10px_20px_rgba(109,40,217,.2)] transition hover:-translate-y-0.5"
            >
              ติดต่อเพื่อเริ่มจัดงาน <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            {benefits.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <article
                  key={benefit.title}
                  className="flex min-h-[78px] items-center gap-3 rounded-[15px] border border-[#ebe4fa] bg-white/80 p-3 shadow-[0_8px_20px_rgba(74,37,130,.05)]"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#eee5ff] text-[#7943df]">
                    <Icon aria-hidden className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-xs font-extrabold text-[#261755]">
                      {benefit.title}
                    </h3>
                    <p className="mt-0.5 text-[11px] leading-[1.4] text-[#837b95]">
                      {benefit.description}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

type FilterOption = { value: string; label: string; hint?: string };

function uniqueOptions(options: FilterOption[]): FilterOption[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (!option.value || seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
}

function uniqueOrganizations(events: DiscoveryEvent[]) {
  const organizations = new Map<string, { id: string; name: string }>();
  events.forEach((event) =>
    organizations.set(event.organization.id, event.organization),
  );
  return [...organizations.values()];
}

function announcementTimestamp(announcement: AdminAnnouncement) {
  return new Date(announcement.publishedAt ?? announcement.createdAt).getTime();
}

function withAllOption(
  options: FilterOption[],
  allLabel: string,
): SelectMenuOption[] {
  return [{ value: '', label: allLabel }, ...options];
}
