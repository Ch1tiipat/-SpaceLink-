/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const homepageAssert: typeof import('node:assert/strict') = require(
  'node:assert/strict',
);
const { readFileSync: readHomepageSource }: typeof import('node:fs') =
  require('node:fs');
const { join: joinHomepagePath }: typeof import('node:path') =
  require('node:path');
const { test: homepageTest }: typeof import('node:test') =
  require('node:test');

const homepageSource = readHomepageSource(
  joinHomepagePath(process.cwd(), 'app', 'page.tsx'),
  'utf8',
);
const announcementCardSource = homepageSource.slice(
  homepageSource.indexOf('function AnnouncementCard'),
  homepageSource.indexOf('function EventCard'),
);
const platformBenefitsSource = homepageSource.slice(
  homepageSource.indexOf('function PlatformBenefits'),
);

homepageTest('production homepage keeps the approved prototype hierarchy', () => {
  homepageAssert.match(homepageSource, /ประกาศข่าวสาร/);
  homepageAssert.match(homepageSource, /จองพื้นที่ขายได้ใน 3 ขั้นตอน/);
  homepageAssert.match(homepageSource, /ทำไมผู้จัดงานและ/);
  homepageAssert.match(homepageSource, /function HomepageFooter\(\)/);
  homepageAssert.match(homepageSource, /id="home-footer"/);
  homepageAssert.doesNotMatch(homepageSource, /HomepageCallToAction/);
});

homepageTest('production homepage retains runtime announcement states without prototype data', () => {
  homepageAssert.match(homepageSource, /announcementLoadStatus === 'error'/);
  homepageAssert.match(homepageSource, /visibleAnnouncements\.length === 0/);
  homepageAssert.match(homepageSource, /filterHomeAnnouncements\(announcements/);
  homepageAssert.doesNotMatch(homepageSource, /PROTOTYPE_ANNOUNCEMENTS/);
  homepageAssert.doesNotMatch(
    homepageSource,
    /ข้อมูลประกาศตัวอย่างสำหรับหน้า Prototype/,
  );
  homepageAssert.match(announcementCardSource, /organizationInitial/);
  homepageAssert.doesNotMatch(
    announcementCardSource,
    /src="\/brand\/spacelink-mark\.png"/,
  );
});

homepageTest('homepage footer replaces the shared footer only on the root page', () => {
  homepageAssert.match(homepageSource, /main\.sl-homepage \+ footer/);
  homepageAssert.match(homepageSource, /href="#home-top"/);
  homepageAssert.match(homepageSource, /href: '#announcements'/);
  homepageAssert.match(homepageSource, /href: '#events'/);
});

homepageTest('organizer and contact links lead to verified destinations', () => {
  homepageAssert.match(platformBenefitsSource, /href="\/support"/);
  homepageAssert.match(platformBenefitsSource, /ติดต่อเพื่อเริ่มจัดงาน/);
  homepageAssert.doesNotMatch(platformBenefitsSource, /เริ่มสร้างงานของคุณ/);
  homepageAssert.doesNotMatch(homepageSource, /https:\/\/www\.facebook\.com\//);
  homepageAssert.doesNotMatch(homepageSource, /https:\/\/www\.instagram\.com\//);
});
