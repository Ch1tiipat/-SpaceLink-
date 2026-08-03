import { BookingScreen } from '@/components/booking-screen';

export default function EventBookingPage({
  params,
}: {
  params: { eventId: string };
}) {
  return <BookingScreen eventId={params.eventId} />;
}
