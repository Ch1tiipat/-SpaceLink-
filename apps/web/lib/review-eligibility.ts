import type { MyBooking } from './api';

export function isBookingReviewEligible(
  booking: Pick<MyBooking, 'id'>,
): boolean {
  return booking.id.length > 0;
}
