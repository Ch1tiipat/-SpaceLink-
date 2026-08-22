import { BookingPaymentScreen } from '@/components/booking-payment-screen';

export default async function BookingPaymentPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return <BookingPaymentScreen bookingId={bookingId} />;
}
