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

appShellNavTest('Admin My Space keeps Support on its dedicated route', () => {
  appShellNavAssert.match(
    appShellSource,
    /label: 'ติดต่อสอบถาม',[\s\S]*?href: '\/support',[\s\S]*?pathname\.startsWith\('\/support'\)/,
  );
  appShellNavAssert.match(
    appShellSource,
    /const ADMIN_MY_SPACE_NAV_GROUP:[\s\S]*?\.\.\.NAV_GROUPS\[1\],[\s\S]*?items: NAV_GROUPS\[1\]\.items/,
  );
  appShellNavAssert.doesNotMatch(
    appShellSource,
    /item\.href !== '\/support'/,
  );
});

appShellNavTest('Admin role filtering cannot shift the named mobile destinations', () => {
  appShellNavAssert.match(
    appShellSource,
    /if \(adminRole === 'SUPER_ADMIN'\) return true;/,
  );
  appShellNavAssert.match(
    appShellSource,
    /selectedOrganization\?\.membershipRole === 'OWNER'/,
  );
  appShellNavAssert.match(
    appShellSource,
    /const bottomNavItems = isAdmin[\s\S]*?\.\.\.visibleAdminItems, NOTIFICATIONS_NAV_ITEM/,
  );
  appShellNavAssert.doesNotMatch(
    appShellSource,
    /NAV_GROUPS\[1\]\.items\[3\]/,
  );
});
