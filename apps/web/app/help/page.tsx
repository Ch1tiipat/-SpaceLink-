'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Ban,
  CalendarCheck,
  CircleHelp,
  MessageCircleMore,
  ReceiptText,
  Search,
  Store,
  UserRound,
} from 'lucide-react';
import { SupportTicketScreen } from '@/components/support-ticket-screen';

const FAQS = [
  {
    question: 'จองพื้นที่ขายสินค้าอย่างไร',
    keywords: 'จองบูธ zone booth event พื้นที่',
    icon: CalendarCheck,
    answer: (
      <ol className="list-decimal space-y-2 pl-5">
        <li>เลือก Event ที่สนใจจากหน้าหลัก</li>
        <li>เปิดหน้าเลือกบูธ แล้วเลือกโซนและบูธที่ยังว่าง</li>
        <li>ตรวจสอบรายละเอียดร้านค้า วันที่ และราคาให้ครบถ้วน</li>
        <li>ยืนยันการจองและชำระเงินภายในเวลาที่ระบบกำหนด</li>
      </ol>
    ),
  },
  {
    question: 'ยกเลิกการจองได้อย่างไร',
    keywords: 'ยกเลิก booking สถานะ คืนเงิน',
    icon: Ban,
    answer: (
      <p>
        ไปที่หน้า <strong>การจองของฉัน</strong> เลือกรายการที่ยังมีปุ่ม
        “ยกเลิกการจอง” ระบุเหตุผล แล้วกดยืนยัน หากรายการไม่มีปุ่มดังกล่าว
        แสดงว่าสถานะนั้นไม่สามารถยกเลิกผ่านระบบได้
      </p>
    ),
  },
  {
    question: 'อัปโหลดสลิปชำระเงินอย่างไร',
    keywords: 'ชำระเงิน promptpay สลิป jpeg png',
    icon: ReceiptText,
    answer: (
      <p>
        เปิดรายการที่มีสถานะรอชำระเงินในหน้า <strong>การจองของฉัน</strong>{' '}
        เลือกรูปสลิป JPEG หรือ PNG ขนาดไม่เกิน 5 MB แล้วกด “อัปโหลดสลิป”
        ระบบจะแสดงผลการตรวจสอบและอัปเดตสถานะการจองให้
      </p>
    ),
  },
  {
    question: 'ติดต่อผู้จัดงานได้จากที่ไหน',
    keywords: 'ติดต่อ ผู้จัดงาน โทร email บัญชี โปรไฟล์ ร้านค้า',
    icon: MessageCircleMore,
    answer: (
      <p>
        เปิด Event ที่ต้องการจากหน้าหลัก แล้วดูข้อมูลติดต่อในหน้ารายละเอียดงาน
        หากไม่พบข้อมูลติดต่อ กรุณาตรวจสอบประกาศหรือช่องทางขององค์กรผู้จัดงานโดยตรง
      </p>
    ),
  },
];

const QUICK_HELP = [
  { label: 'การจองบูธ', detail: 'เลือก Zone, Booth และตรวจสอบสถานะ', query: 'จองบูธ', icon: CalendarCheck, tone: 'bg-[#f5efff] text-violet' },
  { label: 'การชำระเงิน', detail: 'PromptPay และการอัปโหลดสลิป', query: 'ชำระเงิน', icon: ReceiptText, tone: 'bg-[#ecfdf3] text-[#176c50]' },
  { label: 'ข้อมูลร้านค้า', detail: 'สร้างและแก้ไขข้อมูลร้านของคุณ', query: 'ร้านค้า', icon: Store, tone: 'bg-[#fff7ed] text-[#b7791f]' },
  { label: 'บัญชีและโปรไฟล์', detail: 'ข้อมูลส่วนตัวและการเข้าสู่ระบบ', query: 'บัญชี โปรไฟล์', icon: UserRound, tone: 'bg-[#eff6ff] text-[#2563eb]' },
] as const;

export default function HelpPage() {
  const [query, setQuery] = useState('');
  const filteredFaqs = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('th');
    if (!keyword) return FAQS;
    return FAQS.filter((faq) =>
      `${faq.question} ${faq.keywords}`.toLocaleLowerCase('th').includes(keyword),
    );
  }, [query]);

  return (
    <main className="sl-page pb-16">
      <div className="shell py-8 sm:py-12">
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_85%_0%,rgba(255,255,255,0.16),transparent_20rem),linear-gradient(135deg,#29134f,#7c3aed_58%,#7257d9)] px-6 py-10 text-white shadow-[0_28px_70px_rgba(49,27,89,0.18)] sm:px-10 sm:py-14">
          <span aria-hidden className="absolute -bottom-28 -right-16 h-64 w-64 rounded-full border-[38px] border-white/[0.055]" />
          <div className="grid max-w-3xl gap-5">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 backdrop-blur">
              <CircleHelp aria-hidden className="h-7 w-7" />
            </span>
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-violet-100">
                Help center
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                มีอะไรให้เราช่วย?
              </h1>
              <p className="mt-4 max-w-2xl leading-7 text-white/80">
                ค้นหาคำตอบเกี่ยวกับการจองบูธ การชำระเงิน ร้านค้า
                และการใช้งาน SpaceLink
              </p>
            </div>
          </div>
        </section>

        <section className="sl-surface relative z-10 -mt-7 p-4 sm:p-5">
          <label className="flex items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-tint text-violet">
              <Search className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="mb-1 block text-xs font-semibold text-[#655d70]">ค้นหาคำถาม</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="เช่น จองบูธอย่างไร, ชำระเงิน, สร้างร้านค้า..."
                className="min-h-12 w-full rounded-[14px] border border-[#e8e3ed] bg-[#fdfcff] px-4 text-base outline-none transition placeholder:text-[#aaa4b2] focus:border-[#a887ee] focus:bg-white focus:shadow-[0_0_0_4px_rgba(124,58,237,0.08)]"
              />
            </span>
          </label>
        </section>

        <section className="mt-9" aria-labelledby="quick-help-heading">
          <span className="sl-kicker">Quick help</span>
          <h2 id="quick-help-heading" className="mt-2 text-2xl font-black">หัวข้อยอดนิยม</h2>
          <p className="mt-1 text-sm text-muted">เลือกหัวข้อเพื่อกรองคำแนะนำที่เกี่ยวข้อง</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {QUICK_HELP.map(({ label, detail, query: topicQuery, icon: Icon, tone }) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setQuery(topicQuery);
                  document.getElementById('faq-heading')?.scrollIntoView({ block: 'start' });
                }}
                className="sl-surface group flex items-center gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:border-[#d9cdf0]"
              >
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${tone}`}>
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-base">{label}</strong>
                  <small className="mt-1 block leading-5 text-muted">{detail}</small>
                </span>
                <ArrowRight className="h-4 w-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-violet" aria-hidden />
              </button>
            ))}
          </div>
        </section>

        <SupportTicketScreen />

        <section aria-labelledby="faq-heading" className="mt-8">
          <div className="mb-5">
            <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-violet">
              FAQ
            </p>
            <h2 id="faq-heading" className="mt-2 text-2xl font-black">
              คำถามที่พบบ่อย
            </h2>
          </div>

          <div className="grid gap-4">
            {filteredFaqs.map(({ question, icon: Icon, answer }) => (
              <details
                key={question}
                className="sl-surface group overflow-hidden"
              >
                <summary className="flex min-h-16 cursor-pointer list-none items-center gap-4 rounded-3xl px-5 py-4 font-bold text-ink marker:hidden focus:outline-none focus:ring-2 focus:ring-violet focus:ring-offset-2 sm:px-6">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-violet-tint text-violet">
                    <Icon aria-hidden className="h-5 w-5" />
                  </span>
                  <span>{question}</span>
                  <span
                    aria-hidden
                    className="ml-auto text-xl text-violet transition group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <div className="border-t border-line px-5 py-5 text-sm leading-7 text-muted sm:px-6 sm:text-base">
                  {answer}
                </div>
              </details>
            ))}
            {filteredFaqs.length === 0 ? (
              <div className="sl-soft-surface px-6 py-10 text-center">
                <p className="font-bold">ไม่พบคำถามที่ตรงกับ “{query}”</p>
                <button type="button" onClick={() => setQuery('')} className="sl-action-secondary mt-4 text-violet">
                  แสดงคำถามทั้งหมด
                </button>
              </div>
            ) : null}
          </div>
        </section>

        <section className="sl-soft-surface mt-8 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold">พร้อมจัดการพื้นที่ของคุณแล้วหรือยัง</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              กลับไปเลือก Event ใหม่ หรือตรวจสอบรายการที่จองไว้ได้ทันที
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="sl-action-secondary text-violet"
            >
              ค้นหา Event
            </Link>
            <Link
              href="/bookings"
              className="sl-action-primary"
            >
              การจองของฉัน
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
