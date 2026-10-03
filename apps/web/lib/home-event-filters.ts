import type { DiscoveryEvent } from './api';
import { hasEventEndCalendarDayPassed } from './event-time.ts';

export type EventStatusFilter = 'all' | 'bookable' | 'closed';

export type HomeEventFilters = {
  query: string;
  area: string;
  categoryId: string;
  eventStatus: EventStatusFilter;
};

export type HomeFilterOption = {
  value: string;
  label: string;
  hint?: string;
};

export const EMPTY_HOME_EVENT_FILTERS: HomeEventFilters = {
  query: '',
  area: '',
  categoryId: '',
  eventStatus: 'all',
};

export function provinceFromAddress(address: string): string {
  const normalized = address.trim();
  const prefixed = /จังหวัด(\S+)/.exec(normalized);
  if (prefixed) return prefixed[1];
  if (normalized.includes('กรุงเทพมหานคร')) return 'กรุงเทพมหานคร';
  if (/^[ก-๙]{2,20}$/.test(normalized)) return normalized;
  return '';
}

export function buildHomeEventFilterOptions(
  events: DiscoveryEvent[],
): HomeFilterOption[] {
  return uniqueHomeFilterOptions([
    ...events.map((event) => ({
      value: event.name,
      label: event.name,
      hint: `Event · ${event.venue.name}`,
    })),
    ...events.map((event) => ({
      value: event.venue.name,
      label: event.venue.name,
      hint: 'สถานที่จัดงาน',
    })),
  ]);
}

export function buildHomeAreaFilterOptions(
  events: DiscoveryEvent[],
): HomeFilterOption[] {
  return uniqueHomeFilterOptions(
    events.map((event) => {
      const address = event.venue.address?.trim() ?? '';
      const province = provinceFromAddress(address);
      return {
        value: province,
        label: province,
      };
    }),
  );
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

  const filtered = events.filter((event) => {
    const hasEnded = hasEventEndCalendarDayPassed(event.endDate, now);
    const bookable = isBookable(event, now);
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
      ((filters.eventStatus === 'all' && !hasEnded) ||
        (filters.eventStatus === 'bookable' && bookable) ||
        (filters.eventStatus === 'closed' && !hasEnded && !bookable))
    );
  });

  if (filters.eventStatus !== 'all') return filtered;

  return filtered
    .map((event, sourceIndex) => ({
      event,
      sourceIndex,
      priority: isBookable(event, now) ? 0 : 1,
    }))
    .sort(
      (left, right) =>
        left.priority - right.priority || left.sourceIndex - right.sourceIndex,
    )
    .map(({ event }) => event);
}

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase('th-TH');
}

function uniqueHomeFilterOptions(
  options: HomeFilterOption[],
): HomeFilterOption[] {
  const seen = new Set<string>();

  return options.flatMap((option) => {
    const value = option.value.trim();
    const label = option.label.trim();
    const normalizedValue = normalizeSearchText(value);
    if (!value || !label || seen.has(normalizedValue)) return [];

    seen.add(normalizedValue);
    return [{ ...option, value, label }];
  });
}
