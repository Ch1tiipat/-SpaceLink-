'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BellRing,
  CalendarSearch,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Headphones,
  MapPin,
  MapPinned,
  Search,
  ShieldCheck,
  Store,
  type LucideIcon,
} from 'lucide-react';
import { SelectMenu, type SelectMenuOption } from '@/components/select-menu';
import {
  getEventMap,
  getEvents,
  getPublicAnnouncements,
  type AdminAnnouncement,
  type DiscoveryEvent,
  type EventZone,
} from '@/lib/api';
import { getEventCoverUrl } from '@/lib/event-cover';
import { hasEventEndCalendarDayPassed } from '@/lib/event-time';
import {
  EMPTY_HOME_EVENT_FILTERS,
  filterHomeEvents,
  provinceFromAddress,
  type EventStatusFilter,
  type HomeEventFilters,
} from '@/lib/home-event-filters';
import { isEventBookable } from '@/lib/event-booking-rules';

type PublicAnnouncement = AdminAnnouncement & { organizationName: string };

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
      setAnnouncementsLoading(false);
      return () => controller.abort();
    }

    setAnnouncementsLoading(true);

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
        setAnnouncements(
          results
            .flatMap((result) =>
              result.status === 'fulfilled' ? result.value : [],
            )
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

  const filters = useMemo(
    () => ({
      events: uniqueOptions([
        ...events.map((event) => ({
          value: event.name,
          label: event.name,
          hint: `Event · ${event.venue.name}`,
        })),
        ...events.map((event) => ({
          value: event.venue.name,
          label: event.venue.name,
          hint: 'สถานที่จัดงาน',
        })),
      ]),
      areas: uniqueOptions(
        events.flatMap((event) => {
          const address = event.venue.address?.trim() ?? '';
          const province = provinceFromAddress(address);
          return [province, event.venue.name, address]
            .filter(Boolean)
            .map((area) => ({ value: area, label: area }));
        }),
      ),
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
    <main className="sl-page pb-10">
      <section className="shell pt-8">
        <section className="relative flex min-h-[440px] items-center overflow-hidden rounded-[32px] bg-[#f5ecff] px-[clamp(24px,4vw,58px)] py-12 shadow-[0_28px_70px_rgba(62,37,99,0.12)] max-sm:min-h-[460px] max-sm:items-start max-sm:rounded-[24px] max-sm:py-10">
          <div
            aria-hidden
            className="absolute inset-y-0 right-0 w-[76%] bg-[url('/home-hero.jpg')] bg-cover bg-[center_45%] max-sm:w-full"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(90deg,#fcfaff_0%,rgba(250,246,255,.98)_30%,rgba(246,237,255,.88)_46%,rgba(246,237,255,.27)_72%,transparent_100%)] max-sm:bg-[linear-gradient(180deg,rgba(252,250,255,.98)_0%,rgba(250,246,255,.94)_55%,rgba(246,237,255,.28)_100%)]"
          />
          <div className="relative z-[1] w-[62%] max-w-[660px] max-md:w-[75%] max-sm:w-full">
            <span className="inline-flex min-h-[30px] items-center rounded-full border border-[#decdf7] bg-white/80 px-[13px] py-1.5 text-sm font-bold text-[#5d2bc6]">
              พื้นที่ที่ใช่ เชื่อมโอกาสใหม่ให้ร้านคุณ
            </span>
            <h1 className="my-5 text-[clamp(42px,4.6vw,72px)] font-black leading-[1.09] tracking-[-0.045em] text-[#171024] max-sm:text-[42px]">
              ค้นหาพื้นที่ขาย
              <br />
              <span className="bg-[linear-gradient(90deg,#4b21c6,#723adf,#a45fff)] bg-clip-text text-transparent">
                ที่เหมาะกับร้านคุณ
              </span>
            </h1>
            <p className="max-w-[580px] text-base leading-[1.8] text-[#514664] max-sm:text-sm">
              รวมงานแฟร์และอีเวนต์ชั้นนำ เลือกโซน ดูบูธว่าง
              และตรวจสอบพื้นที่ได้จากแผนผังจริง
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#eventSearch"
                className="sl-action-primary inline-flex min-h-12 items-center gap-2 px-5"
              >
                เริ่มสำรวจพื้นที่ <ArrowRight aria-hidden className="h-4 w-4" />
              </a>
              <a
                href="#events"
                className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[#cdbaf4] bg-white/90 px-5 text-sm font-bold text-[#6030d0] transition hover:bg-white"
              >
                ค้นหา Event <CalendarSearch aria-hidden className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>

        <form
          id="eventSearch"
          className="sl-surface relative z-30 mx-[18px] -mt-[22px] grid scroll-mt-24 grid-cols-[minmax(0,1.25fr)_minmax(135px,.75fr)_minmax(160px,.8fr)_minmax(155px,.8fr)_auto] gap-[10px] overflow-visible p-[18px] max-xl:grid-cols-3 max-md:grid-cols-2 max-sm:mx-[7px] max-sm:-mt-[13px] max-sm:grid-cols-1 max-sm:rounded-[19px] max-sm:p-3"
          onSubmit={(event) => {
            event.preventDefault();
            runSearch();
          }}
        >
          <SearchableFilterInput
            id="home-event-query"
            label="งานหรือสถานที่"
            placeholder="พิมพ์ชื่องานหรือสถานที่"
            value={draftFilters.query}
            onChange={(query) =>
              setDraftFilters((current) => ({ ...current, query }))
            }
            suggestions={filters.events.map((option) => option.label)}
            icon={Search}
          />
          <SearchableFilterInput
            id="home-area-query"
            label="พื้นที่"
            placeholder="พิมพ์จังหวัดหรือพื้นที่"
            value={draftFilters.area}
            onChange={(area) =>
              setDraftFilters((current) => ({ ...current, area }))
            }
            suggestions={filters.areas.map((option) => option.label)}
            icon={MapPin}
          />
          <SelectMenu
            label="หมวดสินค้า"
            placeholder="ทุกหมวดสินค้า"
            className="[&_button]:min-h-[66px]"
            value={draftFilters.categoryId}
            onChange={(categoryId) =>
              setDraftFilters((current) => ({ ...current, categoryId }))
            }
            options={withAllOption(filters.categories, 'ทุกหมวดสินค้า')}
          />
          <SelectMenu
            label="สถานะ Event"
            placeholder="ทุกสถานะ"
            className="[&_button]:min-h-[66px]"
            value={draftFilters.eventStatus}
            onChange={(value) =>
              setDraftFilters((current) => ({
                ...current,
                eventStatus: value as EventStatusFilter,
              }))
            }
            options={[
              { value: 'all', label: 'ทุกสถานะ' },
              { value: 'bookable', label: 'เปิดจอง' },
              { value: 'ongoing', label: 'กำลังจัดงาน' },
              { value: 'ended', label: 'สิ้นสุดแล้ว' },
            ]}
          />
          <button
            type="submit"
            className="sl-action-primary min-h-[66px] self-end whitespace-nowrap px-6 max-xl:w-full"
          >
            ดูผลการค้นหา
          </button>
        </form>
      </section>

      <section
        className="shell !mt-[52px] max-sm:!mt-[38px]"
        aria-labelledby="announcements-heading"
      >
        <div className="mb-[18px] flex items-end justify-between gap-5">
          <div>
            <span className="sl-kicker">ข่าวสารล่าสุด</span>
            <h2
              id="announcements-heading"
              className="mt-[7px] text-[26px] font-black tracking-[-0.025em]"
            >
              ประกาศจากผู้จัดงาน
            </h2>
            <p className="mt-1 text-xs text-muted">
              อัปเดตจากองค์กรที่มี Event บน SpaceLink
            </p>
          </div>
          {announcements.length > 1 ? (
            <div
              className="flex gap-1"
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
        {announcementsLoading ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <span
                key={item}
                className="skeleton block h-[230px] rounded-[22px]"
              />
            ))}
          </div>
        ) : announcements.length === 0 ? (
          <div className="sl-surface p-8 text-center text-sm text-muted">
            ยังไม่มีประกาศใหม่ในขณะนี้
          </div>
        ) : (
          <div
            ref={announcementsScrollerRef}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-3 [scrollbar-width:thin] [scrollbar-color:#c4b5fd_transparent]"
            aria-label="ประกาศล่าสุด เลื่อนซ้ายหรือขวาเพื่อดูเพิ่มเติม"
          >
            {announcements.map((announcement, index) => (
              <div
                key={announcement.id}
                className="min-w-[86%] snap-start sm:min-w-[calc(50%-8px)] lg:min-w-[calc((100%-32px)/3)]"
              >
                <AnnouncementCard
                  announcement={announcement}
                  index={index}
                  onOpen={openAnnouncement}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section
        id="events"
        className="shell !mt-[56px] scroll-mt-24 max-sm:!mt-[42px]"
        aria-labelledby="events-heading"
      >
        <span className="sl-kicker">ค้นหา Event</span>
        <h2
          id="events-heading"
          className="mb-[18px] mt-[7px] text-[26px] font-black tracking-[-0.025em]"
        >
          งานที่เหมาะกับร้านของคุณ
        </h2>
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
      <HomepageCallToAction />
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
    </main>
  );
}

function AnnouncementCard({
  announcement,
  index,
  onOpen,
}: {
  announcement: PublicAnnouncement;
  index: number;
  onOpen: (announcement: PublicAnnouncement, opener: HTMLButtonElement) => void;
}) {
  const tones = [
    'bg-[linear-gradient(135deg,#3b176c,#8959f3,#3a8079)]',
    'bg-[linear-gradient(135deg,#187250,#64a76e)]',
    'bg-[linear-gradient(135deg,#994b34,#e89a58)]',
  ];
  const cover = tones[index % tones.length];

  return (
    <article className="sl-surface relative h-full overflow-hidden transition hover:-translate-y-0.5 hover:shadow-soft">
      <div
        className={`flex min-h-[130px] items-end p-[17px] text-white ${cover}`}
      >
        <strong className="text-[23px]">ประกาศ</strong>
      </div>
      <span className="absolute right-[13px] top-[13px] rounded-full bg-[#f5efff] px-[9px] py-[5px] text-sm font-bold text-[#6d28d9]">
        ข่าวงาน
      </span>
      <div className="p-[17px]">
        <h3 className="text-[15px] font-extrabold">{announcement.title}</h3>
        <p className="mt-1.5 min-h-[38px] line-clamp-2 text-sm leading-[1.65] text-muted">
          {announcement.body}
        </p>
        <p className="mt-2 text-xs text-muted">
          {announcement.organizationName}
        </p>
        <button
          type="button"
          onClick={(event) => onOpen(announcement, event.currentTarget)}
          className="mt-3 inline-block text-sm font-bold text-[#6d28d9] hover:underline"
        >
          ดูเพิ่มเติม →
        </button>
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
          ดูรายละเอียด →
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
    action: string;
  }> = [
    {
      number: '01',
      title: 'ค้นหา Event ที่เหมาะกับร้าน',
      description:
        'ค้นหาจากชื่องาน พื้นที่ หรือหมวดสินค้า เพื่อดูงานที่ตรงกับรูปแบบร้านของคุณ',
      icon: CalendarSearch,
      href: '#eventSearch',
      action: 'เริ่มค้นหา',
    },
    {
      number: '02',
      title: 'เลือก Zone และ Booth จากแผนผัง',
      description:
        'ดูตำแหน่ง ราคา และสถานะบูธบนแผนผัง ก่อนเลือกพื้นที่ที่เหมาะกับการขาย',
      icon: MapPinned,
      href: event ? `/events/${encodeURIComponent(event.slug)}/map` : '#events',
      action: 'ดูตัวอย่างแผนผัง',
    },
    {
      number: '03',
      title: 'ชำระเงินและติดตามสถานะ',
      description:
        'ตรวจสอบรายละเอียดการจอง ส่งหลักฐานการชำระเงิน และติดตามสถานะได้ในที่เดียว',
      icon: CreditCard,
      href: '/bookings',
      action: 'ดูการจองของฉัน',
    },
  ];

  return (
    <section
      className="shell !mt-[72px] max-sm:!mt-[48px]"
      aria-labelledby="booking-journey-heading"
    >
      <div className="mx-auto max-w-[680px] text-center">
        <span className="sl-kicker">วิธีการจอง</span>
        <h2
          id="booking-journey-heading"
          className="mt-2 text-[clamp(27px,3vw,36px)] font-black tracking-[-0.035em]"
        >
          จองพื้นที่ขายได้ใน 3 ขั้นตอน
        </h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          ตั้งแต่ค้นหางานจนถึงติดตามการจอง ทุกขั้นตอนอยู่ใน SpaceLink
        </p>
      </div>

      <div className="relative mt-7 grid gap-4 lg:grid-cols-3">
        <span
          aria-hidden
          className="absolute left-[16%] right-[16%] top-10 hidden border-t border-dashed border-[#d8cbea] lg:block"
        />
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <article
              key={step.number}
              className="sl-surface group relative overflow-hidden p-6 transition hover:-translate-y-1 hover:shadow-soft"
            >
              <div className="relative z-[1] flex items-center justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[linear-gradient(135deg,#f1e8ff,#e9f7f3)] text-[#6d28d9] shadow-[0_8px_22px_rgba(109,40,217,0.10)]">
                  <Icon aria-hidden className="h-5 w-5" />
                </span>
                <span className="text-[34px] font-black tracking-[-0.06em] text-[#eee8f5]">
                  {step.number}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-extrabold tracking-[-0.02em]">
                {step.title}
              </h3>
              <p className="mt-2 min-h-[68px] text-[12px] leading-7 text-muted">
                {step.description}
              </p>
              <Link
                href={step.href}
                className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-[#6d28d9] transition group-hover:gap-3"
              >
                {step.action} <ArrowRight aria-hidden className="h-3.5 w-3.5" />
              </Link>
            </article>
          );
        })}
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
      title: 'ข้อมูลบูธชัดเจน',
      description: 'ดูตำแหน่ง ราคา และสถานะว่างจากแผนผังของผู้จัดงาน',
      icon: MapPinned,
    },
    {
      title: 'จัดการร้านได้ในโปรไฟล์เดียว',
      description: 'เตรียมข้อมูลร้านและใช้ประกอบการจองพื้นที่ของคุณ',
      icon: Store,
    },
    {
      title: 'ไม่พลาดสถานะสำคัญ',
      description: 'ติดตามการจอง การชำระเงิน และการแจ้งเตือนจากระบบ',
      icon: BellRing,
    },
    {
      title: 'มีช่องทางช่วยเหลือ',
      description: 'เปิดหน้าช่วยเหลือเมื่อมีคำถามเกี่ยวกับการใช้งานและการจอง',
      icon: Headphones,
    },
  ];

  return (
    <section
      className="shell !mt-[56px] max-sm:!mt-[42px]"
      aria-labelledby="benefit-heading"
    >
      <div className="relative overflow-hidden rounded-[30px] bg-[linear-gradient(120deg,#201132_0%,#3c1d69_55%,#245b5b_100%)] px-8 py-10 text-white shadow-[0_28px_70px_rgba(45,25,73,0.16)] max-sm:rounded-[24px] max-sm:px-5 max-sm:py-7">
        <span
          aria-hidden
          className="absolute -right-20 -top-24 h-72 w-72 rounded-full border-[50px] border-white/[0.035]"
        />
        <div className="relative grid items-center gap-8 lg:grid-cols-[.72fr_1.28fr]">
          <div>
            <span className="text-sm font-extrabold uppercase tracking-[0.14em] text-[#c8a9ff]">
              ทำไมต้อง SpaceLink
            </span>
            <h2
              id="benefit-heading"
              className="mt-3 text-[clamp(28px,3vw,38px)] font-black leading-[1.25] tracking-[-0.04em]"
            >
              เตรียมร้านให้พร้อม
              <br className="max-lg:hidden" /> ก่อนออกงาน
            </h2>
            <p className="mt-3 max-w-[430px] text-sm leading-7 text-white/70">
              เครื่องมือที่ช่วยให้คุณเห็นข้อมูลที่ต้องใช้ตัดสินใจ
              และกลับมาติดตามทุกการจองได้ง่ายขึ้น
            </p>
            <Link
              href="/help"
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-xs font-bold text-white transition hover:bg-white/15"
            >
              ศูนย์ช่วยเหลือ <ArrowRight aria-hidden className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {benefits.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <article
                  key={benefit.title}
                  className="rounded-[18px] border border-white/10 bg-white/[0.075] p-5 backdrop-blur-sm"
                >
                  <Icon aria-hidden className="h-5 w-5 text-[#cdb3ff]" />
                  <h3 className="mt-4 text-sm font-extrabold text-white">
                    {benefit.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-6 text-white/65">
                    {benefit.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function HomepageCallToAction() {
  return (
    <section
      className="shell !mb-[40px] !mt-[48px] max-sm:!mb-[24px] max-sm:!mt-[36px]"
      aria-labelledby="homepage-cta-heading"
    >
      <div className="sl-surface relative overflow-hidden px-8 py-9 max-sm:px-5">
        <span
          aria-hidden
          className="absolute -bottom-28 -right-10 h-64 w-64 rounded-full bg-[radial-gradient(circle,#e8dcff_0%,rgba(232,220,255,0)_70%)]"
        />
        <div className="relative flex items-center justify-between gap-7 max-md:flex-col max-md:items-start">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#f1e9ff] text-[#6d28d9]">
              <ShieldCheck aria-hidden className="h-6 w-6" />
            </span>
            <div>
              <span className="sl-kicker">เริ่มสำรวจพื้นที่</span>
              <h2
                id="homepage-cta-heading"
                className="mt-1.5 text-[clamp(23px,2.8vw,31px)] font-black tracking-[-0.035em]"
              >
                พร้อมหาพื้นที่ใหม่ให้ร้านของคุณแล้วหรือยัง?
              </h2>
              <p className="mt-2 text-xs leading-6 text-muted">
                เลือกดู Event และตรวจสอบ Booth
                จากข้อมูลที่ผู้จัดงานเผยแพร่ในระบบ
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2.5 max-sm:w-full">
            <a
              href="#eventSearch"
              className="sl-action-primary min-h-11 px-5 max-sm:flex-1"
            >
              ค้นหา Event
            </a>
            <Link
              href="/bookings"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#ded5e9] bg-white px-5 text-xs font-bold text-[#4e415c] transition hover:border-[#a98ae2] hover:text-[#6d28d9] max-sm:flex-1"
            >
              การจองของฉัน
            </Link>
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

function SearchableFilterInput({
  id,
  label,
  placeholder,
  value,
  suggestions,
  icon: Icon,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  suggestions: string[];
  icon: LucideIcon;
  onChange: (value: string) => void;
}) {
  const listId = `${id}-suggestions`;

  return (
    <label htmlFor={id} className="grid gap-1.5">
      <span className="text-xs font-extrabold text-[#62576d]">{label}</span>
      <span className="relative block">
        <Icon
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-violet"
        />
        <input
          id={id}
          type="search"
          list={listId}
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="min-h-[66px] w-full rounded-2xl border border-[#ded5e9] bg-white py-3 pl-11 pr-4 text-base font-semibold text-ink outline-none transition placeholder:font-medium placeholder:text-[#9a91a3] hover:border-[#cab9e5] focus:border-violet focus:ring-4 focus:ring-violet/10"
        />
        <datalist id={listId}>
          {suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      </span>
    </label>
  );
}
