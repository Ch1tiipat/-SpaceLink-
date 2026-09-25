/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const notificationSettingsAssert: typeof import('node:assert/strict') =
  require('node:assert/strict');
const {
  test: notificationSettingsTest,
}: typeof import('node:test') = require('node:test');
const {
  getNotificationPreferenceSummary,
  getNotificationSettingRowClass,
  getToggleSwitchClasses,
  NOTIFICATION_SETTINGS_GRID_CLASS,
} =
  require('./notification-settings-ui.ts') as typeof import('./notification-settings-ui');

notificationSettingsTest(
  'master toggle is on only when every notification preference is on',
  () => {
    notificationSettingsAssert.deepEqual(
      getNotificationPreferenceSummary(Array(7).fill(true)),
      {
        allEnabled: true,
        someEnabled: true,
        description: 'เปิดครบทั้ง 7 หมวด',
      },
    );
    notificationSettingsAssert.deepEqual(
      getNotificationPreferenceSummary(Array(7).fill(false)),
      {
        allEnabled: false,
        someEnabled: false,
        description: 'ปิดทุกหมวด',
      },
    );
    notificationSettingsAssert.deepEqual(
      getNotificationPreferenceSummary([
        true,
        false,
        true,
        false,
        true,
        false,
        true,
      ]),
      {
        allEnabled: false,
        someEnabled: true,
        description: 'เปิดบางหมวด',
      },
    );
  },
);

notificationSettingsTest(
  'toggle switch classes expose clear on and off states with a 44px tap target',
  () => {
    const regularOn = getToggleSwitchClasses({ checked: true, compact: false });
    const regularOff = getToggleSwitchClasses({
      checked: false,
      compact: false,
    });
    const compactOn = getToggleSwitchClasses({ checked: true, compact: true });
    const compactOff = getToggleSwitchClasses({ checked: false, compact: true });

    for (const classes of [regularOn, regularOff, compactOn, compactOff]) {
      notificationSettingsAssert.match(classes.button, /\bh-11\b/);
    }
    notificationSettingsAssert.match(regularOn.track, /\bbg-violet\b/);
    notificationSettingsAssert.equal(
      regularOn.thumb.includes('translate-x-[22px]'),
      true,
    );
    notificationSettingsAssert.equal(
      regularOff.track.includes('bg-[#d9d4df]'),
      true,
    );
    notificationSettingsAssert.match(regularOff.thumb, /\btranslate-x-0\b/);
    notificationSettingsAssert.match(compactOn.thumb, /\btranslate-x-5\b/);
    notificationSettingsAssert.match(compactOff.thumb, /\btranslate-x-0\b/);
  },
);

notificationSettingsTest(
  'notification settings switch from one column to two responsive columns',
  () => {
    notificationSettingsAssert.match(
      NOTIFICATION_SETTINGS_GRID_CLASS,
      /\blg:grid-cols-2\b/,
    );
    notificationSettingsAssert.match(
      NOTIFICATION_SETTINGS_GRID_CLASS,
      /\blg:divide-x\b/,
    );
    notificationSettingsAssert.match(
      NOTIFICATION_SETTINGS_GRID_CLASS,
      /\blg:divide-y-0\b/,
    );
    notificationSettingsAssert.match(
      NOTIFICATION_SETTINGS_GRID_CLASS,
      /\bsm:px-7\b/,
    );
    notificationSettingsAssert.match(
      getNotificationSettingRowClass(0),
      /\blg:pr-7\b/,
    );
    notificationSettingsAssert.match(
      getNotificationSettingRowClass(1),
      /\blg:pl-7\b/,
    );
  },
);
