import { Suspense } from "react";
import { SuperAdminSupportScreen } from "@/components/super-admin/super-admin-support-screen";

export default function SuperAdminSupportPage() {
  return (
    <Suspense fallback={<SupportFallback />}>
      <SuperAdminSupportScreen />
    </Suspense>
  );
}

function SupportFallback() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-[15px] pb-11 pt-[23px] sm:px-[34px] sm:pt-[31px]">
      <div className="h-8 w-52 animate-pulse rounded-lg bg-[#eee8f4]" />
      <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-[#f2edf8]" />
      <div className="mt-8 h-[420px] animate-pulse rounded-[15px] border border-[#ebe4ef] bg-white" />
    </div>
  );
}
