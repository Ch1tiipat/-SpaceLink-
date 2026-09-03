# SpaceLink

แพลตฟอร์มกลางจองพื้นที่ขายของและจัดกิจกรรม — Multi-tenant SaaS PWA · องค์กร (ตลาด / ห้าง / หน่วยงาน) สมัครเข้ามาเป็นผู้เช่าระบบ ออกแบบผังสถานที่ของตัวเอง เปิดอีเวนต์ แล้วผู้ขายเข้ามาเลือกบูธ จอง แนบสลิป และได้รับการยืนยันอัตโนมัติ

> **โครงงานรายวิชา 1101910 โครงงานเทคโนโลยีดิจิทัล-1** · Software Engineering · 1/2569 · นำเสนอ 12–16 ตุลาคม 2569
> **สถานะงานปัจจุบันอยู่ที่ Jira** ไม่เก็บไว้ในไฟล์นี้

## โครงสร้างโปรเจกต์

```
spacelink/
├─ apps/api/                    NestJS + Prisma → Render
│  ├─ prisma/
│  │  ├─ schema.prisma          v4 — freeze แล้ว ห้ามแก้โดยไม่ผ่านทีม
│  │  ├─ seed.ts                ข้อมูลตัวอย่างสำหรับรันในเครื่องตัวเอง (`npm run db:seed`)
│  │  ├─ migrations/            8 migrations — ปัจจุบัน 29 โมเดล 18 enum
│  │  └─ sql/                   2 ไฟล์ที่ Prisma ไม่รันให้ ต้อง apply เองด้วย psql หลัง migrate
│  │                            (AGENTS.md §12) — partial unique index กัน double-booking ·
│  │                            ถอน policy อัปโหลดสลิปตรงของ client (SCRUM-122)
│  └─ src/                      27 โฟลเดอร์ — รายละเอียด "ทำอะไรได้จริง" แต่ละอันอยู่หัวข้อถัดไป
│     ├─ auth/                  JWT guard + JIT provisioning · GET /auth/me
│     ├─ users/                 SUPER_ADMIN: list/detail/last-login/audit trail · ทุก role: PATCH /users/me
│     ├─ organizations/         CRUD องค์กร · มอบ/ถอนสิทธิ์ ORG_ADMIN · โควตา · PromptPay
│     ├─ venues/                อ่านผังสถานที่ (public) + สร้างโซนใต้ venue (ORG_ADMIN+)
│     ├─ zones/                 CRUD โซน (ORG_ADMIN+, ลบไม่ได้ถ้ามีบูธเคยถูกจอง)
│     ├─ booths/                CRUD บูธ (ORG_ADMIN+, กติกาลบเหมือน zones)
│     ├─ events/                สร้าง/เผยแพร่/ปิด/ลบอีเวนต์ · quote ค่าบริการ · /discovery · /map · slug
│     ├─ categories/            หมวดสินค้า — public, อ่านอย่างเดียว
│     ├─ bookings/              จองบูธ · PromptPay QR · auto-confirm ผ่านสลิป · ยกเลิก ·
│     │                         ยกเว้นค่าเช่า · hold-expiry cron · สลิปฝั่งแอดมิน
│     ├─ slips/                 internal — เรียก SLIP_VERIFIER แล้วบันทึกผลทุกครั้ง (มี README เอง)
│     ├─ refunds/               คำร้องคืนเงิน PENDING → APPROVED → PROCESSED / REJECTED
│     ├─ reviews/               รีวิวหลังจบงาน (ต้องมี booking จริง + เว้น 17 ชม.)
│     ├─ shops/                 ร้านค้า 1 ร้าน/vendor ไม่ผูกองค์กร · เปลี่ยนโลโก้ได้ทุก 168 ชม.
│     ├─ notifications/         แจ้งเตือนในแอป + ส่ง web push จริงผ่าน VAPID
│     ├─ push-subscriptions/    ลงทะเบียน/ถอน push subscription ของเบราว์เซอร์
│     ├─ announcements/         ประกาศ + fan-out แจ้งเตือน · SUPER_ADMIN ลบข้ามองค์กรได้
│     ├─ system-broadcasts/     ประกาศกลางจาก SUPER_ADMIN ถึงผู้ใช้ทุกคน (in-app + push)
│     ├─ penalties/             แต้มโทษหักจาก trust score 100 → 0 · ถึง 0 เมื่อไรติดแบล็กลิสต์
│     ├─ support-tickets/       แจ้งปัญหา + ขอยกเว้นโควตา (อนุมัติ = สร้าง booking ให้จริง)
│     ├─ audit-logs/            SUPER_ADMIN อ่านอย่างเดียว — ปัจจุบัน log 7 action
│     ├─ platform-config/       SUPER_ADMIN ตั้งสูตรราคาค่าบริการอีเวนต์ของแพลตฟอร์ม
│     ├─ ai/                    แนะนำบูธ + แชตช่วยเหลือ — rule-based + Gemini (มี README เอง)
│     ├─ dashboard/             สรุปตัวเลของค์กร (ORG_ADMIN+)
│     ├─ health/                GET /health, /health/db — ไม่ต้อง auth
│     ├─ prisma/                PrismaService (lazy connect)
│     ├─ common/                decorators + exception filter + LooseUuidPipe (ไม่ใช่ NestJS module)
│     └─ config/                ตรวจ env ตอน boot (ไม่ใช่ NestJS module)
├─ apps/web/                    Next.js 14 App Router PWA → Vercel
│  ├─ app/                      layout.tsx · globals.css · page.tsx (หน้าค้นหา Event) — หน้า user ทั่วไป
│  │  ├─ login/ · register/     เข้าสู่ระบบ / สมัครสมาชิก ด้วย Email OTP (เข้าแล้วเด้งตาม role)
│  │  ├─ events/[eventId]/      รายละเอียดอีเวนต์ · `/map` ผังโซนและบูธ · `/book` จองบูธ
│  │  ├─ bookings/              รายการจองของตัวเอง · `[bookingId]` รายละเอียด ·
│  │  │                         `/payment` PromptPay QR + อัปโหลดสลิป · `/review` รีวิวหลังจบงาน
│  │  ├─ notifications/         แจ้งเตือนในแอป + ตัวกรองตามประเภท/ยังไม่อ่าน
│  │  ├─ profile/               โปรไฟล์ + ร้านค้า (ส่วนร้านค้าแสดงเฉพาะ VENDOR)
│  │  ├─ help/                  ศูนย์ช่วยเหลือ FAQ + แจ้งปัญหา (support ticket)
│  │  ├─ admin/                 หน้า ORG_ADMIN — คนละ shell คนละ route tree กับ super-admin/
│  │  │  ├─ dashboard/          สรุปตัวเลขภาพรวมองค์กร
│  │  │  ├─ events/             สร้าง/เผยแพร่/ปิด/ลบอีเวนต์ + ดูใบเสนอราคาค่าบริการ
│  │  │  ├─ bookings/           รายการจองขององค์กร · ยืนยันแบบยกเว้นค่าเช่า
│  │  │  ├─ booking-rescue/     กู้คืน/จัดการการจองที่ค้าง (เข้าจากหน้า bookings)
│  │  │  ├─ zones/              จัดการโซน / บูธ
│  │  │  ├─ map-designer/       ออกแบบผังสถานที่
│  │  │  ├─ vendors/            ผู้ขายในองค์กร + ประวัติการจองรายคน (SCRUM-146)
│  │  │  ├─ payments/           การชำระเงินและคืนเงิน · ดู/ดาวน์โหลดสลิป (SCRUM-143)
│  │  │  ├─ reviews/            สรุปคะแนนรีวิวของโซนและร้านค้า
│  │  │  ├─ announcements/      ประกาศถึงผู้ขาย
│  │  │  └─ organization/       ตั้งค่าองค์กร
│  │  └─ super-admin/           หน้า SUPER_ADMIN เท่านั้น — SuperAdminShell แยกทั้งชุด (SCRUM-89/PR #66)
│  │     ├─ page.tsx            ภาพรวมข้ามทุกองค์กร + ส่งประกาศกลาง (system broadcast)
│  │     ├─ organizations/      องค์กรทั้งหมด · สร้าง · เปลี่ยนสถานะ · แก้ PromptPay (SCRUM-139)
│  │     ├─ admins/             แอดมินองค์กรทั้งระบบ + มอบสิทธิ์แก้โควตา (SCRUM-137)
│  │     ├─ users/              ผู้ใช้ทั้งหมด + รายละเอียดรายคน + last-login
│  │     ├─ events-bookings/    การจองและการเงินข้ามองค์กร (`?tab=bookings|payments`)
│  │     ├─ support/            เคสช่วยเหลือ + แต้มโทษ/แบล็กลิสต์ (`?tab=tickets|moderation`)
│  │     ├─ announcements/      ประกาศข้ามองค์กร + ลบได้ (SCRUM-141)
│  │     ├─ audit-logs/         audit log ทั้งระบบ + กรองตาม action / ผู้ทำ
│  │     └─ settings/           สูตรราคาค่าบริการอีเวนต์ของแพลตฟอร์ม (SCRUM-86)
│  ├─ components/               ส่วนจอต่อหน้า — 30 ไฟล์ + `components/super-admin/` อีก 10 ไฟล์
│  ├─ lib/                      api.ts · supabase.ts · auth-errors.ts · use-auth-state.ts ·
│  │                            use-email-otp.ts · use-vendor-profile.ts ·
│  │                            event-booking-rules.ts · ux-preview.ts (dev เท่านั้น)
│  └─ public/                   icon.svg · manifest.webmanifest · push-sw.js · รูปอ้างอิง 4 ไฟล์
├─ prototype/                   prototype เดิม ใช้อ้างอิงเท่านั้น ห้ามแก้
├─ .github/                     CI workflow · keep-alive ping (Render free) · CODEOWNERS
└─ AGENTS.md · CLAUDE.md · README.md
```

แต่ละ app แยกกันสมบูรณ์ ไม่ใช่ npm workspaces ต้อง `cd` เข้าโฟลเดอร์ก่อนรัน npm ทุกครั้ง

`/admin` (ORG_ADMIN) กับ `/super-admin` (SUPER_ADMIN) เป็น **คนละ route tree คนละ shell กันโดย
ตั้งใจ** ไม่ใช่ share กัน — `app-shell.tsx` เช็ค `isSuperAdminRoute` แล้ว bypass ตัวเองทันที
(`if (isSuperAdminRoute) return <>{children}</>`) ปล่อยให้ `super-admin/layout.tsx` ครอบด้วย
`SuperAdminShell` แยกทั้งชุดแทน ซึ่งมี guard เช็ค `auth.role !== 'SUPER_ADMIN'` ของตัวเอง (เด้งออก
ถ้าไม่ใช่) มาจาก PR #66 / SCRUM-89

**Phase 1 ที่เคยมีแค่ 2 หน้าจบไปแล้ว** — ตอนนี้ `/super-admin` มี 9 หน้าจริงที่ต่อ API ครบ (ภาพรวม,
องค์กร, แอดมินองค์กร, ผู้ใช้, การจอง/การเงิน, เคสช่วยเหลือ, ประกาศ, audit log, ตั้งค่าแพลตฟอร์ม)
เมนูใน `SuperAdminShell` ที่ยังเป็น placeholder "เร็วๆ นี้" เหลือ 3 รายการเท่านั้น: **Package และ
Billing**, **สถานะระบบ**, **บทบาทและสิทธิ์** — สามอันนี้ไม่มี route จริงข้างหลัง ส่วน endpoint
SUPER_ADMIN-only แบบข้ามองค์กรที่เหลือ (`GET /bookings/all`, `/refunds/all`, `/penalties/all`,
`/support-tickets/all`, `/announcements/all`, `/audit-logs`, `/users`) มีหน้าเว็บของตัวเองครบแล้ว

## โมดูลใน `apps/api/src/` — ทำอะไรได้จริง

สรุปจากการอ่าน controller/service จริงทุกโมดูล ไม่ใช่แค่ endpoint list — กติกาฉบับเต็มอยู่ใน
[`AGENTS.md`](./AGENTS.md)

### ผู้ใช้และสิทธิ์

- **`auth/`** — endpoint เดียวคือ `GET /auth/me` คืนโปรไฟล์ + ร้านค้า (พร้อมเวลาที่เปลี่ยนโลโก้ได้
  ครั้งถัดไป) + องค์กรที่เป็นสมาชิก (พร้อม `promptpayId`, โควตา และสิทธิ์แก้โควตา) ไม่มี
  register/login/logout ในนี้ (ผู้ใช้ auth ผ่าน Supabase โดยตรง) `SupabaseAuthGuard` ตรวจ JWT แล้ว
  **JIT-provision** แถว `app_user` ให้อัตโนมัติในครั้งแรกที่เห็น `auth_user_id` — role เริ่มต้น
  เป็น VENDOR เสมอ ไม่มีทางตั้งเป็น admin จาก token ได้
- **`users/`** — SUPER_ADMIN เท่านั้นดูรายชื่อ/รายละเอียดผู้ใช้ทั้งหมดได้ (`GET /users`,
  `GET /users/:id` พร้อมประวัติการจอง/คืนเงิน/แต้มโทษ/ตั๋วปัญหาของคนนั้น), ดู last-login จริงจาก
  Supabase Auth Admin API (`GET /users/:id/last-login`) และดู audit log ที่ผู้ใช้คนนั้นเป็นคนทำ
  (`GET /users/:id/audit-logs`) ทุก role แก้โปรไฟล์ตัวเองได้ผ่าน `PATCH /users/me` ซึ่งรับ
  **`phone` ฟิลด์เดียว** (ตัวเลขไทย 9–10 หลัก ไม่มีขีดคั่น) — ไม่มี `:id` เพราะเป้าหมายคือคนที่ถือ
  token เสมอ

### แกนหลัก — องค์กร, สถานที่, โซน, บูธ, อีเวนต์

- **`organizations/`** — SUPER_ADMIN สร้าง/แก้/เปลี่ยนสถานะองค์กร (รวม `promptpayId` ที่ใช้สร้าง QR
  ให้ผู้ขาย — SCRUM-139) และมอบ/ถอนสิทธิ์ ORG_ADMIN ให้ผู้ใช้ได้ การมอบสิทธิ์เปลี่ยน `UserRole` ของ
  ผู้ใช้จาก VENDOR เป็น ORG_ADMIN ให้อัตโนมัติ (และเปลี่ยนกลับเป็น VENDOR เมื่อถอน membership องค์กร
  สุดท้ายที่เหลือ) · `PATCH /organizations/:organizationId/quota` แก้โควตาการจองต่อผู้ขายต่ออีเวนต์
  ซึ่ง ORG_ADMIN ทำได้**ก็ต่อเมื่อ SUPER_ADMIN มอบ `canEditQuota` ให้ membership นั้นแล้ว**ผ่าน
  `PATCH /admins/:membershipId/quota-permission` (SCRUM-137)
- **`venues/`** — `GET /venues`, `GET /venues/:id` เป็น public read และ `POST /venues/:venueId/zones`
  สร้างโซนใต้ venue (ORG_ADMIN+) **ยังไม่มี endpoint สร้าง/แก้/ลบ venue** — `VenuesService` มีเมธอด
  `create`/`update`/`remove` อยู่แต่ไม่มี route ไหนเรียก แต่ละ venue ผูกกับ 1 องค์กร ใช้ซ้ำได้หลาย
  อีเวนต์
- **`zones/`** — CRUD โซนในผัง (ORG_ADMIN+) ลบไม่ได้ถ้ายังมีบูธที่เคยมี booking ผูกอยู่ แม้ booking
  นั้นจะถูกยกเลิกไปแล้วก็ตาม (กันด้วย FK restrict แล้วแปล error เป็นภาษาไทยให้)
- **`booths/`** — CRUD บูธ (ORG_ADMIN+) กติกาการลบเหมือน zones ทุกประการ
- **`events/`** — `POST /organizations/:organizationId/events` สร้างอีเวนต์เป็นสถานะ DRAFT พร้อมสร้าง
  แถว `Subscription` (ค่าบริการที่องค์กรจ่ายให้แพลตฟอร์ม) ในทรานแซกชันเดียวกัน · `POST .../events/quote`
  คำนวณราคาให้ดูก่อนได้โดยไม่สร้างอะไร · lifecycle มี 3 ปุ่มแยกกัน `PATCH :eventId/publish`
  (DRAFT → PUBLISHED, atomic ด้วย `updateMany` กันสองคนกดพร้อมกัน — SCRUM-112), `close`
  (PUBLISHED/ONGOING → CANCELLED), `open` (CANCELLED → PUBLISHED) และ `DELETE :eventId` ที่ลบได้
  เฉพาะอีเวนต์ที่ยังไม่เคยมี booking (SCRUM-134) · **ยังไม่มี endpoint แก้ไขรายละเอียดอีเวนต์**
  (`EventsService.update` มีอยู่แต่ไม่มี route เรียก — คอมเมนต์ในไฟล์อธิบายว่าจงใจบังคับให้ route ที่
  มาทีหลังต้องส่ง `orgId` เข้ามา) · ทุกอีเวนต์มี `slug` ที่ unique สร้างจากชื่อ + สุ่มท้าย 6 ตัว
  (ชื่อไทยล้วนที่ slugify แล้วว่างจะได้ `event-xxxxxx`) ใช้กับ `GET /events/by-slug/:slug/map`
  สำหรับลิงก์สาธารณะ (SCRUM-149) · `GET /events/discovery` และหน้าผังทั้งสองแบบคืนเฉพาะอีเวนต์
  PUBLISHED/ONGOING **ขององค์กรที่สถานะ ACTIVE เท่านั้น** (SCRUM-85) · `GET /events/:id/map` คืนผัง
  โซน+บูธพร้อมสถานะ AVAILABLE/HELD/BOOKED/UNAVAILABLE ต่อบูธ และคำนวณ tier บูธ (S/A/B/C) จากราคา
  แบบ derived สด ไม่เก็บลง DB
- **`categories/`** — หมวดสินค้า public อ่านอย่างเดียว ใช้ตอนสร้างร้านค้าและตอนขอคำแนะนำโซน

### การจองและการชำระเงิน

- **`bookings/`** — หัวใจของระบบ `POST /bookings` ล็อกบูธด้วย serializable transaction (กัน
  race condition ตอนจองพร้อมกัน retry อัตโนมัติสูงสุด 3 ครั้งถ้าเจอ write conflict) เช็คครบทุก
  invariant ในทีเดียว — venue ของบูธตรงกับ venue ของอีเวนต์, ช่วงวันที่จองอยู่ในช่วงอีเวนต์, บูธ
  ว่างจริง, องค์กรเจ้าของอีเวนต์ยัง ACTIVE, ไม่เกิน quota ต่ออีเวนต์ (อ่านจาก org_config ก่อน ตกไป
  platform_config), ผู้ใช้ไม่ติดแบล็กลิสต์ — สำเร็จแล้วตั้งสถานะ `PENDING_PAYMENT` พร้อม hold 5 นาที
  · `GET /bookings` (ของผู้ขายเอง) แนบ **PromptPay QR เป็น data URI** มาให้ทุกแถวที่องค์กรตั้ง
  `promptpayId` ไว้ (SCRUM-131) · `POST /bookings/:id/slip` รับไฟล์ JPEG/PNG ไม่เกิน 5 MB (ตรวจจาก
  magic bytes จริง ไม่เชื่อ content-type ที่ client ส่ง) อัปขึ้น Supabase Storage แล้วเรียก
  `SlipVerificationService` และ **auto-confirm เป็น `CONFIRMED` ทันที** ถ้ายอดตรงกับราคาบูธและสถานะ
  เป็น VERIFIED — ไม่ต้องรอ admin กดอนุมัติ · `PATCH /bookings/:id/cancel` ยกเลิกได้เฉพาะก่อนถึงวัน
  เริ่มอีเวนต์ · `PATCH /bookings/:bookingId/confirm-exempt` (ORG_ADMIN+) ยืนยันแบบยกเว้นค่าเช่าโดย
  ข้าม slip ไปเลย · `GET /bookings/by-code/:bookingCode` ให้แอดมินค้นจากรหัสที่ผู้ขายเห็น (เช็ค
  ownership ในเซอร์วิสเพราะ booking code ไม่ใช่ UUID จึงใช้ `@OrgScoped` ไม่ได้) · มี
  `createForAdmin()` แยกไว้ให้ `support-tickets/` เรียกตอนอนุมัติ quota exception — ข้ามได้แค่ quota
  อย่างเดียว invariant อื่นทุกตัวยังเช็คครบเหมือนเดิม
- **`GET /bookings/:bookingId/slip`** (SCRUM-143) — ORG_ADMIN ขององค์กรเจ้าของอีเวนต์ หรือ
  SUPER_ADMIN ขอ **signed URL อายุ 5 นาที** สำหรับดูและดาวน์โหลดสลิปได้ ไม่มีการเก็บหรือคืน URL
  สาธารณะถาวรเลย · booking ที่ไม่มีอยู่จริง, booking ขององค์กรอื่น และ booking ที่ยังไม่เคยแนบสลิป
  ตอบ **404 เหมือนกันทั้งสามกรณี** โดยตั้งใจ (AGENTS.md §14.1)
- **`slips/`** — ไม่มี controller ของตัวเอง เป็น internal module ที่ `bookings/` เรียกผ่าน
  `SlipVerificationService` เท่านั้น หน้าที่เดียวคือเรียก provider ที่ตั้งค่าไว้
  (`SLIP_VERIFIER=mock|manual|slipok` — **`slipok` เป็น provider จริงที่เรียก SlipOK API ภายนอก
  แล้ว ไม่ใช่ stub**) แล้วบันทึกผลลง `verified_slip` **ทุกครั้งไม่ว่าผลจะเป็นอะไร** แม้ตรวจไม่ผ่าน
  ก็บันทึก เพื่อให้ admin เห็นหลักฐานตอน vendor อ้างว่าจ่ายแล้วแต่สลิปไม่ผ่าน
- **hold-expiry cron (อยู่ใน `bookings/`)** — ทำงานทุกนาทีด้วย `@Cron(EVERY_MINUTE)` ยกเลิก
  booking ที่ยัง `PENDING_PAYMENT` และ hold หมดอายุแล้วโดยอัตโนมัติ (`cancelledByRole = SYSTEM`)
  คืนบูธให้ว่างพร้อมแจ้งเตือน vendor เจ้าของ booking
- **`refunds/`** — vendor ยื่นคำร้องคืนเงินได้เฉพาะ booking ที่ถูกยกเลิกแล้ว, ไม่ใช่แบบยกเว้น
  ค่าเช่า, และต้องมีสลิปที่ verified แล้วยอดตรงกับราคาบูธเท่านั้น ผ่าน 3 สถานะ: PENDING →
  APPROVED (admin ระบุยอดอนุมัติ ต้องไม่เกินยอดที่ขอและไม่เกินราคาบูธ) → PROCESSED (ยืนยันว่าโอน
  คืนแล้วจริง) หรือ REJECTED แจ้งเตือน org admin ทุกคนตอนมีคำร้องใหม่ และแจ้ง vendor ทุกครั้งที่
  สถานะเปลี่ยน
- **`reviews/`** — vendor รีวิวได้เฉพาะบูธ/โซนที่เคยมี booking สถานะ CONFIRMED/COMPLETED และ
  อีเวนต์จบไปแล้วอย่างน้อย 17 ชั่วโมง (นับจาก `bookingEndDate`) รีวิวซ้ำ target เดิมจะอัปเดตของเดิม
  แทนสร้างใหม่ (1 รีวิวต่อ 1 target ต่อ 1 คน) `GET /reviews/average` เป็น public endpoint

### ผู้ขาย

- **`shops/`** — vendor สร้างร้านได้ 1 ร้านต่อบัญชีเท่านั้น (`POST /shops`) แก้ไขผ่าน
  `PATCH /shops/me` และอัปโหลดโลโก้ผ่าน `POST /shops/me/logo` (multipart — API เป็นเจ้าของ storage
  เอง เบราว์เซอร์ไม่เคยถือ service-role key และไม่ได้เลือกชื่อไฟล์) ทั้งสอง route resolve ร้านจาก
  token ที่ login ไม่รับ id ร้านจาก client เลย · **เปลี่ยนโลโก้ได้ 1 ครั้งต่อ 168 ชั่วโมง**
  (SCRUM-130) โดยล็อกแถวด้วย `SELECT ... FOR UPDATE` ในทรานแซกชัน และ `/auth/me` คืน
  `logoAvailableAt` มาให้ UI ปิดปุ่มได้ตรงกัน · ร้านค้าไม่ผูกกับองค์กรใดองค์กรหนึ่ง (เป็นของ vendor
  โดยตรง)

### แจ้งเตือนและสื่อสาร

- **`notifications/`** — `GET /notifications`, `/unread-count`, `PATCH /mark-all-read` และ
  `PATCH /:notificationId/read` ถูกยิงจากหลาย module อื่น (booking, penalty, refund, announcement,
  support ticket) การสร้าง notification เป็น best-effort เสมอ — เขียนไม่สำเร็จก็ไม่ทำให้ flow หลัก
  (เช่นการจอง) ล้มตาม · **มี push notification จริงแล้ว** (SCRUM-27): `PushSenderService` เรียก
  `webpush.setVapidDetails()` และ `webpush.sendNotification()` ของแพ็กเกจ `web-push` ตรง ๆ จะทำงาน
  เมื่อ `VAPID_PRIVATE_KEY` ถูกตั้งไว้เท่านั้น ถ้าไม่ตั้งก็ no-op เงียบ ๆ ไม่ error · subscription
  ที่ตายแล้ว (endpoint ตอบ 404/410) ถูกลบทิ้งจากตารางให้อัตโนมัติ · **ขอบเขตที่ส่ง push จริงตอนนี้มี
  สองทาง**: notification รายคน (`createForUser` — จองสำเร็จ, ชำระเงินสำเร็จ, hold หมดอายุ, แต้มโทษ,
  คืนเงิน, ตั๋วปัญหา) และ system broadcast (`broadcastToAllUsers`) · **fan-out ของ announcement
  ไม่ส่ง push** เขียนเป็น notification ในแอปอย่างเดียว
- **`push-subscriptions/`** — `POST /push-subscriptions` upsert subscription ของเบราว์เซอร์ (คีย์
  คือ `endpoint` เก็บ user-agent ไว้ด้วย) และ `DELETE /push-subscriptions` ถอนออก โดยลบเฉพาะแถวที่
  เป็นของผู้ใช้ที่ถือ token
- **`announcements/`** — ORG_ADMIN+ ประกาศถึงผู้ขาย ประกาศที่ active (ทั้งตอนสร้างและตอนเปลี่ยน
  จาก draft เป็น active) จะ fan-out เป็น notification ให้ vendor ทุกคนที่มี booking ที่ยังไม่ถูก
  ยกเลิกและอีเวนต์ยังไม่จบในองค์กรนั้นโดยอัตโนมัติ · ลบได้สองทาง:
  `DELETE /organizations/:organizationId/announcements/:announcementId` (ORG_ADMIN+ ในองค์กรตัวเอง)
  และ `DELETE /announcements/:announcementId` (**SUPER_ADMIN เท่านั้น ข้ามองค์กรได้** — SCRUM-141)
  SUPER_ADMIN ดูข้ามองค์กรได้ที่ `GET /announcements/all`
- **`system-broadcasts/`** — SUPER_ADMIN ส่งประกาศกลางถึงผู้ใช้ **ทุกคน** ในระบบ (`POST`) ซึ่งเขียน
  notification ทีเดียวด้วย `createMany` แล้วยิง push ตามแบบ best-effort · `GET /active` คืนประกาศ
  ล่าสุดที่ยังไม่หมดอายุให้ผู้ใช้ที่ล็อกอินแล้วเอาไปแสดงเป็นแบนเนอร์

### การกำกับดูแล (governance)

- **`penalties/`** — ORG_ADMIN+ ออกแต้มโทษผูกกับ booking ได้ (`POST /bookings/:bookingId/penalties`)
  และ SUPER_ADMIN ออกให้ผู้ขายตรง ๆ ได้ (`POST /penalties`) เหตุผลให้เลือก: ไม่มาตามนัด,
  ทำผิดกติกาการใช้พื้นที่, ผิดสัญญา, ได้รีวิวไม่ดี, อื่นๆ · **กลไกเปลี่ยนไปแล้วตั้งแต่ SCRUM-142**:
  `app_user.trust_score` เริ่มที่ **100** และแต้มของแต่ละ penalty เป็นค่า **หักออก** (ค่าเริ่มต้น
  ไม่มาตามนัด 20 · ผิดกติกา 15 · ผิดสัญญา 30 · รีวิวไม่ดี 10 · อื่นๆ 5 — ระบุเองได้) คะแนนถูก clamp
  ที่ 0 และ **แตะ 0 เมื่อไรระบบตั้ง `isBlacklisted` ทันที** ทั้งหมดอยู่ใน serializable transaction
  (retry 3 ครั้ง) · ไม่มีการ "สะสมครบ 3 แต้มแล้วแบน" อีกแล้ว และ **ห้ามคำนวณคะแนนปัจจุบันใหม่จากการ
  บวกแถว penalty** (AGENTS.md §6.3.5) · ผู้ใช้ที่ติดแบล็กลิสต์จองบูธใหม่ไม่ได้ทันทีและถูก sign out
  ตั้งแต่หน้า login SUPER_ADMIN ดูภาพรวมข้ามองค์กรได้ที่ `GET /penalties/all`
- **`support-tickets/`** — vendor แจ้งปัญหาทั่วไป และเป็นช่องทางขอ "ยกเว้นโควตา" เมื่อจองครบโควตา
  ต่ออีเวนต์แล้ว (ไม่มี field โครงสร้างสำหรับคำขอนี้โดยเฉพาะ เพราะ schema freeze แล้ว — vendor
  เขียนอธิบายเป็นข้อความ, admin อ่านแล้วอนุมัติเองโดยระบุ event/booth ที่จะสร้างให้) การอนุมัติเรียก
  `BookingsService.createForAdmin` สร้าง booking จริงให้ทันที (ข้ามแค่ quota, invariant อื่นเช็ค
  ครบเหมือน booking ปกติ) และกันการอนุมัติข้ามองค์กรกับการกดอนุมัติซ้อนกันไว้แล้ว (SCRUM-120/121) ·
  ORG_ADMIN ส่งคำร้องถึง SUPER_ADMIN ได้เองที่ `POST /support-tickets/organizations/:organizationId`
  (เฉพาะประเภท ISSUE_REPORT — SCRUM-136) · SUPER_ADMIN ดูตั๋วข้ามองค์กรที่ `GET /support-tickets/all`
  เปิดรายละเอียดพร้อมข้อความทั้งเธรดที่ `GET /support-tickets/:ticketId` และเปลี่ยนสถานะแบบเดินหน้า
  อย่างเดียว OPEN → IN_PROGRESS → CLOSED (SCRUM-140)
- **`audit-logs/`** — อ่านได้เฉพาะ SUPER_ADMIN กรองด้วย `?action=` และ `?actorUserId=` ได้ บันทึกแบบ
  best-effort (เขียนไม่สำเร็จไม่ทำให้ action หลักล้มตาม) **ปัจจุบันมี 7 action ที่ถูกเรียกจริงในโค้ด
  จาก 2 ไฟล์**: `organizations.service.ts` 6 ตัว (สร้างองค์กร, เปลี่ยนสถานะองค์กร, มอบสิทธิ์
  ORG_ADMIN, ถอนสิทธิ์ ORG_ADMIN, เปลี่ยนสิทธิ์แก้โควตา, เปลี่ยนค่าโควตา) และ
  `platform-config.service.ts` อีก 1 ตัว (แก้สูตรราคาแพลตฟอร์ม) — โมดูลอื่นยังไม่มีการเรียกบันทึก
- **`platform-config/`** — SUPER_ADMIN เท่านั้น `GET /platform-config` และ `PATCH /platform-config`
  ตั้งสูตรราคาค่าบริการที่องค์กรจ่ายต่ออีเวนต์: `baseFee`, `perZoneRate`, `perDayRate`, `priceMin`,
  `priceMax` · ทุกค่าเป็นสตริงที่เข้ากับ Decimal ได้ ไม่แปลงผ่าน float · ถ้ายังไม่เคยบันทึกเลยระบบ
  ใช้ค่าเริ่มต้น (500 / 50 / 100 / 500 / 15000) และการแก้ทุกครั้งลง audit log (SCRUM-86)

### AI

`ai/` มี 2 หน้าที่แยกกัน คนละ endpoint คนละสวิตช์ env

- **แนะนำโซน/บูธ** — `POST /events/:eventId/recommendations` แนะนำบูธให้ vendor ตามหมวดสินค้าของร้าน
  (หรือหมวดที่ระบุเอง ถ้าระบุต้องเป็นหมวดของร้านตัวเองเท่านั้น ห้ามสอดแนมร้านอื่น) มี provider 2
  แบบเลือกด้วย `ZONE_RECOMMENDER=rule|gemini`: `rule` คำนวณจากหมวดสินค้าที่ตรงกันและราคากลาง
  ใช้งานออฟไลน์ได้ไม่พึ่งบริการภายนอก, `gemini` ใช้ Flash/Flash-Lite เท่านั้น (ปฏิเสธ Pro ตั้งแต่
  boot) ส่ง prompt เฉพาะรหัสบูธ/ชื่อโซน/ราคา/หมวดสินค้า ไม่มีข้อมูลส่วนตัวใดๆ
  `ZoneRecommendationService` ครอบทุก provider ด้วย timeout 5 วินาที + ตรวจรูปแบบผลลัพธ์ +
  ตรวจว่าบูธที่แนะนำจองได้จริงในอีเวนต์นั้น ผิดเงื่อนไขไหนก็ fallback เป็น rule-based ให้อัตโนมัติ
  แล้วบันทึกทุกครั้งลง `recommendation_log` พร้อม source ที่ตอบจริง (ไม่ใช่ provider ที่ตั้งค่าไว้)
- **แชตช่วยเหลือ (SCRUM-109)** — `POST /ai/support` รับคำถาม + ประวัติสนทนา (ใช้ย้อนหลัง 10 ข้อความ)
  เลือก provider ด้วย `SUPPORT_ASSISTANT=rule|gemini` และโมเดลด้วย `GEMINI_SUPPORT_MODEL` (ตรวจว่า
  เป็น Flash/Flash-Lite ตั้งแต่ boot เหมือนกัน) · บริบทที่ส่งให้โมเดลถูกประกอบฝั่ง server จากข้อมูล
  ที่ผู้ถามมีสิทธิ์เห็นเท่านั้น — ร้านของตัวเอง, booking ของตัวเอง, อีเวนต์ที่ publish แล้ว และประกาศ
  ที่ active — ห่อไว้ใน `<untrusted_runtime_data>` และ system prompt สั่งห้ามทำตามคำสั่งที่แฝงมาใน
  นั้น · timeout 8 วินาที แล้ว fallback เป็นคำตอบ rule-based เสมอ · log ตอนล้มเหลวใช้**สรุปสาเหตุ
  จาก allowlist**เท่านั้น (timed out / HTTP nnn / invalid JSON …) ไม่มี message ดิบของ error,
  prompt, API key หรือบริบทผู้ใช้หลุดลง log (SCRUM-148)

### Admin overview

- **`dashboard/`** — `GET /organizations/:organizationId/dashboard-summary` (ORG_ADMIN+) สรุปตัวเลข
  องค์กร: จำนวน booking แยกตามสถานะ (รอชำระ/ยืนยันแล้ว/ยกเลิก), จำนวน venue/zone/booth, จำนวน
  อีเวนต์ที่ publish แล้วและที่ยังไม่ถึงวันเริ่ม

### Infrastructure (ไม่มี controller / ไม่ใช่ business module)

- **`prisma/`** — `PrismaService` เชื่อมต่อ DB แบบ lazy (ต่อครั้งแรกที่มี query จริง ไม่ใช่ตอน boot)
- **`common/`** — decorators ที่ใช้ร่วมกันทั้งระบบ (`@CurrentUser`, `@CurrentOrgId`, `@Roles`),
  exception filter กลางที่แปล Prisma error code เป็น HTTP response โดย**ไม่ปล่อยข้อความดิบของ Prisma
  ออกทั้งใน response และใน log** (log มีแค่ชนิด error, โค้ด และ HTTP status — SCRUM-123), ตัวช่วย
  แปลง Decimal และ `isLooseUuid()` / `LooseUuidPipe` ที่รับ UUID แบบ "ถูกรูป 8-4-4-4-12" แทน
  `isUUID()` / `ParseUUIDPipe()` แบบเข้ม เพราะ id เก่าบางตัวใน `seed.ts` ไม่มี version/variant ตาม
  RFC 4122 (SCRUM-151 — ที่ยังใช้ `ParseUUIDPipe()` อยู่โดยตั้งใจมีไฟล์เดียวคือ
  `announcements-admin.controller.ts` เพราะไม่มี id ประกาศเก่าให้รองรับ)
- **`config/`** — ตรวจ environment variables ให้ครบตอน boot ตาม `env.validation.ts`
- **`health/`** — `GET /health`, `GET /health/db` — ไม่ต้อง auth (สำหรับ hosting health check และ
  workflow keep-alive)

รายการนี้สรุปพฤติกรรมหลักที่อ่านจากโค้ดวันนี้ ไม่ใช่ spec ฉบับเต็ม — guard/role ที่แท้จริงของแต่ละ
endpoint ต้องเปิด controller ดูเองก่อนแก้โค้ดเสมอ

## Tech stack

| ส่วน | ใช้อะไร |
|---|---|
| Frontend | Next.js 14 (App Router), React, Tailwind CSS, next-pwa, SVG zone map |
| Backend | NestJS (TypeScript) REST · Prisma · PostgreSQL (Supabase Pro) |
| Supabase | Auth — Email OTP / magic link (NestJS verify token ด้วย `jose`) · Storage (สลิป, โลโก้ร้าน) |
| บริการภายนอก | Gemini **Flash / Flash-Lite เท่านั้น ห้ามใช้ Pro** · SlipOK (OK BASIC) · web-push |
| การชำระเงิน | PromptPay QR สร้างฝั่ง API ด้วย `promptpay-qr` + `qrcode` จาก `promptpayId` ขององค์กร |
| Deploy | Vercel (web) · Render (api) |

## เริ่มต้นใช้งาน

ต้องมี Node.js 20+ และ npm (CI รันบน node 20)

### `apps/api`

```bash
cd apps/api
npm install
cp .env.example .env   # เติมค่าจริงจาก Supabase dashboard (คัดลอกมา ห้ามพิมพ์เอง)
npx prisma generate
npm run build          # ต้อง exit 0
npm run start:dev
```

ยังไม่มีฐานข้อมูล → endpoint ที่ query จริงจะ error แต่เซิร์ฟเวอร์ต้อง boot ขึ้นได้ตามปกติ
ตัวตรวจงานคือ 4 gate: `npm run build` · `npx tsc --noEmit` · `npx eslint src prisma` · `npm test`

`.env.example` เป็นรายการตัวแปรที่เชื่อถือได้ ตัวที่มักพลาดคือ **VAPID สามตัวต้องตั้งครบพร้อมกัน
หรือไม่ตั้งเลย** (validation ใช้ `.and()`) ถ้าไม่ตั้ง push จะเงียบไปเฉย ๆ ไม่ error และ
**`SUPABASE_JWKS_URL` กับ `SUPABASE_JWT_SECRET` ต้องมีอันเดียวเท่านั้น** (`.xor()`) ตั้งทั้งคู่แล้ว
boot ไม่ขึ้นโดยตั้งใจ — เหตุผลเต็มอยู่ใน AGENTS.md §9

### `apps/web`

```bash
cd apps/web
npm install
cp .env.example .env.local   # Next.js อ่านไฟล์นี้ ไม่ใช่ .env
npm run dev                  # http://localhost:3000
```

`.env.local` มีสี่ตัวแปร (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`) ทั้งหมดขึ้นต้นด้วย `NEXT_PUBLIC_`
จึงถูกฝังลงใน bundle ที่ผู้ใช้โหลดได้ **ห้ามใส่ `SUPABASE_SERVICE_ROLE_KEY` ลงไปเด็ดขาด** — คีย์นั้น
ข้าม row-level security ทั้งหมดและเป็นของฝั่ง backend เท่านั้น (§7, §14.3)

ไม่ตั้งตัวแปร Supabase ก็ต้อง build ผ่าน — Supabase client ถูกสร้างแบบ lazy ตอนผู้ใช้กดใช้งานจริง ไม่ใช่ตอน import
CI ตั้งให้แค่ `NEXT_PUBLIC_API_URL` ตัวเดียว ถ้าหน้าไหนพังตอน build เพราะไม่มีตัวแปร แปลว่าโค้ดผิด ไม่ใช่ config ผิด

ตัวตรวจงานฝั่งนี้คือ 3 gate: `npm run build` · `npx tsc --noEmit` · `npx next lint`
(ไม่มี `npm test` — `apps/web` ไม่มี test script ตาม `.github/workflows/ci.yml` job `web`)

---

ขั้นตอนตั้งค่า Supabase, ตัวแปร environment ทุกตัว, การรัน migration และการ apply ไฟล์ SQL เสริมด้วย `psql` อยู่ใน [`AGENTS.md`](./AGENTS.md) — §9, §12 หัวข้อ "Raw SQL" และ Definition of Done

## สถานะระบบปัจจุบัน

สรุป capability ระดับสูงจากการสำรวจ controller/module จริงใน `apps/api/src` และหน้าใน `apps/web/app`
— ไม่ใช่ % ความคืบหน้าหรือ deadline (ของพวกนั้นอยู่ใน Jira ตามด้านบน)

- **Auth / onboarding** — เข้าสู่ระบบด้วย Supabase Auth (Email OTP / magic link), backend ตรวจ JWT ด้วย `jose` แล้ว provision `app_user` ให้อัตโนมัติในครั้งแรกที่เห็น token (role เริ่มต้น VENDOR) · หลังยืนยัน OTP ระบบเด้งตาม role ที่อ่านจากฐานข้อมูล — SUPER_ADMIN ไป `/super-admin`, ORG_ADMIN ไป `/admin/bookings`, VENDOR ไปหน้าหลัก · บัญชีที่ติดแบล็กลิสต์ถูก sign out ทันทีพร้อมข้อความที่ไม่บอกเหตุผล (เหตุผลเป็นข้อมูลฝั่งแอดมิน)
- **Booking flow** — ครบวงจร: เลือกบูธ → ล็อกบูธทันทีด้วยสถานะ `PENDING_PAYMENT` (hold 5 นาที) → เห็น PromptPay QR ที่ API สร้างให้จาก `promptpayId` ขององค์กร → อัปโหลดสลิป → เรียก SlipOK จริง (provider `slipok` implement แล้ว ไม่ใช่ stub) → ยืนยันอัตโนมัติเมื่อสลิปผ่าน → ยกเลิกได้ทั้งฝั่งผู้ขายและ org admin → hold ที่หมดอายุถูกยกเลิกอัตโนมัติทุกนาทีโดย scheduled job → มีเส้นทางยกเว้นค่าเช่าสำหรับ org admin (`isPaymentExempt`)
- **Event lifecycle และค่าบริการ** — org admin สร้างอีเวนต์เป็น DRAFT พร้อมใบเสนอราคาค่าบริการที่คำนวณจาก `platform_config` (base + จำนวนโซน + จำนวนวัน แล้ว clamp ด้วย min/max) → เผยแพร่ → ปิด → เปิดใหม่ → ลบได้เฉพาะอีเวนต์ที่ยังไม่มีการจอง · แต่ละอีเวนต์มี slug สาธารณะสำหรับแชร์ลิงก์ผัง
- **Admin (ORG_ADMIN)** — 11 หน้าใน `/admin`: ภาพรวม, อีเวนต์, การจอง, กู้คืนการจองที่ค้าง, โซนและบูธ, ออกแบบผัง, ผู้ขาย, การชำระเงิน/คืนเงิน (ดูและดาวน์โหลดสลิปได้), รีวิว, ประกาศ, ตั้งค่าองค์กร · แก้โควตาการจองได้เมื่อ SUPER_ADMIN มอบสิทธิ์ให้ · ส่งคำร้องถึง SUPER_ADMIN ได้จากเมนูช่วยเหลือ
- **Super admin** — 9 หน้าใน `/super-admin` ที่ต่อ API จริงครบ (ภาพรวม, องค์กร, แอดมินองค์กร, ผู้ใช้, การจอง/การเงิน, เคสช่วยเหลือและ moderation, ประกาศ, audit log, ตั้งค่าแพลตฟอร์ม) + กระดิ่งแจ้งเตือนใน shell (SCRUM-147) · เมนูที่ยังเป็น placeholder "เร็วๆ นี้" เหลือ 3 อัน (Package และ Billing, สถานะระบบ, บทบาทและสิทธิ์)
- **Audit log** — มีแล้ว (`audit-logs/`, อ่านได้เฉพาะ SUPER_ADMIN, กรองตาม action / ผู้ทำได้) ปัจจุบันบันทึก 7 การกระทำจาก 2 ไฟล์: 6 อันจาก `organizations.service.ts` (สร้างองค์กร, เปลี่ยนสถานะองค์กร, มอบ/ถอนสิทธิ์ ORG_ADMIN, เปลี่ยนสิทธิ์แก้โควตา, เปลี่ยนค่าโควตา) และ 1 อันจาก `platform-config.service.ts` (แก้สูตรราคา)
- **Trust score / blacklist** — ผู้ขายเริ่มที่ 100 คะแนน แต่ละแต้มโทษ**หัก**ออกตามเหตุผล (20/15/30/10/5 ปรับได้) clamp ที่ 0 และเมื่อคะแนนแตะ 0 ระบบตั้ง `isBlacklisted` ให้ในทรานแซกชันเดียวกัน แล้วแจ้งเตือนผู้ขายพร้อมคะแนนคงเหลือ — SCRUM-142 แทนที่ระบบ "สะสมครบ 3 แต้ม" เดิมทั้งหมด
- **Review** — ผู้ขายรีวิวได้หลังจบงาน มี endpoint ดูค่าเฉลี่ยแบบ public และหน้าสรุปคะแนนฝั่ง org admin
- **Notification / push** — แจ้งเตือนในแอปพร้อมตัวกรองตามประเภทและสถานะอ่าน + **web push จริง** ผ่าน `web-push` + VAPID (SCRUM-27) ทั้งฝั่ง backend (`PushSenderService`, `push-subscriptions/`) และฝั่ง PWA (`public/push-sw.js` จัดการ event `push` / `notificationclick`) · SUPER_ADMIN ส่งประกาศกลางถึงทุกคนได้ (SCRUM-82) และผู้ใช้เห็นเป็นแบนเนอร์ที่ปิดแล้วจำได้
- **PWA** — next-pwa เปิดใช้ในบิลด์ production · response ของ API ที่มีเฮดเดอร์ `Authorization` ถูกบังคับเป็น `NetworkOnly` เพื่อกันข้อมูลของบัญชีหนึ่งค้างให้อีกบัญชีเห็นบนเครื่องเดียวกัน (SCRUM-101) · chunk ของหน้า `/admin` และ `/super-admin` กับรูปอ้างอิงขนาดใหญ่ถูกตัดออกจาก precache (SCRUM-102)
- **AI** — สองผิว: แนะนำโซน/บูธ (rule + Gemini พร้อม fallback อัตโนมัติ บันทึกลง `recommendation_log` ทุกครั้ง) และแชตช่วยเหลือแบบต่อบทสนทนา (SCRUM-109) ที่เห็นเฉพาะข้อมูลของผู้ถามเอง — **ทั้งสองยังไม่ได้ทดสอบ end-to-end กับข้อมูลจริงจาก production**
- **ความปลอดภัยที่ปิดไปในรอบนี้** — quota exception ข้ามองค์กร (SCRUM-120), การกดอนุมัติ quota exception พร้อมกัน (SCRUM-121), policy ที่ยอมให้ client ที่ล็อกอินอัปโหลดเข้าบัคเก็ต `slips` โดยตรง (SCRUM-122 — ไฟล์ SQL อยู่ใน `prisma/sql/` ต้อง apply เอง), ข้อความ error ของ Prisma หลุดลง log (SCRUM-123) และ transitive dependency ที่มีช่องโหว่ (SCRUM-103, แก้เฉพาะ lockfile)

### ข้อจำกัดที่รู้อยู่

- ไฟล์ใน `prisma/sql/` **ไม่มีอะไรรันให้อัตโนมัติ** จนกว่าจะมีคนรัน `psql` เอง — จนถึงตอนนั้น partial unique index กัน double-booking ยังบังคับด้วย service code อย่างเดียว และ policy อัปโหลดสลิปเดิมยังอยู่บน Supabase
- **ไม่มี endpoint สร้าง/แก้/ลบ venue** และ **ไม่มี endpoint แก้ไขรายละเอียดอีเวนต์** — เมธอดในเซอร์วิสมีอยู่ แต่ยังไม่มี route ไหนเรียก
- สวิตช์ "ตั้งค่าการแจ้งเตือน" ในหน้า `/notifications` ยังเป็น UI อย่างเดียว ไม่ได้บันทึกไว้ที่ไหนและไม่มีผลกับการส่งจริง
- push ทำงานเมื่อ `VAPID_*` ครบสามตัวเท่านั้น ถ้าไม่ตั้งจะเงียบโดยไม่มี error · fan-out ของ announcement เขียน notification ในแอปอย่างเดียว ไม่ส่ง push
- `prisma/seed.ts` ยังเป็น typed stub (SCRUM-22) — ประกาศลำดับ insert ที่ปลอดภัยกับ FK ไว้ แต่ยังไม่ใส่ข้อมูล

## ทีม

| ชื่อ | รหัส | รับผิดชอบ |
|---|---|---|
| ซีบิว — วิธวินท์ ระวังจังหรีด | B6703165 | Frontend, AI Integration, Testing |
| บุ๊ค — ชิติพัทธ์ สีสุด | B6703271 | Product Owner, Scrum Master, Backend |
| ปอนด์ — วรรนเรศ ขุมพลกรัง | B6728120 | Backend, Database |

กติกาการพัฒนา, invariants, booking flow, auth flow และกติกาความปลอดภัยทั้งหมดอยู่ใน
**[`AGENTS.md`](./AGENTS.md)** — อ่านให้จบก่อนเขียนโค้ด เป็นไฟล์เดียวกับที่ AI agent ทุกตัวอ่าน
เอกสารออกแบบ (Master Spec, ERD, Design System Brief) เก็บนอก repo — ขอได้จาก Product Owner (บุ๊ค)
