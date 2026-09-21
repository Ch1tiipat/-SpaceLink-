/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const helpAssert: typeof import('node:assert/strict') = require(
  'node:assert/strict'
);
const { test: helpTest }: typeof import('node:test') = require('node:test');
const { filterHelpFaqs, HELP_FAQS } = require('./help-center.ts') as typeof import('./help-center');

helpTest('returns every FAQ when the search is empty', () => {
  helpAssert.equal(filterHelpFaqs(HELP_FAQS, '').length, HELP_FAQS.length);
  helpAssert.equal(filterHelpFaqs(HELP_FAQS, '   ').length, HELP_FAQS.length);
});

helpTest('matches Thai question and keyword text', () => {
  helpAssert.deepEqual(
    filterHelpFaqs(HELP_FAQS, 'คืนเงิน').map((item) => item.id),
    ['refund'],
  );
  helpAssert.deepEqual(
    filterHelpFaqs(HELP_FAQS, 'quota').map((item) => item.id),
    ['booking-quota'],
  );
});

helpTest('matches explanatory answer text case-insensitively', () => {
  helpAssert.deepEqual(
    filterHelpFaqs(HELP_FAQS, 'WEB PUSH').map((item) => item.id),
    ['notifications'],
  );
});

helpTest('uses the booking statuses shown in My Bookings', () => {
  const bookingStatusFaq = HELP_FAQS.find((item) => item.id === 'booking-status');
  helpAssert.ok(bookingStatusFaq);

  const searchableText = [
    bookingStatusFaq.keywords,
    ...bookingStatusFaq.answers,
  ].join(' ');

  for (const label of [
    'รอชำระเงิน',
    'ยืนยันแล้ว',
    'เสร็จสิ้น',
    'ไม่มาเข้าร่วม',
    'ยกเลิกแล้ว',
  ]) {
    helpAssert.ok(searchableText.includes(label), `missing booking status: ${label}`);
  }
  helpAssert.equal(searchableText.includes('รอยืนยัน'), false);
  helpAssert.deepEqual(
    filterHelpFaqs(HELP_FAQS, 'ไม่มาเข้าร่วม').map((item) => item.id),
    ['booking-status'],
  );
});

helpTest('returns an empty list when no FAQ matches', () => {
  helpAssert.deepEqual(
    filterHelpFaqs(HELP_FAQS, 'คำที่ไม่มีอยู่ในศูนย์ช่วยเหลือ'),
    [],
  );
});
