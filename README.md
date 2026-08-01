# SpaceLink

แพลตฟอร์มกลางจองพื้นที่ขายของและจัดกิจกรรม — Multi-tenant SaaS PWA · องค์กร (ตลาด / ห้าง / หน่วยงาน) สมัครเข้ามาเป็นผู้เช่าระบบ ออกแบบผังสถานที่ของตัวเอง เปิดอีเวนต์ แล้วผู้ขายเข้ามาเลือกบูธ จอง แนบสลิป และได้รับการยืนยันอัตโนมัติ

> **โครงงานรายวิชา 1101910 โครงงานเทคโนโลยีดิจิทัล-1** · Software Engineering · 1/2569 · นำเสนอ 12–16 ตุลาคม 2569
> **สถานะงานปัจจุบันอยู่ที่ Jira** ไม่เก็บไว้ในไฟล์นี้

## โครงสร้างโปรเจกต์

```
spacelink/
├─ apps/api/                    NestJS + Prisma → Railway / Render (src/ + prisma/)
│  └─ prisma/
│     ├─ schema.prisma          v4 — freeze แล้ว ห้ามแก้โดยไม่ผ่านทีม
│     ├─ seed.ts                ข้อมูลตัวอย่างสำหรับรันในเครื่องตัวเอง (`npm run db:seed`)
│     ├─ migrations/            20260726142319_init — 26 ตาราง 18 enum
│     └─ sql/                   (ยังไม่มี) SQL เสริมที่ Prisma ประกาศไม่ได้
├─ apps/web/                    Next.js 14 App Router PWA → Vercel
│  ├─ app/                      layout.tsx · globals.css · page.tsx (หน้าค้นหา Event)
│  │  ├─ login/ · register/     เข้าสู่ระบบ / สมัครสมาชิก ด้วย Email OTP
│  │  └─ events/[eventId]/      รายละเอียดอีเวนต์ · `/map` ผังโซนและบูธ
│  ├─ components/               app-header · auth-layout · otp-input
│  │                            event-detail-screen · event-map-screen · zone-map
│  ├─ lib/                      api.ts · supabase.ts · auth-errors.ts · use-email-otp.ts
│  └─ public/                   icon.svg · manifest.webmanifest
├─ prototype/                   prototype เดิม ใช้อ้างอิงเท่านั้น ห้ามแก้
├─ .github/                     CI workflow + CODEOWNERS
└─ AGENTS.md · CLAUDE.md · README.md
```

แต่ละ app แยกกันสมบูรณ์ ไม่ใช่ npm workspaces ต้อง `cd` เข้าโฟลเดอร์ก่อนรัน npm ทุกครั้ง

## โมดูลใน `apps/api/src/`

แผนที่คร่าว ๆ ว่าอะไรอยู่ตรงไหน รายละเอียดกติกาของแต่ละส่วนอยู่ใน [`AGENTS.md`](./AGENTS.md)

| โฟลเดอร์ | ตรงกับ |
|---|---|
| `auth/` | Supabase token verification, guards, JIT provisioning (§7) |
| `organizations/` | องค์กร / ผู้เช่าระบบ |
| `venues/` | สถานที่ · ผังที่ใช้ซ้ำได้ |
| `zones/` | โซนในผัง |
| `booths/` | บูธ — หน่วยที่จองได้ |
| `events/` | งาน / อีเวนต์ |
| `bookings/` | การจอง |
| `slips/` | สลิปการชำระเงิน — seam `SLIP_VERIFIER` (มี `README.md` ของตัวเอง) |
| `ai/` | แนะนำโซน — seam `ZONE_RECOMMENDER` (มี `README.md` ของตัวเอง) |
| `users/` | ผู้ใช้และโปรไฟล์ |
| `health/` | health endpoints รวมถึง `/api/health/db` |
| `prisma/` | `PrismaService` |
| `common/` | decorators และ exception filter ที่ใช้ร่วมกัน (ไม่ใช่ NestJS module) |
| `config/` | ตรวจ environment variables ตอน boot (ไม่ใช่ NestJS module) |

## Tech stack

| ส่วน | ใช้อะไร |
|---|---|
| Frontend | Next.js 14 (App Router), React, Tailwind CSS, next-pwa, SVG zone map |
| Backend | NestJS (TypeScript) REST · Prisma · PostgreSQL (Supabase Pro) |
| Supabase | Auth — Email OTP / magic link (NestJS verify token ด้วย `jose`) · Storage (สลิป, รูปผัง) |
| บริการภายนอก | Gemini **Flash / Flash-Lite เท่านั้น ห้ามใช้ Pro** · SlipOK (OK BASIC) · web-push |
| Deploy | Vercel (web) · Railway หรือ Render (api) |

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

## ทีม

| ชื่อ | รหัส | รับผิดชอบ |
|---|---|---|
| ซีบิว — วิธวินท์ ระวังจังหรีด | B6703165 | AI Integration, Testing |
| บุ๊ค — ชิติพัทธ์ สีสุด | B6703271 | Product Owner, Frontend |
| ปอนด์ — วรรนเรศ ขุมพลกรัง | B6728120 | Backend, Database |

กติกาการพัฒนา, invariants, booking flow, auth flow และกติกาความปลอดภัยทั้งหมดอยู่ใน
**[`AGENTS.md`](./AGENTS.md)** — อ่านให้จบก่อนเขียนโค้ด เป็นไฟล์เดียวกับที่ AI agent ทุกตัวอ่าน
เอกสารออกแบบ (Master Spec, ERD, Design System Brief) เก็บนอก repo — ขอได้จาก Product Owner (บุ๊ค)
