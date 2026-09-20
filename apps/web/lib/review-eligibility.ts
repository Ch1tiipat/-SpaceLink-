import type { MyBooking } from './api';

const bangkokDateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function bangkokDateTimeKey(value: Date): string {
  const parts = bangkokDateTimeFormatter.formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((item) => item.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

export function isBookingReviewEligible(
  booking: Pick<MyBooking, 'status' | 'event'>,
  now = new Date(),
): boolean {
  if (booking.status !== 'COMPLETED') return false;

  const eventDate = booking.event.endDate.slice(0, 10);
  const eventTime = booking.event.endTime?.slice(0, 5) || '23:59';
  return `${eventDate}T${eventTime}` <= bangkokDateTimeKey(now);
}
