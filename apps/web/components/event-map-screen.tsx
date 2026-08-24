'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ZoneMap } from '@/components/zone-map';
import {
  getEventMap,
  getZoneRecommendations,
  type EventMap,
  type EventZone,
  type ZoneRecommendation,
} from '@/lib/api';
import { isEventBookable } from '@/lib/event-booking-rules';
import { useVendorProfile } from '@/lib/use-vendor-profile';

function availableCount(zone: EventZone) {
  return zone.booths.filter((booth) => booth.availability === 'AVAILABLE').length;
}

const zoneColors = ['#7c3aed', '#159461', '#e47b00', '#3281c8', '#8b5cf6', '#5b21b6'];

export function EventMapScreen({ eventId }: { eventId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state: vendor } = useVendorProfile();
  const requestedZoneCode = searchParams.get('zone');
  const [data, setData] = useState<EventMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<ZoneRecommendation | null>(null);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [recommendationIsEmpty, setRecommendationIsEmpty] = useState(false);
  const [isRecommending, setIsRecommending] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getEventMap(eventId, controller.signal)
      .then(setData)
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'โหลดข้อมูลไม่สำเร็จ');
      });
    return () => controller.abort();
  }, [eventId]);

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

  const shop = vendor.status === 'ready' ? vendor.shop : null;
  const shopId = shop?.id ?? null;

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
    if (vendor.status !== 'ready' || !vendor.shop) return;

    setIsRecommending(true);
    setRecommendation(null);
    setRecommendationError(null);
    setRecommendationIsEmpty(false);

    try {
      const recommendations = await getZoneRecommendations(
        eventId,
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
    ? 'กด Booth ว่างเพื่อจองได้ทันที'
    : 'Event นี้ปิดรับจองแล้ว';

  return (
    <main className="sl-page pb-8">
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
          <Link href={`/events/${eventId}`} className="sl-chip whitespace-nowrap">← กลับ Event</Link>
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
              href={`/events/${eventId}/book?zone=${encodeURIComponent(recommendedLocation.zone.code)}&booth=${encodeURIComponent(recommendedLocation.booth.code)}`}
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
                  mapImageUrl={data.event.mapImageUrl}
                  zones={data.zones}
                  focusedZoneId={selectedZoneId}
                  selectedBoothId={null}
                  recommendedBoothId={recommendation?.boothId ?? null}
                  keepOverview
                  showLegend={false}
                  boothHref={eventBookable
                    ? (booth) => {
                        const zone = data.zones.find((candidate) => candidate.id === booth.zoneId);
                        return `/events/${eventId}/book?zone=${encodeURIComponent(zone?.code ?? '')}&booth=${encodeURIComponent(booth.code)}`;
                      }
                    : undefined}
                  onFocusZone={setSelectedZoneId}
                  onSelectBooth={(booth) => {
                    if (!eventBookable) return;
                    const zone = data.zones.find((candidate) => candidate.id === booth.zoneId);
                    router.push(`/events/${eventId}/book?zone=${encodeURIComponent(zone?.code ?? '')}&booth=${encodeURIComponent(booth.code)}`);
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
                  <Link href={`/events/${eventId}/book?zone=${encodeURIComponent(selectedZone.code)}`} className="sl-action-primary">เลือกบูธใน Zone นี้</Link>
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
      </div>
    </main>
  );
}

function SummaryStat({ label, value, green = false }: { label: string; value: string; green?: boolean }) {
  return <div className="flex min-h-[55px] flex-col items-center justify-center rounded-[13px] border border-line bg-[#fbfafc]"><span className="text-xs text-muted">{label}</span><strong className={`mt-0.5 text-lg ${green ? 'text-[#118454]' : ''}`}>{value}</strong></div>;
}

function Legend({ color, label, border }: { color: string; label: string; border?: string }) {
  return <div className="flex items-center gap-2 text-xs text-muted"><span className="h-3 w-3 rounded-[4px] border" style={{ backgroundColor: color, borderColor: border ?? color }} />{label}</div>;
}
