import type { MyBooking } from './api';

export function isBookingReviewEligible(
  booking: Pick<MyBooking, 'status'>,
): boolean {
  return booking.status === 'CONFIRMED' || booking.status === 'COMPLETED';
}
