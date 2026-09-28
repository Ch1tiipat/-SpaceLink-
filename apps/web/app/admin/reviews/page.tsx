import { Suspense } from 'react';
import { AdminReviewsScreen } from '@/components/admin-reviews-screen';

export default function AdminReviewsPage() {
  return (
    <Suspense
      fallback={
        <main className="sl-app-background grid min-h-[calc(100vh-72px)] place-items-center text-sm font-bold text-muted">
          กำลังโหลดหน้าจัดการรีวิว
        </main>
      }
    >
      <AdminReviewsScreen />
    </Suspense>
  );
}
