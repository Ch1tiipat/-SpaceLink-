/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const viewModelAssert: typeof import('node:assert/strict') = require(
  'node:assert/strict',
);
const { test: viewModelTest }: typeof import('node:test') =
  require('node:test');
const {
  getEventBookingStatusLabel,
  getEventDetailPrimaryAction,
  googleMapsDirectionsUrl,
  googleMapsEmbedUrl,
  parseVenueCoordinates,
  safePublicHttpUrl,
  safePublicHttpsUrl,
  summarizeEventZones,
} = require('./event-detail-view-model.ts') as typeof import('./event-detail-view-model');

const EVENT_DETAIL_NOW = new Date('2026-09-27T05:00:00.000Z');

viewModelTest('summarizes real booth availability, price, and categories', () => {
  const summary = summarizeEventZones([
    {
      booths: [
        { boothPrice: '1800', availability: 'AVAILABLE' },
        { boothPrice: '2200', availability: 'BOOKED' },
      ],
      categories: [{ name: 'อาหาร' }, { name: ' เครื่องดื่ม ' }],
    },
    {
      booths: [{ boothPrice: '1500', availability: 'AVAILABLE' }],
      categories: [{ name: 'อาหาร' }, { name: '' }],
    },
  ]);

  viewModelAssert.deepEqual(summary, {
    totalBooths: 3,
    availableBooths: 2,
    startingPrice: 1500,
    categories: ['อาหาร', 'เครื่องดื่ม'],
  });
});

viewModelTest('uses the shared booking rule for status and primary action', () => {
  const bookable = { status: 'PUBLISHED' as const, endDate: '2026-09-27' };
  const draft = { status: 'DRAFT' as const, endDate: '2026-10-01' };
  const ended = { status: 'COMPLETED' as const, endDate: '2026-09-26' };

  viewModelAssert.deepEqual(
    getEventDetailPrimaryAction(bookable, EVENT_DETAIL_NOW),
    {
    kind: 'BOOK',
    label: 'เลือกบูธ',
    },
  );
  viewModelAssert.equal(
    getEventBookingStatusLabel(bookable, EVENT_DETAIL_NOW),
    'กำลังเปิดให้สำรองพื้นที่',
  );
  viewModelAssert.deepEqual(
    getEventDetailPrimaryAction(draft, EVENT_DETAIL_NOW),
    {
    kind: 'MAP',
    label: 'ดูแผนผัง',
    },
  );
  viewModelAssert.equal(
    getEventBookingStatusLabel(draft, EVENT_DETAIL_NOW),
    'ยังไม่เปิดรับจอง',
  );
  viewModelAssert.equal(
    getEventBookingStatusLabel(ended, EVENT_DETAIL_NOW),
    'สิ้นสุดแล้ว',
  );
});

viewModelTest('accepts only safe public web URLs', () => {
  viewModelAssert.equal(
    safePublicHttpUrl('https://example.com/event'),
    'https://example.com/event',
  );
  viewModelAssert.equal(
    safePublicHttpUrl('http://example.com/event'),
    'http://example.com/event',
  );
  viewModelAssert.equal(safePublicHttpsUrl('http://example.com/image'), null);
  viewModelAssert.equal(safePublicHttpUrl('javascript:alert(1)'), null);
  viewModelAssert.equal(
    safePublicHttpUrl('https://user:secret@example.com/event'),
    null,
  );
});

viewModelTest('validates coordinates before creating Google Maps URLs', () => {
  const coordinates = parseVenueCoordinates('14.8818', '102.0209');
  viewModelAssert.deepEqual(coordinates, {
    latitude: 14.8818,
    longitude: 102.0209,
  });
  viewModelAssert.equal(parseVenueCoordinates('91', '102.0209'), null);
  viewModelAssert.equal(parseVenueCoordinates(null, '102.0209'), null);
  viewModelAssert.match(
    googleMapsEmbedUrl(coordinates!),
    /^https:\/\/www\.google\.com\/maps\?/,
  );
  viewModelAssert.match(
    googleMapsDirectionsUrl(coordinates!),
    /^https:\/\/www\.google\.com\/maps\/dir\/\?/,
  );
});
