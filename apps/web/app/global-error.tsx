'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <html lang="th">
      <body style={{ margin: 0, background: '#f6f1ff', color: '#281c41', fontFamily: 'sans-serif' }}>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
          <section role="alert" style={{ maxWidth: 520, textAlign: 'center', background: 'white', padding: 32, borderRadius: 24 }}>
            <h1>SpaceLink ยังเปิดหน้านี้ไม่ได้</h1>
            <p>เกิดข้อผิดพลาดในการโหลดแอป กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง</p>
            <button type="button" onClick={reset}>ลองอีกครั้ง</button>
            <p><a href="/offline">ดูคำแนะนำการเชื่อมต่อ</a></p>
          </section>
        </main>
      </body>
    </html>
  );
}
