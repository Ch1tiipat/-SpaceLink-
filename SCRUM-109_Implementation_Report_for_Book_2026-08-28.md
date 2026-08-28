# SCRUM-109 — Implementation & QA Report for Book

วันที่จัดทำ: 28 สิงหาคม 2026

ผู้รับผิดชอบ: ซีบิว (Vithavin Ravangjangreed)

Jira: SCRUM-109 — เพิ่ม AI Conversational Chat แบบสนทนาต่อเนื่อง (AI ช่วยคุณได้)

Branch: `codex/scrum-109-conversational-chat`

Base สำหรับ Pull Request: `main`

## 1. สรุปผล

พัฒนา “AI ช่วยคุณได้” ให้เป็นแชทสนทนาต่อเนื่องจริง โดยยังรักษาขอบเขตความปลอดภัยของระบบเดิม ผู้ใช้ถามต่อเนื่องได้ใน session เดียว เห็นข้อความแบบ user/assistant bubble ตามลำดับ มีสถานะกำลังคิด การเลื่อนลงข้อความล่าสุด ปุ่มเริ่มแชทใหม่ การประเมินคำตอบ และ action ที่อนุญาตเฉพาะหน้าใน SpaceLink

Backend ใช้ผู้ใช้ที่ยืนยันตัวตนจาก Supabase token เป็นเจ้าของ context เท่านั้น ไม่เชื่อ `userId` จาก client และส่งให้โมเดลเฉพาะข้อมูลที่จำเป็นต่อคำถาม เช่น ร้านของผู้ใช้ การจองของผู้ใช้ งานที่เผยแพร่ โซน บูธ และประกาศสาธารณะที่เปิดใช้งาน

## 2. ขอบเขตที่ทำ

### Frontend

- เก็บประวัติแชทไว้ใน React state เท่านั้น ไม่มีการบันทึกลงฐานข้อมูลหรือ local storage
- ส่ง conversation history สูงสุด 10 ข้อความไป backend
- แสดงข้อความ user และ SpaceLink AI ต่อเนื่องตามลำดับเวลา
- แสดงสถานะ `AI กำลังคิด…` ระหว่างรอคำตอบ
- เลื่อนลงหาข้อความล่าสุดโดยอัตโนมัติ
- ซ่อนคำถามแนะนำหลังเริ่มสนทนา เพื่อลดความรกของหน้าจอ
- ปุ่มเริ่มคำถามใหม่ล้างบทสนทนาเฉพาะ session ปัจจุบัน
- แสดงปุ่มถูกใจ/ไม่ถูกใจเฉพาะคำตอบที่สำเร็จ
- แสดง action chip เฉพาะ action ที่ backend อนุญาต
- รักษาขนาดช่องกรอกอย่างน้อย 16px เพื่อป้องกัน iOS focus zoom
- ข้อผิดพลาด config/API ถูกแปลงเป็นข้อความที่เหมาะกับผู้ใช้ โดยไม่เปิดเผยชื่อ environment variable

### Backend / AI

- endpoint ถูกป้องกันด้วย `SupabaseAuthGuard`
- ใช้ user ID จาก `CurrentUser` ซึ่งผ่านการตรวจ token ฝั่ง server แล้ว
- DTO ตรวจชนิด role/content, trim ข้อความ และจำกัด history สูงสุด 10 ข้อความ
- context ของผู้ใช้จำกัดเฉพาะร้านและการจองที่เป็นเจ้าของจริง
- context สาธารณะจำกัดเฉพาะงานที่ published/ongoing และประกาศที่ active/published
- ไม่ส่งข้อมูลสลิป ธนาคาร บทลงโทษ blacklist ข้อมูลผู้ใช้อื่น secret หรือ credential ให้โมเดล
- จำกัดขนาดและ sanitize context/history ก่อนส่งเข้าโมเดล
- ส่ง runtime context เป็น untrusted JSON และกำชับโมเดลไม่ทำตาม instruction ที่ฝังในข้อมูล
- system prompt ปฏิเสธ prompt injection การขอ secret ข้อมูลข้ามบัญชี และการอ้างว่าสั่งงานระบบแทนผู้ใช้ได้
- มี rule-based fallback เมื่อ Gemini ใช้งานไม่ได้
- action allowlist มีเฉพาะ:
  - `OPEN_EVENTS`
  - `OPEN_BOOKINGS`
  - `OPEN_PROFILE`
- ไม่มีการให้ AI อัปโหลดไฟล์ จ่ายเงิน จองบูธ อนุมัติรายการ หรือแก้ข้อมูลแทนผู้ใช้

## 3. Data flow

1. ผู้ใช้ส่งคำถามจากหน้า “AI ช่วยคุณได้”
2. Web อ่าน Supabase access token และส่ง question + history สูงสุด 10 ข้อความ
3. API ตรวจ token และระบุตัวผู้ใช้ฝั่ง server
4. API โหลดเฉพาะข้อมูลปลอดภัยที่เกี่ยวข้องจาก Prisma
5. Service สร้าง system instruction + untrusted JSON context
6. Gemini Flash ตอบคำถาม หรือใช้ rule fallback หากโมเดลไม่พร้อม
7. API คืนข้อความ แหล่งคำตอบ และ action ที่ผ่าน allowlist
8. Web เพิ่มคำตอบต่อท้ายบทสนทนาและเลื่อนไปข้อความล่าสุด

## 4. ไฟล์ implementation ที่แก้ไข (8 ไฟล์)

1. `apps/api/src/ai/README.md`
2. `apps/api/src/ai/dto/ask-support-assistant.dto.ts`
3. `apps/api/src/ai/support-assistant.controller.spec.ts`
4. `apps/api/src/ai/support-assistant.controller.ts`
5. `apps/api/src/ai/support-assistant.service.spec.ts`
6. `apps/api/src/ai/support-assistant.service.ts`
7. `apps/web/components/app-shell.tsx`
8. `apps/web/lib/api.ts`

ไฟล์รายงานฉบับนี้เป็นเอกสารส่งมอบเพิ่มเติม ไม่ใช่ production implementation

## 5. ผลตรวจสอบก่อนส่ง

| รายการ | ผล |
|---|---|
| API production build | ผ่าน |
| API TypeScript (`tsc --noEmit`) | ผ่าน |
| API ESLint | ผ่าน |
| API test suite | ผ่าน 70 suites / 623 tests |
| Web production build | ผ่าน (23 pages) |
| Web TypeScript (`tsc --noEmit`) | ผ่าน |
| Web ESLint | ผ่าน |
| `git diff --check` | ผ่าน |
| ตรวจ UI แชทบน local browser | ผ่าน |

หมายเหตุ: log warning บางรายการใน API tests เป็น expected log จาก test case ที่จำลอง fallback/audit และไม่ใช่ test failure

## 6. กรณีทดสอบสำคัญที่เพิ่ม/ยืนยัน

- request ที่ไม่มี token ถูกปฏิเสธโดย auth guard
- controller ใช้ user ID จาก authenticated user ไม่รับ identity จาก body
- history ที่เกิน 10 ข้อความไม่ผ่าน validation
- service โหลดร้าน/การจองเฉพาะเจ้าของที่เข้าสู่ระบบ
- service ไม่คืนข้อมูลของผู้ใช้อื่น
- prompt มีข้อกำหนดป้องกัน prompt injection และข้อมูลอ่อนไหว
- Gemini error สลับไป rule fallback ได้
- action ที่ response ไม่อนุญาตจะไม่ถูกส่งต่อให้หน้าเว็บ
- หน้าเว็บไม่ส่ง error response กลับเข้า history รอบถัดไป
- หน้าเว็บไม่แสดงชื่อ env/config ภายในแก่ผู้ใช้

## 7. สิ่งที่ไม่อยู่ในขอบเขต

- ไม่เพิ่มรูปภาพหรืออัปโหลดรูปในแชท
- ไม่เพิ่มเสียงหรือ voice chat
- ไม่ทำ persistent chat history
- ไม่เพิ่ม Admin AI
- ไม่เพิ่ม autonomous action หรือการสั่งจอง/ชำระเงินโดย AI
- ไม่แก้ Prisma schema และไม่มี migration
- ไม่แก้ policy หรือข้อมูล production ใน Supabase
- ไม่เพิ่ม secret หรือ API key ลง repository

## 8. ข้อจำกัดและ QA ที่แนะนำหลัง deploy preview

การทดสอบ local ยืนยันโค้ดและ UI แล้ว แต่การทดสอบ end-to-end กับ Gemini และข้อมูล Supabase จริงต้องทำบน environment ที่มีค่าระบบครบ แนะนำให้ผู้รีวิวทดสอบด้วยบัญชี Supabase จริงดังนี้:

1. เปิด AI แล้วถามวิธีเริ่มจองบูธ
2. ถามต่อโดยอ้างถึงคำตอบก่อนหน้า เพื่อยืนยัน multi-turn context
3. ถามสถานะการจองของบัญชีตนเอง
4. ขอข้อมูลของผู้ใช้รายอื่นหรือ secret และตรวจว่า AI ปฏิเสธ
5. ส่งข้อความลักษณะ prompt injection และตรวจว่าไม่ทำตาม
6. ปิด/ตัด Gemini ชั่วคราวใน test environment และตรวจ rule fallback
7. ตรวจ action chip ว่าเปิดได้เฉพาะหน้า Events, Bookings และ Profile
8. ทดสอบบน iPhone/Safari ว่าช่องกรอกไม่ซูมและข้อความล่าสุดไม่ถูก keyboard บัง

## 9. Rollback

การเปลี่ยนแปลงรวมอยู่ใน commit ของ SCRUM-109 และไม่มี database migration หากพบปัญหาหลัง merge สามารถ revert commit ของ SCRUM-109 ได้โดยไม่ต้อง rollback schema หรือข้อมูล production

## 10. ข้อสรุปสำหรับผู้รีวิว

งานอยู่ในขอบเขต SCRUM-109 และยึดหลัก least privilege: AI ใช้ข้อมูลจริงเท่าที่จำเป็น แยก private context ตาม authenticated user มี fallback เมื่อโมเดลไม่พร้อม และไม่อนุญาตให้ AI ทำ mutation หรือเปิดเผยข้อมูลอ่อนไหว งานพร้อมสำหรับ code review และ preview QA ก่อน merge
