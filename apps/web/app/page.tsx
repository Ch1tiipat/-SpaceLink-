"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BellRing,
  CalendarSearch,
  CreditCard,
  Headphones,
  MapPinned,
  ShieldCheck,
  Store,
  type LucideIcon,
} from "lucide-react";
import { SelectMenu, type SelectMenuOption } from "@/components/select-menu";
import {
  getEventMap,
  getEvents,
  getPublicAnnouncements,
  type AdminAnnouncement,
  type DiscoveryEvent,
  type EventZone,
} from "@/lib/api";
import { isEventBookable } from "@/lib/event-booking-rules";

type PublicAnnouncement = AdminAnnouncement & { organizationName: string };
type UpdateFilter = "all" | "event" | "announcement";
type Update =
  | { kind: "event"; event: DiscoveryEvent }
  | { kind: "announcement"; announcement: PublicAnnouncement };

const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function provinceFromAddress(address: string): string {
  const prefixed = /จังหวัด(\S+)/.exec(address);
  if (prefixed) return prefixed[1];
  if (address.includes("กรุงเทพมหานคร")) return "กรุงเทพมหานคร";
  return address;
}

function formatDateRange(event: DiscoveryEvent) {
  return `${dateFormatter.format(new Date(event.startDate))} – ${dateFormatter.format(
    new Date(event.endDate),
  )}`;
}

export default function DiscoveryPage() {
  const [events, setEvents] = useState<DiscoveryEvent[]>([]);
  const [announcements, setAnnouncements] = useState<PublicAnnouncement[]>([]);
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [updateFilter, setUpdateFilter] = useState<UpdateFilter>("all");
  const [searchApplied, setSearchApplied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getEvents(controller.signal)
      .then(setEvents)
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError")
          return;
        setError(
          cause instanceof Error ? cause.message : "โหลดข้อมูลไม่สำเร็จ",
        );
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const organizations = uniqueOrganizations(events);
    if (organizations.length === 0) return () => controller.abort();

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
    ).then((results) => {
      if (controller.signal.aborted) return;
      setAnnouncements(
        results
          .flatMap((result) =>
            result.status === "fulfilled" ? result.value : [],
          )
          .sort(
            (left, right) =>
              announcementTimestamp(right) - announcementTimestamp(left),
          ),
      );
    });

    return () => controller.abort();
  }, [events]);

  const filters = useMemo(
    () => ({
      events: uniqueOptions(
        events.map((event) => ({
          value: event.name,
          label: event.name,
          hint: event.venue.name,
        })),
      ),
      areas: uniqueOptions(
        events
          .filter((event) => event.venue.address)
          .map((event) => {
            const province = provinceFromAddress(event.venue.address ?? "");
            return { value: province, label: province };
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

  const visibleEvents = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("th");
    return events.filter((event) => {
      const searchable =
        `${event.name} ${event.description ?? ""} ${event.organization.name} ${event.venue.name}`.toLocaleLowerCase(
          "th",
        );
      return (
        (!keyword || searchable.includes(keyword)) &&
        (!area || provinceFromAddress(event.venue.address ?? "") === area) &&
        (!categoryId ||
          event.categories.some((category) => category.id === categoryId))
      );
    });
  }, [area, categoryId, events, query]);

  const updates = useMemo<Update[]>(() => {
    if (searchApplied) {
      return visibleEvents
        .slice(0, 3)
        .map((event) => ({ kind: "event", event }));
    }

    return [
      ...events.slice(0, 3).map((event): Update => ({ kind: "event", event })),
      ...announcements
        .slice(0, 3)
        .map((announcement): Update => ({
          kind: "announcement",
          announcement,
        })),
    ]
      .filter(
        (update) => updateFilter === "all" || update.kind === updateFilter,
      )
      .slice(0, 3);
  }, [announcements, events, searchApplied, updateFilter, visibleEvents]);

  function runSearch() {
    setSearchApplied(true);
    window.requestAnimationFrame(() => {
      document
        .getElementById("latest-updates")
        ?.scrollIntoView({ block: "start" });
    });
  }

  return (
    <main className="sl-page pb-10">
      <section className="shell pt-8">
        <section className="relative flex min-h-[350px] items-center overflow-hidden rounded-[32px] bg-[linear-gradient(105deg,#24103e_0%,#4e1e96_53%,#386568_100%)] p-[44px] text-white shadow-[0_28px_70px_rgba(62,37,99,0.16)] max-sm:min-h-[390px] max-sm:items-end max-sm:rounded-[24px] max-sm:px-[22px] max-sm:py-7">
          <div className="relative z-[5] w-[57%] max-w-[600px] max-md:w-[68%] max-sm:w-full">
            <span className="inline-flex min-h-[30px] items-center rounded-full border border-white/25 bg-white/[0.13] px-[13px] py-1.5 text-sm font-bold">
              พื้นที่ที่ใช่ เชื่อมโอกาสใหม่ให้ร้านคุณ
            </span>
            <h1 className="my-[14px] text-[clamp(36px,4vw,48px)] font-black leading-[1.12] tracking-[-0.045em] text-white max-sm:text-[34px]">
              ค้นหาพื้นที่ขายที่
              <br />
              เหมาะกับร้านคุณ
            </h1>
            <p className="max-w-[550px] text-sm leading-[1.8] text-white/85">
              รวมงานแฟร์และอีเวนต์ชั้นนำ เลือกโซน ดูบูธว่าง
              และตรวจสอบพื้นที่ได้จากแผนผังจริง
            </p>
            <a
              href="#eventSearch"
              className="mt-5 inline-flex min-h-[45px] items-center justify-center gap-[9px] rounded-[13px] bg-white px-[18px] text-[13px] font-bold text-[#6d28d9] shadow-[0_9px_25px_rgba(19,10,38,0.13)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(19,10,38,0.18)]"
            >
              เริ่มสำรวจพื้นที่ <ArrowRight aria-hidden className="h-4 w-4" />
            </a>
          </div>

          <div
            aria-hidden
            className="absolute inset-y-0 right-0 left-[55%] max-sm:hidden"
          >
            <span className="absolute bottom-[22%] left-[20%] h-[92px] w-[110px] -rotate-[4deg] rounded-[8px_8px_5px_5px] bg-[linear-gradient(#e28a8c,#c85c7a)] shadow-[0_18px_32px_rgba(18,9,32,0.18)]">
              <span className="absolute inset-x-0 top-0 h-[25px] overflow-hidden rounded-[9px_9px_2px_2px] bg-[repeating-linear-gradient(90deg,#fff_0_18px,#8b5cf6_18px_36px)]" />
            </span>
            <span className="absolute bottom-[29%] right-[10%] h-[92px] w-[110px] rotate-[4deg] rounded-[8px_8px_5px_5px] bg-[linear-gradient(#72c9b2,#27876d)] shadow-[0_18px_32px_rgba(18,9,32,0.18)]">
              <span className="absolute inset-x-0 top-0 h-[25px] overflow-hidden rounded-[9px_9px_2px_2px] bg-[repeating-linear-gradient(90deg,#fff_0_18px,#8b5cf6_18px_36px)]" />
            </span>
            <span className="absolute -bottom-[130px] -right-[10%] left-[10%] h-[260px] -rotate-[7deg] rounded-[50%] bg-white/[0.04]" />
          </div>
        </section>

        <form
          id="eventSearch"
          className="sl-surface relative z-30 mx-[18px] -mt-[18px] grid scroll-mt-24 grid-cols-[minmax(0,1.4fr)_minmax(170px,.8fr)_minmax(190px,.8fr)_auto] gap-[10px] overflow-visible p-[15px] max-lg:grid-cols-2 max-sm:mx-[7px] max-sm:-mt-[13px] max-sm:grid-cols-1 max-sm:rounded-[19px] max-sm:p-3"
          onSubmit={(event) => {
            event.preventDefault();
            runSearch();
          }}
        >
          <SelectMenu
            label="งานหรือสถานที่"
            placeholder="เลือกงานหรือสถานที่"
            value={query}
            onChange={(value) => {
              setQuery(value);
              setSearchApplied(false);
            }}
            options={withAllOption(filters.events, "งานหรือสถานที่ทั้งหมด")}
          />
          <SelectMenu
            label="พื้นที่"
            placeholder="ทุกพื้นที่"
            value={area}
            onChange={(value) => {
              setArea(value);
              setSearchApplied(false);
            }}
            options={withAllOption(filters.areas, "ทุกพื้นที่")}
          />
          <SelectMenu
            label="หมวดสินค้า"
            placeholder="ทุกหมวดสินค้า"
            value={categoryId}
            onChange={(value) => {
              setCategoryId(value);
              setSearchApplied(false);
            }}
            options={withAllOption(filters.categories, "ทุกหมวดสินค้า")}
          />
          <button
            type="submit"
            className="sl-action-primary min-h-[45px] self-end whitespace-nowrap px-6 max-lg:w-full"
          >
            ค้นหา Event
          </button>
        </form>
      </section>

      <section
        id="latest-updates"
        className="shell !mt-[52px] scroll-mt-24 max-sm:!mt-[38px]"
        aria-labelledby="latest-heading"
      >
        <div className="mb-[18px] flex items-end justify-between gap-5 max-md:flex-col max-md:items-start">
          <div>
            <span className="sl-kicker">Latest updates</span>
            <h2
              id="latest-heading"
              className="mt-[7px] text-[26px] font-black tracking-[-0.025em]"
            >
              {searchApplied ? "ผลการค้นหา Event" : "ข่าวสารและ Event ล่าสุด"}
            </h2>
            <p className="mt-1 text-xs text-muted">
              {searchApplied
                ? `พบ ${visibleEvents.length} Event จากข้อมูล SpaceLink`
                : "รายการ Event และข่าวสารล่าสุดของ SpaceLink"}
            </p>
          </div>
          <div
            className="flex flex-wrap gap-[7px]"
            role="group"
            aria-label="กรองข่าวสารล่าสุด"
          >
            {(
              [
                ["all", "ทั้งหมด"],
                ["event", "Event"],
                ["announcement", "ประกาศ"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={updateFilter === value}
                onClick={() => {
                  setSearchApplied(false);
                  setUpdateFilter(value);
                }}
                className={`sl-chip min-h-9 px-4 ${updateFilter === value ? "!border-violet !bg-violet !text-white" : ""}`}
              >
                {label}
              </button>
            ))}
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
        ) : updates.length === 0 ? (
          <div className="sl-surface p-8 text-center text-sm text-muted">
            ยังไม่พบรายการที่ตรงกับตัวกรอง
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {updates.map((update, index) => (
              <LatestCard
                key={
                  update.kind === "event"
                    ? update.event.id
                    : update.announcement.id
                }
                update={update}
                index={index}
              />
            ))}
          </div>
        )}
      </section>

      {events[0] && <PopularAreaRecommendations event={events[0]} />}

      <BookingJourney event={events[0]} />
      <PlatformBenefits />
      <HomepageCallToAction />
    </main>
  );
}

function LatestCard({ update, index }: { update: Update; index: number }) {
  const tones = [
    "bg-[linear-gradient(135deg,#3b176c,#8959f3,#3a8079)]",
    "bg-[linear-gradient(135deg,#187250,#64a76e)]",
    "bg-[linear-gradient(135deg,#994b34,#e89a58)]",
  ];
  const cover = tones[index % tones.length];

  if (update.kind === "announcement") {
    return (
      <article className="sl-surface relative overflow-hidden transition hover:-translate-y-0.5 hover:shadow-soft">
        <div
          className={`flex min-h-[130px] items-end p-[17px] text-white ${cover}`}
        >
          <strong className="text-[23px]">ประกาศ</strong>
        </div>
        <span className="absolute right-[13px] top-[13px] rounded-full bg-[#f5efff] px-[9px] py-[5px] text-sm font-bold text-[#6d28d9]">
          ข่าวงาน
        </span>
        <div className="p-[17px]">
          <h3 className="text-[15px] font-extrabold">
            {update.announcement.title}
          </h3>
          <p className="mt-1.5 min-h-[38px] line-clamp-2 text-sm leading-[1.65] text-muted">
            {update.announcement.body}
          </p>
          <span className="mt-3 inline-block text-sm font-bold text-[#6d28d9]">
            อ่านประกาศ →
          </span>
        </div>
      </article>
    );
  }

  const { event } = update;
  const bookable = isEventBookable(event);
  return (
    <Link
      href={`/events/${event.id}`}
      className="sl-surface relative overflow-hidden text-inherit transition hover:-translate-y-0.5 hover:shadow-soft"
    >
      <div
        className={`flex min-h-[130px] items-end p-[17px] text-white ${cover}`}
      >
        <strong className="text-[23px]">{formatDateRange(event)}</strong>
      </div>
      <span
        className={`absolute right-[13px] top-[13px] rounded-full px-[9px] py-[5px] text-sm font-bold ${bookable ? "bg-[#ecfff3] text-[#16723f]" : "bg-[#f1eef2] text-[#756c79]"}`}
      >
        {bookable ? "เปิดจอง" : "ปิดรับจอง"}
      </span>
      <div className="p-[17px]">
        <h3 className="text-[15px] font-extrabold">{event.name}</h3>
        <p className="mt-1.5 min-h-[38px] text-sm leading-[1.65] text-muted">
          {event.venue.name} · {provinceFromAddress(event.venue.address ?? "")}
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
        if (cause instanceof DOMException && cause.name === "AbortError")
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
      <span className="sl-kicker">Recommended locations</span>
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
            (booth) => booth.availability === "AVAILABLE",
          ).length;
          return (
            <Link
              key={zone.id}
              href={`/events/${event.id}/map?zone=${encodeURIComponent(zone.code)}`}
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
      number: "01",
      title: "ค้นหา Event ที่เหมาะกับร้าน",
      description:
        "ค้นหาจากชื่องาน พื้นที่ หรือหมวดสินค้า เพื่อดูงานที่ตรงกับรูปแบบร้านของคุณ",
      icon: CalendarSearch,
      href: "#eventSearch",
      action: "เริ่มค้นหา",
    },
    {
      number: "02",
      title: "เลือก Zone และ Booth จากแผนผัง",
      description:
        "ดูตำแหน่ง ราคา และสถานะบูธบนแผนผัง ก่อนเลือกพื้นที่ที่เหมาะกับการขาย",
      icon: MapPinned,
      href: event ? `/events/${event.id}/map` : "#latest-updates",
      action: "ดูตัวอย่างแผนผัง",
    },
    {
      number: "03",
      title: "ชำระเงินและติดตามสถานะ",
      description:
        "ตรวจสอบรายละเอียดการจอง ส่งหลักฐานการชำระเงิน และติดตามสถานะได้ในที่เดียว",
      icon: CreditCard,
      href: "/bookings",
      action: "ดูการจองของฉัน",
    },
  ];

  return (
    <section
      className="shell !mt-[72px] max-sm:!mt-[48px]"
      aria-labelledby="booking-journey-heading"
    >
      <div className="mx-auto max-w-[680px] text-center">
        <span className="sl-kicker">How it works</span>
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
      title: "ข้อมูลบูธชัดเจน",
      description: "ดูตำแหน่ง ราคา และสถานะว่างจากแผนผังของผู้จัดงาน",
      icon: MapPinned,
    },
    {
      title: "จัดการร้านได้ในโปรไฟล์เดียว",
      description: "เตรียมข้อมูลร้านและใช้ประกอบการจองพื้นที่ของคุณ",
      icon: Store,
    },
    {
      title: "ไม่พลาดสถานะสำคัญ",
      description: "ติดตามการจอง การชำระเงิน และการแจ้งเตือนจากระบบ",
      icon: BellRing,
    },
    {
      title: "มีช่องทางช่วยเหลือ",
      description: "เปิดหน้าช่วยเหลือเมื่อมีคำถามเกี่ยวกับการใช้งานและการจอง",
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
              Why SpaceLink
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
              <span className="sl-kicker">Ready to explore</span>
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
  return [{ value: "", label: allLabel }, ...options];
}
