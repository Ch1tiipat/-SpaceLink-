/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const webPushAssert: typeof import('node:assert/strict') = require(
  'node:assert/strict',
);
const { test: webPushTest }: typeof import('node:test') = require('node:test');
const {
  createWebPushPreviewNotification,
  isWebPushPreviewNotificationId,
  prependWebPushPreview,
} = require('./web-push-preview.ts') as typeof import('./web-push-preview');

webPushTest('adds exactly one unread candidate for each simulation click', () => {
  const first = createWebPushPreviewNotification(
    1,
    new Date('2026-09-25T03:00:00.000Z'),
  );
  const second = createWebPushPreviewNotification(
    2,
    new Date('2026-09-25T03:00:00.000Z'),
  );

  const afterFirstClick = prependWebPushPreview([], first);
  const afterRepeatedStateUpdate = prependWebPushPreview(
    afterFirstClick,
    first,
  );
  const afterSecondClick = prependWebPushPreview(
    afterRepeatedStateUpdate,
    second,
  );

  webPushAssert.equal(afterFirstClick.length, 1);
  webPushAssert.equal(afterRepeatedStateUpdate.length, 1);
  webPushAssert.equal(afterSecondClick.length, 2);
  webPushAssert.equal(afterSecondClick[0].id, second.id);
  webPushAssert.equal(isWebPushPreviewNotificationId(first.id), true);
  webPushAssert.equal(isWebPushPreviewNotificationId('server-notification'), false);
});
