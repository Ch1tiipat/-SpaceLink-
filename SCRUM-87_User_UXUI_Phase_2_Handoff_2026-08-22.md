# SCRUM-87 — User UX/UI Phase 2 Handoff

วันที่ส่งมอบ: 22 สิงหาคม 2026
สาขา: `codex/scrum-87-user-uxui-phase-1`

## เป้าหมาย

ปรับ UX/UI ฝั่ง Vendor/User ให้เป็นรูปแบบเดียวกับแบบที่ทีมอนุมัติ โดยคงการเชื่อมต่อ API, Authentication, Booking flow และสิทธิ์การเข้าถึงเดิมไว้ งานชุดนี้ไม่แก้ Admin, API, Database, Prisma, Package หรือไฟล์ใน `prototype/`

## หน้าที่ปรับและเส้นทางสำคัญ

| หน้า | Route | การเชื่อมต่อหลัก |
|---|---|---|
| หน้าแรกและค้นหา Event | `/` | ค้นหา/กรอง Event, เปิดรายละเอียด Event, เปิดแผนผัง, การจองของฉัน, ศูนย์ช่วยเหลือ |
| รายละเอียด Event | `/events/[eventId]` | กลับหน้าค้นหา, เปิด Zone Map, บันทึก Event, เลือกพื้นที่, ช่องทางติดต่อผู้จัดงาน |
| Event Map / Zone Map | `/events/[eventId]/map` | แนะนำโซนด้วย AI, เลือก Zone, เลือก Booth ว่าง, เปิดหน้าจอง |
| เลือกพื้นที่และสร้าง Booking | `/events/[eventId]/book` | สรุป Event/Zone/Booth, สร้าง Booking, ไปหน้าชำระเงิน |
| การจองของฉัน | `/bookings` | กรองตามสถานะ, เปิดรายละเอียด, ไปชำระเงิน, รีวิวรายการที่เข้าเงื่อนไข |
| รายละเอียดการจอง | `/bookings/[bookingId]` | ดูสถานะ/ราคา/ตำแหน่ง, ชำระเงิน, ยกเลิก, รีวิว |
| ชำระเงิน | `/bookings/[bookingId]/payment` | แสดงยอดและ QR ของ Booking, อัปโหลดสลิป, ให้ระบบตรวจสอบและยืนยันอัตโนมัติ |
| รีวิวพื้นที่ | `/bookings/[bookingId]/review` | ให้คะแนน 1–5 ดาว, เลือกคำอธิบาย, ส่งหรืออัปเดตรีวิว |
| การแจ้งเตือน | `/notifications` | อ่านรายการ, ทำเครื่องหมายว่าอ่านแล้ว, เปิดรายการที่เกี่ยวข้อง |
| โปรไฟล์ร้านค้า | `/profile` | ดูและแก้ไขข้อมูล Vendor/Shop ตาม API เดิม |
| ช่วยเหลือ | `/help` | FAQ, ช่องทางติดต่อ, สร้างและติดตาม Support Ticket |

## ส่วนกลางที่ปรับ

- App shell, Sidebar และ Top bar ของ User
- Footer แบบ 4 คอลัมน์ พร้อมลิงก์ไปหน้าที่มีอยู่จริง
- Floating Action Button แบบสองระดับ: ช่องทางติดต่อและ SpaceLink AI panel
- Shared visual tokens และ responsive layout ใน `globals.css`
- Zone map แบบเห็นทุก Zone ในหน้าจอเดียวมากขึ้น พร้อมสถานะ Booth และปุ่มแนะนำโซนด้วย AI
- หน้าแรกเพิ่มขั้นตอนการจอง 3 ขั้นตอน จุดเด่นระบบ CTA และแก้ระยะห่างระหว่าง Section

## ความปลอดภัยและขอบเขต

- ไม่แก้ `apps/api`, Prisma schema, migration หรือฐานข้อมูล
- ไม่แก้หรือนำโค้ดจาก `prototype/` มาเชื่อมกับระบบจริง
- ไม่เพิ่ม Package หรือ Environment variable ใหม่
- ไม่เขียน Secret หรือข้อมูลรับเงินจริงลงในโค้ด
- QR และข้อมูลจำลองแสดงเฉพาะ UX preview; การใช้งานจริงอาศัยข้อมูลจาก API
- หน้า Booking, Payment และ Review ตรวจเจ้าของรายการผ่าน Auth/API เดิม
- สลิปจริงยังส่งผ่าน flow เดิม และข้อความ UI ระบุว่าระบบเป็นผู้ตรวจสอบ ไม่ใช่ขั้นตอนอนุมัติด้วยคน

## รายการไฟล์ใน Pull Request (19 ไฟล์)

1. `apps/web/app/globals.css`
2. `apps/web/app/help/page.tsx`
3. `apps/web/app/notifications/page.tsx`
4. `apps/web/app/page.tsx`
5. `apps/web/app/bookings/[bookingId]/page.tsx`
6. `apps/web/app/bookings/[bookingId]/payment/page.tsx`
7. `apps/web/app/bookings/[bookingId]/review/page.tsx`
8. `apps/web/components/app-shell.tsx`
9. `apps/web/components/booking-screen.tsx`
10. `apps/web/components/booking-detail-screen.tsx`
11. `apps/web/components/booking-payment-screen.tsx`
12. `apps/web/components/booking-review-screen.tsx`
13. `apps/web/components/event-detail-screen.tsx`
14. `apps/web/components/event-map-screen.tsx`
15. `apps/web/components/my-bookings-screen.tsx`
16. `apps/web/components/profile-shop-screen.tsx`
17. `apps/web/components/support-ticket-screen.tsx`
18. `apps/web/components/zone-map.tsx`
19. `SCRUM-87_User_UXUI_Phase_2_Handoff_2026-08-22.md`

## วิธีตรวจแบบ UX Preview

เปิด Web แล้วเติม `?uxAuth=signed-in` ที่หน้าแรก เช่น:

```text
http://127.0.0.1:4190/?uxAuth=signed-in
```

จากนั้นตรวจเส้นทางหลักตามลำดับ:

1. หน้าแรก → Event detail
2. Event detail → Zone Map
3. Zone Map → เลือก Booth → Booking
4. My Bookings → Booking detail
5. Booking detail → Payment หรือ Review
6. Notifications, Profile และ Help

UX preview ใช้สำหรับตรวจหน้าตาและ interaction เท่านั้น ห้ามใช้ QR หรือตัวเลขจำลองเป็นข้อมูลรับเงินจริง

## ผลการตรวจ

- `npx tsc --noEmit`: ผ่าน
- `npm run lint`: ผ่าน ไม่มี warning หรือ error
- `npm run build`: ผ่าน
- `git diff --check`: ผ่าน
- ตรวจหน้า User หลัก 10 เส้นทางด้วย local browser: ไม่พบ Application Error, console error หรือ horizontal overflow

## จุดที่เพื่อนควรเน้นตอน Review

1. ตรวจ responsive layout ของ Zone Map และ Payment บนอุปกรณ์จริงเพิ่มเติม
2. ตรวจ Booking/Payment/Review ด้วยบัญชี Supabase และ API environment ของทีม
3. ตรวจ QR และข้อมูลผู้รับเงินจาก Booking จริงก่อนทดสอบการโอน
4. ตรวจข้อความและช่องทางติดต่อใน Footer ให้ตรงกับข้อมูลทีมก่อน merge/deploy

## หมายเหตุ

งานชุดนี้เป็นการปรับ User UX/UI และเชื่อมเส้นทางเดิม ไม่ได้เปลี่ยน API contract หรือ Booking business rules หาก Environment ยังไม่ได้กำหนด `NEXT_PUBLIC_API_URL` ให้ใช้ UX preview เพื่อตรวจหน้าตาก่อน และทดสอบข้อมูลจริงอีกครั้งเมื่อ API พร้อม
