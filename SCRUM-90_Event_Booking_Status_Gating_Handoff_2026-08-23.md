# SCRUM-90 — Event Booking Status Gating Handoff

วันที่ส่งมอบ: 23 สิงหาคม 2026

ผู้ดำเนินการ: ซีบิว / Codex

ผู้ตรวจงาน: บุ๊คและทีม SpaceLink

Branch: `codex/bug-01-event-booking-status-gating`

Base: `main` หลัง Merge PR #49 (`f5b38a1`)

Ticket: `SCRUM-90`

## 1. เป้าหมาย

แก้ปัญหา Production ที่หน้า User แสดงว่า Event “เปิดจอง” และยังเปิดทางให้เลือก Booth/สร้าง Booking ทั้งที่ Event ปิดรับจองหรือวันจัดงานสิ้นสุดแล้ว โดยทำให้ Home, Event Map, Booking Screen และ Backend ใช้ business rule เดียวกัน

งานนี้แยกจาก `SCRUM-88` Admin UX/UI redesign โดยเจตนา และไม่แก้ Prisma schema, Authentication, guard order หรือ organization scope

## 2. Root Cause ที่ยืนยันจากโค้ด

1. `booking-screen.tsx` ตรวจ `event.status === 'OPEN'` แต่ Prisma `EventStatus` ไม่มีค่า `OPEN`
2. `EventSummary.status` เป็น `string` ทำให้ TypeScript ไม่สามารถจับ enum mismatch ได้
3. ปุ่มสร้าง Booking ไม่ได้นำ Event status มาใช้ในเงื่อนไข `disabled`
4. หน้า Home แสดง badge “เปิดจอง” แบบ hardcoded
5. Event Map สร้างลิงก์ไปหน้าจองให้ Booth ว่างโดยไม่ตรวจ Event status
6. Backend ตรวจเฉพาะ `PUBLISHED`/`ONGOING` แต่ไม่ตรวจว่า `endDate` ผ่านไปแล้วหรือไม่

## 3. Business Rule หลังแก้

Event จะเปิดรับ Booking เมื่อครบทั้งสองเงื่อนไข:

1. `status` เป็น `PUBLISHED` หรือ `ONGOING`
2. วันที่ปัจจุบันตามเขตเวลา `Asia/Bangkok` ยังไม่เกิน `endDate`

`endDate` เป็นวันที่แบบ inclusive หมายความว่า Event ยังจองได้ตลอดวันสุดท้าย และปิดรับจองตั้งแต่เวลา 00:00 น. ของวันถัดไปตามเวลาประเทศไทย

Frontend ใช้กฎนี้เพื่อควบคุมข้อความและ interaction ส่วน Backend ตรวจซ้ำก่อนสร้าง Booking และก่อนยืนยันสลิป เพื่อรักษา data integrity แม้มีการเรียก API โดยตรง

## 4. รายละเอียดการเปลี่ยนแปลง

### 4.1 Shared Frontend Rule

เพิ่ม `apps/web/lib/event-booking-rules.ts`

- กำหนดสถานะที่จองได้เป็น `PUBLISHED` และ `ONGOING`
- คำนวณวันที่ปัจจุบันด้วย `Asia/Bangkok`
- เปรียบเทียบ `endDate` แบบ calendar date เพื่อป้องกันความคลาดเคลื่อนช่วง 00:00–06:59 น. ไทยจากการใช้ UTC
- Export `isEventBookable(event, now?)` ให้หน้า User ใช้ร่วมกัน

### 4.2 API Type Safety

แก้ `apps/web/lib/api.ts`

- เปลี่ยน `EventSummary.status` จาก `string` เป็น literal union:
  - `DRAFT`
  - `PUBLISHED`
  - `ONGOING`
  - `COMPLETED`
  - `CANCELLED`
- TypeScript จะตรวจพบการเทียบกับค่าที่ไม่มีจริง เช่น `OPEN`

### 4.3 Home / Discovery

แก้ `apps/web/app/page.tsx`

- ยกเลิก badge “เปิดจอง” แบบ hardcoded
- Event ที่จองได้แสดง badge สีเขียว “เปิดจอง”
- Event ที่สถานะไม่ผ่านหรือหมดวันแล้วแสดง badge สีเทา “ปิดรับจอง”

### 4.4 Event Map

แก้ `apps/web/components/event-map-screen.tsx`

- ข้อความด้านบน Map เปลี่ยนตามสถานะจริง
- Event ที่ปิดรับจองแสดง “Event นี้ปิดรับจองแล้ว”
- `ZoneMap` เปลี่ยนเป็น read-only เมื่อ Event จองไม่ได้
- Booth ว่างไม่สร้าง booking link เมื่อ Event ปิด
- Direct click handler มี guard ไม่ให้เปิดหน้าจอง
- AI recommendation ไม่แสดงลิงก์จองเมื่อ Event ปิด
- ปุ่ม “เลือกบูธใน Zone นี้” ถูกแทนด้วยสถานะปิดรับจอง

### 4.5 Booking Screen

แก้ `apps/web/components/booking-screen.tsx`

- แทนที่การตรวจ `status === 'OPEN'` ด้วย `isEventBookable`
- แสดงข้อความ “เปิดให้จอง” หรือ “ปิดรับจอง” ให้ตรงกับ Home และ Map
- เพิ่มคำอธิบายและลิงก์กลับไปค้นหา Event อื่นเมื่อปิดรับจอง
- Booking Policy แสดง “ไม่เปิดให้สร้างรายการ” แทน “พร้อมสร้างรายการ”
- Payment receiver แสดง “ปิดรับรายการ” เมื่อ Event จองไม่ได้
- ปุ่ม “สร้าง Booking และไปชำระเงิน” ถูก disabled
- `handleCreate` ตรวจ `isEventBookable` ซ้ำ เพื่อป้องกันการเรียก handler นอกเส้นทางปกติ

### 4.6 Backend Guard

แก้ `apps/api/src/bookings/bookings.service.ts`

- ก่อนสร้าง Booking ตรวจว่า `endDate` ยังไม่ผ่านตามวันปฏิทินประเทศไทย
- การอัปโหลด/ยืนยันสลิปของ Booking ที่ยัง `PENDING_PAYMENT` ตรวจ `event.endDate` เพิ่มเติม
- Event ที่สิ้นสุดแล้วตอบ `ConflictException` พร้อมข้อความ `อีเวนต์นี้สิ้นสุดแล้ว`
- ใช้ `thailandDateKey` ที่มีอยู่เดิม ไม่เพิ่ม dependency และไม่เปลี่ยน schema

### 4.7 Tests

แก้ `apps/api/src/bookings/bookings.service.spec.ts`

เพิ่มและปรับ test ให้ครอบคลุม:

- `PUBLISHED` Event ที่เลยวันสุดท้ายแล้วสร้าง Booking ไม่ได้
- `ONGOING` Event ยังจองได้ตลอดวันสุดท้ายตามเวลาไทย
- ยืนยันสลิปไม่ได้หลัง Event สิ้นสุด
- Query สำหรับ upload slip ดึง `endDate` มาตรวจ
- Test เดิมของ Event status, Booth status, quota, venue และ slip verification ยังผ่าน

## 5. รายการไฟล์ในงาน

1. `apps/web/lib/event-booking-rules.ts` — ไฟล์ใหม่
2. `apps/web/lib/api.ts`
3. `apps/web/app/page.tsx`
4. `apps/web/components/event-map-screen.tsx`
5. `apps/web/components/booking-screen.tsx`
6. `apps/api/src/bookings/bookings.service.ts`
7. `apps/api/src/bookings/bookings.service.spec.ts`
8. `SCRUM-90_Event_Booking_Status_Gating_Handoff_2026-08-23.md`

## 6. ผล Quality Gates

### Web

| Gate | ผล |
|---|---|
| `npx tsc --noEmit` | PASS — exit 0 |
| `npm run lint` | PASS — ไม่มี warning/error |
| `npm run build` | PASS — Next.js production build สำเร็จ |

### API

| Gate | ผล |
|---|---|
| `npm run build` | PASS — exit 0 |
| `npx tsc --noEmit` | PASS — exit 0 |
| `npx eslint src prisma` | PASS — exit 0 |
| `npm test -- --runInBand` | PASS — 53 suites, 473 tests |

### Repository

| Gate | ผล |
|---|---|
| `git diff --check` | PASS |
| Prisma schema modified | ไม่ได้แก้ |
| Package/lockfile modified | ไม่ได้แก้ |
| Auth/guard/org scope modified | ไม่ได้แก้ |
| Admin UX/UI modified | ไม่ได้แก้ |

## 7. Local Browser QA

ตรวจด้วย production build ที่ localhost ทั้ง Desktop และ Mobile 390 × 844 pixels

### Home

- Event ตัวอย่างที่สิ้นสุดแล้วแสดง “ปิดรับจอง”
- ไม่พบ Application Error
- ไม่พบ horizontal overflow

### Event Map

- แสดงข้อความปิดรับจองสอดคล้องกับ Home
- ไม่พบลิงก์ `/events/[eventId]/book` สำหรับ Booth
- Booth ว่างใน fixture ทั้ง 53 รายการไม่สามารถกดไปหน้าจองได้
- ไม่พบ Application Error หรือ console error

### Direct Booking URL

- เปิด URL โดยตรงยังดูข้อมูลได้
- แสดง “ปิดรับจอง”
- Booking Policy แสดง “ไม่เปิดให้สร้างรายการ”
- Payment receiver แสดง “ปิดรับรายการ”
- ปุ่มสร้าง Booking disabled และแสดง “Event นี้ปิดรับจองแล้ว”
- ไม่พบข้อความ “ยังไม่เปิดให้จอง” และ “พร้อมสร้างรายการ” ที่ขัดแย้งกัน

### Mobile

- Home, Map และ Booking ไม่เกิด horizontal overflow
- ไม่พบ Application Error

## 8. ขอบเขตที่ไม่ได้เปลี่ยน

- Prisma schema และ migrations
- Supabase configuration หรือข้อมูลฐานข้อมูล
- Authentication และ authorization guards
- Organization/tenant isolation
- Booking quota, venue match และ double-booking rules
- Payment amount, PromptPay QR และ SlipOK provider
- My Bookings, Review และ Admin UX/UI
- Package dependencies และ environment variables

## 9. จุดที่ขอให้ Reviewer ตรวจ

1. ยืนยันว่า `PUBLISHED` และ `ONGOING` เป็นสถานะที่เปิดรับจองตาม business rule
2. ยืนยันว่า `endDate` เป็นวันสุดท้ายที่ยังจองได้แบบ inclusive
3. ตรวจข้อความ Home, Map และ Booking ว่าสอดคล้องกัน
4. ตรวจว่า Booth ใน Event ปิดรับจองไม่มี link/interaction ไปสร้าง Booking
5. ตรวจ Backend guard ทั้ง create และ upload slip
6. ตรวจ tests ช่วงหลังเที่ยงคืนประเทศไทย
7. ยืนยันว่าไม่มีไฟล์ Admin, Prisma หรือ Auth ปะปนใน diff

## 10. Production QA หลัง Merge ที่แนะนำ

1. Deploy Web และ API จาก `main`
2. เปิด Event ที่ `COMPLETED` หรือหมดวันแล้ว และยืนยันว่าทุกหน้าแสดงปิดรับจอง
3. ทดลองเปิด Booking URL โดยตรงและยืนยันว่าปุ่ม disabled
4. ใช้ Event `PUBLISHED`/`ONGOING` ที่ยังไม่หมดวันกับ Booth ว่างและบัญชีทดสอบของทีม
5. สร้าง Booking จริงหนึ่งรายการในข้อมูลทดสอบที่ได้รับอนุมัติ
6. ตรวจ Payment/Slip flow และ cleanup fixture ตามขั้นตอนของทีม

ห้ามใช้ Productionเงินจริงหรือสร้างข้อมูลทดสอบโดยไม่มีผู้รับผิดชอบอนุมัติ
