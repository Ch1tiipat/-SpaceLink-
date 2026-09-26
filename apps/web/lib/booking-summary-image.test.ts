/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const summaryAssert: typeof import('node:assert/strict') = require(
  'node:assert/strict',
);
const { test: summaryTest }: typeof import('node:test') = require('node:test');
const {
  BOOKING_SUMMARY_MIME_TYPE,
  buildBookingSummaryRows,
  createBookingSummaryFileName,
} = require('./booking-summary-image.ts') as typeof import('./booking-summary-image');

const data = {
  eventName: 'งานเกษตร มทส. 2569',
  eventDate: '26–29 ก.ย. 2569',
  venueName: 'ลานจัดงานเกษตร',
  venueAddress: 'จังหวัดนครราชสีมา',
  shopName: 'ร้าน Nanny',
  totalAmount: '3,000',
  overallStatus: 'ยืนยันแล้ว',
  items: [
    {
      bookingCode: 'BK-A01',
      boothCode: 'A01',
      zoneName: 'โซนอาหาร',
      statusLabel: 'ยืนยันแล้ว',
    },
    {
      bookingCode: 'BK-A02',
      boothCode: 'A02',
      zoneName: 'โซนอาหาร',
      statusLabel: 'ยืนยันแล้ว',
    },
  ],
  generatedAt: new Date('2026-09-27T00:00:00.000Z'),
};

summaryTest('builds the complete summary rows from real booking data', () => {
  summaryAssert.deepEqual(buildBookingSummaryRows(data), [
    { label: 'งาน', value: 'งานเกษตร มทส. 2569' },
    { label: 'วันที่จัดงาน', value: '26–29 ก.ย. 2569' },
    {
      label: 'สถานที่',
      value: 'ลานจัดงานเกษตร · จังหวัดนครราชสีมา',
    },
    { label: 'ร้านค้า', value: 'ร้าน Nanny' },
    { label: 'ยอดรวม', value: '3,000 บาท' },
    { label: 'สถานะ', value: 'ยืนยันแล้ว' },
  ]);
});

summaryTest('uses a safe PNG filename and MIME type', () => {
  summaryAssert.equal(BOOKING_SUMMARY_MIME_TYPE, 'image/png');
  summaryAssert.equal(
    createBookingSummaryFileName('BK/2569 A01'),
    'SpaceLink_Booking_Summary_BK-2569-A01.png',
  );
  summaryAssert.match(createBookingSummaryFileName('***'), /booking\.png$/);
});
