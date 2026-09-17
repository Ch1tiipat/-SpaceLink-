import DiscoveryPage from '@/app/page';
import { EventDetailScreen } from '@/components/event-detail-screen';

export default function EventPage({ params }: { params: { eventId: string } }) {
  return (
    <>
      <DiscoveryPage />
      <EventDetailScreen eventId={params.eventId} />
    </>
  );
}
