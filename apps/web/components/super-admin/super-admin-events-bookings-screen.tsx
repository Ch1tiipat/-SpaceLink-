"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  RefreshCw,
  RotateCcw,
  Search,
  Store,
  TicketCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminSlipActions } from "@/components/admin-slip-actions";
import {
  ApiError,
  getAdminOrganizationEvents,
  getSuperAdminBookings,
  getSuperAdminOrganizations,
  getSuperAdminRefunds,
  type AdminOrganizationEvent,
  type BookingStatus,
  type SuperAdminBooking,
  type SuperAdminOrganization,
  type SuperAdminRefund,
} from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const PAGE_SIZE = 25;
const BOOKING_STATUSES: BookingStatus[] = [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "CANCELLED",
  "NO_SHOW",
  "COMPLETED",
];
const REFUND_STATUSES: SuperAdminRefund["status"][] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "PROCESSED",
];
const THAI_DATE = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeZone: "Asia/Bangkok",
});
const THAI_DATE_TIME = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok",
});

type Tab = "events" | "bookings" | "payments";

export function SuperAdminEventsBookingsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));
  const [organizations, setOrganizations] = useState<SuperAdminOrganization[]>([]);
  const [organizationsLoading, setOrganizationsLoading] = useState(true);
  const [organizationsError, setOrganizationsError] = useState("");
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [bookings, setBookings] = useState<SuperAdminBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState("");
  const [refunds, setRefunds] = useState<SuperAdminRefund[]>([]);
  const [refundsLoading, setRefundsLoading] = useState(false);
  const [refundsError, setRefundsError] = useState("");
  const [events, setEvents] = useState<AdminOrganizationEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setOrganizationsLoading(true);
    setOrganizationsError("");

    void (async () => {
      try {
        const token = await getAccessToken();
        const rows = await getSuperAdminOrganizations(token, controller.signal);
        if (active) {
          setOrganizations(
            [...rows].sort((left, right) =>
              left.name.localeCompare(right.name, "th-TH", {
                sensitivity: "base",
              }),
            ),
          );
        }
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        if (active)
          setOrganizationsError(errorMessage(cause, "โหลดรายชื่อองค์กรไม่สำเร็จ"));
      } finally {
        if (active) setOrganizationsLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadKey]);

  useEffect(() => {
    if (tab !== "bookings") return;
    const controller = new AbortController();
    let active = true;
    setBookingsLoading(true);
    setBookingsError("");

    void (async () => {
      try {
        const token = await getAccessToken();
        const rows = await getSuperAdminBookings(token, controller.signal);
        if (active) setBookings(rows);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        if (active) setBookingsError(errorMessage(cause, "โหลดข้อมูลการจองไม่สำเร็จ"));
      } finally {
        if (active) setBookingsLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadKey, tab]);

  useEffect(() => {
    if (tab !== "payments") return;
    const controller = new AbortController();
    let active = true;
    setRefundsLoading(true);
    setRefundsError("");

    void (async () => {
      try {
        const token = await getAccessToken();
        const rows = await getSuperAdminRefunds(token, controller.signal);
        if (active) setRefunds(rows);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        if (active) setRefundsError(errorMessage(cause, "โหลดข้อมูลคืนเงินไม่สำเร็จ"));
      } finally {
        if (active) setRefundsLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadKey, tab]);

  useEffect(() => {
    if (tab !== "events" || !selectedOrganizationId) {
      setEvents([]);
      setEventsError("");
      setEventsLoading(false);
      return;
    }
    const controller = new AbortController();
    let active = true;
    setEventsLoading(true);
    setEventsError("");

    void (async () => {
      try {
        const token = await getAccessToken();
        const rows = await getAdminOrganizationEvents(
          selectedOrganizationId,
          token,
          controller.signal,
        );
        if (active) setEvents(rows);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        if (active) setEventsError(errorMessage(cause, "โหลดรายการ Event ไม่สำเร็จ"));
      } finally {
        if (active) setEventsLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadKey, selectedOrganizationId, tab]);

  function changeTab(nextTab: Tab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    router.replace(`${pathname}?${params.toString()}`);
  }

  const loading =
    organizationsLoading ||
    (tab === "bookings" && bookingsLoading) ||
    (tab === "payments" && refundsLoading) ||
    (tab === "events" && eventsLoading);

  return (
    <div className="relative z-0 mx-auto w-full max-w-[1440px] px-[15px] pb-11 pt-[23px] before:absolute before:right-[6%] before:top-[110px] before:-z-10 before:h-[280px] before:w-[280px] before:rounded-full before:bg-[rgba(124,58,237,.05)] sm:px-[34px] sm:pt-[31px]">
      <header className="mb-6 flex flex-col items-start justify-between gap-[18px] sm:flex-row sm:items-end">
        <div>
          <span className="text-[11px] font-extrabold tracking-[1.1px] text-[#7c3aed]">
            PLATFORM OPERATIONS
          </span>
          <h1 className="mb-[5px] mt-[7px] text-[27px] font-black tracking-[-.8px] text-[#242032]">
            Events, การจอง และคืนเงิน
          </h1>
          <p className="m-0 text-[15px] text-[#82788b]">
            ภาพรวมแบบอ่านอย่างเดียวของกิจกรรมและธุรกรรมข้ามทุกองค์กร
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((value) => value + 1)}
          disabled={loading}
          className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-[#e7dfea] bg-white px-[13px] text-[13px] font-bold text-[#716675] disabled:opacity-55"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          โหลดข้อมูลใหม่
        </button>
      </header>

      <nav
        aria-label="หมวดข้อมูล Events และการจอง"
        className="mb-[18px] flex gap-1 overflow-x-auto rounded-xl border border-[#e7dfea] bg-white p-1.5 shadow-[0_8px_24px_rgba(65,43,85,.045)]"
      >
        <TabButton active={tab === "bookings"} onClick={() => changeTab("bookings")} icon={TicketCheck}>
          การจองทั้งหมด
        </TabButton>
        <TabButton active={tab === "payments"} onClick={() => changeTab("payments")} icon={CircleDollarSign}>
          การเงินและคืนเงิน
        </TabButton>
        <TabButton active={tab === "events"} onClick={() => changeTab("events")} icon={CalendarDays}>
          Events
        </TabButton>
      </nav>

      {organizationsError ? (
        <div className="mb-4 rounded-xl border border-[#fecaca] bg-[#fff7f7] px-4 py-3 text-sm text-[#b42318]">
          {organizationsError}
        </div>
      ) : null}

      {tab === "bookings" ? (
        <BookingsTab bookings={bookings} organizations={organizations} loading={bookingsLoading} error={bookingsError} />
      ) : tab === "payments" ? (
        <PaymentsTab refunds={refunds} loading={refundsLoading} error={refundsError} />
      ) : (
        <EventsTab
          organizations={organizations}
          selectedOrganizationId={selectedOrganizationId}
          onSelectOrganization={setSelectedOrganizationId}
          events={events}
          loading={eventsLoading}
          error={eventsError}
        />
      )}
    </div>
  );
}

function BookingsTab({
  bookings,
  organizations,
  loading,
  error,
}: {
  bookings: SuperAdminBooking[];
  organizations: SuperAdminOrganization[];
  loading: boolean;
  error: string;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | BookingStatus>("ALL");
  const [organizationId, setOrganizationId] = useState("ALL");
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [organizationId, query, status]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("th-TH");
    return bookings.filter((booking) => {
      const matchesStatus = status === "ALL" || booking.status === status;
      const matchesOrganization =
        organizationId === "ALL" || booking.event.organization.id === organizationId;
      const matchesQuery =
        !normalized ||
        [
          booking.bookingCode,
          booking.event.name,
          booking.event.organization.name,
          booking.shop.name,
          booking.vendor.fullName,
          booking.vendor.email,
          booking.booth.code,
          booking.booth.zone.code,
          booking.booth.zone.name ?? "",
        ].some((value) => value.toLocaleLowerCase("th-TH").includes(normalized));
      return matchesStatus && matchesOrganization && matchesQuery;
    });
  }, [bookings, organizationId, query, status]);

  const hasFilters = query.trim().length > 0 || status !== "ALL" || organizationId !== "ALL";

  return (
    <DataPanel
      title="การจองทั้งหมด"
      description="ค้นหาและตรวจสอบ Booking จากทุกองค์กรในระบบ"
      controls={
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_220px_240px_auto]">
          <SearchInput value={query} onChange={setQuery} placeholder="ค้นหารหัสจอง Event ร้าน ผู้จอง หรือบูธ" />
          <Select value={status} onChange={(value) => setStatus(value as "ALL" | BookingStatus)} label="กรองสถานะ">
            <option value="ALL">ทุกสถานะ</option>
            {BOOKING_STATUSES.map((item) => <option key={item} value={item}>{bookingStatusLabel(item)}</option>)}
          </Select>
          <Select value={organizationId} onChange={setOrganizationId} label="กรององค์กร">
            <option value="ALL">ทุกองค์กร</option>
            {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
          </Select>
          <ClearButton disabled={!hasFilters} onClick={() => { setQuery(""); setStatus("ALL"); setOrganizationId("ALL"); }} />
        </div>
      }
    >
      {loading ? <TableSkeleton /> : error ? (
        <StatePanel title="โหลดข้อมูลการจองไม่สำเร็จ" detail={error} />
      ) : filtered.length === 0 ? (
        <StatePanel
          title={hasFilters ? "ไม่พบการจองที่ตรงกับตัวกรอง" : "ยังไม่มีการจองในระบบ"}
          detail={hasFilters ? "ลองเปลี่ยนคำค้นหาหรือตัวกรอง" : "รายการจะแสดงเมื่อมีการสร้าง Booking"}
        />
      ) : (
        <PagedTable rows={filtered} page={page} onPage={setPage} minWidth="1180px">
          {(visibleRows) => (
            <>
              <thead className="bg-[#faf7fd] text-[11px] font-extrabold uppercase tracking-[.45px] text-[#82788b]">
                <tr><th className="px-5 py-3">รหัสจอง</th><th className="px-3 py-3">Event / องค์กร</th><th className="px-3 py-3">ร้าน / ผู้จอง</th><th className="px-3 py-3">บูธ</th><th className="px-3 py-3">ราคา</th><th className="px-3 py-3">สถานะ</th><th className="px-3 py-3">หลักฐาน</th><th className="px-5 py-3">วันที่สร้าง</th></tr>
              </thead>
              <tbody>
                {visibleRows.map((booking) => (
                  <tr key={booking.id} className="border-t border-[#f0ebf3] align-top">
                    <td className="px-5 py-4 font-black text-[#242032]">{booking.bookingCode}</td>
                    <td className="px-3 py-4"><strong className="block text-[#242032]">{booking.event.name}</strong><span className="mt-1 inline-flex items-center gap-1 text-xs text-[#82788b]"><Building2 className="h-3.5 w-3.5" />{booking.event.organization.name}</span></td>
                    <td className="px-3 py-4"><strong className="block text-[#423b4c]">{booking.shop.name}</strong><span className="mt-1 block text-xs text-[#82788b]">{booking.vendor.fullName}</span><span className="block text-[10px] text-[#9a91a2]">{booking.vendor.email}</span></td>
                    <td className="px-3 py-4"><strong className="block text-[#423b4c]">{booking.booth.code}</strong><span className="text-xs text-[#82788b]">โซน {booking.booth.zone.name || booking.booth.zone.code}</span></td>
                    <td className="whitespace-nowrap px-3 py-4 font-extrabold text-[#423b4c]">{formatMoney(booking.boothPrice)}</td>
                    <td className="px-3 py-4"><BookingStatusPill status={booking.status} /></td>
                    <td className="px-3 py-4">
                      {booking.isPaymentExempt ? <span className="text-xs text-[#82788b]">ไม่มีสลิป</span> : <AdminSlipActions bookingId={booking.id} />}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-[#716675]">{formatDateTime(booking.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </PagedTable>
      )}
    </DataPanel>
  );
}

function PaymentsTab({ refunds, loading, error }: { refunds: SuperAdminRefund[]; loading: boolean; error: string }) {
  const [status, setStatus] = useState<"ALL" | SuperAdminRefund["status"]>("ALL");
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [status]);
  const filtered = useMemo(
    () => refunds.filter((refund) => status === "ALL" || refund.status === status),
    [refunds, status],
  );

  return (
    <DataPanel
      title="การเงินและคืนเงิน"
      description="คำร้องคืนเงินข้ามองค์กรจากข้อมูลที่ Backend ส่งจริง ไม่มี action เปลี่ยนสถานะ"
      controls={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <Select value={status} onChange={(value) => setStatus(value as "ALL" | SuperAdminRefund["status"])} label="กรองสถานะคำร้อง">
            <option value="ALL">ทุกสถานะ</option>
            {REFUND_STATUSES.map((item) => <option key={item} value={item}>{refundStatusLabel(item)}</option>)}
          </Select>
          <span className="text-xs text-[#82788b]">แสดงข้อมูลแบบอ่านอย่างเดียว</span>
        </div>
      }
    >
      {loading ? <TableSkeleton /> : error ? (
        <StatePanel title="โหลดข้อมูลคืนเงินไม่สำเร็จ" detail={error} />
      ) : filtered.length === 0 ? (
        <StatePanel title={status === "ALL" ? "ยังไม่มีคำร้องคืนเงิน" : "ไม่พบคำร้องสถานะนี้"} detail={status === "ALL" ? "รายการจะแสดงเมื่อผู้ขายส่งคำร้องคืนเงิน" : "ลองเลือกสถานะอื่นหรือแสดงทุกสถานะ"} />
      ) : (
        <PagedTable rows={filtered} page={page} onPage={setPage} minWidth="1280px">
          {(visibleRows) => (
            <>
              <thead className="bg-[#faf7fd] text-[11px] font-extrabold uppercase tracking-[.45px] text-[#82788b]">
                <tr><th className="px-5 py-3">Booking</th><th className="px-3 py-3">Event / องค์กร</th><th className="px-3 py-3">ร้าน / ผู้ขอ</th><th className="px-3 py-3">เหตุผล</th><th className="px-3 py-3">ยอดที่ขอ</th><th className="px-3 py-3">ยอดอนุมัติ</th><th className="px-3 py-3">สถานะ</th><th className="px-3 py-3">สลิปต้นทาง</th><th className="px-5 py-3">วันที่</th></tr>
              </thead>
              <tbody>
                {visibleRows.map((refund) => (
                  <tr key={refund.id} className="border-t border-[#f0ebf3] align-top">
                    <td className="px-5 py-4 font-black text-[#242032]">{refund.booking.bookingCode}</td>
                    <td className="px-3 py-4"><strong className="block text-[#242032]">{refund.booking.event.name}</strong><span className="mt-1 inline-flex items-center gap-1 text-xs text-[#82788b]"><Building2 className="h-3.5 w-3.5" />{refund.booking.event.organization.name}</span></td>
                    <td className="px-3 py-4"><strong className="block text-[#423b4c]">{refund.booking.shop.name}</strong><span className="mt-1 block text-xs text-[#82788b]">{refund.requestedBy.fullName}</span><span className="block text-[10px] text-[#9a91a2]">{refund.requestedBy.email}</span></td>
                    <td className="max-w-[260px] px-3 py-4 text-xs leading-5 text-[#62576c]">{refund.reason}</td>
                    <td className="whitespace-nowrap px-3 py-4 font-extrabold text-[#423b4c]">{formatMoney(refund.requestedAmount)}</td>
                    <td className="whitespace-nowrap px-3 py-4 font-extrabold text-[#423b4c]">{refund.approvedAmount === null ? "—" : formatMoney(refund.approvedAmount)}</td>
                    <td className="px-3 py-4"><RefundStatusPill status={refund.status} /></td>
                    <td className="px-3 py-4"><AdminSlipActions bookingId={refund.bookingId} /></td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-[#716675]">{formatDateTime(refund.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </PagedTable>
      )}
    </DataPanel>
  );
}

function EventsTab({
  organizations,
  selectedOrganizationId,
  onSelectOrganization,
  events,
  loading,
  error,
}: {
  organizations: SuperAdminOrganization[];
  selectedOrganizationId: string;
  onSelectOrganization: (value: string) => void;
  events: AdminOrganizationEvent[];
  loading: boolean;
  error: string;
}) {
  const selectedOrganization = organizations.find((item) => item.id === selectedOrganizationId);
  return (
    <DataPanel
      title="Events แยกตามองค์กร"
      description="เลือกหนึ่งองค์กรก่อน ระบบจึงโหลด Events ขององค์กรนั้นเพียงรายการเดียว"
      controls={
        <Select value={selectedOrganizationId} onChange={onSelectOrganization} label="เลือกองค์กร">
          <option value="">เลือกองค์กรเพื่อดูรายการ Event</option>
          {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
        </Select>
      }
    >
      {!selectedOrganizationId ? (
        <StatePanel title="เลือกองค์กรเพื่อดูรายการ Event" detail="ระบบจะไม่เรียกข้อมูล Event จนกว่าจะเลือกองค์กร" />
      ) : loading ? <TableSkeleton /> : error ? (
        <StatePanel title="โหลดรายการ Event ไม่สำเร็จ" detail={error} />
      ) : events.length === 0 ? (
        <StatePanel title="องค์กรนี้ยังไม่มี Event" detail={`ยังไม่พบ Event ของ ${selectedOrganization?.name ?? "องค์กรที่เลือก"}`} />
      ) : (
        <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => (
            <article key={event.id} className="rounded-[14px] border border-[#e7dfea] bg-[linear-gradient(145deg,#fff,#fcf9ff)] p-4 shadow-[0_8px_22px_rgba(65,43,85,.045)]">
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f1eaff] text-[#6d28d9]"><CalendarDays className="h-5 w-5" /></span>
                {event.subscription ? <SubscriptionStatusPill status={event.subscription.status} /> : <span className="rounded-md bg-[#f1eef4] px-2 py-1 text-[10px] font-extrabold text-[#655d70]">ไม่มี Subscription</span>}
              </div>
              <h3 className="mb-1 mt-4 text-base font-black text-[#242032]">{event.name}</h3>
              <p className="m-0 inline-flex items-center gap-1.5 text-xs text-[#716675]"><Store className="h-3.5 w-3.5" />{event.venue.name}</p>
              <dl className="mt-4 grid gap-2 border-t border-[#eee8f2] pt-3 text-xs">
                <div className="flex justify-between gap-3"><dt className="text-[#82788b]">วันที่จัด</dt><dd className="m-0 text-right font-bold text-[#4f4658]">{formatDate(event.startDate)} – {formatDate(event.endDate)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-[#82788b]">สถานะ Event</dt><dd className="m-0 font-bold text-[#4f4658]">{eventStatusLabel(event.status)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-[#82788b]">ค่าบริการ</dt><dd className="m-0 font-black text-[#6d28d9]">{event.subscription ? formatMoney(event.subscription.finalPrice) : "—"}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </DataPanel>
  );
}

function DataPanel({ title, description, controls, children }: { title: string; description: string; controls: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[15px] border border-[#e7dfea] bg-white shadow-[0_12px_32px_rgba(65,43,85,.055)]">
      <div className="border-b border-[#ebe4ef] bg-[#fdfbff] p-4">
        <h2 className="m-0 text-base font-black text-[#312939]">{title}</h2>
        <p className="mb-4 mt-1 text-xs text-[#82788b]">{description}</p>
        {controls}
      </div>
      {children}
    </section>
  );
}

function TabButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof CalendarDays; children: React.ReactNode }) {
  return <button type="button" aria-current={active ? "page" : undefined} onClick={onClick} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-extrabold transition ${active ? "bg-[#6d28d9] text-white shadow-sm" : "text-[#716675] hover:bg-[#f5effc]"}`}><Icon className="h-4 w-4" />{children}</button>;
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="flex min-h-10 items-center gap-2 rounded-[9px] border border-[#ded5e7] bg-white px-3 text-[#82788b] focus-within:border-[#9b6be1] focus-within:ring-4 focus-within:ring-[#f0e7ff]"><Search className="h-4 w-4 shrink-0" /><span className="sr-only">{placeholder}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-sm text-[#28202f] outline-none" /></label>;
}

function Select({ value, onChange, label, children }: { value: string; onChange: (value: string) => void; label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-xs font-bold text-[#716675]"><span className="sr-only">{label}</span><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="min-h-10 min-w-[210px] rounded-[9px] border border-[#ded5e7] bg-white px-3 text-sm text-[#28202f] outline-none focus:border-[#9b6be1] focus:ring-4 focus:ring-[#f0e7ff]">{children}</select></label>;
}

function ClearButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="min-h-10 rounded-[9px] border border-[#e7dfea] bg-white px-3 text-xs font-bold text-[#716675] disabled:opacity-45">ล้างตัวกรอง</button>;
}

function PagedTable<T>({ rows, page, onPage, minWidth, children }: { rows: T[]; page: number; onPage: (page: number) => void; minWidth: string; children: (visibleRows: T[]) => React.ReactNode }) {
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  return <><div className="overflow-x-auto"><table className="w-full border-collapse text-left text-[13px] text-[#4f4658]" style={{ minWidth }}>{children(visibleRows)}</table></div>{rows.length > PAGE_SIZE ? <Pagination page={safePage} totalPages={totalPages} total={rows.length} onPage={onPage} /> : null}</>;
}

function Pagination({ page, totalPages, total, onPage }: { page: number; totalPages: number; total: number; onPage: (page: number) => void }) {
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);
  return <footer className="flex flex-col gap-3 border-t border-[#ebe4ef] bg-[#fdfbff] px-5 py-3.5 text-xs text-[#82788b] sm:flex-row sm:items-center sm:justify-between"><span>แสดง {first.toLocaleString("th-TH")}–{last.toLocaleString("th-TH")} จาก {total.toLocaleString("th-TH")} รายการ</span><div className="flex items-center gap-2"><button type="button" aria-label="หน้าก่อนหน้า" disabled={page <= 1} onClick={() => onPage(page - 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-[#e1d7e8] bg-white disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><strong className="min-w-12 text-center text-[#62576c]">{page}/{totalPages}</strong><button type="button" aria-label="หน้าถัดไป" disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-[#e1d7e8] bg-white disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></footer>;
}

function StatePanel({ title, detail }: { title: string; detail: string }) {
  return <div className="grid min-h-[260px] place-items-center p-8 text-center"><div><span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#f2eaff] text-[#6d28d9]"><RotateCcw className="h-5 w-5" /></span><h2 className="mb-1 mt-4 text-base font-black text-[#312939]">{title}</h2><p className="m-0 text-sm text-[#82788b]">{detail}</p></div></div>;
}

function TableSkeleton() {
  return <div className="grid gap-3 p-5">{[1, 2, 3, 4, 5].map((item) => <div key={item} className="h-16 animate-pulse rounded-lg bg-[#f2edf8]" />)}</div>;
}

function BookingStatusPill({ status }: { status: BookingStatus }) {
  const styles: Record<BookingStatus, string> = { PENDING_PAYMENT: "bg-[#fff4df] text-[#9a570f]", CONFIRMED: "bg-[#e7f8ef] text-[#147653]", CANCELLED: "bg-[#fff0ef] text-[#b42318]", NO_SHOW: "bg-[#f1eef4] text-[#655d70]", COMPLETED: "bg-[#eaf2ff] text-[#2459b5]" };
  return <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-extrabold ${styles[status]}`}>{bookingStatusLabel(status)}</span>;
}

function RefundStatusPill({ status }: { status: SuperAdminRefund["status"] }) {
  const styles: Record<SuperAdminRefund["status"], string> = { PENDING: "bg-[#fff4df] text-[#9a570f]", APPROVED: "bg-[#eaf2ff] text-[#2459b5]", REJECTED: "bg-[#fff0ef] text-[#b42318]", PROCESSED: "bg-[#e7f8ef] text-[#147653]" };
  return <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-extrabold ${styles[status]}`}>{refundStatusLabel(status)}</span>;
}

function SubscriptionStatusPill({ status }: { status: NonNullable<AdminOrganizationEvent["subscription"]>["status"] }) {
  const styles = { DRAFT: "bg-[#f1eef4] text-[#655d70]", PENDING_PAYMENT: "bg-[#fff4df] text-[#9a570f]", ACTIVE: "bg-[#e7f8ef] text-[#147653]", EXPIRED: "bg-[#fff0ef] text-[#b42318]", CANCELLED: "bg-[#fff0ef] text-[#b42318]" } as const;
  const labels = { DRAFT: "ฉบับร่าง", PENDING_PAYMENT: "รอชำระเงิน", ACTIVE: "ใช้งานอยู่", EXPIRED: "หมดอายุ", CANCELLED: "ยกเลิก" } as const;
  return <span className={`rounded-md px-2 py-1 text-[10px] font-extrabold ${styles[status]}`}>{labels[status]}</span>;
}

function bookingStatusLabel(status: BookingStatus) {
  return { PENDING_PAYMENT: "รอชำระเงิน", CONFIRMED: "ยืนยันแล้ว", CANCELLED: "ยกเลิก", NO_SHOW: "ไม่มาใช้สิทธิ์", COMPLETED: "เสร็จสิ้น" }[status];
}

function refundStatusLabel(status: SuperAdminRefund["status"]) {
  return { PENDING: "รอตรวจสอบ", APPROVED: "อนุมัติ", REJECTED: "ปฏิเสธ", PROCESSED: "คืนเงินแล้ว" }[status];
}

function eventStatusLabel(status: AdminOrganizationEvent["status"]) {
  return { DRAFT: "ฉบับร่าง", PUBLISHED: "เผยแพร่", ONGOING: "กำลังจัด", COMPLETED: "เสร็จสิ้น", CANCELLED: "ยกเลิก" }[status];
}

function parseTab(value: string | null): Tab {
  return value === "events" || value === "payments" ? value : "bookings";
}

function formatDate(value: string) {
  return THAI_DATE.format(new Date(value));
}

function formatDateTime(value: string) {
  return THAI_DATE_TIME.format(new Date(value));
}

function formatMoney(value: string) {
  const [whole, fraction] = value.split(".");
  const formattedWhole = BigInt(whole || "0").toLocaleString("th-TH");
  const formattedFraction = fraction?.replace(/0+$/, "");
  return `${formattedWhole}${formattedFraction ? `.${formattedFraction}` : ""} บาท`;
}

async function getAccessToken() {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("ไม่พบเซสชันผู้ดูแลระบบ กรุณาเข้าสู่ระบบใหม่");
  return token;
}

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof ApiError || cause instanceof Error ? cause.message || fallback : fallback;
}
