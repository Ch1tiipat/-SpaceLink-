import type { EventSummary } from './api';

const BOOKABLE_EVENT_STATUSES: EventSummary['status'][] = [
  'PUBLISHED',
  'ONGOING',
];

const bangkokDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function bangkokDateKey(value: Date): string {
  const parts = bangkokDateFormatter.formatToParts(value);
  const valueOf = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${valueOf('year')}-${valueOf('month')}-${valueOf('day')}`;
}

export function isEventBookable(
  event: Pick<EventSummary, 'status' | 'endDate'>,
  now = new Date(),
): boolean {
  if (!BOOKABLE_EVENT_STATUSES.includes(event.status)) return false;

  // PostgreSQL DATE values arrive as ISO strings. Compare their calendar-date
  // portion with today's Bangkok date so 00:00–06:59 ICT cannot inherit the
  // previous UTC day. The event remains bookable throughout its final day.
  return event.endDate.slice(0, 10) >= bangkokDateKey(now);
}
