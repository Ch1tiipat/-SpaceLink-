import { redirect } from 'next/navigation';

export default function AdminPaymentsPage() {
  redirect('/admin/transactions?tab=payments');
}
