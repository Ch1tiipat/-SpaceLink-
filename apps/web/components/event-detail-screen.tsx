'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import {
  CalendarDays,
  Check,
  CircleDollarSign,
  Clock3,
  Heart,
  ImageIcon,
  LayoutGrid,
  MapPin,
  Navigation,
  ParkingCircle,
  Store,
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

const compactDateFormatter = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatMoney(value: number): string {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(value);
}

export function EventDetailScreen({ eventId }: { eventId: string }) {
  const [data, setData] = useState<EventMap | null>(null);
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  const organizationId = data?.event.organization.id;

  useEffect(() => {
    if (!organizationId) return;
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
      <main className="sl-page">
        <div className="shell max-w-[1100px] py-10">
          <div className="skeleton h-[390px] rounded-[32px]" />
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((item) => <div key={item} className="skeleton h-28 rounded-[22px]" />)}
          </div>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="sl-page">
        <div className="shell max-w-[1100px] py-20 text-center">
          <h1 className="text-2xl font-black">เปิดรายละเอียด Event ไม่ได้</h1>
          <p className="mt-3 text-muted">{error ?? 'ไม่พบข้อมูล Event'}</p>
          <Link href="/" className="sl-action-primary mt-7">กลับหน้าค้นหา Event</Link>
        </div>
      </main>
    );
  }

  const { event, zones } = data;
  const booths = zones.flatMap((zone) => zone.booths);
  const availableBooths = booths.filter((booth) => booth.availability === 'AVAILABLE').length;
  const boothPrices = booths.map((booth) => Number(booth.boothPrice)).filter(Number.isFinite);
  const startingPrice = boothPrices.length ? Math.min(...boothPrices) : null;
  const categories = [...new Set(zones.flatMap((zone) => zone.categories.map((category) => category.name)))];
  const contactPhone = event.contactPhone ?? event.organization.contactPhone;
  const contactEmail = event.contactEmail ?? event.organization.contactEmail;
  const address = event.venue.address ?? event.venue.name;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  const dateRange = `${dateFormatter.format(new Date(event.startDate))} – ${dateFormatter.format(new Date(event.endDate))}`;
  const timeRange = `${event.startTime ?? 'ยังไม่ระบุ'}${event.endTime ? ` – ${event.endTime}` : ''}`;

  return (
    <main className="sl-page pb-0">
      <div className="shell max-w-[1100px] py-8">
        <Link href="/" className="sl-chip">← กลับไปค้นหา Event</Link>

        <section
          className="relative mt-5 flex min-h-[390px] items-center overflow-hidden rounded-[32px] bg-[linear-gradient(105deg,#24103e_0%,#4e1e96_53%,#386568_100%)] px-11 py-12 text-white shadow-[0_28px_70px_rgba(62,37,99,0.16)] max-sm:min-h-[340px] max-sm:px-7"
          style={event.bannerUrl ? {
            backgroundImage: `linear-gradient(100deg,rgba(36,16,62,.93),rgba(78,30,150,.74),rgba(56,101,104,.58)),url("${event.bannerUrl}")`,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
          } : undefined}
        >
          <div className="relative z-10 max-w-[720px]">
            <span className="inline-flex rounded-full border border-white/25 bg-white/[0.13] px-3 py-1.5 text-[11px] font-bold">
              กำลังเปิดให้สำรองพื้นที่
            </span>
            <h1 className="mt-5 max-w-[18ch] text-[clamp(38px,5vw,58px)] font-black leading-[1.15] tracking-[-0.05em]">
              {event.name}
            </h1>
            <p className="mt-4 max-w-3xl text-[15px] leading-7 text-white/88">
              {event.description ?? 'ผู้จัดงานยังไม่ได้เพิ่มรายละเอียดของ Event นี้'}
            </p>
            <div className="mt-7 flex flex-wrap gap-3 max-sm:flex-col">
              <Link href={`/events/${event.id}/map`} className="inline-flex min-h-[46px] items-center justify-center rounded-[13px] bg-white px-5 font-bold text-violet shadow-lg transition hover:-translate-y-0.5">
                ดู Zone Map →
              </Link>
              <button type="button" disabled title="ระบบจริงยังไม่มี API สำหรับบันทึก Event" className="inline-flex min-h-[46px] cursor-not-allowed items-center justify-center gap-2 rounded-[13px] border border-white/35 bg-white/10 px-5 font-bold text-white/65">
                <Heart className="h-4 w-4" aria-hidden /> บันทึก Event · เร็ว ๆ นี้
              </button>
            </div>
          </div>
        </section>

        <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="ข้อมูลสำคัญของ Event">
          <EventStat icon={CalendarDays} label="วันที่จัดงาน" value={`${compactDateFormatter.format(new Date(event.startDate))} – ${compactDateFormatter.format(new Date(event.endDate))}`} />
          <EventStat icon={MapPin} label="สถานที่" value={event.venue.name} />
          <EventStat icon={LayoutGrid} label="บูธว่าง" value={`${availableBooths} บูธ`} />
          <EventStat icon={CircleDollarSign} label="ราคาเริ่มต้น" value={startingPrice === null ? 'ยังไม่ระบุ' : `${formatMoney(startingPrice)} บาท`} />
        </section>

        <DetailSection kicker="EVENT INFORMATION" title="เกี่ยวกับ Event">
          <p className="whitespace-pre-line text-sm leading-7 text-muted">{event.description ?? 'ผู้จัดงานยังไม่ได้เพิ่มรายละเอียดของ Event นี้'}</p>
        </DetailSection>

        <DetailSection kicker="ANNOUNCEMENT" title="ข่าวสารสำคัญก่อนเข้าร่วมงาน">
          {announcements.length > 0 ? (
            <div className="grid gap-3">
              {announcements.map((announcement) => (
                <article key={announcement.id} className="rounded-[13px] border border-[#e7deef] bg-[#faf7ff] p-[15px]">
                  <h3 className="text-[13px] font-extrabold">{announcement.title}</h3>
                  <p className="mt-1.5 whitespace-pre-line text-xs leading-7 text-muted">{announcement.body}</p>
                </article>
              ))}
            </div>
          ) : <EmptyState text="ยังไม่มีประกาศสำหรับ Event นี้" />}
        </DetailSection>

        <DetailSection kicker="EVENT ATMOSPHERE" title="บรรยากาศภายในงาน" description="ดูพื้นที่จริงและบรรยากาศของงาน ก่อนเลือกโซนที่เหมาะกับร้านของคุณ" count={event.bannerUrl ? '1 รูป' : '0 รูป'}>
          <div className="rounded-[22px] border border-[#e4d8ee] bg-[linear-gradient(180deg,#fcfaff,#f8f5fb)] p-4">
            <div className="mb-4 flex items-center justify-between gap-4 max-sm:items-start max-sm:flex-col">
              <div className="flex items-center gap-3">
                <span className="grid h-[38px] w-[38px] place-items-center rounded-xl bg-[linear-gradient(135deg,#8b5cf6,#6d28d9)] text-white">✦</span>
                <span><strong className="block text-[13px]">สำรวจบรรยากาศก่อนจอง</strong><span className="block text-[11px] text-muted">ภาพที่ผู้จัดงานเผยแพร่ในระบบ</span></span>
              </div>
              <span className="rounded-full border border-line bg-white px-3 py-2 text-[10px] text-muted">ภาพจากข้อมูล Event</span>
            </div>
            {event.bannerUrl ? (
              <div className="min-h-[320px] rounded-[18px] bg-cover bg-center" role="img" aria-label={`ภาพประชาสัมพันธ์ ${event.name}`} style={{ backgroundImage: `url("${event.bannerUrl}")` }} />
            ) : (
              <div className="grid min-h-[220px] place-items-center rounded-[18px] border border-dashed border-[#ddd2e6] bg-[#f8f4fc] px-5 text-center">
                <div><span className="mx-auto grid h-12 w-12 place-items-center rounded-[14px] bg-[#eee6ff] text-violet"><ImageIcon className="h-5 w-5" aria-hidden /></span><strong className="mt-3 block text-sm">ยังไม่มีภาพบรรยากาศ</strong><span className="mt-1 block text-[11px] text-muted">เมื่อผู้จัดงานเพิ่มรูป ภาพจะปรากฏในกรอบนี้อัตโนมัติ</span></div>
              </div>
            )}
          </div>
        </DetailSection>

        <DetailSection kicker="ACTIVITIES" title="กิจกรรมภายในงาน">
          <EmptyState text="ผู้จัดงานยังไม่ได้เพิ่มข้อมูลกิจกรรม" />
        </DetailSection>

        <DetailSection kicker="FACILITIES" title="สิ่งอำนวยความสะดวกภายในงาน">
          <EmptyState text="ผู้จัดงานยังไม่ได้เพิ่มข้อมูลสิ่งอำนวยความสะดวก" />
        </DetailSection>

        <DetailSection kicker="ZONE & BOOTH" title="พื้นที่ภายในงาน" description="ตรวจสอบ Zone และตำแหน่งบูธก่อนทำการจอง" action={<Link href={`/events/${event.id}/map`} className="sl-action-secondary text-violet">ดูแผนผัง</Link>}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <NumberCard label="Zone" value={`${zones.length}`} />
            <NumberCard label="บูธทั้งหมด" value={`${booths.length}`} />
            <NumberCard label="บูธว่าง" value={`${availableBooths}`} />
            <NumberCard label="จองได้สูงสุด" value="ยังไม่ระบุ" />
          </div>
          <div className="mt-5 border-t border-line pt-5">
            <h3 className="font-extrabold">หมวดสินค้าในพื้นที่</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {categories.length > 0 ? categories.map((category) => <span key={category} className="sl-chip">{category}</span>) : <span className="text-sm text-muted">ยังไม่ระบุ</span>}
            </div>
          </div>
        </DetailSection>

        <DetailSection kicker="RULES & POLICY" title="กฎและเงื่อนไข">
          <div className="grid gap-3 md:grid-cols-2">
            <PolicyCard icon={<Check className="h-5 w-5" />} title="กฎร้านค้า" value={event.policy?.generalRules} />
            <PolicyCard warning icon={<span className="font-black">!</span>} title="การยกเลิก" value={event.policy?.cancellationPolicy} />
            <PolicyCard icon={<CircleDollarSign className="h-5 w-5" />} title="การคืนเงิน" value={event.policy?.refundPolicy} />
            <PolicyCard icon={<Clock3 className="h-5 w-5" />} title="เวลาเข้าติดตั้ง" value={null} />
          </div>
        </DetailSection>

        <DetailSection kicker="LOCATION" title="การเดินทางเข้างาน" description={address}>
          <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <TravelRow icon={<MapPin className="h-5 w-5" />} label="สถานที่จัดงาน" value={event.venue.name} />
              <TravelRow icon={<Navigation className="h-5 w-5" />} label="คำแนะนำการเดินทาง" value="ผู้จัดงานยังไม่ได้ระบุคำแนะนำการเดินทาง" />
              <TravelRow icon={<ParkingCircle className="h-5 w-5" />} label="ที่จอดรถ" value="ผู้จัดงานยังไม่ได้ระบุข้อมูลที่จอดรถ" />
              <a href={mapsUrl} target="_blank" rel="noreferrer" className="sl-action-primary mt-3 w-full">เปิดเส้นทางใน Google Maps →</a>
            </div>
            <div className="relative grid min-h-[390px] place-items-center overflow-hidden rounded-[18px] border border-[#ded4e5] bg-[linear-gradient(135deg,#f8f5fa,#eff4f2)] px-6 text-center shadow-soft">
              <div><span className="mx-auto grid h-[46px] w-[46px] place-items-center rounded-[14px] bg-[linear-gradient(135deg,#8b5cf6,#6d28d9)] text-white"><MapPin className="h-5 w-5" /></span><strong className="mt-3 block text-sm">เปิดดูตำแหน่งบน Google Maps</strong><span className="mt-1 block text-[11px] text-muted">ระบบ API ปัจจุบันส่งชื่อและที่อยู่สถานที่ โดยยังไม่มีพิกัดสาธารณะ</span></div>
              <div className="absolute bottom-4 left-4 flex max-w-[calc(100%-32px)] items-center gap-3 rounded-xl border border-white bg-white/95 px-3 py-2.5 text-left shadow-soft"><span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald ring-4 ring-emerald/15" /><span><strong className="block truncate text-[11px]">{event.name}</strong><span className="block truncate text-[9px] text-muted">{address}</span></span></div>
            </div>
          </div>
        </DetailSection>

        <DetailSection kicker="EVENT REVIEWS" title="รีวิวจากผู้เข้าร่วมงาน" count="0.0 ★">
          <EmptyState text="Event นี้ยังไม่มีรีวิวจาก API" />
        </DetailSection>

        <section className="mt-5 grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
          <article className="sl-surface p-7">
            <div className="flex items-start justify-between gap-5">
              <div><span className="sl-kicker">RESERVATION</span><h2 className="mt-2 text-2xl font-black">พร้อมเลือกพื้นที่แล้ว?</h2><p className="mt-3 text-sm leading-7 text-muted">เปิด Zone Map เพื่อตรวจสอบตำแหน่ง ราคา และเลือกบูธที่เหมาะกับร้านของคุณ</p></div>
              <span className="grid h-[62px] w-[62px] shrink-0 place-items-center rounded-[17px] bg-[#f1e9ff] text-violet"><Store className="h-6 w-6" /></span>
            </div>
            <div className="mt-6 grid grid-cols-[1fr_auto] gap-3 max-sm:grid-cols-1"><div className="rounded-xl bg-[#f4edff] px-4 py-3"><span className="text-[10px] text-muted">ราคาเริ่มต้น</span><strong className="mt-1 block text-base text-violet">{startingPrice === null ? 'ยังไม่ระบุ' : `${formatMoney(startingPrice)} บาท`}</strong></div><Link href={`/events/${event.id}/map`} className="sl-action-primary min-w-[150px]">เลือกพื้นที่ →</Link></div>
          </article>

          <article className="sl-surface p-7">
            <span className="sl-kicker">EVENT INFO</span>
            <h2 className="mt-2 text-2xl font-black">ข้อมูล Event</h2>
            <p className="mt-2 text-sm text-muted">ข้อมูลสำคัญและช่องทางติดต่อผู้จัดงาน</p>
            <dl className="mt-5 grid sm:grid-cols-2 sm:gap-x-5">
              <InfoItem label="ประเภท" value={categories.join(', ') || 'ยังไม่ระบุ'} />
              <InfoItem label="สถานที่" value={event.venue.name} />
              <InfoItem label="วันที่" value={dateRange} />
              <InfoItem label="เวลา" value={timeRange} />
              <InfoItem label="ผู้จัดงาน" value={event.organization.name} />
              <InfoItem label="เบอร์ติดต่อ" value={contactPhone ?? 'ยังไม่ระบุ'} />
              <InfoItem label="Email" value={contactEmail ?? 'ยังไม่ระบุ'} />
            </dl>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {contactPhone ? <a href={`tel:${contactPhone.replace(/\s/g, '')}`} className="sl-action-primary">โทรหาผู้จัดงาน</a> : <button disabled className="sl-action-primary cursor-not-allowed opacity-50">ยังไม่มีเบอร์ติดต่อ</button>}
              {contactEmail ? <a href={`mailto:${contactEmail}`} className="sl-action-secondary text-violet">ส่ง Email</a> : <button disabled className="sl-action-secondary cursor-not-allowed text-muted opacity-60">ยังไม่มี Email</button>}
            </div>
          </article>
        </section>
      </div>

    </main>
  );
}

function DetailSection({ kicker, title, description, count, action, children }: { kicker: string; title: string; description?: string; count?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="sl-surface mt-5 p-7 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><span className="sl-kicker">{kicker}</span><h2 className="mt-2 text-[26px] font-black tracking-[-0.03em]">{title}</h2></div>{action ?? (count ? <span className="sl-chip">{count}</span> : null)}</div>
      {description && <p className="mt-3 text-sm leading-7 text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="grid min-h-[118px] place-items-center rounded-[16px] border border-dashed border-[#ddd2e6] bg-[#fcfbfd] px-5 text-center text-sm text-muted">{text}</div>;
}

function EventStat({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return <article className="flex min-w-0 items-center gap-3 rounded-[22px] border border-line bg-white p-4 shadow-[0_12px_28px_rgba(54,36,91,0.08)]"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[#eee6ff] text-violet"><Icon className="h-5 w-5" /></span><span className="min-w-0"><span className="block text-[11px] text-muted">{label}</span><strong className="mt-1 line-clamp-2 block text-sm leading-5">{value}</strong></span></article>;
}

function NumberCard({ label, value }: { label: string; value: string }) {
  return <article className="rounded-xl border border-line bg-[#fcfbfd] p-4"><span className="text-[10px] text-muted">{label}</span><strong className="mt-1 block text-xl">{value}</strong></article>;
}

function PolicyCard({ icon, title, value, warning = false }: { icon: ReactNode; title: string; value?: string | null; warning?: boolean }) {
  return <article className="flex gap-3 rounded-[13px] border border-line p-4"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] ${warning ? 'bg-[#fff4e7] text-[#b5680a]' : 'bg-[#eafaf1] text-[#16834e]'}`}>{icon}</span><span><strong className="text-xs">{title}</strong><span className="mt-1.5 block whitespace-pre-line text-[11px] leading-7 text-muted">{value ?? 'ผู้จัดงานยังไม่ได้ระบุ'}</span></span></article>;
}

function TravelRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="flex gap-3 border-b border-line py-3"><span className="grid h-[37px] w-[37px] shrink-0 place-items-center rounded-[10px] bg-[#eee6ff] text-violet">{icon}</span><span><span className="block text-[10px] text-muted">{label}</span><strong className="mt-1 block text-xs leading-6">{value}</strong></span></div>;
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return <div className="flex min-h-[55px] items-center justify-between gap-4 border-b border-line"><dt className="text-[10px] text-muted">{label}</dt><dd className="max-w-[68%] text-right text-[11px] font-bold">{value}</dd></div>;
}
