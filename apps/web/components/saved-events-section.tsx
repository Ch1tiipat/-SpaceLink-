import Image from 'next/image';
import { ArrowRight, CalendarDays, Heart, MapPin, RotateCcw } from 'lucide-react';
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
  onOpen: (event: DiscoveryEvent, opener: HTMLButtonElement) => void;
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
  onOpen,
}: SavedEventsSectionProps) {
  return (
    <section
      className="shell !mt-[64px] max-sm:!mt-[42px]"
      aria-labelledby="saved-events-heading"
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="sl-kicker">บันทึกไว้สำหรับคุณ</span>
          <h2
            id="saved-events-heading"
            className="mt-[7px] text-[clamp(26px,3vw,34px)] font-black tracking-[-0.035em] text-[#432687]"
          >
            รายการโปรดของฉัน
          </h2>
          <p className="mt-1 text-sm text-[#817794]">
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
        <div className="grid gap-4 lg:grid-cols-2" aria-label="กำลังโหลดรายการโปรด">
          {[0, 1].map((item) => (
            <span
              key={item}
              className="skeleton block h-[170px] rounded-[22px]"
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
        <div className="grid gap-4 lg:grid-cols-2">
          {events.map((event) => {
            const pending = pendingEventId === event.id;
            const category = event.categories[0]?.name ?? 'Event';
            const province = provinceFromAddress(event.venue.address ?? '');
            return (
              <article
                key={event.id}
                className="grid min-w-0 overflow-hidden rounded-[21px] border border-[#eee8fa] bg-white shadow-[0_13px_32px_rgba(74,46,134,.08)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(74,46,134,.14)] sm:grid-cols-[38%_minmax(0,1fr)]"
              >
                <div className="relative aspect-[1.65] min-h-[155px] overflow-hidden bg-[#e8dafa] sm:aspect-auto">
                  <Image
                    src={getEventCoverUrl(event.bannerUrl)}
                    alt={`ภาพปก ${event.name}`}
                    fill
                    unoptimized
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 38vw, 20vw"
                    className="object-cover"
                  />
                  <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-extrabold text-violet">
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
                    className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full bg-white text-[#7939ec] shadow-[0_5px_16px_rgba(31,13,76,.2)] transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet disabled:cursor-wait disabled:opacity-70"
                  >
                    <Heart aria-hidden className="h-5 w-5 fill-current" />
                  </button>
                </div>
                <div className="flex min-w-0 flex-col p-4">
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <span className="truncate rounded-full bg-[#f3edff] px-2.5 py-1 text-[10px] font-extrabold text-[#7133df]">
                      {category}
                    </span>
                    {province ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-[#817794]">
                        <MapPin aria-hidden className="h-3.5 w-3.5 shrink-0" />
                        {province}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-2 truncate text-[17px] font-black text-[#211735]">
                    {event.name}
                  </h3>
                  <p className="mt-1 truncate text-xs text-[#817794]">
                    {event.venue.name}
                  </p>
                  <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-4">
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-[#756998]">
                      <CalendarDays aria-hidden className="h-4 w-4 shrink-0" />
                      {dateFormatter.format(new Date(event.startDate))} –{' '}
                      {dateFormatter.format(new Date(event.endDate))}
                    </span>
                    <button
                      type="button"
                      onClick={(clickEvent) => onOpen(event, clickEvent.currentTarget)}
                      className="inline-flex min-h-11 items-center gap-1 text-xs font-extrabold text-[#7133df] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet"
                    >
                      ดูรายละเอียด <ArrowRight aria-hidden className="h-4 w-4" />
                    </button>
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
