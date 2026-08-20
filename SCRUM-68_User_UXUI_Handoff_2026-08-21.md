# SpaceLink — SCRUM-68 User UX/UI Handoff

อัปเดต: 21 สิงหาคม 2026

ผู้รับช่วงต่อ: บุ๊ค / ปอนด์ / ทีม SpaceLink

Branch: `codex/user-admin-ux-integration`

## สถานะ

ปรับ UX/UI ฝั่งผู้ขายตามขอบเขตที่อนุมัติแล้ว พร้อมส่งให้ทีมตรวจ Code Review และ CI ก่อน merge เข้า `main`

งานชุดนี้ไม่แก้ Backend, API contract, Prisma schema, Database, Auth, Environment variables หรือ Secret ใด ๆ

## ไฟล์ที่แก้

1. `apps/web/app/page.tsx`
   - โหลดข่าวสารสาธารณะขององค์กรที่มี Event ผ่าน API เดิม
   - รวมข่าวสารและ Event ล่าสุด เรียงตามเวลา และแสดงสูงสุด 3 รายการ
   - ปุ่มค้นหาพาผู้ใช้ไปยังส่วนงานที่เปิดให้สำรวจพื้นที่
   - การ์ดข่าวสารกรอง Event ตามองค์กร ส่วนการ์ด Event เปิดหน้ารายละเอียดเดิม

2. `apps/web/components/app-shell.tsx`
   - ปรับ Floating Contact Button เป็นกล่องข้อความ “ถาม AI · ติดต่อเรา”
   - เพิ่มคำถามพบบ่อยสำหรับการเลือกโซน/บูธและขั้นตอนจอง
   - จำกัดคำตอบจำลองเฉพาะบริบท Event, ร้านค้า, โซน, บูธ และการจอง
   - เพิ่มช่องทางติดต่อ Facebook, LINE และโทรศัพท์แบบไอคอน
   - หมายเหตุ: ส่วนนี้เป็น UX guidance ฝั่งหน้าเว็บ ไม่ได้ปลอมผลจาก Gemini; คำแนะนำจากข้อมูลจริงยังใช้ flow ของ Event Map/API เดิม

3. `apps/web/components/event-map-screen.tsx`
   - เพิ่มปุ่มจากบูธแนะนำไปยังหน้าเลือกโซนและจองบูธ
   - เพิ่ม CTA ในสรุปแผนผังเพื่อเริ่ม flow การจอง
   - คงพฤติกรรมหน้าแผนผังแบบอ่านอย่างเดียว ไม่สร้าง Booking จากการคลิกแผนผัง

## ผลตรวจอัตโนมัติ

### Web

- `npx tsc --noEmit` — ผ่าน, exit code 0
- ESLint เฉพาะ 3 ไฟล์ที่แก้ — ผ่าน, exit code 0
- `npm run lint` — ผ่าน, ไม่มี warning/error
- `npm run build` — ผ่าน, Next.js สร้างครบ 16 routes

### API regression gate

แม้งานนี้ไม่แก้ API ได้รัน gate ตาม workflow ทีมครบแล้ว:

- `npm run build` — ผ่าน
- `npx tsc --noEmit` — ผ่าน
- `npx eslint src prisma` — ผ่าน
- `npm test -- --runInBand` — ผ่าน 53/53 suites, 470/470 tests

### Smoke test หน้าเว็บ

เส้นทางต่อไปนี้ตอบ HTTP 200 ใน local preview:

- `/?uxAuth=signed-in`
- `/profile?uxAuth=signed-in`
- `/bookings?uxAuth=signed-in`
- `/events/demo-event/map?uxAuth=signed-in`
- `/events/demo-event/book?uxAuth=signed-in`
- `/admin/map-designer?uxAuth=signed-in`

`git diff --check` ผ่าน และไม่พบข้อมูลลับใน diff

## วิธีตรวจด้วยมือสำหรับทีม

1. เปิด `apps/web` แล้วรัน `npm run dev -- -p 3021`
2. เปิด `http://127.0.0.1:3021/?uxAuth=signed-in`
3. ตรวจการค้นหาและส่วนข่าวสาร/Event ล่าสุด
4. เปิด Floating Contact Button แล้วลองคำถามพบบ่อย ช่องข้อความ และปุ่มติดต่อ
5. เปิด Event Map แล้วตรวจปุ่มไปหน้าจองจากบูธแนะนำและสรุปด้านขวา
6. ยืนยันว่าแผนผังยังไม่สร้าง Booking จนกว่าจะเข้าหน้าจองและกดยืนยันตาม flow เดิม

## หมายเหตุสำหรับการ Review

- หาก local แสดงหน้าแบบไม่มี CSS ให้หยุด dev server ลบ generated cache `apps/web/.next` แล้วเริ่ม dev server ใหม่ ปัญหานี้เกิดจาก stale Next.js cache ไม่ใช่ source code
- `npm install` รายงาน vulnerability ของ dependency tree เดิม จึงไม่ได้รัน `npm audit fix` เพราะอยู่นอกขอบเขตและอาจเป็น breaking change
- กรุณาให้ CI ผ่านและทีมตรวจ UX/UI ก่อน merge
