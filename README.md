# SpaceLink

แพลตฟอร์มกลางจองพื้นที่ขายของและจัดกิจกรรม — Multi-tenant SaaS PWA · องค์กร (ตลาด / ห้าง / หน่วยงาน) สมัครเป็นผู้เช่าระบบ ออกแบบผังสถานที่ เปิดอีเวนต์ แล้วผู้ขายเลือกบูธ จอง แนบสลิป และได้รับการยืนยันอัตโนมัติ

> **โครงงานรายวิชา 1101910 โครงงานเทคโนโลยีดิจิทัล-1** · Software Engineering · 1/2569 · นำเสนอ 12–16 ตุลาคม 2569
> **กติกาการพัฒนาทั้งหมดอยู่ใน [`AGENTS.md`](./AGENTS.md)** · **สถานะงานอยู่ที่ Jira** ไม่เก็บในไฟล์นี้

## โครงสร้างโปรเจกต์

```
spacelink/
├─ apps/api/                    NestJS + Prisma → Render
│  ├─ prisma/
│  │  ├─ schema.prisma          v4 — freeze แล้ว ห้ามแก้โดยไม่ผ่านทีม (29 โมเดล 18 enum)
│  │  ├─ seed.ts                typed stub ยังไม่ใส่ข้อมูล (SCRUM-22)
│  │  ├─ migrations/            8 migrations
│  │  └─ sql/                   2 ไฟล์ที่ Prisma ไม่รันให้ ต้อง apply เองด้วย psql (AGENTS.md §12)
│  └─ src/                      27 โฟลเดอร์ — endpoint ทั้งหมดอยู่ตารางถัดไป
├─ apps/web/                    Next.js 14 App Router PWA → Vercel
│  ├─ app/                      หน้าผู้ขาย: `/` ค้นหา Event · events/[eventId]/{map,book} ·
│  │  │                         bookings/[bookingId]/{payment,review} · notifications · profile · help
│  │  ├─ admin/                 ORG_ADMIN 11 หน้า — dashboard · events · bookings · booking-rescue ·
│  │  │                         zones · map-designer · vendors · payments · reviews ·
│  │  │                         announcements · organization
│  │  └─ super-admin/           SUPER_ADMIN 9 หน้า — ภาพรวม · organizations · admins · users ·
│  │                            events-bookings · support · announcements · audit-logs · settings
│  ├─ components/               30 ไฟล์ + `components/super-admin/` อีก 10 ไฟล์
│  ├─ lib/                      api.ts · supabase.ts · auth-errors.ts · use-auth-state.ts ·
│  │                            use-email-otp.ts · use-vendor-profile.ts · event-booking-rules.ts ·
│  │                            ux-preview.ts (dev เท่านั้น)
│  └─ public/                   icon.svg · manifest.webmanifest · push-sw.js · รูปอ้างอิง 4 ไฟล์
├─ prototype/                   prototype เดิม ใช้อ้างอิงเท่านั้น ห้ามแก้
├─ .github/                     CI workflow · keep-alive ping (Render free) · CODEOWNERS
└─ AGENTS.md · CLAUDE.md · README.md
```

แต่ละ app แยกกันสมบูรณ์ ไม่ใช่ npm workspaces — ต้อง `cd` เข้าโฟลเดอร์ก่อนรัน npm ทุกครั้ง

`/admin` กับ `/super-admin` เป็นคนละ route tree คนละ shell โดยตั้งใจ — `app-shell.tsx` เจอ
`/super-admin` แล้ว bypass ตัวเองทันที ปล่อยให้ `SuperAdminShell` ครอบแทน ซึ่งมี guard เช็ค
`auth.role !== 'SUPER_ADMIN'` ของตัวเอง เมนู super-admin ที่ยังเป็น placeholder "เร็วๆ นี้"
เหลือ 3 อัน: Package และ Billing · สถานะระบบ · บทบาทและสิทธิ์

## API surface

ทุก path มี prefix `/api` · role คือขั้นต่ำที่เรียกได้ · "ORG_ADMIN+" = ORG_ADMIN ขององค์กรนั้น หรือ SUPER_ADMIN

| โมดูล | endpoint | สิทธิ์ |
|---|---|---|
| `auth` | `GET /auth/me` (โปรไฟล์ + ร้าน + องค์กร) | ล็อกอิน |
| `users` | `GET /users`, `/:id`, `/:id/last-login`, `/:id/audit-logs` | SUPER_ADMIN |
| | `PATCH /users/me` (แก้ `phone` อย่างเดียว) | ล็อกอิน |
| `organizations` | `POST /organizations`, `PATCH /:id/status`, `POST`/`DELETE /:id/admins` | SUPER_ADMIN |
| | `GET /organizations`, `/:id` | public |
| | `PATCH /:id`, `PATCH /:id/quota` | ORG_ADMIN+ (quota ต้องมี `canEditQuota`) |
| | `GET /admins`, `PATCH /admins/:membershipId/quota-permission` | SUPER_ADMIN |
| `venues` `zones` `booths` | `GET /venues`, `/venues/:id`, `/zones`, `/zones/:id`, `/booths`, `/booths/:id` | public |
| | `POST /venues/:venueId/zones`, `POST /zones/:zoneId/booths`, `PATCH`/`DELETE` zone+booth | ORG_ADMIN+ |
| `events` | `GET /events`, `/events/discovery`, `/events/:id/map`, `/events/by-slug/:slug/map` | public |
| | `POST /organizations/:id/events` + `/quote`, `PATCH :eventId/publish\|open\|close`, `DELETE :eventId`, `GET` | ORG_ADMIN+ |
| `categories` | `GET /categories` | public |
| `bookings` | `POST /bookings`, `POST /:id/slip`, `PATCH /:id/cancel`, `GET /bookings` | VENDOR |
| | `GET /:bookingId`, `/:bookingId/slip`, `/by-code/:code`, `PATCH /:bookingId/confirm-exempt`, `GET /organizations/:id/bookings` | ORG_ADMIN+ |
| | `GET /bookings/all` | SUPER_ADMIN |
| `refunds` | `POST /bookings/:id/refunds`, `GET /refunds/mine` | VENDOR |
| | `PATCH .../approve\|reject\|process`, `GET /organizations/:id/refunds` | ORG_ADMIN+ |
| | `GET /refunds/all` | SUPER_ADMIN |
| `reviews` | `GET /reviews/average` | public |
| | `POST /reviews` | VENDOR |
| `shops` | `POST /shops`, `PATCH /shops/me`, `POST /shops/me/logo` | VENDOR |
| `notifications` | `GET /notifications`, `/unread-count`, `PATCH /mark-all-read`, `/:id/read` | ล็อกอิน |
| `push-subscriptions` | `POST` / `DELETE /push-subscriptions` | ล็อกอิน |
| `announcements` | `GET /organizations/:id/announcements` | public |
| | `GET /:id/announcements/admin`, `POST`, `PATCH`, `DELETE` | ORG_ADMIN+ |
| | `GET /announcements/all`, `DELETE /announcements/:id` (ข้ามองค์กร) | SUPER_ADMIN |
| `system-broadcasts` | `GET /system-broadcasts/active` | ล็อกอิน |
| | `POST /system-broadcasts` (ถึงผู้ใช้ทุกคน) | SUPER_ADMIN |
| `penalties` | `POST` / `GET /bookings/:bookingId/penalties` | ORG_ADMIN+ |
| | `POST /penalties`, `GET /penalties/all` | SUPER_ADMIN |
| `support-tickets` | `POST /support-tickets` | VENDOR |
| | `POST /support-tickets/organizations/:id` (คำร้องถึง Super Admin) | ORG_ADMIN |
| | `PATCH /:ticketId/approve-quota-exception` | ORG_ADMIN+ |
| | `GET /all`, `GET /:ticketId`, `PATCH /:ticketId/status` | SUPER_ADMIN |
| `audit-logs` | `GET /audit-logs?action=&actorUserId=` | SUPER_ADMIN |
| `platform-config` | `GET` / `PATCH /platform-config` (สูตรราคาค่าบริการอีเวนต์) | SUPER_ADMIN |
| `ai` | `POST /events/:eventId/recommendations`, `POST /ai/support` | ล็อกอิน |
| `dashboard` | `GET /organizations/:id/dashboard-summary` | ORG_ADMIN+ |
| `health` | `GET /health`, `/health/db` | ไม่ต้อง auth |

## จุดที่ต้องรู้ก่อนแก้โค้ด

- **ไม่มีขั้นตอนอนุมัติด้วยคน** — สลิปที่ SlipOK ตอบ VERIFIED และยอดตรงราคาบูธ จะตั้ง `CONFIRMED` ให้ทันที · hold 5 นาที · cron ทุกนาทียกเลิกอันที่หมดอายุด้วย `cancelledByRole = SYSTEM`
- **แต้มโทษเป็นการหักคะแนน ไม่ใช่การสะสม** — `User.trustScore` เริ่ม 100 แต่ละ penalty หักออก (default 20/15/30/10/5) clamp ที่ 0 แตะ 0 = `isBlacklisted` · ห้ามคำนวณคะแนนใหม่จากการบวกแถว penalty
- **org-scoped route ตอบ 404 ไม่ใช่ 403** — ของที่ไม่มีอยู่จริงกับของขององค์กรอื่นต้องแยกไม่ออกจากฝั่ง client · `organizationId` มาจาก `OrgMembership` เสมอ ไม่เอาจาก path/body
- **role กับ membership อ่านจากฐานข้อมูล ไม่ใช่จาก JWT** — Supabase ออก token, NestJS แค่ verify แล้ว JIT-provision `app_user` (role เริ่มต้น VENDOR)
- **สลิปเป็นข้อมูลอ่อนไหวที่สุด** — bucket เป็น private, `GET /bookings/:bookingId/slip` คืน signed URL อายุ 5 นาที ไม่เคยเก็บ URL สาธารณะ · ตรวจไฟล์จาก magic bytes ฝั่ง server (JPEG/PNG ≤ 5 MB)
- **เงินเป็น `Decimal(10,2)` ทั้งหมด** — คืนค่าออก API ด้วย `.toString()` ห้าม `Float`/`parseFloat` (ที่แปลงเป็น number จุดเดียวคือตอนสร้าง PromptPay QR)
- **`SLIP_VERIFIER` กับ `ZONE_RECOMMENDER` เป็น seam** — provider เป็น adapter ล้วน ๆ ส่วนการบันทึกและ fallback อยู่ที่ wrapper service · อ่าน `src/slips/README.md` และ `src/ai/README.md` ก่อนเขียน provider
- **audit log ยังบันทึกแค่ 7 action** จาก `organizations.service.ts` (6) และ `platform-config.service.ts` (1) โมดูลอื่นยังไม่เรียกเลย

## Tech stack

| ส่วน | ใช้อะไร |
|---|---|
| Frontend | Next.js 14 (App Router) · React · Tailwind · next-pwa · SVG zone map |
| Backend | NestJS (TypeScript) REST · Prisma · PostgreSQL (Supabase Pro) |
| Supabase | Auth — Email OTP / magic link (verify ด้วย `jose`) · Storage (สลิป, โลโก้ร้าน) |
| บริการภายนอก | Gemini **Flash / Flash-Lite เท่านั้น ห้ามใช้ Pro** · SlipOK (OK BASIC) · web-push |
| การชำระเงิน | PromptPay QR สร้างฝั่ง API ด้วย `promptpay-qr` + `qrcode` |
| Deploy | Vercel (web) · Render (api) |

## เริ่มต้นใช้งาน

ต้องมี Node.js 20+ และ npm

```bash
cd apps/api && npm install && cp .env.example .env && npx prisma generate && npm run start:dev
cd apps/web && npm install && cp .env.example .env.local && npm run dev   # :3000
```

ไม่มีฐานข้อมูลก็ต้อง boot ขึ้นได้ — endpoint ที่ query จริงจะ error แต่เซิร์ฟเวอร์ต้องไม่ล้ม

- **gate ของ api (4 อัน)** — `npm run build` · `npx tsc --noEmit` · `npx eslint src prisma` · `npm test`
- **gate ของ web (3 อัน)** — `npm run build` · `npx tsc --noEmit` · `npx next lint`
- `.env.example` ของแต่ละ app คือรายการตัวแปรที่เชื่อถือได้ ที่มักพลาด: **VAPID 3 ตัวต้องครบหรือไม่ตั้งเลย** และ **`SUPABASE_JWKS_URL` กับ `SUPABASE_JWT_SECRET` ต้องมีอันเดียว** (ตั้งทั้งคู่ = boot ไม่ขึ้น โดยตั้งใจ)
- `.env.local` ของ web มี 4 ตัวแปร ขึ้นต้น `NEXT_PUBLIC_` ทั้งหมด — **ห้ามใส่ `SUPABASE_SERVICE_ROLE_KEY` เด็ดขาด**

## สถานะระบบ

- **จอง** ครบวงจร — เลือกบูธ → `PENDING_PAYMENT` + PromptPay QR → แนบสลิป → SlipOK จริง → ยืนยันอัตโนมัติ · มีเส้นทางยกเว้นค่าเช่าให้ org admin
- **อีเวนต์** สร้างเป็น DRAFT พร้อมใบเสนอราคาค่าบริการที่คิดจาก `platform_config` → เผยแพร่ / ปิด / เปิดใหม่ / ลบ (ลบได้เฉพาะที่ยังไม่มีการจอง) · มี slug สาธารณะสำหรับแชร์ลิงก์ผัง
- **Admin** 11 หน้า · **Super admin** 9 หน้าที่ต่อ API จริงครบ
- **แจ้งเตือน** in-app + **web push จริง** ผ่าน `web-push` + VAPID (backend `PushSenderService`, ฝั่ง PWA `public/push-sw.js`) · super admin ส่งประกาศกลางถึงทุกคนได้
- **PWA** — request ที่มี `Authorization` ถูกบังคับ `NetworkOnly` กันข้อมูลข้ามบัญชีบนเครื่องเดียวกัน · precache ตัด chunk ของ admin ออก
- **AI** สองผิว — แนะนำโซน/บูธ และแชตช่วยเหลือ ทั้งคู่มี fallback เป็น rule-based · ยังไม่ได้ทดสอบ end-to-end กับข้อมูลจริง

## ข้อจำกัดที่รู้อยู่

- ไฟล์ใน `prisma/sql/` ไม่มีอะไรรันให้ — จนกว่าจะมีคน `psql` เอง partial unique index กัน double-booking ยังบังคับด้วย service code อย่างเดียว
- ไม่มี endpoint สร้าง/แก้/ลบ venue และไม่มี endpoint แก้ไขรายละเอียดอีเวนต์ (เมธอดในเซอร์วิสมี แต่ไม่มี route เรียก)
- fan-out ของ announcement ส่งแค่ in-app ไม่ส่ง push · push เงียบทั้งหมดถ้าไม่ได้ตั้ง VAPID
- สวิตช์ตั้งค่าการแจ้งเตือนในหน้า `/notifications` ยังเป็น UI อย่างเดียว ไม่ได้บันทึกไว้ที่ไหน
- `prisma/seed.ts` ยังเป็น stub (SCRUM-22)

## ทีม

| ชื่อ | รหัส | รับผิดชอบ |
|---|---|---|
| ซีบิว — วิธวินท์ ระวังจังหรีด | B6703165 | Frontend, AI Integration, Testing |
| บุ๊ค — ชิติพัทธ์ สีสุด | B6703271 | Product Owner, Scrum Master, Backend |
| ปอนด์ — วรรนเรศ ขุมพลกรัง | B6728120 | Backend, Database |

เอกสารออกแบบ (Master Spec, ERD, Design System Brief) เก็บนอก repo — ขอได้จาก Product Owner (บุ๊ค)
