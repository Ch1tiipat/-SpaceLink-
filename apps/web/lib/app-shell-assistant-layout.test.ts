/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const appShellAssert: typeof import('node:assert/strict') = require(
  'node:assert/strict',
);
const { readFileSync: readAssistantLayoutSource }: typeof import('node:fs') =
  require('node:fs');
const { join: joinAssistantLayoutPath }: typeof import('node:path') =
  require('node:path');
const { test: appShellTest }: typeof import('node:test') =
  require('node:test');

const assistantLayoutSource = readAssistantLayoutSource(
  joinAssistantLayoutPath(process.cwd(), 'components', 'app-shell.tsx'),
  'utf8',
);

appShellTest('web push uses runtime broadcast data in a compact notification card', () => {
  appShellAssert.match(assistantLayoutSource, /aria-label="Web Push จาก SpaceLink"/);
  appShellAssert.match(assistantLayoutSource, /Web Push · \{toast.label\}/);
  appShellAssert.match(assistantLayoutSource, /href=\{toast.href\}/);
  appShellAssert.match(assistantLayoutSource, /fixed right-3 top-\[78px\]/);
  appShellAssert.match(assistantLayoutSource, /top-\[78px\] z-\[25\]/);
  appShellAssert.match(assistantLayoutSource, /<header className="sticky top-0 z-30/);
  appShellAssert.match(assistantLayoutSource, /max-h-\[calc\(100dvh-220px\)\]/);
  appShellAssert.match(assistantLayoutSource, /w-\[min\(380px,calc\(100%-24px\)\)\]/);
  appShellAssert.match(assistantLayoutSource, /flex-col gap-3 overflow-y-auto/);
  appShellAssert.match(assistantLayoutSource, /flex shrink-0 items-start/);
  appShellAssert.match(assistantLayoutSource, /line-clamp-3/);
  appShellAssert.doesNotMatch(assistantLayoutSource, /prototype-web-push/);
});

appShellTest('AI assistant keeps the compact prototype navigation and actions', () => {
  appShellAssert.match(assistantLayoutSource, /ตอบคำถาม และแนะนำการใช้งานของ SpaceLink/);
  appShellAssert.match(assistantLayoutSource, /คำถามยอดนิยม/);
  appShellAssert.match(assistantLayoutSource, /ขอเพิ่มโควต้า/);
  appShellAssert.match(assistantLayoutSource, /โซนที่แนะนำ/);
  appShellAssert.match(assistantLayoutSource, /ดูแผนผังเต็ม/);
  appShellAssert.match(assistantLayoutSource, /onClick=\{\(\) => setView\('chat'\)\}/);
  appShellAssert.match(
    assistantLayoutSource,
    /href=\{`\/events\/\$\{encodeURIComponent\(selectedEvent\.slug\)\}\/map[\s\S]*?onClick=\{\(\) => setView\('closed'\)\}/,
  );
});

appShellTest('AI action links close the dialog before navigating for current and archived answers', () => {
  const actionLinks = assistantLayoutSource.match(
    /<Link[\s\S]*?key=\{action\}[\s\S]*?href=\{details\.href\}[\s\S]*?onClick=\{\(\) => setView\('closed'\)\}[\s\S]*?>/g,
  );

  appShellAssert.equal(actionLinks?.length, 2);
});
