import { redirect } from 'next/navigation';

export default function AdminVendorsPage() {
  redirect('/admin/transactions?tab=vendors');
}
