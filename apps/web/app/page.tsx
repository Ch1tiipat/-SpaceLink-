'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUpRight,
  CalendarDays,
  MapPinned,
  Megaphone,
  Search,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { SelectMenu, type SelectMenuOption } from '@/components/select-menu';
import {
  getEvents,
  getPublicAnnouncements,
  type AdminAnnouncement,
  type DiscoveryEvent,
} from '@/lib/api';
import { useAuthState } from '@/lib/use-auth-state';

/** Anchor for the hero's "Explore Event" button. */
const EVENTS_SECTION_ID = 'events';

type PublicAnnouncement = AdminAnnouncement & {
  organizationName: string;
};

type UpdateFilter = 'all' | 'event' | 'announcement';

/**
 * `Venue` has no province column and the schema is frozen (§2.1), so the
 * province is recovered from the free-text address.
 *
 * Thai addresses spell it `จังหวัดนครราชสีมา` — prefix attached, no space —
 * except Bangkok, which is written `กรุงเทพมหานคร` with no prefix at all.
 * Anything matching neither keeps its full address as the option label: a
 * filter that silently dropped those events would hide real results, which is
 * worse than one ugly entry in the list.
 */
function provinceFromAddress(address: string): string {
  const prefixed = /จังหวัด(\S+)/.exec(address);
  if (prefixed) return prefixed[1];
  if (address.includes('กรุงเทพมหานคร')) return 'กรุงเทพมหานคร';
  return address;
}

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

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: 'เตรียมเปิดรับสมัคร',
    OPEN: 'เผยแพร่แล้ว',
    PUBLISHED: 'เผยแพร่แล้ว',
    ONGOING: 'กำลังจัดงาน',
    CLOSED: 'ปิดงาน',
    CANCELLED: 'ยกเลิก',
    COMPLETED: 'จบงานแล้ว',
  };

  return labels[status] ?? status;
}

export default function DiscoveryPage() {
  const { auth } = useAuthState();
  const [events, setEvents] = useState<DiscoveryEvent[]>([]);
  const [announcements, setAnnouncements] = useState<PublicAnnouncement[]>([]);
  const [query, setQuery] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [area, setArea] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [updateFilter, setUpdateFilter] = useState<UpdateFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      return () => controller.abort();
    }

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
            result.status === 'fulfilled' ? result.value : [],
          )
          .sort(
            (left, right) =>
              announcementTimestamp(right) - announcementTimestamp(left),
          ),
      );
    });

    return () => controller.abort();
  }, [events]);

  const latestUpdates = useMemo(() => {
    const updates = [
      ...announcements.slice(0, 3).map((announcement) => ({
        kind: 'announcement' as const,
        announcement,
      })),
      ...events.slice(0, 3).map((event) => ({
        kind: 'event' as const,
        event,
      })),
    ];

    return updates
      .filter((update) => updateFilter === 'all' || update.kind === updateFilter)
      .slice(0, 3);
  }, [announcements, events, updateFilter]);

  const visibleEvents = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('th');

    return events.filter((event) => {
      const matchesKeyword =
        !keyword ||
        `${event.name} ${event.description ?? ''} ${event.organization.name} ${
          event.venue.name
        }`
          .toLocaleLowerCase('th')
          .includes(keyword);
      const matchesOrganization =
        !organizationId || event.organization.id === organizationId;
      const matchesArea =
        !area ||
        (event.venue.address !== null &&
          provinceFromAddress(event.venue.address) === area);
      const matchesCategory =
        !categoryId ||
        event.categories.some((category) => category.id === categoryId);

      return (
        matchesKeyword && matchesOrganization && matchesArea && matchesCategory
      );
    });
  }, [area, categoryId, events, organizationId, query]);

  const filters = useMemo(
    () => ({
      organizations: uniqueOptions(
        events.map((event) => ({
          value: event.organization.id,
          label: event.organization.name,
        })),
      ),
      areas: uniqueOptions(
        events
          .filter((event) => event.venue.address)
          .map((event) => {
            const province = provinceFromAddress(event.venue.address ?? '');
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

  function showEventResults() {
    window.location.hash = EVENTS_SECTION_ID;
  }

  function showOrganizationEvents(nextOrganizationId: string) {
    setOrganizationId(nextOrganizationId);
    window.requestAnimationFrame(showEventResults);
  }

  return (
    <main className="sl-page">
      {/* `.hero` from the prototype: the photo carries no information the
          heading does not already state, so it is decorative (`alt=""`) and
          the gradient over it is what keeps the text legible. */}
      <section className="shell pt-7">
        <div className="relative flex min-h-[285px] items-end overflow-hidden rounded-[24px] border border-white/10 p-[25px] text-white shadow-[0_30px_80px_rgba(49,27,89,0.18)] sm:min-h-[345px] sm:rounded-[32px] sm:p-[46px]">
          <Image
            src="/hero-spacelink.png"
            alt=""
            fill
            priority
            sizes="(max-width: 1200px) 100vw, 1180px"
            className="object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(100deg,#21103df5_0%,#4C1D95d8_52%,#4C1D9540_100%)]"
          />

          <div className="relative max-w-[560px]">
            <span className="inline-flex rounded-full border border-white/25 bg-white/[0.14] px-3.5 py-1.5 text-xs font-extrabold backdrop-blur-md">
              พื้นที่ที่ใช่ เชื่อมโอกาสใหม่ให้ร้านคุณ
            </span>
            <h1 className="my-3 max-w-[14ch] text-[31px] font-black leading-[1.15] tracking-[-1px] sm:text-[44px] sm:tracking-[-1.6px]">
              ค้นหาพื้นที่ขายที่เหมาะกับร้านคุณ
            </h1>
            <p className="text-[13px] leading-relaxed text-[#E9E2F8] sm:text-[15px]">
              รวมงานแฟร์และอีเวนต์ชั้นนำ เลือกโซน ดูบูธว่าง
              และตรวจสอบพื้นที่ได้จากแผนผังจริง
            </p>

            {/* A plain anchor rather than a scroll handler: `scroll-behavior`
                is already smooth in `globals.css`, and its
                `prefers-reduced-motion` override then applies for free — which
                a scripted `scrollIntoView({ behavior: 'smooth' })` would
                bypass. */}
            <a
              href={`#${EVENTS_SECTION_ID}`}
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-[#5B21B6] shadow-lg transition hover:-translate-y-0.5"
            >
              Explore Event
              <ArrowDown aria-hidden className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* `.search`: overlaps the hero's lower edge, as in the prototype. */}
      <section className="shell relative z-10 -mt-7">
        <form
          className="sl-surface p-3.5"
          onSubmit={(event) => {
            event.preventDefault();
            showEventResults();
          }}
        >
          <label className="flex items-center gap-3 rounded-2xl border border-line bg-white p-2 pl-5 transition focus-within:border-[#d5cfdf] focus-within:shadow-[0_0_0_4px_rgba(96,79,122,0.05)]">
            <Search aria-hidden className="h-5 w-5 shrink-0 text-violet" />
            <span className="sr-only">ค้นหา Event</span>
            <input
              data-search-input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent py-2.5 text-base placeholder:text-muted focus:outline-none"
              placeholder="ค้นหาชื่องาน เช่น งานเกษตรแฟร์"
            />
            <button
              type="submit"
              className="sl-action-primary min-h-11 px-5 py-2.5"
            >
              ค้นหา
            </button>
          </label>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <SelectMenu
              label="ผู้จัดงาน"
              placeholder="ผู้จัดงาน: ทั้งหมด"
              value={organizationId}
              onChange={setOrganizationId}
              options={withAllOption(filters.organizations, 'ผู้จัดงาน: ทั้งหมด')}
            />
            <SelectMenu
              label="จังหวัด / พื้นที่"
              placeholder="จังหวัด / พื้นที่: ทั้งหมด"
              value={area}
              onChange={setArea}
              options={withAllOption(
                filters.areas,
                'จังหวัด / พื้นที่: ทั้งหมด',
              )}
            />
            <SelectMenu
              label="ประเภทสินค้า"
              placeholder="ประเภทสินค้า: ทั้งหมด"
              value={categoryId}
              onChange={setCategoryId}
              options={withAllOption(
                filters.categories,
                'ประเภทสินค้า: ทั้งหมด',
              )}
            />
          </div>
        </form>
      </section>

      <section className="shell py-12 sm:py-14" aria-labelledby="news-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="sl-kicker">
              <Megaphone className="h-4 w-4" aria-hidden />
              Latest updates
            </span>
            <h2 id="news-heading" className="mt-2 text-2xl font-black tracking-[-0.04em] sm:text-3xl">
              ข่าวสารและงานที่เปิดล่าสุด
            </h2>
          </div>
          <div
            className="flex rounded-2xl border border-line bg-white p-1 shadow-sm"
            role="group"
            aria-label="กรองข่าวสารล่าสุด"
          >
            {([
              ['all', 'ทั้งหมด'],
              ['event', 'Event'],
              ['announcement', 'ประกาศ'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={updateFilter === value}
                onClick={() => setUpdateFilter(value)}
                className={`min-h-9 rounded-xl px-3 text-xs font-extrabold transition sm:px-4 ${
                  updateFilter === value
                    ? 'bg-violet text-white shadow-sm'
                    : 'text-muted hover:bg-mist hover:text-violet'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <span key={item} className="skeleton block h-36 rounded-3xl" />
            ))}
          </div>
        ) : latestUpdates.length > 0 ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {latestUpdates.map((update, index) => {
              const tone = [
                'bg-[#f7d9a8]',
                'bg-[#ded2fb]',
                'bg-[#cceae2]',
              ][index % 3];

              if (update.kind === 'announcement') {
                const { announcement } = update;
                return (
                  <button
                    key={`announcement-${announcement.id}`}
                    type="button"
                    onClick={() =>
                      showOrganizationEvents(announcement.organizationId)
                    }
                    className="sl-soft-surface group relative overflow-hidden p-5 text-left transition hover:-translate-y-0.5 hover:border-[#d7c9f4] hover:shadow-surface"
                  >
                    <span
                      aria-hidden
                      className={`absolute -right-6 -top-8 h-24 w-24 rounded-full ${tone} opacity-45 blur-2xl`}
                    />
                    <div className="relative flex items-start justify-between gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-violet shadow-sm">
                        <Megaphone className="h-[18px] w-[18px]" aria-hidden />
                      </span>
                      <ArrowDown className="h-4 w-4 text-muted transition group-hover:text-violet" aria-hidden />
                    </div>
                    <p className="relative mt-4 text-xs font-bold text-violet">
                      ประกาศจาก {announcement.organizationName}
                    </p>
                    <h3 className="relative mt-1 line-clamp-1 text-[17px] font-extrabold">
                      {announcement.title}
                    </h3>
                    <p className="relative mt-2 line-clamp-2 text-xs leading-5 text-muted">
                      {announcement.body}
                    </p>
                  </button>
                );
              }

              const { event } = update;
              return (
                <Link
                  key={`event-${event.id}`}
                  href={`/events/${event.id}`}
                  className="sl-soft-surface group relative overflow-hidden p-5 transition hover:-translate-y-0.5 hover:border-[#d7c9f4] hover:shadow-surface"
                >
                  <span
                    aria-hidden
                    className={`absolute -right-6 -top-8 h-24 w-24 rounded-full ${tone} opacity-45 blur-2xl`}
                  />
                  <div className="relative flex items-start justify-between gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-violet shadow-sm">
                      <CalendarDays className="h-[18px] w-[18px]" aria-hidden />
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-muted transition group-hover:text-violet" aria-hidden />
                  </div>
                  <p className="relative mt-4 text-xs font-bold text-violet">
                    {event.organization.name}
                  </p>
                  <h3 className="relative mt-1 line-clamp-1 text-[17px] font-extrabold">
                    {event.name}
                  </h3>
                  <p className="relative mt-2 text-xs text-muted">
                    {formatDateRange(event)}
                  </p>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="sl-soft-surface mt-6 px-5 py-8 text-center text-sm text-muted">
            {updateFilter === 'all'
              ? 'เมื่อผู้จัดเผยแพร่งานใหม่ ข่าวสารจะแสดงที่ส่วนนี้'
              : updateFilter === 'event'
                ? 'ยังไม่มี Event ล่าสุดในขณะนี้'
                : 'ยังไม่มีประกาศล่าสุดในขณะนี้'}
          </div>
        )}
      </section>

      {auth.status === 'signed-in' && (
        <PopularAreaRecommendations
          eventId={events[0]?.id ?? 'demo-event'}
          shopName={auth.fullName}
        />
      )}

      <section
        id={EVENTS_SECTION_ID}
        className="border-y border-[#ece8f2] bg-white/72 py-16 backdrop-blur-sm"
      >
        <div className="shell">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[.16em] text-violet">
                Events
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">
                งานที่เปิดให้สำรวจพื้นที่
              </h2>
            </div>
            <p className="text-sm text-[#817b8e]">
              พบ {visibleEvents.length} งานจากข้อมูล SpaceLink API
            </p>
          </div>

          {loading && (
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="skeleton h-[330px] rounded-[28px]" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="mt-8 rounded-3xl border border-red-200 bg-red-50 p-8">
              <p className="font-extrabold text-red-800">
                โหลดรายการ Event ไม่สำเร็จ
              </p>
              <p className="mt-2 text-sm text-red-700">
                {error} — ตรวจสอบว่า NestJS API เปิดอยู่และตั้งค่า
                NEXT_PUBLIC_API_URL ถูกต้อง
              </p>
            </div>
          )}

          {!loading && !error && visibleEvents.length === 0 && (
            <div className="mt-8 rounded-3xl border border-dashed border-[#d9d3e5] bg-white p-12 text-center">
              <p className="text-lg font-extrabold">
                {events.length === 0
                  ? 'ยังไม่มี Event ที่เผยแพร่'
                  : 'ยังไม่พบ Event ที่ค้นหา'}
              </p>
              <p className="mt-2 text-sm text-[#817b8e]">
                {events.length === 0
                  ? 'Event สถานะ PUBLISHED หรือ ONGOING จะแสดงที่หน้านี้'
                  : 'ลองเปลี่ยนคำค้นหาหรือตัวกรองแล้วลองอีกครั้ง'}
              </p>
            </div>
          )}

          {!loading && !error && visibleEvents.length > 0 && (
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {visibleEvents.map((event, index) => (
                <article
                  key={event.id}
                  className="group overflow-hidden rounded-[28px] border border-[#e9e5ef] bg-white shadow-[0_12px_34px_rgba(54,36,91,0.055)] transition hover:-translate-y-1 hover:border-[#d9cdf0] hover:shadow-soft"
                >
                  <div
                    className={[
                      'relative h-44 overflow-hidden p-6 text-white',
                      [
                        'bg-gradient-to-br from-[#176c50] to-[#85ad3d]',
                        'bg-gradient-to-br from-[#662f8d] to-[#d5679c]',
                        'bg-gradient-to-br from-[#2454a4] to-[#3aa5b9]',
                      ][index % 3],
                    ].join(' ')}
                  >
                    <span className="rounded-full bg-white/18 px-3 py-1 text-xs font-bold backdrop-blur">
                      {statusLabel(event.status)}
                    </span>
                    <div className="absolute -bottom-14 -right-8 h-40 w-40 rounded-full border-[24px] border-white/10" />
                    <div className="absolute right-16 top-12 h-14 w-14 rounded-2xl bg-white/10 rotate-12" />
                  </div>
                  <div className="p-6">
                    <p className="text-xs font-bold text-violet">
                      {formatDateRange(event)}
                    </p>
                    <h3 className="mt-2 line-clamp-2 text-xl font-black tracking-[-0.025em]">
                      {event.name}
                    </h3>
                    <p className="mt-3 line-clamp-2 min-h-11 text-sm leading-6 text-[#756f82]">
                      {event.description ||
                        'สำรวจโซนและเลือกบูธที่เหมาะกับร้านของคุณ'}
                    </p>
                    <p className="mt-3 text-xs font-bold text-muted">
                      {event.organization.name} · {event.venue.name}
                    </p>
                    <Link
                      href={`/events/${event.id}`}
                      className="mt-5 flex items-center justify-between rounded-xl bg-mist px-4 py-3 text-sm font-extrabold text-violet transition group-hover:bg-violet group-hover:text-white"
                    >
                      ดูรายละเอียดและแผนผัง <span aria-hidden>→</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="how-it-works" className="shell py-16">
        <h2 className="text-center text-3xl font-black tracking-[-0.04em]">
          สำรวจพื้นที่ใน 3 ขั้นตอน
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            [
              '01',
              'เลือก Event',
              'ดูรายละเอียด วันจัดงาน และเงื่อนไขของผู้จัด',
            ],
            [
              '02',
              'เลือกโซนและบูธ',
              'โฟกัสแผนผังตามประเภทสินค้าและตรวจสอบบูธว่าง',
            ],
            [
              '03',
              'ดูตำแหน่งบูธ',
              'ตรวจสอบตำแหน่ง ราคา สถานะ และระดับพื้นที่จากแผนผังจริง',
            ],
          ].map(([number, title, description]) => (
            <div
              key={number}
              className="rounded-3xl border border-[#e7e2ed] bg-white p-7"
            >
              <span className="text-3xl font-black text-violet/25">
                {number}
              </span>
              <h3 className="mt-5 text-lg font-extrabold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#7a7487]">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <ClosingCta auth={auth} />

      <footer id="support" className="border-t border-[#e9e5ef] bg-[#201b2e] py-12 text-white">
        <div className="shell grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.1fr]">
          <div>
            <div className="flex items-center gap-3 text-xl font-black">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-[#a78bfa] to-[#7c3aed] text-sm shadow-[0_8px_20px_rgba(124,58,237,0.35)]">
                SL
              </span>
              SpaceLink
            </div>
            <p className="mt-4 max-w-sm text-sm leading-7 text-white/62">
              แพลตฟอร์มค้นหางาน เลือกโซน จองบูธ และติดตามสถานะสำหรับผู้ขายและผู้จัดงานในที่เดียว
            </p>
          </div>

          <FooterColumn
            title="สำรวจแพลตฟอร์ม"
            links={[
              ['ค้นหา Event', '/'],
              ['การจองของฉัน', '/bookings'],
              ['โปรไฟล์ร้านค้า', '/profile'],
            ]}
          />
          <FooterColumn
            title="บริการช่วยเหลือ"
            links={[
              ['ศูนย์ช่วยเหลือ', '/help'],
              ['การแจ้งเตือน', '/notifications'],
              ['เข้าสู่ระบบ', '/login'],
            ]}
          />
          <div>
            <p className="text-sm font-extrabold">ติดต่อ SpaceLink</p>
            <div className="mt-4 grid gap-2 text-sm leading-6 text-white/65">
              <a href="tel:+6644224000" className="transition hover:text-white">
                โทร 044-224-000
              </a>
              <a href="https://line.me/R/ti/p/" target="_blank" rel="noreferrer" className="transition hover:text-white">
                LINE Official
              </a>
              <a href="https://www.facebook.com/" target="_blank" rel="noreferrer" className="transition hover:text-white">
                Facebook Page
              </a>
            </div>
          </div>
        </div>
        <div className="shell mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 SpaceLink · Multi-tenant Event Space Platform</span>
          <span>ความเป็นส่วนตัว · เงื่อนไขการใช้งาน · การเข้าถึงสำหรับทุกคน</span>
        </div>
      </footer>
    </main>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: readonly (readonly [string, string])[];
}) {
  return (
    <div>
      <p className="text-sm font-extrabold">{title}</p>
      <nav className="mt-4 grid gap-2 text-sm text-white/65" aria-label={title}>
        {links.map(([label, href]) => (
          <Link key={href + label} href={href} className="transition hover:text-white">
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

type FilterOption = { value: string; label: string };

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
  events.forEach((event) => {
    organizations.set(event.organization.id, event.organization);
  });
  return [...organizations.values()];
}

function announcementTimestamp(announcement: AdminAnnouncement) {
  return new Date(
    announcement.publishedAt ?? announcement.createdAt,
  ).getTime();
}

/**
 * The native `<select>` this replaced used an `<option value="">` for the
 * unfiltered case; the listbox needs it as a real row so it can be chosen
 * again to clear the filter.
 */
function withAllOption(
  options: FilterOption[],
  allLabel: string,
): SelectMenuOption[] {
  return [{ value: '', label: allLabel }, ...options];
}

/**
 * Issue 1: this block used to offer สมัครสมาชิก / เข้าสู่ระบบ unconditionally,
 * so a signed-in visitor was invited to register moments after seeing their own
 * name in the topbar. Signed in, it points at what they can actually do next
 * instead — browse the open events, or open their bookings.
 */
function ClosingCta({ auth }: { auth: ReturnType<typeof useAuthState>['auth'] }) {
  const signedIn = auth.status === 'signed-in';

  return (
    <section className="shell pb-16">
      <div className="relative overflow-hidden rounded-[32px] border border-[#e7e2ed] bg-[radial-gradient(circle_at_50%_0%,rgba(124,58,237,0.12),transparent_22rem),#fff] px-8 py-12 text-center shadow-soft sm:px-14">
        <h2 className="text-3xl font-black tracking-[-0.04em]">
          พร้อมจองบูธในงานถัดไปแล้วหรือยัง
        </h2>
        <p className="mx-auto mt-4 max-w-[46ch] leading-8 text-[#7a7487]">
          {signedIn
            ? 'เลือกงานที่เปิดรับสมัคร แล้วดูผังบูธว่างได้ทันที'
            : 'สมัครด้วยอีเมลอย่างเดียว ไม่ต้องตั้งรหัสผ่าน'}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {auth.status === 'loading' && (
            // Holds the row's height so the card does not resize when the
            // session resolves.
            <span aria-hidden className="skeleton h-[52px] w-[280px] rounded-full" />
          )}

          {auth.status === 'signed-out' && (
            <>
              <Link
                href="/register"
                className="rounded-full bg-gradient-to-r from-violet to-[#a442e8] px-7 py-3.5 font-bold text-white shadow-lg shadow-violet/25"
              >
                สมัครสมาชิก
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-[#e4dff0] bg-white px-7 py-3.5 font-bold text-violet shadow-sm"
              >
                เข้าสู่ระบบ
              </Link>
            </>
          )}

          {signedIn && (
            <>
              <a
                href={`#${EVENTS_SECTION_ID}`}
                className="rounded-full bg-gradient-to-r from-violet to-[#a442e8] px-7 py-3.5 font-bold text-white shadow-lg shadow-violet/25"
              >
                ดูงานที่เปิดรับสมัคร
              </a>
              <Link
                href="/bookings"
                className="rounded-full border border-[#e4dff0] bg-white px-7 py-3.5 font-bold text-violet shadow-sm"
              >
                การจองของฉัน
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function PopularAreaRecommendations({
  eventId,
  shopName,
}: {
  eventId: string;
  shopName: string;
}) {
  const recommendations = [
    {
      zone: 'โซน A · อาหาร',
      booth: 'A01–A04',
      title: 'ใกล้ทางเข้าและจุดลงทะเบียน',
      reason: 'ลูกค้าเห็นร้านได้ตั้งแต่เข้าพื้นที่ เหมาะกับอาหารและเครื่องดื่มที่ตัดสินใจซื้อเร็ว',
      score: 'นิยม 96%',
      tone: 'from-[#fff2d8] to-[#fffaf0]',
    },
    {
      zone: 'โซน B · เครื่องดื่ม',
      booth: 'B03–B06',
      title: 'ติดทางเดินหลักระหว่างโซน',
      reason: 'เป็นเส้นทางเชื่อมกลางงาน มีผู้เข้าชมเดินผ่านซ้ำ เหมาะกับร้านคาเฟ่และของหวาน',
      score: 'นิยม 92%',
      tone: 'from-[#eee8ff] to-[#faf8ff]',
    },
    {
      zone: 'โซน F · กิจกรรม',
      booth: 'F01–F04',
      title: 'ใกล้เวิร์กช็อปและจุดพัก',
      reason: 'ลูกค้าใช้เวลาอยู่บริเวณนี้นาน เหมาะกับสินค้าที่ต้องอธิบายหรือให้ทดลองก่อนซื้อ',
      score: 'นิยม 87%',
      tone: 'from-[#e7f7f1] to-[#f7fffc]',
    },
  ];

  return (
    <section className="shell pb-12 sm:pb-14" aria-labelledby="popular-area-heading">
      <div className="rounded-[30px] border border-[#e3d9f2] bg-white/90 p-5 shadow-soft sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="sl-kicker">
              <Sparkles className="h-4 w-4" aria-hidden />
              Recommended for your shop
            </span>
            <h2 id="popular-area-heading" className="mt-2 text-2xl font-black tracking-[-0.04em] sm:text-3xl">
              พื้นที่นิยมที่เหมาะกับ {shopName}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              แนะนำจากประเภทร้าน ตำแหน่งทางเข้า ทางเดินหลัก และจุดที่ผู้เข้าชมมีแนวโน้มเดินผ่านบ่อย
            </p>
          </div>
          <span className="sl-chip">
            <TrendingUp className="h-4 w-4" aria-hidden />
            จัดอันดับจากข้อมูลพื้นที่
          </span>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {recommendations.map((item, index) => (
            <Link
              key={item.zone}
              href={`/events/${eventId}/book`}
              className={`group rounded-[24px] border border-white bg-gradient-to-br ${item.tone} p-5 shadow-[0_10px_28px_rgba(54,36,91,0.06)] transition hover:-translate-y-1 hover:border-[#d7c6f0]`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-violet shadow-sm">
                  <MapPinned className="h-5 w-5" aria-hidden />
                </span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-violet shadow-sm">
                  #{index + 1} · {item.score}
                </span>
              </div>
              <p className="mt-5 text-xs font-extrabold uppercase tracking-[.1em] text-violet">
                {item.zone} · {item.booth}
              </p>
              <h3 className="mt-2 text-lg font-black">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{item.reason}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-violet">
                ดูตำแหน่งบูธ <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
