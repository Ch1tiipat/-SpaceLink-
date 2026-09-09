"use client";

import Link from "next/link";
import { House, RefreshCw, WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="sl-page grid min-h-[calc(100vh-63px)] place-items-center px-5 py-12 lg:min-h-[calc(100vh-72px)]">
      <section
        className="sl-surface w-full max-w-[620px] overflow-hidden text-center"
        aria-labelledby="offline-heading"
      >
        <div className="bg-[linear-gradient(120deg,#24103e_0%,#4e1e96_58%,#386568_100%)] px-6 py-10 text-white sm:px-10">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] border border-white/20 bg-white/10 shadow-[0_16px_38px_rgba(20,10,38,.24)]">
            <WifiOff className="h-8 w-8" aria-hidden />
          </span>
          <span className="mt-5 block text-sm font-extrabold uppercase tracking-[0.14em] text-[#d6c4ff]">
            Offline mode
          </span>
          <h1
            id="offline-heading"
            className="mt-2 text-[clamp(26px,5vw,36px)] font-black tracking-[-0.035em]"
          >
            ตอนนี้ยังเชื่อมต่ออินเทอร์เน็ตไม่ได้
          </h1>
        </div>

        <div className="px-6 py-8 sm:px-10">
          <p className="mx-auto max-w-[48ch] text-sm leading-7 text-muted">
            SpaceLink ยังเปิดใช้งานส่วนพื้นฐานได้ แต่ข้อมูลการจอง โปรไฟล์
            และการแจ้งเตือนจะไม่ถูกนำจากแคชมาแสดง
            กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วลองอีกครั้ง
          </p>

          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="sl-action-primary inline-flex min-h-12 items-center justify-center gap-2 px-5"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              ลองเชื่อมต่ออีกครั้ง
            </button>
            <Link
              href="/"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 text-sm font-extrabold text-ink transition hover:border-violet hover:text-violet"
            >
              <House className="h-4 w-4" aria-hidden />
              กลับหน้าหลัก
            </Link>
          </div>

          <p className="mt-6 text-xs leading-6 text-muted">
            เพื่อความปลอดภัย ระบบจะไม่แสดงข้อมูลเฉพาะบัญชีจนกว่าจะเชื่อมต่อได้
          </p>
        </div>
      </section>
    </main>
  );
}
