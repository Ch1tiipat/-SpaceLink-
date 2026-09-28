/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const eventMapLayoutAssert: typeof import('node:assert/strict') = require(
  'node:assert/strict',
);
const { readFileSync: readEventMapSource }: typeof import('node:fs') =
  require('node:fs');
const { join: joinEventMapPath }: typeof import('node:path') =
  require('node:path');
const { test: eventMapLayoutTest }: typeof import('node:test') =
  require('node:test');

const eventMapSource = readEventMapSource(
  joinEventMapPath(process.cwd(), 'components', 'event-map-screen.tsx'),
  'utf8',
);

eventMapLayoutTest('event map follows the prototype information hierarchy', () => {
  eventMapLayoutAssert.match(eventMapSource, /EVENT FLOOR PLAN/);
  eventMapLayoutAssert.match(eventMapSource, /lg:grid-cols-\[minmax\(0,1fr\)_340px\]/);
  eventMapLayoutAssert.match(eventMapSource, /แนะนำ Zone ด้วย AI/);
  eventMapLayoutAssert.match(eventMapSource, /เลือก Zone อย่างรวดเร็ว/);
  eventMapLayoutAssert.match(eventMapSource, /ตัวกรองบูธ/);
  eventMapLayoutAssert.match(eventMapSource, /BOOKING SUMMARY/);
});

eventMapLayoutTest('event map preserves booth selection and quota actions', () => {
  eventMapLayoutAssert.match(eventMapSource, /decideBoothQuota\(/);
  eventMapLayoutAssert.match(eventMapSource, /นำ Booth .* ออกจากรายการ/);
  eventMapLayoutAssert.match(eventMapSource, /ดำเนินการต่อ →/);
  eventMapLayoutAssert.match(eventMapSource, /ขอเพิ่มโควตา \/ ติดต่อผู้จัดงาน/);
});

eventMapLayoutTest('quota dialog provides a visual status and clear actions', () => {
  eventMapLayoutAssert.match(eventMapSource, /BOOKING QUOTA/);
  eventMapLayoutAssert.match(eventMapSource, /สิทธิ์การเลือกครั้งนี้/);
  eventMapLayoutAssert.match(eventMapSource, /ระบบจะเก็บบูธที่เลือกไว้เดิม/);
  eventMapLayoutAssert.match(eventMapSource, /กลับไปเลือกใหม่/);
  eventMapLayoutAssert.match(eventMapSource, /ยืนยัน \{kind\.selectedCount\} บูธที่เลือก/);
});
