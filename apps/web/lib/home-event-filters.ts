import type { DiscoveryEvent } from './api';
import { hasEventEndCalendarDayPassed } from './event-time.ts';

export type EventStatusFilter = 'all' | 'bookable' | 'ongoing' | 'ended';

export type HomeEventFilters = {
  query: string;
  area: string;
  categoryId: string;
  eventStatus: EventStatusFilter;
};

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

export function filterHomeEvents(
  events: DiscoveryEvent[],
  filters: HomeEventFilters,
  isBookable: (
    event: Pick<DiscoveryEvent, 'status' | 'endDate'>,
    now?: Date,
  ) => boolean,
  now = new Date(),
): DiscoveryEvent[] {
  const keyword = normalizeSearchText(filters.query);
  const areaKeyword = normalizeSearchText(filters.area);

  return events.filter((event) => {
    const searchable = normalizeSearchText(
      [event.name, event.venue.name].join(' '),
    );
    const areaSearchable = normalizeSearchText(
      [
        provinceFromAddress(event.venue.address ?? ''),
        event.venue.name,
        event.venue.address ?? '',
      ].join(' '),
    );

    return (
      (!keyword || searchable.includes(keyword)) &&
      (!areaKeyword || areaSearchable.includes(areaKeyword)) &&
      (!filters.categoryId ||
        event.categories.some(
          (category) => category.id === filters.categoryId,
        )) &&
      (filters.eventStatus === 'all' ||
        (filters.eventStatus === 'bookable' && isBookable(event, now)) ||
        (filters.eventStatus === 'ongoing' &&
          event.status === 'ONGOING' &&
          !hasEventEndCalendarDayPassed(event.endDate, now)) ||
        (filters.eventStatus === 'ended' &&
          hasEventEndCalendarDayPassed(event.endDate, now)))
    );
  });
}

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase('th-TH');
}
