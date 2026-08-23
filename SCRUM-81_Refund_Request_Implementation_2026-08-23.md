# SCRUM-81 — Refund Request MVP พร้อม In-app Notification

วันที่ส่งตรวจ: 23 สิงหาคม 2026

ผู้พัฒนา: ซีบิว / Codex

Jira: [SCRUM-81 — สร้างระบบ Refund Request พื้นฐาน พร้อมแจ้งเตือน](https://skiptv555.atlassian.net/browse/SCRUM-81)

Branch: `codex/scrum-81-refund-request`

Base: `main` commit `0d83cc3` (Merge PR #53 — SCRUM-80)

สถานะ: **IMPLEMENTED AND LOCALLY VERIFIED — READY FOR REVIEW**

## 1. เป้าหมาย

สร้าง Refund Request MVP ฝั่ง NestJS API โดยใช้ `RefundRequest`, `RefundStatus` และ `NotificationType.REFUND` ที่มีอยู่ใน Prisma schema v4 แล้ว ครอบคลุม:

- Vendor ส่งคำร้องคืนเงินจากการจองของตนเอง
- Vendor ดูประวัติคำร้องของตนเอง
- ORG_ADMIN/SUPER_ADMIN ดูคิวคำร้องขององค์กร
- Admin อนุมัติ ปฏิเสธ และยืนยันว่าดำเนินการคืนเงินแล้ว
- แจ้งผู้ดูแลองค์กรเมื่อมีคำร้องใหม่
- แจ้ง Vendor เมื่อสถานะคำร้องเปลี่ยน

## 2. API ที่เพิ่ม

| Method | Route | Role | รายละเอียด |
|---|---|---|---|
| `POST` | `/api/bookings/:bookingId/refunds` | VENDOR | สร้างคำร้องจากการจองของผู้ใช้ที่เข้าสู่ระบบ |
| `GET` | `/api/refunds/mine` | VENDOR | ดูคำร้องของตนเอง เรียงล่าสุดก่อน |
| `GET` | `/api/organizations/:organizationId/refunds` | SUPER_ADMIN, ORG_ADMIN | ดูคิวคำร้องขององค์กรที่ guard ตรวจ membership แล้ว |
| `PATCH` | `/api/bookings/:bookingId/refunds/:refundId/approve` | SUPER_ADMIN, ORG_ADMIN | อนุมัติยอดคืนเงิน |
| `PATCH` | `/api/bookings/:bookingId/refunds/:refundId/reject` | SUPER_ADMIN, ORG_ADMIN | ปฏิเสธคำร้อง |
| `PATCH` | `/api/bookings/:bookingId/refunds/:refundId/process` | SUPER_ADMIN, ORG_ADMIN | ยืนยันว่าคืนเงินแล้ว |

## 3. State machine

สถานะที่อนุญาตมีเพียง:

```text
PENDING ── approve ──> APPROVED ── process ──> PROCESSED
    └────── reject ──> REJECTED
```

ทุก write ใส่สถานะเดิมไว้ใน `updateMany.where` เพื่อป้องกัน Admin สองคนเปลี่ยนสถานะคำร้องเดียวกันพร้อมกัน หากแพ้ race ระบบตอบ Conflict และไม่ส่ง notification ผิดสถานะ

## 4. กฎธุรกิจที่บังคับใช้

### Vendor สร้างคำร้อง

- Booking ต้องเป็นของ Vendor ที่ authenticated เท่านั้น
- Booking ต้องมีสถานะ `CANCELLED`
- Booking ต้องไม่ใช่ payment-exempt
- ต้องมี `VerifiedSlip` ที่เป็น `VERIFIED` และยอดตรงกับ `booking.boothPrice` ด้วย `Prisma.Decimal.equals()`
- `requestedAmount` ต้องมากกว่า 0
- `requestedAmount` ต้องไม่เกิน `booking.boothPrice`
- อนุญาตหนึ่ง Refund Request ต่อ Booking เพื่อป้องกันการขอคืนซ้ำ
- การตรวจคำร้องซ้ำและการสร้างทำใน Serializable transaction พร้อม retry `P2034` สูงสุด 3 ครั้ง

### Admin ดำเนินการ

- อนุมัติได้เฉพาะ `PENDING`
- `approvedAmount` ต้องมากกว่า 0
- `approvedAmount` ต้องไม่เกินทั้งยอดที่ Vendor ขอและราคาบูธ
- ปฏิเสธได้เฉพาะ `PENDING`
- ยืนยันคืนเงินได้เฉพาะ `APPROVED` ที่มี `approvedAmount`
- บันทึกผู้ตรวจและเวลาตรวจตอน approve/reject
- บันทึก `processedAt` ตอนยืนยันคืนเงิน

## 5. Security และ Multi-tenant Isolation

- Vendor ไม่ส่ง `vendorUserId` หรือ `organizationId` ใน body; ระบบใช้ `@CurrentUser()` และ ownership query
- คำร้องของ Booking คนอื่นและ Booking ที่ไม่มีอยู่ตอบ 404 แบบเดียวกัน
- Admin queue ใช้ `@OrgScoped('organizationId')`
- Admin action ใช้ `@OrgScoped('bookingId')` เพื่อ resolve องค์กรจาก ownership chain จริง
- Service query ทุกจุดของ Admin ใส่ `booking.event.organizationId` ซ้ำใน `where`
- `refundId` ต้องอยู่ใต้ `bookingId` ที่ guard ตรวจแล้ว ไม่สามารถสลับ UUID จากอีก Booking/องค์กรได้
- Input body ทุกตัวใช้ DTO และ Global ValidationPipe ที่มี whitelist/forbidNonWhitelisted
- Money รับและส่งเป็น string ที่รองรับ `Decimal(10,2)` ไม่มี `Float` หรือ `parseFloat`
- ไม่รับ Evidence URL ใน MVP เพราะ arbitrary public URL ไม่ทดแทน private Supabase Storage authorization
- Notification เป็น best-effort; ความล้มเหลวของ notification ไม่ย้อนให้ Refund Request ที่ commit แล้วดูเหมือนล้มเหลว

## 6. Notification

| เหตุการณ์ | ผู้รับ | Type | Related entity |
|---|---|---|---|
| Vendor สร้างคำร้อง | ORG_ADMIN ที่เป็นสมาชิกองค์กร | `REFUND` | `REFUND_REQUEST` |
| Admin อนุมัติ | Vendor เจ้าของคำร้อง | `REFUND` | `REFUND_REQUEST` |
| Admin ปฏิเสธ | Vendor เจ้าของคำร้อง | `REFUND` | `REFUND_REQUEST` |
| Admin ยืนยันคืนเงิน | Vendor เจ้าของคำร้อง | `REFUND` | `REFUND_REQUEST` |

ไม่มีการส่ง Email/SMS/Push ภายนอก และไม่มีการเปิดเผยชื่อผู้ชำระเงินหรือข้อมูลดิบจากสลิป

## 7. ไฟล์ที่สร้างหรือแก้

### แก้ไข

- `apps/api/src/app.module.ts` — เพิ่ม `RefundsModule` เท่านั้น

### สร้างใหม่

- `apps/api/src/refunds/refunds.module.ts`
- `apps/api/src/refunds/refunds.controller.ts`
- `apps/api/src/refunds/refunds.service.ts`
- `apps/api/src/refunds/dto/create-refund-request.dto.ts`
- `apps/api/src/refunds/dto/approve-refund-request.dto.ts`
- `apps/api/src/refunds/refunds.controller.spec.ts`
- `apps/api/src/refunds/refunds.service.spec.ts`
- `SCRUM-81_Refund_Request_Implementation_2026-08-23.md`

## 8. Test coverage ที่เพิ่ม

Refund suites ใหม่: **2 suites / 27 tests**

ครอบคลุม:

- Controller guard metadata และ role separation
- Vendor identity/ownership
- Organization scope และ booking ownership chain
- Eligible paid cancellation
- Payment-exempt และ unverified slip rejection
- Zero/over-price/duplicate request rejection
- Serializable transaction และ P2034 retry
- Vendor list และ organization queue filters
- Approve amount bounds
- Reject/process transitions
- Lost update race
- 404 สำหรับ resource ข้าม Booking/tenant
- Decimal serialization
- Admin/Vendor notification
- Best-effort notification failure

## 9. ผลตรวจจริง

รันจาก `apps/api`:

| Gate | ผล |
|---|---|
| `npm run build` | PASS — exit 0 |
| `npx tsc --noEmit` | PASS — exit 0 |
| `npx eslint src prisma` | PASS — exit 0 |
| `npm test -- --runInBand` | PASS — 55 suites, 504 tests |
| `npm test -- --runInBand refunds` | PASS — 2 suites, 27 tests |
| `npx prisma validate` พร้อม placeholder URLs | PASS — schema valid |
| `git diff --check` | PASS |

หมายเหตุ: `prisma validate` รอบแรกพบว่า environment ของเครื่องไม่มี `DIRECT_URL` จึงรันซ้ำด้วย placeholder local URL ตาม AGENTS.md การ validate ไม่เปิด connection และไม่มีการเปลี่ยนฐานข้อมูล

## 10. ปัญหาที่พบระหว่างตรวจและการแก้

1. ESLint พบ `unbound-method` ใน controller test mocks 6 จุด
   - แก้โดยเก็บ `jest.fn()` เป็นตัวแปรตรงและ assert กับตัวแปรนั้น
   - Targeted lint และ full lint ผ่านหลังแก้
2. ตรวจทวน security พบว่าการอ่านผลหลัง Admin transition ควรมี org filter ซ้ำ
   - เปลี่ยนเป็น `findFirst` ที่กรอง `booking.event.organizationId`
   - เพิ่ม org filter ใน `updateMany` ทุก transition
   - รัน targeted และ full gates ซ้ำ ผ่านทั้งหมด

## 11. สิ่งที่ไม่ได้ทำ

- ไม่แก้ `apps/api/prisma/schema.prisma`
- ไม่สร้างหรือรัน migration
- ไม่รัน `db push`, `db pull`, seed หรือคำสั่งเปลี่ยนฐานข้อมูล
- ไม่อ่าน/เขียนข้อมูล Supabase production
- ไม่แก้ Auth, OrgScopeGuard หรือ RLS
- ไม่เพิ่ม package
- ไม่ทำหน้า Vendor/Admin UX/UI ใน ticket นี้
- ไม่เพิ่ม evidence upload เพราะต้องออกแบบ private Storage authorization แยกต่างหาก
- ไม่เพิ่ม rejection reason เพราะ schema ปัจจุบันไม่มี field รองรับ และ schema ถูก freeze

## 12. Reviewer checklist

1. ตรวจ eligibility: cancelled + paid + verified + non-exempt
2. ตรวจ state transition และ `updateMany.where.status`
3. ตรวจ amount bounds ด้วย Prisma Decimal
4. ตรวจ vendor ownership และ org filters ใน Admin queries
5. ตรวจว่า notification เกิดหลัง write สำเร็จและไม่ทำให้ธุรกรรมหลักล้ม
6. ยืนยันนโยบายหนึ่ง Refund Request ต่อ Booking
7. ยืนยันว่าการไม่มี rejection reason/evidence upload เหมาะกับ Basic MVP

## 13. ข้อความส่งให้บุ๊ค

SCRUM-81 เพิ่ม Refund Request MVP ฝั่ง API โดยใช้ schema เดิมทั้งหมด Vendor ขอคืนเงินจาก Booking ที่ยกเลิกและชำระเงินจริงได้ ส่วน Admin ขององค์กรสามารถดูคิว อนุมัติ ปฏิเสธ และยืนยันคืนเงินตาม state machine ที่ล็อก race condition แล้ว ทุก Admin query มี tenant filter ซ้ำใน service และทุกยอดเงินใช้ Prisma Decimal แบบ string boundary พร้อม in-app notification ทั้งฝั่ง Admin และ Vendor งานไม่แตะฐานข้อมูลจริงหรือ Prisma schema และผ่าน API gates เต็ม 55 suites / 504 tests
