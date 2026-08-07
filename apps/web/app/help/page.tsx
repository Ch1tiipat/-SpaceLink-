import Link from 'next/link';
import {
  Ban,
  CalendarCheck,
  CircleHelp,
  MessageCircleMore,
  ReceiptText,
} from 'lucide-react';

const FAQS = [
  {
    question: 'จองพื้นที่ขายสินค้าอย่างไร',
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
    icon: MessageCircleMore,
    answer: (
      <p>
        เปิด Event ที่ต้องการจากหน้าหลัก แล้วดูข้อมูลติดต่อในหน้ารายละเอียดงาน
        หากไม่พบข้อมูลติดต่อ กรุณาตรวจสอบประกาศหรือช่องทางขององค์กรผู้จัดงานโดยตรง
      </p>
    ),
  },
];

export default function HelpPage() {
  return (
    <main className="pb-16">
      <div className="shell py-8 sm:py-12">
        <section className="overflow-hidden rounded-[30px] bg-gradient-to-br from-[#29134f] via-violet to-[#7257d9] px-6 py-10 text-white shadow-soft sm:px-10 sm:py-14">
          <div className="grid max-w-3xl gap-5">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 backdrop-blur">
              <CircleHelp aria-hidden className="h-7 w-7" />
            </span>
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-violet-100">
                Help center
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                ศูนย์ช่วยเหลือ SpaceLink
              </h1>
              <p className="mt-4 max-w-2xl leading-7 text-white/80">
                คำตอบสำหรับขั้นตอนสำคัญ ตั้งแต่เลือกพื้นที่ จัดการการจอง
                ไปจนถึงการส่งหลักฐานการชำระเงิน
              </p>
            </div>
          </div>
        </section>

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
            {FAQS.map(({ question, icon: Icon, answer }) => (
              <details
                key={question}
                className="group rounded-3xl border border-line bg-card shadow-surface"
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
          </div>
        </section>

        <section className="mt-8 flex flex-col gap-4 rounded-3xl border border-line bg-violet-tint p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold">พร้อมจัดการพื้นที่ของคุณแล้วหรือยัง</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              กลับไปเลือก Event ใหม่ หรือตรวจสอบรายการที่จองไว้ได้ทันที
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-xl border border-violet bg-white px-4 py-2.5 text-sm font-bold text-violet"
            >
              ค้นหา Event
            </Link>
            <Link
              href="/bookings"
              className="rounded-xl bg-violet px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet/20"
            >
              การจองของฉัน
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
