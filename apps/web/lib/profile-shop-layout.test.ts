/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const profileLayoutAssert: typeof import('node:assert/strict') = require(
  'node:assert/strict',
);
const { readFileSync: readProfileSource }: typeof import('node:fs') =
  require('node:fs');
const { join: joinProfilePath }: typeof import('node:path') =
  require('node:path');
const { test: profileLayoutTest }: typeof import('node:test') =
  require('node:test');

const profileSource = readProfileSource(
  joinProfilePath(process.cwd(), 'components', 'profile-shop-screen.tsx'),
  'utf8',
);

profileLayoutTest(
  'production profile keeps the approved compact information hierarchy',
  () => {
    profileLayoutAssert.match(
      profileSource,
      /lg:grid-cols-\[1\.08fr_\.92fr\]/,
    );
    profileLayoutAssert.match(profileSource, /สรุปบัญชี/);
    profileLayoutAssert.match(profileSource, /ข้อมูลหลักที่ใช้แสดงกับผู้จัดงาน/);
    profileLayoutAssert.match(profileSource, /ready\.shop\.name/);
    profileLayoutAssert.match(profileSource, /ready\.profile\.email/);
    profileLayoutAssert.match(profileSource, /ready\.profile\.province/);
  },
);

profileLayoutTest(
  'profile editor opens the requested tab without replacing production flows',
  () => {
    profileLayoutAssert.match(
      profileSource,
      /setEditorInitialTab\('profile'\)/,
    );
    profileLayoutAssert.match(profileSource, /setEditorInitialTab\('shop'\)/);
    profileLayoutAssert.match(
      profileSource,
      /useState<'profile' \| 'shop'>\(initialTab\)/,
    );
    profileLayoutAssert.match(profileSource, /uploadShopLogo\(file, token\)/);
    profileLayoutAssert.match(profileSource, /await updateShop\(payload, token\)/);
    profileLayoutAssert.match(profileSource, /createPushSubscription\(/);
    profileLayoutAssert.match(profileSource, /deletePushSubscription\(/);
  },
);
