'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Accessibility,
  CalendarDays,
  Camera,
  Clock3,
  Megaphone,
  Navigation,
  ParkingCircle,
  ShieldCheck,
  Utensils,
} from 'lucide-react';
import {
  getEventMap,
  getPublicAnnouncements,
  type AdminAnnouncement,
  type EventMap,
} from '@/lib/api';

const dateFormatter = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function EventDetailScreen({ eventId }: { eventId: string }) {
  const [data, setData] = useState<EventMap | null>(null);
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
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

  const organizationId = data?.event.organization.id;

  useEffect(() => {
    if (!organizationId) {
      setAnnouncements([]);
      return;
    }

    const controller = new AbortController();
    getPublicAnnouncements(organizationId, controller.signal)
      .then(setAnnouncements)
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setAnnouncements([]);
      });

    return () => controller.abort();
  }, [organizationId]);

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
    <main className="sl-page pb-16">
      <div className="shell py-8">
        <Link href="/" className="sl-chip">
          ← กลับไปค้นหา Event
        </Link>

        <section
          className="relative mt-5 overflow-hidden rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_85%_10%,rgba(255,255,255,0.16),transparent_20rem),linear-gradient(135deg,#28134f,#7440de_56%,#247668)] text-white shadow-[0_28px_75px_rgba(49,27,89,0.2)]"
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
            <h1 className="mt-4 max-w-[18ch] text-4xl font-black tracking-[-0.05em] sm:text-5xl">
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
                className="inline-flex min-h-11 items-center rounded-2xl bg-white px-5 py-3 font-extrabold text-violet shadow-lg transition hover:-translate-y-0.5"
              >
                เลือกบูธและจองพื้นที่ →
              </Link>
              <Link
                href={`/events/${event.id}/map`}
                className="inline-flex min-h-11 items-center rounded-2xl border border-white/35 bg-white/10 px-5 py-3 font-extrabold text-white backdrop-blur transition hover:bg-white/15"
              >
                ดู Zone Map แบบอ่านอย่างเดียว
              </Link>
            </div>
          </div>
        </section>

        {announcements.length > 0 && (
          <section className="sl-surface mt-7 p-6 sm:p-8">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-violet">
              <Megaphone className="h-4 w-4" aria-hidden /> ประกาศจากผู้จัดงาน
            </span>
            <h2 className="mt-2 text-2xl font-black">ข่าวสารสำคัญก่อนเข้าร่วมงาน</h2>
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {announcements.map((announcement) => (
                <article
                  key={announcement.id}
                  className="rounded-2xl border border-[#e6dcf7] bg-[#faf7ff] p-5"
                >
                  <h3 className="font-extrabold text-ink">{announcement.title}</h3>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted">
                    {announcement.body}
                  </p>
                  {announcement.publishedAt && (
                    <p className="mt-4 text-xs font-bold text-violet">
                      เผยแพร่ {dateFormatter.format(new Date(announcement.publishedAt))}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
          <section className="sl-surface p-6 sm:p-8">
            <span className="text-xs font-bold uppercase tracking-[.14em] text-violet">
              Event overview
            </span>
            <h2 className="mt-2 text-2xl font-bold">เกี่ยวกับงานนี้</h2>
            <p className="mt-4 whitespace-pre-line leading-8 text-muted">
              {event.description ??
                'ผู้จัดงานยังไม่ได้เพิ่มรายละเอียดของ Event นี้'}
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <EventFeature
                icon={CalendarDays}
                title="วันและเวลาเปิดงาน"
                detail={`${dateFormatter.format(new Date(event.startDate))} – ${dateFormatter.format(new Date(event.endDate))} · ${event.startTime ?? '08:00'}–${event.endTime ?? '21:00'} น.`}
              />
              <EventFeature
                icon={Utensils}
                title="กิจกรรมภายในงาน"
                detail="สินค้าเกษตร อาหาร ผ้าไหม OTOP นวัตกรรม และเวิร์กช็อปจากชุมชน"
              />
              <EventFeature
                icon={ParkingCircle}
                title="ที่จอดรถและจุดรับส่ง"
                detail="มีพื้นที่จอดรถสำหรับผู้เข้าชม จุดรับส่ง และทางเดินเชื่อมเข้าสู่หน้างาน"
              />
              <EventFeature
                icon={Accessibility}
                title="สิ่งอำนวยความสะดวก"
                detail="ห้องน้ำ จุดปฐมพยาบาล จุดประชาสัมพันธ์ และเส้นทางสำหรับผู้ใช้รถเข็น"
              />
            </div>

            <div className="mt-9 border-t border-line pt-8">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-violet">
                <Camera className="h-4 w-4" aria-hidden /> Event atmosphere
              </span>
              <h2 className="mt-2 text-xl font-bold">บรรยากาศภายในงาน</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                ดูรูปแบบพื้นที่ ผู้เข้าชม และประเภทสินค้าภายในงานก่อนตัดสินใจเลือกตำแหน่งบูธ
              </p>
              <div className="mt-5 grid h-[420px] gap-3 overflow-hidden rounded-[26px] sm:grid-cols-[1.45fr_.8fr] sm:grid-rows-2">
                <div className="relative overflow-hidden rounded-[22px] sm:row-span-2">
                  <Image
                    src="/event-atmosphere-sut-2569.png"
                    alt="บรรยากาศผู้เข้าชมและร้านค้าภายในงานเกษตร มทส."
                    fill
                    sizes="(max-width: 640px) 100vw, 55vw"
                    className="object-cover"
                  />
                </div>
                <div className="relative hidden overflow-hidden rounded-[22px] sm:block">
                  <Image
                    src="/event-atmosphere-sut-2569.png"
                    alt="บรรยากาศร้านสินค้าเกษตรและอาหาร"
                    fill
                    sizes="30vw"
                    className="scale-125 object-cover object-right"
                  />
                </div>
                <div className="relative hidden overflow-hidden rounded-[22px] sm:block">
                  <Image
                    src="/hero-spacelink.png"
                    alt="พื้นที่บูธและทางเดินภายในงาน"
                    fill
                    sizes="30vw"
                    className="object-cover object-center"
                  />
                </div>
              </div>
            </div>

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
                    className="sl-soft-surface p-4 transition hover:border-violet/25 hover:shadow-sm"
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
              className="sl-action-primary mt-6"
            >
              เปิดแผนผังโซน
            </Link>
          </section>

          <aside className="sl-surface p-6 lg:sticky lg:top-[96px]">
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

        <section className="sl-surface mt-7 overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-6 sm:px-8">
            <div>
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-violet">
                <Navigation className="h-4 w-4" aria-hidden /> Arrival guide
              </span>
              <h2 className="mt-2 text-2xl font-black">แผนที่การเดินทางและทางเข้างาน</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                เส้นทางจากประตูมหาวิทยาลัยไปยังจุดลงทะเบียน ที่จอดรถ และทางเข้าสำหรับผู้เข้าชม
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#effaf6] px-3 py-2 text-xs font-bold text-emerald">
              <ShieldCheck className="h-4 w-4" aria-hidden /> ภาพเส้นทางจากผู้จัดงาน
            </span>
          </div>
          <div className="relative aspect-[16/9] overflow-hidden border-t border-line bg-[#eef5e7]">
            <Image
              src="/event-travel-map-sut-2569.png"
              alt="แผนที่เส้นทางจากประตูมหาวิทยาลัยไปยังทางเข้าและที่จอดรถของงาน"
              fill
              sizes="(max-width: 1024px) 100vw, 1200px"
              className="object-cover"
            />
          </div>
          <div className="grid gap-3 border-t border-line p-5 sm:grid-cols-3 sm:p-6">
            <TravelStep number="01" title="เข้าทางประตูหลัก" detail="ใช้ถนนมหาวิทยาลัยและตรงไปยังวงเวียนกลาง" />
            <TravelStep number="02" title="ตามป้ายพื้นที่จัดงาน" detail="เลี้ยวเข้าสู่ถนนด้านลานเกษตรและจุดรับส่ง" />
            <TravelStep number="03" title="จอดรถและเดินเข้างาน" detail="จอดในพื้นที่ผู้เข้าชมแล้วเดินเข้าจุดลงทะเบียน" />
          </div>
        </section>
      </div>
    </main>
  );
}

function EventFeature({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof Clock3;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-[#faf8ff] p-4">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-tint text-violet">
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <h3 className="mt-3 font-extrabold">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-muted">{detail}</p>
    </div>
  );
}

function TravelStep({
  number,
  title,
  detail,
}: {
  number: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl bg-[#faf8ff] p-4">
      <span className="text-xs font-black text-violet">{number}</span>
      <h3 className="mt-1 font-extrabold">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-muted">{detail}</p>
    </div>
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
