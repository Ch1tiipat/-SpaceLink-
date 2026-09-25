import Link from 'next/link';
import { CalendarDays, Heart, MapPin, RotateCcw } from 'lucide-react';
import type { DiscoveryEvent } from '@/lib/api';
import { isEventBookable } from '@/lib/event-booking-rules';
import { getEventCoverUrl } from '@/lib/event-cover';
import { hasEventEndCalendarDayPassed } from '@/lib/event-time';
import { provinceFromAddress } from '@/lib/home-event-filters';

type SavedEventsSectionProps = {
  status: 'loading' | 'ready' | 'error';
  events: DiscoveryEvent[];
  pendingEventId: string | null;
  errorMessage?: string;
  onRetry: () => void;
  onUnsave: (event: DiscoveryEvent) => void;
};

const dateFormatter = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function SavedEventsSection({
  status,
  events,
  pendingEventId,
  errorMessage,
  onRetry,
  onUnsave,
}: SavedEventsSectionProps) {
  return (
    <section
      className="shell !mt-[56px] max-sm:!mt-[42px]"
      aria-labelledby="saved-events-heading"
    >
      <div className="mb-[18px] flex items-end justify-between gap-5 max-sm:items-start">
        <div>
          <span className="sl-kicker">บันทึกไว้สำหรับคุณ</span>
          <h2
            id="saved-events-heading"
            className="mt-[7px] text-[26px] font-black tracking-[-0.025em]"
          >
            รายการโปรดของฉัน
          </h2>
          <p className="mt-1 text-xs text-muted">
            Event ที่คุณบันทึกไว้ เพื่อกลับมาดูรายละเอียดได้ง่ายขึ้น
          </p>
        </div>
        {status === 'ready' ? (
          <span className="shrink-0 rounded-full border border-[#d8c7f6] bg-[#f6f1ff] px-4 py-2 text-xs font-extrabold text-violet">
            {events.length} Event
          </span>
        ) : null}
      </div>

      {status === 'loading' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="กำลังโหลดรายการโปรด">
          {[0, 1, 2].map((item) => (
            <span
              key={item}
              className="skeleton block h-[300px] rounded-[22px]"
            />
          ))}
        </div>
      ) : status === 'error' ? (
        <div role="alert" className="sl-surface p-8 text-center">
          <Heart aria-hidden className="mx-auto h-9 w-9 text-violet" />
          <h3 className="mt-3 text-lg font-extrabold">
            โหลดรายการโปรดไม่สำเร็จ
          </h3>
          <p className="mt-1 text-sm text-muted">
            {errorMessage ?? 'กรุณาลองใหม่อีกครั้ง'}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-violet px-4 py-2 text-sm font-bold text-violet"
          >
            <RotateCcw aria-hidden className="h-4 w-4" /> ลองใหม่
          </button>
        </div>
      ) : events.length === 0 ? (
        <div className="sl-surface grid min-h-[170px] grid-cols-[58px_minmax(0,1fr)_auto] items-center gap-5 border-dashed p-6 max-sm:grid-cols-[48px_minmax(0,1fr)]">
          <span className="grid h-[58px] w-[58px] place-items-center rounded-[18px] bg-violet-tint text-violet max-sm:h-12 max-sm:w-12">
            <Heart aria-hidden className="h-7 w-7" />
          </span>
          <div>
            <h3 className="text-lg font-extrabold">
              ยังไม่มี Event ในรายการโปรด
            </h3>
            <p className="mt-1 text-sm leading-6 text-muted">
              กดรูปหัวใจในรายละเอียด Event แล้วงานที่สนใจจะกลับมาแสดงตรงนี้
            </p>
          </div>
          <a
            href="#events"
            className="sl-action-primary inline-flex min-h-11 items-center justify-center px-5 max-sm:col-span-2"
          >
            ค้นหา Event
          </a>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => {
            const pending = pendingEventId === event.id;
            const category = event.categories[0]?.name ?? 'Event';
            const province = provinceFromAddress(event.venue.address ?? '');
            return (
              <article
                key={event.id}
                className="sl-surface relative overflow-hidden transition hover:-translate-y-0.5 hover:shadow-soft"
              >
                <div
                  className="relative flex min-h-[150px] items-end bg-cover bg-center p-[17px] text-white"
                  style={{
                    backgroundImage: `linear-gradient(120deg,rgba(36,16,62,.82),rgba(78,30,150,.48),rgba(56,101,104,.38)),url(${JSON.stringify(getEventCoverUrl(event.bannerUrl))})`,
                  }}
                >
                  <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold text-violet">
                    {hasEventEndCalendarDayPassed(event.endDate)
                      ? 'สิ้นสุดแล้ว'
                      : isEventBookable(event)
                        ? 'เปิดจอง'
                        : 'ปิดรับจอง'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUnsave(event)}
                    disabled={pending}
                    aria-label={`นำ ${event.name} ออกจากรายการโปรด`}
                    aria-busy={pending}
                    className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full border border-white/80 bg-white text-violet shadow-[0_7px_18px_rgba(39,20,75,.2)] transition hover:bg-violet hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c5a6ff] disabled:cursor-wait disabled:opacity-70"
                  >
                    <Heart aria-hidden className="h-5 w-5 fill-current" />
                  </button>
                </div>
                <div className="p-[17px]">
                  <div className="flex items-center justify-between gap-3 text-xs text-muted">
                    <span className="rounded-full bg-violet-tint px-2.5 py-1 font-bold text-violet">
                      {category}
                    </span>
                    {province ? (
                      <span className="inline-flex min-w-0 items-center gap-1 truncate">
                        <MapPin aria-hidden className="h-3.5 w-3.5 shrink-0" />
                        {province}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-3 text-[17px] font-extrabold leading-snug">
                    {event.name}
                  </h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted">
                    {event.venue.name}
                  </p>
                  <div className="mt-4 flex items-end justify-between gap-3 border-t border-line pt-4">
                    <span className="inline-flex items-start gap-1.5 text-xs leading-5 text-muted">
                      <CalendarDays aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                      {dateFormatter.format(new Date(event.startDate))} –{' '}
                      {dateFormatter.format(new Date(event.endDate))}
                    </span>
                    <Link
                      href={`/events/${encodeURIComponent(event.slug)}`}
                      className="shrink-0 text-sm font-bold text-violet hover:underline"
                    >
                      ดูรายละเอียด →
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
