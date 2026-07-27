import { EventBookingScreen } from '@/components/event-booking-screen';

export default function EventBookingPage({
  params,
}: {
  params: { eventId: string };
}) {
  return <EventBookingScreen eventId={params.eventId} />;
}
