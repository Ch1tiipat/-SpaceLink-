/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this test directly. */
const coverAssert: typeof import('node:assert/strict') = require('node:assert/strict');
const { test: coverTest }: typeof import('node:test') = require('node:test');
const { EVENT_COVER_FALLBACK, getEventCoverUrl, resolveEventCoverUrl } =
  require('./event-cover.ts') as typeof import('./event-cover');

coverTest('uses a validated HTTPS event cover', () => {
  coverAssert.equal(
    getEventCoverUrl('https://project.supabase.co/banner.png'),
    'https://project.supabase.co/banner.png',
  );
});

coverTest('uses the shared fallback when the event has no cover', () => {
  coverAssert.equal(getEventCoverUrl(null), EVENT_COVER_FALLBACK);
  coverAssert.equal(getEventCoverUrl(''), EVENT_COVER_FALLBACK);
});

coverTest('rejects unsafe or malformed cover URLs', () => {
  for (const value of [
    'http://project.supabase.co/banner.png',
    'javascript:alert(1)',
    'https://user:password@project.supabase.co/banner.png',
    'not a URL',
  ]) {
    coverAssert.equal(getEventCoverUrl(value), EVENT_COVER_FALLBACK);
  }
});

coverTest('uses the fallback after a network or decode error', () => {
  coverAssert.equal(
    resolveEventCoverUrl('https://project.supabase.co/missing.png', true),
    EVENT_COVER_FALLBACK,
  );
  coverAssert.equal(
    resolveEventCoverUrl('https://project.supabase.co/banner.png', false),
    'https://project.supabase.co/banner.png',
  );
});
