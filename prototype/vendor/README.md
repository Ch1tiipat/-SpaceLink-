# SpaceLink UI (แยกไฟล์แล้ว)

โครงสร้างไฟล์:

- `index.html` — โครงสร้างหน้าเว็บ
- `styles.css` — สี Layout และ Responsive UI
- `app.js` — ข้อมูล Event, ฟังก์ชันหน้า, Popup และ Navigation
- `assets/` — รูปภาพและ Lucide icons

## เปิดใช้งาน

เปิดโฟลเดอร์นี้ใน VS Code แล้วใช้ Live Server เปิด `index.html`

## จุดที่แก้ UI บ่อย

- สีหลัก: ช่วง `:root` ด้านบนของ `styles.css`
- Sidebar / Topbar: `.side`, `.topbar`, `.shell`
- หน้า Home: ฟังก์ชัน `home()` ใน `app.js`
- Card Event: `eventCard()` ใน `app.js` และ `.event-card` ใน `styles.css`
- Popup: ฟังก์ชันที่ขึ้นต้นด้วย `open...()` และ `.modal` ใน `styles.css`
