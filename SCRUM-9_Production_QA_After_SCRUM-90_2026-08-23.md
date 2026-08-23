# SCRUM-9 — Production QA หลัง Merge SCRUM-90

วันที่ตรวจ: 23 สิงหาคม 2026

ผู้ตรวจ: ซีบิว / Codex

ระบบที่ตรวจ: [SpaceLink Production](https://space-link-ruddy.vercel.app/)

Ticket ที่ตรวจย้อนหลัง: `SCRUM-90` — Event Booking Status Gating

สถานะการทดสอบ: **PRODUCTION PASS WITH 1 UX ISSUE — FOLLOW-UP FIX VERIFIED AND READY FOR REVIEW**

## 1. เป้าหมาย

ตรวจว่าหลัง Merge SCRUM-90 แล้ว Production แยก Event ที่เปิด/ปิดรับจองได้ถูกต้อง และไม่มีเส้นทางจากหน้า User ที่สร้าง Booking ให้ Event ที่ปิดหรือสิ้นสุดแล้ว

การตรวจรอบนี้เน้น:

- หน้า Home
- Event Detail
- Event Map
- Direct Booking URL
- Regression ของ Event ที่ยังเปิดรับจอง
- Desktop และ Mobile responsive
- Console warning/error

## 2. ขอบเขตความปลอดภัย

การทดสอบเป็นแบบ read-only:

- ใช้ session Vendor ที่เข้าสู่ระบบอยู่แล้ว
- ไม่กดสร้าง Booking
- ไม่ส่ง POST/PUT/PATCH/DELETE
- ไม่อัปโหลดสลิป
- ไม่โอนเงินหรือใช้ QR
- ไม่แก้ข้อมูล Supabase/Production
- ไม่กด AI recommendation เพราะ endpoint อาจบันทึก AI log
- ไม่เปิดลิงก์โทรศัพท์, Email หรือ Google Maps ภายนอก

## 3. Test data ที่ใช้

### Event ปิดรับจอง

- Event: `งานเกษตร มทส. 2569`
- Event ID: `00000005-0000-4000-8000-000000000002`
- วันที่: 25 กรกฎาคม 2569 – 2 สิงหาคม 2569
- Booth ที่ใช้ตรวจ Direct URL: `ZONE-A / A01`

### Event เปิดรับจอง

- Event: `Future Tech Expo 2026`
- Event ID: `44444444-4444-4444-4444-444444444444`
- วันที่: 10–12 กันยายน 2569
- Booth ที่ใช้ตรวจ Direct URL: `PHASE6 / P601`

ไม่มีการกดยืนยันสร้าง Booking ของ Booth ข้างต้น

## 4. ผลทดสอบ

| TC | จุดตรวจ | ผล | หลักฐานที่เห็น |
|---|---|---|---|
| TC-01 | Home แสดง Event จบแล้วเป็นปิดรับจอง | PASS | `งานเกษตร มทส. 2569` แสดง badge “ปิดรับจอง” |
| TC-02 | Home แสดง Event อนาคตเป็นเปิดจอง | PASS | `Future Tech Expo 2026` และ `Phase 6 Booking Flow Event` แสดง “เปิดจอง” |
| TC-03 | Closed Event Map แสดงสถานะปิด | PASS | Header และ Floor Plan แสดง “Event นี้ปิดรับจองแล้ว” |
| TC-04 | Closed Event Map ไม่มี booking link | PASS | ไม่พบลิงก์ `/events/[id]/book` จาก Booth; ที่พบมีเฉพาะ `/bookings` ใน navigation |
| TC-05 | Booth ว่างใน Closed Event ถูกปิด interaction | PASS | A01, B02 และ C03 เป็น `disabled` แม้ข้อมูล availability เป็น AVAILABLE |
| TC-06 | Direct Booking URL ของ Closed Event | PASS | หน้าเปิดอ่านข้อมูลได้ แต่แสดง “ปิดรับจอง” และปุ่ม “Event นี้ปิดรับจองแล้ว” เป็น disabled |
| TC-07 | Booking policy ของ Closed Event | PASS | Event = ปิดรับจอง, Booth = ไม่เปิดให้สร้างรายการ, Payment receiver = ปิดรับรายการ |
| TC-08 | Open Event Map ยังมี booking links | PASS | พบ booking link ของ Booth ว่าง 9 รายการ |
| TC-09 | Open Event Direct Booking URL | PASS | P601 ถูกเลือก, Event แสดง “เปิดให้จอง” และปุ่มสร้าง Booking enabled |
| TC-10 | Regression — ไม่ปิด Event ที่จองได้ | PASS | Map/Booking ของ Future Tech Expo ยังทำงานถึงขั้นก่อนสร้าง Booking |
| TC-11 | Desktop horizontal overflow | PASS | Home, Detail, Map และ Booking มี `scrollWidth = clientWidth` |
| TC-12 | Mobile responsive | PASS | ตรวจ 5 เส้นทาง ไม่พบ horizontal overflow หรือ Application Error |
| TC-13 | Browser console | PASS | ไม่พบ warning/error ระหว่างเส้นทางที่ตรวจ |
| TC-14 | Closed Event Detail copy/CTA | **FAIL** | ยังแสดง “กำลังเปิดให้สำรองพื้นที่”, “พร้อมเลือกพื้นที่แล้ว?” และปุ่ม “เลือกพื้นที่ →” |

## 5. Issue ที่พบ

### QA-01 — Event Detail ใช้ข้อความเปิดจองแบบ hardcoded

Severity ที่แนะนำ: **Medium / UX consistency**

Data integrity risk: **ต่ำในสถานะปัจจุบัน** เพราะ Event Map และ Booking Screen ป้องกันการจองซ้ำอีกชั้นแล้ว และ API มี backend guard จาก SCRUM-90

#### Expected

เมื่อ Event ปิดรับจอง หน้า Event Detail ควร:

- แสดง “ปิดรับจอง” หรือข้อความที่สอดคล้องกับ Home/Map/Booking
- เปลี่ยน Reservation card เป็นข้อความอ่านข้อมูลได้แต่ไม่สามารถสร้าง Booking
- CTA ไม่ควรสื่อว่า Event ยังพร้อมให้เลือกพื้นที่เพื่อจอง
- จะคงลิงก์ “ดูแผนผัง” แบบ read-only ได้ หากข้อความระบุชัดเจน

#### Actual

หน้า Event Detail ของ `งานเกษตร มทส. 2569` ยังแสดง:

- “กำลังเปิดให้สำรองพื้นที่”
- “พร้อมเลือกพื้นที่แล้ว?”
- “เลือกพื้นที่ →”

เมื่อกดไป Map ระบบจึงค่อยแสดงว่า Event ปิดรับจอง

#### Root cause จาก source

ไฟล์ `apps/web/components/event-detail-screen.tsx` ยังไม่ได้ใช้ `isEventBookable()`:

- บรรทัดประมาณ 124: ข้อความ “กำลังเปิดให้สำรองพื้นที่” เป็น hardcoded
- บรรทัดประมาณ 240: หัวข้อ “พร้อมเลือกพื้นที่แล้ว?” เป็น hardcoded
- บรรทัดประมาณ 243: CTA “เลือกพื้นที่ →” ถูกสร้างเสมอ

ไฟล์นี้ไม่ได้อยู่ใน 8 ไฟล์ของ SCRUM-90 จึงไม่ได้รับ gating แบบเดียวกับ Home, Map และ Booking

#### แนวทางแก้ที่เสนอ

1. Import `isEventBookable` จาก `@/lib/event-booking-rules`
2. คำนวณ `const eventBookable = isEventBookable(event)` หลังโหลดข้อมูล
3. เปลี่ยน Hero badge ตามสถานะจริง
4. เปลี่ยน Reservation card copy ตาม `eventBookable`
5. Event ปิดให้ใช้ CTA “ดูแผนผังแบบอ่านอย่างเดียว →” หรือ disabled state ตามมติ UX ของทีม
6. เพิ่ม frontend unit/helper coverage หากทีมมี test seam ที่เหมาะสม
7. รัน Web typecheck, lint, build และ Browser QA ซ้ำ

Suggested Jira title:

> Event Detail ยังแสดงข้อความ/CTA เปิดจองเมื่อ Event ปิดรับจอง

ไม่ควรแก้รวมใน SCRUM-88/89 เพราะเป็น User production UX bug และควรแยก PR เพื่อ review/revert ได้

### 5.1 Local fix หลังบุ๊คยืนยัน

บุ๊คยืนยันให้แก้ QA-01 แล้ว โดยใช้ follow-up branch ของ SCRUM-90:

- Branch: `codex/scrum-90-event-detail-followup`
- Base: `main` หลัง Merge PR #50 (`1af8bf4`)
- Source file ที่แก้: `apps/web/components/event-detail-screen.tsx`
- จัดส่งเป็น follow-up แยกจาก PR #50 เพื่อให้ review/revert ได้อิสระ

สิ่งที่แก้:

1. Event Detail ใช้ `isEventBookable()` ตัวเดียวกับ Home/Map/Booking
2. Closed Event hero badge แสดง “ปิดรับจอง”
3. Zone & Booth description แจ้งว่ายังดูข้อมูลได้แต่สร้าง Booking ไม่ได้
4. Reservation card แสดง “Event นี้ปิดรับจองแล้ว”
5. Closed Event CTA เปลี่ยนจาก “เลือกพื้นที่” เป็น “ดูแผนผัง” แบบ read-only
6. Open Event ยังคงข้อความ “กำลังเปิดให้สำรองพื้นที่”, “พร้อมเลือกพื้นที่แล้ว?” และ CTA “เลือกพื้นที่”

ผลตรวจ Local production build:

| Gate/Scenario | ผล |
|---|---|
| `npx tsc --noEmit` | PASS — exit 0 |
| `npm run lint` | PASS — ไม่มี warning/error |
| `npm run build` | PASS — สร้างครบ 16 routes |
| Closed Event Detail | PASS — ไม่มีข้อความ/CTA เปิดจอง |
| Open Event Detail regression | PASS — ข้อความและ CTA เปิดจองยังอยู่ |
| Mobile 390 × 844 | PASS — `scrollWidth = clientWidth = 375`, ไม่มี overflow |
| Console/Application Error | PASS — ไม่พบ error |

## 6. ข้อสังเกตที่ต้องให้ Product Owner ตัดสินใจ

หน้า Closed Event Map ยังเปิดปุ่ม “แนะนำ Zone ด้วย AI” แม้ Event ปิดรับจองแล้ว ในการตรวจครั้งนี้ไม่ได้กดปุ่มเพื่อรักษา read-only scope

ตัวเลือก:

1. คงปุ่มไว้เพื่อให้ผู้ใช้สำรวจข้อมูลย้อนหลัง แต่ผลลัพธ์ต้องไม่มี CTA จอง
2. Disable/ซ่อนปุ่มเมื่อ Event ปิด เพื่อไม่ใช้ AI quota โดยไม่เกิด conversion

จุดนี้ยังไม่จัดเป็น bug จนกว่าบุ๊คจะยืนยัน expected behavior

## 7. สรุป Acceptance ของ SCRUM-90

| Acceptance | ผล |
|---|---|
| Event ที่ไม่ใช่ PUBLISHED/ONGOING ไม่เปิดจองใน Home/Map/Booking | PASS สำหรับเส้นทางที่ตรวจ |
| Event ที่ endDate ผ่านแล้วปิดรับจอง | PASS |
| Map ไม่สร้าง booking link เมื่อ Event จองไม่ได้ | PASS |
| ปุ่มสร้าง Booking disabled เมื่อ Event จองไม่ได้ | PASS |
| ข้อความ Home/Map/Booking สอดคล้องกัน | PASS |
| Event ที่ยังจองได้ไม่ถูกปิดโดย regression | PASS |
| Backend reject เมื่อเรียก API โดยตรง | ไม่ยิง POST ใน Production; อ้างอิง CI/unit tests ของ PR #50 ที่ผ่าน 53 suites / 473 tests |
| Event Detail สอดคล้องกับสถานะ | Production ยังพบ QA-01; Local fix ผ่านและรอทีมตรวจ |

## 8. ข้อเสนอขั้นตอนถัดไป

1. ให้บุ๊คตรวจ diff และผล QA ใน follow-up PR ของ SCRUM-90
2. หลัง Merge/Deploy ให้ตรวจ Production Event Detail ซ้ำทั้ง Event ปิดและเปิดรับจอง
3. ยืนยัน expected behavior ของปุ่ม AI บน Closed Event แยกต่างหาก เพราะยังไม่ใช่ bug ที่ตกลงกันใน scope นี้
4. การทดสอบ Backend POST จริงควรใช้บัญชี/ข้อมูลทดสอบที่ทีมอนุมัติ และต้องมี cleanup plan ก่อนเริ่ม

## 9. รายการส่งมอบสำหรับ Review

- Branch: `codex/scrum-90-event-detail-followup`
- Base: `main` หลัง Merge PR #50 (`1af8bf4`)
- Source code: `apps/web/components/event-detail-screen.tsx`
- QA report: `SCRUM-9_Production_QA_After_SCRUM-90_2026-08-23.md`
- ไม่รวม Work Catalog หรือโค้ดของ Jira งานอื่นใน PR นี้

### Final verification ก่อนส่ง

| รายการ | ผล |
|---|---|
| `git diff --check` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS — ไม่มี warning/error |
| `npm run build` | PASS — 16 routes |
| Browser QA — Closed Event Detail | PASS — ข้อความปิดรับจองและ CTA แบบอ่านอย่างเดียวถูกต้อง |
| Browser QA — Open Event Detail regression | PASS — flow เปิดรับจองยังคงเดิม |
| Browser QA — Desktop overflow | PASS — `scrollWidth = clientWidth` |
| Browser QA — Mobile 390 × 844 | PASS — ไม่พบ horizontal overflow |
| Application Error | PASS — ไม่พบ |

## 10. ข้อความสรุปสำหรับบุ๊ค

Follow-up นี้แก้เฉพาะความไม่สอดคล้องของข้อความและ CTA บนหน้า Event Detail เมื่อ Event ปิดรับจอง โดยใช้ booking rule กลางตัวเดียวกับ Home, Map และ Booking Screen ไม่แก้ API, Prisma schema, Supabase data หรือ flow ชำระเงิน จึงมีขอบเขตเล็กและสามารถ review/revert แยกจากงาน UX/Admin อื่นได้
