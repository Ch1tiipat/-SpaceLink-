import type { MyBooking } from './api';
import { hasEventEndInstantPassed } from './event-time.ts';

export function isBookingReviewEligible(
  booking: Pick<MyBooking, 'status' | 'event'>,
  now = new Date(),
): boolean {
  if (booking.status !== 'COMPLETED') return false;
  return hasEventEndInstantPassed(
    booking.event.endDate,
    booking.event.endTime,
    now,
  );
}
