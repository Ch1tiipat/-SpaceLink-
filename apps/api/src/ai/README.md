# ai — ระบบแนะนำโซนและบูธ

โมดูลเลือก engine ผ่าน `ZONE_RECOMMENDER=rule|gemini` และเปิดให้ส่วนอื่นเรียก
ผ่าน `ZoneRecommendationService` เพื่อให้มี fallback และบันทึก
`recommendation_log` เสมอ

- `rule` จัดอันดับจากหมวดสินค้าที่ตรงกันและราคากลาง ใช้งานออฟไลน์ได้
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
และหมวดสินค้า ไม่มีชื่อ อีเมล เบอร์โทร ข้อมูลผู้ขาย หรือข้อมูลสลิป

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
