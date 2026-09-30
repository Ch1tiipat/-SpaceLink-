'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Camera,
  CalendarDays,
  CalendarSearch,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  CreditCard,
  FileText,
  Grid2X2,
  Home,
  Mail,
  Megaphone,
  MessageCircle,
  Phone,
  Search,
  ShieldCheck,
  Store,
  UserRoundCheck,
  WalletCards,
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
                className="w-[min(310px,85vw)] shrink-0 snap-start sm:w-[min(340px,47vw)] lg:w-[calc((100%-40px)/3)]"
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
              <EventCard key={event.id} event={event} />
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
        className="w-[min(620px,calc(100%-32px))] max-h-[calc(100dvh-32px)] rounded-[26px] border border-[#ded2f3] bg-white p-0 text-ink shadow-[0_30px_100px_rgba(28,15,58,.28)] backdrop:bg-[#1b1030]/65"
      >
        {selectedAnnouncement ? (
          <div className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <span className="rounded-full bg-violet-tint px-3 py-1 text-xs font-bold text-violet">
                ประกาศจากผู้จัดงาน
              </span>
              <button
                type="button"
                onClick={closeAnnouncement}
                aria-label="ปิดประกาศ"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-xl text-muted hover:text-violet"
              >
                ×
              </button>
            </div>
            <h2
              id="announcement-dialog-title"
              className="mt-5 text-2xl font-black leading-snug"
            >
              {selectedAnnouncement.title}
            </h2>
            <p className="mt-2 text-sm text-muted">
              {selectedAnnouncement.organizationName} ·{' '}
              {dateFormatter.format(
                new Date(
                  selectedAnnouncement.publishedAt ??
                    selectedAnnouncement.createdAt,
                ),
              )}
            </p>
            <p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-[#514664]">
              {selectedAnnouncement.body}
            </p>
            <div className="mt-7 border-t border-line pt-5 text-right">
              <button
                type="button"
                onClick={closeAnnouncement}
                className="sl-action-primary min-h-11 px-6"
              >
                ปิด
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
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
              <HomepageFooterLink href="https://www.facebook.com/" label="Facebook" icon="facebook" contact />
              <HomepageFooterLink href="https://www.instagram.com/" label="Instagram" icon={Camera} contact />
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
  icon: LucideIcon | 'facebook';
  contact?: boolean;
}) {
  const content = (
    <>
      <span className={contact
        ? 'grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e7dcff] text-[#753fe1]'
        : 'grid h-6 w-6 shrink-0 place-items-center text-[#8249ee]'}>
        {Icon === 'facebook' ? (
          <span aria-hidden className="text-xl font-black leading-none">f</span>
        ) : (
          <Icon aria-hidden className="h-[18px] w-[18px]" />
        )}
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
  return (
    <article className="flex h-[132px] overflow-hidden rounded-[12px] border border-[#8c789e] bg-[#ddccfa] text-[#452482] transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(92,52,155,.16)]">
      <div className="relative flex w-[32%] shrink-0 flex-col items-center justify-center bg-white p-2">
        <span className="absolute left-1.5 top-1.5 rounded-full bg-[#696969] px-2 py-1 text-[10px] font-bold text-white">
          {announcement.type === 'EVENT' ? 'Event' : 'ประกาศ'}
        </span>
        <Image
          src="/brand/spacelink-mark.png"
          alt=""
          width={54}
          height={54}
          className="h-[54px] w-[54px] object-contain"
        />
        <span className="text-[11px] font-black text-[#6d28d9]">SpaceLink</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col px-2.5 py-2">
        <h3 className="line-clamp-1 text-[15px] font-black">{announcement.title}</h3>
        <p className="line-clamp-1 text-[11px] font-semibold">
          {announcement.body}
        </p>
        <p className="mt-0.5 line-clamp-1 text-[10px]">
          {announcement.organizationName}
        </p>
        <div className="mt-auto flex items-end justify-between gap-1">
          <span className="text-[9px] leading-tight">
            {dateFormatter.format(
              new Date(announcement.publishedAt ?? announcement.createdAt),
            )}
          </span>
          <button
            type="button"
            onClick={(event) => onOpen(announcement, event.currentTarget)}
            className="shrink-0 rounded-full bg-[#bd97fa] px-2 py-1 text-[10px] font-bold text-white transition hover:bg-[#9866eb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet"
          >
            ดูเพิ่มเติม
          </button>
        </div>
      </div>
    </article>
  );
}

function EventCard({ event }: { event: DiscoveryEvent }) {
  const bookable = isEventBookable(event);
  return (
    <Link
      href={`/events/${encodeURIComponent(event.slug)}`}
      className="sl-surface relative block h-full overflow-hidden text-inherit transition hover:-translate-y-0.5 hover:shadow-soft"
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
    </Link>
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
              href="/register"
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-[linear-gradient(135deg,#8752ef,#642bd7)] px-6 text-sm font-bold text-white shadow-[0_10px_20px_rgba(109,40,217,.2)] transition hover:-translate-y-0.5"
            >
              เริ่มสร้างงานของคุณ <ArrowRight aria-hidden className="h-4 w-4" />
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
