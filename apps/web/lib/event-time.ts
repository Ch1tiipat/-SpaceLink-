const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_EVENT_END_TIME = '23:59';

/**
 * Precise end-instant semantics for actions that become available immediately
 * after an event's Bangkok end time, such as submitting a review.
 */
export function hasEventEndInstantPassed(
  endDate: string,
  endTime: string | null,
  now = new Date(),
): boolean {
  const eventDate = endDate.slice(0, 10);
  const eventTime = endTime?.slice(0, 5) || DEFAULT_EVENT_END_TIME;
  const eventEnd = new Date(`${eventDate}T${eventTime}:00+07:00`);

  return !Number.isNaN(eventEnd.getTime()) && now >= eventEnd;
}

/**
 * Calendar-day semantics for browse filters. The final Bangkok calendar day
 * remains ongoing even when the event has an earlier explicit end time.
 */
export function hasEventEndCalendarDayPassed(
  endDate: string,
  now = new Date(),
): boolean {
  const eventEnd = new Date(endDate);
  if (Number.isNaN(eventEnd.getTime())) return false;

  const bangkokDay = (date: Date) =>
    Math.floor((date.getTime() + BANGKOK_OFFSET_MS) / DAY_MS);
  return bangkokDay(eventEnd) < bangkokDay(now);
}
