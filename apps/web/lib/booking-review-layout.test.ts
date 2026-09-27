/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const bookingReviewAssert: typeof import('node:assert/strict') = require(
  'node:assert/strict',
);
const { readFileSync: readBookingReviewSource }: typeof import('node:fs') =
  require('node:fs');
const { join: joinBookingReviewPath }: typeof import('node:path') =
  require('node:path');
const { test: bookingReviewTest }: typeof import('node:test') =
  require('node:test');

const bookingReviewSource = readBookingReviewSource(
  joinBookingReviewPath(process.cwd(), 'components', 'booking-screen.tsx'),
  'utf8',
);
const bookingReviewPaymentSource = readBookingReviewSource(
  joinBookingReviewPath(
    process.cwd(),
    'components',
    'booking-payment-screen.tsx',
  ),
  'utf8',
);

bookingReviewTest('booking review keeps the three-step checkout flow', () => {
  bookingReviewAssert.match(bookingReviewSource, /เลือกบูธ/);
  bookingReviewAssert.match(bookingReviewSource, /ตรวจสอบข้อมูล/);
  bookingReviewAssert.match(bookingReviewSource, /ชำระเงิน/);
});

bookingReviewTest('selected booth review exposes the prototype information hierarchy', () => {
  bookingReviewAssert.match(bookingReviewSource, /SELECTED BOOTH/);
  bookingReviewAssert.match(bookingReviewSource, /Booth ที่เลือก/);
  bookingReviewAssert.match(bookingReviewSource, /ข้อมูล Event/);
  bookingReviewAssert.match(bookingReviewSource, /สรุปการจอง/);
  bookingReviewAssert.match(bookingReviewSource, /รวมทั้งหมด/);
});

bookingReviewTest('booking review preserves responsive layout and existing actions', () => {
  bookingReviewAssert.match(
    bookingReviewSource,
    /xl:grid-cols-\[minmax\(0,1fr\)_380px\]/,
  );
  bookingReviewAssert.match(bookingReviewSource, /sm:grid-cols-2/);
  bookingReviewAssert.match(bookingReviewSource, /สร้าง Booking และไปชำระเงิน/);
  bookingReviewAssert.match(bookingReviewSource, /ส่งคำร้องขอเพิ่มโควตา/);
  bookingReviewAssert.match(bookingReviewSource, /นำ Booth .* ออกจากรายการ/);
});

bookingReviewTest('compact review balances shop and payment receiver information with the summary', () => {
  bookingReviewAssert.match(bookingReviewSource, /ร้านค้าที่ใช้จอง/);
  bookingReviewAssert.match(bookingReviewSource, /PAYMENT RECEIVER/);
  bookingReviewAssert.match(bookingReviewSource, /BOOKING QUOTA/);
  bookingReviewAssert.match(bookingReviewSource, /BOOKING POLICY/);
  bookingReviewAssert.match(
    bookingReviewSource,
    /grid gap-3 sm:grid-cols-2/,
  );
});

bookingReviewTest('confirmed payment opens an accessible success dialog instead of the legacy message page', () => {
  bookingReviewAssert.match(
    bookingReviewPaymentSource,
    /paymentSucceeded \|\| booking\.status === 'CONFIRMED'/,
  );
  bookingReviewAssert.match(
    bookingReviewPaymentSource,
    /<BookingPaymentSuccessDialog/,
  );
  bookingReviewAssert.doesNotMatch(
    bookingReviewPaymentSource,
    /title="ยืนยันการจองเรียบร้อยแล้ว"/,
  );
  bookingReviewAssert.match(bookingReviewPaymentSource, /role="dialog"/);
  bookingReviewAssert.match(bookingReviewPaymentSource, /aria-modal="true"/);
  bookingReviewAssert.match(
    bookingReviewPaymentSource,
    /motion-safe:animate-ping/,
  );
});

bookingReviewTest('success dialog keeps both explicit post-payment actions', () => {
  bookingReviewAssert.match(bookingReviewPaymentSource, /href="\/bookings"/);
  bookingReviewAssert.match(bookingReviewPaymentSource, /ไปการจองของฉัน/);
  bookingReviewAssert.match(bookingReviewPaymentSource, /เลือกบูธเพิ่ม/);
  bookingReviewAssert.match(
    bookingReviewPaymentSource,
    /\/events\/\$\{encodeURIComponent\(booking\.event\.slug \?\? booking\.event\.id\)\}\/map/,
  );
});
