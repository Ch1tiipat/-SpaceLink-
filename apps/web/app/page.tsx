'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppHeader } from '@/components/app-header';
import { getEvents, type EventSummary } from '@/lib/api';

const dateFormatter = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatDateRange(event: EventSummary) {
  return `${dateFormatter.format(new Date(event.startDate))} – ${dateFormatter.format(
    new Date(event.endDate),
  )}`;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: 'เตรียมเปิดรับสมัคร',
    OPEN: 'เปิดรับจอง',
    PUBLISHED: 'เปิดรับจอง',
    CLOSED: 'ปิดรับจอง',
    CANCELLED: 'ยกเลิก',
    COMPLETED: 'จบงานแล้ว',
  };

  return labels[status] ?? status;
}

export default function DiscoveryPage() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    getEvents(controller.signal)
      .then(setEvents)
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'โหลดข้อมูลไม่สำเร็จ');
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  const visibleEvents = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('th');
    if (!keyword) return events;

    return events.filter((event) =>
      `${event.name} ${event.description ?? ''}`
        .toLocaleLowerCase('th')
        .includes(keyword),
    );
  }, [events, query]);

  return (
    <main>
      <AppHeader />

      <section className="shell grid min-h-[500px] items-center gap-12 py-16 lg:grid-cols-[1.08fr_.92fr] lg:py-24">
        <div>
          <span className="inline-flex rounded-full border border-violet/15 bg-white px-4 py-2 text-sm font-bold text-violet shadow-sm">
            พื้นที่ที่ใช่ เชื่อมโอกาสใหม่ให้ร้านคุณ
          </span>
          <h1 className="mt-7 max-w-[720px] text-5xl font-black leading-[1.08] tracking-[-0.055em] sm:text-6xl">
            ค้นหาพื้นที่ขาย
            <span className="block bg-gradient-to-r from-violet to-[#a442e8] bg-clip-text text-transparent">
              ที่เหมาะกับร้านคุณ
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[#6f697d]">
            รวมงานแฟร์และอีเวนต์ชั้นนำ เลือกโซน ดูบูธว่าง และจองพื้นที่ได้จากแผนผังจริง
          </p>

          <label className="mt-9 flex max-w-xl items-center gap-3 rounded-2xl border border-[#e8e3f1] bg-white p-2 pl-5 shadow-soft">
            <span aria-hidden className="text-xl text-[#8b849a]">
              ⌕
            </span>
            <span className="sr-only">ค้นหา Event</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent py-3 text-base outline-none placeholder:text-[#aaa4b6]"
              placeholder="ค้นหาชื่องาน เช่น งานเกษตรแฟร์"
            />
            <button
              type="button"
              className="rounded-xl bg-violet px-5 py-3 font-bold text-white shadow-lg shadow-violet/20"
            >
              ค้นหา
            </button>
          </label>
        </div>

        <div className="relative hidden min-h-[390px] lg:block" aria-hidden>
          <div className="absolute inset-7 rotate-3 rounded-[44px] bg-gradient-to-br from-[#eadfff] to-[#d8ecff]" />
          <div className="absolute inset-12 -rotate-2 overflow-hidden rounded-[38px] border border-white bg-white p-7 shadow-soft">
            <div className="h-24 rounded-3xl bg-gradient-to-r from-[#176c50] to-[#6f9f38] p-6 text-white">
              <p className="text-sm font-bold opacity-80">งานแนะนำ</p>
              <p className="mt-1 text-2xl font-black">SUT Agri Fair 2026</p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4">
              {['โซนอาหาร', 'โซนสินค้าเกษตร', 'โซนผ้าไหม', 'โซนกิจกรรม'].map(
                (name, index) => (
                  <div
                    key={name}
                    className="rounded-2xl border border-[#ebe7f2] p-4"
                  >
                    <div
                      className={[
                        'mb-3 h-3 rounded-full',
                        ['bg-orange-300', 'bg-green-400', 'bg-teal-400', 'bg-violet-400'][
                          index
                        ],
                      ].join(' ')}
                    />
                    <p className="text-sm font-extrabold">{name}</p>
                    <p className="mt-1 text-xs text-[#918a9f]">{8 + index * 2} บูธว่าง</p>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#ece8f2] bg-white/70 py-16">
        <div className="shell">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[.16em] text-violet">
                Events
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">
                งานที่กำลังเปิดให้จอง
              </h2>
            </div>
            <p className="text-sm text-[#817b8e]">
              พบ {visibleEvents.length} งานจากข้อมูล SpaceLink API
            </p>
          </div>

          {loading && (
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="skeleton h-[330px] rounded-[28px]" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="mt-8 rounded-3xl border border-red-200 bg-red-50 p-8">
              <p className="font-extrabold text-red-800">โหลดรายการ Event ไม่สำเร็จ</p>
              <p className="mt-2 text-sm text-red-700">
                {error} — ตรวจสอบว่า NestJS API เปิดอยู่และตั้งค่า
                NEXT_PUBLIC_API_BASE_URL ถูกต้อง
              </p>
            </div>
          )}

          {!loading && !error && visibleEvents.length === 0 && (
            <div className="mt-8 rounded-3xl border border-dashed border-[#d9d3e5] bg-white p-12 text-center">
              <p className="text-lg font-extrabold">ยังไม่พบ Event ที่ค้นหา</p>
              <p className="mt-2 text-sm text-[#817b8e]">ลองใช้ชื่อหรือคำค้นอื่นอีกครั้ง</p>
            </div>
          )}

          {!loading && !error && visibleEvents.length > 0 && (
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {visibleEvents.map((event, index) => (
                <article
                  key={event.id}
                  className="group overflow-hidden rounded-[28px] border border-[#e9e5ef] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-soft"
                >
                  <div
                    className={[
                      'relative h-44 overflow-hidden p-6 text-white',
                      [
                        'bg-gradient-to-br from-[#176c50] to-[#85ad3d]',
                        'bg-gradient-to-br from-[#662f8d] to-[#d5679c]',
                        'bg-gradient-to-br from-[#2454a4] to-[#3aa5b9]',
                      ][index % 3],
                    ].join(' ')}
                  >
                    <span className="rounded-full bg-white/18 px-3 py-1 text-xs font-bold backdrop-blur">
                      {statusLabel(event.status)}
                    </span>
                    <div className="absolute -bottom-14 -right-8 h-40 w-40 rounded-full border-[24px] border-white/10" />
                    <div className="absolute right-16 top-12 h-14 w-14 rounded-2xl bg-white/10 rotate-12" />
                  </div>
                  <div className="p-6">
                    <p className="text-xs font-bold text-violet">{formatDateRange(event)}</p>
                    <h3 className="mt-2 line-clamp-2 text-xl font-black tracking-[-0.025em]">
                      {event.name}
                    </h3>
                    <p className="mt-3 line-clamp-2 min-h-11 text-sm leading-6 text-[#756f82]">
                      {event.description || 'สำรวจโซนและเลือกบูธที่เหมาะกับร้านของคุณ'}
                    </p>
                    <Link
                      href={`/events/${event.id}`}
                      className="mt-5 flex items-center justify-between rounded-xl bg-mist px-4 py-3 text-sm font-extrabold text-violet transition group-hover:bg-violet group-hover:text-white"
                    >
                      ดูแผนผังและเลือกบูธ <span aria-hidden>→</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="how-it-works" className="shell py-16">
        <h2 className="text-center text-3xl font-black tracking-[-0.04em]">
          จองพื้นที่ใน 3 ขั้นตอน
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            ['01', 'เลือก Event', 'ดูรายละเอียด วันจัดงาน และเงื่อนไขของผู้จัด'],
            ['02', 'เลือกโซนและบูธ', 'โฟกัสแผนผังตามประเภทสินค้าและตรวจสอบบูธว่าง'],
            ['03', 'ยืนยันการจอง', 'ตรวจสอบราคาและดำเนินการชำระเงินภายในเวลาที่กำหนด'],
          ].map(([number, title, description]) => (
            <div key={number} className="rounded-3xl border border-[#e7e2ed] bg-white p-7">
              <span className="text-3xl font-black text-violet/25">{number}</span>
              <h3 className="mt-5 text-lg font-extrabold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#7a7487]">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer id="support" className="border-t border-[#e9e5ef] bg-white py-8">
        <div className="shell flex flex-wrap items-center justify-between gap-3 text-sm text-[#7b7588]">
          <strong className="text-ink">SpaceLink</strong>
          <span>แพลตฟอร์มเชื่อมพื้นที่ สร้างโอกาสให้ผู้ขาย</span>
        </div>
      </footer>
    </main>
  );
}
