export type NotificationPreferenceSummary = {
  allEnabled: boolean;
  someEnabled: boolean;
  description: string;
};

export const NOTIFICATION_SETTINGS_GRID_CLASS =
  'grid divide-y divide-line px-5 sm:px-7 lg:grid-cols-2 lg:divide-x lg:divide-y-0';

export function getNotificationPreferenceSummary(
  enabledPreferences: readonly boolean[],
): NotificationPreferenceSummary {
  const enabledCount = enabledPreferences.filter(Boolean).length;
  const allEnabled =
    enabledPreferences.length > 0 && enabledCount === enabledPreferences.length;
  const someEnabled = enabledCount > 0;

  return {
    allEnabled,
    someEnabled,
    description: allEnabled
      ? `เปิดครบทั้ง ${enabledPreferences.length} หมวด`
      : someEnabled
        ? 'เปิดบางหมวด'
        : 'ปิดทุกหมวด',
  };
}

export function getNotificationSettingRowClass(index: number): string {
  return `flex min-w-0 items-center gap-4 py-4 ${
    index % 2 === 0 ? 'lg:pr-7' : 'lg:pl-7'
  }`;
}

export function getToggleSwitchClasses({
  checked,
}: {
  checked: boolean;
  compact: boolean;
}): { button: string; track: string; thumb: string } {
  return {
    button:
      'group relative inline-grid h-11 w-16 shrink-0 place-items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
    track: `relative block h-9 w-16 rounded-full transition ${
      checked ? 'bg-violet' : 'bg-[#d8d2df]'
    }`,
    thumb: `absolute top-1 h-7 w-7 rounded-full bg-white shadow transition ${
      checked ? 'right-1' : 'left-1'
    }`,
  };
}
