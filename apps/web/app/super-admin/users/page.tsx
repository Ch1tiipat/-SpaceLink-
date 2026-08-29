import { Suspense } from "react";
import { SuperAdminUsersScreen } from "@/components/super-admin/super-admin-users-screen";

export default function SuperAdminUsersPage() {
  return (
    <Suspense fallback={<UsersPageFallback />}>
      <SuperAdminUsersScreen />
    </Suspense>
  );
}

function UsersPageFallback() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-[15px] pb-11 pt-[23px] sm:px-[34px] sm:pt-[31px]">
      <div className="h-8 w-44 animate-pulse rounded-lg bg-[#eee8f4]" />
      <div className="mt-3 h-4 w-72 max-w-full animate-pulse rounded bg-[#f2edf8]" />
      <div className="mt-8 h-[360px] animate-pulse rounded-[15px] border border-[#ebe4ef] bg-white" />
    </div>
  );
}
