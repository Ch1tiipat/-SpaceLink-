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
GEMINI_MODEL=gemini-2.5-flash-lite
```

ระบบปฏิเสธโมเดล Pro ตั้งแต่ boot และ prompt ส่งเฉพาะรหัสบูธ ชื่อโซน ราคา
และหมวดสินค้า ไม่มีชื่อ อีเมล เบอร์โทร ข้อมูลผู้ขาย หรือข้อมูลสลิป
