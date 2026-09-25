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
  compact,
}: {
  checked: boolean;
  compact: boolean;
}): { button: string; track: string; thumb: string } {
  return {
    button: `group relative inline-grid h-11 shrink-0 place-items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 ${
      compact ? 'w-14' : 'w-[66px]'
    } disabled:cursor-not-allowed disabled:opacity-60`,
    track: `relative block rounded-full transition-colors ${
      compact ? 'h-7 w-12' : 'h-9 w-[58px]'
    } ${checked ? 'bg-violet' : 'bg-[#d9d4df]'}`,
    thumb: `absolute left-1 top-1 rounded-full bg-white shadow transition-transform ${
      compact ? 'h-5 w-5' : 'h-7 w-7'
    } ${
      checked
        ? compact
          ? 'translate-x-5'
          : 'translate-x-[22px]'
        : 'translate-x-0'
    }`,
  };
}
