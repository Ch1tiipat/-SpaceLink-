/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const bookingPaymentAssert: typeof import('node:assert/strict') = require(
  'node:assert/strict',
);
const { readFileSync: readBookingPaymentSource }: typeof import('node:fs') =
  require('node:fs');
const { join: joinBookingPaymentPath }: typeof import('node:path') =
  require('node:path');
const { test: bookingPaymentTest }: typeof import('node:test') =
  require('node:test');

const bookingPaymentSource = readBookingPaymentSource(
  joinBookingPaymentPath(
    process.cwd(),
    'components',
    'booking-payment-screen.tsx',
  ),
  'utf8',
);

bookingPaymentTest('payment metrics include the reference, booth, total, and countdown', () => {
  bookingPaymentAssert.match(bookingPaymentSource, /Booking ID/);
  bookingPaymentAssert.match(bookingPaymentSource, />Booth</);
  bookingPaymentAssert.match(bookingPaymentSource, /ยอดชำระ/);
  bookingPaymentAssert.match(bookingPaymentSource, /เวลาที่เหลือ/);
  bookingPaymentAssert.match(bookingPaymentSource, /BookingCountdown/);
});

bookingPaymentTest('payment content follows the prototype hierarchy', () => {
  bookingPaymentAssert.match(bookingPaymentSource, /PAYMENT METHOD/);
  bookingPaymentAssert.match(bookingPaymentSource, /PromptPay QR/);
  bookingPaymentAssert.match(bookingPaymentSource, /PAYMENT DETAIL/);
  bookingPaymentAssert.match(bookingPaymentSource, /สรุปรายการ/);
  bookingPaymentAssert.match(bookingPaymentSource, /PAYMENT FLOW/);
  bookingPaymentAssert.match(bookingPaymentSource, /คำแนะนำ/);
});

bookingPaymentTest('payment page preserves upload safety and responsive columns', () => {
  bookingPaymentAssert.match(
    bookingPaymentSource,
    /lg:grid-cols-\[minmax\(0,1fr\)_300px\]/,
  );
  bookingPaymentAssert.match(bookingPaymentSource, /PreviewSlipUploadPanel/);
  bookingPaymentAssert.match(bookingPaymentSource, /SlipUploadPanel/);
  bookingPaymentAssert.match(bookingPaymentSource, /JPEG หรือ PNG/);
  bookingPaymentAssert.match(bookingPaymentSource, /ไม่เกิน 5 MB/);
});
