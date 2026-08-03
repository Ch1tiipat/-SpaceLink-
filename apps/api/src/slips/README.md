# slips — ระบบตรวจสอบสลิป

โมดูลเลือก provider ผ่าน `SLIP_VERIFIER=mock|manual|slipok` และเปิดให้โมดูลอื่น
เรียกผ่าน `SlipVerificationService` เท่านั้น เพื่อให้ทุกผลตรวจถูกบันทึกลง
`verified_slip`

- `mock` ใช้สำหรับพัฒนาในเครื่อง
- `manual` คืน `ERROR` เพื่อเข้าสู่กระบวนการสำรอง
- `slipok` เรียก SlipOK API จริงด้วย `SLIPOK_BRANCH_ID` และ `SLIPOK_API_KEY`

SlipOK adapter ส่ง signed URL อายุสั้นพร้อมยอดที่ต้องตรวจและ `log: true`
เพื่อเช็กบัญชีผู้รับและสลิปซ้ำ การแปลงยอดเงินจาก JSON number เป็น
`Prisma.Decimal` เกิดภายใน adapter เท่านั้น

`SlipVerificationService` ส่ง signed URL ให้ provider เท่านั้น แต่บันทึก private
object path ที่ไม่หมดอายุลง `verified_slip.slip_image_url` เพื่อให้ endpoint
สำหรับผู้มีสิทธิ์สามารถสร้าง signed URL ใหม่ตอนอ่านได้ ห้ามบันทึก signed URL
หรือ token ลงฐานข้อมูล

สถานะที่แปลง:

- ผ่านและยอดตรง → `VERIFIED`
- รูป/QR/ยอด/บัญชีรับไม่ถูกต้อง → `INVALID`
- รหัส 1012 → `DUPLICATE`
- key, quota, package, ธนาคารล่าช้า, timeout หรือระบบขัดข้อง → `ERROR`

ห้าม log API key, signed URL, ชื่อผู้โอน หรือ response ดิบ
