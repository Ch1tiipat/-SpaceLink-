import { Suspense } from 'react';
import { AdminTransactionsScreen } from '@/components/admin-transactions-screen';

export default function AdminTransactionsPage() {
  return <Suspense fallback={<main className="grid min-h-[calc(100vh-72px)] place-items-center bg-[#f8f7fb] text-sm font-bold text-muted">กำลังโหลดศูนย์การเงินและการจอง</main>}><AdminTransactionsScreen /></Suspense>;
}
