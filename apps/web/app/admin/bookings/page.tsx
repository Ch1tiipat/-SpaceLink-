import { redirect } from 'next/navigation';

export default function AdminBookingsPage() {
  redirect('/admin/transactions?tab=bookings');
}
