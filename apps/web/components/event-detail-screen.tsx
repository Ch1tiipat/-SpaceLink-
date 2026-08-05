'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getEventMap, type EventMap } from '@/lib/api';

const dateFormatter = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function EventDetailScreen({ eventId }: { eventId: string }) {
  const [data, setData] = useState<EventMap | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (!data && !error) {
    return (
      <main>
        <div className="shell py-10">
          <div className="skeleton h-72 rounded-[32px]" />
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="skeleton h-80 rounded-3xl" />
            <div className="skeleton h-80 rounded-3xl" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main>
        <div className="shell py-20 text-center">
          <p className="text-2xl font-bold">เปิดรายละเอียด Event ไม่ได้</p>
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

  const { event, zones } = data;
  const availableBooths = zones.reduce(
    (total, zone) =>
      total +
      zone.booths.filter((booth) => booth.availability === 'AVAILABLE').length,
    0,
  );
  const categories = [
    ...new Set(
      zones.flatMap((zone) => zone.categories.map((category) => category.name)),
    ),
  ];
  const contact =
    event.contactPhone ??
    event.contactEmail ??
    event.organization.contactPhone ??
    event.organization.contactEmail;

  return (
    <main className="pb-16">
      <div className="shell py-8">
        <Link href="/" className="text-sm font-bold text-violet">
          ← กลับไปค้นหา Event
        </Link>

        <section
          className="mt-5 overflow-hidden rounded-[32px] bg-gradient-to-br from-[#2b1554] via-violet to-[#2b7f70] text-white shadow-soft"
          style={
            event.bannerUrl
              ? {
                  backgroundImage: `linear-gradient(100deg, rgba(35, 15, 74, .94), rgba(109, 60, 232, .68)), url("${event.bannerUrl}")`,
                  backgroundPosition: 'center',
                  backgroundSize: 'cover',
                }
              : undefined
          }
        >
          <div className="max-w-3xl px-6 py-14 sm:px-10 sm:py-20">
            <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur">
              กำลังเปิดให้สำรวจพื้นที่
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-[-0.04em] sm:text-5xl">
              {event.name}
            </h1>
            <p className="mt-4 text-sm leading-7 text-white/85 sm:text-base">
              {dateFormatter.format(new Date(event.startDate))} –{' '}
              {dateFormatter.format(new Date(event.endDate))} ·{' '}
              {event.venue.name}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={`/events/${event.id}/book`}
                className="inline-flex rounded-xl bg-white px-5 py-3 font-bold text-violet shadow-lg"
              >
                เลือกบูธและจองพื้นที่ →
              </Link>
              <Link
                href={`/events/${event.id}/map`}
                className="inline-flex rounded-xl border border-white/40 bg-white/10 px-5 py-3 font-bold text-white backdrop-blur"
              >
                ดู Zone Map แบบอ่านอย่างเดียว
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
          <section className="rounded-[28px] border border-line bg-white p-6 shadow-soft sm:p-8">
            <span className="text-xs font-bold uppercase tracking-[.14em] text-violet">
              Event overview
            </span>
            <h2 className="mt-2 text-2xl font-bold">เกี่ยวกับงานนี้</h2>
            <p className="mt-4 whitespace-pre-line leading-8 text-muted">
              {event.description ??
                'ผู้จัดงานยังไม่ได้เพิ่มรายละเอียดของ Event นี้'}
            </p>

            <h2 className="mt-9 text-xl font-bold">โซนและพื้นที่ว่าง</h2>
            <p className="mt-2 text-sm text-muted">
              ดูประเภทสินค้าและจำนวนบูธว่างก่อนเปิดแผนผัง
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {zones.map((zone) => {
                const free = zone.booths.filter(
                  (booth) => booth.availability === 'AVAILABLE',
                ).length;

                return (
                  <div
                    key={zone.id}
                    className="rounded-2xl border border-violet/15 bg-mist p-4"
                  >
                    <p className="text-xs font-bold text-violet">{zone.code}</p>
                    <h3 className="mt-1 font-bold">
                      {zone.name ?? 'ยังไม่ระบุชื่อโซน'}
                    </h3>
                    <p className="mt-2 text-sm text-muted">
                      {free} / {zone.booths.length} บูธว่าง
                    </p>
                  </div>
                );
              })}
            </div>

            <Link
              href={`/events/${event.id}/map`}
              className="mt-6 inline-flex rounded-xl bg-violet px-5 py-3 font-bold text-white"
            >
              เปิดแผนผังโซน
            </Link>
          </section>

          <aside className="rounded-[28px] border border-line bg-white p-6 shadow-soft">
            <span className="text-xs font-bold uppercase tracking-[.14em] text-violet">
              Quick info
            </span>
            <h2 className="mt-2 text-xl font-bold">ข้อมูลงาน</h2>
            <dl className="mt-5 divide-y divide-line text-sm">
              <InfoRow label="ผู้จัดงาน" value={event.organization.name} />
              <InfoRow label="สถานที่" value={event.venue.name} />
              <InfoRow label="บูธว่าง" value={`${availableBooths} บูธ`} />
              <InfoRow
                label="หมวดสินค้า"
                value={categories.length ? categories.join(', ') : 'ยังไม่ระบุ'}
              />
              <InfoRow label="ติดต่อ" value={contact ?? 'ยังไม่ระบุ'} />
            </dl>

            {(event.policy?.generalRules ||
              event.policy?.cancellationPolicy ||
              event.policy?.refundPolicy) && (
              <div className="mt-5 rounded-2xl bg-mist p-4">
                <p className="font-bold text-violet">นโยบาย Event</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {event.policy.generalRules ??
                    event.policy.cancellationPolicy ??
                    event.policy.refundPolicy}
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[90px_1fr] gap-4 py-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-bold">{value}</dd>
    </div>
  );
}
