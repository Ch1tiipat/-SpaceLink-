'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProfileShopScreen } from '@/components/profile-shop-screen';
import { useAuthState } from '@/lib/use-auth-state';

export default function ProfilePage() {
  const router = useRouter();
  const { auth } = useAuthState();
  const isSuperAdmin = auth.status === 'signed-in' && auth.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (isSuperAdmin) router.replace('/super-admin/profile');
  }, [isSuperAdmin, router]);

  if (isSuperAdmin) {
    return (
      <main role="status" className="sl-page grid min-h-[60vh] place-items-center px-6">
        กำลังเปิดโปรไฟล์ผู้ดูแลระบบส่วนกลาง…
      </main>
    );
  }

  // The parent shell owns login/unavailable handling. Keep the original screen
  // mounted while this independent role check resolves, including offline retry.
  return <ProfileShopScreen />;
}
