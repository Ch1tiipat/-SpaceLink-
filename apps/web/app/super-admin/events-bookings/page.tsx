import { Suspense } from "react";
import { SuperAdminEventsBookingsScreen } from "@/components/super-admin/super-admin-events-bookings-screen";

export default function SuperAdminEventsBookingsPage() {
  return (
    <Suspense fallback={<EventsBookingsFallback />}>
      <SuperAdminEventsBookingsScreen />
    </Suspense>
  );
}

function EventsBookingsFallback() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-[15px] pb-11 pt-[23px] sm:px-[34px] sm:pt-[31px]">
      <div className="h-8 w-60 animate-pulse rounded-lg bg-[#eee8f4]" />
      <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-[#f2edf8]" />
      <div className="mt-8 h-[420px] animate-pulse rounded-[15px] border border-[#ebe4ef] bg-white" />
    </div>
  );
}
