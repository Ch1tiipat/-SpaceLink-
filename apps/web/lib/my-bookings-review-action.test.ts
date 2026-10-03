/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const reviewActionAssert: typeof import('node:assert/strict') = require(
  'node:assert/strict',
);
const { readFileSync: readReviewActionSource }: typeof import('node:fs') =
  require('node:fs');
const { join: joinReviewActionPath }: typeof import('node:path') =
  require('node:path');
const { test: reviewActionTest }: typeof import('node:test') =
  require('node:test');

const reviewActionSource = readReviewActionSource(
  joinReviewActionPath(process.cwd(), 'components', 'my-bookings-screen.tsx'),
  'utf8',
);

reviewActionTest('confirmed bookings expose a direct review action on cards and in the detail dialog', () => {
  reviewActionAssert.doesNotMatch(
    reviewActionSource,
    /group\.status === 'COMPLETED'[\s\S]{0,160}isBookingReviewEligible/,
  );
  reviewActionAssert.match(
    reviewActionSource,
    /href=\{`\/bookings\/\$\{encodeURIComponent\(reviewBooking\.bookingCode\)\}\/review`\}[\s\S]{0,180}>\s*รีวิว\s*<\/Link>/,
  );
});

reviewActionTest('the detail dialog keeps icon, Escape and backdrop close controls without a redundant close footer button', () => {
  const footer = reviewActionSource.match(
    /<footer className="mt-5[\s\S]*?<\/footer>/,
  )?.[0];

  reviewActionAssert.ok(footer, 'booking detail footer must exist');
  reviewActionAssert.doesNotMatch(footer, /onClick=\{onClose\}/);
  reviewActionAssert.doesNotMatch(footer, />\s*ปิด\s*</);
  reviewActionAssert.match(reviewActionSource, /aria-label="ปิดรายละเอียดการจอง"/);
  reviewActionAssert.match(reviewActionSource, /event\.key === 'Escape'/);
  reviewActionAssert.match(
    reviewActionSource,
    /if \(event\.target === event\.currentTarget\) onClose\(\)/,
  );
});
