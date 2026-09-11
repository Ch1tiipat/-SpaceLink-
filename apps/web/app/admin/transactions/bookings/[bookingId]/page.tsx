import { AdminBookingDetailScreen } from '@/components/admin-booking-detail-screen';

export default async function AdminTransactionBookingDetailPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  return <AdminBookingDetailScreen bookingId={bookingId} />;
}
