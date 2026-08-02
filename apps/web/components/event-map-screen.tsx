'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppHeader } from '@/components/app-header';
import { ZoneMap } from '@/components/zone-map';
import {
  getEventMap,
  getMe,
  getZoneRecommendations,
  type CurrentUser,
  type EventMap,
  type EventZone,
  type ZoneRecommendation,
} from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabase';

function availableCount(zone: EventZone) {
  return zone.booths.filter((booth) => booth.availability === 'AVAILABLE')
    .length;
}

type VendorAccess =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'ready'; token: string; profile: CurrentUser }
  | { status: 'error'; message: string };

export function EventMapScreen({ eventId }: { eventId: string }) {
  const [data, setData] = useState<EventMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focusedZoneId, setFocusedZoneId] = useState<string | null>(null);
  const [vendorAccess, setVendorAccess] = useState<VendorAccess>({
    status: 'loading',
  });
  const [selectedShopId, setSelectedShopId] = useState('');
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

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    let supabase: ReturnType<typeof getSupabaseBrowserClient>;
    try {
      supabase = getSupabaseBrowserClient();
    } catch (cause) {
      setVendorAccess({
        status: 'error',
        message:
          cause instanceof Error
            ? cause.message
            : 'ยังไม่ได้ตั้งค่าระบบเข้าสู่ระบบ',
      });
      return;
    }

    async function resolve(token: string | undefined) {
      setRecommendation(null);
      setRecommendationError(null);
      setRecommendationIsEmpty(false);

      if (!token) {
        if (active) {
          setVendorAccess({ status: 'signed-out' });
          setSelectedShopId('');
        }
        return;
      }

      try {
        const profile = await getMe(token, controller.signal);
        if (!active) return;

        setVendorAccess({ status: 'ready', token, profile });
        setSelectedShopId((current) =>
          profile.shops.some((shop) => shop.id === current)
            ? current
            : (profile.shops[0]?.id ?? ''),
        );
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') {
          return;
        }
        if (active) {
          setVendorAccess({
            status: 'error',
            message:
              cause instanceof Error
                ? cause.message
                : 'ไม่สามารถอ่านข้อมูลร้านค้าได้',
          });
        }
      }
    }

    void supabase.auth
      .getSession()
      .then(({ data: sessionData }) =>
        resolve(sessionData.session?.access_token),
      );

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'INITIAL_SESSION') return;
        void resolve(session?.access_token);
      },
    );

    return () => {
      active = false;
      controller.abort();
      listener.subscription.unsubscribe();
    };
  }, []);

  const focusedZone = useMemo(
    () => data?.zones.find((zone) => zone.id === focusedZoneId) ?? null,
    [data, focusedZoneId],
  );

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
    if (vendorAccess.status !== 'ready' || !selectedShopId) return;

    setIsRecommending(true);
    setRecommendation(null);
    setRecommendationError(null);
    setRecommendationIsEmpty(false);

    try {
      const recommendations = await getZoneRecommendations(
        eventId,
        { shopId: selectedShopId, limit: 1 },
        vendorAccess.token,
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
        <AppHeader />
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
        <AppHeader />
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
    <main className="min-h-screen pb-16">
      <AppHeader />
      <section className="border-b border-line bg-white">
        <div className="shell py-7">
          <Link
            href={`/events/${eventId}`}
            className="text-sm font-bold text-violet"
          >
            ← กลับรายละเอียด Event
          </Link>
          <div className="mt-5">
            <div>
              <span className="rounded-full bg-mist px-3 py-1 text-xs font-bold text-violet">
                Read-only zone map
              </span>
              <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
                {data.event.name}
              </h1>
              <p className="mt-2 text-sm text-muted">
                สำรวจโซน ประเภทสินค้า และสถานะบูธ โดยยังไม่มีการสร้างรายการจอง
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="shell mt-7 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="glass min-w-0 rounded-[28px] p-4 shadow-soft sm:p-6">
          <label className="block max-w-sm">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[.12em] text-muted">
              เลือกโซนเพื่อดูรายละเอียด
            </span>
            <select
              value={focusedZoneId ?? ''}
              onChange={(event) => setFocusedZoneId(event.target.value || null)}
              className="w-full rounded-xl border border-line bg-white px-4 py-3 font-bold outline-none"
            >
              <option value="">ดูพื้นที่ทั้งหมด</option>
              {data.zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.code} — {zone.name ?? 'ไม่ระบุชื่อ'} (
                  {availableCount(zone)} ว่าง)
                </option>
              ))}
            </select>
          </label>

          <div className="mt-5 rounded-2xl border border-[#ded2ff] bg-[#f7f3ff] p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-violet">
                  ให้ SpaceLink ช่วยเลือกพื้นที่ที่เหมาะกับร้านของคุณ
                </p>

                {vendorAccess.status === 'loading' && (
                  <p className="mt-2 text-sm text-muted">
                    กำลังตรวจสอบข้อมูลร้านค้า…
                  </p>
                )}

                {vendorAccess.status === 'signed-out' && (
                  <p className="mt-2 text-sm text-muted">
                    กรุณา{' '}
                    <Link href="/login" className="font-bold text-violet">
                      เข้าสู่ระบบ
                    </Link>{' '}
                    ด้วยบัญชีผู้ขายก่อนขอคำแนะนำ
                  </p>
                )}

                {vendorAccess.status === 'error' && (
                  <p className="mt-2 text-sm text-[#b42318]">
                    {vendorAccess.message}
                  </p>
                )}

                {vendorAccess.status === 'ready' &&
                  vendorAccess.profile.shops.length === 0 && (
                    <p className="mt-2 text-sm text-muted">
                      บัญชีนี้ยังไม่มีร้านค้า กรุณาเพิ่มข้อมูลร้านและหมวดสินค้าก่อน
                    </p>
                  )}

                {vendorAccess.status === 'ready' &&
                  vendorAccess.profile.shops.length > 0 && (
                    <label className="mt-3 block">
                      <span className="mb-1.5 block text-xs font-bold text-muted">
                        ร้านค้าที่ต้องการหาพื้นที่
                      </span>
                      <select
                        value={selectedShopId}
                        onChange={(event) => {
                          setSelectedShopId(event.target.value);
                          setRecommendation(null);
                          setRecommendationError(null);
                          setRecommendationIsEmpty(false);
                        }}
                        className="w-full rounded-xl border border-[#d8ccf7] bg-white px-4 py-3 font-bold outline-none"
                      >
                        {vendorAccess.profile.shops.map((shop) => (
                          <option key={shop.id} value={shop.id}>
                            {shop.name}
                            {shop.categories.length > 0
                              ? ` — ${shop.categories.map((category) => category.name).join(', ')}`
                              : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
              </div>

              <button
                type="button"
                onClick={() => void handleRecommendation()}
                disabled={
                  isRecommending ||
                  vendorAccess.status !== 'ready' ||
                  !selectedShopId
                }
                className="rounded-xl bg-gradient-to-r from-violet to-[#9349e8] px-5 py-3 font-bold text-white shadow-lg shadow-violet/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
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

        <aside className="sticky top-[96px] rounded-[28px] border border-line bg-white p-6 shadow-soft">
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
        </aside>
      </div>
    </main>
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
