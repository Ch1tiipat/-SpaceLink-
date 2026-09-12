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
} from 'react';
import { Sparkles, Store, X } from 'lucide-react';
import { ZoneMap } from '@/components/zone-map';
import {
  getEventMap,
  getEventMapBySlug,
  getZoneRecommendations,
  type EventMap,
  type EventZone,
  type ZoneRecommendation,
} from '@/lib/api';
import { isEventBookable } from '@/lib/event-booking-rules';
import { decideBoothSelectionAccess } from '@/lib/booth-selection-policy';
import { isUuid } from '@/lib/route-identifier';
import { useBookingQuota } from '@/lib/use-booking-quota';
import { useVendorProfile } from '@/lib/use-vendor-profile';
import { canUseUxPreview } from '@/lib/ux-preview';

function availableCount(zone: EventZone) {
  return zone.booths.filter((booth) => booth.availability === 'AVAILABLE').length;
}

const zoneColors = ['#7c3aed', '#159461', '#e47b00', '#3281c8', '#8b5cf6', '#5b21b6'];

const moneyFormatter = new Intl.NumberFormat('th-TH', {
  maximumFractionDigits: 2,
});

type BookingAccessDialog = 'signed-out' | 'missing-shop' | null;

export function EventMapScreen({ eventId }: { eventId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state: vendor } = useVendorProfile();
  const requestedZoneCode = searchParams.get('zone');
  const [data, setData] = useState<EventMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedBoothIds, setSelectedBoothIds] = useState<string[]>([]);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [bookingAccessDialog, setBookingAccessDialog] =
    useState<BookingAccessDialog>(null);
  const bookingAccessTriggerRef = useRef<HTMLElement | SVGElement | null>(null);
  const [recommendation, setRecommendation] = useState<ZoneRecommendation | null>(null);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
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
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'โหลดข้อมูลไม่สำเร็จ');
      });
    return () => controller.abort();
  }, [eventId, router]);

  useEffect(() => {
    if (!data || !requestedZoneCode) return;
    const requestedZone = data.zones.find(
      (zone) => zone.code.toLocaleLowerCase() === requestedZoneCode.toLocaleLowerCase(),
    );
    if (requestedZone) setSelectedZoneId(requestedZone.id);
  }, [data, requestedZoneCode]);

  const selectedZone = useMemo(
    () => data?.zones.find((zone) => zone.id === selectedZoneId) ?? null,
    [data, selectedZoneId],
  );

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
      available: booths.filter((booth) => booth.availability === 'AVAILABLE').length,
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
    if (booth.availability !== 'AVAILABLE') return;
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
      setBookingAccessDialog((current) => current ?? 'signed-out');
      setSelectionError(null);
      return;
    }
    if (accessDecision === 'open-create-shop') {
      bookingAccessTriggerRef.current =
        document.activeElement instanceof HTMLElement ||
        document.activeElement instanceof SVGElement
          ? document.activeElement
          : null;
      setBookingAccessDialog((current) => current ?? 'missing-shop');
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
    if (selectedBoothIds.length >= quota.value.effectiveSelectionLimit) {
      setSelectionError(
        quota.value.remainingQuota === 0
          ? 'คุณใช้โควตาการจองสำหรับงานนี้ครบแล้ว'
          : `เลือกได้สูงสุด ${quota.value.effectiveSelectionLimit} บูธตามโควตาคงเหลือ`,
      );
      return;
    }
    setSelectedBoothIds((current) => [...current, booth.id]);
    setSelectionError(null);
  }

  function continueToBooking() {
    if (!data || selectedBooths.length === 0) return;
    if (
      quota.status !== 'ready' ||
      selectedBooths.length > quota.value.effectiveSelectionLimit
    ) {
      setSelectionError('กรุณารอให้ระบบตรวจสอบโควตาก่อนดำเนินการต่อ');
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
          <Link href="/" className="sl-action-primary mt-7">กลับหน้าค้นหา Event</Link>
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
    <main className="sl-page pb-32">
      <div className="shell max-w-[1280px] py-4">
        <header className="sl-surface mb-3 flex min-h-[72px] items-center gap-4 p-3 max-md:flex-wrap">
          <div className="min-w-[220px] flex-1 px-2">
            <span className="sl-kicker">EVENT MAP</span>
            <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] max-sm:text-xl">แผนผังพื้นที่จัดงาน</h1>
            <p className="mt-0.5 truncate text-sm text-muted">{data.event.name} · {bookingAvailabilityText}</p>
          </div>
          <div className="grid grid-cols-3 gap-2" aria-label="สรุปแผนผัง Event">
            <SummaryStat label="Zone" value={`${metrics.zones}`} />
            <SummaryStat label="Booth" value={`${metrics.booths}`} />
            <SummaryStat label="ว่าง" value={`${metrics.available}`} green />
          </div>
          <Link href={`/events/${encodeURIComponent(data.event.slug)}`} className="sl-chip whitespace-nowrap">← กลับ Event</Link>
        </header>

        <section className="sl-surface mb-3 flex min-h-[62px] flex-wrap items-center gap-3 border-[#dfd0f0] bg-[linear-gradient(105deg,#fbf8ff_0%,#ffffff_55%,#f2ebff_100%)] px-4 py-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-[linear-gradient(135deg,#8b5cf6,#6d28d9)] text-white shadow-[0_8px_20px_rgba(109,40,217,.22)]">
            <Sparkles aria-hidden size={18} />
          </span>
          <div className="min-w-[220px] flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <strong className="text-sm font-black">แนะนำ Zone ด้วย AI</strong>
              {recommendation?.source === 'RULE_BASED' ? (
                <span className="rounded-full bg-[#eee7ff] px-2 py-0.5 text-xs font-extrabold text-violet">SMART MATCH</span>
              ) : recommendation ? (
                <span className="rounded-full bg-[#eee7ff] px-2 py-0.5 text-xs font-extrabold text-violet">AI MATCH</span>
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
              <p role="alert" className="mt-1 text-sm font-bold text-[#b42318]">{recommendationError}</p>
            ) : recommendationIsEmpty ? (
              <p role="status" className="mt-1 text-sm font-bold text-[#9d620c]">ยังไม่พบ Booth ว่างที่ตรงกับร้านใน Event นี้</p>
            ) : null}
          </div>

          {recommendedLocation && eventBookable ? (
            <Link
              href={`/events/${encodeURIComponent(data.event.slug)}/book?zone=${encodeURIComponent(recommendedLocation.zone.code)}&booth=${encodeURIComponent(recommendedLocation.booth.code)}`}
              className="group flex min-h-10 items-center gap-3 rounded-[12px] border border-[#cbb6f3] bg-white px-3 py-2 shadow-[0_6px_18px_rgba(109,40,217,.08)] transition hover:border-violet"
              aria-label={`จอง Zone ${recommendedLocation.zone.code} Booth ${recommendedLocation.booth.code} ที่ AI แนะนำ`}
            >
              <span className="text-xs text-muted">AI แนะนำ</span>
              <strong className="text-sm text-violet">Zone {recommendedLocation.zone.code} · Booth {recommendedLocation.booth.code}</strong>
              <span aria-hidden className="text-violet transition group-hover:translate-x-0.5">→</span>
            </Link>
          ) : recommendedLocation ? (
            <span className="flex min-h-10 items-center rounded-[12px] border border-[#ded7e4] bg-[#f5f3f6] px-3 py-2 text-sm font-bold text-muted">
              Event นี้ปิดรับจองแล้ว
            </span>
          ) : null}

          {vendor.status === 'signed-out' ? (
            <Link href="/login" className="sl-action-primary min-h-10 whitespace-nowrap px-4 py-2 text-sm">เข้าสู่ระบบเพื่อใช้ AI</Link>
          ) : vendor.status === 'ready' && !vendor.shop ? (
            <Link href="/profile" className="sl-action-primary min-h-10 whitespace-nowrap px-4 py-2 text-sm">เพิ่มข้อมูลร้าน</Link>
          ) : (
            <button
              type="button"
              onClick={handleRecommendation}
              disabled={vendor.status !== 'ready' || !vendor.shop || isRecommending}
              className="sl-action-primary min-h-10 whitespace-nowrap px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles aria-hidden size={13} />
              {isRecommending ? 'กำลังวิเคราะห์…' : recommendation ? 'วิเคราะห์อีกครั้ง' : 'แนะนำโซนด้วย AI'}
            </button>
          )}
        </section>

        <section className="sl-surface min-w-0 overflow-hidden">
            <div className="flex min-h-[48px] items-center justify-between gap-4 border-b border-line px-4 py-2">
              <div><span className="block text-xs font-extrabold text-[#a095a5]">EVENT FLOOR PLAN</span><strong className="mt-1 block text-sm">{data.event.name}</strong></div>
              <div className="flex items-center gap-2 text-xs text-muted max-sm:hidden"><span className={`h-2 w-2 rounded-full ring-4 ${eventBookable ? 'bg-[#22c55e] ring-[#22c55e]/10' : 'bg-[#9b929e] ring-[#9b929e]/10'}`} />เห็นทุก Zone · {bookingAvailabilityText}</div>
            </div>

            {data.zones.length > 0 ? (
              <div className="[&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none">
                <ZoneMap
                  readOnly={!eventBookable}
                  multiSelect
                  mapImageUrl={data.event.mapImageUrl}
                  zones={data.zones}
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
            ) : (
              <div className="grid min-h-[600px] place-items-center bg-[#fcfbff] p-8 text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-[14px] bg-[#eee6ff] text-violet">◇</span><strong className="mt-3 block text-sm">ยังไม่มีแผนผังพื้นที่</strong><p className="mt-1 text-sm text-muted">ผู้จัดงานยังไม่ได้เพิ่ม Zone และ Booth สำหรับ Event นี้</p></div></div>
            )}
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_1fr_.9fr]">
          <article className="sl-surface p-5">
            <span className="sl-kicker">SELECTED ZONE</span>
            {selectedZone ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
                <div><h2 className="text-lg font-black">Zone {selectedZone.code} · {selectedZone.name ?? 'ยังไม่ระบุชื่อโซน'}</h2><p className="mt-1 text-sm text-muted">{availableCount(selectedZone)} จาก {selectedZone.booths.length} Booth ยังว่าง · ดูราคาและรายละเอียดในหน้าเลือก Booth</p></div>
                {eventBookable ? (
                  <Link href={`/events/${encodeURIComponent(data.event.slug)}/book?zone=${encodeURIComponent(selectedZone.code)}`} className="sl-action-primary">เลือกบูธใน Zone นี้</Link>
                ) : (
                  <span className="sl-chip cursor-not-allowed bg-[#f1eef2] text-muted">Event นี้ปิดรับจองแล้ว</span>
                )}
              </div>
            ) : (
              <div className="mt-3"><h2 className="text-lg font-black">เลือกได้จากแผนผังทันที</h2><p className="mt-1 text-sm text-muted">{eventBookable ? 'กด Zone เพื่อดูข้อมูล หรือกด Booth สีขาวเพื่อไปหน้าจองโดยตรง' : 'ดูข้อมูล Zone และ Booth ได้ แต่ Event นี้ปิดรับจองแล้ว'}</p></div>
            )}
          </article>

          <article className="sl-surface p-5">
            <div className="flex items-center justify-between"><div><span className="sl-kicker">QUICK ZONES</span><h2 className="mt-1 text-base font-black">เลือก Zone อย่างรวดเร็ว</h2></div><span className="sl-chip">{data.zones.length} Zone</span></div>
            <div className="mt-3 flex flex-wrap gap-2">
              {data.zones.map((zone, index) => (
                <button key={zone.id} type="button" aria-pressed={selectedZoneId === zone.id} onClick={() => setSelectedZoneId(zone.id)} className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm font-bold transition ${selectedZoneId === zone.id ? 'border-violet bg-violet text-white' : 'border-line bg-white hover:border-violet'}`}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: zoneColors[index % zoneColors.length] }} />{zone.code} · {availableCount(zone)} ว่าง
                </button>
              ))}
            </div>
          </article>

          <article className="sl-surface p-5">
            <span className="sl-kicker">BOOTH STATUS</span>
            <h2 className="mt-1 text-base font-black">สถานะ Booth</h2>
            <div className="mt-3 grid grid-cols-2 gap-2"><Legend color="#fff" border="#7c3aed" label="ว่าง" /><Legend color="#2c8b61" label="จองแล้ว" /><Legend color="#e7a339" label="กำลังจอง" /><Legend color="#cfc8d1" label="ปิดใช้งาน" /></div>
          </article>
        </section>

        {eventBookable ? (
          <section className="sl-surface sticky bottom-20 z-20 mt-4 border-[#cdb9ec] p-4 shadow-[0_18px_50px_rgba(54,36,91,.2)] md:bottom-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-[170px]">
                <span className="text-xs font-extrabold uppercase tracking-[.12em] text-violet">
                  Selected booths
                </span>
                <strong className="mt-1 block text-lg font-black">
                  เลือกแล้ว {selectedBooths.length} บูธ
                </strong>
                <span className="text-sm text-muted">
                  รวม {moneyFormatter.format(selectedTotal)} บาท
                </span>
                {quota.status === 'ready' ? (
                  <span className="mt-1 block text-xs font-bold text-violet">
                    โควตาคงเหลือ {quota.value.remainingQuota} จาก {quota.value.configuredQuota} บูธ
                  </span>
                ) : quota.status === 'loading' ? (
                  <span className="mt-1 block text-xs text-muted">กำลังตรวจสอบโควตา…</span>
                ) : null}
              </div>

              <div className="flex min-w-[220px] flex-1 flex-wrap gap-2">
                {selectedBooths.length > 0 ? (
                  selectedBooths.map(({ booth, zone }) => (
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
                  ))
                ) : (
                  <span className="text-sm text-muted">
                    เลือก Booth ว่างจากแผนผังเพื่อเพิ่มลงรายการ
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={continueToBooking}
                disabled={selectedBooths.length === 0 || quota.status !== 'ready'}
                className="sl-action-primary min-w-[170px] disabled:cursor-not-allowed disabled:opacity-50"
              >
                ดำเนินการต่อ →
              </button>
            </div>
            {selectionError ? (
              <p role="alert" className="mt-3 text-sm font-bold text-[#9d620c]">
                {selectionError}
              </p>
            ) : null}
            {quota.status === 'error' ? (
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[#b42318]">
                <span role="alert">{quota.message}</span>
                <button type="button" onClick={refreshQuota} className="font-bold underline">
                  ลองตรวจสอบอีกครั้ง
                </button>
              </div>
            ) : null}
            {quota.status === 'ready' && quota.value.remainingQuota === 0 ? (
              <Link href="/help" className="mt-3 inline-flex text-sm font-bold text-violet underline">
                ส่งคำร้องขอเพิ่มโควตา
              </Link>
            ) : null}
          </section>
        ) : null}
      </div>
      <BookingAccessModal
        kind={bookingAccessDialog}
        triggerRef={bookingAccessTriggerRef}
        onClose={closeBookingAccessDialog}
      />
    </main>
  );
}

function BookingAccessModal({
  kind,
  triggerRef,
  onClose,
}: {
  kind: BookingAccessDialog;
  triggerRef: MutableRefObject<HTMLElement | SVGElement | null>;
  onClose: () => void;
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
  const missingShop = kind === 'missing-shop';

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-[rgba(24,16,38,.52)] p-5 backdrop-blur-[3px]">
      <button
        type="button"
        aria-label="ปิดข้อความก่อนเลือกบูธ"
        className="absolute inset-0"
        onClick={onClose}
      />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-access-title"
        aria-describedby="booking-access-description"
        className="relative w-full max-w-[440px] rounded-[26px] border border-[#e7def2] bg-white p-6 shadow-[0_28px_80px_rgba(28,14,47,.32)]"
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="ปิดข้อความก่อนเลือกบูธ"
          className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-xl border border-line text-muted transition hover:border-violet hover:text-violet"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
        <span className="grid h-14 w-14 place-items-center rounded-[20px] bg-violet-tint text-violet">
          <Store className="h-6 w-6" aria-hidden />
        </span>
        <h2 id="booking-access-title" className="mt-5 pr-12 text-xl font-black text-ink">
          {missingShop ? 'ยังไม่มีร้านค้าสำหรับทำรายการจอง' : 'เข้าสู่ระบบก่อนเลือกบูธ'}
        </h2>
        <p id="booking-access-description" className="mt-2 text-sm leading-6 text-muted">
          {missingShop
            ? 'บัญชีนี้ยังไม่มีร้านค้า กรุณาสร้างร้านค้าก่อนเลือกจองบูธ'
            : 'กรุณาเข้าสู่ระบบและสร้างร้านค้าก่อนเลือกจองบูธ'}
        </p>
        <div className={`mt-6 grid gap-3 ${missingShop ? 'sm:grid-cols-2' : 'grid-cols-2'}`}>
          {missingShop ? (
            <>
              <button type="button" onClick={onClose} className="sl-action-secondary justify-center">
                ยกเลิก
              </button>
              <Link href="/profile" onClick={onClose} className="sl-action-primary justify-center">
                สร้างร้านค้า
              </Link>
            </>
          ) : (
            <>
              <Link href="/register" onClick={onClose} className="sl-action-secondary justify-center">
                สมัครสมาชิก
              </Link>
              <Link href="/login" onClick={onClose} className="sl-action-primary justify-center">
                เข้าสู่ระบบ
              </Link>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryStat({ label, value, green = false }: { label: string; value: string; green?: boolean }) {
  return <div className="flex min-h-[55px] flex-col items-center justify-center rounded-[13px] border border-line bg-[#fbfafc]"><span className="text-xs text-muted">{label}</span><strong className={`mt-0.5 text-lg ${green ? 'text-[#118454]' : ''}`}>{value}</strong></div>;
}

function Legend({ color, label, border }: { color: string; label: string; border?: string }) {
  return <div className="flex items-center gap-2 text-xs text-muted"><span className="h-3 w-3 rounded-[4px] border" style={{ backgroundColor: color, borderColor: border ?? color }} />{label}</div>;
}
