# slips — ช่องเสียบสำหรับตรวจสอบสลิป

โมดูลนี้เตรียม "ช่องเสียบ" ไว้ให้ SlipOK เท่านั้น ยังไม่มีการเรียก SlipOK จริง

- `slip-verifier.interface.ts` — token `SLIP_VERIFIER` และ interface `SlipVerifier`
- `providers/mock-slip-verifier.ts` — ของปลอมสำหรับ dev คุมด้วย `SLIP_VERIFIER_MODE`
- `providers/manual-slip-verifier.ts` — คืน `ERROR` ให้ ORG_ADMIN ยืนยันเองผ่าน `isPaymentExempt`
- `slips.module.ts` — เลือก provider จาก `SLIP_VERIFIER=mock|manual|slipok`

## งานที่ต้องทำต่อ (ตั๋วแยก)

1. สมัคร SlipOK (แพ็กเกจ OK BASIC ฟรี) เก็บ key ไว้ใน `.env` เท่านั้น ห้ามใส่ค่าจริงลง `.env.example` หรือใน code (AGENTS.md §2.5)
2. สร้าง `providers/slipok-slip-verifier.ts` ที่ `implements SlipVerifier`
   ใช้ interface เดิมที่มีอยู่ **ห้ามแก้ interface ถ้าไม่ได้คุยกับ PO ก่อน**
   เพราะโค้ดฝั่ง booking จะผูกกับ interface นี้
3. แปลง response ของ SlipOK ให้เป็น `SlipStatus` ของเรา:
   - จ่ายจริง ยอดตรง → `VERIFIED`
   - สลิปปลอม / อ่านไม่ออก / ยอดไม่ตรง → `INVALID`
   - `trans_ref` ซ้ำกับที่เคยใช้แล้ว → `DUPLICATE`
   - SlipOK ล่ม / quota หมด / timeout → `ERROR` (ห้ามคืน `INVALID`)
   - ยอดเงินที่ SlipOK ส่งมาเป็น JSON number ต้องแปลงเป็น `Prisma.Decimal` ในตัว provider เอง ห้ามส่ง `number` ออกไปตาม interface (AGENTS.md §6.1)
4. แก้ `slips.module.ts` ให้ `case 'slipok'` คืน provider ตัวใหม่แทนการ throw

## ข้อห้ามด้านความปลอดภัย (AGENTS.md §14.1)

- **ห้าม log ชื่อผู้โอน (`senderName`) เลขบัญชี ชื่อธนาคาร หรือ `raw` เด็ดขาด**
  ทั้งใน log ปกติและใน error handler
- ห้าม log API key ของ SlipOK และห้าม log URL ของรูปสลิป (เป็น signed URL)
- ข้อมูลผู้โอนส่งกลับได้เฉพาะ ORG_ADMIN และ SUPER_ADMIN ห้ามส่งให้ vendor
- `slipImageUrl` ต้องเป็น signed URL อายุสั้น และ bucket ต้อง private เสมอ
