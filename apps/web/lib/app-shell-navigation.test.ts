/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const appShellNavAssert: typeof import('node:assert/strict') = require(
  'node:assert/strict',
);
const { readFileSync: readAppShellSource }: typeof import('node:fs') =
  require('node:fs');
const { join: joinAppShellPath }: typeof import('node:path') =
  require('node:path');
const { test: appShellNavTest }: typeof import('node:test') =
  require('node:test');

const appShellSource = readAppShellSource(
  joinAppShellPath(process.cwd(), 'components', 'app-shell.tsx'),
  'utf8',
);

appShellNavTest('admin mobile navigation opens Notifications without relying on item order', () => {
  appShellNavAssert.match(
    appShellSource,
    /const NOTIFICATIONS_NAV_ITEM:[\s\S]*?href: '\/notifications'/,
  );
  appShellNavAssert.match(
    appShellSource,
    /const bottomNavItems = isAdmin[\s\S]*?\.\.\.visibleAdminItems, NOTIFICATIONS_NAV_ITEM/,
  );
  appShellNavAssert.doesNotMatch(
    appShellSource,
    /\.\.\.visibleAdminItems, NAV_GROUPS\[1\]\.items\[\d+\]/,
  );
});

appShellNavTest('vendor and admin mobile navigation share the named Notifications destination', () => {
  appShellNavAssert.match(
    appShellSource,
    /const BOTTOM_NAV:[\s\S]*?NOTIFICATIONS_NAV_ITEM/,
  );
  appShellNavAssert.match(
    appShellSource,
    /items: \[[\s\S]*?NOTIFICATIONS_NAV_ITEM,[\s\S]*?label: 'ติดต่อสอบถาม'/,
  );
});
