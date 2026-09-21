import type { DiscoveryEvent } from './api';

export type EventStatusFilter = 'all' | 'bookable' | 'ongoing' | 'ended';

export type HomeEventFilters = {
  query: string;
  area: string;
  categoryId: string;
  eventStatus: EventStatusFilter;
};

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const EMPTY_HOME_EVENT_FILTERS: HomeEventFilters = {
  query: '',
  area: '',
  categoryId: '',
  eventStatus: 'all',
};

export function provinceFromAddress(address: string): string {
  const prefixed = /จังหวัด(\S+)/.exec(address);
  if (prefixed) return prefixed[1];
  if (address.includes('กรุงเทพมหานคร')) return 'กรุงเทพมหานคร';
  return address;
}

export function isEventEnded(endDate: string, now = new Date()): boolean {
  const eventEnd = new Date(endDate);
  if (Number.isNaN(eventEnd.getTime())) return false;

  const bangkokDay = (date: Date) =>
    Math.floor((date.getTime() + BANGKOK_OFFSET_MS) / DAY_MS);
  return bangkokDay(eventEnd) < bangkokDay(now);
}

export function filterHomeEvents(
  events: DiscoveryEvent[],
  filters: HomeEventFilters,
  isBookable: (
    event: Pick<DiscoveryEvent, 'status' | 'endDate'>,
    now?: Date,
  ) => boolean,
  now = new Date(),
): DiscoveryEvent[] {
  const keyword = filters.query.trim().toLocaleLowerCase('th');

  return events.filter((event) => {
    const searchable = [
      event.name,
      event.description ?? '',
      event.organization.name,
      event.venue.name,
      event.venue.address ?? '',
    ]
      .join(' ')
      .toLocaleLowerCase('th');

    return (
      (!keyword || searchable.includes(keyword)) &&
      (!filters.area ||
        provinceFromAddress(event.venue.address ?? '') === filters.area) &&
      (!filters.categoryId ||
        event.categories.some(
          (category) => category.id === filters.categoryId,
        )) &&
      (filters.eventStatus === 'all' ||
        (filters.eventStatus === 'bookable' && isBookable(event, now)) ||
        (filters.eventStatus === 'ongoing' &&
          event.status === 'ONGOING' &&
          !isEventEnded(event.endDate, now)) ||
        (filters.eventStatus === 'ended' && isEventEnded(event.endDate, now)))
    );
  });
}
