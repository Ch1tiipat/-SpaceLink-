# SCRUM-106 — AI Assistant Chat UI Follow-up

วันที่ส่งมอบ: 28 สิงหาคม 2026

ผู้พัฒนา: ซีบิว

Jira: https://skiptv555.atlassian.net/browse/SCRUM-106

Branch: `codex/user-ai-assistant-ui-refresh`

Base: `main@5b974c1`

## 1. สรุปงาน

ปรับเฉพาะ UX/UI ของ `AI ช่วยคุณได้` ให้บทสนทนาอ่านเหมือนแชททั่วไป และแก้ปัญหาบน Desktop ที่ชุดปุ่มคำถามแนะนำดันข้อความสนทนาขึ้นจนผู้ใช้มองไม่เห็นคำถามและคำตอบล่าสุด

ผลลัพธ์:

- ข้อความผู้ใช้อยู่ด้านขวา ใช้บับเบิลสีม่วงและไอคอนผู้ใช้
- คำตอบ SpaceLink AI อยู่ด้านซ้าย ใช้บับเบิลสีขาวและไอคอน AI
- เก็บคำถามและคำตอบเดิมไว้ แล้วเรียงบทสนทนาใหม่ต่อด้านล่าง
- เลื่อน transcript ไปยังข้อความล่าสุดอัตโนมัติ
- แสดงสถานะ `กำลังตอบ…` ระหว่างรอ API
- แสดงที่มาของคำตอบว่าเป็น AI หรือคำตอบสำรอง
- เพิ่มปุ่มประเมินคำตอบ มีประโยชน์/ควรปรับปรุง
- คำถามแนะนำแสดงเฉพาะก่อนเริ่มสนทนา เมื่อผู้ใช้ส่งคำถามแล้วปุ่มจะหายไป เพื่อไม่ดันข้อความแชทออกจาก viewport
- ปุ่มเริ่มบทสนทนาใหม่บน Header ยังคงใช้ล้างประวัติและเริ่มใหม่ได้
- รองรับ Desktop และ Mobile โดยคง composer ไว้ด้านล่าง
- คงโหมด `ถามข้อมูล` และ `แนะนำโซน` รวมถึง API contract และ personalized zone flow เดิม

## 2. ไฟล์ที่แก้

1. `apps/web/components/app-shell.tsx`
   - เพิ่ม conversation history และลำดับ message
   - ปรับโครงสร้างข้อความเป็น chat bubbles ซ้าย/ขวา
   - เพิ่ม auto-scroll, loading state, source label และ feedback controls
   - จำกัดคำถามแนะนำให้แสดงเฉพาะสถานะเริ่มต้น
   - คง flow แนะนำ Event, Zone, Facilities และ Booth เดิม

2. `apps/web/app/globals.css`
   - ปรับขนาดและตำแหน่ง Floating Support Panel
   - ปรับความสูงตาม viewport และ safe area บนมือถือ
   - ป้องกัน composer ถูกบังเมื่อมี bottom navigation

3. `SCRUM-106_AI_Assistant_Chat_UI_Followup_2026-08-28.md`
   - รายงานส่งมอบฉบับนี้

ไฟล์ `SpaceLink_Seebiw_Work_Catalog_Jira_GitHub_2026-08-23.md` ที่มีอยู่ก่อนหน้าไม่ได้รวมใน Commit หรือ PR นี้

## 3. ขอบเขตและความปลอดภัย

- ไม่แก้ Backend implementation
- ไม่แก้ Prisma schema หรือ migration
- ไม่แตะ Supabase policy หรือข้อมูล Production
- ไม่เปลี่ยน API contract หรือ AI seam interface
- ไม่ติดตั้ง package ใหม่จากนอก lockfile
- ไม่เพิ่ม Secret, API key หรือ connection string
- ไม่แก้หน้า Admin, Prototype หรือ flow การจอง

## 4. Automated QA

### Web

| Gate | ผล |
|---|---|
| `npm run lint` | ผ่าน, 0 warnings/errors |
| `npx tsc --noEmit` | ผ่าน, exit 0 |
| `npm run build` | ผ่าน, 23 routes |
| `git diff --check` | ผ่าน |

### API — Definition of Done regression check

ก่อนตรวจรอบสุดท้าย ต้องรัน `npm install` ตาม lockfile หลัง `main` รับงาน Push Notification และรัน Prisma Client generation จาก postinstall เนื่องจาก worktree นี้ยังไม่มี `web-push` และ generated client ล่าสุด การติดตั้งไม่แก้ tracked dependency files

| Gate | ผล |
|---|---|
| `npm run build` | ผ่าน, exit 0 |
| `npx tsc --noEmit` | ผ่าน, exit 0 |
| `npx eslint src prisma` | ผ่าน, exit 0 |
| `npm test -- --runInBand` | ผ่าน |
| Test suites | 70/70 |
| Tests | 619/619 |

Warning/Error log ที่ปรากฏระหว่าง Jest เป็น test case จำลอง Gemini fallback, Audit failure และ Supabase network failure ทุก test จบผ่านและ process exit 0

## 5. Browser QA

ทดสอบที่ `http://127.0.0.1:4203/?uxAuth=signed-in`

- เปิด Floating Support และ AI panel ได้
- ก่อนเริ่มคุยเห็นคำถามแนะนำ 3 รายการ
- หลังเลือกคำถามแรก คำถามแนะนำหายไป
- ส่งคำถามที่สองแล้วพบ user message 2 รายการและ AI response 2 รายการใน transcript เดียวกัน
- ข้อความผู้ใช้แสดงด้านขวา และ SpaceLink AI แสดงด้านซ้าย
- Desktop ไม่ถูกปุ่มคำถามแนะนำดันข้อความล่าสุดออกจากพื้นที่มองเห็น
- Mobile viewport 390×844 ไม่เกิด horizontal overflow และ composer ยังอยู่ด้านล่าง
- API local ที่ `127.0.0.1:3002` ไม่ได้เปิด ระบบแสดง safe error message ตาม fallback UI โดยไม่เปิดเผยรายละเอียดภายใน

## 6. ข้อจำกัดที่ต้อง Smoke Test หลัง Deploy

รอบนี้ยืนยัน UX และ state management ใน Browser แล้ว แต่ยังไม่ได้ยืนยันคำตอบ Gemini จริง เพราะ local API/environment สำหรับ Gemini ไม่ได้เปิดใช้งาน

หลัง deploy ควรตรวจด้วย environment จริง:

1. เปิด `AI ช่วยคุณได้`
2. ส่งคำถามทั่วไปอย่างน้อย 2 ข้อ
3. ยืนยันว่าคำตอบจริงเรียงต่อเนื่องและ source label ถูกต้อง
4. เปลี่ยนไปโหมด `แนะนำโซน`
5. ทดสอบ Event → Zone → Facilities → Booth ด้วยบัญชี Vendor Supabase จริง
6. ตรวจว่า Gemini failure ยัง fallback ได้และไม่ทำให้ประวัติแชทหาย

## 7. Review Focus สำหรับบุ๊ค

1. ตรวจการจัดตำแหน่งบับเบิลผู้ใช้ขวาและ AI ซ้ายบน Desktop/Mobile
2. ตรวจว่าคำถามแนะนำหายหลังเริ่มสนทนา
3. ตรวจการสะสมหลายข้อความและ auto-scroll
4. ตรวจปุ่มเริ่มบทสนทนาใหม่
5. ตรวจโหมดแนะนำโซนว่า flow เดิมไม่ถูกรบกวน
6. ทำ smoke test กับ Gemini/Supabase environment จริงก่อน merge หรือ deploy

## 8. สถานะส่งมอบ

- Development: เสร็จ
- Automated QA: ผ่าน
- Browser QA: ผ่าน
- Production Gemini smoke test: รอ environment จริง
- Merge: ห้าม merge เอง รอ Book review
