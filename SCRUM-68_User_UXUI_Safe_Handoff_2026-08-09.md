# SpaceLink — SCRUM-68 User UX/UI Safe Handoff

อัปเดต: 9 สิงหาคม 2026
ผู้รับช่วงต่อ: บุ๊ค / Ch1tiipat / ทีม SpaceLink
Branch สำหรับตรวจ: `codex/scrum-68-user-ux-ui`
ฐานที่ใช้: `origin/main` commit `b5b6f0e`

## 1. สถานะสรุป

งานชุดนี้ปรับ UX/UI ฝั่งผู้ขาย (Vendor/User) ให้ใช้งานและตรวจหน้าจอได้ครบขึ้น โดยนำการออกแบบใหม่มาครอบระบบเดิม ไม่เปลี่ยน Backend, API contract, Prisma schema หรือฐานข้อมูล

สถานะ ณ วันที่ส่งต่อ:

- Source branch ตาม `origin/main` ล่าสุดและนำหน้า 1 commit
- เปลี่ยนเฉพาะไฟล์ใต้ `apps/web`
- ESLint ผ่าน ไม่มี warning/error
- TypeScript ผ่าน
- Next.js production build ผ่านครบ 10 routes
- ทดสอบ Browser ในโหมด Production และ Local UX Preview แล้ว ไม่พบ console error
- ยังไม่ได้ Push และยังไม่ได้เปิด PR
- ห้าม Merge เข้า `main` โดยตรง ควรเปิด Draft PR และให้ทีมตรวจอีกครั้ง

## 2. ขอบเขต UX/UI ที่ทำแล้ว

### 2.1 หน้าแรก

- ผู้เยี่ยมชมเห็น Top navigation พร้อมปุ่มเข้าสู่ระบบและสมัครสมาชิก โดยไม่มี Sidebar
- ผู้ที่เข้าสู่ระบบแล้วเห็น Sidebar ซึ่งย่อ/ขยายได้
- เพิ่ม Hero, ตัวกรอง Event, ข่าวสาร/งานล่าสุด และ Footer
- เพิ่มพื้นที่นิยมที่เหมาะกับประเภทร้าน พร้อมเหตุผลเชิง UX
- เพิ่ม Floating Contact Button สำหรับเปิดคำแนะนำและช่องทางติดต่อ

### 2.2 Login และ Register

- ปรับ layout, typography และ spacing ใหม่
- รองรับ flow Supabase Auth เดิม ไม่เปลี่ยนกลไกยืนยันตัวตน
- แก้การจัดวางข้อความภาษาไทยไม่ให้เบียดกัน

### 2.3 รายละเอียด Event

- เพิ่มรายละเอียดงาน วัน เวลา สถานที่ ผู้จัด และเงื่อนไข
- เพิ่มภาพบรรยากาศงาน
- เพิ่มภาพแผนที่การเดินทาง/ทางเข้างาน
- เพิ่มภาพแผนผังรวมสำหรับดูตำแหน่งบูธ
- ภาพแผนผังรวมเป็นภาพประกอบ ไม่ใช้แทนปุ่มเลือกบูธ

### 2.4 Zone Map และการเลือกบูธ

- ดูพื้นที่ทั้งหมดหรือกรองเฉพาะโซนได้
- เมื่อเลือกโซน จะแสดงเฉพาะบูธของโซนนั้น
- กดบูธเพื่อดูรายละเอียด ราคา สถานะ และตำแหน่งก่อนจอง
- เลือกได้สูงสุด 2 บูธตาม requirement ปัจจุบัน
- คงระบบแนะนำโซนจริงในหน้า Event map ไว้ ไม่แทนที่ด้วยคำตอบจำลองใน Production

### 2.5 การจองและสลิป

- คง `createBooking` และ flow การจองจริงของระบบเดิม
- คง `SlipUploadPanel` ที่เชื่อม endpoint จริงของทีม
- เพิ่มสรุปรายการ ราคา และเวลาถือสิทธิ์ใน UX
- UI ช่องทางจ่ายเงินหลายรูปแบบที่ยังไม่มี Backend รองรับ ถูกจำกัดให้เห็นเฉพาะ Local UX Preview
- Production จะไม่แสดง QR/บัตร/ธนาคารจำลอง เพื่อป้องกันผู้ใช้เข้าใจว่าเป็นการชำระเงินจริง

### 2.6 โปรไฟล์ร้าน

- คง API จริง ได้แก่ `getCategories`, `createShop`, `updateShop` และ `updateMe`
- ปรับเฉพาะ visual hierarchy, card, form และ action state
- รองรับสถานะมีร้านและยังไม่มีร้านใน Local UX Preview
- ไม่เพิ่ม upload logo ปลอม เพราะ Backend ยังไม่มี endpoint ที่ยืนยันแล้ว

### 2.7 การแจ้งเตือนและช่วยเหลือ

- เพิ่มหน้า Notifications และหน้า Help ทาง UX/UI
- ข้อมูลแจ้งเตือนตัวอย่างแสดงเฉพาะ localhost development
- Production ที่ยังไม่มี Notification API จะไม่แสดงข้อมูลปลอม
- Facebook/LINE ปัจจุบันเป็น placeholder UX ต้องให้ผู้ดูแลระบบใส่บัญชีจริงก่อนใช้งานจริง

## 3. การเชื่อมกับระบบเดิม

ส่วนต่อไปนี้ยังใช้ระบบจริงเดิมและไม่ได้ถูกแทนที่ด้วย mock:

- Public Event Discovery API
- Supabase Auth เมื่อมี Web environment variables ครบ
- `/auth/me` และข้อมูลผู้ใช้จาก API
- Shop/Profile API
- Booking API
- Slip upload API
- AI Zone Recommendation ในหน้าแผนผัง Event

ไฟล์ auth ที่ merge จาก `main` ยังคงการจัดการ session error, 401 และ `getSession()` rejection ที่ทีมแก้ไว้แล้ว

## 4. Local UX Preview ที่ปลอดภัย

ใช้สำหรับตรวจหน้าตาเมื่อยังไม่มี Supabase Publishable key เท่านั้น

```powershell
cd "C:\Users\vitha\OneDrive\Documents\Proj final\spacelink-system-qa\apps\web"
npm.cmd run dev -- -p 3001
```

เปิด:

```text
http://127.0.0.1:3001/?uxAuth=signed-in
```

จากกล่อง `ตรวจ UX/UI` ด้านล่างซ้าย สามารถสลับได้:

- ผู้เยี่ยมชม / เข้าสู่ระบบแล้ว
- มีโปรไฟล์ร้าน / ยังไม่มีร้าน
- หน้าแรก
- รายละเอียดงาน
- แผนผังโซน
- เลือกบูธ
- การจอง
- การแจ้งเตือน
- ช่วยเหลือ
- โปรไฟล์

ข้อจำกัดด้านความปลอดภัยของ Preview:

- ทำงานเมื่อ `NODE_ENV=development` เท่านั้น
- ทำงานเฉพาะ hostname `127.0.0.1` หรือ `localhost`
- Preview token ไม่ใช่ Supabase token และ API จริงไม่ยอมรับ
- ไม่ส่งข้อมูลทดลองเข้าฐานข้อมูล
- Production build ไม่เปิด Preview

## 5. การทดสอบ Login จริง

ไฟล์ local environment:

```text
apps/web/.env.local
```

ตัวแปรที่ต้องมี:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxx
```

ใช้ Supabase `Publishable key` หรือ legacy `anon public` เท่านั้น ห้ามใส่ `service_role`, `secret key`, `DATABASE_URL` หรือ `DIRECT_URL` ใน `apps/web/.env.local`

หลังใส่ค่าครบให้ restart dev server และล้าง site data/local storage ของ `127.0.0.1:3001` ก่อนทดสอบ Login จริง เพื่อไม่ให้สถานะ UX Preview เดิมค้างอยู่

## 6. Routes ที่ตรวจแล้ว

| Route | จุดตรวจ |
|---|---|
| `/` | Guest/Signed-in shell, hero, filters, event cards, recommendation, footer |
| `/login` | Supabase sign-in UI |
| `/register` | Supabase registration UI |
| `/events/demo-event` | รายละเอียดงานและภาพประกอบ |
| `/events/demo-event/map` | แผนผังรวมและตัวกรองโซน |
| `/events/demo-event/book` | เลือกบูธ สรุป และ payment preview guard |
| `/bookings` | รายการจองและ slip upload |
| `/notifications` | Demo เฉพาะ local; production ไม่แสดงข้อมูลปลอม |
| `/help` | FAQ และช่องทางช่วยเหลือ |
| `/profile` | Profile/Shop API flow เดิมพร้อม UI ใหม่ |

## 7. คำสั่ง Quality Gate

รันจาก `apps/web`:

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
```

ผลล่าสุด: ผ่านทั้งสามคำสั่ง

## 8. ไฟล์ที่เปลี่ยน

การเปลี่ยนแปลงทั้งหมดอยู่ใต้ `apps/web` และแบ่งเป็น:

- Pages: home, login, register, notifications, help
- Components: shell, auth layout, event detail, event map, zone map, booking, bookings, profile/shop, slip upload
- Local-only preview: `apps/web/lib/ux-preview.ts`
- Auth integration: `use-auth-state.ts`, `use-vendor-profile.ts`
- Assets: atmosphere, event plan และ travel map ของงานเกษตร มทส. 2569
- Global design tokens/styles: `apps/web/app/globals.css`

ไม่มีไฟล์ต่อไปนี้ถูกแก้:

- `apps/api/**`
- Prisma schema/migrations
- Supabase policies
- Database seed
- Render/Vercel configuration

## 9. สิ่งที่ยังไม่ควรถือว่าเสร็จ Production

- Notification API และการบันทึก notification preferences
- Payment providers สำหรับ QR, บัตรเครดิต/เดบิต และธนาคารออนไลน์
- บัญชี Facebook/LINE/เบอร์โทรจริงของทีม
- Admin upload สำหรับภาพบรรยากาศ/แผนผัง/แผนที่การเดินทาง
- Shop logo upload endpoint
- การทดสอบ Login จริงจนกว่า `NEXT_PUBLIC_SUPABASE_ANON_KEY` จะถูกตั้งในเครื่องผู้ทดสอบ

ห้ามสร้าง mock endpoint หรือเขียนข้อมูลลง shared DB เพื่อทำให้รายการข้างต้นดูเสร็จ

## 10. ขั้นตอน GitHub ที่แนะนำ

1. ผู้รับผิดชอบ UX ตรวจ Local Preview ให้ผ่านก่อน
2. Push เฉพาะ branch `codex/scrum-68-user-ux-ui`
3. เปิด **Draft PR** เข้า `main`
4. ใน PR ระบุ `Ticket: SCRUM-68`
5. ให้บุ๊ค/Ch1tiipat ตรวจ diff ว่าไม่มี `apps/api`, Prisma หรือ secrets
6. รอ CI ผ่านทั้ง lint, typecheck และ build
7. ให้ทีมอนุมัติก่อนเปลี่ยน Draft เป็น Ready
8. ห้าม force merge หรือ merge โดยไม่มี review

## 11. Checklist สำหรับผู้รีวิว

- [ ] Guest ไม่มี Sidebar และมีปุ่ม Login/Register
- [ ] Signed-in มี Sidebar และย่อ/ขยายได้
- [ ] การเลือกโซนและบูธไม่ส่ง POST จนกด action จองจริง
- [ ] เลือกบูธได้ไม่เกิน 2 บูธ
- [ ] Production ไม่แสดง notification/payment/AI answer จำลอง
- [ ] Profile ยังคงเรียก API จริง
- [ ] Slip upload ยังคงใช้ endpoint จริง
- [ ] ไม่มี secret หรือ `.env.local` ใน diff
- [ ] ไม่มี Backend/Schema/DB changes
- [ ] CI ผ่านก่อน merge

## 12. ข้อความสั้นสำหรับส่งใน Discord

> SCRUM-68 User UX/UI พร้อมให้ตรวจบน branch `codex/scrum-68-user-ux-ui` แล้วครับ งานเปลี่ยนเฉพาะ `apps/web` และคง API/Auth/Booking/Slip เดิมไว้ ข้อมูล notification, payment และ AI ที่เป็นตัวอย่างถูกจำกัดเฉพาะ localhost development; Production ไม่แสดงข้อมูลจำลอง Quality gates ผ่าน lint + TypeScript + production build แล้ว ยังไม่ได้ Push/เปิด PR และขอให้เปิดเป็น Draft PR เพื่อตรวจ diff/CI ก่อน merge ครับ
