# ai — ช่องเสียบสำหรับแนะนำบูธ

โมดูลนี้เตรียม "ช่องเสียบ" ไว้ให้ Gemini แต่ตัวที่ใช้งานจริงตอนนี้คือ rule-based
ซึ่งทำงานได้เต็มรูปแบบ ไม่ต้องใช้ API key และไม่มีค่าใช้จ่าย

- `zone-recommender.interface.ts` — token `ZONE_RECOMMENDER` และ interface `ZoneRecommender`
- `zone-recommendation.service.ts` — **ตัวที่ service อื่นต้องเรียก** ดูแล fallback และการบันทึก log
- `providers/rule-based-recommender.ts` — ของจริง ใช้ในเดโมและตอนไม่มี key
- `providers/gemini-recommender.ts` — ยังไม่ทำ (ตั๋วแยก) เรียกแล้ว throw
- `ai.module.ts` — เลือก provider จาก `ZONE_RECOMMENDER=rule|gemini`

## การแบ่งหน้าที่ (สำคัญ)

| ใคร | ทำอะไร |
|---|---|
| **provider** (`rule-based`, `gemini`) | จัดอันดับบูธแล้ว return อย่างเดียว **ไม่เขียน DB ไม่ทำ fallback ไม่เรียก provider ตัวอื่น** |
| **`ZoneRecommendationService`** | เรียก provider → ถ้าพังก็ fallback → เขียน `recommendation_log` |

`AiModule` export เฉพาะ `ZoneRecommendationService` ส่วน token `ZONE_RECOMMENDER`
เป็นของภายในโมดูล **ห้าม inject token ตรง ๆ จากข้างนอก** เพราะจะข้าม fallback
และข้ามการบันทึก log

## งานที่ต้องทำต่อ (ตั๋วแยก)

1. สร้าง Gemini client ใน `providers/gemini-recommender.ts` ที่ `implements ZoneRecommender`
   ทำแค่ **adapter ล้วน ๆ** คือ prompt → แปลงคำตอบเป็น `RecommendedBooth[]` → return
   ใช้ interface เดิมที่มีอยู่ **ห้ามแก้ signature ถ้าไม่ได้คุยกับทีมก่อน**
   เพราะโค้ดฝั่ง booking จะผูกกับ interface นี้
2. ใช้ได้เฉพาะ **Gemini Flash หรือ Flash-Lite เท่านั้น ห้ามใช้ Pro เด็ดขาด**
   (AGENTS.md §4 — เป็นเรื่องคุมค่าใช้จ่าย ไม่ใช่ความชอบ)
3. **ไม่ต้องเขียน fallback เอง และไม่ต้องเขียน `recommendation_log` เอง**
   ถ้า Gemini error, timeout, quota หมด, response พัง หรือตอบ boothId มั่ว
   ให้ **throw ออกมาเฉย ๆ** แล้ว `ZoneRecommendationService` จะ log แล้วสลับไปใช้
   rule-based ให้เอง **vendor จะไม่มีวันเห็น error ของ AI**
4. ทุกบูธที่ return ต้องใส่ `source: AI_GEMINI` และต้องอยู่ในสัญญาที่ตกลงไว้ คือ
   boothId มีอยู่จริงในงานนั้น `score` อยู่ในช่วง 0–100 และ `reason` เป็นภาษาไทย
   ถ้าผิดรูป service จะทิ้งคำตอบทั้งชุดแล้วใช้ rule-based แทน
   ข้อ "boothId มีอยู่จริง" ไม่ใช่แค่คำขอ — `ZoneRecommendationService` เช็คทุก id
   กับชุดบูธที่จองได้จริงของงานนั้น (`RuleBasedZoneRecommender.candidateBooths`)
   ถ้ามีสักตัวที่ไม่อยู่ในชุดนั้น **ทั้งคำตอบถูกทิ้งแล้ว fallback** ดังนั้นถ้า prompt
   ตอบ id มั่วมาแม้ตัวเดียว vendor จะไม่ได้เห็นผลจาก AI เลยโดยไม่มี error ให้ดู
   ให้สร้างคำตอบจากรายการบูธที่ส่งเข้า prompt เท่านั้น
   อีกสองข้อคือ **ห้ามมี boothId ซ้ำ** และ **ต้องไม่เกิน `limit`** — สองข้อนี้
   `ZoneRecommendationService` ตัดให้อีกชั้นหนึ่ง (ไม่ fallback เพราะคำตอบยังใช้ได้
   แค่มีส่วนเกิน) แต่ provider ก็ต้องทำเองด้วย อย่าอาศัยว่ามีคนตัดให้
5. แก้ `ai.module.ts` ให้ `case 'gemini'` คืน provider ตัวใหม่แทนการ throw
6. ห้ามส่งข้อมูลส่วนบุคคลเข้า prompt — ส่งได้แค่รหัสบูธ ชื่อโซน ราคา และชื่อหมวดสินค้า
   ห้ามส่งชื่อ อีเมล เบอร์โทร หรือข้อมูลสลิป (AGENTS.md §14.5)

## `vendorUserId` ต้องมาจาก token เท่านั้น

ตอนสร้าง controller ที่เรียก `ZoneRecommendationService.recommend()`
**`vendorUserId` ต้องมาจาก `req.user.id` ที่ `SupabaseAuthGuard` ใส่ไว้ให้เท่านั้น
ห้ามรับจาก request body, query string หรือ path param เด็ดขาด**

เพราะค่านี้ถูกเขียนลง `recommendation_log.vendorUserId` ตรง ๆ ถ้ารับมาจาก client
vendor คนหนึ่งก็ขอคำแนะนำ "ในนามของ" vendor อีกคนได้ ทำให้ log ของอีกคนเพี้ยน
และเป็นการอ้างตัวตนคนอื่น (AGENTS.md §14.2 — ค่าที่ client ส่งมาไม่พิสูจน์อะไรเลย)
ถ้าต่อไปมีหน้าให้ ORG_ADMIN ดูคำแนะนำแทน vendor ให้คุยกับทีมก่อน อย่าเปิดรับ
พารามิเตอร์นี้จาก client เองเงียบ ๆ

## การบันทึกลง `recommendation_log`

`ZoneRecommendationService` เขียนให้เอง 1 แถวต่อ 1 บูธที่แนะนำ

- `source` ยึดตาม "ตัวที่ผลิตผลลัพธ์จริง" เป็นรายบูธ ไม่ใช่ตามค่าที่ตั้งไว้ใน env
  ถ้า fallback มาที่ rule-based ก็ต้องเป็น `RULE_BASED` ไม่งั้นคอลัมน์นี้ก็ไม่มีประโยชน์
- `reason` เป็นภาษาไทย เพราะเอาไปแสดงบน UI ตรง ๆ
- `score` ในโค้ดเป็น `number` ธรรมดา (เป็นคะแนนจัดอันดับ ไม่ใช่เงิน)
  จะถูกแปลงเป็น `Prisma.Decimal` **ตอนเขียนลง `recommendation_log.score` จุดเดียวเท่านั้น**
  คอลัมน์นี้เป็น `Decimal(5,2)` และ service คุมคะแนนไว้ในช่วง 0–100 อยู่แล้ว
- ถ้าเขียน log ไม่สำเร็จ vendor ยังต้องได้ผลลัพธ์ตามปกติ (log เป็นข้อมูลสถิติ ไม่ใช่คำตอบ)

## เกณฑ์ของ rule-based (สรุป)

เรียงจากน้ำหนักมากไปน้อย

1. โซนของบูธตรงกับหมวดสินค้าที่ vendor เลือก (น้ำหนัก 70)
2. ราคาบูธเทียบกับค่ากลาง (median) ของบูธว่างในงานนั้น (น้ำหนัก 30) ถูกกว่าได้คะแนนมากกว่า

บูธที่มีการจองสถานะ `PENDING_PAYMENT` หรือ `CONFIRMED` ในงานนั้นอยู่แล้วจะถูกตัดออก
(invariant §6.3.3) และเมื่อคะแนนเท่ากันจะเรียงตามรหัสบูธเสมอ **ห้ามใช้ random**
เพราะผลลัพธ์ต้องเหมือนเดิมทุกครั้งที่เรียกด้วย input เดียวกัน

การตัดบูธที่ถูกจองแล้วทำไว้ 2 ชั้น คือใน `where` ของ Prisma และใน TypeScript
**ตั้งใจให้ซ้ำ** และมีเทสต์คุมทั้งสองชั้น ถ้าแก้ชั้นใดชั้นหนึ่งแล้วอีกชั้นไม่ตาม เทสต์จะแดง
