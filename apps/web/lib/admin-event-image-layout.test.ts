import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const source = readFileSync(
  join(process.cwd(), 'components', 'admin-events-screen.tsx'),
  'utf8',
);

test('the event card has one entry point for details and images', () => {
  const card = source.slice(
    source.indexOf('export function AdminEventsScreen()'),
    source.indexOf('{createOpen && token && organizationId'),
  );
  assert.match(card, /รายละเอียดภายในงานและรูปภาพ/);
  assert.doesNotMatch(card, /จัดการแกลเลอรี/);
});

test('the details dialog groups information, gallery and map image without nested dialogs', () => {
  const dialog = source.slice(
    source.indexOf('function EventInformationDialog({'),
    source.indexOf('function EventJoinInformationDialog({'),
  );
  assert.match(dialog, /ข้อมูลภายในงาน/);
  assert.match(dialog, /รูปบรรยากาศ/);
  assert.match(dialog, /รูปแผนผังพื้นที่/);
  assert.match(dialog, /<EventGallerySection/);
  assert.match(dialog, /<EventMapImageSection/);
});

test('map image copy distinguishes the floor plan from cover and travel maps', () => {
  const section = source.slice(
    source.indexOf('function EventMapImageSection({'),
    source.indexOf('function CreateEventDialog({'),
  );
  assert.match(section, /ตำแหน่งโซนและบูธ/);
  assert.match(section, /ไม่ใช่ภาพปกหรือแผนที่เดินทาง/);
  assert.match(section, /บันทึกรูปแผนผัง/);
});
