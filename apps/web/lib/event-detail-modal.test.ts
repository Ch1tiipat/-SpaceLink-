/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const eventDetailModalAssert: typeof import('node:assert/strict') = require(
  'node:assert/strict',
);
const { readFileSync }: typeof import('node:fs') = require('node:fs');
const { join }: typeof import('node:path') = require('node:path');
const { test: eventDetailModalTest }: typeof import('node:test') =
  require('node:test');

const eventDetailModalSource = readFileSync(
  join(process.cwd(), 'components', 'event-detail-screen.tsx'),
  'utf8',
);

eventDetailModalTest(
  'event detail dialog uses the compact desktop frame and safe mobile viewport',
  () => {
    eventDetailModalAssert.match(
      eventDetailModalSource,
      /w-\[min\(900px,calc\(100%-16px\)\)\]/,
    );
    eventDetailModalAssert.match(
      eventDetailModalSource,
      /sm:max-h-\[min\(760px,calc\(100dvh-64px\)\)\]/,
    );
    eventDetailModalAssert.match(
      eventDetailModalSource,
      /min-h-\[240px\]/,
    );
    eventDetailModalAssert.match(eventDetailModalSource, /max-sm:min-h-\[310px\]/);
    eventDetailModalAssert.match(eventDetailModalSource, /line-clamp-2/);
  },
);

eventDetailModalTest(
  'event detail dialog preserves scrolling, close behavior, and primary actions',
  () => {
    eventDetailModalAssert.match(
      eventDetailModalSource,
      /min-h-0 overflow-y-auto overscroll-contain/,
    );
    eventDetailModalAssert.match(
      eventDetailModalSource,
      /aria-label="ปิดรายละเอียด Event"/,
    );
    eventDetailModalAssert.match(
      eventDetailModalSource,
      /onClose=\{\(\) => router\.replace\('\/'\)\}/,
    );
    eventDetailModalAssert.match(eventDetailModalSource, /ดู Zone Map →/);
    eventDetailModalAssert.match(eventDetailModalSource, /บันทึก Event/);
    eventDetailModalAssert.match(
      eventDetailModalSource,
      /href=\{`\/events\/\$\{encodeURIComponent\(event\.slug\)\}\/map`\}/,
    );
  },
);
