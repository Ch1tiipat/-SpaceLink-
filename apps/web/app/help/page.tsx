'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Bell,
  BookOpenCheck,
  CalendarSearch,
  Check,
  ChevronDown,
  CircleHelp,
  CreditCard,
  FileText,
  MapPinned,
  MessageCircleMore,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  TicketCheck,
  X,
} from 'lucide-react';

import { filterHelpFaqs, HELP_FAQS } from '@/lib/help-center';

type HelpTab = 'faq' | 'how-to' | 'policy';

const TABS = [
  { id: 'faq', label: 'คำถามที่พบบ่อย', icon: CircleHelp },
  { id: 'how-to', label: 'วิธีการใช้งาน', icon: BookOpenCheck },
  { id: 'policy', label: 'นโยบาย', icon: ShieldCheck },
] as const;

const HOW_TO_STEPS = [
  {
    number: '1',
    title: 'ค้นหา Event',
    description: 'เลือกงาน จังหวัด หรือหมวดสินค้าที่เหมาะกับร้าน',
    icon: CalendarSearch,
  },
  {
    number: '2',
    title: 'เลือก Zone และ Booth',
    description: 'ตรวจสอบผังจริง ราคา ขนาด และสถานะว่าง',
    icon: MapPinned,
  },
  {
    number: '3',
    title: 'ชำระเงิน',
    description: 'สแกน QR และอัปโหลดสลิปก่อนหมดเวลา',
    icon: CreditCard,
  },
  {
    number: '4',
    title: 'ติดตามสถานะ',
    description: 'ตรวจผลยืนยันและประกาศสำคัญก่อนวันงาน',
    icon: TicketCheck,
  },
] as const;

const HOW_TO_DETAILS = [
  {
    title: 'เริ่มต้นใช้งาน',
    description: 'เตรียมข้อมูลร้านและบัญชีให้พร้อมก่อนส่งคำขอจอง',
    points: [
      'เข้าสู่ระบบด้วยบัญชี Vendor',
      'ตรวจสอบชื่อร้าน หมวดสินค้า และช่องทางติดต่อ',
      'เปิดการแจ้งเตือนเพื่อไม่พลาดผลตรวจสอบ',
    ],
    icon: Store,
  },
  {
    title: 'วิธีจองพื้นที่',
    description: 'เลือกพื้นที่จากข้อมูลว่างจริงของแต่ละ Event',
    points: [
      'ค้นหา Event แล้วเปิดหน้าเลือกพื้นที่',
      'เลือก Zone และ Booth ที่แสดงสถานะว่าง',
      'ตรวจรายละเอียดและยืนยันข้อมูลการจอง',
      'หากเต็มโควตา ให้ส่งคำขอเพิ่มสิทธิ์จากบูธที่ต้องการ',
    ],
    icon: MapPinned,
  },
  {
    title: 'วิธีชำระเงินและยืนยัน',
    description: 'ชำระตามยอดรวมและติดตามผลจากรายการเดิม',
    points: [
      'เปิดรายการรอชำระเงินจากหน้าการจองของฉัน',
      'สแกน PromptPay QR ตามยอดที่ระบบสร้าง',
      'อัปโหลดสลิปที่อ่านได้ชัดเจนก่อนหมดเวลา',
      'รอผลตรวจสอบจนสถานะเปลี่ยนเป็นยืนยันการจองแล้ว',
    ],
    icon: CreditCard,
  },
  {
    title: 'ติดตามและเตรียมเข้าพื้นที่',
    description: 'ดูรายละเอียดล่าสุดได้จากการจองและศูนย์แจ้งเตือน',
    points: [
      'ตรวจวัน เวลา สถานที่ และหมายเลขบูธ',
      'อ่านประกาศจากผู้จัดงานก่อนวันเริ่มงาน',
      'หากพบปัญหา ให้เปิดหน้าติดต่อสอบถามและติดตาม Request ID',
    ],
    icon: Bell,
  },
] as const;

const POLICY_ITEMS = [
  {
    title: 'การจองและโควตา',
    description: 'สิทธิ์การจอง การถือบูธ และคำขอเพิ่มโควตา',
    points: [
      'ใช้ได้เฉพาะบูธที่ระบบแสดงว่าว่างในเวลาที่ยืนยันรายการ',
      'จำนวนบูธขึ้นอยู่กับสิทธิ์ของ Vendor ใน Event นั้น',
      'สิทธิ์โควตาเพิ่มใช้ได้หนึ่งครั้งและไม่จองบูธให้อัตโนมัติ',
    ],
    icon: TicketCheck,
  },
  {
    title: 'การชำระเงิน',
    description: 'ยอดชำระ PromptPay และหลักฐานการโอนเงิน',
    points: [
      'ชำระตามยอดและผู้รับเงินที่แสดงในหน้าระบบเท่านั้น',
      'อัปโหลดหลักฐานก่อนเวลาถือสิทธิ์สิ้นสุด',
      'การจองหลายบูธในกลุ่มเดียวใช้ยอดรวมและ QR เดียว',
    ],
    icon: CreditCard,
  },
  {
    title: 'การยกเลิกและคืนเงิน',
    description: 'เงื่อนไขการยกเลิกและขั้นตอนติดตามผลคืนเงิน',
    points: [
      'การยกเลิกเป็นไปตามช่วงเวลาที่ระบบและ Event กำหนด',
      'คำขอคืนเงินใช้ได้กับรายการที่เข้าเงื่อนไขเท่านั้น',
      'ผลอนุมัติและระยะเวลาโอนขึ้นอยู่กับการตรวจสอบของทีมงาน',
    ],
    icon: FileText,
  },
  {
    title: 'การใช้งานพื้นที่',
    description: 'สินค้า อุปกรณ์ และข้อกำหนดของสถานที่จัดงาน',
    points: [
      'จำหน่ายสินค้าให้ตรงกับหมวดที่ผู้จัดงานอนุญาต',
      'ใช้อุปกรณ์และไฟฟ้าตามข้อจำกัดของบูธ',
      'ปฏิบัติตามเวลาเข้าออกและประกาศของผู้จัดงาน',
    ],
    icon: Store,
  },
  {
    title: 'ความเป็นส่วนตัวและข้อมูลผู้ใช้',
    description: 'การใช้ข้อมูลเพื่อการจอง ชำระเงิน และช่วยเหลือ',
    points: [
      'ระบบใช้ข้อมูลเท่าที่จำเป็นต่อการให้บริการและตรวจสอบรายการ',
      'อย่าส่งรหัสผ่านหรือข้อมูลลับผ่านช่องรายละเอียดคำขอ',
      'อ่านรายละเอียดเพิ่มเติมได้จากนโยบายความเป็นส่วนตัว',
    ],
    icon: ShieldCheck,
  },
] as const;

const QUICK_LINKS = [
  {
    label: 'ติดต่อสอบถาม',
    description: 'แจ้งปัญหา ขอเพิ่มโควตา และติดตามคำขอ',
    href: '/support',
    icon: MessageCircleMore,
  },
  {
    label: 'การจองของฉัน',
    description: 'ดูสถานะ ชำระเงิน และรายละเอียดบูธ',
    href: '/bookings',
    icon: TicketCheck,
  },
  {
    label: 'การแจ้งเตือน',
    description: 'ติดตามข่าวสารและตั้งค่าหมวดแจ้งเตือน',
    href: '/notifications',
    icon: Bell,
  },
] as const;

export default function HelpPage() {
  const [activeTab, setActiveTab] = useState<HelpTab>('faq');
  const [query, setQuery] = useState('');
  const filteredFaqs = useMemo(
    () => filterHelpFaqs(HELP_FAQS, query),
    [query],
  );

  function searchFaq(value: string) {
    setQuery(value);
    if (value.trim()) setActiveTab('faq');
  }

  return (
    <main className="sl-page pb-16">
      <div className="shell py-6 sm:py-8">
        <section className="relative isolate overflow-hidden rounded-[30px] border border-[#e4daf7] bg-[#f7f2ff] shadow-[0_22px_60px_rgba(77,49,126,0.10)]">
          <div
            aria-hidden
            className="absolute inset-y-0 right-0 -z-10 w-full bg-[url('/home-hero.jpg')] bg-cover bg-[center_42%] opacity-35 sm:w-[62%]"
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,#fbf9ff_0%,#f8f3ff_43%,rgba(247,242,255,0.88)_61%,rgba(247,242,255,0.45)_100%)]"
          />
          <div className="max-w-3xl px-6 py-9 sm:px-10 sm:py-12">
            <span className="sl-kicker">
              <Sparkles className="h-4 w-4" aria-hidden /> Help center
            </span>
            <h1 className="sl-thai-heading mt-2 text-4xl font-black tracking-[-0.05em] text-ink sm:text-5xl">
              ช่วยเหลือ
            </h1>
            <p className="mt-3 max-w-xl leading-7 text-muted">
              รวมคำตอบ ขั้นตอนใช้งาน และนโยบายสำคัญ เพื่อให้คุณใช้งาน
              SpaceLink ได้ง่ายขึ้น
            </p>
            <label className="mt-6 flex max-w-2xl items-center gap-3 rounded-2xl border border-[#ded3f1] bg-white/95 px-4 py-3 shadow-[0_10px_28px_rgba(76,48,120,0.08)] backdrop-blur">
              <Search className="h-5 w-5 shrink-0 text-violet" aria-hidden />
              <span className="sr-only">ค้นหาคำถามที่พบบ่อย</span>
              <input
                type="search"
                value={query}
                onChange={(event) => searchFaq(event.target.value)}
                placeholder="ค้นหาคำถาม เช่น จองบูธ ชำระเงิน หรือคืนเงิน..."
                className="min-h-8 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-[#9c94a8]"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-violet-tint hover:text-violet"
                  aria-label="ล้างคำค้นหา"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </label>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_310px]">
          <div className="min-w-0">
            <div
              role="tablist"
              aria-label="หมวดศูนย์ช่วยเหลือ"
              className="sl-surface grid gap-2 p-2 sm:grid-cols-3"
            >
              {TABS.map(({ id, label, icon: Icon }) => {
                const selected = activeTab === id;
                return (
                  <button
                    key={id}
                    id={`help-tab-${id}`}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls={`help-panel-${id}`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setActiveTab(id)}
                    className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition ${
                      selected
                        ? 'bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] text-white shadow-[0_8px_20px_rgba(124,58,237,0.20)]'
                        : 'text-[#655d70] hover:bg-violet-tint hover:text-violet'
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {label}
                  </button>
                );
              })}
            </div>

            {activeTab === 'faq' ? (
              <section
                id="help-panel-faq"
                role="tabpanel"
                aria-labelledby="help-tab-faq"
                className="mt-5"
              >
                <SectionHeading
                  eyebrow="Frequently asked questions"
                  title="คำถามที่พบบ่อย"
                  description={
                    query
                      ? `พบ ${filteredFaqs.length} คำตอบสำหรับ “${query}”`
                      : 'เลือกคำถามเพื่อดูคำตอบและขั้นตอนที่เกี่ยวข้อง'
                  }
                />
                {filteredFaqs.length ? (
                  <div className="mt-4 grid gap-3">
                    {filteredFaqs.map((faq, index) => (
                      <details
                        key={faq.id}
                        className="sl-surface group overflow-hidden"
                        open={Boolean(query) && index === 0}
                      >
                        <summary className="flex min-h-16 cursor-pointer list-none items-center gap-4 px-5 py-4 font-bold marker:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet sm:px-6">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-violet-tint text-violet">
                            <CircleHelp className="h-5 w-5" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">{faq.question}</span>
                          <ChevronDown
                            className="h-5 w-5 shrink-0 text-violet transition group-open:rotate-180"
                            aria-hidden
                          />
                        </summary>
                        <div className="border-t border-line bg-[#fdfcff] px-5 py-5 text-sm leading-7 text-muted sm:px-6 sm:text-base">
                          {faq.answers.map((answer) => (
                            <p key={answer} className="not-first:mt-3">
                              {answer}
                            </p>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                ) : (
                  <div className="sl-surface mt-4 px-6 py-12 text-center">
                    <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-tint text-violet">
                      <Search className="h-6 w-6" aria-hidden />
                    </span>
                    <h3 className="mt-4 text-lg font-black">ไม่พบคำตอบที่ค้นหา</h3>
                    <p className="mt-2 text-sm text-muted">
                      ลองใช้คำสั้นลง เช่น “จองบูธ” “ชำระเงิน” หรือ “คืนเงิน”
                    </p>
                    <div className="mt-5 flex flex-wrap justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => setQuery('')}
                        className="sl-action-secondary text-violet"
                      >
                        แสดงคำถามทั้งหมด
                      </button>
                      <Link href="/support" className="sl-action-primary">
                        ติดต่อทีมงาน
                      </Link>
                    </div>
                  </div>
                )}
              </section>
            ) : null}

            {activeTab === 'how-to' ? (
              <section
                id="help-panel-how-to"
                role="tabpanel"
                aria-labelledby="help-tab-how-to"
                className="mt-5"
              >
                <SectionHeading
                  eyebrow="How SpaceLink works"
                  title="4 ขั้นตอนการใช้งาน SpaceLink"
                  description="ตั้งแต่ค้นหา Event ไปจนถึงได้รับการยืนยันการจอง"
                />
                <ol className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {HOW_TO_STEPS.map(
                    ({ number, title, description, icon: Icon }) => (
                      <li key={number} className="sl-surface relative p-5">
                        <span className="absolute right-4 top-3 text-4xl font-black text-[#eee8fb]">
                          {number}
                        </span>
                        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-tint text-violet">
                          <Icon className="h-5 w-5" aria-hidden />
                        </span>
                        <h3 className="mt-4 font-black">{title}</h3>
                        <p className="mt-1 text-xs leading-5 text-muted">
                          {description}
                        </p>
                      </li>
                    ),
                  )}
                </ol>
                <div className="mt-5 grid gap-3">
                  {HOW_TO_DETAILS.map((item) => (
                    <GuidanceAccordion key={item.title} {...item} />
                  ))}
                </div>
              </section>
            ) : null}

            {activeTab === 'policy' ? (
              <section
                id="help-panel-policy"
                role="tabpanel"
                aria-labelledby="help-tab-policy"
                className="mt-5"
              >
                <SectionHeading
                  eyebrow="Usage policy"
                  title="นโยบายสำคัญ"
                  description="ข้อกำหนดหลักที่ควรทราบก่อนจอง ชำระเงิน และเข้าพื้นที่"
                />
                <div className="mt-4 grid gap-3">
                  {POLICY_ITEMS.map((item) => (
                    <GuidanceAccordion key={item.title} {...item} />
                  ))}
                </div>
                <div className="sl-soft-surface mt-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-black">ต้องการอ่านข้อกำหนดฉบับเต็ม?</p>
                    <p className="mt-1 text-sm text-muted">
                      ตรวจสอบเงื่อนไขการใช้งานและนโยบายความเป็นส่วนตัวของระบบ
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href="/terms" className="sl-action-secondary text-violet">
                      ข้อกำหนดการใช้งาน
                    </Link>
                    <Link href="/privacy" className="sl-action-primary">
                      ความเป็นส่วนตัว
                    </Link>
                  </div>
                </div>
              </section>
            ) : null}
          </div>

          <aside className="grid content-start gap-5" aria-label="ลิงก์ช่วยเหลือ">
            <section className="sl-surface p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-tint text-violet">
                  <Sparkles className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-violet">
                    Quick links
                  </p>
                  <h2 className="font-black">เมนูที่ใช้บ่อย</h2>
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                {QUICK_LINKS.map(
                  ({ label, description, href, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="group flex items-center gap-3 rounded-2xl border border-transparent p-3 transition hover:border-[#e5dcf4] hover:bg-[#fcfaff]"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f7f3ff] text-violet">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block text-sm">{label}</strong>
                        <small className="mt-0.5 block leading-5 text-muted">
                          {description}
                        </small>
                      </span>
                      <ArrowRight
                        className="h-4 w-4 shrink-0 text-[#aaa1b6] transition group-hover:translate-x-0.5 group-hover:text-violet"
                        aria-hidden
                      />
                    </Link>
                  ),
                )}
              </div>
            </section>

            <section className="sl-surface p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eefbf5] text-[#14805c]">
                  <MessageCircleMore className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#14805c]">
                    Contact
                  </p>
                  <h2 className="font-black">ยังต้องการความช่วยเหลือ?</h2>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-muted">
                ส่งคำขอพร้อมรายละเอียดและติดตามผลจาก Request ID ได้ในที่เดียว
              </p>
              <Link href="/support" className="sl-action-primary mt-4 w-full">
                ติดต่อทีมงาน <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </section>

            <section className="rounded-[22px] border border-[#e8ddfb] bg-gradient-to-br from-[#f7f2ff] to-white p-5">
              <div className="flex gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-violet shadow-sm">
                  <Check className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <h2 className="font-black">คำแนะนำก่อนส่งคำขอ</h2>
                  <ul className="mt-3 space-y-2 text-xs leading-5 text-muted">
                    <li>• ระบุ Event และ Booking ID ให้ครบ</li>
                    <li>• อธิบายปัญหาและผลลัพธ์ที่ต้องการ</li>
                    <li>• อย่าส่งรหัสผ่านหรือข้อมูลลับ</li>
                  </ul>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-violet">
        {eyebrow}
      </p>
      <h2 className="sl-thai-heading mt-1 text-2xl font-black">{title}</h2>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </div>
  );
}

function GuidanceAccordion({
  title,
  description,
  points,
  icon: Icon,
}: {
  title: string;
  description: string;
  points: readonly string[];
  icon: typeof Store;
}) {
  return (
    <details className="sl-surface group overflow-hidden">
      <summary className="flex min-h-20 cursor-pointer list-none items-center gap-4 px-5 py-4 marker:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet sm:px-6">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-tint text-violet">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block">{title}</strong>
          <small className="mt-1 block font-normal leading-5 text-muted">
            {description}
          </small>
        </span>
        <ChevronDown
          className="h-5 w-5 shrink-0 text-violet transition group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-t border-line bg-[#fdfcff] px-5 py-5 sm:px-6">
        <ul className="grid gap-3 text-sm leading-6 text-muted sm:grid-cols-2">
          {points.map((point) => (
            <li key={point} className="flex gap-2">
              <Check className="mt-1 h-4 w-4 shrink-0 text-[#159566]" aria-hidden />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
