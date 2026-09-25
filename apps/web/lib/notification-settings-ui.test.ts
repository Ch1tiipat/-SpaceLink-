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
  'all toggle switches share the reference size and clear on and off states',
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
      notificationSettingsAssert.match(classes.button, /\bw-16\b/);
      notificationSettingsAssert.match(classes.track, /\bh-9\b/);
      notificationSettingsAssert.match(classes.track, /\bw-16\b/);
      notificationSettingsAssert.match(classes.thumb, /\bh-7\b/);
      notificationSettingsAssert.match(classes.thumb, /\bw-7\b/);
    }
    notificationSettingsAssert.match(regularOn.track, /\bbg-violet\b/);
    notificationSettingsAssert.match(regularOn.thumb, /\bright-1\b/);
    notificationSettingsAssert.equal(
      regularOff.track.includes('bg-[#d8d2df]'),
      true,
    );
    notificationSettingsAssert.match(regularOff.thumb, /\bleft-1\b/);
    notificationSettingsAssert.match(compactOn.track, /\bbg-violet\b/);
    notificationSettingsAssert.match(compactOn.thumb, /\bright-1\b/);
    notificationSettingsAssert.equal(
      compactOff.track.includes('bg-[#d8d2df]'),
      true,
    );
    notificationSettingsAssert.match(compactOff.thumb, /\bleft-1\b/);
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
