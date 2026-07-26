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
│     ├─ seed.ts                โครงเปล่า ยังไม่ insert อะไร (SCRUM-22)
│     ├─ migrations/            (ยังไม่มี — ยังไม่เคยรัน migration)
│     └─ sql/                   (ยังไม่มี) SQL เสริมที่ Prisma ประกาศไม่ได้
├─ prototype/                   prototype เดิม ใช้อ้างอิงเท่านั้น ห้ามแก้
├─ .github/                     CI workflow + CODEOWNERS
└─ AGENTS.md · CLAUDE.md · README.md
```

`apps/web` (Next.js 14 PWA → Vercel) **ยังไม่มี** — SCRUM-20 · แต่ละ app แยกกันสมบูรณ์ ไม่ใช่ npm workspaces ต้อง `cd` เข้าโฟลเดอร์ก่อนรัน npm ทุกครั้ง

## Tech stack

| ส่วน | ใช้อะไร |
|---|---|
| Frontend | Next.js 14 (App Router), React, Tailwind CSS, next-pwa, SVG zone map |
| Backend | NestJS (TypeScript) REST · Prisma · PostgreSQL (Supabase Pro) |
| Supabase | Auth — Email OTP / magic link (NestJS verify token ด้วย `jose`) · Storage (สลิป, รูปผัง) |
| บริการภายนอก | Gemini **Flash / Flash-Lite เท่านั้น ห้ามใช้ Pro** · SlipOK (OK BASIC) · web-push |
| Deploy | Vercel (web) · Railway หรือ Render (api) |

## เริ่มต้นใช้งาน

```bash
cd apps/api            # ต้องมี Node.js 20+ และ npm
npm install
cp .env.example .env   # เติมค่าจริงจาก Supabase dashboard (คัดลอกมา ห้ามพิมพ์เอง)
npx prisma generate
npm run build          # ต้อง exit 0
npm run start:dev
```

ยังไม่มีฐานข้อมูล → endpoint ที่ query จริงจะ error แต่เซิร์ฟเวอร์ต้อง boot ขึ้นได้ตามปกติ
ตัวตรวจงานคือ 4 gate: `npm run build` · `npx tsc --noEmit` · `npx eslint src prisma` · `npm test`
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
