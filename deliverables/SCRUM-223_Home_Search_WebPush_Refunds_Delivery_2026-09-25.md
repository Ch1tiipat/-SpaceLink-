# SCRUM-223 Delivery — Home Search, Web Push และ Refunds

วันที่ส่งมอบ: 25 กันยายน 2026

## ผลลัพธ์

- หน้า Home เปลี่ยนช่อง `งานหรือสถานที่` และ `พื้นที่` เป็นช่องค้นหาที่พิมพ์ข้อความอิสระได้ พร้อมคำแนะนำจาก Event ที่มีอยู่
- การค้นหารองรับภาษาไทย/อังกฤษ, trim ช่องว่าง, ไม่สนตัวพิมพ์เล็ก–ใหญ่ และทำงานร่วมกับหมวดสินค้า/สถานะ Event
- เอาข้อความจำนวนผลลัพธ์ออก และใช้ Empty State `ไม่พบ Event ตามเงื่อนไขที่เลือก`
- หน้า Notification Center ในโหมด Local UX Preview มีปุ่ม `จำลอง Web Push`
- Web Push แสดงเป็นการ์ดลอยใต้ Header พร้อม badge, เวลา, รายละเอียด, ปุ่มดูรายละเอียด/ปิด และกากบาท
- ปิดการ์ดได้ด้วยปุ่มปิด, กากบาท และ Escape โดยรายการใน Notification Center ยังคงอยู่
- การจำลองหนึ่งครั้งเพิ่ม unread หนึ่งรายการ พร้อม unit test ป้องกันการเพิ่มซ้ำจาก state update เดิม
- หน้า Refund ใช้ `/refunds` เดิมตาม Single Source of Truth; ไม่สร้าง route, API หรือ schema ใหม่
- เพิ่มเมนู Sidebar `คำขอคืนเงิน` ไป `/refunds` และคงปุ่มติดตามคำขอคืนเงินจากหน้าการจองเดิม

## การตรวจสอบ

- `npm test` — ผ่าน 72/72 tests
- `npx tsc --noEmit` — ผ่าน
- `npm run lint` — ผ่าน ไม่มี warning/error
- `npm run build` — ผ่าน ครบ 40 static pages
- HTTP smoke test — `/`, `/notifications`, `/refunds` ตอบ `200`
- `git diff --check` — ผ่าน

## ขอบเขตที่ตั้งใจไม่เปลี่ยน

- ไม่เปลี่ยน Refund API หรือฐานข้อมูล
- ไม่เพิ่ม server-side search/pagination
- ปุ่มจำลอง Web Push แสดงเฉพาะ Local UX Preview และไม่ขอ Browser Notification permission
- ระบบ Web Push จริงยังคงใช้การตรวจ unsupported/denied ที่หน้าโปรไฟล์เดิม
