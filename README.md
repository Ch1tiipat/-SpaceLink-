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
│  │  ├─ migrations/            2 migrations — ปัจจุบัน 27 โมเดล 18 enum
│  │  └─ sql/                   booking_active_event_booth_unique.sql — partial unique index
│  │                            กัน double-booking, Prisma ประกาศเองไม่ได้ ต้อง apply เองด้วย
│  │                            psql หลัง migrate (AGENTS.md §12)
│  └─ src/                      24 โฟลเดอร์ — รายละเอียด "ทำอะไรได้จริง" แต่ละอันอยู่หัวข้อถัดไป
│     ├─ auth/                  JWT guard + JIT provisioning · GET /auth/me
│     ├─ users/                 SUPER_ADMIN: list/detail/last-login/audit trail · ทุก role: PATCH /users/me
│     ├─ organizations/         CRUD องค์กร + มอบ/ถอนสิทธิ์ ORG_ADMIN (log เข้า audit-logs)
│     ├─ venues/                CRUD ผังสถานที่ (ORG_ADMIN+)
│     ├─ zones/                 CRUD โซน (ORG_ADMIN+, ลบไม่ได้ถ้ามีบูธเคยถูกจอง)
│     ├─ booths/                CRUD บูธ (ORG_ADMIN+, กติกาลบเหมือน zones)
│     ├─ events/                CRUD อีเวนต์ + /discovery (public) + /map (ผัง+สถานะบูธ+tier)
│     ├─ categories/            หมวดสินค้า — public, อ่านอย่างเดียว
│     ├─ bookings/              จองบูธ, auto-confirm ผ่านสลิป, ยกเลิก, ยกเว้นค่าเช่า, hold-expiry cron
│     ├─ slips/                 internal — เรียก SLIP_VERIFIER แล้วบันทึกผลทุกครั้ง (มี README เอง)
│     ├─ refunds/               คำร้องคืนเงิน PENDING → APPROVED → PROCESSED / REJECTED
│     ├─ reviews/               รีวิวหลังจบงาน (ต้องมี booking จริง + เว้น 17 ชม.)
│     ├─ shops/                 ร้านค้า 1 ร้าน/vendor ไม่ผูกองค์กร
│     ├─ notifications/         แจ้งเตือนในแอป (ยังไม่มี push จริง)
│     ├─ announcements/         ประกาศ + fan-out แจ้งเตือนให้ vendor ที่มี booking ในองค์กร
│     ├─ penalties/             แต้มโทษ + auto-blacklist เมื่อสะสมครบ 3 แต้ม
│     ├─ support-tickets/       แจ้งปัญหา + ขอยกเว้นโควตา (อนุมัติ = สร้าง booking ให้จริง)
│     ├─ audit-logs/            SUPER_ADMIN อ่านอย่างเดียว — ปัจจุบัน log แค่ 4 action
│     ├─ ai/                    แนะนำบูธ — rule-based + Gemini พร้อม fallback (มี README เอง)
│     ├─ dashboard/             สรุปตัวเลของค์กร (ORG_ADMIN+)
│     ├─ health/                GET /health, /health/db — ไม่ต้อง auth
│     ├─ prisma/                PrismaService (lazy connect)
│     ├─ common/                decorators + exception filter ร่วม (ไม่ใช่ NestJS module)
│     └─ config/                ตรวจ env ตอน boot (ไม่ใช่ NestJS module)
├─ apps/web/                    Next.js 14 App Router PWA → Vercel
│  ├─ app/                      layout.tsx · globals.css · page.tsx (หน้าค้นหา Event) — หน้า user ทั่วไป
│  │  ├─ login/ · register/     เข้าสู่ระบบ / สมัครสมาชิก ด้วย Email OTP
│  │  ├─ events/[eventId]/      รายละเอียดอีเวนต์ · `/map` ผังโซนและบูธ · `/book` จองบูธ
│  │  ├─ bookings/              รายการจองของตัวเอง · `[bookingId]` รายละเอียด ·
│  │  │                         `/payment` อัปโหลดสลิป · `/review` รีวิวหลังจบงาน
│  │  ├─ notifications/         แจ้งเตือนในแอป
│  │  ├─ profile/               โปรไฟล์ผู้ขาย + ร้านค้า
│  │  ├─ help/                  ศูนย์ช่วยเหลือ — แจ้งปัญหา (support ticket)
│  │  ├─ admin/                 หน้า ORG_ADMIN — คนละ shell คนละ route tree กับ super-admin/
│  │  │  ├─ dashboard/          สรุปตัวเลขภาพรวมองค์กร
│  │  │  ├─ organization/       ตั้งค่าองค์กร
│  │  │  ├─ zones/              จัดการโซน / บูธ
│  │  │  ├─ map-designer/       ออกแบบผังสถานที่
│  │  │  ├─ bookings/           กู้คืน/จัดการการจองที่ค้าง · ยืนยันแบบยกเว้นค่าเช่า
│  │  │  └─ announcements/      ประกาศถึงผู้ขาย
│  │  └─ super-admin/           หน้า SUPER_ADMIN เท่านั้น — SuperAdminShell แยกทั้งชุด (SCRUM-89/PR #66)
│  │     ├─ page.tsx            ภาพรวม (dashboard ข้ามทุกองค์กร) — ใช้งานได้จริง
│  │     └─ organizations/      จัดการองค์กรทั้งหมดในระบบ — ใช้งานได้จริง (Phase 1 มีแค่ 2 หน้านี้
│  │                            ที่เหลือในเมนู SuperAdminShell เป็น placeholder "เร็วๆ นี้")
│  ├─ components/               ส่วนจอต่อหน้า — auth, booking flow, admin/super-admin screens ฯลฯ
│  │                            (23 ไฟล์ + components/super-admin/ อีก 3 ไฟล์)
│  ├─ lib/                      api.ts · supabase.ts · use-auth-state.ts · use-email-otp.ts ·
│  │                            use-vendor-profile.ts · event-booking-rules.ts
│  └─ public/                   icon.svg · manifest.webmanifest
├─ prototype/                   prototype เดิม ใช้อ้างอิงเท่านั้น ห้ามแก้
├─ .github/                     CI workflow + CODEOWNERS
└─ AGENTS.md · CLAUDE.md · README.md
```

แต่ละ app แยกกันสมบูรณ์ ไม่ใช่ npm workspaces ต้อง `cd` เข้าโฟลเดอร์ก่อนรัน npm ทุกครั้ง

`/admin` (ORG_ADMIN) กับ `/super-admin` (SUPER_ADMIN) เป็น **คนละ route tree คนละ shell กันโดย
ตั้งใจ** ไม่ใช่ share กัน — `app-shell.tsx` เช็ค `isSuperAdminRoute` แล้ว bypass ตัวเองทันที
(`if (isSuperAdminRoute) return <>{children}</>`) ปล่อยให้ `super-admin/layout.tsx` ครอบด้วย
`SuperAdminShell` แยกทั้งชุดแทน ซึ่งมี guard เช็ค `auth.role !== 'SUPER_ADMIN'` ของตัวเอง (เด้งออก
ถ้าไม่ใช่) มาจาก PR #66 / SCRUM-89 ที่เพิ่ง merge เข้า `main`

แต่ SCRUM-89 Phase 1 ทำแค่ 2 หน้า — ภาพรวม (`/super-admin`) กับจัดการองค์กร
(`/super-admin/organizations`) — เมนูที่เหลือใน `SuperAdminShell` (ผู้ดูแลองค์กร, ผู้ใช้งาน,
บทบาทและสิทธิ์, ตั้งค่าแพลตฟอร์ม) เป็น placeholder "เร็วๆ นี้" ไม่มี route จริงข้างหลัง ดังนั้น
endpoint ฝั่ง backend ที่เป็น SUPER_ADMIN-only แบบข้ามองค์กรส่วนใหญ่ (`users/`, `audit-logs/`,
และ `GET .../all` ของ penalties, refunds, support-tickets, announcements, bookings)
**ยังไม่มีหน้าเว็บของตัวเอง** — เรียกได้จาก API โดยตรงเท่านั้นตอนนี้

## โมดูลใน `apps/api/src/` — ทำอะไรได้จริง

สรุปจากการอ่าน controller/service จริงทุกโมดูล ไม่ใช่แค่ endpoint list — กติกาฉบับเต็มอยู่ใน
[`AGENTS.md`](./AGENTS.md)

### ผู้ใช้และสิทธิ์

- **`auth/`** — endpoint เดียวคือ `GET /auth/me` คืนโปรไฟล์ + ร้านค้า + องค์กรที่เป็นสมาชิก ไม่มี
  register/login/logout ในนี้ (ผู้ใช้ auth ผ่าน Supabase โดยตรง) `SupabaseAuthGuard` ตรวจ JWT แล้ว
  **JIT-provision** แถว `app_user` ให้อัตโนมัติในครั้งแรกที่เห็น `auth_user_id` — role เริ่มต้น
  เป็น VENDOR เสมอ ไม่มีทางตั้งเป็น admin จาก token ได้
- **`users/`** — SUPER_ADMIN เท่านั้นดูรายชื่อ/รายละเอียดผู้ใช้ทั้งหมดได้ (`GET /users`,
  `GET /users/:id` พร้อมประวัติการจอง/คืนเงิน/แต้มโทษ/ตั๋วปัญหาของคนนั้น), ดู last-login จริงจาก
  Supabase Auth Admin API (`GET /users/:id/last-login`) และดู audit log ที่ผู้ใช้คนนั้นเป็นคนทำ
  (`GET /users/:id/audit-logs`) ทุก role แก้โปรไฟล์ตัวเองได้ผ่าน `PATCH /users/me` เท่านั้น

### แกนหลัก — องค์กร, สถานที่, โซน, บูธ, อีเวนต์

- **`organizations/`** — SUPER_ADMIN สร้าง/แก้/เปลี่ยนสถานะองค์กร และมอบ/ถอนสิทธิ์ ORG_ADMIN ให้
  ผู้ใช้ได้ การมอบสิทธิ์เปลี่ยน `UserRole` ของผู้ใช้จาก VENDOR เป็น ORG_ADMIN ให้อัตโนมัติ (และ
  เปลี่ยนกลับเป็น VENDOR เมื่อถอน membership องค์กรสุดท้ายที่เหลือ) ทั้ง 4 การกระทำนี้เป็น 4
  action เดียวที่ถูกบันทึกลง audit log ในระบบตอนนี้
- **`venues/`** — CRUD ผังสถานที่ (ORG_ADMIN+) แต่ละ venue ผูกกับ 1 องค์กร ใช้ซ้ำได้หลายอีเวนต์
- **`zones/`** — CRUD โซนในผัง (ORG_ADMIN+) ลบไม่ได้ถ้ายังมีบูธที่เคยมี booking ผูกอยู่ แม้ booking
  นั้นจะถูกยกเลิกไปแล้วก็ตาม (กันด้วย FK restrict แล้วแปล error เป็นภาษาไทยให้)
- **`booths/`** — CRUD บูธ (ORG_ADMIN+) กติกาการลบเหมือน zones ทุกประการ
- **`events/`** — สร้าง/แก้ไขอีเวนต์ (ORG_ADMIN+) `GET /events/discovery` เป็นหน้ารวมอีเวนต์แบบ
  public (เฉพาะสถานะ PUBLISHED/ONGOING) `GET /events/:id/map` คืนผังโซน+บูธพร้อมสถานะ
  AVAILABLE/HELD/BOOKED/UNAVAILABLE ต่อบูธ และคำนวณ tier บูธ (S/A/B/C) จากราคาแบบ derived สด
  ไม่เก็บลง DB
- **`categories/`** — หมวดสินค้า public อ่านอย่างเดียว ใช้ตอนสร้างร้านค้าและตอนขอคำแนะนำโซน

### การจองและการชำระเงิน

- **`bookings/`** — หัวใจของระบบ `POST /bookings` ล็อกบูธด้วย serializable transaction (กัน
  race condition ตอนจองพร้อมกัน retry อัตโนมัติสูงสุด 3 ครั้งถ้าเจอ write conflict) เช็คครบทุก
  invariant ในทีเดียว — venue ของบูธตรงกับ venue ของอีเวนต์, ช่วงวันที่จองอยู่ในช่วงอีเวนต์, บูธ
  ว่างจริง, ไม่เกิน quota ต่ออีเวนต์ (อ่านจาก org_config ก่อน ตกไป platform_config), ผู้ใช้ไม่ติด
  แบล็กลิสต์ — สำเร็จแล้วตั้งสถานะ `PENDING_PAYMENT` พร้อม hold 5 นาที · `POST /bookings/:id/slip`
  เรียก `SlipVerificationService` แล้ว **auto-confirm เป็น `CONFIRMED` ทันที** ถ้ายอดตรงกับราคาบูธ
  และสถานะเป็น VERIFIED — ไม่ต้องรอ admin กดอนุมัติ · `PATCH /bookings/:id/cancel` ยกเลิกได้เฉพาะ
  ก่อนถึงวันเริ่มอีเวนต์ · `PATCH /bookings/:id/confirm-exempt` (ORG_ADMIN+) ยืนยันแบบยกเว้น
  ค่าเช่าโดยข้าม slip ไปเลย · มี `createForAdmin()` แยกไว้ให้ `support-tickets/` เรียกตอนอนุมัติ
  quota exception — ข้ามได้แค่ quota อย่างเดียว invariant อื่นทุกตัวยังเช็คครบเหมือนเดิม
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

- **`shops/`** — vendor สร้างร้านได้ 1 ร้านต่อบัญชีเท่านั้น (`POST /shops`) แก้ไขและอัปโหลดโลโก้
  ผ่าน `/shops/me` ซึ่ง resolve ร้านจาก token ที่ login ไม่รับ id ร้านจาก client เลย ร้านค้าไม่ผูก
  กับองค์กรใดองค์กรหนึ่ง (เป็นของ vendor โดยตรง)

### แจ้งเตือนและสื่อสาร

- **`notifications/`** — แจ้งเตือนในแอปเท่านั้น (list, unread count, mark-all-read) ถูกยิงจากหลาย
  module อื่น (booking, penalty, refund, announcement, support ticket) การสร้าง notification เป็น
  best-effort เสมอ — เขียนไม่สำเร็จก็ไม่ทำให้ flow หลัก (เช่นการจอง) ล้มตาม **ยังไม่มี push
  notification จริง** — `web-push`/VAPID ที่ระบุไว้ใน tech stack ยังไม่มีโค้ดรองรับเลย
- **`announcements/`** — ORG_ADMIN+ ประกาศถึงผู้ขาย ประกาศที่ active (ทั้งตอนสร้างและตอนเปลี่ยน
  จาก draft เป็น active) จะ fan-out เป็น notification ให้ vendor ทุกคนที่มี booking ที่ยังไม่ถูก
  ยกเลิกและอีเวนต์ยังไม่จบในองค์กรนั้นโดยอัตโนมัติ SUPER_ADMIN ดูข้ามองค์กรได้ที่
  `GET /announcements/all`

### การกำกับดูแล (governance)

- **`penalties/`** — ORG_ADMIN+ ออกแต้มโทษผูกกับ booking ได้ (เหตุผลให้เลือก: ไม่มาตามนัด, ทำผิด
  กติกาการใช้พื้นที่, ผิดสัญญา, ได้รีวิวไม่ดี, อื่นๆ) **auto-blacklist ทันทีที่แต้มสะสมของผู้ใช้คน
  นั้นถึง 3 แต้มรวมทุกองค์กร** (`isBlacklisted` เป็น cache ที่คำนวณใหม่ทุกครั้งที่ออกแต้มโทษ ไม่ใช่
  source of truth) ผู้ใช้ที่ติดแบล็กลิสต์จองบูธใหม่ไม่ได้ทันที SUPER_ADMIN ดูภาพรวมข้ามองค์กรได้ที่
  `GET /penalties/all`
- **`support-tickets/`** — vendor แจ้งปัญหาทั่วไป และเป็นช่องทางขอ "ยกเว้นโควตา" เมื่อจองครบโควตา
  ต่ออีเวนต์แล้ว (ไม่มี field โครงสร้างสำหรับคำขอนี้โดยเฉพาะ เพราะ schema freeze แล้ว — vendor
  เขียนอธิบายเป็นข้อความ, admin อ่านแล้วอนุมัติเองโดยระบุ event/booth ที่จะสร้างให้) การอนุมัติเรียก
  `BookingsService.createForAdmin` สร้าง booking จริงให้ทันที (ข้ามแค่ quota, invariant อื่นเช็ค
  ครบเหมือน booking ปกติ) SUPER_ADMIN ดูตั๋วข้ามองค์กรได้ที่ `GET /support-tickets/all`
- **`audit-logs/`** — อ่านได้เฉพาะ SUPER_ADMIN บันทึกแบบ best-effort (เขียนไม่สำเร็จไม่ทำให้ action
  หลักล้มตาม) **ปัจจุบันมีแค่ 4 action ที่ถูกเรียกจริงในโค้ด ทั้งหมดมาจาก
  `organizations.service.ts` เพียงไฟล์เดียว**: สร้างองค์กร, เปลี่ยนสถานะองค์กร, มอบสิทธิ์
  ORG_ADMIN, ถอนสิทธิ์ ORG_ADMIN — โมดูลอื่นทั้งหมดยังไม่มีการเรียกบันทึก audit log เลย

### AI

- **`ai/`** — `POST /events/:eventId/recommendations` แนะนำบูธให้ vendor ตามหมวดสินค้าของร้าน
  (หรือหมวดที่ระบุเอง ถ้าระบุต้องเป็นหมวดของร้านตัวเองเท่านั้น ห้ามสอดแนมร้านอื่น) มี provider 2
  แบบเลือกด้วย `ZONE_RECOMMENDER=rule|gemini`: `rule` คำนวณจากหมวดสินค้าที่ตรงกันและราคากลาง
  ใช้งานออฟไลน์ได้ไม่พึ่งบริการภายนอก, `gemini` ใช้ Flash/Flash-Lite เท่านั้น (ปฏิเสธ Pro ตั้งแต่
  boot) ส่ง prompt เฉพาะรหัสบูธ/ชื่อโซน/ราคา/หมวดสินค้า ไม่มีข้อมูลส่วนตัวใดๆ
  `ZoneRecommendationService` ครอบทุก provider ด้วย timeout 5 วินาที + ตรวจรูปแบบผลลัพธ์ +
  ตรวจว่าบูธที่แนะนำจองได้จริงในอีเวนต์นั้น ผิดเงื่อนไขไหนก็ fallback เป็น rule-based ให้อัตโนมัติ
  แล้วบันทึกทุกครั้งลง `recommendation_log` พร้อม source ที่ตอบจริง (ไม่ใช่ provider ที่ตั้งค่าไว้)

### Admin overview

- **`dashboard/`** — `GET /organizations/:id/dashboard-summary` (ORG_ADMIN+) สรุปตัวเลของค์กร:
  จำนวน booking แยกตามสถานะ (รอชำระ/ยืนยันแล้ว/ยกเลิก), จำนวน venue/zone/booth, จำนวนอีเวนต์ที่
  publish แล้วและที่ยังไม่ถึงวันเริ่ม

### Infrastructure (ไม่มี controller / ไม่ใช่ business module)

- **`prisma/`** — `PrismaService` เชื่อมต่อ DB แบบ lazy (ต่อครั้งแรกที่มี query จริง ไม่ใช่ตอน boot)
- **`common/`** — decorators ที่ใช้ร่วมกันทั้งระบบ (`@CurrentUser`, `@CurrentOrgId`, `@Roles`) และ
  exception filter กลางที่แปล Prisma error code เป็น HTTP response
- **`config/`** — ตรวจ environment variables ให้ครบตอน boot ตาม `env.validation.ts`
- **`health/`** — `GET /health`, `GET /health/db` — ไม่ต้อง auth (สำหรับ hosting health check)

รายการนี้สรุปพฤติกรรมหลักที่อ่านจากโค้ดวันนี้ ไม่ใช่ spec ฉบับเต็ม — guard/role ที่แท้จริงของแต่ละ
endpoint ต้องเปิด controller ดูเองก่อนแก้โค้ดเสมอ

## Tech stack

| ส่วน | ใช้อะไร |
|---|---|
| Frontend | Next.js 14 (App Router), React, Tailwind CSS, next-pwa, SVG zone map |
| Backend | NestJS (TypeScript) REST · Prisma · PostgreSQL (Supabase Pro) |
| Supabase | Auth — Email OTP / magic link (NestJS verify token ด้วย `jose`) · Storage (สลิป, รูปผัง) |
| บริการภายนอก | Gemini **Flash / Flash-Lite เท่านั้น ห้ามใช้ Pro** · SlipOK (OK BASIC) · web-push |
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

### `apps/web`

```bash
cd apps/web
npm install
cp .env.example .env.local   # Next.js อ่านไฟล์นี้ ไม่ใช่ .env
npm run dev                  # http://localhost:3000
```

`.env.local` มีสามตัวแปร ทั้งหมดขึ้นต้นด้วย `NEXT_PUBLIC_` จึงถูกฝังลงใน bundle ที่ผู้ใช้โหลดได้
**ห้ามใส่ `SUPABASE_SERVICE_ROLE_KEY` ลงไปเด็ดขาด** — คีย์นั้นข้าม row-level security ทั้งหมดและเป็นของฝั่ง backend เท่านั้น (§7, §14.3)

ไม่ตั้งตัวแปร Supabase ก็ต้อง build ผ่าน — Supabase client ถูกสร้างแบบ lazy ตอนผู้ใช้กดใช้งานจริง ไม่ใช่ตอน import
CI ตั้งให้แค่ `NEXT_PUBLIC_API_URL` ตัวเดียว ถ้าหน้าไหนพังตอน build เพราะไม่มีตัวแปร แปลว่าโค้ดผิด ไม่ใช่ config ผิด

ตัวตรวจงานฝั่งนี้คือ 3 gate: `npm run build` · `npx tsc --noEmit` · `npx next lint`
(ไม่มี `npm test` — `apps/web` ไม่มี test script ตาม `.github/workflows/ci.yml` job `web`)

---

ขั้นตอนตั้งค่า Supabase, ตัวแปร environment ทุกตัว, การรัน migration และการ apply ไฟล์ SQL เสริมด้วย `psql` อยู่ใน [`AGENTS.md`](./AGENTS.md) — §9, §12 หัวข้อ "Raw SQL" และ Definition of Done

## สถานะระบบปัจจุบัน

สรุป capability ระดับสูงจากการสำรวจ controller/module จริงใน `apps/api/src` และหน้าใน `apps/web/app`
— ไม่ใช่ % ความคืบหน้าหรือ deadline (ของพวกนั้นอยู่ใน Jira ตามด้านบน)

- **Auth / onboarding** — เข้าสู่ระบบด้วย Supabase Auth (Email OTP / magic link), backend ตรวจ JWT ด้วย `jose` แล้ว provision `app_user` ให้อัตโนมัติในครั้งแรกที่เห็น token (role เริ่มต้น VENDOR)
- **Booking flow** — ครบวงจร: เลือกบูธ → ล็อกบูธทันทีด้วยสถานะ `PENDING_PAYMENT` (hold 5 นาที) → อัปโหลดสลิป → เรียก SlipOK จริง (provider `slipok` implement แล้ว ไม่ใช่ stub) → ยืนยันอัตโนมัติเมื่อสลิปผ่าน → ยกเลิกได้ทั้งฝั่งผู้ขายและ org admin → hold ที่หมดอายุถูกยกเลิกอัตโนมัติทุกนาทีโดย scheduled job → มีเส้นทางยกเว้นค่าเช่าสำหรับ org admin (`isPaymentExempt`)
- **Admin / super-admin** — จัดการองค์กร (สร้าง, เปลี่ยนสถานะ, มอบ/ถอนสิทธิ์ ORG_ADMIN), venue/zone/booth, event, สรุปตัวเลขภาพรวมองค์กร (dashboard), กู้คืน/จัดการการจองที่ค้าง, อนุมัติคำร้องคืนเงิน, จัดการตั๋วปัญหาและ quota exception, ดูแต้มโทษ/แบล็กลิสต์รวมทุกองค์กร (SUPER_ADMIN)
- **Audit log** — มีแล้ว (`audit-logs/`, อ่านได้เฉพาะ SUPER_ADMIN) แต่ปัจจุบันบันทึกเฉพาะ 4 การกระทำของ org admin: สร้างองค์กร, เปลี่ยนสถานะองค์กร, มอบสิทธิ์ ORG_ADMIN, ถอนสิทธิ์ ORG_ADMIN
- **Penalty / blacklist** — สะสมแต้มโทษต่อผู้ขาย แล้ว auto-blacklist เมื่อถึงเกณฑ์ (`isBlacklisted` เป็น cache ที่คำนวณจาก `penalty.points` เสมอ ตาม AGENTS.md §6.3.5)
- **Review** — ผู้ขายรีวิวได้หลังจบงาน มี endpoint ดูค่าเฉลี่ยแบบ public
- **Notification** — แจ้งเตือนในแอปเท่านั้น (list, unread count, mark-all-read) — ยังไม่มี push notification จริง (`web-push` + VAPID ที่ระบุใน tech stack ยังไม่ถูกติดตั้งในโค้ด)
- **AI zone recommendation** — implement แล้วทั้ง rule-based และ Gemini (Flash/Flash-Lite เท่านั้น ปฏิเสธ Pro ตั้งแต่ boot) พร้อม fallback อัตโนมัติกลับไป rule-based เมื่อ Gemini timeout/quota หมด/ตอบผิดรูป และบันทึกทุกครั้งลง `recommendation_log` — แต่ยังไม่ได้ทดสอบ end-to-end กับข้อมูลจริงจาก production

## ทีม

| ชื่อ | รหัส | รับผิดชอบ |
|---|---|---|
| ซีบิว — วิธวินท์ ระวังจังหรีด | B6703165 | Frontend, AI Integration, Testing |
| บุ๊ค — ชิติพัทธ์ สีสุด | B6703271 | Product Owner, Scrum Master, Backend |
| ปอนด์ — วรรนเรศ ขุมพลกรัง | B6728120 | Backend, Database |

กติกาการพัฒนา, invariants, booking flow, auth flow และกติกาความปลอดภัยทั้งหมดอยู่ใน
**[`AGENTS.md`](./AGENTS.md)** — อ่านให้จบก่อนเขียนโค้ด เป็นไฟล์เดียวกับที่ AI agent ทุกตัวอ่าน
เอกสารออกแบบ (Master Spec, ERD, Design System Brief) เก็บนอก repo — ขอได้จาก Product Owner (บุ๊ค)
