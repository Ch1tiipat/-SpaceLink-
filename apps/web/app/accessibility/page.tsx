import Link from "next/link";
import type { ReactNode } from "react";

export default function AccessibilityPage() {
  return (
    <main className="sl-page pb-16">
      <article className="shell py-8 sm:py-12">
        <header className="overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#29134f,#6d28d9_58%,#7257d9)] px-6 py-9 text-white shadow-[0_24px_65px_rgba(49,27,89,.18)] sm:px-10 sm:py-12">
          <p className="text-sm font-extrabold uppercase tracking-[.14em] text-violet-100">Accessibility</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-.035em] sm:text-4xl">การเข้าถึงสำหรับทุกคน</h1>
          <p className="mt-4 max-w-3xl leading-7 text-white/80">
            แนวทางที่ SpaceLink ใช้เพื่อให้หน้าค้นหา Event การเลือกบูธ และการจัดการบัญชีใช้งานได้กับอุปกรณ์และวิธีควบคุมที่หลากหลาย
          </p>
        </header>

        <div className="mt-7 grid gap-5">
          <LegalSection title="คีย์บอร์ดและโฟกัส">
            เมนู ปุ่ม ลิงก์ แบบฟอร์ม และหน้าต่างโต้ตอบหลักออกแบบให้เข้าถึงด้วย Tab และ Shift+Tab
            แสดงตำแหน่งโฟกัส และปิดหน้าต่าง overlay ด้วย Escape ได้
          </LegalSection>
          <LegalSection title="หน้าจอและการขยาย">
            ส่วนติดต่อปรับตามขนาดหน้าจอ รองรับการสัมผัส และออกแบบให้ยังอ่านและใช้งานได้เมื่อขยายหน้าเว็บถึง 200%
            โดยหลีกเลี่ยงการเลื่อนแนวนอนในเนื้อหาหลักเท่าที่ขอบเขตโครงงานรองรับ
          </LegalSection>
          <LegalSection title="โครงสร้างและข้อความช่วยเหลือ">
            หน้าใช้หัวข้อ ป้ายกำกับ สถานะ และชื่อของปุ่มเพื่อช่วยผู้ใช้โปรแกรมอ่านหน้าจอ
            ข้อมูลสำคัญไม่ควรสื่อด้วยสีเพียงอย่างเดียว และข้อความผิดพลาดควรบอกแนวทางแก้ไข
          </LegalSection>
          <LegalSection title="ข้อจำกัดที่ทราบ">
            แผนผังบูธแบบ SVG เนื้อหาจากผู้จัดงาน และบริการภายนอกบางส่วนอาจยังใช้งานกับเทคโนโลยีช่วยเหลือได้ไม่สมบูรณ์
            โครงงานจะบันทึกปัญหาที่ได้รับแจ้งเพื่อพิจารณาปรับปรุงตามลำดับความสำคัญ
          </LegalSection>
          <LegalSection title="แจ้งปัญหาการเข้าถึง">
            โปรดส่งรายละเอียดหน้าที่พบปัญหา อุปกรณ์ เบราว์เซอร์ และวิธีควบคุมผ่านหน้า{" "}
            <Link href="/help" className="font-extrabold text-violet underline-offset-4 hover:underline">ศูนย์ช่วยเหลือ</Link>{" "}
            หรือโทร <a href="tel:+66935275899" className="font-extrabold text-violet underline-offset-4 hover:underline">093-527-5899</a>
          </LegalSection>
        </div>

        <aside className="mt-7 rounded-2xl border border-[#d9cdf0] bg-violet-tint px-5 py-4 text-sm leading-7 text-[#4d3c68]">
          <strong className="block text-ink">สถานะของเอกสาร</strong>
          เอกสารนี้อธิบายเป้าหมายของโครงงาน ไม่ใช่คำรับรองว่า SpaceLink ผ่านการตรวจหรือได้รับการรับรองตาม WCAG
          และควรให้ผู้เชี่ยวชาญด้าน accessibility ตรวจฉบับใช้งานจริง
        </aside>
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
