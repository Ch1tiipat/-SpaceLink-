import Link from "next/link";
import type { ReactNode } from "react";

export default function TermsPage() {
  return (
    <main className="sl-page pb-16">
      <article className="shell py-8 sm:py-12">
        <header className="overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#29134f,#6d28d9_58%,#7257d9)] px-6 py-9 text-white shadow-[0_24px_65px_rgba(49,27,89,.18)] sm:px-10 sm:py-12">
          <p className="text-sm font-extrabold uppercase tracking-[.14em] text-violet-100">Legal information</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-.035em] sm:text-4xl">เงื่อนไขการใช้งาน</h1>
          <p className="mt-4 max-w-3xl leading-7 text-white/80">
            ข้อตกลงเบื้องต้นสำหรับการใช้ SpaceLink เพื่อค้นหา Event จัดการร้านค้า และจองพื้นที่ขายสินค้า
          </p>
        </header>

        <div className="mt-7 grid gap-5">
          <LegalSection title="บัญชีและข้อมูลร้านค้า">
            ผู้ใช้ต้องให้ข้อมูลที่ถูกต้อง ดูแลการเข้าถึงอีเมลและบัญชีของตนเอง
            และรับผิดชอบกิจกรรมที่เกิดขึ้นผ่านบัญชี ห้ามสวมรอยหรือสร้างร้านค้าที่ทำให้ผู้อื่นเข้าใจผิด
          </LegalSection>
          <LegalSection title="การจองและระยะเวลาถือบูธ">
            การเลือกบูธที่ว่างและยืนยันรายการจะสร้างการจองสถานะรอชำระเงินทันที
            บูธจะถูกถือไว้ตามเวลาที่แสดงในรายการ หากไม่ชำระเงินสำเร็จภายในเวลา ระบบอาจยกเลิกการจองและเปิดบูธให้ผู้อื่น
          </LegalSection>
          <LegalSection title="การชำระเงิน การยกเลิก และคืนเงิน">
            ผู้ใช้ต้องตรวจสอบ Event บูธ ราคา และข้อมูลผู้รับเงินก่อนส่งหลักฐาน
            ผลตรวจสลิปที่ผ่านจะยืนยันการจองโดยอัตโนมัติ เงื่อนไขการยกเลิกและยอดคืนเงินขึ้นอยู่กับสถานะรายการ
            ช่วงเวลาของ Event และการพิจารณาตามข้อมูลที่ระบบรองรับ
          </LegalSection>
          <LegalSection title="การใช้งานที่ห้าม">
            ห้ามเข้าถึงบัญชีหรือข้อมูลองค์กรโดยไม่มีสิทธิ์ รบกวนการทำงานของระบบ
            อัปโหลดข้อมูลเท็จหรือไฟล์ที่เป็นอันตราย จองเพื่อกีดกันผู้อื่น
            หรือใช้ SpaceLink เพื่อกิจกรรมที่ผิดกฎหมายและละเมิดสิทธิของบุคคลอื่น
          </LegalSection>
          <LegalSection title="ข้อจำกัดของบริการ">
            SpaceLink เป็นโครงงานมหาวิทยาลัย ฟังก์ชันและความพร้อมใช้งานอาจเปลี่ยนแปลงหรือหยุดชั่วคราว
            ข้อมูล Event และรายละเอียดผู้จัดงานมาจากผู้ใช้งานที่เกี่ยวข้อง ผู้ใช้ควรตรวจสอบข้อมูลสำคัญก่อนตัดสินใจ
            หากพบปัญหาให้ติดต่อผ่านหน้า <Link href="/help" className="font-extrabold text-violet underline-offset-4 hover:underline">ศูนย์ช่วยเหลือ</Link>
          </LegalSection>
        </div>

        <aside className="mt-7 rounded-2xl border border-[#d9cdf0] bg-violet-tint px-5 py-4 text-sm leading-7 text-[#4d3c68]">
          <strong className="block text-ink">สถานะของเอกสาร</strong>
          เอกสารนี้เป็นฉบับเบื้องต้นสำหรับโครงงานมหาวิทยาลัย ไม่ใช่คำปรึกษาทางกฎหมาย
          และควรให้ผู้เชี่ยวชาญตรวจทานก่อนนำไปใช้จริง ดูตัวอย่างแนวทางการกำหนดเงื่อนไขได้จาก{" "}
          <a href="https://www.etda.or.th/th/term-of-use.aspx" target="_blank" rel="noreferrer" className="font-extrabold underline underline-offset-4">ETDA</a>
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
