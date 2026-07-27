import { EventDetailScreen } from '@/components/event-detail-screen';

export default function EventPage({
  params,
}: {
  params: { eventId: string };
}) {
  return <EventDetailScreen eventId={params.eventId} />;
}
