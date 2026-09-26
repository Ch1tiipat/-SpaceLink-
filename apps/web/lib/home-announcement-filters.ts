import type { AdminAnnouncement, AnnouncementType } from './api';

export type AnnouncementFilter = 'all' | AnnouncementType;
export type AnnouncementLoadStatus = 'success' | 'partial-error' | 'error';

export function resolveAnnouncementLoad<T>(
  results: PromiseSettledResult<T[]>[],
): { items: T[]; status: AnnouncementLoadStatus } {
  const items = results.flatMap((result) =>
    result.status === 'fulfilled' ? result.value : [],
  );
  const failedCount = results.filter(
    (result) => result.status === 'rejected',
  ).length;

  if (failedCount === 0) return { items, status: 'success' };
  if (failedCount === results.length) return { items, status: 'error' };
  return { items, status: 'partial-error' };
}

export function filterHomeAnnouncements<T extends AdminAnnouncement>(
  announcements: T[],
  filter: AnnouncementFilter,
): T[] {
  if (filter === 'all') return announcements;
  return announcements.filter((announcement) => announcement.type === filter);
}
