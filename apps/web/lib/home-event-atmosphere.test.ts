/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const atmosphereAssert: typeof import('node:assert/strict') = require(
  'node:assert/strict',
);
const { test: atmosphereTest }: typeof import('node:test') =
  require('node:test');
const {
  filterUsableAtmosphereUrls,
}: typeof import('./home-event-atmosphere') = require('./home-event-atmosphere.ts');

atmosphereTest('uses the next image when the first atmosphere image failed', () => {
  const first = 'https://example.com/broken.jpg';
  const second = 'https://example.com/working.jpg';

  atmosphereAssert.deepEqual(
    filterUsableAtmosphereUrls([first, second], new Set([first])),
    [second],
  );
});

atmosphereTest('returns no atmosphere images when every image failed', () => {
  const urls = [
    'https://example.com/broken-one.jpg',
    'https://example.com/broken-two.jpg',
  ];

  atmosphereAssert.deepEqual(
    filterUsableAtmosphereUrls(urls, new Set(urls)),
    [],
  );
});

atmosphereTest('counts each usable atmosphere image once', () => {
  const working = 'https://example.com/working.jpg';

  atmosphereAssert.deepEqual(
    filterUsableAtmosphereUrls(
      ['', working, working, 'https://example.com/second.jpg'],
      new Set(),
    ),
    [working, 'https://example.com/second.jpg'],
  );
});
