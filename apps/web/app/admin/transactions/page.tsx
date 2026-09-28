import { Suspense } from 'react';
import { AdminTransactionsScreen } from '@/components/admin-transactions-screen';

export default function AdminTransactionsPage() {
  return (
    <Suspense
      fallback={
        <main className="sl-app-background grid min-h-[calc(100vh-72px)] place-items-center text-sm font-bold text-muted">
          กำลังโหลดศูนย์การเงินและการจอง
        </main>
      }
    >
      <AdminTransactionsScreen />
    </Suspense>
  );
}
