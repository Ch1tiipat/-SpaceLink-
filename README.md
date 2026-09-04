# SpaceLink

แพลตฟอร์มกลางจองพื้นที่ขายของและจัดกิจกรรม — Multi-tenant SaaS PWA · องค์กร (ตลาด / ห้าง / หน่วยงาน) สมัครเป็นผู้เช่าระบบ ออกแบบผังสถานที่ เปิดอีเวนต์ แล้วผู้ขายเลือกบูธ จอง แนบสลิป และได้รับการยืนยันอัตโนมัติ

> **โครงงานรายวิชา 1101910 โครงงานเทคโนโลยีดิจิทัล-1** · Software Engineering · 1/2569 · นำเสนอ 12–16 ตุลาคม 2569
> **กติกาการพัฒนาทั้งหมดอยู่ใน [`AGENTS.md`](./AGENTS.md)** · **สถานะงานอยู่ที่ Jira** ไม่เก็บในไฟล์นี้

ไฟล์นี้เป็น **แผนที่ระบบ** — ทุกโฟลเดอร์ ทุก endpoint ทุกหน้าจอ อย่างละบรรทัดเดียว เหตุผลเบื้องหลังกติกาอยู่ใน `AGENTS.md`

---

## 1. โครงสร้างโปรเจกต์

```
spacelink/
├─ apps/api/                    NestJS + Prisma → Render
│  ├─ prisma/
│  │  ├─ schema.prisma          v4 — freeze แล้ว 29 โมเดล 18 enum ห้ามแก้โดยไม่ผ่านทีม
│  │  ├─ seed.ts                typed stub ประกาศลำดับ insert ที่ปลอดภัยกับ FK ยังไม่ใส่ข้อมูล
│  │  ├─ migrations/            8 migrations
│  │  └─ sql/                   2 ไฟล์ที่ Prisma ไม่รันให้ ต้อง apply เองด้วย psql (§4)
│  └─ src/                      27 โฟลเดอร์
│     ├─ auth/                  guard + JIT provisioning + decorator `@OrgScoped`
│     ├─ users/                 ผู้ใช้ทั้งระบบ (SUPER_ADMIN) + แก้โปรไฟล์ตัวเอง
│     ├─ organizations/         องค์กร · สิทธิ์ ORG_ADMIN · โควตา · PromptPay
│     ├─ venues/                อ่านผังสถานที่ + สร้างโซนใต้ venue
│     ├─ zones/                 โซนในผัง
│     ├─ booths/                บูธในโซน
│     ├─ events/                อีเวนต์ · lifecycle · ใบเสนอราคาค่าบริการ · slug
│     ├─ categories/            หมวดสินค้า อ่านอย่างเดียว
│     ├─ bookings/              จอง · สลิป · ยกเลิก · ยกเว้นค่าเช่า · cron หมดเวลา
│     ├─ slips/                 seam ตรวจสลิป — mock / manual / slipok (มี README เอง)
│     ├─ refunds/               คำร้องคืนเงิน
│     ├─ reviews/               รีวิวโซนและร้านค้า
│     ├─ shops/                 ร้านค้าของผู้ขาย + โลโก้
│     ├─ notifications/         แจ้งเตือนในแอป + ส่ง web push
│     ├─ push-subscriptions/    ลงทะเบียน/ถอน subscription ของเบราว์เซอร์
│     ├─ announcements/         ประกาศระดับองค์กร
│     ├─ system-broadcasts/     ประกาศกลางถึงผู้ใช้ทุกคน
│     ├─ penalties/             แต้มโทษ + trust score + แบล็กลิสต์
│     ├─ support-tickets/       คำร้องช่วยเหลือ + ขอยกเว้นโควตา
│     ├─ audit-logs/            บันทึกการกระทำของผู้ดูแล
│     ├─ platform-config/       สูตรราคาค่าบริการอีเวนต์ของแพลตฟอร์ม
│     ├─ ai/                    seam แนะนำโซน + แชตช่วยเหลือ (มี README เอง)
│     ├─ dashboard/             สรุปตัวเลของค์กร
│     ├─ health/                liveness + readiness ของฐานข้อมูล
│     ├─ prisma/                `PrismaService` — ต่อ DB แบบ lazy ไม่ต่อตอน boot
│     ├─ common/                decorator · exception filter · pipe · ตัวช่วย Decimal
│     └─ config/                ตรวจ env ตอน boot (`env.validation.ts`)
├─ apps/web/                    Next.js 14 App Router PWA → Vercel
│  ├─ app/
│  │  ├─ layout.tsx             ครอบทุกหน้าด้วย `AppShell`
│  │  ├─ page.tsx               หน้าหลัก — ค้นหา Event + ประกาศสาธารณะ
│  │  ├─ login/ · register/     Email OTP · เข้าแล้วเด้งตาม role
│  │  ├─ events/[eventId]/      รายละเอียดอีเวนต์
│  │  │  ├─ map/                ผังโซนและบูธ
│  │  │  └─ book/               ฟอร์มจองบูธ
│  │  ├─ bookings/              การจองของฉัน
│  │  │  └─ [bookingId]/        รายละเอียด · `payment/` สลิป+QR · `review/` รีวิว
│  │  ├─ notifications/         แจ้งเตือน + ตัวกรอง
│  │  ├─ profile/               โปรไฟล์ + ร้านค้า
│  │  ├─ help/                  FAQ + ส่งคำร้อง
│  │  ├─ admin/                 ORG_ADMIN — 11 หน้า
│  │  │  ├─ dashboard/          ตัวเลขภาพรวมองค์กร
│  │  │  ├─ events/             สร้าง / เผยแพร่ / ปิด / ลบ + ใบเสนอราคา
│  │  │  ├─ bookings/           รายการจองขององค์กร
│  │  │  ├─ booking-rescue/     ค้นจากรหัสจอง → ยืนยันยกเว้นค่าเช่า / ออกแต้มโทษ
│  │  │  ├─ zones/              จัดการโซนและบูธ
│  │  │  ├─ map-designer/       ออกแบบผังสถานที่
│  │  │  ├─ vendors/            ผู้ขายในองค์กร + ประวัติรายคน
│  │  │  ├─ payments/           การชำระเงิน / คืนเงิน + ดูสลิป
│  │  │  ├─ reviews/            สรุปคะแนนรีวิว
│  │  │  ├─ announcements/      ประกาศถึงผู้ขาย
│  │  │  └─ organization/       โควตา + PromptPay ขององค์กร
│  │  └─ super-admin/           SUPER_ADMIN — 9 หน้า · shell แยกทั้งชุด
│  │     ├─ layout.tsx          ครอบด้วย `SuperAdminShell` + guard ของตัวเอง
│  │     ├─ page.tsx            ภาพรวมข้ามองค์กร + ส่งประกาศกลาง
│  │     ├─ organizations/      องค์กรทั้งหมด · สถานะ · PromptPay
│  │     ├─ admins/             แอดมินองค์กร + มอบสิทธิ์แก้โควตา
│  │     ├─ users/              ผู้ใช้ทั้งหมด + รายละเอียด + last-login
│  │     ├─ events-bookings/    การจอง / การเงิน (`?tab=bookings|payments`)
│  │     ├─ support/            เคสช่วยเหลือ / moderation (`?tab=tickets|moderation`)
│  │     ├─ announcements/      ประกาศข้ามองค์กร + ลบ
│  │     ├─ audit-logs/         audit log + ตัวกรอง
│  │     └─ settings/           สูตรราคาค่าบริการของแพลตฟอร์ม
│  ├─ components/               30 ไฟล์ + `super-admin/` อีก 10 (§6)
│  ├─ lib/                      8 ไฟล์ (§6)
│  └─ public/                   icon.svg · manifest.webmanifest · push-sw.js · รูปอ้างอิง 4 ไฟล์
├─ prototype/                   prototype เดิม ใช้อ้างอิงเท่านั้น ห้ามแก้ ห้าม import
├─ .github/                     ci.yml · keep-alive.yml · CODEOWNERS · PR template
└─ AGENTS.md · CLAUDE.md · README.md
```

สอง app แยกกันสมบูรณ์ ไม่ใช่ npm workspaces — `cd` เข้าโฟลเดอร์ก่อนรัน npm ทุกครั้ง ห้ามมี `package.json` ที่ราก

`/admin` กับ `/super-admin` เป็นคนละ route tree คนละ shell โดยตั้งใจ — `app-shell.tsx` เจอ `/super-admin` แล้ว bypass ตัวเองทันที ปล่อยให้ `SuperAdminShell` ครอบแทน ซึ่งเช็ค `auth.role !== 'SUPER_ADMIN'` ของตัวเอง

---

## 2. API surface

ทุก path มี prefix `/api` · role คือขั้นต่ำที่เรียกได้ · **ORG_ADMIN+** = ORG_ADMIN ขององค์กรนั้น หรือ SUPER_ADMIN · **ล็อกอิน** = role ไหนก็ได้ที่มี token

| โมดูล | endpoint | สิทธิ์ |
|---|---|---|
| `auth` | `GET /auth/me` — โปรไฟล์ + ร้าน + องค์กรที่สังกัด | ล็อกอิน |
| `users` | `GET /users` · `/:id` · `/:id/last-login` · `/:id/audit-logs` | SUPER_ADMIN |
| | `PATCH /users/me` — แก้ `phone` อย่างเดียว ไม่มี `:id` | ล็อกอิน |
| `organizations` | `GET /organizations` · `/:id` | public |
| | `POST /organizations` · `PATCH /:id/status` · `GET`/`POST`/`DELETE /:id/admins` | SUPER_ADMIN |
| | `PATCH /:organizationId` · `PATCH /:organizationId/quota` | ORG_ADMIN+ · quota ต้องมี `canEditQuota` |
| | `GET /admins` · `PATCH /admins/:membershipId/quota-permission` | SUPER_ADMIN |
| `venues` | `GET /venues` · `/venues/:id` | public |
| | `POST /venues/:venueId/zones` | ORG_ADMIN+ |
| `zones` | `GET /zones` · `/zones/:id` | public |
| | `PATCH`/`DELETE /zones/:zoneId` · `POST /zones/:zoneId/booths` | ORG_ADMIN+ |
| `booths` | `GET /booths` · `/booths/:id` | public |
| | `PATCH`/`DELETE /booths/:boothId` | ORG_ADMIN+ |
| `events` | `GET /events` · `/events/discovery` · `/events/:id/map` · `/events/by-slug/:slug/map` | public |
| | `POST /organizations/:organizationId/events` · `POST .../events/quote` · `GET` | ORG_ADMIN+ |
| | `PATCH :eventId/publish` · `/open` · `/close` · `DELETE :eventId` | ORG_ADMIN+ |
| `categories` | `GET /categories` | public |
| `bookings` | `POST /bookings` · `POST /:id/slip` · `PATCH /:id/cancel` · `GET /bookings` | VENDOR |
| | `GET /:bookingId` · `/:bookingId/slip` · `/by-code/:bookingCode` | ORG_ADMIN+ |
| | `PATCH /:bookingId/confirm-exempt` · `GET /organizations/:id/bookings` | ORG_ADMIN+ |
| | `GET /bookings/all` | SUPER_ADMIN |
| `refunds` | `POST /bookings/:bookingId/refunds` · `GET /refunds/mine` | VENDOR |
| | `PATCH .../approve` · `/reject` · `/process` · `GET /organizations/:id/refunds` | ORG_ADMIN+ |
| | `GET /refunds/all` | SUPER_ADMIN |
| `reviews` | `GET /reviews/average` | public |
| | `POST /reviews` | VENDOR |
| `shops` | `POST /shops` · `PATCH /shops/me` · `POST /shops/me/logo` (multipart) | VENDOR |
| `notifications` | `GET /notifications` · `/unread-count` · `PATCH /mark-all-read` · `/:id/read` | ล็อกอิน |
| `push-subscriptions` | `POST` · `DELETE /push-subscriptions` | ล็อกอิน |
| `announcements` | `GET /organizations/:id/announcements` | public |
| | `GET /:id/announcements/admin` · `POST` · `PATCH` · `DELETE` | ORG_ADMIN+ |
| | `GET /announcements/all` · `DELETE /announcements/:id` ข้ามองค์กร | SUPER_ADMIN |
| `system-broadcasts` | `GET /system-broadcasts/active` | ล็อกอิน |
| | `POST /system-broadcasts` — ถึงผู้ใช้ทุกคน | SUPER_ADMIN |
| `penalties` | `POST` · `GET /bookings/:bookingId/penalties` | ORG_ADMIN+ |
| | `POST /penalties` (ออกให้ผู้ขายตรง) · `GET /penalties/all` | SUPER_ADMIN |
| `support-tickets` | `POST /support-tickets` | VENDOR |
| | `POST /support-tickets/organizations/:id` — คำร้องถึง Super Admin | ORG_ADMIN |
| | `PATCH /:ticketId/approve-quota-exception` | ORG_ADMIN+ |
| | `GET /all` · `GET /:ticketId` · `PATCH /:ticketId/status` | SUPER_ADMIN |
| `audit-logs` | `GET /audit-logs?action=&actorUserId=` | SUPER_ADMIN |
| `platform-config` | `GET` · `PATCH /platform-config` | SUPER_ADMIN |
| `ai` | `POST /events/:eventId/recommendations` · `POST /ai/support` | ล็อกอิน |
| `dashboard` | `GET /organizations/:organizationId/dashboard-summary` | ORG_ADMIN+ |
| `health` | `GET /health` · `GET /health/db` | ไม่ต้อง auth |

---

## 3. กติกาที่บังคับในโค้ด

Prisma กับ foreign key แสดงกฎพวกนี้ไม่ได้ ทุกข้อบังคับใน service — เหตุผลเต็มอยู่ AGENTS.md §6.3

| กฎ | บังคับที่ไหน |
|---|---|
| บูธต้องอยู่ใน venue เดียวกับอีเวนต์ | `bookings.service` ในทรานแซกชันสร้าง booking |
| วันที่จองต้องอยู่ในช่วงอีเวนต์ | เดียวกัน |
| 1 บูธ 1 อีเวนต์ มี booking ที่ยัง active ได้ใบเดียว | service + **partial unique index ที่ยังไม่ apply** |
| องค์กรเจ้าของอีเวนต์ต้อง `ACTIVE` | สร้าง booking · หน้า discovery · หน้าผัง · `OrgScopeGuard` |
| ไม่เกินโควตาต่อผู้ขายต่ออีเวนต์ | `org_config` ก่อน ตกไป `platform_config` (default 2) |
| ผู้ใช้ที่ติดแบล็กลิสต์จองไม่ได้ | สร้าง booking + เด้งตั้งแต่หน้า login |
| trust score เริ่ม 100 แต้มโทษ**หัก**ออก clamp ที่ 0 แตะ 0 = แบล็กลิสต์ | `penalties.service` serializable transaction retry 3 |
| ยอดสลิปต้องตรงราคาบูธ **และ** สถานะต้องเป็น `VERIFIED` ก่อนถึงเทียบยอด | `bookings.service` เทียบ Decimal ด้วย `.equals()` |
| `trans_ref` ห้ามซ้ำ (กันสลิปซ้ำ) | unique ใน schema |
| hold 5 นาที หมดแล้วยกเลิกด้วย `cancelledByRole = SYSTEM` | cron ทุกนาทีใน `bookings/` |
| ยอดคืนเงินที่อนุมัติ ≤ ราคาบูธ และ ≤ ยอดที่ขอ | `refunds.service` |
| คืนเงินได้เฉพาะ booking ที่ยกเลิกแล้ว ไม่ใช่ exempt และมีสลิป verified ยอดตรง | `refunds.service` |
| รีวิวได้เมื่ออีเวนต์จบแล้ว **17 ชั่วโมง** และ 1 รีวิวต่อ 1 target ต่อ 1 คน | `reviews.service` |
| เปลี่ยนโลโก้ร้านได้ **1 ครั้งต่อ 168 ชั่วโมง** | `shops.service` ล็อกแถวด้วย `SELECT … FOR UPDATE` |
| ลบโซน/บูธไม่ได้ถ้าเคยมี booking ผูกอยู่ (แม้ถูกยกเลิกแล้ว) | FK restrict แล้วแปล error เป็นไทย |
| ลบอีเวนต์ได้เฉพาะที่ยังไม่เคยมี booking | `events.service` |
| สถานะคำร้องเดินหน้าอย่างเดียว OPEN → IN_PROGRESS → CLOSED | `support-tickets.service` |
| `platform_config` เขียนได้เฉพาะ SUPER_ADMIN · `org_config` เฉพาะแอดมินองค์กรนั้น | guard + service |

**คำนวณสด ไม่เก็บเป็นค่าจริง** — tier บูธ (S/A/B/C) จากราคา · badge ร้าน · คะแนนเฉลี่ย

**กฎที่พลาดแล้วไม่มี error ให้เห็น**

- org-scoped route ตอบ **404 ไม่ใช่ 403** — ของที่ไม่มีจริงกับของขององค์กรอื่นต้องแยกไม่ออกจากฝั่ง client
- `organizationId` มาจาก `OrgMembership` เสมอ ไม่เอาจาก path / query / body
- role กับ membership อ่านจากฐานข้อมูล **ไม่ใช่จาก JWT claim**
- ใช้ `@OrgScoped(param)` ตัวเดียว ห้ามแยกเป็น `@OrgScope` + `@UseGuards` (แยกแล้วคอมไพล์ผ่าน เทสต์ผ่าน แต่ไม่บังคับอะไรเลย)
- เงินเป็น `Decimal(10,2)` คืนออก API ด้วย `.toString()` ห้าม `Float`/`parseFloat`
- ห้าม `$queryRawUnsafe` / `$executeRawUnsafe`
- `verified_slip.slipok_raw` มีชื่อและธนาคารผู้โอน — ห้ามคืนให้ผู้ขายและห้าม log
- `SUPABASE_SERVICE_ROLE_KEY` ห้ามโผล่ใน `apps/web` หรือตัวแปร `NEXT_PUBLIC_*` ใดๆ

---

## 4. ฐานข้อมูลและ migration

- โมเดล = PascalCase · ตาราง/คอลัมน์ = snake_case ผ่าน `@@map` / `@map` · ใน TypeScript ใช้ชื่อของ Prisma เสมอ
- โมเดล `User` map ไปตาราง **`app_user`** (`user` เป็นคำสงวนของ Postgres)
- PK เป็น uuid · เวลาเป็น timestamptz · เงินเป็น `Decimal(10,2)`
- สายความเป็นเจ้าของ: `Organization` → `Venue` → `Zone` → `Booth` → `Booking` · `Event` คือสิ่งที่ถูกจองเข้าไป · `Subscription` คือบิลที่องค์กรจ่ายให้แพลตฟอร์ม (คนละเรื่องกัน)
- migration รันโดยคน ไม่ใช่ agent · **ห้าม** `migrate reset` / `db push` / `db pull` / `DROP` / `TRUNCATE`
- `npx prisma generate` และ `npx prisma validate` ปลอดภัยเสมอ

**`prisma/sql/` — ไม่มีอะไรรันให้อัตโนมัติ ต้อง `psql` เองหลัง migrate**

| ไฟล์ | ทำอะไร |
|---|---|
| `booking_active_event_booth_unique.sql` | partial unique index กัน double-booking (`@@unique` เงื่อนไขตามสถานะไม่ได้) |
| `remove_authenticated_slips_upload_policy.sql` | ถอน policy ที่ยอมให้ client ที่ล็อกอินอัปโหลดเข้าบัคเก็ต `slips` ตรงๆ |

---

## 5. Auth และ role

Supabase Auth เป็นผู้ออก token · NestJS แค่ verify ไม่ได้ออกเอง · ไม่มี `/auth/register`, `/auth/login`, ไม่มี bcrypt, ไม่มี `passwordHash`

1. เบราว์เซอร์เรียก `signInWithOtp({ email })` กับ Supabase โดยตรง ได้ JWT กลับมา
2. ทุก request แนบ `Authorization: Bearer <supabase_jwt>`
3. `SupabaseAuthGuard` verify ลายเซ็นแล้วดึง `sub` = `app_user.auth_user_id`
4. ถ้ายังไม่มีแถว `app_user` → **JIT-provision** ให้ (role เริ่มต้น VENDOR เสมอ)
5. `RolesGuard` อ่าน `app_user.role` **จากฐานข้อมูล**
6. `OrgScopeGuard` เช็ค `OrgMembership` **จากฐานข้อมูล** สำหรับ route ที่ผูกองค์กร

`UserRole` = `SUPER_ADMIN | ORG_ADMIN | VENDOR` (ระดับแพลตฟอร์ม) · `OrgMembership.role` = `OWNER | ADMIN` (บอกว่าทำกับองค์กรไหนได้) — ทั้งคู่อยู่ในฐานข้อมูลของเรา **ไม่เคยอยู่ใน JWT**

หลังยืนยัน OTP: SUPER_ADMIN → `/super-admin` · ORG_ADMIN → `/admin/bookings` · VENDOR → `/` · บัญชีที่ติดแบล็กลิสต์ถูก sign out ทันทีโดยไม่บอกเหตุผล

---

## 6. ไฟล์ฝั่งเว็บ

### `lib/`

| ไฟล์ | ทำอะไร |
|---|---|
| `api.ts` | client เดียวของทั้งแอป — ทุก endpoint + type · read สาธารณะไม่แนบ Authorization |
| `supabase.ts` | Supabase browser client แบบ **lazy** — สร้างตอนใช้จริง ไม่ใช่ตอน import (ไม่งั้น build พังตอนไม่มี env) |
| `use-auth-state.ts` | สถานะล็อกอิน + role + องค์กร มี `loading` เป็นสถานะของตัวเองกันหน้าจอกระพริบ |
| `use-email-otp.ts` | flow ส่ง/ยืนยัน OTP + cooldown + เด้งตาม role หลังล็อกอิน |
| `use-vendor-profile.ts` | โปรไฟล์ + ร้านของผู้ขาย (ผู้ขายมีได้ร้านเดียว จึงยุบ `shops[]` ให้ตรงนี้ที่เดียว) |
| `auth-errors.ts` | ข้อความ error ของหน้า login/register เก็บที่เดียวกันสองหน้าไม่ให้เพี้ยน |
| `event-booking-rules.ts` | อีเวนต์นี้ยังจองได้ไหม — เช็คสถานะ + วันที่ตามเวลาไทย |
| `ux-preview.ts` | โหมดพรีวิว UI **เฉพาะ dev บน localhost** ไม่เคยสร้าง token ที่ API รับ |

### `components/` — ส่วนกลาง

| ไฟล์ | ทำอะไร |
|---|---|
| `app-shell.tsx` | shell ของผู้ขาย/ORG_ADMIN — sidebar · bottom nav · แบนเนอร์ประกาศกลาง · วิดเจ็ต AI |
| `admin-ui.tsx` | ชิ้นส่วนร่วมของหน้า admin + `useAdminPageAccess` (เลือกองค์กร + เช็คสิทธิ์) |
| `auth-layout.tsx` | เลย์เอาต์เต็มจอของหน้า login / register |
| `otp-input.tsx` | ช่องกรอกรหัส 6 หลัก |
| `select-menu.tsx` · `multi-select-menu.tsx` | dropdown เดี่ยว / หลายค่า ใช้ร่วมทั้งแอป |
| `zone-map.tsx` | ผังโซนและบูธเป็น inline SVG — โซนต่างกันด้วยน้ำหนักสีม่วง ไม่ใช่คนละสี |
| `booking-countdown.tsx` | นับถอยหลัง hold 5 นาที |
| `slip-upload-panel.tsx` | แผงเลือกไฟล์ + อัปโหลดสลิป |
| `admin-slip-actions.tsx` | ปุ่มดู/ดาวน์โหลดสลิป — ขอ signed URL ตอนกดเท่านั้น |

### `components/` — จอผู้ขาย

| ไฟล์ | ทำอะไร |
|---|---|
| `event-detail-screen.tsx` | รายละเอียดอีเวนต์ + ข้อมูลติดต่อผู้จัด |
| `event-map-screen.tsx` | ผังบูธ + สถานะว่าง/ถูกจอง + tier |
| `booking-screen.tsx` | ฟอร์มจอง — เลือกบูธ วันที่ ร้าน |
| `my-bookings-screen.tsx` | รายการจองของฉัน + PromptPay QR |
| `booking-detail-screen.tsx` | รายละเอียดการจอง + ยกเลิก |
| `booking-payment-screen.tsx` | หน้าอัปโหลดสลิปและผลตรวจ |
| `booking-review-screen.tsx` | ให้คะแนนโซนและร้าน |
| `profile-shop-screen.tsx` | โปรไฟล์ + ร้าน + โลโก้ (ส่วนร้านแสดงเฉพาะ VENDOR) |
| `support-ticket-screen.tsx` | ส่งคำร้อง + ดูเธรดข้อความ |

### `components/` — จอ ORG_ADMIN

| ไฟล์ | ทำอะไร |
|---|---|
| `admin-dashboard.tsx` | ตัวเลขภาพรวมองค์กร |
| `admin-events-screen.tsx` | สร้าง/เผยแพร่/ปิด/ลบอีเวนต์ + ใบเสนอราคาค่าบริการ |
| `admin-bookings-screen.tsx` | รายการจองขององค์กร |
| `admin-booking-rescue-screen.tsx` | ค้นจากรหัสจอง → ยืนยันยกเว้นค่าเช่า / ออกแต้มโทษ / ดูประวัติโทษ |
| `admin-zone-booth-screen.tsx` | จัดการโซนและบูธ |
| `admin-map-designer.tsx` | วางผังสถานที่ |
| `admin-vendors-screen.tsx` | ผู้ขายในองค์กร + ประวัติการจองรายคน |
| `admin-payments-screen.tsx` | การชำระเงิน + คืนเงิน + ดูสลิป |
| `admin-reviews-screen.tsx` | สรุปคะแนนรีวิวของโซนและร้าน |
| `admin-announcements-screen.tsx` | ประกาศถึงผู้ขาย |
| `admin-organization-settings.tsx` | โควตาการจอง + PromptPay ขององค์กร |

### `components/super-admin/`

| ไฟล์ | ทำอะไร |
|---|---|
| `super-admin-shell.tsx` | shell + sidebar + guard + กระดิ่งแจ้งเตือน |
| `super-admin-dashboard.tsx` | ภาพรวมข้ามองค์กร + ส่งประกาศกลาง |
| `super-admin-organizations-screen.tsx` | องค์กรทั้งหมด · สร้าง · สถานะ · PromptPay |
| `super-admin-admins-screen.tsx` | แอดมินองค์กรทั้งระบบ + มอบสิทธิ์แก้โควตา |
| `super-admin-users-screen.tsx` | ผู้ใช้ทั้งหมด + รายละเอียด + last-login |
| `super-admin-events-bookings-screen.tsx` | การจองและการเงินข้ามองค์กร |
| `super-admin-support-screen.tsx` | เคสช่วยเหลือ + แต้มโทษ/แบล็กลิสต์ |
| `super-admin-announcements-screen.tsx` | ประกาศข้ามองค์กร + ลบ |
| `super-admin-audit-logs-screen.tsx` | audit log + ตัวกรอง |
| `super-admin-platform-config-screen.tsx` | สูตรราคาค่าบริการอีเวนต์ |

---

## 7. Tech stack

| ส่วน | ใช้อะไร |
|---|---|
| Frontend | Next.js 14 (App Router) · React · Tailwind · next-pwa · inline SVG zone map |
| Backend | NestJS (TypeScript) REST ไม่ใช่ GraphQL · Prisma · PostgreSQL (Supabase Pro) |
| Auth | Supabase Auth — Email OTP / magic link · backend verify ด้วย `jose` เท่านั้น |
| Storage | Supabase Storage — บัคเก็ตสลิปเป็น private เสมอ |
| AI | Gemini **Flash / Flash-Lite เท่านั้น ห้ามใช้ Pro** พร้อม fallback แบบ rule-based |
| ตรวจสลิป | SlipOK (OK BASIC, free tier) |
| ชำระเงิน | PromptPay QR สร้างฝั่ง API ด้วย `promptpay-qr` + `qrcode` |
| Push | `web-push` + VAPID |
| Deploy | Vercel (web) · Render (api) |

เพดานงบ ~1,000–1,500 บาท/เดือน — ห้ามเพิ่มบริการที่มีค่าใช้จ่าย

---

## 8. Environment

`.env.example` ของแต่ละ app คือรายการที่เชื่อถือได้ · `src/config/env.validation.ts` คือตัวบังคับตอน boot · **คัดลอกค่าจริงจาก Supabase dashboard ห้ามพิมพ์เอง**

| ตัวแปร (`apps/api`) | หมายเหตุ |
|---|---|
| `DATABASE_URL` · `DIRECT_URL` | pooled กับ direct คนละ port คนละ username |
| `SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` | backend เท่านั้น key นี้ข้าม RLS ทั้งหมด |
| `SUPABASE_JWKS_URL` **หรือ** `SUPABASE_JWT_SECRET` | ตั้งได้อันเดียว (`.xor()`) ตั้งทั้งคู่ = boot ไม่ขึ้น โดยตั้งใจ |
| `VAPID_SUBJECT` · `VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY` | ครบ 3 หรือไม่ตั้งเลย (`.and()`) ไม่ตั้ง = push เงียบ ไม่ error |
| `SLIP_VERIFIER` | `mock\|manual\|slipok` · **production ไม่มี default ต้องตั้งเอง** |
| `SLIP_VERIFIER_MODE` | `always-verified\|always-invalid` · บังคับใน production เมื่อ verifier เป็น mock |
| `SLIPOK_BRANCH_ID` · `SLIPOK_API_KEY` | บังคับเมื่อ `SLIP_VERIFIER=slipok` |
| `ZONE_RECOMMENDER` · `SUPPORT_ASSISTANT` | `rule\|gemini` (default `rule`) |
| `GEMINI_API_KEY` | บังคับเมื่อตัวใดตัวหนึ่งข้างบนเป็น `gemini` |
| `GEMINI_MODEL` · `GEMINI_SUPPORT_MODEL` | regex รับเฉพาะ Flash / Flash-Lite ปฏิเสธ Pro ตั้งแต่ boot |
| `NODE_ENV` · `PORT` · `CORS_ORIGIN` | `CORS_ORIGIN` คั่นด้วย comma ได้หลายค่า ไม่ตั้ง = สะท้อน origin ที่เรียกมา |

`apps/web/.env.local` มี 4 ตัว ขึ้นต้น `NEXT_PUBLIC_` ทั้งหมด จึงถูกฝังลง bundle: `NEXT_PUBLIC_API_URL` · `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — **ห้ามใส่ service role key ลงไปเด็ดขาด**

ค่า placeholder เป็นเรื่องปกติระหว่างที่ยังไม่มี Supabase จริง — ไม่ใช่ config พัง ไม่ต้องไปแก้

---

## 9. เริ่มต้นใช้งาน

ต้องมี Node.js 20+ และ npm

```bash
cd apps/api && npm install && cp .env.example .env && npx prisma generate && npm run start:dev
cd apps/web && npm install && cp .env.example .env.local && npm run dev   # :3000
```

**ไม่มีฐานข้อมูลก็ต้อง boot ขึ้นได้** — `PrismaService` ต่อแบบ lazy ดังนั้น endpoint ที่ query จริงจะ error แต่เซิร์ฟเวอร์ต้องไม่ล้ม ถามสถานะได้ที่ `GET /api/health/db` (503 = ยังไม่มี DB, 200 = มีแล้ว connection error กลายเป็นบั๊กจริง)

**gate ที่ต้องผ่านทั้งหมด — CI รันทุก PR และ `main` protected**

| app | คำสั่ง |
|---|---|
| `apps/api` | `npm run build` · `npx tsc --noEmit` · `npx eslint src prisma` · `npm test` |
| `apps/web` | `npm run build` · `npx tsc --noEmit` · `npx next lint` |

`tsc --noEmit` ไม่ซ้ำกับ `npm run build` — `tsconfig.build.json` ตัด `prisma/` ออกเพื่อให้ output เป็น `dist/main.js` ผลคือ `prisma/seed.ts` ไม่ถูกคอมไพล์ที่ไหนเลย ต้องอาศัยขั้นนี้ · ใช้ `npx eslint` ไม่ใช่ `npm run lint` เพราะสคริปต์นั้นมี `--fix` (CI ตรวจ ไม่แก้)

`npm run db:seed` เปิดคอนเนกชันจริง — รันในเครื่องตัวเองเท่านั้น ห้ามรันใน CI

**commit message** — งานที่ผู้ใช้เห็นผลต้องมี Jira ticket ขึ้นต้นด้วย `SCRUM-xx:` · งาน maintenance (chore/docs/ci/refactor/test) ใช้ conventional prefix และ **ไม่ต้องเปิด ticket เพื่อให้ผ่านรูปแบบ**

---

## 10. Seam — จุดเสียบของทีม

`SLIP_VERIFIER` กับ `ZONE_RECOMMENDER` เป็นสองที่ที่งานของคนอื่นเสียบเข้ามาหลัง interface ที่โค้ดส่วนอื่นพึ่งอยู่แล้ว

- **interface เปลี่ยนไม่ได้ถ้าไม่ผ่าน PO** — การเพิ่ม field ก็นับว่าเปลี่ยน
- **provider เป็น adapter ล้วน** — แปลงรูปแบบข้อมูลแล้ว return หรือ throw · ไม่เขียน DB ไม่ fallback เอง ไม่กลืน error
- **การบันทึกและ fallback อยู่ที่ wrapper** — `SlipVerificationService`, `ZoneRecommendationService`
- **inject wrapper ไม่ใช่ DI token** — inject token ตรงๆ จะข้าม fallback และข้ามการบันทึก log ซึ่งเป็นความพังที่ไม่มีใครสังเกตเห็น
- อ่าน `src/slips/README.md` และ `src/ai/README.md` ก่อนเขียน provider

---

## 11. สถานะระบบ

- **จอง** ครบวงจร — เลือกบูธ → `PENDING_PAYMENT` + PromptPay QR → แนบสลิป → SlipOK จริง → ยืนยันอัตโนมัติ · **ไม่มีขั้นตอนอนุมัติด้วยคน** · มีเส้นทางยกเว้นค่าเช่าให้ ORG_ADMIN
- **อีเวนต์** DRAFT พร้อมใบเสนอราคาที่คิดจาก `platform_config` → เผยแพร่ / ปิด / เปิดใหม่ / ลบ · มี slug สาธารณะสำหรับแชร์ผัง
- **Admin** 11 หน้า · **Super admin** 9 หน้าที่ต่อ API จริงครบ · เมนู placeholder เหลือ 3 อัน (Package และ Billing · สถานะระบบ · บทบาทและสิทธิ์)
- **แจ้งเตือน** in-app + **web push จริง** ผ่าน `web-push` + VAPID ทั้งฝั่ง backend และ service worker · SUPER_ADMIN ส่งประกาศกลางถึงทุกคนได้
- **PWA** — request ที่มี `Authorization` ถูกบังคับ `NetworkOnly` กันข้อมูลข้ามบัญชีบนเครื่องเดียวกัน · precache ตัด chunk ของ admin ออก
- **AI** สองผิว — แนะนำโซน/บูธ และแชตช่วยเหลือ ทั้งคู่ fallback เป็น rule-based · แชตเห็นเฉพาะข้อมูลของผู้ถามเอง
- **Audit log** บันทึก 7 action จาก `organizations.service.ts` (6) และ `platform-config.service.ts` (1)

## 12. ข้อจำกัดที่รู้อยู่

- ไฟล์ใน `prisma/sql/` ยังไม่ถูก apply — partial unique index กัน double-booking บังคับด้วย service code อย่างเดียว
- ไม่มี endpoint สร้าง/แก้/ลบ venue และไม่มี endpoint แก้ไขรายละเอียดอีเวนต์ (เมธอดในเซอร์วิสมี แต่ไม่มี route เรียก)
- fan-out ของประกาศระดับองค์กรส่งแค่ in-app ไม่ส่ง push
- สวิตช์ตั้งค่าการแจ้งเตือนในหน้า `/notifications` ยังเป็น UI อย่างเดียว ไม่ได้บันทึกไว้ที่ไหน
- โมดูลอื่นนอกจาก 2 ไฟล์ข้างบนยังไม่เขียน audit log เลย
- `prisma/seed.ts` ยังเป็น stub (SCRUM-22) · เทสต์ที่ต้องใช้ token จริงหรือข้อมูล seed ถูกเลื่อนไว้
- AI ทั้งสองผิวยังไม่ได้ทดสอบ end-to-end กับข้อมูลจริงจาก production

## 13. ทีม

| ชื่อ | รหัส | รับผิดชอบ |
|---|---|---|
| ซีบิว — วิธวินท์ ระวังจังหรีด | B6703165 | Frontend, AI Integration, Testing |
| บุ๊ค — ชิติพัทธ์ สีสุด | B6703271 | Product Owner, Scrum Master, Backend |
| ปอนด์ — วรรนเรศ ขุมพลกรัง | B6728120 | Backend, Database |

`.github/CODEOWNERS` คือรายการที่บอกว่าไฟล์ไหนต้องมีคนรีวิว — schema, auth, config ตอน boot และไฟล์กติกาเอง

เอกสารออกแบบ (Master Spec, ERD, Design System Brief) เก็บนอก repo — ขอได้จาก Product Owner (บุ๊ค)
