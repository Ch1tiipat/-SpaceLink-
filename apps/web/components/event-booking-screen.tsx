'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppHeader } from '@/components/app-header';
import { ZoneMap } from '@/components/zone-map';
import {
  getEventMap,
  type EventBooth,
  type EventMap,
  type EventZone,
} from '@/lib/api';

const dateFormatter = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const availabilityLegend = [
  ['#3fbd68', 'ว่าง'],
  ['#f4ce58', 'กำลังถูกจอง'],
  ['#ef8179', 'ไม่ว่าง'],
  ['#b7b4bd', 'ปิดใช้งาน'],
];

function availableCount(zone: EventZone) {
  return zone.booths.filter((booth) => booth.availability === 'AVAILABLE').length;
}

function selectRecommendedBooth(
  zones: EventZone[],
  preferredCategory: string,
): { zone: EventZone; booth: EventBooth; reason: string } | null {
  const ranked = zones
    .map((zone) => {
      const freeBooths = zone.booths.filter(
        (booth) => booth.availability === 'AVAILABLE',
      );
      const categoryMatch = zone.categories.some((category) =>
        category.name.includes(preferredCategory),
      );
      const booth = [...freeBooths].sort(
        (left, right) =>
          Number(left.boothPrice) - Number(right.boothPrice) ||
          left.code.localeCompare(right.code),
      )[0];

      return { zone, booth, categoryMatch, freeCount: freeBooths.length };
    })
    .filter(
      (
        candidate,
      ): candidate is {
        zone: EventZone;
        booth: EventBooth;
        categoryMatch: boolean;
        freeCount: number;
      } => Boolean(candidate.booth),
    )
    .sort(
      (left, right) =>
        Number(right.categoryMatch) - Number(left.categoryMatch) ||
        right.freeCount - left.freeCount ||
        Number(left.booth.boothPrice) - Number(right.booth.boothPrice),
    );

  const best = ranked[0];
  if (!best) return null;

  const reasons = [
    best.categoryMatch
      ? `ประเภทสินค้าในโปรไฟล์ “${preferredCategory}” ตรงกับหมวดของโซน`
      : `เป็นโซนที่มีบูธว่างเหมาะสำหรับเริ่มขาย`,
    `บูธ ${best.booth.code} ยังว่างและราคา ${Number(
      best.booth.boothPrice,
    ).toLocaleString('th-TH')} บาท`,
    `โซนนี้มีบูธว่าง ${best.freeCount} บูธ จึงมีตัวเลือกใกล้เคียงสำรอง`,
  ];

  return { ...best, reason: reasons.join(' • ') };
}

export function EventBookingScreen({ eventId }: { eventId: string }) {
  const [data, setData] = useState<EventMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agreementOpen, setAgreementOpen] = useState(true);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [focusedZoneId, setFocusedZoneId] = useState<string | null>(null);
  const [selectedBooth, setSelectedBooth] = useState<EventBooth | null>(null);
  const [recommendedBoothId, setRecommendedBoothId] = useState<string | null>(
    null,
  );
  const [recommendationReason, setRecommendationReason] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const controller = new AbortController();

    getEventMap(eventId, controller.signal)
      .then(setData)
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'โหลดข้อมูลไม่สำเร็จ');
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [eventId]);

  const focusedZone = useMemo(
    () => data?.zones.find((zone) => zone.id === focusedZoneId) ?? null,
    [data, focusedZoneId],
  );

  const preferredCategory =
    data?.zones.flatMap((zone) => zone.categories)[0]?.name ?? 'อาหาร';

  function focusZone(zoneId: string) {
    setFocusedZoneId(zoneId);
    setSelectedBooth(null);
  }

  function resetMap() {
    setFocusedZoneId(null);
    setSelectedBooth(null);
    setRecommendedBoothId(null);
    setRecommendationReason(null);
  }

  function recommend() {
    if (!data) return;
    const result = selectRecommendedBooth(data.zones, preferredCategory);

    if (!result) {
      setRecommendationReason('ขณะนี้ยังไม่มีบูธว่างที่สามารถแนะนำได้');
      return;
    }

    setFocusedZoneId(result.zone.id);
    setSelectedBooth(result.booth);
    setRecommendedBoothId(result.booth.id);
    setRecommendationReason(result.reason);
  }

  if (loading) {
    return (
      <main>
        <AppHeader />
        <div className="shell py-10">
          <div className="skeleton h-32 rounded-3xl" />
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="skeleton h-[620px] rounded-3xl" />
            <div className="skeleton h-96 rounded-3xl" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main>
        <AppHeader />
        <div className="shell py-20 text-center">
          <p className="text-2xl font-black">เปิดแผนผังไม่ได้</p>
          <p className="mt-3 text-[#777182]">{error ?? 'ไม่พบข้อมูล Event'}</p>
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

  const { event, zones } = data;
  const rules = [
    event.policy?.generalRules,
    event.policy?.cancellationPolicy,
    event.policy?.refundPolicy,
  ].filter((rule): rule is string => Boolean(rule));

  return (
    <main className="min-h-screen pb-16">
      <AppHeader />

      <section className="border-b border-[#e9e5ef] bg-white">
        <div className="shell py-7">
          <Link href="/" className="text-sm font-bold text-violet">
            ← กลับไปค้นหา Event
          </Link>
          <div className="mt-5 flex flex-wrap items-start justify-between gap-5">
            <div>
              <span className="rounded-full bg-[#edf8f1] px-3 py-1 text-xs font-extrabold text-emerald">
                เปิดให้เลือกพื้นที่
              </span>
              <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                {event.name}
              </h1>
              <p className="mt-3 text-sm text-[#777182]">
                {dateFormatter.format(new Date(event.startDate))} –{' '}
                {dateFormatter.format(new Date(event.endDate))} · {event.venue.name}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAgreementOpen(true)}
              className="rounded-xl border border-[#dfd9e9] bg-white px-4 py-3 text-sm font-extrabold"
            >
              อ่านกติกาและข้อตกลง
            </button>
          </div>
        </div>
      </section>

      <div className="shell mt-7 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
        <section className="min-w-0">
          <div className="glass rounded-[28px] p-4 shadow-soft sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <label className="min-w-[240px] flex-1 sm:max-w-sm">
                <span className="mb-2 block text-xs font-extrabold uppercase tracking-[.12em] text-[#837d90]">
                  เลือกโซน
                </span>
                <select
                  value={focusedZoneId ?? ''}
                  onChange={(event) => {
                    if (event.target.value) focusZone(event.target.value);
                    else resetMap();
                  }}
                  className="w-full rounded-xl border border-[#ded9e7] bg-white px-4 py-3 font-bold outline-none"
                >
                  <option value="">ดูพื้นที่ว่างทั้งหมด</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      โซน {zone.code} — {zone.name ?? 'ไม่ระบุชื่อ'} ({availableCount(zone)} ว่าง)
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-wrap gap-2">
                {focusedZoneId && (
                  <button
                    type="button"
                    onClick={resetMap}
                    className="rounded-xl border border-[#ddd8e5] bg-white px-4 py-3 text-sm font-extrabold"
                  >
                    × ออกจากโซน
                  </button>
                )}
                <button
                  type="button"
                  onClick={recommend}
                  className="rounded-xl bg-gradient-to-r from-violet to-[#9b45e5] px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-violet/20"
                >
                  ✦ แนะนำโซนและบูธ
                </button>
              </div>
            </div>

            {recommendationReason && (
              <div className="mt-4 rounded-2xl border border-violet/15 bg-mist p-4">
                <p className="text-sm font-extrabold text-violet">
                  เหตุผลที่พื้นที่นี้เหมาะกับคุณ
                </p>
                <p className="mt-1 text-sm leading-6 text-[#615b70]">
                  {recommendationReason}
                </p>
              </div>
            )}

            <div className="mt-5">
              <ZoneMap
                zones={zones}
                focusedZoneId={focusedZoneId}
                selectedBoothId={selectedBooth?.id ?? null}
                recommendedBoothId={recommendedBoothId}
                onFocusZone={focusZone}
                onSelectBooth={setSelectedBooth}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
              {availabilityLegend.map(([color, label]) => (
                <span key={label} className="flex items-center gap-2 text-xs font-bold text-[#716b7d]">
                  <i className="h-3 w-3 rounded" style={{ backgroundColor: color }} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </section>

        <aside className="sticky top-[96px] rounded-[28px] border border-[#e3deea] bg-white p-6 shadow-soft">
          <span className="text-xs font-extrabold uppercase tracking-[.13em] text-violet">
            Booking summary
          </span>
          <h2 className="mt-2 text-2xl font-black">สรุปพื้นที่จอง</h2>

          <dl className="mt-6 divide-y divide-[#ece8f1]">
            <SummaryRow label="โซน" value={focusedZone ? `${focusedZone.code} — ${focusedZone.name ?? ''}` : 'ยังไม่ได้เลือก'} />
            <SummaryRow label="บูธ" value={selectedBooth?.code ?? 'ยังไม่ได้เลือก'} />
            <SummaryRow
              label="ขนาด"
              value={
                selectedBooth?.widthM && selectedBooth.heightM
                  ? `${selectedBooth.widthM} × ${selectedBooth.heightM} ม.`
                  : 'ตรวจสอบกับผู้จัด'
              }
            />
            <SummaryRow
              label="ราคา"
              value={
                selectedBooth
                  ? `฿${Number(selectedBooth.boothPrice).toLocaleString('th-TH')}`
                  : '—'
              }
              strong
            />
          </dl>

          <button
            type="button"
            disabled={!selectedBooth || !agreementAccepted}
            className="mt-6 w-full rounded-xl bg-violet px-5 py-3.5 font-extrabold text-white shadow-lg shadow-violet/20 disabled:cursor-not-allowed disabled:bg-[#c7c2d0] disabled:shadow-none"
          >
            ยืนยันเลือกบูธ
          </button>
          {!agreementAccepted && (
            <p className="mt-3 text-center text-xs leading-5 text-[#817b8e]">
              กรุณายอมรับกติกาและข้อตกลงก่อนยืนยัน
            </p>
          )}
        </aside>
      </div>

      {agreementOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#171321]/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="agreement-title"
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-[.15em] text-violet">
                  Vendor agreement
                </span>
                <h2 id="agreement-title" className="mt-2 text-2xl font-black">
                  กติกาและข้อตกลงสำหรับผู้ขาย
                </h2>
              </div>
              <button
                type="button"
                aria-label="ปิดข้อตกลง"
                onClick={() => setAgreementOpen(false)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f3f0f7] text-xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="mt-6 space-y-3">
              {(rules.length
                ? rules
                : [
                    'ผู้ขายต้องให้ข้อมูลร้านค้าและประเภทสินค้าตรงตามความเป็นจริง',
                    'สงวนสิทธิ์พื้นที่เมื่อสร้างการจองและชำระเงินภายในเวลาที่กำหนด',
                    'ห้ามจำหน่ายสินค้าผิดกฎหมาย สินค้าละเมิดลิขสิทธิ์ หรือสินค้าที่ผู้จัดไม่อนุญาต',
                    'การยกเลิกและคืนเงินเป็นไปตามนโยบายของผู้จัด Event',
                  ]
              ).map((rule, index) => (
                <div
                  key={`${index}-${rule}`}
                  className="flex gap-3 rounded-2xl border border-[#ebe7f0] bg-[#faf9fc] p-4"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-mist text-xs font-black text-violet">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-6 text-[#625c6f]">{rule}</p>
                </div>
              ))}
            </div>

            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl bg-mist p-4">
              <input
                type="checkbox"
                checked={agreementAccepted}
                onChange={(event) => setAgreementAccepted(event.target.checked)}
                className="mt-1 h-4 w-4 accent-violet"
              />
              <span className="text-sm font-bold leading-6">
                ฉันได้อ่าน เข้าใจ และยอมรับกติกาและข้อตกลงทั้งหมด
              </span>
            </label>

            <button
              type="button"
              disabled={!agreementAccepted}
              onClick={() => setAgreementOpen(false)}
              className="mt-5 w-full rounded-xl bg-violet px-5 py-3.5 font-extrabold text-white disabled:cursor-not-allowed disabled:bg-[#c7c2d0]"
            >
              ยอมรับทั้งหมดและดูแผนผัง
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 text-sm">
      <dt className="text-[#85808f]">{label}</dt>
      <dd className={strong ? 'text-right text-lg font-black' : 'text-right font-extrabold'}>
        {value}
      </dd>
    </div>
  );
}
