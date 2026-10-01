/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const popupAssert: typeof import('node:assert/strict') = require(
  'node:assert/strict',
);
const { readFileSync: readPopupSource }: typeof import('node:fs') =
  require('node:fs');
const { join: joinPopupPath }: typeof import('node:path') =
  require('node:path');
const { test: popupTest }: typeof import('node:test') = require('node:test');

const popupSource = readPopupSource(
  joinPopupPath(process.cwd(), 'app', 'page.tsx'),
  'utf8',
);

popupTest('homepage Event cards open the runtime Event popup', () => {
  popupAssert.match(popupSource, /onOpen=\{openEventPopup\}/);
  popupAssert.match(popupSource, /getEventMap\(event\.id, controller\.signal\)/);
  popupAssert.match(popupSource, /summarizeEventZones\(eventMap\.zones\)/);
  popupAssert.doesNotMatch(popupSource, /PROTOTYPE_EVENT_(NEWS|ZONES|RULES)/);
});

popupTest('Event map preview is zoomable and links to the real map route', () => {
  popupAssert.match(popupSource, /เปิดภาพแผนผังโซนแบบซูมได้/);
  popupAssert.match(popupSource, /aria-label="ซูมเข้า"/);
  popupAssert.match(popupSource, /aria-label="ซูมออก"/);
  popupAssert.match(popupSource, /aria-label="รีเซ็ตขนาดแผนที่"/);
  popupAssert.match(
    popupSource,
    /`\/events\/\$\{encodeURIComponent\(event\.slug\)\}\/map`/,
  );
  popupAssert.doesNotMatch(popupSource, /prototype-zone-map\.png/);
});
