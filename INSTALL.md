# ติดตั้งและรัน SpaceLink ตั้งแต่ศูนย์

## 1. ภาพรวม 5 บรรทัด

SpaceLink คือเว็บสำหรับดูงานและจองบูธขายของ<br>
ระบบมี 2 ส่วน: api ใช้ NestJS รับคำขอและจัดการข้อมูล<br>
web ใช้ Next.js แสดงหน้าจอให้ผู้ใช้<br>
Supabase คือบริการฐานข้อมูล PostgreSQL, ระบบบัญชี และที่เก็บไฟล์ที่เราใช้<br>
ไฟล์ .env ไม่อยู่ใน repo เพราะถูก gitignore ต้องสร้างเองทั้งสอง app

คู่มือนี้ใช้ฐานข้อมูล Supabase ของคุณเอง ห้ามใช้ฐานข้อมูลทีมเพื่อทดลอง migration, SQL หรือ seed ไม่มีคำสั่งติดตั้งที่ราก repo เพราะสอง app มี dependencies แยกกัน

> **ตรวจ refund payout หลัง migration:** ชุด migrations มี SCRUM-144 สำหรับสร้างคอลัมน์ payout ทั้ง 5 แบบ nullable แล้ว หลังผู้ดูแลรัน migrations ครบ 21 ไฟล์ให้ตรวจตามข้อ 8 การ build หรือ health ผ่านยังไม่ยืนยันว่าทุกฟีเจอร์ใช้ได้ครบ ห้ามแก้ด้วย reset, db push หรือรัน SQL review-only

## 2. ต้องมีอะไรก่อน

1. ติดตั้ง Node.js 20+ ซึ่งใช้รัน JavaScript และ npm ซึ่งใช้ติดตั้ง dependencies จาก [เว็บไซต์ Node.js](https://nodejs.org/en/download) ติดตั้ง git สำหรับโหลดโค้ดจาก [เว็บไซต์ Git](https://git-scm.com/downloads) ถ้าโหลด ZIP ไม่จำเป็นต้องใช้ git ตรวจใน terminal:

~~~sh
node --version
npm --version
git --version
~~~

ทำแล้วควรเห็นเลขเวอร์ชัน Node ตั้งแต่ 20 ขึ้นไป และเลขเวอร์ชัน npm/git ถ้าเจอ command not found หรือ not recognized ให้ติดตั้งโปรแกรมนั้น แล้วปิดเปิด terminal ใหม่ ไม่ต้องรัน npm ที่ราก repo

Node.js 20+ เป็นข้อกำหนดสำหรับ build/runtime; สำหรับ `npm test` ของเว็บต้องใช้ Node.js 22.6+ ที่รองรับ `--experimental-strip-types` ซึ่ง [เอกสาร Node.js ระบุว่าเพิ่มใน v22.6.0](https://nodejs.org/download/release/v22.17.0/docs/api/cli.html#--experimental-strip-types) รอบตรวจนี้ใช้ Node.js 24.11.1

2. สมัครบัญชี [Supabase](https://supabase.com/dashboard) แบบ Free สำหรับฐานข้อมูลส่วนตัว และติดตั้ง psql ซึ่งเป็นโปรแกรมส่ง SQL ไป PostgreSQL จาก [ตัวติดตั้ง PostgreSQL](https://www.postgresql.org/download/) เลือก command line tools แล้วตรวจ:

~~~sh
psql --version
~~~

ทำแล้วควรเห็นเวอร์ชัน PostgreSQL client ถ้าไม่พบคำสั่ง บน Windows เพิ่มโฟลเดอร์ bin ของ PostgreSQL เข้า PATH แล้วเปิด terminal ใหม่ ไม่ต้องเปิด PostgreSQL server ในเครื่องเพื่อใช้ Supabase

## 3. โหลดโค้ด

1. ถ้าใช้ git เปิด terminal ในโฟลเดอร์ที่อยากเก็บงาน:

~~~sh
git clone https://github.com/Ch1tiipat/-SpaceLink-.git SpaceLink
cd SpaceLink
~~~

ทำแล้วควรเห็น README.md, AGENTS.md และโฟลเดอร์ apps ถ้า clone ไม่ได้ ให้ตรวจสิทธิ์เข้าถึง repo หรือใช้ Download ZIP

2. ถ้าใช้ ZIP เปิด GitHub repo เลือก branch main → Code → Download ZIP แตก ZIP ก่อน แล้วเปิด terminal ในโฟลเดอร์ที่มี README.md:

~~~sh
# เปลี่ยน path ให้ตรงโฟลเดอร์ที่แตก ZIP
cd "PATH_TO_EXTRACTED_REPO"
~~~

ทำแล้วควรอยู่ที่รากโค้ด ใช้คำสั่งต่อไปนี้ตรวจ ทั้ง PowerShell และ macOS/Linux ใช้ได้:

~~~sh
ls
~~~

หากไม่เห็น apps ให้เข้าโฟลเดอร์ชั้นในของ ZIP ก่อน คำว่า REPO_ROOT ในคู่มือต่อจากนี้หมายถึงโฟลเดอร์นี้

## 4. สร้างโปรเจกต์ Supabase

1. เข้า Supabase Dashboard → New project เลือก organization ของคุณ ตั้งชื่อและ database password เลือก region แล้วสร้าง รอจน project พร้อมใช้งาน เก็บ password ไว้ในเครื่องตัวเอง ไม่ส่งลงแชตหรือ commit

ขั้นนี้ทำในเว็บ ไม่มีคำสั่งสร้าง project ที่ต้องรันใน terminal เมื่อพร้อมแล้ว ตรวจว่าเครื่องมี client:

~~~sh
psql --version
~~~

ทำแล้วควรเห็นเวอร์ชัน client และ Dashboard แสดง project ที่สร้างเสร็จ

2. เปิดปุ่ม Connect ของ project และ Settings → API Keys เพื่อเก็บค่าลง env ของคุณเอง ตารางนี้บอกที่มา ไม่ใช่ค่าของทีม:

| ตัวแปร | หยิบจากไหน / ใส่อะไร |
|---|---|
| DATABASE_URL | Connect → connection string → Transaction pooler (port 6543) คัดลอก username/host จริงจากเว็บ แทน password ของคุณ แล้วเพิ่ม pgbouncer=true และ connection_limit=1 ใน query string |
| DIRECT_URL | Connect → Direct connection (port 5432) สำหรับ Prisma CLI และ SQL คัดลอกคนละ URL กับ pooled |
| SUPABASE_URL | Connect → App Frameworks หรือ Project URL ในหน้า project เช่น https://PROJECT_REF.supabase.co |
| SUPABASE_SERVICE_ROLE_KEY | Settings → API Keys → Legacy anon, service_role API keys → service_role ใช้ backend เท่านั้น โค้ด Storage ปัจจุบันส่งค่านี้เป็น Bearer จึงใช้ legacy service_role ตามคู่มือนี้ |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | หน้า Legacy เดียวกัน → anon สำหรับเว็บ ห้ามเลือก service_role |
| SUPABASE_JWKS_URL | Settings → JWT Keys ตรวจ signing key แบบ asymmetric แล้วใช้ https://PROJECT_REF.supabase.co/auth/v1/.well-known/jwks.json |
| SUPABASE_JWT_SECRET | เฉพาะ project ที่ใช้ legacy HS256: Settings → JWT Keys → Legacy JWT Secret ไม่ใช่ anon หรือ service_role |

JWKS คือรายการ public keys ที่ API ใช้ตรวจลายเซ็นการล็อกอิน ส่วน JWT secret คือวิธีเดิมที่ใช้ shared secret **ตั้ง SUPABASE_JWKS_URL หรือ SUPABASE_JWT_SECRET เพียงตัวเดียว** ตั้งทั้งคู่หรือไม่ตั้งเลย API จะไม่ boot ตัวอย่างหน้าตาค่า:

~~~dotenv
DATABASE_URL=postgresql://USER:PASSWORD@POOLER_HOST:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://USER:PASSWORD@DIRECT_HOST:5432/postgres
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_LEGACY_SERVICE_ROLE_KEY
SUPABASE_JWKS_URL=https://PROJECT_REF.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_JWT_SECRET=
~~~

ทำแล้วควรได้ค่าจาก project ของคุณเอง USER ของ pooled กับ direct อาจต่างกัน ห้ามคัดลอกสลับหรือพิมพ์ host จากความจำ หาก password มีอักขระพิเศษ ต้อง URL-encode password ใน connection string

Direct connection ของ Supabase Free ใช้ IPv6 ถ้าเครือข่ายเข้าไม่ได้ ให้ใช้ Connect → Session pooler port 5432 เป็นทางเลือกของ DIRECT_URL ตาม [เอกสารการเชื่อมต่อ](https://supabase.com/docs/guides/database/connecting-to-postgres) ห้ามใช้ transaction pooler port 6543 เพื่อแก้ migration ที่ค้าง

3. Storage bucket คือโฟลเดอร์หลักสำหรับเก็บไฟล์ เปิด Storage → New bucket สร้างชื่อตรงตามตาราง และเลือก Public เฉพาะรายการที่ระบุ:

| ชื่อ bucket | Public | ใช้เก็บ |
|---|---|---|
| slips | ปิด (private) | สลิปจ่ายเงินและหลักฐานที่ API จัดการ |
| shop-logos | เปิด | โลโก้ร้าน |
| event-banners | เปิด | แบนเนอร์งาน |
| event-gallery | เปิด | รูปแกลเลอรีงาน |

โค้ดไม่สร้าง bucket ให้เอง ไม่ต้องเพิ่ม policy ให้ browser อัปโหลดสลิปตรง API เป็นผู้จัดการไฟล์ ใช้ URL จาก Connect ตรวจการเข้าถึงบริการได้:

~~~sh
# แทน PROJECT_REF ด้วย project ของคุณ ไม่มี key ในคำสั่งนี้
curl -I https://PROJECT_REF.supabase.co
~~~

บน Windows ใช้ curl.exe แทน curl เพื่อไม่ชน alias ของ PowerShell ทำแล้วควรเชื่อม host ได้ การได้ HTTP 4xx ที่ root ไม่ใช่การทดสอบ bucket ให้ตรวจชื่อและ Public ใน Dashboard อีกครั้ง **ห้ามทำ slips เป็น public** เพื่อแก้ error ดู [วิธีสร้าง bucket](https://supabase.com/docs/guides/storage/buckets/creating-buckets)

4. เตรียม Email OTP คือรหัสใช้ครั้งเดียวที่ส่งเข้าอีเมล เปิด Authentication → Sign In / Providers ให้ Email เปิดใช้งาน และอนุญาต signup เปิด Authentication → Email Templates ใส่ตัวแปรรหัสใน template Confirm signup และ Magic Link:

~~~html
<p>รหัสเข้า SpaceLink ของคุณ: {{ .Token }}</p>
~~~

ตั้ง Authentication → URL Configuration ให้ Site URL เป็น http://localhost:3000 ทำแล้วควรได้รับอีเมลที่มีรหัสสำหรับกรอกในหน้าเว็บ ไม่ใช่มีเพียงลิงก์

Default SMTP ของ Supabase ส่งให้เฉพาะอีเมลสมาชิก organization ของ project และมี rate limit สำหรับการทดลอง ให้ลองด้วยอีเมลเจ้าของ project ก่อน ถ้าเจอ Email address not authorized ให้ใช้อีเมลสมาชิก project หรือกำหนด custom SMTP ของคุณเอง ไม่ปิดการยืนยันบัญชีเพื่อข้ามปัญหา ดู [Email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless) และ [ข้อจำกัด SMTP](https://supabase.com/docs/guides/auth/auth-smtp)

## 5. ตั้งค่า env ของ api

1. เปิด terminal ที่ REPO_ROOT ติดตั้ง dependencies ใน api แล้วคัดลอก template:

~~~sh
cd apps/api
npm install
cp .env.example .env
~~~

PowerShell ใช้ Copy-Item แทน cp ได้:

~~~powershell
Copy-Item .env.example .env
~~~

ทำแล้วควรมี apps/api/.env และ npm install จบ exit 0 postinstall จะ generate Prisma Client และ ERD ให้เอง Prisma Client คือโค้ดสำหรับเรียกฐานข้อมูล ถ้าติดตั้งหรือ generate ล้ม ให้หยุดอ่าน error ก่อน ไม่รัน migration ต่อ อย่าแทน .env ที่คุณเคยตั้งไว้ด้วย template ซ้ำ

2. เปิด .env ด้วย editor แล้วกรอกตามตาราง โดยใช้ค่าของ project คุณเอง:

| ชื่อ | จำเป็นไหม | ใส่อะไร |
|---|---|---|
| DATABASE_URL | ต้องใส่ | Transaction pooled URL จากข้อ 4 |
| DIRECT_URL | ต้องใส่ | Direct URL หรือ session pooler เมื่อไม่มี IPv6 |
| SUPABASE_URL | ต้องใส่ | Project URL |
| SUPABASE_SERVICE_ROLE_KEY | ต้องใส่ | legacy service_role ของ project นี้ backend เท่านั้น |
| SUPABASE_JWKS_URL | เลือกหนึ่งกับ JWT_SECRET | JWKS URL หาก signing key เป็น asymmetric |
| SUPABASE_JWT_SECRET | เลือกหนึ่งกับ JWKS_URL | legacy secret หากใช้ HS256 ตัวที่ไม่ใช้ปล่อยว่าง |
| NODE_ENV | เว้นได้ | development เป็นค่าเริ่มต้น ตั้ง development สำหรับคู่มือนี้ |
| PORT | เว้นได้ แต่แนะนำตั้ง | 3001 เพื่อไม่ชนเว็บ; template/default เป็น 3000 |
| CORS_ORIGIN | เว้นได้ แต่แนะนำตั้ง | http://localhost:3000; หลาย origin คั่น comma |
| SLIP_VERIFIER | แนะนำตั้ง; production บังคับ | mock สำหรับทดลอง; manual หรือ slipok เมื่อเลือกใช้งานนั้น |
| SLIP_VERIFIER_MODE | ตั้งคู่กับ mock | always-verified สำหรับเดโม หรือ always-invalid สำหรับลองสลิปไม่ผ่าน; production mock บังคับ |
| SLIPOK_BRANCH_ID | ต้องใส่เมื่อใช้ slipok | Branch ID ของบัญชี SlipOK ของคุณ |
| SLIPOK_API_KEY | ต้องใส่เมื่อใช้ slipok | API key ของบัญชี SlipOK ของคุณ |
| ZONE_RECOMMENDER | เว้นได้ | rule เป็นค่าเริ่มต้น; gemini เมื่อต้องการ AI จริง |
| SUPPORT_ASSISTANT | เว้นได้ | rule เป็นค่าเริ่มต้น; gemini เมื่อต้องการ AI จริง |
| GEMINI_API_KEY | ต้องใส่เมื่อ AI ตัวใดเป็น gemini | key ของคุณเอง ไม่ต้องใส่ในโหมด rule |
| GEMINI_MODEL | เว้นได้ | ค่า template สำหรับแนะนำโซน; ต้องเป็น Flash/Flash-Lite เท่านั้น |
| GEMINI_SUPPORT_MODEL | เว้นได้ | ค่า template สำหรับแชต; ต้องเป็น Flash/Flash-Lite เท่านั้น |
| VAPID_SUBJECT | เว้นได้ทั้งชุด | mailto:YOUR_EMAIL หากเปิด push |
| VAPID_PUBLIC_KEY | เว้นได้ทั้งชุด | public key ที่สร้างเอง |
| VAPID_PRIVATE_KEY | เว้นได้ทั้งชุด | private key เก็บเฉพาะ API |

โหมดไม่ใช้ key ของ SlipOK/Gemini/push ยังต้องใช้ค่าของ Supabase สำหรับระบบจริง ตั้งดังนี้:

~~~dotenv
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:3000
SLIP_VERIFIER=mock
SLIP_VERIFIER_MODE=always-verified
ZONE_RECOMMENDER=rule
SUPPORT_ASSISTANT=rule
SLIPOK_BRANCH_ID=
SLIPOK_API_KEY=
GEMINI_API_KEY=
VAPID_SUBJECT=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
~~~

ทำแล้ว API เลือก mock/rule และไม่ส่ง push **mock always-verified อนุมัติผลตรวจสลิปจำลอง ไม่ตรวจการโอนจริง** ใช้เพื่อทดลองเท่านั้น ถ้าใช้ slipok หรือ gemini ให้ใส่ key ของตัวเองก่อน ห้ามใช้ Gemini Pro หาก env ขาดหรือเลือกไม่ตรง ให้ดูข้อความจาก apps/api/src/config/env.validation.ts

3. ถ้าอยากลอง push: VAPID คือคู่ public/private key สำหรับยืนยันผู้ส่ง web push ใช้ web-push ที่ repo มีอยู่แล้ว จาก apps/api:

~~~sh
npx --no-install web-push generate-vapid-keys --json
~~~

ทำแล้วควรได้ publicKey และ privateKey สร้างในเครื่องตัวเอง ไม่ส่งผลลัพธ์เข้าแชต ตั้ง API ให้ครบ VAPID ทั้งสามตัว และคัดลอกเฉพาะ publicKey ไป NEXT_PUBLIC_VAPID_PUBLIC_KEY ของเว็บ ถ้าตั้งไม่ครบ validation จะปฏิเสธ ถ้าไม่ตั้งทั้งชุด push จะเงียบและไม่ error ดู [web-push](https://github.com/web-push-libs/web-push)

## 6. ตั้งค่า env ของ web

1. เปิด terminal อีกอันที่ REPO_ROOT:

~~~sh
cd apps/web
npm install
cp .env.example .env.local
~~~

PowerShell ใช้:

~~~powershell
Copy-Item .env.example .env.local
~~~

ทำแล้วควรมี apps/web/.env.local และ npm install จบ exit 0 อย่ารัน npm install ที่ราก repo

2. ใส่ทั้ง 4 ตัวตามนี้ ตัวอย่างทั้งหมดเป็น placeholders:

~~~dotenv
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_LEGACY_ANON_KEY
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
~~~

NEXT_PUBLIC หมายถึงค่าที่ browser มองเห็นได้ URL และ anon ต้องเป็น Supabase project เดียวกับ API ค่า VAPID ปล่อยว่างเมื่อไม่ใช้ push **ห้ามใส่ service_role หรือ private key ใน web เด็ดขาด** หากเปลี่ยน env ตอนเว็บรันอยู่ ให้หยุดแล้ว npm run dev ใหม่

## 7. ปัญหา port ชนกัน

1. Port คือช่องที่โปรแกรมเปิดรับ request ทั้ง api template และ next dev ใช้ 3000 ตามค่าเริ่มต้น คู่มือนี้จึงกำหนด:

~~~dotenv
# apps/api/.env
PORT=3001
CORS_ORIGIN=http://localhost:3000

# apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3001/api
~~~

ทำแล้วควรให้ API ฟัง 3001 และเว็บฟัง 3000 โค้ด main.ts อ่าน PORT และตั้ง prefix api ส่วน lib/api.ts ใช้ URL ที่ตั้งตรงๆ จึงต้องมี /api ท้าย URL

ถ้าเจอ EADDRINUSE ให้หยุด process เก่าที่เปิด port นั้นอยู่ หากต้องเปลี่ยน web port เช่นเป็น 3002 รันจาก apps/web และตั้ง CORS ให้ตรงกันก่อน restart API:

~~~sh
npm run dev -- --port 3002
~~~

ทำแล้วเว็บอยู่ http://localhost:3002 ไม่ควรปล่อยให้ Next เปลี่ยน port อัตโนมัติแล้วลืมแก้ CORS

## 8. เตรียมฐานข้อมูล

Migration คือ SQL ที่ Prisma เก็บเป็นประวัติการเปลี่ยนโครงสร้างฐานข้อมูล ส่วน seed คือการเติมข้อมูลเดโม ขั้นนี้ทำกับฐานข้อมูลส่วนตัวใหม่ของคุณเท่านั้น ต้องกรอก env ให้ครบก่อน

1. เปิด terminal ที่ apps/api แล้ว generate:

~~~sh
npx prisma generate
~~~

ทำแล้วควรเห็น Generated Prisma Client และการสร้าง ERD.md ไม่ได้สร้างตารางใน DB หาก generate ล้ม ให้หยุดก่อนทำขั้นถัดไป ไม่แก้ schema.prisma

2. ใช้ migrations ที่ repo มีเท่านั้น:

~~~sh
npx prisma migrate deploy
~~~

ทำแล้วควรเห็น migrations ถูก apply สำเร็จ ชุดนี้มี 21 migration.sql ไม่ใช้ migrate dev, migrate reset, db push หรือ db pull ในคู่มือนี้ ถ้าเจอ P1001 ให้ตรวจ DIRECT_URL, network และ IPv6 ตามข้อ 4 ถ้าเป็นฐานข้อมูลที่มีตารางอยู่ก่อนแล้ว ให้หยุดตรวจประวัติก่อน ห้าม reset เพื่อให้คำสั่งผ่าน

3. Apply SQL ต่อไปนี้ทีละไฟล์จาก apps/api ด้วย psql ชื่อ USER/HOST/port ต้องตรงกับ DIRECT_URL ที่คัดลอกมา ละ password ออกจากคำสั่งเพื่อให้ -W ถามในเครื่อง ตัวอย่างใช้ port 5432 และ database postgres:

~~~sh
psql -h HOST -p 5432 -U USER -d postgres -W -v ON_ERROR_STOP=1 -f prisma/sql/booking_active_event_booth_unique.sql
psql -h HOST -p 5432 -U USER -d postgres -W -v ON_ERROR_STOP=1 -f prisma/sql/enable_rls_saved_event.sql
psql -h HOST -p 5432 -U USER -d postgres -W -v ON_ERROR_STOP=1 -f prisma/sql/remove_authenticated_slips_upload_policy.sql
~~~

ทำแล้วแต่ละคำสั่งควร exit 0 และจบ COMMIT หากคำสั่งแรก error ให้หยุด ไม่รันไฟล์ถัดไป SQL แรกสร้าง partial unique index ซึ่งกันจองบูธเดียวกันซ้ำเฉพาะสถานะที่ยัง active ไฟล์สองเปิด RLS ของ saved_event ส่วนไฟล์สามถอน policy อัปโหลดสลิปตรงจาก browser

**ห้ามรัน scrum-144-refund-payout-review.sql** และห้ามรัน *.sql แบบเหมาทั้งโฟลเดอร์ ไฟล์นี้เป็นเอกสารรีวิว ไม่ใช่ขั้นติดตั้งที่อนุมัติ

4. **ตรวจ refund payout หลัง migration:** schema ใช้ payout_method, payout_prompt_pay_id, payout_bank_name, payout_account_number, payout_account_name และ migrations ทั้ง 21 ไฟล์มี `20261010082205_scrum_144_refund_payout_columns` สำหรับเพิ่มคอลัมน์เหล่านี้ด้วย ADD COLUMN IF NOT EXISTS ตรวจแบบอ่านอย่างเดียวใน SQL Editor:

~~~sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'refund_request'
  AND column_name IN (
    'payout_method', 'payout_prompt_pay_id', 'payout_bank_name',
    'payout_account_number', 'payout_account_name'
  )
ORDER BY column_name;
~~~

หลัง apply migrations ควรเห็น 5 แถว หากน้อยกว่า 5 ให้ **หยุดตรวจ migration history และฐานข้อมูลปลายทาง แล้วติดต่อผู้ดูแล** ห้าม reset, db push หรือรันไฟล์ review-only เอง IF NOT EXISTS ข้ามคอลัมน์ที่มีชื่ออยู่แล้ว ไม่ตรวจหรือแก้ type/nullability จึงต้องให้ผู้ดูแลตรวจว่าทั้ง 5 คอลัมน์เป็น TEXT และ nullable ด้วย คู่มือนี้ไม่รับรองว่าทุกฟีเจอร์พร้อมใช้เพียงเพราะตรวจพบคอลัมน์ครบ

ไปขั้น seed ได้เฉพาะฐานข้อมูลส่วนตัวที่มนุษย์ตรวจ migration และคอลัมน์พร้อมแล้ว คุณยังทดลอง boot/build แบบไม่มี DB ได้ตามข้อ 10

5. เติมข้อมูลเดโมเมื่อฐานข้อมูลพร้อม:

~~~sh
npm run db:seed
~~~

ทำแล้วควรเห็น Seeding finished พร้อมจำนวนข้อมูล เดโมหลักมี 3 องค์กร, 3 สถานที่, 12 โซน, 36 บูธ, 5 หมวดหมู่, 4 งาน และร้าน Future Innovations Shop มีงาน PUBLISHED, ONGOING, DRAFT, COMPLETED วันที่เดโมเป็นวันที่คงที่ จึงอาจไม่อยู่ในช่วงที่จองได้ในวันที่คุณลอง ไม่ใช่การรับรองว่าบูธทุกตัวจะจองได้

บัญชี vendor.spacelink@example.com ใน seed เป็นแถวข้อมูลจำลอง ใช้ auth_user_id จำลอง **ไม่ใช่บัญชี Supabase Auth ไม่มี password ให้ล็อกอิน** ต้องสมัครบัญชีของตัวเองผ่าน /register หลังรันระบบ แล้วสร้างร้านผ่านหน้าโปรไฟล์

ไม่ต้องตั้ง PHASE6_VENDOR_A_USER_ID หรือ ZZTEST_* สำหรับเดโมหลัก ถ้าไม่ตั้งจะเห็นข้อความ skipped ของ fixtures เสริม ถ้าเจอ Seed precondition failed ให้ตรวจว่าคุณไม่ได้ตั้งตัวแปร fixtures เสริมค้างไว้ ไม่ใช้ ID จำลองแทนผู้ใช้จริง ห้ามรัน seed ใน CI หรือฐานข้อมูลทีม

## 9. รันระบบ

1. Terminal แรกเปิดที่ REPO_ROOT:

~~~sh
cd apps/api
npm run start:dev
~~~

ทำแล้วควรเห็น Nest application successfully started และ mapped routes API อยู่ http://localhost:3001/api ปล่อย terminal นี้เปิดไว้ หาก env ผิด server จะหยุดตั้งแต่ boot ให้แก้ env ตาม error ก่อน

2. Terminal ที่สองเปิดที่ REPO_ROOT:

~~~sh
cd apps/web
npm run dev
~~~

ทำแล้วควรเห็น Ready และ Local: http://localhost:3000 เปิด URL นี้ใน browser หาก port ถูกใช้ ให้แก้ตามข้อ 7

## 10. เช็กว่ารันขึ้นจริง

1. ตรวจ API บน macOS/Linux:

~~~sh
curl -i http://localhost:3001/api/health
curl -i http://localhost:3001/api/health/db
~~~

PowerShell:

~~~powershell
curl.exe -i http://localhost:3001/api/health
curl.exe -i http://localhost:3001/api/health/db
~~~

ทำแล้ว /api/health ควรตอบ 200 เมื่อ server ทำงาน ส่วน /api/health/db ตอบ 200 พร้อม database: up เมื่อเชื่อม DB ได้ หรือ 503 พร้อม database: down เมื่อยังไม่มี DB Server ต้องไม่ล้มเพียงเพราะ DB ไม่พร้อม แต่ 200 ที่ health/db ตรวจแค่ connection ไม่ได้ยืนยันว่า schema หรือ migration ครบ

หากต้องการลองเฉพาะ build/boot แบบ offline ให้ใช้ placeholders ใน env ที่เครื่องคุณเองตามนี้ ไม่ใช้กับ migration/seed/login/storage:

~~~dotenv
DATABASE_URL=postgresql://placeholder:placeholder@127.0.0.1:1/placeholder?connect_timeout=2
DIRECT_URL=postgresql://placeholder:placeholder@127.0.0.1:1/placeholder?connect_timeout=2
SUPABASE_URL=https://placeholder.supabase.co
SUPABASE_SERVICE_ROLE_KEY=placeholder
SUPABASE_JWT_SECRET=placeholder
SUPABASE_JWKS_URL=
~~~

ทำแล้วควร boot ได้ และ health/db ตอบ 503 เพราะไม่มี DB นี่เป็นการทดลองแยกจากการตั้ง Supabase จริง หากเคยใช้ค่าจริงแล้ว อย่าเขียนทับ env นั้นเพื่อทดลอง offline

2. ตรวจหน้าเว็บ:

~~~sh
# macOS/Linux; Windows ใช้ curl.exe
curl -I http://localhost:3000/
curl -I http://localhost:3000/login
~~~

ทำแล้วควรตอบ HTTP 200 และเปิด browser เห็นหน้าแรก/หน้าล็อกอินภาษาไทย หากไม่มี DB หน้าแรกอาจแสดงข้อความโหลดงานไม่สำเร็จ แม้หน้าเว็บแสดงได้ ไม่แปลว่าข้อมูลหรือการจองใช้ได้

3. เมื่อ Supabase และ DB พร้อม เปิดหน้าสมัคร:

~~~text
http://localhost:3000/register
~~~

กรอกชื่อ อีเมลของคุณ แล้วกรอกรหัสจากอีเมล ทำแล้วควรกลับหน้าแรกเป็นผู้ขาย API เรียก /api/auth/me และสร้างแถว app_user โดย role เริ่ม VENDOR ถ้าอีเมลไม่มา ดูข้อจำกัด SMTP ในข้อ 4 ถ้า OTP ผ่านแต่ profile ไม่ได้ ให้ดู API/DB ไม่ใช่สมัครซ้ำหรือแก้ JWT metadata

### ทำให้บัญชีของตัวเองเป็นแอดมิน

4. ทำหลังสมัครและยืนยัน OTP สำเร็จ ใช้ **Supabase ของคุณเองเท่านั้น** เปิด Authentication → Users คัดลอก UUID ของบัญชีตัวเอง เปิด SQL Editor แล้วแทน YOUR_AUTH_USER_UUID ก่อนรัน:

~~~sql
SELECT user_id, auth_user_id, email, role
FROM public.app_user
WHERE auth_user_id = 'YOUR_AUTH_USER_UUID';
~~~

ทำแล้วควรเห็นหนึ่งแถวพร้อมอีเมลของคุณ user_id คือ ID ในระบบ SpaceLink ส่วน auth_user_id คือ UUID จาก Supabase Auth ถ้าไม่พบแถว ให้ตรวจว่า /api/auth/me สำเร็จหลัง OTP และ api/web ชี้ project เดียวกัน ห้ามสร้างแถวหรือเดา UUID เอง

5. เลือก role เพียงแบบเดียว ถ้าต้องเริ่มดูแลฐานข้อมูลส่วนตัวจากศูนย์ เลือก SUPER_ADMIN:

~~~sql
UPDATE public.app_user
SET role = 'SUPER_ADMIN', updated_at = now()
WHERE auth_user_id = 'YOUR_AUTH_USER_UUID'
RETURNING user_id, email, role;
~~~

หรือถ้าต้องการบัญชีแอดมินองค์กร เลือก ORG_ADMIN:

~~~sql
UPDATE public.app_user
SET role = 'ORG_ADMIN', updated_at = now()
WHERE auth_user_id = 'YOUR_AUTH_USER_UUID'
RETURNING user_id, email, role;
~~~

ทำแล้วควรคืนหนึ่งแถวและ role ที่เลือก ตรวจอีเมลให้ตรงก่อนรัน อย่าตัด WHERE ออกและอย่าใช้กับ project ทีม คำสั่งนี้เปลี่ยน app_user.role ไม่ได้เปลี่ยน role ใน Supabase JWT

6. **ไม่จำเป็นต้อง logout/login ใหม่เพื่อให้ backend รับ role ใหม่** SupabaseAuthGuard เรียก UserProvisioningService อ่าน app_user จาก DB ทุก authenticated request และ RolesGuard ใช้ role จากแถวนั้น หน้าเว็บเก็บ role ใน state จึงให้ reload หน้าเต็มๆ แล้วเปิด:

~~~text
SUPER_ADMIN: http://localhost:3000/super-admin
ORG_ADMIN:   http://localhost:3000/admin/bookings
~~~

ทำแล้วหน้าเว็บจะขอ /api/auth/me ใหม่ Logout/login ใหม่เป็นทางเลือก และหน้า login จะ redirect ตาม role ล่าสุด ไม่ต้องออก token ใหม่หรือแก้ user metadata

ORG_ADMIN **ต้องมีสมาชิกองค์กรใน org_membership ด้วย** เปลี่ยน role อย่างเดียวไม่ให้สิทธิ์เข้าถึงองค์กร ให้ใช้บัญชี SUPER_ADMIN เปิดเมนูจัดการแอดมินเพื่อมอบหมายบัญชีให้กับองค์กรที่สร้าง/seed ไว้ และเมนูองค์กรเพื่อแต่งตั้ง OWNER ตามต้องการ สิทธิ์การเงินและโซนเป็นสิทธิ์ที่ OWNER มอบให้ ADMIN ถ้าเข้าหน้าองค์กรแล้วไม่เห็นองค์กรหรือพบ 404 ให้ตรวจ membership ไม่ปิด guard เพื่อข้ามปัญหา

## 11. รันเทสต์

1. จาก apps/api รัน gate ทีละคำสั่ง:

~~~sh
npm run build
npx tsc --noEmit
npx eslint src prisma
npm test
~~~

ทำแล้วทุกคำสั่งต้อง exit 0 npm run build สร้าง dist, tsc ตรวจ TypeScript รวม seed, eslint ตรวจโดยไม่แก้ไฟล์, npm test รัน Jest **ไม่ใช้ npm run lint ของ API เป็น gate เพราะมี --fix** ถ้าคำสั่งใดล้ม ให้หยุดอ่าน error ไม่ข้ามคำสั่งนั้นแล้วบอกว่าผ่านทั้งหมด

2. จาก apps/web:

~~~sh
npm run build
npx tsc --noEmit
npx next lint
npm test
~~~

ทำแล้วทุกคำสั่งต้อง exit 0 สำหรับ build ต้องหยุด dev server ก่อนเพื่อไม่ให้เขียน .next ชนกัน Gates เหล่านี้ไม่ใช่การทดสอบ OTP/จอง/อัปโหลดไฟล์กับ Supabase จริง และไม่ต้องรัน db:seed เพื่อให้ gates ผ่าน

`npm test` ของเว็บเป็น unit tests เพิ่มเติมสำหรับรันในเครื่อง และต้องใช้ Node.js ตาม §2; CI ของเว็บยังรันสาม gates คือ build, tsc และ next lint

## 12. เจอปัญหาบ่อย

1. **API ไม่ boot เพราะ env ขาด/ผิด** อ่าน error ที่ terminal และตรวจ env.validation.ts ตัวที่ไม่ใช้ต้องว่าง โดยเฉพาะ JWKS/JWT และ VAPID:

~~~sh
# จาก apps/api หลังแก้ .env
npm run start:dev
~~~

ทำแล้วควร boot ผ่าน validation ถ้าเลือก slipok/gemini ต้องมี key ตามเงื่อนไข ถ้าใช้ mock ใน production ต้องระบุ mode ด้วย ห้ามแก้ validation ให้รับ env ผิด

2. **Port ชน** หยุด terminal เก่าด้วย Ctrl+C แล้วรัน API ก่อนเว็บด้วย port ตามข้อ 7:

~~~sh
# apps/api
npm run start:dev
~~~

ทำแล้วไม่ควรมี EADDRINUSE หากเว็บอยู่ 3002 จริง ต้องตั้ง CORS_ORIGIN เป็น http://localhost:3002 ด้วย

3. **ต่อ DB ไม่ได้ / P1001** ตรวจว่า DATABASE_URL เป็น pooled และ DIRECT_URL เป็น direct/session ตาม Connect ไม่สลับ host/username ตรวจ password ที่ URL-encode และ IPv6 แล้วตรวจ:

~~~sh
# Windows ใช้ curl.exe
curl -i http://localhost:3001/api/health/db
~~~

ทำแล้ว 200 คือเชื่อมได้ 503 คือยังไม่ได้ ห้าม reset/db push เพื่อแก้ network ถ้าเป็น error column does not exist ให้ตรวจ migration history และ refund payout หลัง migration ในข้อ 8

4. **CORS / เว็บเรียก API ไม่ได้** CORS คือกติกาที่ browser ใช้ตัดสินว่าเว็บเรียก server อีก origin ได้หรือไม่ ตั้ง URL เว็บให้ตรงใน CORS_ORIGIN แล้ว restart API ทดสอบ:

~~~sh
# Windows ใช้ curl.exe
curl -i -H "Origin: http://localhost:3000" http://localhost:3001/api/health
~~~

ทำแล้วควรมี Access-Control-Allow-Origin ที่ตรงเว็บ หาก URL ของ NEXT_PUBLIC_API_URL ไม่มี /api จะพบ 404 ต้องแก้ env แล้ว restart เว็บด้วย

5. **Login ไม่ได้** ตรวจ project URL/anon ของเว็บให้ตรง API, signing key ที่เลือก, template OTP, อีเมลสมาชิก project และ rate limit แล้วตรวจการเข้าถึงหน้า:

~~~sh
# Windows ใช้ curl.exe
curl -I http://localhost:3000/login
~~~

ทำแล้วควรได้ 200 แต่การยืนยันล็อกอินต้องทดลอง OTP จริง หน้า seed vendor ไม่มี password ให้ใช้ อย่าส่ง OTP, JWT หรือ key ให้คนอื่น หากล็อกอินได้แต่ role ไม่เปลี่ยน ให้ reload ตามหัวข้อแอดมิน

## 13. (ย่อ) ถ้าจะ deploy เอง

API ใช้ Render Web Service เลือก root directory apps/api, build command `npm ci --include=dev && npx prisma generate && npm run build`, start command `npm run start:prod` และ health path /api/health; web ใช้ Vercel เลือก root directory apps/web และ Next.js ตั้ง env ในหน้าตั้งค่าของแต่ละบริการ ไม่ใส่ในโค้ด ตั้ง NEXT_PUBLIC_API_URL เป็น URL ของ Render ที่ลงท้าย /api และ CORS_ORIGIN เป็น origin ของเว็บจริง ตั้ง Supabase URL Configuration ให้ตรงเว็บด้วย ใช้ NODE_ENV=production กับ provider ที่ตั้งชัดเจน ไม่ใช้ mock เพื่อรับเงินจริง ให้มนุษย์ตรวจ migration history, รัน migrations และตรวจ refund payout ตามข้อ 8 ก่อนใช้ฟีเจอร์ที่เกี่ยวข้อง ไม่เพิ่ม migrate deploy ลง build/start ดู [Render/NestJS](https://render.com/docs/deploy-nestjs-app) และ [Vercel/Next.js](https://vercel.com/docs/frameworks/full-stack/nextjs) ตัวอย่างตรวจหลัง deploy:

~~~sh
# แทนด้วย URL API ของคุณเอง; Windows ใช้ curl.exe
curl -i https://YOUR_API_HOST/api/health
curl -i https://YOUR_API_HOST/api/health/db
~~~

ทำแล้วควรได้ 200 ทั้งสอง URL เมื่อ API และ DB พร้อม การใส่ env ของ Vercel ต้องทำก่อน build และ deploy ใหม่เมื่อค่า NEXT_PUBLIC เปลี่ยน
