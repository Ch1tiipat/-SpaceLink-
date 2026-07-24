# SpaceLink

แพลตฟอร์มกลางจองพื้นที่ขายของและจัดกิจกรรม — Multi-tenant SaaS PWA

องค์กร (ตลาด / ห้าง / หน่วยงาน) สมัครเข้ามาเป็นผู้เช่าระบบ ออกแบบผังสถานที่ของตัวเอง เปิดอีเวนต์ แล้วผู้ขายเข้ามาเลือกบูธ จอง แนบสลิป และได้รับการยืนยันอัตโนมัติ

> **โครงงานรายวิชา 1101910 โครงงานเทคโนโลยีดิจิทัล-1** · สาย Software Engineering · ภาคการศึกษา 1/2569
> นำเสนอโครงงาน 12–16 ตุลาคม 2569

---

## สถานะปัจจุบัน

| ส่วน | สถานะ |
|---|---|
| ออกแบบสถาปัตยกรรมระบบ | เสร็จ |
| ERD 3 ระดับ + `schema.prisma` v4 | เสร็จ (freeze แล้ว — 26 models / 18 enums) |
| รีวิว schema เทียบ requirement (SCRUM-16) | เสร็จ |
| Frontend prototype | มีแล้ว แต่ยังใช้ `localStorage` และยังจองระดับ Zone (ต้องแก้เป็น Booth) |
| Supabase project | **ยังไม่สร้าง** |
| ฐานข้อมูลจริง | **ยังไม่มี** — ยังไม่เคยรัน migration |
| Backend API | ยังไม่เริ่ม (Sprint 6 · SCRUM-18) |

---

## โครงสร้างโปรเจกต์

```
spacelink/
├─ apps/
│  ├─ web/                Next.js 14 + Tailwind + next-pwa   → Vercel
│  └─ api/                NestJS + Prisma                    → Railway / Render
│     └─ prisma/
│        ├─ schema.prisma   v4 — ห้ามแก้โดยไม่ผ่านทีม
│        ├─ migrations/
│        ├─ sql/            SQL เสริมที่ Prisma ประกาศไม่ได้
│        └─ seed.ts
├─ AGENTS.md              กติกาสำหรับ AI coding agent ทุกตัว (Codex, Claude Code)
├─ CLAUDE.md              ตัวชี้ทาง 5 บรรทัด — import AGENTS.md · ห้ามใส่กติกาในนี้
└─ README.md
```

`apps/web` กับ `apps/api` **แยกกันสมบูรณ์** — มี `package.json` และ `node_modules` ของตัวเอง ไม่ใช่ npm workspaces
ก่อนรันคำสั่ง npm ทุกครั้งต้อง `cd` เข้าโฟลเดอร์ของ app นั้นก่อน

---

## Tech stack

| ส่วน | ใช้อะไร |
|---|---|
| Frontend | Next.js 14 (App Router), React, Tailwind CSS, next-pwa, SVG zone map |
| Backend | NestJS (TypeScript), REST |
| ORM / DB | Prisma + PostgreSQL (Supabase Pro) |
| ไฟล์ | Supabase Storage (สลิป, รูปผัง) |
| Auth | Supabase Auth — Email OTP / magic link (NestJS เป็นฝ่าย verify token เท่านั้น) |
| AI | Gemini API — **Flash / Flash-Lite เท่านั้น** (ห้ามใช้ Pro) |
| ตรวจสลิป | SlipOK API (OK BASIC) |
| แจ้งเตือน | web-push + VAPID |
| Deploy | Vercel (web) · Railway หรือ Render (api) |

งบประมาณ ~1,000–1,500 บาท/เดือน — ห้ามเพิ่มบริการที่มีค่าใช้จ่ายโดยไม่คุยกันก่อน

---

## เริ่มต้นใช้งาน

ต้องมี **Node.js 20+** และ **npm**

### Frontend

```bash
cd apps/web
npm install
npm run dev          # http://localhost:3000
```

### Backend

```bash
cd apps/api
npm install
cp .env.example .env   # แล้วเติมค่าจริง (ดูหัวข้อถัดไป)
npx prisma generate
npm run build
npm run start:dev
```

> ตอนนี้ยังไม่มีฐานข้อมูล → `npm run start:dev` จะต่อ database ไม่ติดจนกว่าจะทำขั้นตอนด้านล่างเสร็จ
> ระหว่างนี้ใช้ `npm run build` เป็นตัวตรวจว่าโค้ดถูกต้อง

---

## ตั้งค่า Supabase (ยังไม่ได้ทำ — ทำครั้งเดียว)

1. สร้าง project ใหม่ที่ [supabase.com](https://supabase.com) — เลือก region **Singapore** และตั้ง database password ให้เก็บไว้ดี ๆ
2. ไปที่ **Project Settings → Database → Connection string** แล้ว **คัดลอก** (ห้ามพิมพ์เอง):
   - **Transaction pooler** (port `6543`) → `DATABASE_URL` ต่อท้ายด้วย `?pgbouncer=true&connection_limit=1`
   - **Session / Direct** (port `5432`) → `DIRECT_URL`
3. ไปที่ **Project Settings → API** เอา `SUPABASE_URL` และ `service_role` key
4. ไปที่ **Project Settings → API → JWT Settings** เอา `SUPABASE_JWT_SECRET`
5. เปิด **Authentication → Providers → Email** และตั้งค่า OTP / magic link
   (Phone OTP ต้องต่อ SMS provider เสียเงิน — ยังไม่ใช้ในเฟสนี้)
6. สร้าง bucket ใน **Storage** สำหรับสลิป และตั้ง policy เป็น private (ห้ามให้ vendor คนอื่นเปิดดูสลิปกันได้)
7. กลับมาที่ `apps/api` แล้วรัน migration ครั้งแรก:
   ```bash
   npx prisma migrate dev --name init
   psql "$DIRECT_URL" -f prisma/sql/<ไฟล์ SQL เสริม>
   ```

### ตัวแปร environment (`apps/api/.env`)

```
DATABASE_URL=
DIRECT_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
PORT=3000
```

**`.env` ห้าม commit** — ใส่ค่าจริงได้เฉพาะในไฟล์นี้ ส่วน `.env.example` ใส่ได้แค่ค่าเปล่า
`SUPABASE_SERVICE_ROLE_KEY` ใช้ได้เฉพาะฝั่ง backend ห้ามหลุดไป `apps/web` หรือตัวแปรที่ขึ้นต้นด้วย `NEXT_PUBLIC_` เด็ดขาด

---

## Deploy

| App | Platform | Root Directory | หมายเหตุ |
|---|---|---|---|
| `apps/web` | Vercel | `apps/web` | ตั้ง env ที่หน้า Project Settings |
| `apps/api` | Railway / Render | `apps/api` | build `npm run build` · start `npm run start:prod` |

ทั้งสองที่ตั้ง Root Directory ให้ชี้เข้าโฟลเดอร์ app ได้เลย ไม่ต้องแก้ install command

---

## แนวทางการทำงาน

- **`schema.prisma` freeze แล้ว** — ถ้าจะแก้ต้องคุยกันในทีมก่อน ห้ามแก้ระหว่างเขียน feature
- **ห้ามใช้คำเก่า** — ไม่มี `slot` (เป็น `Booth`), ไม่มี `tenant` (เป็น `Organization`), ไม่มีขั้นตอน manual approval แล้ว
- ตั้งชื่อ branch: `feat/SCRUM-18-nestjs-skeleton`
- commit message: `SCRUM-18: setup NestJS + Prisma skeleton` (1 ticket = 1 commit ให้ย้อนได้)
- ทุก module ใน NestJS ใช้รูปแบบเดียวกัน: `x.module.ts` / `x.controller.ts` / `x.service.ts` / `dto/`
- โค้ดและ comment เป็นภาษาอังกฤษ ข้อความบน UI เป็นภาษาไทย

รายละเอียดทั้งหมด (invariants 9 ข้อ, booking flow, auth flow, naming convention, กติกาความปลอดภัย) อยู่ใน **[`AGENTS.md`](./AGENTS.md)** — อ่านก่อนเริ่มเขียนโค้ด และเป็นไฟล์เดียวกับที่ AI agent ทุกตัวอ่าน

---

## ทีม

| ชื่อ | รหัส | รับผิดชอบ |
|---|---|---|
| ซีบิว — วิธวินท์ ระวังจังหรีด | B6703165 | AI Integration, Testing |
| บุ๊ค — ชิติพัทธ์ สีสุด | B6703271 | Product Owner, Frontend |
| ปอนด์ — วรรณเรศ ขุมพลกรัง | B6728120 | Backend, Database |

---

## เอกสารโครงงาน

เอกสารออกแบบทั้งหมด (Master Spec, ERD 3 ระดับ, Design System Brief, decision log, รายงานสถานะ)
**เก็บแยกนอก repo นี้** ไม่ได้อยู่ใน version control

สมาชิกในทีมและอาจารย์ผู้สอนขอเข้าถึงได้จาก Product Owner (บุ๊ค)

ส่วนกติกาการพัฒนา โครงสร้างข้อมูล และ convention ที่ต้องใช้เขียนโค้ด อยู่ใน [`AGENTS.md`](./AGENTS.md) ครบแล้ว
