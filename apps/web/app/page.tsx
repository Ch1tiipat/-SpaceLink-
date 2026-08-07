'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, Search } from 'lucide-react';
import { SelectMenu, type SelectMenuOption } from '@/components/select-menu';
import { getEvents, type DiscoveryEvent } from '@/lib/api';
import { useAuthState } from '@/lib/use-auth-state';

/** Anchor for the hero's "Explore Event" button. */
const EVENTS_SECTION_ID = 'events';

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
  const [events, setEvents] = useState<DiscoveryEvent[]>([]);
  const [query, setQuery] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [area, setArea] = useState('');
  const [categoryId, setCategoryId] = useState('');
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

  return (
    <main>
      {/* `.hero` from the prototype: the photo carries no information the
          heading does not already state, so it is decorative (`alt=""`) and
          the gradient over it is what keeps the text legible. */}
      <section className="shell pt-7">
        <div className="relative flex min-h-[263px] items-end overflow-hidden rounded-[19px] p-[25px] text-white sm:min-h-[315px] sm:rounded-[26px] sm:p-[42px]">
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
            className="absolute inset-0 bg-[linear-gradient(100deg,#251149F2_0%,#4C1D95C0_100%)] sm:bg-[linear-gradient(95deg,#251149_0%,#4C1D95DD_45%,#4C1D9520_100%)]"
          />

          <div className="relative max-w-[560px]">
            <span className="inline-flex rounded-full border border-white/30 bg-white/[0.18] px-3 py-1.5 text-xs font-bold backdrop-blur">
              พื้นที่ที่ใช่ เชื่อมโอกาสใหม่ให้ร้านคุณ
            </span>
            <h1 className="my-3 text-[28px] font-black leading-[1.2] tracking-[-0.9px] sm:text-[37px] sm:tracking-[-1.1px]">
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
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#5B21B6] shadow-lg transition hover:-translate-y-0.5"
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
          className="rounded-surface border border-line bg-card p-3.5 shadow-surface"
          onSubmit={(event) => event.preventDefault()}
        >
          <label className="flex items-center gap-3 rounded-2xl border border-line bg-white p-2 pl-5">
            <Search aria-hidden className="h-5 w-5 shrink-0 text-violet" />
            <span className="sr-only">ค้นหา Event</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent py-2.5 text-base placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet focus:ring-offset-2"
              placeholder="ค้นหาชื่องาน เช่น งานเกษตรแฟร์"
            />
            <button
              type="submit"
              className="rounded-xl bg-violet px-5 py-2.5 font-bold text-white shadow-lg shadow-violet/20"
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

      <section
        id={EVENTS_SECTION_ID}
        className="mt-10 border-y border-[#ece8f2] bg-white/70 py-16"
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
                  className="group overflow-hidden rounded-[28px] border border-[#e9e5ef] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-soft"
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

      <ClosingCta />

      <footer id="support" className="border-t border-[#e9e5ef] bg-white py-8">
        <div className="shell flex flex-wrap items-center justify-between gap-3 text-sm text-[#7b7588]">
          <strong className="text-ink">SpaceLink</strong>
          <span>แพลตฟอร์มเชื่อมพื้นที่ สร้างโอกาสให้ผู้ขาย</span>
        </div>
      </footer>
    </main>
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
function ClosingCta() {
  const { auth } = useAuthState();
  const signedIn = auth.status === 'signed-in';

  return (
    <section className="shell pb-16">
      <div className="rounded-[32px] border border-[#e7e2ed] bg-white px-8 py-12 text-center shadow-soft sm:px-14">
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
