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
  'event detail dialog uses the approved wide frame and responsive card layout',
  () => {
    eventDetailModalAssert.match(
      eventDetailModalSource,
      /w-\[min\(1180px,calc\(100%-24px\)\)\]/,
    );
    eventDetailModalAssert.match(
      eventDetailModalSource,
      /sm:max-h-\[calc\(100dvh-48px\)\]/,
    );
    eventDetailModalAssert.match(
      eventDetailModalSource,
      /lg:grid-cols-\[\.95fr_1\.05fr\]/,
    );
    eventDetailModalAssert.match(
      eventDetailModalSource,
      /lg:grid-cols-2 xl:grid-cols-3 \[&>section\]:mt-0/,
    );
    eventDetailModalAssert.match(eventDetailModalSource, /EventZonePreview/);
    eventDetailModalAssert.doesNotMatch(
      eventDetailModalSource,
      /prototype-zone-map\.png|PROTOTYPE_EVENT_/,
    );
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
    eventDetailModalAssert.match(
      eventDetailModalSource,
      /document\.body\.style\.overflow = 'hidden'/,
    );
    eventDetailModalAssert.match(eventDetailModalSource, /ดูแผนผังโซน →/);
    eventDetailModalAssert.match(eventDetailModalSource, /บันทึก Event/);
    eventDetailModalAssert.match(
      eventDetailModalSource,
      /href=\{`\/events\/\$\{encodeURIComponent\(event\.slug\)\}\/map`\}/,
    );
  },
);
