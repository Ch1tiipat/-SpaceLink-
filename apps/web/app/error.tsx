'use client';

import { useEffect } from 'react';

export default function RouteError({ error, reset }: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="sl-page grid min-h-[60vh] place-items-center p-6">
      <section role="alert" className="sl-surface max-w-lg p-8 text-center">
        <h1 className="text-2xl font-black">ยังเปิดหน้านี้ไม่ได้</h1>
        <p className="mt-3 text-sm text-muted">เกิดข้อผิดพลาดในการโหลดหน้า กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง</p>
        <button type="button" onClick={reset} className="sl-action-primary mt-5 px-5 py-3">ลองอีกครั้ง</button>
        <a href="/offline" className="ml-4 text-violet underline">ดูคำแนะนำการเชื่อมต่อ</a>
      </section>
    </main>
  );
}
