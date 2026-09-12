import { Suspense } from 'react';
import { AdminReviewsScreen } from '@/components/admin-reviews-screen';

export default function AdminReviewsPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-[calc(100vh-72px)] place-items-center bg-[#f8f7fb] text-sm font-bold text-muted">
          กำลังโหลดหน้าจัดการรีวิว
        </main>
      }
    >
      <AdminReviewsScreen />
    </Suspense>
  );
}
