# ai — ระบบแนะนำโซนและบูธ

โมดูลเลือก engine ผ่าน `ZONE_RECOMMENDER=rule|gemini` และเปิดให้ส่วนอื่นเรียก
ผ่าน `ZoneRecommendationService` เพื่อให้มี fallback และบันทึก
`recommendation_log` เสมอ

- `rule` จัดอันดับจากหมวดสินค้า ราคากลาง โซนที่ผู้ใช้เลือก และอุปกรณ์ที่ผู้จัดระบุ ใช้งานออฟไลน์ได้
- `gemini` ใช้ Gemini Flash/Flash-Lite และ structured JSON

เมื่อ Gemini timeout, quota หมด, ตอบผิดรูป หรือคืน booth ที่จองไม่ได้
`ZoneRecommendationService` จะสลับไปใช้ rule-based อัตโนมัติ

ตั้งค่า Gemini:

```env
ZONE_RECOMMENDER=gemini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
```

ระบบปฏิเสธโมเดล Pro ตั้งแต่ boot และ prompt ส่งเฉพาะรหัสบูธ ชื่อโซน ราคา
หมวดสินค้า และข้อมูลอุปกรณ์บูธสาธารณะ ไม่มีชื่อ อีเมล เบอร์โทร ข้อมูลผู้ขาย
หรือข้อมูลสลิป

หน้าเว็บเรียก `POST /events/:eventId/recommendations` หลังผู้ใช้เข้าสู่ระบบ โดยส่ง
`shopId` พร้อม `preferredZoneId` และ `requiredFacilities` แบบไม่บังคับ API ใช้
`SupabaseAuthGuard` และตรวจ `shop.ownerUserId` ก่อนอ่านหมวดสินค้าของร้านเสมอ
จึงไม่สามารถใช้ `shopId` ของผู้ขายคนอื่นเพื่อขอคำแนะนำได้ หากผู้จัดยังไม่ได้ระบุ
`Booth.facilities` ระบบต้องแจ้งว่าไม่มีข้อมูลและห้ามสร้างข้อมูลอุปกรณ์ขึ้นเอง

## AI ช่วยคุณได้

`POST /ai/support` เป็นผู้ช่วยตอบวิธีใช้งาน SpaceLink จากฐานความรู้สาธารณะ
โดยไม่อ่านฐานข้อมูลผู้ใช้ ข้อมูลการจอง สลิป หรือข้อมูลส่วนตัว เปิด Gemini ด้วย:

```env
SUPPORT_ASSISTANT=gemini
GEMINI_API_KEY=
GEMINI_SUPPORT_MODEL=gemini-3.6-flash
```

หาก Gemini timeout, quota เต็ม หรือตอบผิดรูป ผู้ช่วยจะคืนคำตอบแบบ rule-based
พร้อม `source: RULE_BASED` แทนการทำให้หน้าเว็บล้ม และ API key อยู่ใน backend
เท่านั้น ห้ามเพิ่มเป็นตัวแปร `NEXT_PUBLIC_*`

คำถามทั่วไปยังใช้ `/ai/support` ส่วนคำถาม “แนะนำโซน/บูธ” จากผู้ใช้ที่เข้าสู่ระบบ
ใช้ endpoint คำแนะนำแบบ protected ด้านบน เพื่ออ่านเฉพาะร้านของเจ้าของบัญชีและ
คืนบูธที่ยังจองได้จริง พร้อม `source` ให้ UI แสดงว่าเป็น Gemini หรือ rule-based
fallback อย่างตรงไปตรงมา
