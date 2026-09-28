/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const bookingCoverAssert: typeof import('node:assert/strict') = require(
  'node:assert/strict',
);
const { readFileSync: readBookingCoverSource }: typeof import('node:fs') =
  require('node:fs');
const { join: joinBookingCoverPath }: typeof import('node:path') =
  require('node:path');
const { test: bookingCoverTest }: typeof import('node:test') =
  require('node:test');

const bookingCoverSource = readBookingCoverSource(
  joinBookingCoverPath(process.cwd(), 'components', 'my-bookings-screen.tsx'),
  'utf8',
);

bookingCoverTest('booking cards render the remote event cover without image optimization', () => {
  bookingCoverAssert.match(
    bookingCoverSource,
    /<BookingEventCover[\s\S]*bannerUrl=\{booking\.event\.bannerUrl\}/,
  );
  bookingCoverAssert.match(
    bookingCoverSource,
    /<Image[\s\S]*src=\{resolveEventCoverUrl\(bannerUrl, hasLoadFailed\)\}[\s\S]*unoptimized/,
  );
});

bookingCoverTest('booking event cover keeps its safe fallback after a load failure', () => {
  bookingCoverAssert.match(
    bookingCoverSource,
    /onError=\{\(\) => setHasLoadFailed\(true\)\}/,
  );
});
