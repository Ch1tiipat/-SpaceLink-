'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  CircleDollarSign,
  LayoutGrid,
  MapPinned,
  Sparkles,
  Store,
} from 'lucide-react';
import { ZoneMap } from '@/components/zone-map';
import { SelectMenu } from '@/components/select-menu';
import {
  getEventMap,
  getZoneRecommendations,
  type EventMap,
  type EventZone,
  type ZoneRecommendation,
} from '@/lib/api';
import { useVendorProfile } from '@/lib/use-vendor-profile';

function availableCount(zone: EventZone) {
  return zone.booths.filter((booth) => booth.availability === 'AVAILABLE')
    .length;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('th-TH', {
    maximumFractionDigits: 2,
  }).format(value);
}

export function EventMapScreen({ eventId }: { eventId: string }) {
  const { state: vendor } = useVendorProfile();
  const [data, setData] = useState<EventMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focusedZoneId, setFocusedZoneId] = useState<string | null>(null);
  const [recommendation, setRecommendation] =
    useState<ZoneRecommendation | null>(null);
  const [recommendationError, setRecommendationError] = useState<
    string | null
  >(null);
  const [recommendationIsEmpty, setRecommendationIsEmpty] = useState(false);
  const [isRecommending, setIsRecommending] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    getEventMap(eventId, controller.signal)
      .then(setData)
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError')
          return;
        setError(
          cause instanceof Error ? cause.message : 'โหลดข้อมูลไม่สำเร็จ',
        );
      });

    return () => controller.abort();
  }, [eventId]);

  // A vendor owns one shop at most, so there is nothing to pick: the
  // recommendation is asked for the shop the account already has.
  const shop = vendor.status === 'ready' ? vendor.shop : null;
  const shopId = shop?.id ?? null;

  // Signing in or out changes whose shop a recommendation was made for, so the
  // previous answer no longer describes anything. The local resolver this
  // replaced cleared the same three pieces of state on the same transitions.
  useEffect(() => {
    setRecommendation(null);
    setRecommendationError(null);
    setRecommendationIsEmpty(false);
  }, [shopId]);

  const focusedZone = useMemo(
    () => data?.zones.find((zone) => zone.id === focusedZoneId) ?? null,
    [data, focusedZoneId],
  );

  const mapMetrics = useMemo(() => {
    const zones = data?.zones ?? [];
    const booths = zones.flatMap((zone) => zone.booths);
    const prices = booths
      .map((booth) => Number(booth.boothPrice))
      .filter(Number.isFinite);

    return {
      zoneCount: zones.length,
      boothCount: booths.length,
      availableCount: booths.filter(
        (booth) => booth.availability === 'AVAILABLE',
      ).length,
      startingPrice: prices.length ? Math.min(...prices) : null,
    };
  }, [data]);

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

      if (best) {
        const recommendedZone = data?.zones.find((zone) =>
          zone.booths.some((booth) => booth.id === best.boothId),
        );
        if (recommendedZone) setFocusedZoneId(recommendedZone.id);
      }
    } catch (cause) {
      setRecommendationError(
        cause instanceof Error
          ? cause.message
          : 'ระบบไม่สามารถแนะนำโซนได้ กรุณาลองใหม่',
      );
    } finally {
      setIsRecommending(false);
    }
  }

  if (!data && !error) {
    return (
      <main>
        <div className="shell py-10">
          <div className="skeleton h-24 rounded-3xl" />
          <div className="skeleton mt-6 h-[620px] rounded-3xl" />
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main>
        <div className="shell py-20 text-center">
          <p className="text-2xl font-bold">เปิด Zone Map ไม่ได้</p>
          <p className="mt-3 text-muted">{error ?? 'ไม่พบข้อมูล Event'}</p>
          <Link
            href="/"
            className="mt-7 inline-flex rounded-xl bg-violet px-5 py-3 font-bold text-white"
          >
            กลับหน้าค้นหา Event
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="sl-page pb-16">
      <section className="border-b border-line bg-[linear-gradient(135deg,rgba(245,243,255,0.94),rgba(255,255,255,0.92))]">
        <div className="shell py-7">
          <Link
            href={`/events/${eventId}`}
            className="sl-chip"
          >
            ← กลับรายละเอียด Event
          </Link>
          <div className="mt-5">
            <div>
              <span className="sl-kicker">
                Read-only zone map
              </span>
              <h1 className="mt-3 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
                {data.event.name}
              </h1>
              <p className="mt-2 text-sm text-muted">
                สำรวจโซน ประเภทสินค้า และสถานะบูธ โดยยังไม่มีการสร้างรายการจอง
              </p>
            </div>
          </div>

          <section
            className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
            aria-label="สรุปแผนผัง Event"
          >
            <MapMetric
              icon={LayoutGrid}
              label="โซนทั้งหมด"
              value={`${mapMetrics.zoneCount} โซน`}
            />
            <MapMetric
              icon={Store}
              label="บูธทั้งหมด"
              value={`${mapMetrics.boothCount} บูธ`}
            />
            <MapMetric
              icon={MapPinned}
              label="บูธว่าง"
              value={`${mapMetrics.availableCount} บูธ`}
              tone="green"
            />
            <MapMetric
              icon={CircleDollarSign}
              label="ราคาเริ่มต้น"
              value={
                mapMetrics.startingPrice === null
                  ? 'ยังไม่ระบุ'
                  : `${formatMoney(mapMetrics.startingPrice)} บาท`
              }
            />
          </section>
        </div>
      </section>

      <div className="shell mt-7 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="sl-surface min-w-0 p-4 sm:p-6">
          <div className="mb-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <span className="sl-kicker">Explore zones</span>
                <h2 className="mt-2 text-xl font-black">เลือกโซนจากแผนผัง</h2>
              </div>
              <span className="sl-chip">
                <MapPinned className="h-4 w-4" aria-hidden />
                อ่านอย่างเดียว
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.zones.map((zone) => {
                const selected = focusedZoneId === zone.id;

                return (
                  <button
                    key={zone.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setFocusedZoneId(zone.id)}
                    className={`rounded-[20px] border p-4 text-left transition ${
                      selected
                        ? 'border-violet bg-violet-tint shadow-sm'
                        : 'border-line bg-[#fcfbff] hover:border-[#cdbce9] hover:bg-white'
                    }`}
                  >
                    <span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-violet">
                      Zone {zone.code}
                    </span>
                    <strong className="mt-1 block line-clamp-1 text-sm text-ink">
                      {zone.name ?? 'ยังไม่ระบุชื่อโซน'}
                    </strong>
                    <span className="mt-2 block text-xs font-bold text-muted">
                      {availableCount(zone)} / {zone.booths.length} บูธว่าง
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-end">
          <SelectMenu
            className="flex-1"
            label="เลือกโซนเพื่อดูรายละเอียด"
            placeholder="ดูพื้นที่ทั้งหมด"
            value={focusedZoneId ?? ''}
            onChange={(value) => setFocusedZoneId(value || null)}
            options={[
              { value: '', label: 'ดูพื้นที่ทั้งหมด' },
              ...data.zones.map((zone) => ({
                value: zone.id,
                label: `${zone.code} — ${zone.name ?? 'ไม่ระบุชื่อ'}`,
                hint: `${availableCount(zone)} ว่าง`,
              })),
            ]}
          />

          {focusedZoneId && (
            <button
              type="button"
              onClick={() => setFocusedZoneId(null)}
              className="sl-action-secondary"
            >
              ← กลับไปดูทุกโซน
            </button>
          )}
          </div>

          <div className="sl-soft-surface mt-5 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-bold text-violet">
                  <Sparkles className="h-4 w-4" aria-hidden />
                  ให้ SpaceLink ช่วยเลือกพื้นที่ที่เหมาะกับร้านของคุณ
                </p>

                {vendor.status === 'loading' && (
                  <p className="mt-2 text-sm text-muted">
                    กำลังตรวจสอบข้อมูลร้านค้า…
                  </p>
                )}

                {vendor.status === 'signed-out' && (
                  <p className="mt-2 text-sm text-muted">
                    กรุณา{' '}
                    <Link href="/login" className="font-bold text-violet">
                      เข้าสู่ระบบ
                    </Link>{' '}
                    ด้วยบัญชีผู้ขายก่อนขอคำแนะนำ
                  </p>
                )}

                {vendor.status === 'error' && (
                  <p className="mt-2 text-sm text-[#b42318]">
                    {vendor.message}
                  </p>
                )}

                {vendor.status === 'ready' && !shop && (
                  <p className="mt-2 text-sm">
                    <Link href="/profile" className="font-bold text-violet underline">
                      บัญชีนี้ยังไม่มีร้านค้า กรุณาเพิ่มข้อมูลร้านและหมวดสินค้าก่อน
                    </Link>
                  </p>
                )}

                {vendor.status === 'ready' && shop && (
                  <div className="mt-3">
                    <span className="block text-[10px] font-bold uppercase tracking-[.12em] text-muted">
                      ร้านค้าที่ต้องการหาพื้นที่
                    </span>
                    <b className="mt-1.5 block text-sm">{shop.name}</b>
                    {shop.categories.length > 0 && (
                      <span className="block text-[11px] font-medium text-muted">
                        {shop.categories
                          .map((category) => category.name)
                          .join(', ')}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => void handleRecommendation()}
                disabled={isRecommending || vendor.status !== 'ready' || !shop}
                className="sl-action-primary disabled:hover:translate-y-0"
              >
                {isRecommending ? 'กำลังวิเคราะห์พื้นที่…' : 'แนะนำโซนให้ฉัน'}
              </button>
            </div>

            {recommendationError && (
              <p
                role="alert"
                className="mt-3 rounded-xl bg-[#fff0ee] px-4 py-3 text-sm text-[#b42318]"
              >
                {recommendationError}
              </p>
            )}

            {recommendationIsEmpty && (
              <p className="mt-3 rounded-xl bg-white px-4 py-3 text-sm text-muted">
                ขณะนี้ยังไม่มีบูธว่างที่ระบบสามารถแนะนำได้ กรุณาตรวจสอบอีกครั้งภายหลัง
              </p>
            )}
          </div>

          <div className="mt-5">
            <ZoneMap
              readOnly
              mapImageUrl={data.event.mapImageUrl}
              zones={data.zones}
              focusedZoneId={focusedZoneId}
              selectedBoothId={null}
              recommendedBoothId={recommendation?.boothId ?? null}
              onFocusZone={setFocusedZoneId}
              onSelectBooth={() => undefined}
            />
          </div>
        </section>

        <aside className="sl-surface sticky top-[96px] p-6">
          {recommendation && recommendedLocation && (
            <div className="mb-6 rounded-2xl border border-[#d8ccf7] bg-[#f7f3ff] p-4">
              <span className="text-xs font-bold uppercase tracking-[.13em] text-violet">
                Recommended for you
              </span>
              <h2 className="mt-2 text-xl font-bold">
                บูธ {recommendedLocation.booth.code}
              </h2>
              <p className="mt-1 text-sm font-semibold text-violet">
                โซน {recommendedLocation.zone.code} —{' '}
                {recommendedLocation.zone.name ?? 'ไม่ระบุชื่อ'}
              </p>
              <p className="mt-3 text-sm leading-6 text-[#5f5870]">
                {recommendation.reason}
              </p>
              <p className="mt-3 text-xs text-muted">
                แนะนำโดย{' '}
                {recommendation.source === 'AI_GEMINI'
                  ? 'Gemini AI'
                  : 'ระบบจัดอันดับของ SpaceLink'}
              </p>
              <Link
                href={`/events/${eventId}/book`}
                className="sl-action-primary mt-4 flex w-full justify-center"
              >
                เลือกบูธนี้ในหน้าจอง
              </Link>
            </div>
          )}

          <span className="text-xs font-bold uppercase tracking-[.13em] text-violet">
            Selected zone
          </span>
          <h2 className="mt-2 text-xl font-bold">
            {focusedZone?.name ?? 'ภาพรวมทุกโซน'}
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            {focusedZone?.description ??
              'เลือกโซนบนแผนผังหรือจากรายการเพื่อดูหมวดสินค้าและสถานะบูธ'}
          </p>
          {!focusedZone && (
            <dl className="mt-5 divide-y divide-line text-sm">
              <InfoRow
                label="โซนทั้งหมด"
                value={`${data.zones.length} โซน`}
              />
              <InfoRow
                label="บูธทั้งหมด"
                value={`${data.zones.reduce((total, zone) => total + zone.booths.length, 0)} บูธ`}
              />
              <InfoRow
                label="บูธว่าง"
                value={`${data.zones.reduce((total, zone) => total + availableCount(zone), 0)} บูธ`}
              />
            </dl>
          )}
          {focusedZone && (
            <dl className="mt-5 divide-y divide-line text-sm">
              <InfoRow label="รหัสโซน" value={focusedZone.code} />
              <InfoRow
                label="บูธว่าง"
                value={`${availableCount(focusedZone)} / ${focusedZone.booths.length}`}
              />
              <InfoRow
                label="สินค้า"
                value={
                  focusedZone.categories
                    .map((category) => category.name)
                    .join(', ') || 'ยังไม่ระบุ'
                }
              />
            </dl>
          )}
          <div className="mt-5 rounded-2xl bg-mist p-4 text-sm leading-6 text-muted">
            หน้านี้แสดงข้อมูลแบบอ่านอย่างเดียว
            การคลิกบูธจะไม่สร้างหรือยืนยันการจอง
          </div>
          <Link
            href={`/events/${eventId}/book`}
            className="sl-action-primary mt-4 flex w-full justify-center"
          >
            เริ่มเลือกโซนและจองบูธ
          </Link>
        </aside>
      </div>
    </main>
  );
}

function MapMetric({
  icon: Icon,
  label,
  value,
  tone = 'violet',
}: {
  icon: typeof LayoutGrid;
  label: string;
  value: string;
  tone?: 'violet' | 'green';
}) {
  return (
    <article className="flex min-w-0 items-center gap-3 rounded-[20px] border border-line bg-white p-4 shadow-[0_10px_26px_rgba(54,36,91,0.06)]">
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${
          tone === 'green'
            ? 'bg-[#ebfaf3] text-[#13795b]'
            : 'bg-violet-tint text-violet'
        }`}
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-muted">{label}</p>
        <p className="mt-1 truncate text-sm font-extrabold text-ink">{value}</p>
      </div>
    </article>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-bold">{value}</dd>
    </div>
  );
}
