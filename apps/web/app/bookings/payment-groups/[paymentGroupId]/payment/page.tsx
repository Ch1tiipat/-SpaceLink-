import { BookingPaymentGroupScreen } from '@/components/booking-payment-group-screen';

export default function BookingPaymentGroupPage({
  params,
}: {
  params: { paymentGroupId: string };
}) {
  return <BookingPaymentGroupScreen paymentGroupId={params.paymentGroupId} />;
}
