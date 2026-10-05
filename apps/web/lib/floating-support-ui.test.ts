/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const supportAssert: typeof import('node:assert/strict') = require(
  'node:assert/strict',
);
const { readFileSync: readSupportSource }: typeof import('node:fs') =
  require('node:fs');
const { join: joinSupportPath }: typeof import('node:path') =
  require('node:path');
const { test: supportTest }: typeof import('node:test') = require('node:test');

const floatingSupportSource = readSupportSource(
  joinSupportPath(process.cwd(), 'components', 'app-shell.tsx'),
  'utf8',
);

supportTest('user Web Push and floating support do not render on Admin routes', () => {
  supportAssert.match(
    floatingSupportSource,
    /notificationToasts.length > 0 && !isAdminRoute/,
  );
  supportAssert.match(floatingSupportSource, /!isAdminRoute \? \(\s*<FloatingSupport/);
  supportAssert.match(
    floatingSupportSource,
    /if \(isSuperAdminRoute\) \{\s*return <>\{children\}<\/>;/,
  );
});

supportTest('launcher opens the contact menu before the AI dialog', () => {
  supportAssert.match(
    floatingSupportSource,
    /onClick=\{\(\) => setView\(expanded \? 'closed' : 'menu'\)\}/,
  );
  supportAssert.match(floatingSupportSource, /ช่องทางติดต่อ SpaceLink/);
  supportAssert.match(floatingSupportSource, /AI ช่วยคุณได้/);
  supportAssert.match(floatingSupportSource, /ติดต่อผ่าน Facebook/);
  supportAssert.match(floatingSupportSource, /โทรหาเจ้าหน้าที่ SpaceLink/);
});

supportTest('Facebook contact opens the supplied SpaceLink profile in a new tab', () => {
  const facebookLink = floatingSupportSource.match(
    /<a\s+[^>]*aria-label="ติดต่อผ่าน Facebook"[^>]*>/,
  )?.[0];
  supportAssert.ok(facebookLink, 'Facebook contact link must exist');
  supportAssert.match(
    facebookLink,
    /href="https:\/\/www\.facebook\.com\/profile\.php\?id=61594183376080&sk=about"/,
  );
  supportAssert.match(facebookLink, /target="_blank"/);
  supportAssert.match(facebookLink, /rel="noreferrer"/);
});

supportTest('AI panel exposes dialog semantics, Escape close, and focus restoration', () => {
  supportAssert.match(floatingSupportSource, /role="dialog"/);
  supportAssert.match(floatingSupportSource, /aria-labelledby="sl-ai-dialog-title"/);
  supportAssert.match(floatingSupportSource, /aria-describedby="sl-ai-dialog-description"/);
  supportAssert.match(floatingSupportSource, /event\.key !== 'Escape'/);
  supportAssert.match(floatingSupportSource, /data-ai-dialog-close/);
  supportAssert.match(floatingSupportSource, /data-floating-support-launcher/);
});

supportTest('recommendations identify the API booth without invented ranking badges', () => {
  supportAssert.match(
    floatingSupportSource,
    /matched\?\.booth\.code \?\? recommendation\.boothId/,
  );
  supportAssert.match(floatingSupportSource, /recommendation\.source === 'AI_GEMINI'/);
  supportAssert.doesNotMatch(floatingSupportSource, /\['เหมาะสุด', 'สมดุล', 'ประหยัด'\]/);
});
