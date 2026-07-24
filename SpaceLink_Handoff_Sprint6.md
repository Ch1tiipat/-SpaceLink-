# SpaceLink — เอกสารส่งต่องาน Sprint 6

**อัปเดต:** 24 กรกฎาคม 2569
**Sprint:** 6 (25 ก.ค. – 7 ส.ค. 2569)
**Repo:** https://github.com/Ch1tiipat/-SpaceLink- · branch `main`

---

## อ่านอะไรก่อน

**`AGENTS.md` ที่ root ของ repo** — เป็นกติกาทั้งหมดของโปรเจกต์ 14 หัวข้อ ทั้งคนและ AI ใช้ไฟล์เดียวกันนี้

Codex อ่านไฟล์นี้อัตโนมัติตอนเปิด session และ Claude Code ก็อ่านเหมือนกัน ไม่ต้องก๊อปกติกาไปแปะใน prompt ทุกครั้ง

ใน repo มี `CLAUDE.md` อยู่ด้วย แต่เป็น **ไฟล์ตัวชี้ทาง 5 บรรทัด** ที่ `@AGENTS.md`-import เนื้อหาจริงเข้ามา
(Claude Code อ่าน `CLAUDE.md` เป็นหลัก ส่วน Codex อ่าน `AGENTS.md`) — **ห้ามใส่กติกาลงใน `CLAUDE.md`**

> **สำคัญ:** นอกจากตัวชี้ทางนั้นแล้ว ห้ามสร้างไฟล์กติกาเพิ่ม (`.cursorrules`, `copilot-instructions.md`, `GEMINI.md`)
> สองไฟล์จะเริ่มขัดกันภายในสัปดาห์เดียว แล้ว AI จะเลือกเองว่าจะเชื่ออันไหน
> อยากแก้กติกา → แก้ `AGENTS.md` ที่เดียว แล้ว commit

### เช็คก่อนว่า AI อ่านติดจริง

ครั้งแรกที่เปิด Codex ใน repo นี้ ให้ถามคำถามนี้ **ก่อนสั่งงานจริง**:

```
Without reading any files, answer from your loaded context only:
what authentication approach does this project use, and does the API have a register endpoint?
```

| ตอบว่า | แปลว่า |
|---|---|
| Supabase Auth เป็น IdP · NestJS แค่ verify token · **ไม่มี** register/login | ✅ อ่านติด สั่งงานได้ |
| ไม่รู้ / ขอเปิดไฟล์ก่อน / ตอบมั่ว | ❌ ยังไม่ติด **อย่าให้มันแตะโค้ด** แจ้งบุ๊ค |

ถ้าปล่อยให้มันทำงานทั้งที่ไม่รู้กติกา จะแย่กว่าไม่ใช้ AI เลย — มันจะแก้ `schema.prisma`, สร้าง endpoint register, หรือลง package เพิ่มเอง โดยที่ผลลัพธ์ดูเหมือนปกติทุกอย่าง

---

## 1. ตอนนี้ทำอะไรไปแล้ว

### เสร็จแล้ว (SCRUM-18)

| งาน | ผลลัพธ์ |
|---|---|
| จัดโครง repo เป็น monorepo | `apps/api` · `prototype/` · เอกสารเก็บนอก repo |
| NestJS skeleton | build ผ่าน exit 0 |
| Prisma + schema v4 | อยู่ที่ `apps/api/prisma/schema.prisma` **ยังไม่ migrate** |
| Environment validation (Joi) | fail fast ถ้า env ขาด |
| Supabase JWT verification + guards | `SupabaseAuthGuard` · `RolesGuard` · JIT provisioning |
| Global pipes + CORS + prefix `/api` | `curl /api/auth/me` ตอบ 401 ถูกต้อง |

รวม 5 commits · merge เข้า main ผ่าน PR #1 แล้ว

### ยังไม่มี

- ❌ ฐานข้อมูลจริง — ยังไม่เคยรัน migration
- ❌ endpoint อ่าน/เขียนข้อมูลใด ๆ (SCRUM-19)
- ❌ frontend จริง — `apps/web` ยังไม่มี
- ❌ SlipOK · AI Recommendation · Web Push

---

## 2. โครงสร้าง repo

```
spacelink/
├─ apps/api/          NestJS backend
│  ├─ prisma/
│  │  └─ schema.prisma    ← v4 · ห้ามแก้ (อ่าน AGENTS.md §2.1)
│  └─ src/
│     ├─ auth/            Supabase JWT + guards + provisioning
│     ├─ common/          decorators
│     ├─ config/          env validation
│     └─ prisma/          PrismaService (global)
├─ prototype/         ต้นแบบ HTML เดิม · อ้างอิงเท่านั้น ห้ามแก้ ห้ามต่อ API
├─ AGENTS.md          กติกาสำหรับ AI ทุกตัว · เนื้อหาจริงอยู่ที่นี่
├─ CLAUDE.md          ตัวชี้ทางเท่านั้น · @AGENTS.md-import · ห้ามใส่กติกา
├─ README.md
└─ .gitignore         มี .env และ docs/
```

**เอกสารออกแบบ** (Master Spec v4, ERD, Design System, decision log) **เก็บนอก repo** — ขอจากบุ๊ค

---

## 3. งานของแต่ละคน

### ปอนด์ — สร้าง Supabase + migrate (ทำได้เลย ไม่ต้องรอใคร)

งานนี้บล็อก SCRUM-19 ทั้งหมด เพราะ endpoint อ่านข้อมูลต้องมี database จริงถึงจะเทสต์ได้

1. สร้าง project ที่ [supabase.com](https://supabase.com) — region **Singapore**, เก็บ database password ไว้ให้ดี
2. **Project Settings → Database → Connection string** — **คัดลอก ห้ามพิมพ์เอง** (pooled กับ direct ใช้ port และ username ต่างกัน พิมพ์เองจะพังแบบที่ดูเหมือนบั๊กในโค้ด)
   - Transaction pooler (port `6543`) → `DATABASE_URL` ต่อท้าย `?pgbouncer=true&connection_limit=1`
   - Session / Direct (port `5432`) → `DIRECT_URL`
3. **Project Settings → API** → `SUPABASE_URL` และ `service_role` key
4. **Project Settings → API → JWT Settings** → `SUPABASE_JWT_SECRET`
   ⚠️ **ดูด้วยว่าเป็น legacy HS256 secret หรือ asymmetric key (JWKS)** — ถ้าเป็น asymmetric ต้องแก้ `apps/api/src/auth/strategies/supabase-jwt.strategy.ts` (ตอนนี้ตั้ง `algorithms: ['HS256']`) แจ้งบุ๊คก่อนแก้
5. **Authentication → Providers → Email** เปิด OTP / magic link
   (ไม่ใช้ Phone OTP — Supabase ไม่มี SMS ให้ฟรี ต้องต่อผู้ให้บริการภายนอกซึ่งมีค่าใช้จ่ายต่อครั้ง)
6. **Storage** สร้าง bucket สำหรับสลิป ตั้งเป็น **private** (อ่าน AGENTS.md §14.1 ก่อน — สลิปมีชื่อผู้โอนและข้อมูลธนาคาร)
7. เอาค่าจริงใส่ `apps/api/.env` แทนค่าหลอก แล้ว:
   ```bash
   cd apps/api
   npx prisma migrate dev --name init
   npm run start:dev
   ```
8. เช็คใน Supabase Table Editor ว่าตารางขึ้นครบ 26 ตาราง

> `.env` อยู่ใน `.gitignore` แล้ว **ห้ามเอาออก** และห้าม commit ค่าจริงเด็ดขาด
> ถ้าเผลอ commit ไปแล้ว ต้องไปสร้าง key ใหม่ที่ Supabase ด้วย ลบ commit อย่างเดียวไม่พอ

### ซีบิว — สำรวจ SlipOK (ทำได้เลย)

SlipOK คือจุดตายของ booking flow ขั้นยืนยันอัตโนมัติ ถ้าใช้ไม่ได้ต้องรู้ตั้งแต่เนิ่น ๆ

- ลองสมัคร OK BASIC (ฟรี) ดูว่าต้องใช้เอกสารหรือข้อมูลบัญชีธนาคารอะไรบ้าง
- ดู API doc ว่ารับ input แบบไหน คืนอะไร มี rate limit ไหม
- **รายงานผลก่อน Sprint 7** ถ้าติด มี fallback อยู่แล้ว: ให้ org admin กดยืนยันเองผ่าน `isPaymentExempt` ซึ่ง schema รองรับแล้ว ไม่ต้องแก้อะไร

งาน AI Recommendation (Gemini) รอ backend ก่อน ยังไม่ต้องเริ่ม

### บุ๊ค — เคาะเรื่อง frontend + คุม SCRUM-19

ดูหัวข้อ 4

---

## 4. เรื่องที่ยังไม่ได้ตัดสินใจ

### frontend จะไปทางไหน

`prototype/` เป็น **HTML + JS ล้วน + localStorage** ไม่ใช่ Next.js ตามที่ประกาศไว้ใน P01
แปลว่า SCRUM-20/21 ไม่ใช่ "ต่อ API เข้าหน้าเดิม" แต่คือ **เขียนหน้าบ้านใหม่**

| | ทำอะไร | ได้ | เสีย |
|---|---|---|---|
| **A** | เขียน Next.js 14 ใหม่ทั้งหมด | ตรงกับ P01 · PWA มาในตัว | ~2 สัปดาห์ ชนกับช่วงทำ backend พอดี |
| **B** | เก็บ vanilla ไว้ เติม manifest + service worker แล้วต่อ API | เร็วสุด เหลือเวลาไปทำ backend | ไม่ตรงสแต็กที่ประกาศ · โค้ดจะเริ่มรกเมื่อระบบโตขึ้น |
| **C** | scaffold Next.js แล้วย้ายทีละหน้าตาม vertical slice | ตรง P01 และมีของโชว์ทุกคาบ | ต้องมีวินัย ไม่ไปไล่ทำหน้าอื่นก่อน |

**ผู้ตัดสิน:** บุ๊ค (Product Owner) · **กำหนด:** ก่อนเริ่ม SCRUM-20
**ไม่บล็อกงานปอนด์กับซีบิว** — ทำงานตัวเองต่อได้เลย

---

## 5. วิธีทำงานกับ AI (Codex / Claude Code)

กติกาเต็มอยู่ใน `AGENTS.md` §11 สรุปที่ต้องทำจริง:

1. **สั่งทีละงาน** อย่าสั่งรวบหลายอย่าง — context เต็มแล้วมันจะลืมของที่ทำไปตอนแรก
2. **1 งาน = 1 commit** — `SCRUM-19: add organizations read endpoint` พังแล้วย้อนได้แค่ก้อนเดียว
3. **อย่าเปิดโหมดอนุมัติอัตโนมัติ** ช่วงที่แตะ `prisma/` หรือ `.env` — หน้าจอขออนุมัติคือด่านสุดท้ายที่กันของพัง
4. **ให้มัน paste output จริง** พร้อม exit code อย่ารับคำว่า "เสร็จแล้ว" เฉย ๆ
5. **แก้ error ไม่ผ่าน 2 รอบ → หยุดอ่านเอง** อย่าปล่อยให้วน
6. **หลังทุกงาน เปิด `git diff` ดูด้วยตา** โดยเฉพาะ `schema.prisma` ต้องไม่มีอะไรเปลี่ยน

> **บทเรียนจริงจาก SCRUM-18:** Step 1 ติดตั้ง dependency ไม่ครบ (`class-validator`, `class-transformer` หาย)
> ตอนนั้นอ่าน output ผ่าน ๆ เลยไม่เห็น ไปเจอตอน Step 5 พอดี — ถ้าไม่ชนก็จะไปเจอตอน demo แทน
> **ทุกครั้งที่ลง package จบ ให้เปิด `package.json` ดูเองด้วยตา ใช้เวลา 5 วินาที**

---

## 6. ข้อห้าม 5 ข้อ

| # | ห้าม | เพราะ |
|---|---|---|
| 1 | แก้ `apps/api/prisma/schema.prisma` | v4 ผ่านการรีวิวเทียบ requirement 90 รายการแล้ว (SCRUM-16) แก้เองเมื่อไหร่ งานรีวิวเสียเปล่าทันที — จะแก้ต้องคุยกันในทีมก่อน |
| 2 | commit `.env` | มี service role key ที่ bypass RLS ทั้งหมด · repo เป็น public |
| 3 | แก้ไฟล์ใน `prototype/` | เป็นผลงาน Sprint 4 ที่ต้องเก็บไว้เป็นหลักฐาน |
| 4 | ใช้ Gemini tier Pro | คุมงบ — ใช้ได้แค่ Flash / Flash-Lite |
| 5 | สร้าง endpoint register / login | Supabase Auth ออก token ให้ NestJS แค่ verify (อ่าน AGENTS.md §7) |

---

## 7. คำที่เลิกใช้แล้ว

ถ้าเจอในตั๋วเก่า คอมเมนต์เก่า หรือเอกสารเก่า — ถือว่าล้าสมัย

| คำเก่า | ใช้จริง |
|---|---|
| `slot` | `Booth` |
| `tenant` | `Organization` |
| `BoothHold` (ตารางแยก) | `Booking.holdExpiresAt` |
| ขั้นตอน manual approval | ไม่มีแล้ว — ยืนยันอัตโนมัติผ่าน SlipOK |
| Cloudinary | Supabase Storage |
| Phone OTP | Email OTP |

---

## 8. Definition of Done

งานจะถือว่าเสร็จเมื่อครบทุกข้อ:

- [ ] `npm run build` ที่ `apps/api` exit 0
- [ ] `git diff apps/api/prisma/schema.prisma` ว่างเปล่า
- [ ] `git status` ไม่มี `.env`
- [ ] commit message ขึ้นต้นด้วยรหัส ticket
- [ ] เปิด PR และให้เพื่อนในทีมกด approve อย่างน้อย 1 คนก่อน merge
- [ ] อัปเดตสถานะใน Jira

> ข้อ "ให้เพื่อน approve" ไม่ใช่พิธีกรรม — มคอ.3 คาบ 8–9 ให้คะแนน *"การทดสอบและทวนสอบของทีมพัฒนา"* โดยตรง PR review คือหลักฐานชิ้นนั้น

---

## 9. ถัดไป

| Ticket | งาน | รออะไร |
|---|---|---|
| SCRUM-19 | Endpoint อ่านข้อมูล (organizations/venues/zones/booths/events/bookings) | รอปอนด์ทำ Supabase เสร็จ |
| SCRUM-20 | Setup Next.js 14 + Tailwind + next-pwa | รอบุ๊คเคาะเรื่อง frontend |
| SCRUM-21 | หน้า Discovery + Zone Map ต่อ API จริง | รอ SCRUM-19 + 20 |
| SCRUM-22 | เตรียม seed / test data สำหรับ demo | ทำคู่กับ SCRUM-19 ได้ |

**หมุดเวลาที่ต้องระวัง:** มคอ.3 คาบ 10 (4 ก.ย.) คือ *"การทดสอบและทวนสอบร่วมกับผู้มีส่วนเกี่ยวข้อง"* — ต้องมีระบบที่ผู้ใช้จริงกดใช้ได้ภายในวันนั้น ไม่ใช่ 12 ต.ค.
