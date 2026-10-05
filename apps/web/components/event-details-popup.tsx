'use client';

import Link from 'next/link';
import { ResilientImage as Image } from '@/components/resilient-image';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  ArrowRight, CalendarDays, Camera, ChevronLeft, ChevronRight,
  CircleDollarSign, FileText, Mail, Map as MapIcon, MapPin, Megaphone,
  MessageCircle, Minus, Phone, Plus, RotateCcw, ShieldCheck, Star, Store, X,
  type LucideIcon,
} from 'lucide-react';
import {
  getEventMap, getEventReviews, getVenueLocation,
  type AdminAnnouncement, type DiscoveryEvent, type EventMap,
  type EventReviewsPage, type VenueLocation,
} from '@/lib/api';
import { getEventCoverUrl } from '@/lib/event-cover';
import { hasEventEndCalendarDayPassed } from '@/lib/event-time';
import { isEventBookable } from '@/lib/event-booking-rules';
import {
  googleMapsDirectionsUrl, googleMapsEmbedUrl, parseVenueCoordinates,
  safePublicHttpsUrl, safePublicHttpUrl, summarizeEventZones,
} from '@/lib/event-detail-view-model';
import { filterUsableAtmosphereUrls } from '@/lib/home-event-atmosphere';

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

type EventPopupLoadState =
  | { status: 'loading' }
  | { status: 'ready'; map: EventMap }
  | { status: 'error'; message: string };

type EventPopupReviewsState =
  | { status: 'loading' }
  | { status: 'ready'; data: EventReviewsPage }
  | { status: 'error' };

type EventPopupVenueState =
  | { status: 'loading' }
  | { status: 'ready'; venue: VenueLocation }
  | { status: 'error'; message: string };

export function EventPopup({
  dialogRef,
  event,
  announcements,
  initialMap,
  onRequestClose,
  onClosed,
}: {
  dialogRef: RefObject<HTMLDialogElement>;
  event: DiscoveryEvent;
  announcements: AdminAnnouncement[];
  initialMap?: EventMap;
  onRequestClose: () => void;
  onClosed: () => void;
}) {
  const [loadState, setLoadState] = useState<EventPopupLoadState>(() =>
    initialMap ? { status: 'ready', map: initialMap } : { status: 'loading' },
  );
  const [reviewsState, setReviewsState] = useState<EventPopupReviewsState>({
    status: 'loading',
  });
  const [mapViewerOpen, setMapViewerOpen] = useState(false);
  const [atmosphereIndex, setAtmosphereIndex] = useState<number | null>(null);
  const [failedAtmosphereUrls, setFailedAtmosphereUrls] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [zoom, setZoom] = useState(1);
  const atmosphereTriggerRef = useRef<HTMLButtonElement | null>(null);
  const atmosphereRailRef = useRef<HTMLDivElement>(null);
  const eventPopupCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoadState(initialMap ? { status: 'ready', map: initialMap } : { status: 'loading' });
    setMapViewerOpen(false);
    setAtmosphereIndex(null);
    setFailedAtmosphereUrls(new Set());
    setZoom(1);
    if (initialMap) return () => controller.abort();
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
  }, [event.id, initialMap]);

  useEffect(() => {
    const controller = new AbortController();
    setReviewsState({ status: 'loading' });
    getEventReviews(event.id, 1, 2, controller.signal)
      .then((data) => setReviewsState({ status: 'ready', data }))
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setReviewsState({ status: 'error' });
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
  const eventAnnouncements = announcements
    .filter((announcement) => announcement.eventId === event.id)
    .slice(0, 2);
  const organizer = eventMap?.event.organization;
  const sanitizedGalleryUrls = (eventMap?.event.galleryUrls ?? [])
    .map(safePublicHttpsUrl)
    .filter((url): url is string => Boolean(url));
  const galleryUrls = filterUsableAtmosphereUrls(
    sanitizedGalleryUrls,
    failedAtmosphereUrls,
  );
  const atmospherePreviewUrl = galleryUrls[0] ?? null;
  const activeAtmosphereIndex =
    atmosphereIndex === null || galleryUrls.length === 0
      ? null
      : atmosphereIndex % galleryUrls.length;
  const activeAtmosphereUrl =
    activeAtmosphereIndex === null
      ? null
      : (galleryUrls[activeAtmosphereIndex] ?? null);
  const facebookUrl = safePublicHttpUrl(organizer?.facebookUrl ?? null);
  const contactPhone = eventMap?.event.contactPhone ?? organizer?.contactPhone;
  const contactEmail = eventMap?.event.contactEmail ?? organizer?.contactEmail;
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

  function closeAtmosphereViewer() {
    setAtmosphereIndex(null);
    window.requestAnimationFrame(() => {
      (atmosphereTriggerRef.current ?? eventPopupCloseRef.current)?.focus();
    });
  }

  function markAtmosphereImageFailed(url: string) {
    setFailedAtmosphereUrls((current) => {
      if (current.has(url)) return current;
      return new Set([...current, url]);
    });
  }

  function changeAtmosphereImage(delta: number) {
    if (galleryUrls.length < 2) return;
    setAtmosphereIndex((current) => {
      const index = (current ?? 0) % galleryUrls.length;
      return (index + delta + galleryUrls.length) % galleryUrls.length;
    });
  }

  function scrollAtmosphereRail(direction: -1 | 1) {
    const rail = atmosphereRailRef.current;
    const card = rail?.firstElementChild as HTMLElement | null;
    if (!rail || !card) return;
    rail.scrollBy({ left: direction * (card.offsetWidth + 12), behavior: 'smooth' });
  }

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby="event-popup-title"
      onClose={() => {
        setAtmosphereIndex(null);
        onClosed();
      }}
      onCancel={(cancelEvent) => {
        if (atmosphereIndex !== null) {
          cancelEvent.preventDefault();
          closeAtmosphereViewer();
        } else if (mapViewerOpen) {
          cancelEvent.preventDefault();
          setMapViewerOpen(false);
          setZoom(1);
        }
      }}
      onKeyDown={(keyEvent) => {
        if (atmosphereIndex === null) {
          if (keyEvent.key !== 'Tab') return;
          const scope = mapViewerOpen
            ? dialogRef.current?.querySelector<HTMLElement>('[aria-labelledby="event-map-viewer-title"]')
            : dialogRef.current;
          const controls = Array.from(
            scope?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]') ?? [],
          ).filter((control) => control.getClientRects().length > 0);
          const firstControl = controls[0];
          const lastControl = controls[controls.length - 1];
          if (!scope || !firstControl || !lastControl) return;
          const activeElement = document.activeElement;
          if (!scope.contains(activeElement)) {
            keyEvent.preventDefault();
            (keyEvent.shiftKey ? lastControl : firstControl).focus();
          } else if (keyEvent.shiftKey && activeElement === firstControl) {
            keyEvent.preventDefault();
            lastControl.focus();
          } else if (!keyEvent.shiftKey && activeElement === lastControl) {
            keyEvent.preventDefault();
            firstControl.focus();
          }
          return;
        }
        if (keyEvent.key === 'ArrowLeft') changeAtmosphereImage(-1);
        if (keyEvent.key === 'ArrowRight') changeAtmosphereImage(1);
        if (keyEvent.key !== 'Tab') return;

        const viewer = dialogRef.current?.querySelector<HTMLElement>(
          '[data-atmosphere-viewer]',
        );
        const controls = Array.from(
          viewer?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ??
            [],
        );
        const firstControl = controls[0];
        const lastControl = controls[controls.length - 1];
        if (!viewer || !firstControl || !lastControl) return;

        const activeElement = document.activeElement;
        if (!viewer.contains(activeElement)) {
          keyEvent.preventDefault();
          (keyEvent.shiftKey ? lastControl : firstControl).focus();
        } else if (keyEvent.shiftKey && activeElement === firstControl) {
          keyEvent.preventDefault();
          lastControl.focus();
        } else if (!keyEvent.shiftKey && activeElement === lastControl) {
          keyEvent.preventDefault();
          firstControl.focus();
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
            ref={eventPopupCloseRef}
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

          <div className="mt-3 grid gap-2.5 lg:grid-cols-3">
            <EventPopupSection icon={FileText} title="เกี่ยวกับงานนี้">
              <p className="whitespace-pre-wrap text-xs leading-6 text-[#655e77]">
                {event.description || 'ผู้จัดงานยังไม่ได้เพิ่มรายละเอียด Event นี้'}
              </p>
              {eventMap?.event.joinInformation.length ? (
                <ul className="mt-3 space-y-2 border-t border-[#eee8f6] pt-3">
                  {eventMap.event.joinInformation.slice(0, 2).map((item) => (
                    <li key={item.id} className="text-xs leading-5">
                      <strong className="block text-[#31254b]">{item.title}</strong>
                      <span className="line-clamp-2 whitespace-pre-wrap text-[#716a80]">{item.content}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </EventPopupSection>

            <EventPopupSection icon={Megaphone} title="ข่าวสารล่าสุด">
              {eventAnnouncements.length ? (
                <div className="space-y-2">
                  {eventAnnouncements.map((announcement) => (
                    <article key={announcement.id} className="rounded-xl border border-[#e8e1f4] bg-[#fcfbff] px-3 py-2.5">
                      <span className="text-[10px] text-[#898198]">
                        {dateFormatter.format(new Date(announcement.publishedAt ?? announcement.createdAt))}
                      </span>
                      <strong className="mt-1 block text-xs text-[#31254b]">{announcement.title}</strong>
                      <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-[11px] leading-5 text-[#716a80]">{announcement.body}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-xs leading-5 text-[#81798f]">ยังไม่มีข่าวสารสำหรับ Event นี้</p>
              )}
            </EventPopupSection>

            <EventPopupSection icon={MessageCircle} title="ข่าวจากผู้จัดงาน">
              <div className="rounded-xl border border-[#e8e1f4] bg-[#fcfbff] p-3">
                <div className="flex items-center gap-3">
                  <FacebookBrandMark />
                  <span className="min-w-0">
                    <strong className="block truncate text-xs text-[#31254b]">
                      {event.organization.name}
                    </strong>
                    <span className="mt-0.5 block text-[10px] text-[#81798f]">
                      Facebook ผู้จัดงาน
                    </span>
                  </span>
                </div>
                {facebookUrl ? (
                  <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-full border border-[#d4c1f5] px-3 text-xs font-extrabold text-[#6330c6] transition hover:bg-[#f5f0ff]">
                    ดูข่าวจาก Facebook ของผู้จัดงาน <ArrowRight aria-hidden className="h-4 w-4" />
                  </a>
                ) : (
                  <p className="mt-2 text-xs leading-5 text-[#81798f]">ผู้จัดงานยังไม่ได้เพิ่ม Facebook</p>
                )}
              </div>
            </EventPopupSection>

            <EventPopupSection icon={MapIcon} title="พื้นที่ภายในงาน">
              {loadState.status === 'loading' ? (
                <div className="skeleton h-[150px] rounded-xl" />
              ) : loadState.status === 'error' ? (
                <p role="alert" className="rounded-xl bg-[#fff1f2] p-3 text-xs text-[#a5263d]">{loadState.message}</p>
              ) : (
                <>
                  <button type="button" onClick={() => setMapViewerOpen(true)} className="group relative block h-[150px] w-full overflow-hidden rounded-xl border border-[#ddd4ea] bg-[#f6f3fb] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet" aria-label="เปิดภาพแผนผังโซนแบบซูมได้">
                    <RuntimeZoneMapVisual map={loadState.map} />
                    <span className="absolute inset-x-3 bottom-3 rounded-lg bg-white/95 px-3 py-2 text-center text-[11px] font-extrabold text-[#6330c6] shadow-lg">กดดูและซูมแผนผังโซน</span>
                  </button>
                  {eventMap?.zones.length ? (
                    <div className="mt-2 space-y-1.5">
                      {eventMap.zones.slice(0, 4).map((zone) => (
                        <div key={zone.id} className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="truncate font-semibold text-[#43345e]">{zone.name || `โซน ${zone.code}`}</span>
                          <span className="shrink-0 text-[#81798f]">{zone.booths.filter((booth) => booth.availability === 'AVAILABLE').length} บูธว่าง</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
              <Link href={mapHref} className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-full border border-[#cdb5f5] text-[11px] font-extrabold text-[#6330c6] hover:bg-[#f5f0ff]">
                ดูแผนผังโซน <ArrowRight aria-hidden className="h-3.5 w-3.5" />
              </Link>
            </EventPopupSection>

            <EventPopupSection icon={ShieldCheck} title="กฎและเงื่อนไข (สรุป)">
              {loadState.status === 'loading' ? (
                <p className="text-xs text-[#81798f]">กำลังโหลดกฎของงาน…</p>
              ) : eventMap?.event.policy && Object.values(eventMap.event.policy).some(Boolean) ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {([
                    ['กฎของงาน', eventMap.event.policy.generalRules],
                    ['การยกเลิก', eventMap.event.policy.cancellationPolicy],
                    ['การคืนเงิน', eventMap.event.policy.refundPolicy],
                  ] as const).filter(([, value]) => Boolean(value)).map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-[#f8f6fc] p-2.5">
                      <strong className="block text-[11px] text-[#31254b]">{label}</strong>
                      <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[10px] leading-4 text-[#777083]">{value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs leading-5 text-[#81798f]">ผู้จัดงานยังไม่ได้ระบุกฎและเงื่อนไข</p>
              )}
            </EventPopupSection>

            <EventPopupSection icon={MapPin} title="การเดินทางเข้างาน">
              <EventPopupVenueMap event={event} />
            </EventPopupSection>

            <EventPopupSection icon={Star} title="รีวิวจากผู้เข้าร่วมงาน" className="lg:col-span-2">
              {reviewsState.status === 'loading' ? (
                <p className="text-xs text-[#81798f]">กำลังโหลดรีวิว…</p>
              ) : reviewsState.status === 'error' ? (
                <p role="alert" className="text-xs text-[#a5263d]">โหลดรีวิวไม่สำเร็จ</p>
              ) : reviewsState.data.count === 0 ? (
                <p className="rounded-xl border border-dashed border-[#ded5eb] bg-[#fcfbff] p-5 text-center text-xs text-[#81798f]">Event นี้ยังไม่มีรีวิว</p>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-[.55fr_1fr_1fr]">
                  <div className="rounded-xl bg-[#f7f3ff] p-3 text-center">
                    <strong className="text-2xl font-black text-[#25164f]">{reviewsState.data.average?.toFixed(1) ?? '—'}<span className="text-sm">/5</span></strong>
                    <span className="mt-1 block text-[10px] text-[#777083]">จาก {reviewsState.data.count} รีวิว</span>
                  </div>
                  {reviewsState.data.items.map((review) => (
                    <article key={review.id} className="rounded-xl border border-[#e8e1f4] p-3">
                      <span className="text-[10px] font-bold text-[#ffad25]">{'★'.repeat(Math.max(0, Math.min(5, Math.round(review.rating))))}{'☆'.repeat(5 - Math.max(0, Math.min(5, Math.round(review.rating))))}</span>
                      <p className="mt-1 line-clamp-3 text-[11px] leading-5 text-[#655e77]">{review.comment || 'ให้คะแนนโดยไม่มีข้อความ'}</p>
                    </article>
                  ))}
                </div>
              )}
            </EventPopupSection>

            <EventPopupSection icon={Phone} title="ข้อมูล Event">
              <strong className="block text-xs text-[#31254b]">{event.organization.name}</strong>
              <div className="mt-3 space-y-2 text-xs text-[#655e77]">
                {contactPhone ? <a href={`tel:${contactPhone.replace(/[^+\d]/g, '')}`} className="flex items-center gap-2 hover:text-[#6330c6]"><Phone aria-hidden className="h-4 w-4" />{contactPhone}</a> : null}
                {contactEmail ? <a href={`mailto:${encodeURIComponent(contactEmail)}`} className="flex items-center gap-2 break-all hover:text-[#6330c6]"><Mail aria-hidden className="h-4 w-4 shrink-0" />{contactEmail}</a> : null}
                {!contactPhone && !contactEmail ? <p>ผู้จัดงานยังไม่ได้ระบุช่องทางติดต่อ</p> : null}
              </div>
            </EventPopupSection>

            {atmospherePreviewUrl ? (
              <EventPopupSection
                icon={Camera}
                title="บรรยากาศภายในงาน"
                className="lg:col-span-3"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-[#766c86]">ภาพจากผู้จัดงาน · {galleryUrls.length} ภาพ</p>
                  {galleryUrls.length > 1 ? (
                    <div className="flex shrink-0 gap-2">
                      <button type="button" onClick={() => scrollAtmosphereRail(-1)} aria-label="เลื่อนภาพบรรยากาศไปทางซ้าย" className="grid h-10 w-10 place-items-center rounded-full border border-[#ddd1ef] bg-white text-[#6330c6] transition hover:bg-[#f2ebff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet">
                        <ChevronLeft aria-hidden className="h-5 w-5" />
                      </button>
                      <button type="button" onClick={() => scrollAtmosphereRail(1)} aria-label="เลื่อนภาพบรรยากาศไปทางขวา" className="grid h-10 w-10 place-items-center rounded-full border border-[#ddd1ef] bg-white text-[#6330c6] transition hover:bg-[#f2ebff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet">
                        <ChevronRight aria-hidden className="h-5 w-5" />
                      </button>
                    </div>
                  ) : null}
                </div>
                <div ref={atmosphereRailRef} aria-label="ภาพบรรยากาศภายในงาน เลื่อนดูภาพเพิ่มเติมได้" className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-3 touch-pan-x">
                  {galleryUrls.map((url, index) => (
                    <button
                      key={url}
                      ref={index === 0 ? atmosphereTriggerRef : undefined}
                      type="button"
                      onClick={(clickEvent) => {
                        atmosphereTriggerRef.current = clickEvent.currentTarget;
                        setAtmosphereIndex(index);
                      }}
                      aria-label={`ดูภาพบรรยากาศภายใน ${event.name} ลำดับ ${index + 1} แบบเต็ม`}
                      className="group relative aspect-[4/3] w-[220px] shrink-0 snap-start overflow-hidden rounded-2xl border border-[#e1d7ec] bg-[#eee8f8] shadow-[0_8px_20px_rgba(78,55,121,.08)] transition hover:border-[#c8b4ef] hover:shadow-[0_12px_28px_rgba(78,55,121,.15)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet sm:w-[260px]"
                    >
                      <Image
                        ref={(image) => {
                          if (image?.complete && image.naturalWidth === 0) {
                            markAtmosphereImageFailed(url);
                          }
                        }}
                        src={url}
                        alt=""
                        onError={() => markAtmosphereImageFailed(url)}
                        fill
                        unoptimized
                        sizes="(max-width: 640px) 220px, 260px"
                        className="object-cover transition duration-300 group-hover:scale-[1.04]"
                      />
                      <span className="absolute bottom-2 right-2 rounded-full bg-[#21172f]/75 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">{index + 1} / {galleryUrls.length}</span>
                    </button>
                  ))}
                </div>
              </EventPopupSection>
            ) : null}
          </div>
        </div>

        <footer className="grid shrink-0 grid-cols-2 gap-3 border-t border-[#e6dff1] bg-white/95 px-4 py-3 backdrop-blur sm:flex sm:justify-center sm:px-6">
          <button
            type="button"
            onClick={onRequestClose}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] border-2 border-[#7440e7] px-5 text-sm font-extrabold text-[#6330c6] transition hover:bg-[#f5f0ff] sm:min-w-[250px]"
          >
            ปิด
          </button>
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

        {atmosphereIndex !== null ? (
          <section
            data-atmosphere-viewer
            role="dialog"
            aria-modal="true"
            aria-label={`ภาพบรรยากาศภายใน ${event.name} แบบเต็ม`}
            onClick={(clickEvent) => {
              if (clickEvent.target === clickEvent.currentTarget) {
                closeAtmosphereViewer();
              }
            }}
            className="absolute inset-0 z-[60] flex items-center justify-center bg-[#171025]/90 p-3 backdrop-blur-md sm:p-6"
          >
            <div className="relative h-full max-h-[720px] w-full max-w-[1080px] overflow-hidden rounded-[18px] border border-white/20 bg-[#21172f] shadow-[0_30px_90px_rgba(0,0,0,.55)]">
              {activeAtmosphereUrl && activeAtmosphereIndex !== null ? (
                <Image
                  ref={(image) => {
                    if (image?.complete && image.naturalWidth === 0) {
                      markAtmosphereImageFailed(activeAtmosphereUrl);
                    }
                  }}
                  src={activeAtmosphereUrl}
                  alt={`ภาพบรรยากาศภายใน ${event.name} ลำดับ ${activeAtmosphereIndex + 1}`}
                  onError={() =>
                    markAtmosphereImageFailed(activeAtmosphereUrl)
                  }
                  fill
                  unoptimized
                  priority
                  sizes="100vw"
                  className="object-contain"
                />
              ) : (
                <div
                  role="status"
                  className="grid h-full place-items-center px-16 text-center text-sm font-bold text-white"
                >
                  ไม่สามารถโหลดภาพบรรยากาศได้
                </div>
              )}
              <button
                type="button"
                autoFocus
                onClick={closeAtmosphereViewer}
                aria-label="ปิดภาพบรรยากาศแบบเต็ม"
                className="absolute right-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-full border border-white/30 bg-[#1f1730]/75 text-white shadow-lg backdrop-blur transition hover:bg-[#5d27db] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <X aria-hidden className="h-5 w-5" />
              </button>
              {galleryUrls.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => changeAtmosphereImage(-1)}
                    aria-label="ดูภาพบรรยากาศก่อนหน้า"
                    className="absolute left-3 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-[#1f1730]/70 text-white shadow-lg backdrop-blur transition hover:bg-[#5d27db] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white sm:left-5"
                  >
                    <ChevronLeft aria-hidden className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => changeAtmosphereImage(1)}
                    aria-label="ดูภาพบรรยากาศถัดไป"
                    className="absolute right-3 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-[#1f1730]/70 text-white shadow-lg backdrop-blur transition hover:bg-[#5d27db] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white sm:right-5"
                  >
                    <ChevronRight aria-hidden className="h-5 w-5" />
                  </button>
                </>
              ) : null}
              {activeAtmosphereIndex !== null ? (
                <span className="absolute bottom-3 left-3 rounded-full bg-[#1f1730]/75 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur">
                  บรรยากาศภายใน {event.name} · ภาพที่{' '}
                  {activeAtmosphereIndex + 1} จาก {galleryUrls.length}
                </span>
              ) : null}
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

function EventPopupSection({
  icon: Icon,
  title,
  className = '',
  children,
}: {
  icon: LucideIcon;
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`min-w-0 rounded-[16px] border border-[#e5ddf1] bg-white p-4 shadow-[0_8px_24px_rgba(78,55,121,.045)] ${className}`}>
      <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-black text-[#5520ca]">
        <Icon aria-hidden className="h-5 w-5 shrink-0" /> {title}
      </h2>
      {children}
    </section>
  );
}

function FacebookBrandMark() {
  return (
    <span
      aria-hidden
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#6b35df] text-white shadow-[0_6px_18px_rgba(107,53,223,.24)]"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" focusable="false">
        <path d="M13.5 22v-8.5h2.85l.43-3.33H13.5V8.04c0-.96.27-1.62 1.65-1.62h1.76V3.44a23.8 23.8 0 0 0-2.57-.13c-2.54 0-4.28 1.55-4.28 4.4v2.46H7.2v3.33h2.86V22h3.44Z" />
      </svg>
    </span>
  );
}

function EventPopupVenueMap({ event }: { event: DiscoveryEvent }) {
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadState, setLoadState] = useState<EventPopupVenueState>({
    status: 'loading',
  });
  const [mapProviderFailed, setMapProviderFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoadState({ status: 'loading' });
    setMapProviderFailed(false);
    getVenueLocation(event.venue.id, controller.signal)
      .then((venue) => setLoadState({ status: 'ready', venue }))
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setLoadState({
          status: 'error',
          message:
            cause instanceof Error
              ? cause.message
              : 'โหลดตำแหน่งสถานที่ไม่สำเร็จ',
        });
      });
    return () => controller.abort();
  }, [event.venue.id, loadAttempt]);

  const venue = loadState.status === 'ready' ? loadState.venue : null;
  const coordinates = venue
    ? parseVenueCoordinates(venue.latitude, venue.longitude)
    : null;
  const directionsUrl = venue
    ? safePublicHttpsUrl(venue.googleMapsUrl) ??
      (coordinates ? googleMapsDirectionsUrl(coordinates) : null)
    : null;
  const venueName = venue?.name ?? event.venue.name;

  return (
    <div aria-busy={loadState.status === 'loading'}>
      <strong className="block text-xs text-[#31254b]">
        {venueName}
      </strong>
      <p className="mt-1 text-xs leading-5 text-[#777083]">
        {venue?.address ?? event.venue.address ?? 'ยังไม่ได้ระบุที่อยู่'}
      </p>

      {loadState.status === 'loading' ? (
        <div
          aria-label="กำลังโหลดแผนที่การเดินทาง"
          className="skeleton mt-3 h-[132px] rounded-xl"
        />
      ) : loadState.status === 'error' ? (
        <div className="mt-3 rounded-xl border border-[#f1d5da] bg-[#fff7f8] p-3">
          <p role="alert" className="text-xs leading-5 text-[#9d2940]">
            {loadState.message}
          </p>
          <button
            type="button"
            onClick={() => setLoadAttempt((attempt) => attempt + 1)}
            className="mt-2 text-xs font-extrabold text-[#6330c6] hover:underline"
          >
            ลองโหลดอีกครั้ง
          </button>
        </div>
      ) : coordinates && !mapProviderFailed ? (
        <div className="relative mt-3 h-[132px] overflow-hidden rounded-xl border border-[#ddd4ea] bg-[#f5f2fb]">
          <iframe
            title={`แผนที่การเดินทางไป ${venueName}`}
            src={googleMapsEmbedUrl(coordinates)}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            onError={() => setMapProviderFailed(true)}
            className="pointer-events-none h-full w-full border-0"
          />
          {directionsUrl ? (
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`เปิดเส้นทางไป ${venueName} ใน Google Maps`}
              className="absolute inset-0 flex items-end justify-end p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-violet"
            >
              <span className="rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-extrabold text-[#6330c6] shadow-md backdrop-blur">
                กดเปิดแผนที่
              </span>
            </a>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 grid min-h-[108px] place-items-center rounded-xl border border-dashed border-[#d9cfea] bg-[#faf8fe] p-4 text-center">
          <div>
            <MapPin aria-hidden className="mx-auto h-6 w-6 text-[#7c3aed]" />
            <p className="mt-2 text-[11px] leading-5 text-[#777083]">
              {mapProviderFailed
                ? 'ไม่สามารถแสดงตัวอย่างแผนที่ได้'
                : 'สถานที่นี้ยังไม่ได้บันทึกพิกัดแผนที่'}
            </p>
          </div>
        </div>
      )}

      {directionsUrl ? (
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full border border-[#cdb5f5] text-xs font-extrabold text-[#6330c6] transition hover:bg-[#f5f0ff]"
        >
          เปิดเส้นทางใน Google Maps
          <ArrowRight aria-hidden className="h-4 w-4" />
        </a>
      ) : loadState.status === 'ready' ? (
        <span className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-full border border-[#e2dce9] bg-[#faf9fc] px-3 text-center text-[11px] font-bold text-[#81798f]">
          ยังไม่มีลิงก์เส้นทางสำหรับสถานที่นี้
        </span>
      ) : null}
    </div>
  );
}

function RuntimeZoneMapVisual({
  map,
  expanded = false,
}: {
  map: EventMap;
  expanded?: boolean;
}) {
  const zones = map.zones.slice(0, expanded ? 12 : 3);
  const mapImageUrl = map.event.mapImageUrl;

  return (
    <div
      className={`relative grid h-full w-full overflow-hidden bg-[#f5f3fa] ${expanded ? 'min-h-[430px] grid-cols-2 content-center gap-3 p-4 sm:grid-cols-3' : 'min-h-[150px] grid-cols-3 content-center gap-2 p-2'}`}
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
            <span key={zone.id} className={`rounded-xl border-2 text-left shadow-sm ${expanded ? 'p-3' : 'p-2'} ${tones[index % tones.length]}`}>
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
