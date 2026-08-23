# SCRUM-80 — Payment Hold Expiry Notification Handoff

วันที่ส่งมอบ: 23 สิงหาคม 2026

ผู้ดำเนินการ: ซีบิว / Codex

ผู้ตรวจงาน: บุ๊คและทีม SpaceLink

Branch: `codex/scrum-80-payment-hold-expiry-notification`

Base: `main` หลัง Merge PR #50 (`1af8bf4`)

Ticket: `SCRUM-80`

## 1. เป้าหมาย

เพิ่ม In-app Notification ประเภท `PAYMENT` ให้ Vendor เมื่อ `BookingHoldExpiryService` ยกเลิก Booking อัตโนมัติ เพราะผู้ใช้ไม่ชำระเงินภายในเวลาที่กำหนด

ข้อความหลักตาม Ticket:

> การจองถูกยกเลิกเพราะไม่ชำระเงินทันเวลา

งานนี้ครอบคลุมเฉพาะการแจ้งเตือนหลัง hold หมดเวลา ไม่เพิ่มการเตือนล่วงหน้า ไม่แก้ flow อัปโหลดสลิป และไม่แก้ UX/UI Admin

## 2. สภาพเดิมและช่องว่างที่พบ

ก่อนแก้ `BookingHoldExpiryService` ทำงานทุกหนึ่งนาทีและใช้ `updateMany` เพื่อเปลี่ยน Booking ที่เข้าเงื่อนไขดังนี้:

- `status = PENDING_PAYMENT`
- `holdExpiresAt < เวลาปัจจุบัน`

เป็น:

- `status = CANCELLED`
- `cancelledByRole = SYSTEM`
- บันทึก `cancelledAt`

แต่ระบบไม่ได้สร้าง Notification ให้ Vendor ผู้เป็นเจ้าของ Booking ผู้ใช้อาจไม่ได้เปิดหน้าชำระเงินอยู่และไม่ทราบว่า Booking ถูกยกเลิกแล้ว

## 3. แนวทางแก้

### 3.1 ค้นหาเฉพาะ Booking ที่มีสิทธิ์หมดเวลา

Cron อ่านเฉพาะฟิลด์ที่จำเป็น:

- `id`
- `vendorUserId`

และยังคงใช้เงื่อนไขเดิม `PENDING_PAYMENT` กับ `holdExpiresAt < cancelledAt`

### 3.2 Conditional update ป้องกันการแจ้งเตือนซ้ำ

หลังค้นหารายการ ระบบใช้ `updateMany` แบบมีเงื่อนไขซ้ำต่อ Booking:

- ตรง `id`
- ยังเป็น `PENDING_PAYMENT`
- hold ยังหมดเวลาก่อนจุดเวลาที่ Cron รอบนี้เริ่ม

สร้าง Notification เฉพาะเมื่อ `updateMany.count === 1`

เหตุผลคือ Production อาจมี API หลาย instance เรียก Cron ในนาทีเดียวกัน ทุก instance อาจอ่าน Booking เดียวกันได้ แต่จะมีเพียง instance เดียวที่เปลี่ยนสถานะสำเร็จ Instance อื่นจะได้ `count = 0` และไม่สร้าง Notification ซ้ำ

### 3.3 Notification payload

| ฟิลด์ | ค่า |
|---|---|
| User | `vendorUserId` ของ Booking |
| Type | `PAYMENT` |
| Title | `การจองถูกยกเลิกเพราะไม่ชำระเงินทันเวลา` |
| Body | `ระบบคืนบูธให้ผู้ใช้อื่นแล้ว คุณสามารถเลือกบูธและสร้างการจองใหม่ได้` |
| Related entity type | `BOOKING` |
| Related entity ID | Booking ID |

หน้า Notification ของ User รองรับประเภท `PAYMENT` อยู่แล้วและพาไป `/bookings` โดยไม่ต้องแก้ Web code

### 3.4 Best-effort notification

`NotificationsService.createForUser()` มี contract แบบ best-effort และคืน `null` เมื่อสร้าง Notification ไม่สำเร็จ การยกเลิก Booking ที่หมดเวลาจึงยังถือว่าสำเร็จและ Booth ไม่ถูกค้างเพราะระบบแจ้งเตือนมีปัญหา

Database failure ตอนค้นหาหรืออัปเดต Booking ยังถูก throw ออกไปตามพฤติกรรมเดิม เพื่อให้ระบบ monitoring ตรวจพบและ Cron รอบถัดไปสามารถลองใหม่ได้

## 4. รายการไฟล์

1. `apps/api/src/bookings/booking-hold-expiry.service.ts`
2. `apps/api/src/bookings/booking-hold-expiry.service.spec.ts`
3. `SCRUM-80_Payment_Hold_Expiry_Notification_Handoff_2026-08-23.md`

ไม่รวม Work Catalog หรือไฟล์จาก Jira งานอื่นใน delivery นี้

## 5. Test coverage ที่เพิ่มและปรับ

| Test case | Expected | ผล |
|---|---|---|
| มี expired holds สองรายการ | ยกเลิกสอง Booking และแจ้ง Vendor ถูกคน | PASS |
| ไม่มี expired hold | คืน `0` และไม่ update/notify | PASS |
| Cron อีก instance ยกเลิกไปก่อน | conditional update ได้ `0` และไม่แจ้งซ้ำ | PASS |
| Notification best-effort คืน `null` | Booking ยังนับว่ายกเลิกสำเร็จ | PASS |
| Database query ล้มเหลว | Error ไม่ถูกซ่อน | PASS |

## 6. Quality gates ก่อนส่ง

### Targeted

| คำสั่ง | ผล |
|---|---|
| `npm test -- --runInBand booking-hold-expiry.service.spec.ts` | PASS — 1 suite / 5 tests |

### Full API

| คำสั่ง | ผล |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npx eslint src prisma` | PASS — ไม่มี warning/error |
| `npm run build` | PASS — Nest production build สำเร็จ |
| `npm test -- --runInBand` | PASS — 53 suites / 475 tests บน `main` ล่าสุดหลัง PR #50 |
| `git diff --check` | PASS |

หลังตรวจพบว่า local `main` เดิมยังอยู่ที่ PR #45 ได้ย้าย commit ไปวางบน `main` จริงหลัง PR #50 ก่อน Push สำเร็จโดยไม่มี conflict แล้วรันทุก gate ซ้ำ ผลยังผ่านครบตามตารางด้านบน

## 7. Bug และ Edge-case audit

| จุดเสี่ยง | การป้องกัน/ผลตรวจ |
|---|---|
| Cron หลาย instance ส่งแจ้งเตือนซ้ำ | Conditional update และตรวจ `count === 1` |
| แจ้งผิดผู้ใช้ | Recipient มาจาก `vendorUserId` ของ Booking ที่ยกเลิกสำเร็จ |
| Booking ที่จ่ายแล้วถูกยกเลิก | Update ต้องยังเป็น `PENDING_PAYMENT` |
| Booking ที่ hold ยังไม่หมดถูกยกเลิก | Update ตรวจ `holdExpiresAt < cancelledAt` ซ้ำ |
| `holdExpiresAt = null` | ไม่ผ่าน Prisma `lt` filter |
| Notification ล้มเหลวทำให้ Booth ค้าง | Notification เป็น best-effort; cancellation ยังคงสำเร็จ |
| Notification ซ้ำจาก candidate เก่า | Candidate ต้องชนะ conditional update ก่อนแจ้ง |
| ข้อมูลส่วนตัวหลุดใน Notification | ใช้ข้อความทั่วไป ไม่มีชื่อร้าน/ยอดเงิน/ข้อมูลชำระเงิน |
| Schema หรือ migration กระทบ Production | ไม่ได้แก้ schema/migration |
| RLS/Auth/tenant scope เปลี่ยน | ไม่ได้แก้ RLS, Auth, guards หรือ organization scope |

## 8. Supabase safety review

- ตรวจ Supabase changelog ล่าสุดก่อนส่ง ไม่พบ breaking change ที่เกี่ยวข้องกับ Prisma query หรือ Notification flow นี้
- ไม่เพิ่ม table, enum, view, function, trigger, extension หรือ migration
- ไม่แก้ RLS/Data API exposure
- ไม่ใช้ `service_role` ใน frontend และไม่เพิ่ม environment variable
- ไม่รัน SQL หรือเขียนข้อมูลทดสอบลง Production
- Verification ใช้ TypeScript, Prisma-generated types และ Jest mocks ของ query/update/notification contract

## 9. ขอบเขตที่ไม่ได้ทำ

- Notification เตือนล่วงหน้าก่อน hold หมดเวลา
- Email, LINE, Push Notification หรือ SMS
- เปลี่ยน hold duration
- เปลี่ยน Cron schedule ทุกหนึ่งนาที
- เปลี่ยน Payment/SlipOK flow
- เปลี่ยนหน้า User Notification หรือ My Bookings
- เปลี่ยน Prisma schema/migrations
- เปลี่ยน Admin UX/UI

หัวข้อเตือนล่วงหน้าเป็น optional enhancement และควรแยก Ticket/PR หาก Product Owner ต้องการ

## 10. จุดที่ขอให้ Reviewer ตรวจ

1. ยืนยันข้อความ Title/Body ของ Notification
2. ตรวจว่า Notification type `PAYMENT` และ related entity เป็น `BOOKING`
3. ตรวจ conditional update ว่าป้องกัน Cron ซ้ำได้ตามต้องการ
4. ยืนยัน best-effort policy: Notification ล้มเหลวต้องไม่ทำให้ Booking/Booth ค้าง
5. ยืนยันว่าไม่ต้องเพิ่ม warning notification ก่อนหมดเวลาใน SCRUM-80 รอบนี้
6. ตรวจว่าไม่มี schema, Auth, Admin หรือ Jira งานอื่นปะปนใน diff

## 11. QA หลัง Merge ที่แนะนำ

1. ใช้ Booking ทดสอบที่ได้รับอนุมัติและมี `PENDING_PAYMENT`
2. ตั้ง `holdExpiresAt` ให้หมดเวลาตามขั้นตอน QA ของทีม
3. รอ Cron อย่างน้อยหนึ่งรอบ
4. ตรวจ Booking เป็น `CANCELLED`, `cancelledByRole = SYSTEM` และมี `cancelledAt`
5. ตรวจ Vendor เห็น Notification ประเภทการชำระเงินหนึ่งรายการ
6. ตรวจ CTA จาก Notification ไปหน้า `/bookings`
7. ตรวจว่า Cron รอบถัดไปไม่สร้าง Notification ซ้ำ
8. Cleanup test data ตามขั้นตอนของทีม

ห้ามแก้เวลาหรือสร้างข้อมูลทดสอบบน Production โดยไม่มีผู้รับผิดชอบข้อมูลอนุมัติ

## 12. สรุปสำหรับบุ๊ค

SCRUM-80 รอบนี้เติมช่องว่างหลังระบบยกเลิก Booking เพราะ hold หมดเวลา โดยแจ้ง Vendor ผ่าน Notification ที่มีอยู่แล้วและป้องกัน duplicate จาก Cron หลาย instance ขอบเขตจำกัดอยู่ที่ API service, unit test และเอกสารส่งมอบ ไม่เปลี่ยนฐานข้อมูลหรือ UX/UI ครับ
