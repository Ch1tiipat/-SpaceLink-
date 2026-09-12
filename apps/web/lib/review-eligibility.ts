import type { MyBooking } from './api';

export function isBookingReviewEligible(
  booking: Pick<MyBooking, 'status' | 'event'>,
  now = Date.now(),
): boolean {
  const dateKey = new Date(booking.event.endDate).toISOString().slice(0, 10);
  const timePart =
    booking.event.endTime &&
    /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(booking.event.endTime)
      ? booking.event.endTime
      : '23:59';
  const eligibleFrom = new Date(`${dateKey}T${timePart}:00+07:00`).getTime();
  return (
    (booking.status === 'CONFIRMED' || booking.status === 'COMPLETED') &&
    eligibleFrom <= now
  );
}
