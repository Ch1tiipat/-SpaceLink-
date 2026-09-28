'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Filter,
  Gauge,
  LayoutGrid,
  MapPin,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Store,
  X,
} from 'lucide-react';
import { ZoneMap } from '@/components/zone-map';
import {
  getEventMap,
  getEventMapBySlug,
  getZoneRecommendations,
  type BoothAvailability,
  type EventMap,
  type EventZone,
  type ZoneRecommendation,
} from '@/lib/api';
import { isEventBookable } from '@/lib/event-booking-rules';
import {
  canAttemptBoothSelection,
  decideBoothQuota,
  decideBoothSelectionAccess,
} from '@/lib/booth-selection-policy';
import { isUuid } from '@/lib/route-identifier';
import { useBookingQuota } from '@/lib/use-booking-quota';
import { useVendorProfile } from '@/lib/use-vendor-profile';
import { canUseUxPreview } from '@/lib/ux-preview';

function availableCount(zone: EventZone) {
  return zone.booths.filter((booth) => booth.availability === 'AVAILABLE')
    .length;
}

const zoneColors = [
  '#7c3aed',
  '#159461',
  '#e47b00',
  '#3281c8',
  '#8b5cf6',
  '#5b21b6',
];

const moneyFormatter = new Intl.NumberFormat('th-TH', {
  maximumFractionDigits: 2,
});

const eventDateFormatter = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatEventDateRange(startDate: string, endDate: string): string {
  return `${eventDateFormatter.format(new Date(startDate))} – ${eventDateFormatter.format(new Date(endDate))}`;
}

const mapZoomLevels = [1, 1.25, 1.5, 1.75, 2] as const;

function boothSize(booth: EventZone['booths'][number]): string {
  return booth.widthM && booth.heightM
    ? `${booth.widthM} × ${booth.heightM} ม.`
    : 'ไม่ระบุขนาด';
}

type BookingAccessDialog =
  | { kind: 'signed-out' }
  | { kind: 'missing-shop' }
  | {
      kind: 'quota-limit';
      eventId: string;
      zoneId: string;
      boothId: string;
      activeBookingCount: number;
      configuredQuota: number;
      selectedCount: number;
      effectiveSelectionLimit: number;
    }
  | null;

export function EventMapScreen({ eventId }: { eventId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state: vendor } = useVendorProfile();
  const requestedZoneCode = searchParams.get('zone');
  const [data, setData] = useState<EventMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedBoothIds, setSelectedBoothIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<BoothAvailability | 'ALL'>(
    'ALL',
  );
  const [sizeFilter, setSizeFilter] = useState('ALL');
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [zoomIndex, setZoomIndex] = useState(0);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [bookingAccessDialog, setBookingAccessDialog] =
    useState<BookingAccessDialog>(null);
  const bookingAccessTriggerRef = useRef<HTMLElement | SVGElement | null>(null);
  const [recommendation, setRecommendation] =
    useState<ZoneRecommendation | null>(null);
  const [recommendationError, setRecommendationError] = useState<string | null>(
    null,
  );
  const [recommendationIsEmpty, setRecommendationIsEmpty] = useState(false);
  const [isRecommending, setIsRecommending] = useState(false);
  const vendorToken = vendor.status === 'ready' ? vendor.token : null;
  const { state: quota, refresh: refreshQuota } = useBookingQuota(
    data?.event.id ?? null,
    vendorToken,
    canUseUxPreview(),
  );
  const closeBookingAccessDialog = useCallback(
    () => setBookingAccessDialog(null),
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);
    setSelectedZoneId(null);
    setSelectedBoothIds([]);
    setStatusFilter('ALL');
    setSizeFilter('ALL');
    setPositionFilter('ALL');
    setZoomIndex(0);
    setRecommendation(null);
    const legacyUuid = isUuid(eventId);
    const request = legacyUuid ? getEventMap : getEventMapBySlug;
    request(eventId, controller.signal)
      .then((eventMap) => {
        setData(eventMap);
        if (legacyUuid) {
          router.replace(
            `/events/${encodeURIComponent(eventMap.event.slug)}/map${window.location.search}`,
          );
        }
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError')
          return;
        setError(
          cause instanceof Error ? cause.message : 'โหลดข้อมูลไม่สำเร็จ',
        );
      });
    return () => controller.abort();
  }, [eventId, router]);

  useEffect(() => {
    if (!data || !requestedZoneCode) return;
    const requestedZone = data.zones.find(
      (zone) =>
        zone.code.toLocaleLowerCase() === requestedZoneCode.toLocaleLowerCase(),
    );
    if (requestedZone) setSelectedZoneId(requestedZone.id);
  }, [data, requestedZoneCode]);

  const selectedZone = useMemo(
    () => data?.zones.find((zone) => zone.id === selectedZoneId) ?? null,
    [data, selectedZoneId],
  );

  const sizeOptions = useMemo(() => {
    const sizes = new Set(
      data?.zones.flatMap((zone) => zone.booths.map(boothSize)) ?? [],
    );
    return [...sizes].sort((first, second) =>
      first.localeCompare(second, 'th', { numeric: true }),
    );
  }, [data]);

  const visibleZones = useMemo(
    () =>
      (data?.zones ?? [])
        .filter(
          (zone) => positionFilter === 'ALL' || zone.id === positionFilter,
        )
        .map((zone) => ({
          ...zone,
          booths: zone.booths.filter(
            (booth) =>
              (statusFilter === 'ALL' || booth.availability === statusFilter) &&
              (sizeFilter === 'ALL' || boothSize(booth) === sizeFilter),
          ),
        }))
        .filter((zone) => zone.booths.length > 0),
    [data, positionFilter, sizeFilter, statusFilter],
  );

  const filtersActive =
    statusFilter !== 'ALL' || sizeFilter !== 'ALL' || positionFilter !== 'ALL';

  function clearFilters() {
    setStatusFilter('ALL');
    setSizeFilter('ALL');
    setPositionFilter('ALL');
  }

  const selectedBooths = useMemo(() => {
    if (!data) return [];
    return selectedBoothIds.flatMap((boothId) => {
      for (const zone of data.zones) {
        const booth = zone.booths.find((candidate) => candidate.id === boothId);
        if (booth) return [{ booth, zone }];
      }
      return [];
    });
  }, [data, selectedBoothIds]);

  const selectedTotal = useMemo(
    () =>
      Math.round(
        selectedBooths.reduce((sum, item) => {
          const price = Number(item.booth.boothPrice);
          return sum + (Number.isFinite(price) ? price : 0);
        }, 0) * 100,
      ) / 100,
    [selectedBooths],
  );

  const shop = vendor.status === 'ready' ? vendor.shop : null;
  const shopId = shop?.id ?? null;

  useEffect(() => {
    if (
      quota.status !== 'ready' ||
      selectedBoothIds.length <= quota.value.effectiveSelectionLimit
    ) {
      return;
    }
    setSelectedBoothIds((current) =>
      current.slice(0, quota.value.effectiveSelectionLimit),
    );
    setSelectionError(
      `โควตาคงเหลือล่าสุดเลือกเพิ่มได้ ${quota.value.effectiveSelectionLimit} บูธ`,
    );
  }, [quota, selectedBoothIds.length]);

  useEffect(() => {
    setRecommendation(null);
    setRecommendationError(null);
    setRecommendationIsEmpty(false);
  }, [shopId]);

  const recommendedLocation = useMemo(() => {
    if (!data || !recommendation) return null;
    for (const zone of data.zones) {
      const booth = zone.booths.find(
        (candidate) => candidate.id === recommendation.boothId,
      );
      if (booth) return { zone, booth };
    }
    return null;
  }, [data, recommendation]);

  const metrics = useMemo(() => {
    const zones = data?.zones ?? [];
    const booths = zones.flatMap((zone) => zone.booths);
    return {
      zones: zones.length,
      booths: booths.length,
      available: booths.filter((booth) => booth.availability === 'AVAILABLE')
        .length,
    };
  }, [data]);

  async function handleRecommendation() {
    if (vendor.status !== 'ready' || !vendor.shop || !data) return;

    setIsRecommending(true);
    setRecommendation(null);
    setRecommendationError(null);
    setRecommendationIsEmpty(false);

    try {
      const recommendations = await getZoneRecommendations(
        data.event.id,
        { shopId: vendor.shop.id, limit: 1 },
        vendor.token,
      );
      const best = recommendations[0] ?? null;
      setRecommendation(best);
      setRecommendationIsEmpty(!best);

      if (best && data) {
        const zone = data.zones.find((candidate) =>
          candidate.booths.some((booth) => booth.id === best.boothId),
        );
        if (zone) setSelectedZoneId(zone.id);
      }
    } catch (cause) {
      setRecommendationError(
        cause instanceof Error
          ? cause.message
          : 'ระบบไม่สามารถแนะนำพื้นที่ได้ กรุณาลองใหม่',
      );
    } finally {
      setIsRecommending(false);
    }
  }

  function toggleBooth(booth: EventZone['booths'][number]) {
    if (!canAttemptBoothSelection(booth.availability)) return;
    const accessDecision = decideBoothSelectionAccess({
      isSelected: selectedBoothIds.includes(booth.id),
      vendorStatus: vendor.status,
      hasShop: vendor.status === 'ready' && vendor.shop !== null,
    });
    if (accessDecision === 'remove-selection') {
      setSelectedBoothIds((current) =>
        current.filter((boothId) => boothId !== booth.id),
      );
      setSelectionError(null);
      return;
    }
    if (accessDecision === 'open-sign-in') {
      bookingAccessTriggerRef.current =
        document.activeElement instanceof HTMLElement ||
        document.activeElement instanceof SVGElement
          ? document.activeElement
          : null;
      setBookingAccessDialog((current) => current ?? { kind: 'signed-out' });
      setSelectionError(null);
      return;
    }
    if (accessDecision === 'open-create-shop') {
      bookingAccessTriggerRef.current =
        document.activeElement instanceof HTMLElement ||
        document.activeElement instanceof SVGElement
          ? document.activeElement
          : null;
      setBookingAccessDialog((current) => current ?? { kind: 'missing-shop' });
      setSelectionError(null);
      return;
    }
    if (quota.status === 'loading' || quota.status === 'idle') {
      setSelectionError('กำลังตรวจสอบโควตาคงเหลือ กรุณารอสักครู่');
      return;
    }
    if (quota.status === 'error') {
      setSelectionError('ตรวจสอบโควตาไม่สำเร็จ กรุณาลองใหม่');
      return;
    }
    const quotaDecision = decideBoothQuota({
      selectedCount: selectedBoothIds.length,
      effectiveSelectionLimit: quota.value.effectiveSelectionLimit,
      remainingQuota: quota.value.remainingQuota,
    });
    if (
      quotaDecision === 'open-quota-full-dialog' ||
      quotaDecision === 'open-selection-limit-dialog'
    ) {
      const zone = data?.zones.find(
        (candidate) => candidate.id === booth.zoneId,
      );
      if (!data || !zone) return;
      bookingAccessTriggerRef.current =
        document.activeElement instanceof HTMLElement ||
        document.activeElement instanceof SVGElement
          ? document.activeElement
          : null;
      setBookingAccessDialog(
        (current) =>
          current ?? {
            kind: 'quota-limit',
            eventId: data.event.id,
            zoneId: zone.id,
            boothId: booth.id,
            activeBookingCount: quota.value.activeBookingCount,
            configuredQuota: quota.value.configuredQuota,
            selectedCount: selectedBoothIds.length,
            effectiveSelectionLimit: quota.value.effectiveSelectionLimit,
          },
      );
      setSelectionError(null);
      return;
    }
    setSelectedBoothIds((current) => [...current, booth.id]);
    setSelectionError(null);
  }

  async function continueToBooking() {
    if (!data || selectedBooths.length === 0) return;
    const latestQuota = await refreshQuota();
    if (
      latestQuota.status !== 'ready' ||
      selectedBooths.length > latestQuota.value.effectiveSelectionLimit
    ) {
      setBookingAccessDialog(null);
      setSelectionError(
        latestQuota.status === 'ready' && latestQuota.value.remainingQuota === 0
          ? 'โควตาล่าสุดเต็มแล้ว กรุณาส่งคำขอเพิ่มโควตา'
          : 'ตรวจสอบโควตาล่าสุดไม่สำเร็จ กรุณาลองใหม่',
      );
      return;
    }
    const boothCodes = selectedBooths
      .map(({ booth }) => encodeURIComponent(booth.code))
      .join(',');
    router.push(
      `/events/${encodeURIComponent(data.event.slug)}/book?booths=${boothCodes}`,
    );
  }

  if (!data && !error) {
    return (
      <main className="sl-page">
        <div className="shell max-w-[1280px] py-8">
          <div className="skeleton h-24 rounded-[20px]" />
          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="skeleton h-[700px] rounded-[20px]" />
            <div className="skeleton h-[500px] rounded-[20px]" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="sl-page">
        <div className="shell py-20 text-center">
          <h1 className="text-2xl font-black">เปิด Zone Map ไม่ได้</h1>
          <p className="mt-3 text-muted">{error ?? 'ไม่พบข้อมูล Event'}</p>
          <Link href="/" className="sl-action-primary mt-7">
            กลับหน้าค้นหา Event
          </Link>
        </div>
      </main>
    );
  }

  const eventBookable = isEventBookable(data.event);
  const bookingAvailabilityText = eventBookable
    ? quota.status === 'ready'
      ? `กด Booth ว่างเพื่อเลือกได้อีก ${quota.value.effectiveSelectionLimit} บูธ`
      : vendor.status === 'ready'
        ? 'กำลังตรวจสอบโควตาคงเหลือ…'
        : 'เข้าสู่ระบบเพื่อดูโควตาคงเหลือ'
    : 'Event นี้ปิดรับจองแล้ว';

  return (
    <main className="sl-page pb-12">
      <div className="shell max-w-[1280px] py-5">
        <header className="mb-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <Link
              href={`/events/${encodeURIComponent(data.event.slug)}`}
              className="sl-chip mb-4 min-h-9 w-fit gap-2 bg-white"
            >
              <ArrowLeft aria-hidden size={15} />
              กลับไปหน้า Event
            </Link>
            <span className="sl-kicker">EVENT FLOOR PLAN</span>
            <h1 className="mt-1 text-3xl font-black tracking-[-0.045em] max-sm:text-2xl">
              แผนผังพื้นที่จัดงาน
            </h1>
            <p className="mt-1 text-base font-bold text-ink">
              {data.event.name}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
              <span className="inline-flex items-center gap-2">
                <CalendarDays aria-hidden size={16} className="text-violet" />
                {formatEventDateRange(data.event.startDate, data.event.endDate)}
              </span>
              <span className="inline-flex items-center gap-2">
                <MapPin aria-hidden size={16} className="text-violet" />
                {data.event.venue.name}
              </span>
            </div>
          </div>
          <div
            className="grid grid-cols-3 gap-3 max-sm:gap-2"
            aria-label="สรุปแผนผัง Event"
          >
            <MapMetric
              icon={<LayoutGrid aria-hidden size={19} />}
              label="โซนทั้งหมด"
              value={`${metrics.zones}`}
              detail="โซน"
            />
            <MapMetric
              icon={<Store aria-hidden size={19} />}
              label="บูธทั้งหมด"
              value={`${metrics.booths}`}
              detail="บูธ"
            />
            <MapMetric
              icon={<CheckCircle2 aria-hidden size={19} />}
              label="บูธว่าง"
              value={`${metrics.available}`}
              detail="พร้อมจอง"
              green
            />
          </div>
        </header>

        <section className="sl-surface mb-3 flex min-h-[62px] flex-wrap items-center gap-3 border-[#dfd0f0] bg-[linear-gradient(105deg,#fbf8ff_0%,#ffffff_55%,#f2ebff_100%)] px-4 py-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-[linear-gradient(135deg,#8b5cf6,#6d28d9)] text-white shadow-[0_8px_20px_rgba(109,40,217,.22)]">
            <Sparkles aria-hidden size={18} />
          </span>
          <div className="min-w-[220px] flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <strong className="text-sm font-black">แนะนำ Zone ด้วย AI</strong>
              {recommendation?.source === 'RULE_BASED' ? (
                <span className="rounded-full bg-[#eee7ff] px-2 py-0.5 text-xs font-extrabold text-violet">
                  SMART MATCH
                </span>
              ) : recommendation ? (
                <span className="rounded-full bg-[#eee7ff] px-2 py-0.5 text-xs font-extrabold text-violet">
                  AI MATCH
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-sm text-muted">
              {vendor.status === 'loading'
                ? 'กำลังตรวจสอบข้อมูลร้าน…'
                : vendor.status === 'signed-out'
                  ? 'เข้าสู่ระบบและเพิ่มข้อมูลร้าน เพื่อให้ AI วิเคราะห์พื้นที่ที่เหมาะกับสินค้า'
                  : vendor.status === 'error'
                    ? vendor.message
                    : !vendor.shop
                      ? 'เพิ่มข้อมูลร้านและหมวดสินค้า เพื่อเริ่มวิเคราะห์ Zone ที่เหมาะสม'
                      : `วิเคราะห์จากร้าน ${vendor.shop.name} · ${vendor.shop.categories.map((category) => category.name).join(' · ') || 'ยังไม่ระบุหมวดสินค้า'}`}
            </p>
            {recommendationError ? (
              <p role="alert" className="mt-1 text-sm font-bold text-[#b42318]">
                {recommendationError}
              </p>
            ) : recommendationIsEmpty ? (
              <p
                role="status"
                className="mt-1 text-sm font-bold text-[#9d620c]"
              >
                ยังไม่พบ Booth ว่างที่ตรงกับร้านใน Event นี้
              </p>
            ) : null}
          </div>

          {recommendedLocation && eventBookable ? (
            <Link
              href={`/events/${encodeURIComponent(data.event.slug)}/book?zone=${encodeURIComponent(recommendedLocation.zone.code)}&booth=${encodeURIComponent(recommendedLocation.booth.code)}`}
              className="group flex min-h-10 items-center gap-3 rounded-[12px] border border-[#cbb6f3] bg-white px-3 py-2 shadow-[0_6px_18px_rgba(109,40,217,.08)] transition hover:border-violet"
              aria-label={`จอง Zone ${recommendedLocation.zone.code} Booth ${recommendedLocation.booth.code} ที่ AI แนะนำ`}
            >
              <span className="text-xs text-muted">AI แนะนำ</span>
              <strong className="text-sm text-violet">
                Zone {recommendedLocation.zone.code} · Booth{' '}
                {recommendedLocation.booth.code}
              </strong>
              <span
                aria-hidden
                className="text-violet transition group-hover:translate-x-0.5"
              >
                →
              </span>
            </Link>
          ) : recommendedLocation ? (
            <span className="flex min-h-10 items-center rounded-[12px] border border-[#ded7e4] bg-[#f5f3f6] px-3 py-2 text-sm font-bold text-muted">
              Event นี้ปิดรับจองแล้ว
            </span>
          ) : null}

          {vendor.status === 'signed-out' ? (
            <Link
              href="/login"
              className="sl-action-primary min-h-10 whitespace-nowrap px-4 py-2 text-sm"
            >
              เข้าสู่ระบบเพื่อใช้ AI
            </Link>
          ) : vendor.status === 'ready' && !vendor.shop ? (
            <Link
              href="/profile"
              className="sl-action-primary min-h-10 whitespace-nowrap px-4 py-2 text-sm"
            >
              เพิ่มข้อมูลร้าน
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleRecommendation}
              disabled={
                vendor.status !== 'ready' || !vendor.shop || isRecommending
              }
              className="sl-action-primary min-h-10 whitespace-nowrap px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles aria-hidden size={13} />
              {isRecommending
                ? 'กำลังวิเคราะห์…'
                : recommendation
                  ? 'วิเคราะห์อีกครั้ง'
                  : 'แนะนำโซนด้วย AI'}
            </button>
          )}
        </section>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="sl-surface min-w-0 overflow-hidden lg:col-start-1 lg:row-span-2">
          <div className="flex min-h-[48px] items-center justify-between gap-4 border-b border-line px-4 py-2">
            <div>
              <span className="block text-xs font-extrabold text-[#a095a5]">
                EVENT FLOOR PLAN
              </span>
              <strong className="mt-1 block text-sm">{data.event.name}</strong>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted max-sm:hidden">
              <span
                className={`h-2 w-2 rounded-full ring-4 ${eventBookable ? 'bg-[#22c55e] ring-[#22c55e]/10' : 'bg-[#9b929e] ring-[#9b929e]/10'}`}
              />
              {filtersActive ? 'กำลังกรองบูธ' : 'เห็นทุก Zone'} ·{' '}
              {bookingAvailabilityText}
            </div>
          </div>

          <div className="border-b border-line bg-white px-4 py-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <strong className="inline-flex items-center gap-2 text-sm">
                <Filter aria-hidden size={16} className="text-violet" />
                ตัวกรองบูธ
              </strong>
              {filtersActive ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex min-h-8 items-center gap-1.5 text-xs font-bold text-violet"
                >
                  <RotateCcw aria-hidden size={13} />
                  รีเซ็ต
                </button>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-bold text-muted">
              สถานะบูธ
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as BoothAvailability | 'ALL',
                  )
                }
                className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink"
              >
                <option value="ALL">ทุกสถานะ</option>
                <option value="AVAILABLE">ว่าง</option>
                <option value="HELD">กำลังถูกจอง</option>
                <option value="BOOKED">จองแล้ว</option>
                <option value="UNAVAILABLE">ปิดใช้งาน</option>
              </select>
            </label>
            <label className="text-xs font-bold text-muted">
              ขนาดบูธ
              <select
                value={sizeFilter}
                onChange={(event) => setSizeFilter(event.target.value)}
                className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink"
              >
                <option value="ALL">ทุกขนาด</option>
                {sizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold text-muted">
              ตำแหน่ง / Zone
              <select
                value={positionFilter}
                onChange={(event) => {
                  setPositionFilter(event.target.value);
                  setSelectedZoneId(
                    event.target.value === 'ALL' ? null : event.target.value,
                  );
                }}
                className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink"
              >
                <option value="ALL">ทุก Zone</option>
                {data.zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    Zone {zone.code} {zone.name ?? ''}
                  </option>
                ))}
              </select>
            </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-[#fbf9ff] px-4 py-2">
            <p role="status" className="text-xs text-muted">
              แสดง{' '}
              {visibleZones.reduce((sum, zone) => sum + zone.booths.length, 0)}{' '}
              จาก {metrics.booths} บูธ · การกรองไม่เปลี่ยนรายการที่เลือกไว้
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted">Zoom</span>
              <button
                type="button"
                aria-label="ย่อแผนผัง"
                disabled={zoomIndex === 0}
                onClick={() =>
                  setZoomIndex((current) => Math.max(0, current - 1))
                }
                className="sl-chip min-h-9 min-w-9 justify-center disabled:opacity-40"
              >
                −
              </button>
              <output className="min-w-10 text-center text-xs font-bold text-ink">
                {Math.round(mapZoomLevels[zoomIndex] * 100)}%
              </output>
              <button
                type="button"
                aria-label="ขยายแผนผัง"
                disabled={zoomIndex === mapZoomLevels.length - 1}
                onClick={() =>
                  setZoomIndex((current) =>
                    Math.min(mapZoomLevels.length - 1, current + 1),
                  )
                }
                className="sl-chip min-h-9 min-w-9 justify-center disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>

          {data.zones.length > 0 ? (
            visibleZones.length > 0 ? (
              <div
                role="region"
                aria-label="แผนผังบูธ เลื่อนแนวนอนภายในกรอบนี้ได้เมื่อขยายภาพ"
                tabIndex={0}
                className="max-w-full overflow-x-auto overscroll-x-contain [&_div]:scroll-m-4"
              >
                <div
                  style={{
                    width: `${mapZoomLevels[zoomIndex] * 100}%`,
                    minWidth: `${720 * mapZoomLevels[zoomIndex]}px`,
                  }}
                  className="[&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none"
                >
                  <ZoneMap
                    readOnly={!eventBookable}
                    multiSelect
                    mapImageUrl={data.event.mapImageUrl}
                    zones={visibleZones}
                    focusedZoneId={selectedZoneId}
                    selectedBoothIds={selectedBoothIds}
                    recommendedBoothId={recommendation?.boothId ?? null}
                    keepOverview
                    showLegend={false}
                    onFocusZone={setSelectedZoneId}
                    onSelectBooth={(booth) => {
                      if (!eventBookable) return;
                      toggleBooth(booth);
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="grid min-h-[240px] place-items-center px-6 text-center">
                <div>
                  <strong className="text-sm">ไม่พบบูธตามตัวกรอง</strong>
                  <p className="mt-1 text-sm text-muted">
                    ลองเปลี่ยนสถานะ ขนาด หรือ Zone
                  </p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="sl-action-secondary mt-4"
                  >
                    ล้างตัวกรอง
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="grid min-h-[600px] place-items-center bg-[#fcfbff] p-8 text-center">
              <div>
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-[14px] bg-[#eee6ff] text-violet">
                  ◇
                </span>
                <strong className="mt-3 block text-sm">
                  ยังไม่มีแผนผังพื้นที่
                </strong>
                <p className="mt-1 text-sm text-muted">
                  ผู้จัดงานยังไม่ได้เพิ่ม Zone และ Booth สำหรับ Event นี้
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="grid gap-3 lg:col-start-2 lg:row-start-1">
          <article className="sl-surface order-2 p-5">
            <span className="sl-kicker">SELECTED ZONE</span>
            {selectedZone ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black">
                    Zone {selectedZone.code} ·{' '}
                    {selectedZone.name ?? 'ยังไม่ระบุชื่อโซน'}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {availableCount(selectedZone)} จาก{' '}
                    {selectedZone.booths.length} Booth ยังว่าง ·
                    ดูราคาและรายละเอียดในหน้าเลือก Booth
                  </p>
                </div>
                {eventBookable ? (
                  <Link
                    href={`/events/${encodeURIComponent(data.event.slug)}/book?zone=${encodeURIComponent(selectedZone.code)}`}
                    className="sl-action-primary"
                  >
                    เลือกบูธใน Zone นี้
                  </Link>
                ) : (
                  <span className="sl-chip cursor-not-allowed bg-[#f1eef2] text-muted">
                    Event นี้ปิดรับจองแล้ว
                  </span>
                )}
              </div>
            ) : (
              <div className="mt-3">
                <h2 className="text-lg font-black">เลือกได้จากแผนผังทันที</h2>
                <p className="mt-1 text-sm text-muted">
                  {eventBookable
                    ? 'กด Zone เพื่อดูข้อมูล หรือกด Booth สีขาวเพื่อไปหน้าจองโดยตรง'
                    : 'ดูข้อมูล Zone และ Booth ได้ แต่ Event นี้ปิดรับจองแล้ว'}
                </p>
              </div>
            )}
          </article>

          <article className="sl-surface order-1 p-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="sl-kicker">QUICK ZONES</span>
                <h2 className="mt-1 text-base font-black">
                  เลือก Zone อย่างรวดเร็ว
                </h2>
              </div>
              <span className="sl-chip">{data.zones.length} Zone</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {data.zones.map((zone, index) => (
                <button
                  key={zone.id}
                  type="button"
                  aria-pressed={selectedZoneId === zone.id}
                  onClick={() => {
                    setSelectedZoneId(zone.id);
                    setPositionFilter(zone.id);
                  }}
                  className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm font-bold transition ${selectedZoneId === zone.id ? 'border-violet bg-violet text-white' : 'border-line bg-white hover:border-violet'}`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: zoneColors[index % zoneColors.length],
                    }}
                  />
                  {zone.code} · {availableCount(zone)} ว่าง
                </button>
              ))}
            </div>
          </article>

          <article className="sl-surface order-3 p-5">
            <span className="sl-kicker">BOOTH STATUS</span>
            <h2 className="mt-1 text-base font-black">สถานะ Booth</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Legend color="#fff" border="#7c3aed" label="ว่าง" />
              <Legend color="#201b2e" label="เลือกแล้ว" />
              <Legend color="#2c8b61" label="จองแล้ว" />
              <Legend color="#e7a339" label="กำลังจอง" />
              <Legend color="#cfc8d1" label="ปิดใช้งาน" />
            </div>
          </article>
        </section>

        {eventBookable ? (
          <section className="sl-surface border-[#cdb9ec] p-5 shadow-[0_18px_50px_rgba(54,36,91,.14)] lg:sticky lg:top-4 lg:col-start-2 lg:row-start-2">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-violet-tint text-violet">
                <ClipboardCheck aria-hidden size={21} />
              </span>
              <div>
                <span className="sl-kicker">BOOKING SUMMARY</span>
                <h2 className="mt-0.5 text-lg font-black">สรุปการจอง</h2>
              </div>
            </div>

            {selectedBooths.length > 0 ? (
              <>
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedBooths.map(({ booth, zone }) => (
                    <button
                      key={booth.id}
                      type="button"
                      onClick={() => toggleBooth(booth)}
                      className="sl-chip min-h-9 gap-2 bg-[#f3edff] text-violet"
                      aria-label={`นำ Booth ${booth.code} ออกจากรายการ`}
                    >
                      Zone {zone.code} · {booth.code}
                      <span aria-hidden>×</span>
                    </button>
                  ))}
                </div>
                <div className="mt-4 rounded-[16px] border border-[#e5daf6] bg-[#faf7ff] p-4">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted">เลือกแล้ว</span>
                    <strong>{selectedBooths.length} บูธ</strong>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 border-t border-[#e8dff3] pt-3">
                    <span className="text-sm font-bold">ยอดรวม</span>
                    <strong className="text-xl font-black text-violet">
                      {moneyFormatter.format(selectedTotal)} บาท
                    </strong>
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-4 rounded-[16px] border border-dashed border-[#d9cdec] bg-[#faf8fd] px-4 py-6 text-center">
                <LayoutGrid
                  aria-hidden
                  size={24}
                  className="mx-auto text-[#aa96c9]"
                />
                <strong className="mt-2 block text-sm">
                  ยังไม่ได้เลือก Booth
                </strong>
                <span className="mt-1 block text-xs leading-5 text-muted">
                  เลือก Booth ว่างจากแผนผังด้านซ้าย
                </span>
              </div>
            )}

            {quota.status === 'ready' ? (
              <div className="mt-4 flex items-center justify-between rounded-[13px] bg-[#f3edff] px-3 py-2 text-xs">
                <span className="text-muted">โควตาคงเหลือ</span>
                <strong className="text-violet">
                  {quota.value.remainingQuota} จาก {quota.value.configuredQuota}{' '}
                  บูธ
                </strong>
              </div>
            ) : quota.status === 'loading' ? (
              <span className="mt-4 block text-xs text-muted">
                กำลังตรวจสอบโควตา…
              </span>
            ) : null}

            <button
              type="button"
              onClick={() => void continueToBooking()}
              disabled={selectedBooths.length === 0 || quota.status !== 'ready'}
              className="sl-action-primary mt-4 w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
            >
              ดำเนินการต่อ →
            </button>
            {selectionError ? (
              <p role="alert" className="mt-3 text-sm font-bold text-[#9d620c]">
                {selectionError}
              </p>
            ) : null}
            {quota.status === 'error' ? (
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[#b42318]">
                <span role="alert">{quota.message}</span>
                <button
                  type="button"
                  onClick={() => void refreshQuota()}
                  className="font-bold underline"
                >
                  ลองตรวจสอบอีกครั้ง
                </button>
              </div>
            ) : null}
            {quota.status === 'ready' && quota.value.remainingQuota === 0 ? (
              <Link
                href="/help"
                className="mt-3 inline-flex text-sm font-bold text-violet underline"
              >
                ส่งคำร้องขอเพิ่มโควตา
              </Link>
            ) : null}
          </section>
        ) : null}
        </div>
      </div>
      <BookingAccessModal
        kind={bookingAccessDialog}
        triggerRef={bookingAccessTriggerRef}
        onClose={closeBookingAccessDialog}
        onConfirmSelection={() => void continueToBooking()}
      />
    </main>
  );
}

function BookingAccessModal({
  kind,
  triggerRef,
  onClose,
  onConfirmSelection,
}: {
  kind: BookingAccessDialog;
  triggerRef: MutableRefObject<HTMLElement | SVGElement | null>;
  onClose: () => void;
  onConfirmSelection: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!kind) return;
    const trigger = triggerRef.current;
    closeButtonRef.current?.focus();

    function handleKeyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyboard);
    return () => {
      document.removeEventListener('keydown', handleKeyboard);
      if (trigger?.isConnected && 'focus' in trigger) trigger.focus();
    };
  }, [kind, onClose, triggerRef]);

  if (!kind) return null;
  const missingShop = kind.kind === 'missing-shop';
  const quotaLimit = kind.kind === 'quota-limit';
  const hasPendingSelection = quotaLimit && kind.selectedCount > 0;
  const closeLabel = quotaLimit
    ? 'ปิดข้อความโควตาเต็ม'
    : 'ปิดข้อความก่อนเลือกบูธ';
  const quotaProgressCurrent = quotaLimit
    ? hasPendingSelection
      ? kind.selectedCount
      : kind.activeBookingCount
    : 0;
  const quotaProgressMaximum = quotaLimit
    ? hasPendingSelection
      ? kind.effectiveSelectionLimit
      : kind.configuredQuota
    : 1;

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-[rgba(24,16,38,.6)] p-4 backdrop-blur-[5px]">
      <button
        type="button"
        aria-label={closeLabel}
        className="absolute inset-0"
        onClick={onClose}
      />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-access-title"
        aria-describedby="booking-access-description"
        className="relative w-full max-w-[480px] overflow-hidden rounded-[30px] border border-white/60 bg-white shadow-[0_34px_100px_rgba(28,14,47,.4)]"
      >
        <div className="relative overflow-hidden bg-[linear-gradient(135deg,#4c1d95_0%,#7c3aed_55%,#a78bfa_100%)] px-6 py-6 text-white">
          <span className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full border-[28px] border-white/10" />
          <span className="pointer-events-none absolute -bottom-12 right-24 h-28 w-28 rounded-full bg-white/10 blur-sm" />
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-xl border border-white/25 bg-white/10 text-white transition hover:bg-white/20"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
          <span className="grid h-14 w-14 place-items-center rounded-[18px] border border-white/25 bg-white/15 shadow-[0_12px_30px_rgba(31,12,68,.22)]">
            {quotaLimit ? (
              <Gauge className="h-7 w-7" aria-hidden />
            ) : (
              <Store className="h-7 w-7" aria-hidden />
            )}
          </span>
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-extrabold">
            <ShieldCheck aria-hidden size={14} />
            {quotaLimit ? 'BOOKING QUOTA' : 'BOOKING ACCESS'}
          </span>
          <h2
            id="booking-access-title"
            className="mt-3 max-w-[360px] pr-8 text-2xl font-black leading-tight"
          >
            {quotaLimit
              ? hasPendingSelection
                ? 'เลือกบูธครบจำนวนที่กำหนดแล้ว'
                : 'โควตาการจองบูธเต็มแล้ว'
              : missingShop
                ? 'สร้างร้านค้าก่อนเริ่มจองพื้นที่'
                : 'เข้าสู่ระบบก่อนเลือกบูธ'}
          </h2>
        </div>

        <div className="p-6">
          <p
            id="booking-access-description"
            className="text-sm leading-6 text-muted"
          >
            {quotaLimit
              ? hasPendingSelection
                ? `คุณเลือกครบ ${kind.selectedCount}/${kind.effectiveSelectionLimit} บูธที่จองได้ในครั้งนี้แล้ว กรุณายืนยันรายการเดิม หรือส่งคำขอเพิ่มโควตาไปยังผู้จัดงาน`
                : `คุณใช้โควตาครบ ${kind.activeBookingCount}/${kind.configuredQuota} บูธสำหรับ Event นี้ หากต้องการจองเพิ่ม กรุณาส่งคำขอเพิ่มโควตาไปยังผู้จัดงาน`
              : missingShop
                ? 'บัญชีนี้ยังไม่มีร้านค้า กรุณาสร้างร้านค้าและระบุหมวดสินค้าก่อนเลือกจองบูธ'
                : 'กรุณาเข้าสู่ระบบและสร้างร้านค้าก่อนเลือกจองบูธ'}
          </p>

          {quotaLimit ? (
            <div className="mt-5 rounded-[18px] border border-[#e1d4f5] bg-[#faf7ff] p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-bold text-ink">สิทธิ์การเลือกครั้งนี้</span>
                <strong className="text-violet">
                  {quotaProgressCurrent}/{quotaProgressMaximum} บูธ
                </strong>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e7ddf7]">
                <span
                  className="block h-full rounded-full bg-[linear-gradient(90deg,#8b5cf6,#6d28d9)]"
                  style={{
                    width: `${Math.min(100, (quotaProgressCurrent / Math.max(1, quotaProgressMaximum)) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-muted">
                ระบบจะเก็บบูธที่เลือกไว้เดิม และจะไม่เพิ่มบูธที่เกินโควตา
              </p>
            </div>
          ) : null}

          <div
            className={`mt-6 grid gap-3 ${missingShop || quotaLimit ? 'sm:grid-cols-2' : 'grid-cols-2'}`}
          >
          {quotaLimit ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="sl-action-secondary justify-center gap-2"
              >
                <RotateCcw aria-hidden size={16} />
                กลับไปเลือกใหม่
              </button>
              {hasPendingSelection ? (
                <button
                  type="button"
                  onClick={onConfirmSelection}
                  className="sl-action-primary justify-center gap-2"
                >
                  <CheckCircle2 aria-hidden size={16} />
                  ยืนยัน {kind.selectedCount} บูธที่เลือก
                </button>
              ) : (
                <Link
                  href="/bookings"
                  onClick={onClose}
                  className="sl-action-secondary justify-center"
                >
                  ดูการจองของฉัน
                </Link>
              )}
              <Link
                href={`/support?type=QUOTA_INCREASE&eventId=${encodeURIComponent(kind.eventId)}&zoneId=${encodeURIComponent(kind.zoneId)}&boothId=${encodeURIComponent(kind.boothId)}`}
                onClick={onClose}
                className={`justify-center gap-2 ${hasPendingSelection ? 'sl-action-secondary sm:col-span-2' : 'sl-action-primary sm:col-span-2'}`}
              >
                <Sparkles aria-hidden size={16} />
                ขอเพิ่มโควตา / ติดต่อผู้จัดงาน
              </Link>
            </>
          ) : missingShop ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="sl-action-secondary justify-center"
              >
                ยกเลิก
              </button>
              <Link
                href="/profile"
                onClick={onClose}
                className="sl-action-primary justify-center"
              >
                สร้างร้านค้า
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/register"
                onClick={onClose}
                className="sl-action-secondary justify-center"
              >
                สมัครสมาชิก
              </Link>
              <Link
                href="/login"
                onClick={onClose}
                className="sl-action-primary justify-center"
              >
                เข้าสู่ระบบ
              </Link>
            </>
          )}
          </div>
        </div>
      </section>
    </div>
  );
}

function MapMetric({
  icon,
  label,
  value,
  detail,
  green = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  green?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-[18px] border border-[#e7dff0] bg-white p-3 shadow-[0_10px_28px_rgba(54,36,91,.06)] sm:min-w-[116px]">
      <span
        className={`grid h-9 w-9 place-items-center rounded-[12px] ${green ? 'bg-[#eaf9f1] text-[#118454]' : 'bg-violet-tint text-violet'}`}
      >
        {icon}
      </span>
      <span className="mt-2 block truncate text-[11px] font-bold text-muted">
        {label}
      </span>
      <div className="mt-0.5 flex items-baseline gap-1">
        <strong className={`text-xl font-black ${green ? 'text-[#118454]' : ''}`}>
          {value}
        </strong>
        <span className="text-[10px] text-muted">{detail}</span>
      </div>
    </div>
  );
}

function Legend({
  color,
  label,
  border,
}: {
  color: string;
  label: string;
  border?: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      <span
        className="h-3 w-3 rounded-[4px] border"
        style={{ backgroundColor: color, borderColor: border ?? color }}
      />
      {label}
    </div>
  );
}
