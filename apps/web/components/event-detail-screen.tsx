'use client';

import { ResilientImage as Image } from '@/components/resilient-image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  CalendarDays,
  Check,
  CircleDollarSign,
  Clock3,
  Heart,
  LayoutGrid,
  MapPin,
  Navigation,
  Star,
  Store,
  X,
} from 'lucide-react';
import {
  getEventMap,
  getEventMapBySlug,
  getEventReviews,
  getSavedEventIds,
  getVenueLocation,
  saveEvent,
  unsaveEvent,
  type EventInformationType,
  type EventMap,
  type EventReviewsPage,
  type VenueLocation,
} from '@/lib/api';
import { isEventBookable } from '@/lib/event-booking-rules';
import { resolveEventCoverUrl } from '@/lib/event-cover';
import {
  getEventBookingStatusLabel,
  getEventDetailPrimaryAction,
  googleMapsDirectionsUrl,
  googleMapsEmbedUrl,
  parseVenueCoordinates,
  safePublicHttpUrl,
  safePublicHttpsUrl,
  summarizeEventZones,
} from '@/lib/event-detail-view-model';
import {
  getFacebookEmbeddedPost,
  type FacebookEmbeddedPost,
} from '@/lib/facebook-embed';
import { isUuid } from '@/lib/route-identifier';
import { getSupabaseBrowserClient } from '@/lib/supabase';

const dateFormatter = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const compactDateFormatter = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const EVENT_INFORMATION_TYPE_LABELS: Record<EventInformationType, string> = {
  ATMOSPHERE: 'บรรยากาศ',
  ACTIVITY: 'กิจกรรม',
  FACILITY: 'สิ่งอำนวยความสะดวก',
};

type SavedEventsAccess =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'ready'; token: string; eventIds: string[] }
  | { status: 'error' };

function formatMoney(value: number): string {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(
    value,
  );
}

export function EventDetailScreen({ eventId }: { eventId: string }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [resolvedEvent, setResolvedEvent] = useState<{
    eventId: string;
    event: EventMap['event'];
  } | null>(null);
  const event = resolvedEvent?.eventId === eventId ? resolvedEvent.event : null;
  const eventBookable = event ? isEventBookable(event) : false;
  const footerAction = event ? getEventDetailPrimaryAction(event) : null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const close = () => dialogRef.current?.close();

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby="event-dialog-title"
      onClose={() => router.replace('/')}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      className="w-[min(1180px,calc(100%-24px))] max-h-[calc(100dvh-24px)] overflow-hidden rounded-[24px] border border-white/70 bg-[#faf9ff] p-0 text-[#1e1638] shadow-[0_36px_120px_rgba(24,17,54,.4)] backdrop:bg-[#201b3b]/55 backdrop:backdrop-blur-[5px] sm:w-[min(1180px,calc(100%-64px))] sm:max-h-[calc(100dvh-48px)]"
    >
      <div className="flex max-h-[calc(100dvh-24px)] flex-col sm:max-h-[calc(100dvh-48px)]">
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
            <h2
              id="event-dialog-title"
              className="hidden border-l border-[#d9ccef] pl-3 text-xs font-extrabold text-[#766d86] sm:block"
            >
              รายละเอียด Event
            </h2>
          </div>
          <button
            type="button"
            autoFocus
            onClick={close}
            aria-label="ปิดรายละเอียด Event"
            className="grid h-10 w-10 place-items-center rounded-full text-[#5f5875] transition hover:bg-[#eee7fb] hover:text-[#5f27d7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-4">
          <EventDetailContent
            eventId={eventId}
            onClose={close}
            onEventResolved={setResolvedEvent}
          />
        </div>
        <footer className="relative grid shrink-0 grid-cols-2 gap-3 border-t border-[#e6dff1] bg-white/95 px-4 py-3 backdrop-blur sm:flex sm:justify-center sm:px-6">
          {event && !eventBookable ? (
            <p className="col-span-2 text-center text-xs font-semibold text-muted sm:absolute sm:left-6 sm:text-left">
              {getEventBookingStatusLabel(event)} — ยังดูข้อมูลพื้นที่ได้
            </p>
          ) : null}
          <button
            type="button"
            onClick={close}
            className="inline-flex min-h-11 items-center justify-center rounded-[14px] border-2 border-[#7440e7] px-5 text-sm font-extrabold text-[#6330c6] transition hover:bg-[#f5f0ff] sm:min-w-[250px]"
          >
            ปิด
          </button>
          {event && footerAction ? (
            <Link
              href={`/events/${encodeURIComponent(event.slug)}/map`}
              className="inline-flex min-h-11 items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,#8752ef,#5e20e0)] px-5 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(101,44,215,.25)] transition hover:-translate-y-0.5 sm:min-w-[250px]"
            >
              {footerAction.label}
            </Link>
          ) : null}
        </footer>
      </div>
    </dialog>
  );
}

function EventHeroCover({
  bannerUrl,
  eventName,
}: {
  bannerUrl: string | null;
  eventName: string;
}) {
  const [hasLoadFailed, setHasLoadFailed] = useState(false);

  useEffect(() => setHasLoadFailed(false), [bannerUrl]);

  return (
    <Image
      src={resolveEventCoverUrl(bannerUrl, hasLoadFailed)}
      alt=""
      fill
      priority
      unoptimized
      sizes="(max-width: 1100px) 100vw, 1100px"
      className="object-cover"
      onError={() => setHasLoadFailed(true)}
      title={`ภาพประกอบ ${eventName}`}
    />
  );
}

export function EventDetailContent({
  eventId,
  onClose,
  onEventResolved,
  syncCanonicalRoute = true,
}: {
  eventId: string;
  onClose: () => void;
  onEventResolved: (result: {
    eventId: string;
    event: EventMap['event'];
  }) => void;
  syncCanonicalRoute?: boolean;
}) {
  const router = useRouter();
  const [result, setResult] = useState<{
    eventId: string;
    data: EventMap | null;
    error: string | null;
  } | null>(null);
  const data = result?.eventId === eventId ? result.data : null;
  const error = result?.eventId === eventId ? result.error : null;
  const [reviews, setReviews] = useState<{
    eventId: string;
    data: EventReviewsPage | null;
    error: string | null;
  } | null>(null);
  const [savedEvents, setSavedEvents] = useState<SavedEventsAccess>({
    status: 'loading',
  });
  const savePendingRef = useRef(false);
  const [pendingSaveAction, setPendingSaveAction] = useState<
    'save' | 'unsave' | null
  >(null);
  const [savedLoadAttempt, setSavedLoadAttempt] = useState(0);
  const [saveNotice, setSaveNotice] = useState<{
    kind: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const legacyUuid = isUuid(eventId);
    const request = legacyUuid ? getEventMap : getEventMapBySlug;
    request(eventId, controller.signal)
      .then((data) => {
        if (!active) return;
        setResult({ eventId, data, error: null });
        onEventResolved({ eventId, event: data.event });
        if (legacyUuid && syncCanonicalRoute) {
          router.replace(
            `/events/${encodeURIComponent(data.event.slug)}${window.location.search}`,
          );
        }
      })
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof DOMException && cause.name === 'AbortError')
          return;
        setResult({
          eventId,
          data: null,
          error: cause instanceof Error ? cause.message : 'โหลดข้อมูลไม่สำเร็จ',
        });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [eventId, onEventResolved, router, syncCanonicalRoute]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let supabase: ReturnType<typeof getSupabaseBrowserClient>;

    try {
      supabase = getSupabaseBrowserClient();
    } catch {
      setSavedEvents({ status: 'signed-out' });
      return;
    }

    void (async () => {
      try {
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        const token = sessionData.session?.access_token;
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
          setSavedEvents({ status: 'error' });
          setSaveNotice({
            kind: 'error',
            message:
              cause instanceof Error
                ? cause.message
                : 'โหลดสถานะการบันทึก Event ไม่สำเร็จ',
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
    if (!saveNotice) return;
    const timeout = window.setTimeout(() => setSaveNotice(null), 3_500);
    return () => window.clearTimeout(timeout);
  }, [saveNotice]);

  useEffect(() => {
    const resolvedEventId = data?.event.id;
    if (!resolvedEventId) return;
    const controller = new AbortController();
    setReviews({ eventId: resolvedEventId, data: null, error: null });
    getEventReviews(resolvedEventId, 1, 10, controller.signal)
      .then((reviewData) => {
        setReviews({ eventId: resolvedEventId, data: reviewData, error: null });
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError')
          return;
        setReviews({
          eventId: resolvedEventId,
          data: null,
          error: cause instanceof Error ? cause.message : 'โหลดรีวิวไม่สำเร็จ',
        });
      });
    return () => controller.abort();
  }, [data?.event.id]);

  if (!data && !error) {
    return (
      <div className="sl-page">
        <div className="shell max-w-[1100px] py-10">
          <div className="skeleton h-[390px] rounded-[32px]" />
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="skeleton h-28 rounded-[22px]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="sl-page">
        <div className="shell max-w-[1100px] py-20 text-center">
          <h1 className="text-2xl font-black">เปิดรายละเอียด Event ไม่ได้</h1>
          <p className="mt-3 text-muted">{error ?? 'ไม่พบข้อมูล Event'}</p>
          <button
            type="button"
            onClick={onClose}
            className="sl-action-primary mt-7"
          >
            ปิด
          </button>
        </div>
      </div>
    );
  }

  const { event, zones } = data;
  const eventBookable = isEventBookable(event);
  const { totalBooths, availableBooths, startingPrice, categories } =
    summarizeEventZones(zones);
  const contactPhone = event.contactPhone ?? event.organization.contactPhone;
  const contactEmail = event.contactEmail ?? event.organization.contactEmail;
  const facebookUrl = safePublicHttpUrl(event.organization.facebookUrl);
  const facebookPost = getFacebookEmbeddedPost(event.organization.facebookUrl);
  const lineUrl = safePublicHttpUrl(event.organization.lineUrl);
  const galleryUrls = event.galleryUrls
    .map(safePublicHttpsUrl)
    .filter((url): url is string => Boolean(url));
  const mapImageUrl = safePublicHttpsUrl(event.mapImageUrl);
  const address = event.venue.address ?? event.venue.name;
  const dateRange = `${dateFormatter.format(new Date(event.startDate))} – ${dateFormatter.format(new Date(event.endDate))}`;
  const timeRange = `${event.startTime ?? 'ยังไม่ระบุ'}${event.endTime ? ` – ${event.endTime}` : ''}`;
  const isSaved =
    savedEvents.status === 'ready' && savedEvents.eventIds.includes(event.id);

  async function toggleSavedEvent() {
    if (savedEvents.status === 'signed-out') {
      router.push('/login');
      return;
    }
    if (savedEvents.status === 'error') {
      setSavedEvents({ status: 'loading' });
      setSavedLoadAttempt((attempt) => attempt + 1);
      return;
    }
    if (savedEvents.status !== 'ready' || savePendingRef.current) return;

    savePendingRef.current = true;
    const wasSaved = savedEvents.eventIds.includes(event.id);
    const nextEventIds = wasSaved
      ? savedEvents.eventIds.filter((savedId) => savedId !== event.id)
      : [...savedEvents.eventIds, event.id];
    const token = savedEvents.token;

    setSavedEvents({ status: 'ready', token, eventIds: nextEventIds });
    setPendingSaveAction(wasSaved ? 'unsave' : 'save');
    setSaveNotice(null);

    try {
      if (wasSaved) {
        await unsaveEvent(event.id, token);
      } else {
        await saveEvent(event.id, token);
      }
      setSaveNotice({
        kind: 'success',
        message: wasSaved ? 'เลิกบันทึก Event แล้ว' : 'บันทึก Event แล้ว',
      });
    } catch (cause) {
      setSavedEvents((current) =>
        current.status === 'ready'
          ? { ...current, eventIds: savedEvents.eventIds }
          : current,
      );
      setSaveNotice({
        kind: 'error',
        message:
          cause instanceof Error
            ? cause.message
            : wasSaved
              ? 'เลิกบันทึก Event ไม่สำเร็จ'
              : 'บันทึก Event ไม่สำเร็จ',
      });
    } finally {
      savePendingRef.current = false;
      setPendingSaveAction(null);
    }
  }

  return (
    <div className="pb-0">
      {saveNotice ? (
        <div
          role={saveNotice.kind === 'error' ? 'alert' : 'status'}
          className={`fixed bottom-6 right-6 z-[70] max-w-[calc(100vw-3rem)] rounded-[10px] px-4 py-3 text-xs font-bold text-white shadow-[0_14px_35px_rgba(28,14,47,.25)] ${
            saveNotice.kind === 'error' ? 'bg-danger' : 'bg-[#1f1730]'
          }`}
        >
          {saveNotice.message}
        </div>
      ) : null}
      <div className="mx-auto max-w-[1140px]">
        <section
          className="grid overflow-hidden rounded-[18px] border border-[#e4dcf3] bg-white shadow-[0_12px_32px_rgba(78,55,121,.08)] lg:grid-cols-[.95fr_1.05fr]"
        >
          <div className="flex min-h-[250px] flex-col justify-center p-5 sm:p-7">
            <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-extrabold ${eventBookable ? 'bg-[#d9f8e4] text-[#16834e]' : 'bg-[#efedf2] text-[#6f6879]'}`}>
              {getEventBookingStatusLabel(event)}
            </span>
            <h1 className="mt-3 max-w-[20ch] text-[clamp(28px,3.2vw,42px)] font-black leading-[1.08] tracking-[-0.045em] text-[#16102c]">
              {event.name}
            </h1>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-[#665d7c] sm:text-sm">
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-[#6d28d9]" aria-hidden />
                {compactDateFormatter.format(new Date(event.startDate))} –{' '}
                {compactDateFormatter.format(new Date(event.endDate))}
              </span>
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#6d28d9]" aria-hidden />
                {event.venue.name}
              </span>
            </div>
            <p className="mt-4 line-clamp-3 text-sm leading-6 text-[#5d5670]">
              {event.description ??
                'ผู้จัดงานยังไม่ได้เพิ่มรายละเอียดของ Event นี้'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <Link
                href={`/events/${encodeURIComponent(event.slug)}/map`}
                className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#6d28d9] px-4 text-xs font-extrabold text-white shadow-[0_8px_20px_rgba(109,40,217,.22)] transition hover:-translate-y-0.5"
              >
                ดูแผนผังโซน →
              </Link>
              <button
                type="button"
                onClick={() => void toggleSavedEvent()}
                disabled={
                  savedEvents.status === 'loading' || pendingSaveAction !== null
                }
                aria-pressed={isSaved}
                aria-busy={
                  savedEvents.status === 'loading' || pendingSaveAction !== null
                }
                title={
                  savedEvents.status === 'error'
                    ? 'โหลดสถานะการบันทึก Event ไม่สำเร็จ'
                    : undefined
                }
                className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  isSaved
                    ? 'border-[#d7c7f5] bg-[#f1ebff] text-violet'
                    : 'border-[#ded5ea] bg-white text-[#6330c6] hover:bg-[#f5f0ff]'
                }`}
              >
                <Heart
                  className="h-4 w-4"
                  fill={isSaved ? 'currentColor' : 'none'}
                  aria-hidden
                />{' '}
                {savedEvents.status === 'error'
                  ? 'ลองโหลดสถานะอีกครั้ง'
                  : pendingSaveAction === 'save'
                    ? 'กำลังบันทึก…'
                    : pendingSaveAction === 'unsave'
                      ? 'กำลังยกเลิก…'
                      : isSaved
                        ? 'บันทึกแล้ว'
                        : 'บันทึก Event'}
              </button>
            </div>
          </div>
          <div className="relative min-h-[230px] overflow-hidden lg:min-h-[250px]">
            <EventHeroCover
              bannerUrl={event.bannerUrl}
              eventName={event.name}
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,#fff_0%,rgba(255,255,255,.35)_10%,transparent_30%)] lg:bg-[linear-gradient(90deg,#fff_0%,rgba(255,255,255,.88)_10%,rgba(255,255,255,.28)_28%,transparent_44%)]" />
            <span className="absolute bottom-4 right-4 rounded-full border border-white/70 bg-white/90 px-3 py-1.5 text-[11px] font-extrabold text-[#5b2bc1] shadow-lg backdrop-blur">
              Good Booth Better Business
            </span>
          </div>
        </section>

        <section
          className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4"
          aria-label="ข้อมูลสำคัญของ Event"
        >
          <EventStat
            icon={CalendarDays}
            label="วันที่จัดงาน"
            value={`${compactDateFormatter.format(new Date(event.startDate))} – ${compactDateFormatter.format(new Date(event.endDate))}`}
          />
          <EventStat icon={MapPin} label="สถานที่" value={event.venue.name} />
          <EventStat
            icon={LayoutGrid}
            label="บูธว่าง"
            value={`${availableBooths} บูธ`}
          />
          <EventStat
            icon={CircleDollarSign}
            label="ราคาเริ่มต้น"
            value={
              startingPrice === null
                ? 'ยังไม่ระบุ'
                : `${formatMoney(startingPrice)} บาท`
            }
          />
        </section>

        <div className="mt-3 grid items-start gap-3 lg:grid-cols-2 xl:grid-cols-3 [&>section]:mt-0">
        <DetailSection kicker="EVENT INFORMATION" title="เกี่ยวกับ Event">
          <p className="whitespace-pre-line text-sm leading-7 text-muted">
            {event.description ??
              'ผู้จัดงานยังไม่ได้เพิ่มรายละเอียดของ Event นี้'}
          </p>
        </DetailSection>

        <DetailSection
          kicker="EVENT NEWS"
          title="ข่าวสารสำคัญก่อนเข้าร่วมงาน"
          description={`ข้อมูลเฉพาะสำหรับผู้ที่จะเข้าร่วม ${event.name}`}
        >
          {event.joinInformation.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {event.joinInformation.map((item, index) => (
                <article
                  key={item.id}
                  className="rounded-[16px] border border-[#e7deef] bg-[#faf7ff] p-5"
                >
                  <span className="text-xs font-bold text-violet">
                    ข้อมูลลำดับ {index + 1}
                  </span>
                  <h3 className="mt-2 break-words font-extrabold">
                    {item.title}
                  </h3>
                  <p className="mt-2 whitespace-pre-line break-words text-sm leading-7 text-muted">
                    {item.content}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState text="ผู้จัดงานยังไม่ได้เพิ่มข้อมูลก่อนเข้าร่วมงาน" />
          )}
        </DetailSection>

        {facebookPost ? (
          <DetailSection
            kicker="ORGANIZER NEWS"
            title="ข่าวจากผู้จัดงาน"
            description={`โพสต์สาธารณะจาก Facebook ของ ${event.organization.name}`}
          >
            <FacebookPostEmbed
              organizationName={event.organization.name}
              post={facebookPost}
            />
          </DetailSection>
        ) : null}

        <DetailSection
          kicker="EVENT DETAILS"
          title="รายละเอียดภายในงาน"
          description="รวมภาพบรรยากาศ กิจกรรม และสิ่งอำนวยความสะดวกของงาน"
          className="lg:col-span-2 xl:col-span-3"
          count={
            galleryUrls.length > 0 ? `${galleryUrls.length} รูป` : undefined
          }
        >
          {galleryUrls.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {galleryUrls.map((url, index) => (
                <div
                  key={url}
                  role="img"
                  aria-label={`ภาพบรรยากาศ ${event.name} ลำดับ ${index + 1}`}
                  className={`min-h-[220px] rounded-[18px] bg-[#f3eef7] bg-cover bg-center ${index === 0 && galleryUrls.length > 1 ? 'sm:col-span-2 lg:row-span-2 lg:min-h-[455px]' : ''}`}
                  style={{ backgroundImage: `url(${JSON.stringify(url)})` }}
                />
              ))}
            </div>
          ) : null}

          {event.information.length > 0 ? (
            <div
              className={`${galleryUrls.length > 0 ? 'mt-5' : ''} grid gap-3 sm:grid-cols-2`}
            >
              {event.information.map((item) => (
                <article
                  key={item.id}
                  className="rounded-[16px] border border-[#e7deef] bg-[#faf7ff] p-5"
                >
                  <span className="inline-flex rounded-full bg-[#eee8ff] px-2.5 py-1 text-xs font-bold text-violet">
                    {EVENT_INFORMATION_TYPE_LABELS[item.type]}
                  </span>
                  <h3 className="mt-3 break-words font-extrabold">
                    {item.title}
                  </h3>
                  <p className="mt-2 whitespace-pre-line break-words text-sm leading-7 text-muted">
                    {item.description}
                  </p>
                </article>
              ))}
            </div>
          ) : null}

          {galleryUrls.length === 0 && event.information.length === 0 ? (
            <EmptyState text="ผู้จัดงานยังไม่ได้เพิ่มรายละเอียดภายในงาน" />
          ) : null}
        </DetailSection>

        <DetailSection
          kicker="ZONE & BOOTH"
          title="พื้นที่ภายในงาน"
          description={
            eventBookable
              ? 'ตรวจสอบ Zone และตำแหน่งบูธก่อนทำการจอง'
              : 'ดูข้อมูล Zone และตำแหน่งบูธได้ แต่ Event นี้ปิดรับจองแล้ว'
          }
          action={
            <Link
              href={`/events/${encodeURIComponent(event.slug)}/map`}
              className="sl-action-secondary text-violet"
            >
              ดูแผนผัง
            </Link>
          }
        >
          <Link
            href={`/events/${encodeURIComponent(event.slug)}/map`}
            className="group relative mb-4 block min-h-[190px] overflow-hidden rounded-[14px] border border-[#ddd4ea] bg-[#f6f3fb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet"
            aria-label={`เปิดแผนผังโซน ${event.name}`}
          >
            <EventZonePreview zones={zones} mapImageUrl={mapImageUrl} />
            <span className="absolute inset-x-3 bottom-3 inline-flex min-h-9 items-center justify-center rounded-xl bg-white/95 px-4 text-[11px] font-extrabold text-[#6330c6] shadow-lg backdrop-blur transition group-hover:bg-[#f4eeff]">
              กดดูแผนผังโซนจริง →
            </span>
          </Link>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <NumberCard label="Zone" value={`${zones.length}`} />
            <NumberCard label="บูธทั้งหมด" value={`${totalBooths}`} />
            <NumberCard label="บูธว่าง" value={`${availableBooths}`} />
            <NumberCard label="หมวดสินค้า" value={`${categories.length}`} />
          </div>
          <div className="mt-5 border-t border-line pt-5">
            <h3 className="font-extrabold">หมวดสินค้าในพื้นที่</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {categories.length > 0 ? (
                categories.map((category) => (
                  <span key={category} className="sl-chip">
                    {category}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted">ยังไม่ระบุ</span>
              )}
            </div>
          </div>
        </DetailSection>

        <DetailSection kicker="RULES & POLICY" title="กฎและเงื่อนไข">
          <div className="grid gap-3 md:grid-cols-2">
            <PolicyCard
              icon={<Check className="h-5 w-5" />}
              title="กฎร้านค้า"
              value={event.policy?.generalRules}
            />
            <PolicyCard
              warning
              icon={<span className="font-black">!</span>}
              title="การยกเลิก"
              value={event.policy?.cancellationPolicy}
            />
            <PolicyCard
              icon={<CircleDollarSign className="h-5 w-5" />}
              title="การคืนเงิน"
              value={event.policy?.refundPolicy}
            />
          </div>
        </DetailSection>

        <DetailSection
          kicker="LOCATION"
          title="การเดินทางเข้างาน"
          description={address}
          className="lg:col-span-2 xl:col-span-1"
        >
          <VenueLocationMap
            key={event.venue.id}
            venue={event.venue}
            eventName={event.name}
          />
        </DetailSection>

        <DetailSection
          kicker="EVENT REVIEWS"
          title="รีวิวจากผู้เข้าร่วมงาน"
          className="lg:col-span-2 xl:col-span-2"
          count={
            reviews?.eventId === event.id && reviews.data
              ? `${reviews.data.average?.toFixed(1) ?? '0.0'} ★ · ${reviews.data.count} รีวิว`
              : undefined
          }
        >
          {!reviews ||
          reviews.eventId !== event.id ||
          (!reviews.data && !reviews.error) ? (
            <div className="grid gap-3" aria-label="กำลังโหลดรีวิว">
              {[1, 2].map((item) => (
                <div key={item} className="skeleton h-32 rounded-[18px]" />
              ))}
            </div>
          ) : reviews.error ? (
            <p role="alert" className="text-sm font-bold text-danger">
              {reviews.error}
            </p>
          ) : reviews.data && reviews.data.items.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {reviews.data.items.map((review) => (
                <article
                  key={review.id}
                  className="rounded-[18px] border border-line bg-[#fcfbfd] p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-extrabold">ผู้ใช้ SpaceLink</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#fff8dc] px-3 py-1.5 text-sm font-black text-[#9a6700]">
                      <Star className="h-4 w-4 fill-current" aria-hidden />{' '}
                      {review.rating}/5
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-muted">
                    {review.comment?.trim() ||
                      'ไม่ได้เขียนความคิดเห็นเพิ่มเติม'}
                  </p>
                  {review.booking ? (
                    <p className="mt-3 text-xs text-muted">
                      บูธ {review.booking.booth.code} ·{' '}
                      {review.booking.booth.zone.name ??
                        review.booking.booth.zone.code}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState text="Event นี้ยังไม่มีรีวิว" />
          )}
        </DetailSection>
        </div>

        <section className="mt-3 grid gap-3 lg:grid-cols-[.85fr_1.15fr]">
          <article className="rounded-[16px] border border-[#e5ddf1] bg-white p-5 shadow-[0_8px_24px_rgba(78,55,121,.045)]">
            <div className="flex items-start justify-between gap-5">
              <div>
                <span className="sl-kicker">RESERVATION</span>
                <h2 className="mt-2 text-2xl font-black">
                  {eventBookable
                    ? 'พร้อมเลือกพื้นที่แล้ว?'
                    : 'Event นี้ปิดรับจองแล้ว'}
                </h2>
                <p className="mt-3 text-sm leading-7 text-muted">
                  {eventBookable
                    ? 'เปิด Zone Map เพื่อตรวจสอบตำแหน่ง ราคา และเลือกบูธที่เหมาะกับร้านของคุณ'
                    : 'ยังดู Zone ราคา และตำแหน่ง Booth ได้ แต่ไม่สามารถสร้าง Booking ใหม่สำหรับ Event นี้'}
                </p>
              </div>
              <span className="grid h-[62px] w-[62px] shrink-0 place-items-center rounded-[17px] bg-[#f1e9ff] text-violet">
                <Store className="h-6 w-6" />
              </span>
            </div>
            <div className="mt-6 grid grid-cols-[1fr_auto] gap-3 max-sm:grid-cols-1">
              <div className="rounded-xl bg-[#f4edff] px-4 py-3">
                <span className="text-sm text-muted">ราคาเริ่มต้น</span>
                <strong className="mt-1 block text-base text-violet">
                  {startingPrice === null
                    ? 'ยังไม่ระบุ'
                    : `${formatMoney(startingPrice)} บาท`}
                </strong>
              </div>
              <Link
                href={`/events/${encodeURIComponent(event.slug)}/map`}
                className="sl-action-primary min-w-[150px]"
              >
                {eventBookable ? 'เลือกพื้นที่ →' : 'ดูแผนผัง →'}
              </Link>
            </div>
          </article>

          <article className="rounded-[16px] border border-[#e5ddf1] bg-white p-5 shadow-[0_8px_24px_rgba(78,55,121,.045)]">
            <span className="sl-kicker">EVENT INFO</span>
            <h2 className="mt-2 text-2xl font-black">ข้อมูล Event</h2>
            <p className="mt-2 text-sm text-muted">
              ข้อมูลสำคัญและช่องทางติดต่อผู้จัดงาน
            </p>
            <dl className="mt-5 grid sm:grid-cols-2 sm:gap-x-5">
              <InfoItem
                label="ประเภท"
                value={categories.join(', ') || 'ยังไม่ระบุ'}
              />
              <InfoItem label="สถานที่" value={event.venue.name} />
              <InfoItem label="วันที่" value={dateRange} />
              <InfoItem label="เวลา" value={timeRange} />
              <InfoItem label="ผู้จัดงาน" value={event.organization.name} />
              <InfoItem
                label="เบอร์ติดต่อ"
                value={contactPhone ?? 'ยังไม่ระบุ'}
              />
              <InfoItem label="Email" value={contactEmail ?? 'ยังไม่ระบุ'} />
              <InfoItem
                label="Facebook"
                value={
                  facebookPost
                    ? 'Facebook Post'
                    : facebookUrl
                      ? 'Facebook Page'
                      : 'ยังไม่ระบุ'
                }
              />
              <InfoItem
                label="LINE"
                value={lineUrl ? 'LINE ผู้จัดงาน' : 'ยังไม่ระบุ'}
              />
            </dl>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {contactPhone ? (
                <a
                  href={`tel:${contactPhone.replace(/\s/g, '')}`}
                  className="sl-action-primary"
                >
                  โทรหาผู้จัดงาน
                </a>
              ) : (
                <button
                  disabled
                  className="sl-action-primary cursor-not-allowed opacity-50"
                >
                  ยังไม่มีเบอร์ติดต่อ
                </button>
              )}
              {contactEmail ? (
                <a
                  href={`mailto:${contactEmail}`}
                  className="sl-action-secondary text-violet"
                >
                  ส่ง Email
                </a>
              ) : (
                <button
                  disabled
                  className="sl-action-secondary cursor-not-allowed text-muted opacity-60"
                >
                  ยังไม่มี Email
                </button>
              )}
              {facebookUrl ? (
                <a
                  href={facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sl-action-secondary text-violet"
                >
                  {facebookPost
                    ? 'เปิดโพสต์ Facebook'
                    : 'เปิด Facebook ผู้จัดงาน'}
                </a>
              ) : null}
              {lineUrl ? (
                <a
                  href={lineUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sl-action-secondary text-violet"
                >
                  เปิด LINE ผู้จัดงาน
                </a>
              ) : null}
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}

function FacebookPostEmbed({
  organizationName,
  post,
}: {
  organizationName: string;
  post: FacebookEmbeddedPost;
}) {
  return (
    <div className="rounded-[22px] border border-[#e4d8ee] bg-[linear-gradient(180deg,#fcfaff,#f8f5fb)] p-4 sm:p-5">
      <div className="mx-auto w-full max-w-[500px]">
        <iframe
          title={`โพสต์ Facebook จาก ${organizationName}`}
          src={post.embedUrl}
          width={500}
          height={673}
          className="block w-full max-w-full border-0"
          scrolling="no"
          frameBorder="0"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 text-xs">
          <span className="font-bold text-muted">แหล่งที่มา: Facebook</span>
          <a
            href={post.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-extrabold text-violet underline decoration-violet/30 underline-offset-4"
          >
            เปิดโพสต์ต้นฉบับ →
          </a>
        </div>
      </div>
    </div>
  );
}

type VenueLocationState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; venue: VenueLocation };

function VenueLocationMap({
  venue,
  eventName,
}: {
  venue: EventMap['event']['venue'];
  eventName: string;
}) {
  const [state, setState] = useState<VenueLocationState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [mapProviderFailed, setMapProviderFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState({ status: 'loading' });
    setMapProviderFailed(false);
    getVenueLocation(venue.id, controller.signal)
      .then((location) => {
        if (active) setState({ status: 'ready', venue: location });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof DOMException && cause.name === 'AbortError')
          return;
        setState({ status: 'error' });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt, venue.id]);

  const coordinates =
    state.status === 'ready'
      ? parseVenueCoordinates(state.venue.latitude, state.venue.longitude)
      : null;
  const googleMapsUrl =
    state.status === 'ready'
      ? safePublicHttpsUrl(state.venue.googleMapsUrl)
      : null;
  const address = venue.address ?? venue.name;

  return (
    <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
      <div>
        <TravelRow
          icon={<MapPin className="h-5 w-5" />}
          label="สถานที่จัดงาน"
          value={venue.name}
        />
        <TravelRow
          icon={<Navigation className="h-5 w-5" />}
          label="ที่อยู่"
          value={address}
        />
        {coordinates ? (
          <a
            href={googleMapsDirectionsUrl(coordinates)}
            target="_blank"
            rel="noopener noreferrer"
            className="sl-action-primary mt-3 w-full"
          >
            เปิดเส้นทางใน Google Maps →
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="sl-action-primary mt-3 w-full cursor-not-allowed opacity-50"
          >
            ยังไม่มีพิกัดสำหรับนำทาง
          </button>
        )}
        {googleMapsUrl ? (
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="sl-action-secondary mt-3 w-full text-violet"
          >
            เปิดใน Google Maps →
          </a>
        ) : null}
      </div>

      <div className="relative min-h-[320px] overflow-hidden rounded-[18px] border border-[#ded4e5] bg-[linear-gradient(135deg,#f8f5fa,#eff4f2)] shadow-soft sm:min-h-[390px]">
        {state.status === 'loading' ? (
          <div
            className="grid min-h-[320px] place-items-center px-6 text-center sm:min-h-[390px]"
            role="status"
          >
            <span className="text-sm font-bold text-muted">
              กำลังโหลดตำแหน่งสถานที่…
            </span>
          </div>
        ) : null}
        {state.status === 'error' ? (
          <MapFallback
            title="โหลดตำแหน่งสถานที่ไม่สำเร็จ"
            description="กรุณาลองโหลดข้อมูลแผนที่อีกครั้ง"
            onRetry={() => setAttempt((value) => value + 1)}
          />
        ) : null}
        {state.status === 'ready' && !coordinates ? (
          <MapFallback
            title="ยังไม่มีพิกัดสถานที่"
            description="ผู้จัดงานยังไม่ได้ระบุ Latitude และ Longitude จึงไม่แสดงแผนที่เพื่อป้องกันการปักผิดจุด"
          />
        ) : null}
        {coordinates && mapProviderFailed ? (
          <MapFallback
            title="ไม่สามารถแสดงแผนที่ได้"
            description="Google Maps โหลดไม่สำเร็จ แต่คุณยังเปิดเส้นทางจากปุ่มด้านซ้ายได้"
          />
        ) : null}
        {coordinates && !mapProviderFailed ? (
          <iframe
            title={`แผนที่ ${venue.name}`}
            src={googleMapsEmbedUrl(coordinates)}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="pointer-events-none absolute inset-0 h-full w-full border-0 sm:pointer-events-auto"
            onError={() => setMapProviderFailed(true)}
            allowFullScreen
          />
        ) : null}
        {coordinates && !mapProviderFailed ? (
          <div className="pointer-events-none absolute bottom-4 left-4 flex max-w-[calc(100%-32px)] items-center gap-3 rounded-xl border border-white bg-white/95 px-3 py-2.5 text-left shadow-soft">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald ring-4 ring-emerald/15" />
            <span className="min-w-0">
              <strong className="block truncate text-sm">{eventName}</strong>
              <span className="block truncate text-sm text-muted">
                {address}
              </span>
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MapFallback({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <div className="grid min-h-[320px] place-items-center px-6 text-center sm:min-h-[390px]">
      <div>
        <span className="mx-auto grid h-[46px] w-[46px] place-items-center rounded-[14px] bg-[linear-gradient(135deg,#8b5cf6,#6d28d9)] text-white">
          <MapPin className="h-5 w-5" />
        </span>
        <strong className="mt-3 block text-sm">{title}</strong>
        <span className="mt-1 block max-w-md text-sm leading-6 text-muted">
          {description}
        </span>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="sl-action-secondary mt-4 text-violet"
          >
            ลองโหลดแผนที่อีกครั้ง
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DetailSection({
  kicker,
  title,
  description,
  count,
  action,
  className = '',
  children,
}: {
  kicker: string;
  title: string;
  description?: string;
  count?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`mt-3 rounded-[16px] border border-[#e5ddf1] bg-white p-4 shadow-[0_8px_24px_rgba(78,55,121,.045)] sm:p-5 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="sl-kicker">{kicker}</span>
          <h2 className="mt-1.5 text-lg font-black tracking-[-0.03em] sm:text-xl">
            {title}
          </h2>
        </div>
        {action ?? (count ? <span className="sl-chip">{count}</span> : null)}
      </div>
      {description && (
        <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="grid min-h-[118px] place-items-center rounded-[16px] border border-dashed border-[#ddd2e6] bg-[#fcfbfd] px-5 text-center text-sm text-muted">
      {text}
    </div>
  );
}

function EventZonePreview({
  zones,
  mapImageUrl,
}: {
  zones: EventMap['zones'];
  mapImageUrl: string | null;
}) {
  const visibleZones = zones.slice(0, 6);

  return (
    <div
      className="grid min-h-[190px] grid-cols-2 content-center gap-2.5 bg-[#f5f3fa] p-4 pb-14 sm:grid-cols-3"
      style={
        mapImageUrl
          ? {
              backgroundImage: `linear-gradient(rgba(247,244,252,.16),rgba(247,244,252,.16)),url(${JSON.stringify(mapImageUrl)})`,
              backgroundPosition: 'center',
              backgroundSize: 'cover',
            }
          : undefined
      }
    >
      {mapImageUrl ? (
        <span className="col-span-full justify-self-center rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-bold text-[#5f5870] shadow-sm backdrop-blur">
          ภาพแผนผังจากผู้จัดงาน
        </span>
      ) : visibleZones.length > 0 ? (
        visibleZones.map((zone, index) => {
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
            <span
              key={zone.id}
              className={`rounded-xl border-2 p-2.5 text-left shadow-sm ${tones[index % tones.length]}`}
            >
              <strong className="block text-xs">{zone.code}</strong>
              <span className="mt-1 line-clamp-1 block text-[10px] font-semibold">
                {zone.name || `โซน ${zone.code}`}
              </span>
              <span className="mt-1.5 block text-[9px] opacity-75">
                {available} บูธว่าง
              </span>
            </span>
          );
        })
      ) : (
        <span className="col-span-full text-center text-xs font-semibold text-[#756d82]">
          ผู้จัดงานยังไม่ได้เพิ่มแผนผังโซน
        </span>
      )}
    </div>
  );
}

function EventStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
}) {
  return (
    <article className="flex min-w-0 items-center gap-2.5 rounded-[16px] border border-line bg-white p-3 shadow-[0_10px_24px_rgba(54,36,91,0.07)]">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eee6ff] text-violet">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-muted">{label}</span>
        <strong className="mt-1 line-clamp-2 block text-sm leading-5">
          {value}
        </strong>
      </span>
    </article>
  );
}

function NumberCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-line bg-[#fcfbfd] p-4">
      <span className="text-sm text-muted">{label}</span>
      <strong className="mt-1 block text-xl">{value}</strong>
    </article>
  );
}

function PolicyCard({
  icon,
  title,
  value,
  warning = false,
}: {
  icon: ReactNode;
  title: string;
  value?: string | null;
  warning?: boolean;
}) {
  return (
    <article className="flex gap-3 rounded-[13px] border border-line p-4">
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] ${warning ? 'bg-[#fff4e7] text-[#b5680a]' : 'bg-[#eafaf1] text-[#16834e]'}`}
      >
        {icon}
      </span>
      <span>
        <strong className="text-xs">{title}</strong>
        <span className="mt-1.5 block whitespace-pre-line text-sm leading-7 text-muted">
          {value ?? 'ผู้จัดงานยังไม่ได้ระบุ'}
        </span>
      </span>
    </article>
  );
}

function TravelRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3 border-b border-line py-3">
      <span className="grid h-[37px] w-[37px] shrink-0 place-items-center rounded-[10px] bg-[#eee6ff] text-violet">
        {icon}
      </span>
      <span>
        <span className="block text-sm text-muted">{label}</span>
        <strong className="mt-1 block text-xs leading-6">{value}</strong>
      </span>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[55px] items-center justify-between gap-4 border-b border-line">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="max-w-[68%] text-right text-sm font-bold">{value}</dd>
    </div>
  );
}
