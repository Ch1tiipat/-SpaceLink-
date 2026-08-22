import { BookingDetailScreen } from '@/components/booking-detail-screen';

export default async function BookingDetailPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return <BookingDetailScreen bookingId={bookingId} />;
}
