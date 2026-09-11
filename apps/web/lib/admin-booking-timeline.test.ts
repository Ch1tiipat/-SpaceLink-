/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const timelineAssert: typeof import('node:assert/strict') = require('node:assert/strict');
const { test: timelineTest }: typeof import('node:test') = require('node:test');
const {
  ADMIN_TIMELINE_TYPES,
  describeAdminTimelineItem,
  timelineTone,
} = require('./admin-booking-timeline.ts') as typeof import('./admin-booking-timeline');

timelineTest('provides a Thai label for every persisted milestone type', () => {
  for (const type of ADMIN_TIMELINE_TYPES) {
    const description = describeAdminTimelineItem({ type });
    timelineAssert.ok(description.label.length > 0);
  }
});

timelineTest('describes status and decimal amount without floating-point conversion', () => {
  timelineAssert.deepEqual(
    describeAdminTimelineItem({ type: 'SLIP_VERIFIED', status: 'VERIFIED', amount: '1234567.5' }),
    { label: 'ตรวจสอบสลิปสำเร็จ', detail: 'สถานะ VERIFIED · ยอด ฿1,234,567.50', tone: 'green' },
  );
});

timelineTest('assigns warning and failure tones to refund and cancellation milestones', () => {
  timelineAssert.equal(timelineTone('REFUND_REQUESTED'), 'amber');
  timelineAssert.equal(timelineTone('BOOKING_CANCELLED'), 'red');
  timelineAssert.equal(timelineTone('PAYMENT_GROUP_CANCELLED'), 'red');
});
