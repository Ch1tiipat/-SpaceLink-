import type { AdminAnnouncement, AnnouncementType } from './api';

export type AnnouncementFilter = 'all' | AnnouncementType;

export function filterHomeAnnouncements<T extends AdminAnnouncement>(
  announcements: T[],
  filter: AnnouncementFilter,
): T[] {
  if (filter === 'all') return announcements;
  return announcements.filter((announcement) => announcement.type === filter);
}
