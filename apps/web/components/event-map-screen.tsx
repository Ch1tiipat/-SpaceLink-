'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppHeader } from '@/components/app-header';
import { ZoneMap } from '@/components/zone-map';
import { getEventMap, type EventMap, type EventZone } from '@/lib/api';

function availableCount(zone: EventZone) {
  return zone.booths.filter((booth) => booth.availability === 'AVAILABLE').length;
}

export function EventMapScreen({ eventId }: { eventId: string }) {
  const [data, setData] = useState<EventMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focusedZoneId, setFocusedZoneId] = useState<string | null>(null);

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

  const focusedZone = useMemo(
    () => data?.zones.find((zone) => zone.id === focusedZoneId) ?? null,
    [data, focusedZoneId],
  );

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
          <Link href="/" className="mt-7 inline-flex rounded-xl bg-violet px-5 py-3 font-bold text-white">
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
          <Link href={`/events/${eventId}`} className="text-sm font-bold text-violet">
            ← กลับรายละเอียด Event
          </Link>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-5">
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
            <Link
              href={`/events/${eventId}/book`}
              className="rounded-xl border border-violet/20 bg-white px-4 py-3 text-sm font-bold text-violet"
            >
              เปิด Booking Prototype
            </Link>
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
                  {zone.code} — {zone.name ?? 'ไม่ระบุชื่อ'} ({availableCount(zone)} ว่าง)
                </option>
              ))}
            </select>
          </label>

          <div className="mt-5">
            <ZoneMap
              readOnly
              zones={data.zones}
              focusedZoneId={focusedZoneId}
              selectedBoothId={null}
              recommendedBoothId={null}
              onFocusZone={setFocusedZoneId}
              onSelectBooth={() => undefined}
            />
          </div>
        </section>

        <aside className="sticky top-[96px] rounded-[28px] border border-line bg-white p-6 shadow-soft">
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
                  focusedZone.categories.map((category) => category.name).join(', ') ||
                  'ยังไม่ระบุ'
                }
              />
            </dl>
          )}
          <div className="mt-5 rounded-2xl bg-mist p-4 text-sm leading-6 text-muted">
            หน้านี้แสดงข้อมูลแบบอ่านอย่างเดียว การคลิกบูธจะไม่สร้างหรือยืนยันการจอง
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
