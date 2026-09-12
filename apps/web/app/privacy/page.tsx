import Link from "next/link";
import type { ReactNode } from "react";

export default function PrivacyPage() {
  return (
    <main className="sl-page pb-16">
      <article className="shell py-8 sm:py-12">
        <header className="overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#29134f,#6d28d9_58%,#7257d9)] px-6 py-9 text-white shadow-[0_24px_65px_rgba(49,27,89,.18)] sm:px-10 sm:py-12">
          <p className="text-sm font-extrabold uppercase tracking-[.14em] text-violet-100">
            Legal information
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-.035em] sm:text-4xl">
            ประกาศความเป็นส่วนตัว
          </h1>
          <p className="mt-4 max-w-3xl leading-7 text-white/80">
            สรุปวิธีที่โครงงาน SpaceLink ใช้ข้อมูลเพื่อให้บริการค้นหา Event
            จัดการร้านค้า จองบูธ ชำระเงิน และติดต่อช่วยเหลือ
          </p>
        </header>

        <div className="mt-7 grid gap-5">
          <LegalSection title="ข้อมูลที่ระบบอาจเก็บ">
            <p>
              ข้อมูลบัญชีและโปรไฟล์ เช่น ชื่อ อีเมล เบอร์โทร และข้อมูลร้านค้า
              รวมถึงข้อมูลการจอง หลักฐานการชำระเงิน คำร้องขอความช่วยเหลือ
              การแจ้งเตือน และข้อมูลทางเทคนิคที่จำเป็นต่อความปลอดภัยของระบบ
            </p>
          </LegalSection>

          <LegalSection title="วัตถุประสงค์การใช้ข้อมูล">
            <p>
              ใช้เพื่อยืนยันตัวตน แสดงข้อมูล Event และบูธ ดำเนินการจองและชำระเงิน
              แจ้งสถานะ ให้ความช่วยเหลือ ป้องกันการใช้งานที่ไม่เหมาะสม
              และปรับปรุงความน่าเชื่อถือของบริการ
            </p>
          </LegalSection>

          <LegalSection title="ผู้ให้บริการภายนอกและการเปิดเผยข้อมูล">
            <p>
              ระบบอาจส่งข้อมูลเท่าที่จำเป็นให้ผู้ให้บริการที่รองรับการเข้าสู่ระบบ
              ฐานข้อมูลและที่เก็บไฟล์ โฮสติ้ง การตรวจสลิป และการแจ้งเตือน
              ตลอดจนผู้จัด Event ที่เกี่ยวข้องกับรายการจองของคุณ
              โดยไม่จำหน่ายข้อมูลส่วนบุคคลเป็นสินค้า
            </p>
          </LegalSection>

          <LegalSection title="ระยะเวลาเก็บรักษาและความปลอดภัย">
            <p>
              เก็บข้อมูลตามระยะเวลาที่จำเป็นต่อการให้บริการ การตรวจสอบรายการ
              และข้อกำหนดที่เกี่ยวข้อง แล้วจึงลบหรือทำให้ไม่สามารถระบุตัวบุคคลได้
              โครงงานใช้การควบคุมสิทธิ์และมาตรการทางเทคนิคตามขอบเขตที่พัฒนา
              แต่ไม่มีระบบออนไลน์ใดรับประกันความปลอดภัยได้ทั้งหมด
            </p>
          </LegalSection>

          <LegalSection title="สิทธิและช่องทางติดต่อ">
            <p>
              คุณสามารถขอตรวจสอบ แก้ไข หรือลบข้อมูลที่ระบบรองรับ
              และสอบถามการใช้ข้อมูลผ่านหน้า{" "}
              <Link href="/help" className="font-extrabold text-violet underline-offset-4 hover:underline">
                ศูนย์ช่วยเหลือ
              </Link>{" "}
              หรือโทร <a className="font-extrabold text-violet underline-offset-4 hover:underline" href="tel:+66935275899">093-527-5899</a>
              การดำเนินการบางอย่างอาจต้องยืนยันตัวตนและอาจถูกจำกัดเมื่อจำเป็นต้องเก็บข้อมูลรายการไว้
            </p>
          </LegalSection>
        </div>

        <LegalNotice>
          เอกสารนี้เป็นฉบับเบื้องต้นสำหรับโครงงานมหาวิทยาลัย ไม่ใช่คำรับรองว่า
          SpaceLink ผ่านการตรวจตาม PDPA หรือมาตรฐานอื่น และควรให้ผู้เชี่ยวชาญด้านกฎหมายตรวจทานก่อนนำไปใช้จริง
          อ่านแนวทางประกอบได้จาก{" "}
          <a href="https://gppc.pdpc.or.th/wp-content/uploads/GPPC-PDPC_Register_Privacy-Notice-%E0%B8%89%E0%B8%9A%E0%B8%B1%E0%B8%A2%E0%B9%88%E0%B8%AD_05062024.pdf" target="_blank" rel="noreferrer" className="font-extrabold underline underline-offset-4">
            สำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล
          </a>
        </LegalNotice>
      </article>
    </main>
  );
}

function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="sl-surface p-6 sm:p-8">
      <h2 className="text-xl font-black text-ink">{title}</h2>
      <div className="mt-3 max-w-4xl text-sm leading-7 text-muted sm:text-base">{children}</div>
    </section>
  );
}

function LegalNotice({ children }: { children: ReactNode }) {
  return (
    <aside className="mt-7 rounded-2xl border border-[#d9cdf0] bg-violet-tint px-5 py-4 text-sm leading-7 text-[#4d3c68]">
      <strong className="block text-ink">สถานะของเอกสาร</strong>
      {children}
    </aside>
  );
}
