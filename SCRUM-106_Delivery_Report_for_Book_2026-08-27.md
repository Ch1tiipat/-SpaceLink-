# SCRUM-106 — Delivery Report for Book

วันที่ส่งมอบ: 27 สิงหาคม 2026
ผู้พัฒนา: ซีบิว
Jira: https://skiptv555.atlassian.net/browse/SCRUM-106
Type: Story
Epic: SCRUM-8 — AI Integration
Priority: High
Story points: 10
Labels: `frontend`, `backend`, `ai`, `mobile`, `ux`, `security`

## 1. สรุปผลลัพธ์

งาน SCRUM-106 เพิ่มความสามารถให้ User flow สามส่วน:

1. หน้า Login/Register บนมือถือกระชับขึ้นและเข้าถึง Form ได้เร็วขึ้น
2. หน้าแรกเลื่อนดู Event/ข่าวสารได้ด้วยการปัดและปุ่ม Previous/Next
3. `AI ช่วยคุณได้` รองรับขั้นตอนแนะนำโซนและบูธแบบ personalized โดยอ่านเฉพาะร้านของบัญชีที่เข้าสู่ระบบ เลือก Event โซน และอุปกรณ์ ก่อนคืนบูธที่ว่างจริง

ไม่มีการแก้ Prisma schema, migration, Prototype, Admin UX, Supabase policy หรือข้อมูล Production

## 2. Mobile Authentication UX

ไฟล์หลัก: `apps/web/components/auth-layout.tsx`

- ลดความสูง Hero บนหน้าจอเล็ก
- ลดระยะห่าง Brand → Eyebrow → Heading → Description
- ปรับ Heading เป็น 25px บนมือถือและคงขนาดใหญ่ขึ้นบน `sm`
- ลดระยะด้านล่างและยก Form card ให้ต่อเนื่องกับ Hero
- คง Input ขนาด 16px จาก implementation เดิมเพื่อป้องกัน iOS focus zoom
- Login/Register ยังถูกจัดเป็น `BARE_ROUTES` จึงไม่มี Floating AI/FAB
- Desktop two-column layout ไม่ถูกเปลี่ยนโครงสร้าง

## 3. Latest Event Carousel

ไฟล์หลัก: `apps/web/app/page.tsx`

- ยกเลิกการตัดรายการเหลือ 3 รายการ
- Search result แสดง Event ที่ตรงทั้งหมด
- Event และประกาศแสดงใน horizontal scroll container
- เพิ่ม `scroll-snap` เพื่อให้ Card หยุดตรงตำแหน่งอ่านง่าย
- รองรับการปัดนิ้วบนมือถือ
- เพิ่มปุ่ม Previous/Next พร้อม `aria-label`
- Card ปรับความกว้างตาม viewport:
  - มือถือประมาณ 86% ของพื้นที่
  - Tablet สอง Card
  - Desktop สาม Card
- Filter ทั้งหมด / Event / ประกาศยังทำงานเหมือนเดิม
- Card สูงเท่ากันในแต่ละแถวและยังเปิด Event detail ได้

## 4. Personalized Booth AI Flow

ไฟล์หลัก: `apps/web/components/app-shell.tsx`, `apps/web/lib/api.ts`

คำถามที่มีเจตนาแนะนำโซนหรือบูธจะไม่ถูกส่งไปยัง public support endpoint โดยตรง แต่เริ่ม flow ต่อไปนี้:

1. ตรวจว่าผู้ใช้เข้าสู่ระบบ
2. อ่าน Supabase session token จาก Browser
3. เรียก `GET /auth/me` เพื่ออ่านร้านของบัญชีปัจจุบัน
4. โหลด Event ที่ยังเปิดให้จอง
5. ให้ผู้ใช้เลือก Event
6. โหลด Event map และให้เลือกโซน หรือเลือก “ให้ AI เลือกทุกโซน”
7. ให้เลือกอุปกรณ์ได้หลายรายการ:
   - ปลั๊กไฟ
   - โต๊ะ
   - น้ำประปา
   - Wi-Fi
8. เรียก protected endpoint `POST /events/:eventId/recommendations`
9. แสดงผลสูงสุด 3 บูธ พร้อมหมายเลขบูธ โซน เหตุผล และลิงก์เปิดแผนผัง
10. แสดง source เป็น `Gemini Flash` หรือ `Rule-based`

กรณีไม่มี Supabase configuration ใน UX preview ระบบแสดงข้อความอธิบายว่าต้องเข้าสู่ระบบจริง แทนการเปิดเผยข้อความ configuration error ดิบ

คำถามทั่วไปยังใช้ `POST /ai/support` และยังมี rule-based fallback เมื่อ Gemini ไม่พร้อม

## 5. Backend Contract

เพิ่ม optional fields ใน `ZoneRecommendationInput` และ DTO:

```ts
preferredZoneId?: string;
requiredFacilities?: string[];
```

Validation:

- `preferredZoneId` ต้องเป็น UUID เมื่อส่งมา
- `requiredFacilities` ต้องเป็น array ของ string
- ไม่เกิน 8 รายการ
- ไม่ซ้ำกัน
- แต่ละรายการยาวไม่เกิน 80 ตัวอักษร
- Controller trim และ deduplicate ซ้ำก่อนส่งเข้า recommender

การเพิ่ม field เป็น backward-compatible เพราะ caller เดิมไม่จำเป็นต้องส่งค่า

## 6. Rule-based Ranking

ไฟล์หลัก: `apps/api/src/ai/providers/rule-based-recommender.ts`

สัญญาณจัดอันดับประกอบด้วย:

- หมวดสินค้าที่ตรงกับ Zone
- ราคาบูธเทียบค่ากลางของบูธว่างใน Event
- Zone ที่ผู้ใช้เลือก
- อุปกรณ์ที่ตรงกับความต้องการ

คะแนนถูก normalize ให้อยู่ในช่วง 0–100 และยังคง deterministic ไม่มี `Math.random()` หรือข้อมูลที่โมเดลสร้างเอง

รองรับ facility aliases ภาษาไทยและอังกฤษ เช่น:

- ปลั๊ก, ปลั๊กไฟ, ไฟฟ้า, power, socket, outlet
- โต๊ะ, table
- น้ำ, น้ำประปา, water
- Wi-Fi, ไวไฟ, internet

หาก `Booth.facilities` เป็น `null` เหตุผลจะระบุว่า “ผู้จัดยังไม่ระบุข้อมูลอุปกรณ์” หากข้อมูลระบุ `available: false` หรือ `enabled: false` จะไม่ถูกนับว่าเป็นอุปกรณ์ที่มี

## 7. Gemini Safety

Gemini adapter ส่งเฉพาะข้อมูลสาธารณะหรือข้อมูลเชิงเทคนิคที่จำเป็น:

- Booth ID / code
- Zone ID / code / name
- ราคา
- หมวดสินค้า
- Facilities
- Zone preference และ facilities ที่ผู้ใช้เลือก

ไม่ส่ง:

- `vendorUserId`
- ชื่อผู้ใช้
- อีเมล
- เบอร์โทร
- ข้อมูลการจองส่วนตัว
- สลิปหรือข้อมูลธนาคาร
- Gemini API key ไปยัง Browser

Gemini ถูกบังคับให้คืนเฉพาะ Booth จาก candidate list หากคืนบูธที่ไม่มีจริงหรือจองไม่ได้ ระบบจะปฏิเสธผลและใช้ rule-based fallback

## 8. Authorization และ Privacy

Endpoint recommendation ยังคงใช้ `SupabaseAuthGuard`

Controller ค้นหาร้านด้วยเงื่อนไข:

```ts
where: { id: input.shopId, ownerUserId: vendor.id }
```

ดังนั้น Browser ไม่สามารถส่ง `shopId` ของผู้ใช้อื่นเพื่ออ่านหมวดสินค้าได้ และ missing shop กับร้านของคนอื่นตอบแบบเดียวกันเพื่อลดการเปิดเผยข้อมูล

Category subset ที่ Browser ส่งมาต้องเป็น Category ของร้านนั้นจริง ไม่เช่นนั้น API ตอบ Bad Request

## 9. Candidate Booth Safety

Recommendation คืนได้เฉพาะ Booth ที่:

- อยู่ใน Venue ของ Event
- มีสถานะ `AVAILABLE`
- ไม่มี Booking สถานะ `PENDING_PAYMENT`
- ไม่มี Booking สถานะ `CONFIRMED`
- อยู่ใน candidate list ที่ Backend สร้าง

Logic ถูกบังคับทั้งใน Prisma query และ TypeScript filter เพื่อให้ unit test ตรวจ invariant ได้โดยไม่ต้องใช้ฐานข้อมูลจริง

## 10. ไฟล์ Implementation 13 ไฟล์

### Web

1. `apps/web/components/auth-layout.tsx`
2. `apps/web/app/page.tsx`
3. `apps/web/components/app-shell.tsx`
4. `apps/web/lib/api.ts`

### API

5. `apps/api/src/ai/dto/create-recommendation.dto.ts`
6. `apps/api/src/ai/recommendations.controller.ts`
7. `apps/api/src/ai/zone-recommender.interface.ts`
8. `apps/api/src/ai/providers/rule-based-recommender.ts`
9. `apps/api/src/ai/providers/gemini-recommender.ts`
10. `apps/api/src/ai/recommendations.controller.spec.ts`
11. `apps/api/src/ai/providers/rule-based-recommender.spec.ts`
12. `apps/api/src/ai/providers/gemini-recommender.spec.ts`
13. `apps/api/src/ai/README.md`

รายงานฉบับนี้เป็นไฟล์ส่งมอบลำดับที่ 14

## 11. Automated QA

ผลตรวจจากโค้ดสุดท้ายก่อน Commit:

| Gate | ผล |
|---|---|
| API `npm run build` | ผ่าน |
| API `npx tsc --noEmit` | ผ่าน |
| API `npx eslint src prisma` | ผ่าน |
| API `npm test -- --runInBand` | ผ่าน |
| API test suites | 65/65 |
| API tests | 587/587 |
| Web `npm run build` | ผ่าน |
| Web TypeScript | ผ่าน |
| Web ESLint สำหรับไฟล์ที่แก้ | ผ่าน |
| `git diff --check` | ผ่าน |
| Implementation file count | 13 ไฟล์ตรงตามขอบเขต |

Log ระหว่าง API tests มีข้อความจำลอง error/warning จาก test cases ของ Audit, Supabase Admin API และ Gemini fallback แต่ Jest จบด้วย exit code 0 และทุก test ผ่าน ข้อความเหล่านี้เป็น expected test behavior ไม่ใช่ Production failure

## 12. Browser QA

- เปิด Login และ Register ได้
- Form controls และ heading มี accessible names
- Login/Register ไม่มี Floating AI/FAB
- Homepage แสดง Event จาก mock API ใน horizontal carousel
- Carousel มี semantic label สำหรับการเลื่อน
- AI panel เปิดและเริ่มคำถาม “แนะนำโซนและบูธให้ร้านฉัน” ได้
- UX preview ที่ไม่มี Supabase แสดงข้อความให้ใช้บัญชีจริงอย่างชัดเจน
- ตรวจ source label ใน UI แยก Gemini Flash และ Rule-based

ข้อจำกัด: ยังไม่ได้ยิง Gemini request จริงใน environment ที่มี production key และยังไม่ได้ทำ end-to-end personalized flow ด้วยบัญชี Supabase จริง การทดสอบนี้ต้องทำหลัง deploy/preview พร้อม environment variables

## 13. Deployment Checklist

สำหรับ Zone recommendation แบบ Gemini:

```env
ZONE_RECOMMENDER=gemini
GEMINI_API_KEY=<backend secret>
GEMINI_MODEL=<approved Gemini Flash model>
```

สำหรับคำถามทั่วไปของ AI ช่วยคุณได้:

```env
SUPPORT_ASSISTANT=gemini
GEMINI_API_KEY=<backend secret>
GEMINI_SUPPORT_MODEL=gemini-3.6-flash
```

ห้ามวางค่าจริงของ Secret ใน Jira, Markdown, Commit, PR description หรือ `NEXT_PUBLIC_*`

Smoke test หลัง deploy:

1. เข้าสู่ระบบด้วย Vendor Supabase account จริง
2. ตรวจว่าบัญชีมีร้านและ Category
3. เปิด AI ช่วยคุณได้และพิมพ์ขอคำแนะนำโซน
4. เลือก Event → Zone → Facilities
5. ตรวจว่าคืนเฉพาะบูธว่างและลิงก์เปิด Event map ถูกต้อง
6. ตรวจ source label
7. ทดสอบร้านของ Vendor คนอื่นต้องไม่สามารถอ่านได้
8. ทดสอบ Event ที่ปิดรับจองต้องไม่แสดงในขั้นตอนเลือก Event

## 14. Dependency และ PR Strategy

ตรวจ GitHub ก่อนส่งงานแล้วพบว่า PR #71 ของ SCRUM-105 merge เข้า `main` เรียบร้อย จึงไม่ต้องเปิด stacked PR

Branch `codex/user-mobile-event-ai-followup` ถูก sync/rebase จาก `origin/main@d2cd059` ซึ่งรวม:

- PR #71 — SCRUM-105
- PR #72 — Super Admin sidebar follow-up

Rebase ผ่านโดยไม่มี conflict และตรวจว่า Super Admin guard/sidebar จาก main ไม่ถูกย้อนทับ

PR ของ SCRUM-106 ต้องเปิดตรงเข้า `main` และแสดงเฉพาะ 13 implementation files พร้อมรายงานฉบับนี้ ห้าม merge เอง ต้องรอ Book review

## 15. Review Focus สำหรับบุ๊ค

1. ตรวจ Mobile Auth spacing เทียบภาพจากโทรศัพท์จริง
2. ตรวจ Event carousel เมื่อมี Event/ประกาศหลายรายการ
3. ตรวจ protected personalized flow ด้วย Supabase account จริง
4. ตรวจ optional seam fields ใน `ZoneRecommendationInput`
5. ตรวจ facility matching กับรูปแบบ JSON ที่ Admin/Organizer จะใช้จริง
6. ตรวจ Gemini source/fallback label
7. ยืนยัน deployment env ก่อน smoke test

## 16. สถานะส่งมอบ

- Development: เสร็จ
- Automated QA: ผ่าน
- Browser QA ด้วย mock/local preview: ผ่าน
- Production Gemini smoke test: รอ environment จริง
- Commit message: `SCRUM-106: improve mobile auth and personalized booth AI`
- Push/PR: พร้อมส่งจาก branch `codex/user-mobile-event-ai-followup` เข้า `main`
- Merge: ห้าม merge เอง รอ Book review
