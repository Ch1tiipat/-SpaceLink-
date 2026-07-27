import { EventMapScreen } from '@/components/event-map-screen';

export default function EventMapPage({
  params,
}: {
  params: { eventId: string };
}) {
  return <EventMapScreen eventId={params.eventId} />;
}
