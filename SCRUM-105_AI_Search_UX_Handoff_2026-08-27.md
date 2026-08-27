# SCRUM-105 — AI ช่วยคุณได้ / Event Dropdown / Zone Badge / Auth FAB

วันที่ส่งมอบ: 27 สิงหาคม 2026

ผู้พัฒนา: ซีบิว

Jira: [SCRUM-105](https://skiptv555.atlassian.net/browse/SCRUM-105)

Branch: `codex/user-ai-search-ux-followup`

Base: `main@355d356`

## 1. ขอบเขตงาน

งานนี้ทำเฉพาะ 4 รายการที่ได้รับอนุมัติ:

1. เปลี่ยน “คำถามที่พบบ่อย” เป็น “AI ช่วยคุณได้” และเชื่อม Gemini 3.6 Flash ผ่าน backend
2. ป้องกันป้ายรหัส Zone เช่น `ZONE-A` ตัดบรรทัด
3. เปลี่ยนช่องค้นหางานหรือสถานที่จาก native datalist เป็น dropdown รูปแบบเดียวกับตัวเลือกพื้นที่
4. ไม่แสดง Floating Action Button และหน้าต่าง AI บนหน้า Login/Register

ไม่มีการแก้ Prisma schema, migration, database, package, authentication architecture หรือ deployment setting นอกขอบเขต

## 2. สิ่งที่พัฒนา

### 2.1 AI ช่วยคุณได้

- เพิ่ม public endpoint `POST /api/ai/support` และกำหนด HTTP 200
- request รับเฉพาะ `question` ผ่าน DTO validation
- frontend ส่งเฉพาะข้อความคำถามไป backend
- backend เรียกโมเดลจาก `GEMINI_SUPPORT_MODEL` โดยค่าเริ่มต้นเป็น `gemini-3.6-flash`
- validation อนุญาตเฉพาะ Gemini Flash/Flash-Lite และปฏิเสธ Pro tier
- system prompt จำกัดคำตอบให้อยู่ในความรู้การใช้งาน SpaceLink แบบสาธารณะ
- ไม่ให้ AI อ้างว่าสามารถอ่านบัญชี ข้อมูลส่วนตัว การจอง หรือสลิปของผู้ใช้
- รองรับ rule-based fallback เมื่อปิด Gemini, timeout, quota เต็ม, network error หรือ response ไม่ถูกต้อง
- response ระบุแหล่งคำตอบเป็น `AI_GEMINI` หรือ `RULE_BASED`
- หน้าเว็บแสดง badge ให้ผู้ใช้ทราบว่าเป็น Gemini หรือคำตอบสำรอง
- API key อยู่ backend เท่านั้น และไม่มี `NEXT_PUBLIC_GEMINI_API_KEY`

### 2.2 Event/Venue dropdown

- ใช้ `SelectMenu` เดิมของระบบแทน native `datalist`
- option แสดงชื่องานเป็น label และชื่อสถานที่เป็น hint
- ข้อมูลมาจาก Event discovery API ที่หน้าแรกใช้อยู่แล้ว
- มีตัวเลือก “งานหรือสถานที่ทั้งหมด”
- ตัวกรองเดิมยังรองรับพื้นที่และหมวดสินค้า

### 2.3 Zone badge

- เพิ่มความกว้างขั้นต่ำ 76 px
- เพิ่ม `shrink-0` และ `whitespace-nowrap`
- ป้ายรหัส Zone ไม่ถูกบีบหรือแยกเป็นหลายบรรทัดเมื่อข้อความยาวขึ้น

### 2.4 Login/Register และ Super Admin

- `/login` และ `/register` return bare layout ก่อน render `FloatingSupport`
- รักษา `isSuperAdminRoute` guard ที่เพิ่มจาก SCRUM-89 ไว้ครบหลัง rebase
- หน้า User ปกติยังมี AI/FAB ตามขอบเขตเดิม

## 3. ไฟล์ implementation 13 ไฟล์

### API — 10 ไฟล์

1. `apps/api/.env.example`
2. `apps/api/src/ai/README.md`
3. `apps/api/src/ai/ai.module.ts`
4. `apps/api/src/ai/dto/ask-support-assistant.dto.ts`
5. `apps/api/src/ai/support-assistant.controller.spec.ts`
6. `apps/api/src/ai/support-assistant.controller.ts`
7. `apps/api/src/ai/support-assistant.service.spec.ts`
8. `apps/api/src/ai/support-assistant.service.ts`
9. `apps/api/src/config/env.validation.spec.ts`
10. `apps/api/src/config/env.validation.ts`

### Web — 3 ไฟล์

11. `apps/web/app/page.tsx`
12. `apps/web/components/app-shell.tsx`
13. `apps/web/lib/api.ts`

ไฟล์ฉบับนี้เป็นรายงาน QA/Handoff เพิ่มจาก implementation ตามขั้นตอนส่งงานของทีม

## 4. Rebase และ conflict resolution

- ตรวจ GitHub โดยตรงพบ `main@355d356`
- rebase `codex/user-ai-search-ux-followup` บน `origin/main` สำเร็จ
- commit เดิมของ SCRUM-92 ถูกตัดออกจาก branch เพราะ merge เข้า main แล้ว
- มี content conflict เพียงไฟล์ `apps/web/components/app-shell.tsx`
- แก้ conflict โดยเก็บทั้ง:
  - `isSuperAdminRoute` จาก SCRUM-89
  - `BARE_ROUTES` สำหรับ Login/Register จาก SCRUM-105
- ตรวจไม่พบ conflict marker เหลือ

## 5. Environment สำหรับเปิด Gemini จริง

ตั้งค่าที่ backend deployment เท่านั้น:

```env
SUPPORT_ASSISTANT=gemini
GEMINI_SUPPORT_MODEL=gemini-3.6-flash
GEMINI_API_KEY=<backend secret>
```

ข้อควรระวัง:

- ห้ามใส่ key จริงใน `.env.example`, source code, log, commit หรือ PR
- ห้ามสร้างตัวแปร `NEXT_PUBLIC_GEMINI_API_KEY`
- ถ้าไม่ได้เปิด `SUPPORT_ASSISTANT=gemini` ระบบใช้ rule-based response โดยไม่ทำให้ UI ล้ม

## 6. ผล QA หลัง rebase

### API

- `npx prisma generate`: ผ่าน — Prisma Client 6.19.3 สร้างสำเร็จ
- `npm run build`: exit code 0
- `npx tsc --noEmit`: exit code 0
- `npx eslint src prisma`: exit code 0
- `npm test -- --runInBand`: exit code 0
- Test suites: **65 passed / 65 total**
- Tests: **586 passed / 586 total**
- Snapshots: 0

หมายเหตุ: รอบแรกหลัง rebase build ไม่ผ่านเพราะ local Prisma client ยังไม่รู้จัก `AuditLog` ที่มาจาก main ใหม่ แก้ด้วยคำสั่งที่อนุญาต `npx prisma generate` แล้วรันชุด QA ใหม่ทั้งหมดผ่าน โดยไม่มีการแก้ schema

### Web

- `npm run build`: exit code 0
- สร้างหน้า Next.js สำเร็จ **18 หน้า**
- `npx tsc --noEmit`: exit code 0
- `npm run lint`: exit code 0
- ESLint: ไม่มี warning หรือ error

### Browser smoke test

- หน้า User มี combobox “งานหรือสถานที่”
- dropdown แสดงชื่องานและชื่อสถานที่จาก mock API
- หน้า User เปิดเมนูและหน้าต่าง “AI ช่วยคุณได้” ได้
- `/login`: AI text count 0, FAB count 0
- `/register`: AI text count 0, FAB count 0
- `/super-admin`: AI text count 0, FAB count 0 และ guard จาก main ยังทำงาน
- browser console: ไม่พบ error หรือ warning

### Repository checks

- ไม่แก้ Prisma schema
- ไม่ติดตั้ง package
- ไม่แก้ lockfile
- ไม่พบ secret ของ Gemini ใน frontend
- ไม่รวม `SpaceLink_Seebiw_Work_Catalog_Jira_GitHub_2026-08-23.md` เพราะเป็นไฟล์ผู้ใช้ที่อยู่นอกขอบเขต

## 7. ข้อจำกัดที่ต้องแจ้ง reviewer

ยังไม่ได้ยิง request จริงไป Gemini เพราะ local environment ไม่มี `GEMINI_API_KEY` จริง Unit tests ครอบคลุม model URL, header, response parsing, guardrail และ fallback แล้ว แต่ผู้ดูแล deployment ต้องตั้ง environment และทำ smoke test ด้วย key จริงหนึ่งรอบก่อนถือว่า production AI verification เสร็จสมบูรณ์

## 8. Reviewer checklist

- [ ] ตรวจข้อความ “AI ช่วยคุณได้” และ quick questions
- [ ] ตรวจ Event/Venue dropdown กับข้อมูลจริง
- [ ] ตรวจ Zone badge ด้วย code ที่ยาว เช่น `ZONE-A`
- [ ] ตรวจ Login/Register ไม่มี FAB
- [ ] ตรวจ Super Admin layout ไม่ถูก AppShell ฝั่ง User ครอบ
- [ ] ตั้ง backend environment ใน preview ที่ปลอดภัย
- [ ] smoke test Gemini จริงโดยไม่เปิดเผย key
- [ ] ตรวจ CI ของ API และ Web ก่อน merge
