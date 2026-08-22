import { BookingReviewScreen } from '@/components/booking-review-screen';

export default async function BookingReviewPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return <BookingReviewScreen bookingId={bookingId} />;
}
