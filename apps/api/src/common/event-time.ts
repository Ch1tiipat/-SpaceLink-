const DEFAULT_EVENT_END_TIME = '23:59';

/**
 * Returns whether the event's Bangkok end instant has passed.
 *
 * Prisma carries a PostgreSQL DATE as a UTC-midnight Date. Its YYYY-MM-DD
 * portion is therefore the event's calendar date, while `endTime` is local to
 * Bangkok. Events without an explicit end time stay active through 23:59.
 */
export function hasEventEndInstantPassed(
  endDate: Date,
  endTime: string | null,
  now = new Date(),
): boolean {
  const date = endDate.toISOString().slice(0, 10);
  const time = endTime?.slice(0, 5) || DEFAULT_EVENT_END_TIME;
  const eventEnd = new Date(`${date}T${time}:00+07:00`);

  return !Number.isNaN(eventEnd.getTime()) && now >= eventEnd;
}
