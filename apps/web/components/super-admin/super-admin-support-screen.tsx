"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Ban,
  Building2,
  ChevronLeft,
  ChevronRight,
  MessageCircleQuestion,
  RefreshCw,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  ApiError,
  getSuperAdminPenalties,
  getSuperAdminSupportTickets,
  type PenaltyReason,
  type SuperAdminPenaltiesOverview,
  type SuperAdminSupportTicket,
  type SupportTicketStatus,
} from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const PAGE_SIZE = 25;
const TICKET_STATUSES: SupportTicketStatus[] = ["OPEN", "PROCESSING", "CLOSED"];
const THAI_DATE_TIME = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok",
});

type Tab = "tickets" | "moderation";

export function SuperAdminSupportScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "moderation" ? "moderation" : "tickets";
  const [tickets, setTickets] = useState<SuperAdminSupportTicket[]>([]);
  const [moderation, setModeration] = useState<SuperAdminPenaltiesOverview>({
    penalties: [],
    blacklistedUsers: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError("");

    void (async () => {
      try {
        const token = await getAccessToken();
        if (tab === "tickets") {
          const rows = await getSuperAdminSupportTickets(token, controller.signal);
          if (active) setTickets(rows);
        } else {
          const result = await getSuperAdminPenalties(token, controller.signal);
          if (active) setModeration(result);
        }
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        if (active)
          setError(
            errorMessage(
              cause,
              tab === "tickets"
                ? "โหลดเคสช่วยเหลือไม่สำเร็จ"
                : "โหลดข้อมูลการกำกับดูแลไม่สำเร็จ",
            ),
          );
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadKey, tab]);

  function changeTab(nextTab: Tab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="relative z-0 mx-auto w-full max-w-[1440px] px-[15px] pb-11 pt-[23px] before:absolute before:right-[6%] before:top-[110px] before:-z-10 before:h-[280px] before:w-[280px] before:rounded-full before:bg-[rgba(124,58,237,.05)] sm:px-[34px] sm:pt-[31px]">
      <header className="mb-6 flex flex-col items-start justify-between gap-[18px] sm:flex-row sm:items-end">
        <div>
          <span className="text-[11px] font-extrabold tracking-[1.1px] text-[#7c3aed]">
            SUPPORT & SAFETY
          </span>
          <h1 className="mb-[5px] mt-[7px] text-[27px] font-black tracking-[-.8px] text-[#242032]">
            เคสช่วยเหลือและความปลอดภัย
          </h1>
          <p className="m-0 text-[15px] text-[#82788b]">
            ตรวจสอบคำร้อง บทลงโทษ และผู้ใช้ที่ถูกระงับสิทธิ์จากทุกองค์กร
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
        aria-label="หมวดเคสช่วยเหลือและความปลอดภัย"
        className="mb-[18px] flex gap-1 overflow-x-auto rounded-xl border border-[#e7dfea] bg-white p-1.5 shadow-[0_8px_24px_rgba(65,43,85,.045)]"
      >
        <TabButton
          active={tab === "tickets"}
          onClick={() => changeTab("tickets")}
          icon={MessageCircleQuestion}
        >
          เคสช่วยเหลือ
        </TabButton>
        <TabButton
          active={tab === "moderation"}
          onClick={() => changeTab("moderation")}
          icon={ShieldAlert}
        >
          รายงานและความปลอดภัย
        </TabButton>
      </nav>

      {tab === "tickets" ? (
        <TicketsTab tickets={tickets} loading={loading} error={error} />
      ) : (
        <ModerationTab overview={moderation} loading={loading} error={error} />
      )}
    </div>
  );
}

function TicketsTab({
  tickets,
  loading,
  error,
}: {
  tickets: SuperAdminSupportTicket[];
  loading: boolean;
  error: string;
}) {
  const [status, setStatus] = useState<"ALL" | SupportTicketStatus>("ALL");
  const [type, setType] = useState("ALL");
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [status, type]);

  const types = useMemo(
    () =>
      [...new Set(tickets.map((ticket) => ticket.type))].sort((left, right) =>
        ticketTypeLabel(left).localeCompare(ticketTypeLabel(right), "th-TH", {
          sensitivity: "base",
        }),
      ),
    [tickets],
  );
  const filtered = useMemo(
    () =>
      tickets.filter(
        (ticket) =>
          (status === "ALL" || ticket.status === status) &&
          (type === "ALL" || ticket.type === type),
      ),
    [status, tickets, type],
  );
  const hasFilters = status !== "ALL" || type !== "ALL";

  return (
    <Panel
      title="คำร้องขอความช่วยเหลือ"
      description="รายการแบบอ่านอย่างเดียวจากทุกองค์กร"
      controls={
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[240px_260px_auto_1fr]">
          <Select
            value={status}
            onChange={(value) => setStatus(value as "ALL" | SupportTicketStatus)}
            label="กรองสถานะคำร้อง"
          >
            <option value="ALL">ทุกสถานะ</option>
            {TICKET_STATUSES.map((item) => (
              <option key={item} value={item}>
                {ticketStatusLabel(item)}
              </option>
            ))}
          </Select>
          <Select value={type} onChange={setType} label="กรองประเภทคำร้อง">
            <option value="ALL">ทุกประเภท</option>
            {types.map((item) => (
              <option key={item} value={item}>
                {ticketTypeLabel(item)}
              </option>
            ))}
          </Select>
          <button
            type="button"
            disabled={!hasFilters}
            onClick={() => {
              setStatus("ALL");
              setType("ALL");
            }}
            className="min-h-10 rounded-[9px] border border-[#e7dfea] bg-white px-3 text-xs font-bold text-[#716675] disabled:opacity-45"
          >
            ล้างตัวกรอง
          </button>
          <span className="self-center text-right text-xs text-[#82788b]">
            {filtered.length.toLocaleString("th-TH")} รายการ
          </span>
        </div>
      }
    >
      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <StatePanel title="โหลดเคสช่วยเหลือไม่สำเร็จ" detail={error} icon={MessageCircleQuestion} />
      ) : filtered.length === 0 ? (
        <StatePanel
          title={hasFilters ? "ไม่พบคำร้องที่ตรงกับตัวกรอง" : "ยังไม่มีเคสช่วยเหลือ"}
          detail={hasFilters ? "ลองเปลี่ยนสถานะหรือประเภทคำร้อง" : "รายการจะปรากฏเมื่อผู้ใช้ส่งคำร้อง"}
          icon={MessageCircleQuestion}
        />
      ) : (
        <PagedTable rows={filtered} page={page} onPage={setPage} minWidth="1040px">
          {(visibleRows) => (
            <>
              <thead className="bg-[#faf7fd] text-[11px] font-extrabold uppercase tracking-[.45px] text-[#82788b]">
                <tr>
                  <th className="px-5 py-3">หัวข้อ</th>
                  <th className="px-3 py-3">ประเภท</th>
                  <th className="px-3 py-3">ผู้แจ้ง</th>
                  <th className="px-3 py-3">องค์กร</th>
                  <th className="px-3 py-3">สถานะ</th>
                  <th className="px-5 py-3">สร้าง / อัปเดต</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((ticket) => (
                  <tr key={ticket.id} className="border-t border-[#f0ebf3] align-top">
                    <td className="max-w-[300px] px-5 py-4">
                      <strong className="block text-[#242032]">{ticket.subject}</strong>
                      <code className="mt-1 block truncate text-[10px] text-[#9a91a2]">{ticket.id}</code>
                    </td>
                    <td className="px-3 py-4 text-xs font-bold text-[#62576c]">
                      {ticketTypeLabel(ticket.type)}
                    </td>
                    <td className="px-3 py-4">
                      <strong className="block text-[#423b4c]">{ticket.user.fullName}</strong>
                      <span className="mt-1 block text-xs text-[#82788b]">{ticket.user.email}</span>
                    </td>
                    <td className="px-3 py-4">
                      {ticket.organization ? (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-[#f2eaff] px-2 py-1 text-[11px] font-extrabold text-[#6d28d9]">
                          <Building2 className="h-3.5 w-3.5" />
                          {ticket.organization.name}
                        </span>
                      ) : (
                        <span className="text-xs text-[#aaa1ad]">ไม่ผูกองค์กร</span>
                      )}
                    </td>
                    <td className="px-3 py-4">
                      <TicketStatusPill status={ticket.status} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-[#716675]">
                      <time dateTime={ticket.createdAt}>{formatDateTime(ticket.createdAt)}</time>
                      <span className="mt-1 block text-[10px] text-[#9a91a2]">
                        อัปเดต {formatDateTime(ticket.updatedAt)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </PagedTable>
      )}
    </Panel>
  );
}

function ModerationTab({
  overview,
  loading,
  error,
}: {
  overview: SuperAdminPenaltiesOverview;
  loading: boolean;
  error: string;
}) {
  const router = useRouter();
  const [penaltyPage, setPenaltyPage] = useState(1);
  const [blacklistPage, setBlacklistPage] = useState(1);

  function openUser(userId: string) {
    router.push(`/super-admin/users?id=${encodeURIComponent(userId)}`);
  }

  if (loading) return <Panel title="รายงานและความปลอดภัย" description="บทลงโทษและผู้ใช้ที่ถูกแบน" controls={null}><TableSkeleton /></Panel>;
  if (error) return <Panel title="รายงานและความปลอดภัย" description="บทลงโทษและผู้ใช้ที่ถูกแบน" controls={null}><StatePanel title="โหลดข้อมูลการกำกับดูแลไม่สำเร็จ" detail={error} icon={ShieldAlert} /></Panel>;

  return (
    <div className="grid gap-[18px]">
      <Panel
        title="ประวัติบทลงโทษ"
        description="ข้อมูลแบบอ่านอย่างเดียว ไม่มีปุ่มลบหรือแก้ไข Penalty"
        controls={<Summary icon={ShieldAlert} label="บทลงโทษทั้งหมด" value={overview.penalties.length} />}
      >
        {overview.penalties.length === 0 ? (
          <StatePanel title="ยังไม่มีประวัติบทลงโทษ" detail="รายการจะปรากฏเมื่อองค์กรออกบทลงโทษ" icon={ShieldAlert} />
        ) : (
          <PagedTable rows={overview.penalties} page={penaltyPage} onPage={setPenaltyPage} minWidth="1040px">
            {(visibleRows) => (
              <>
                <thead className="bg-[#faf7fd] text-[11px] font-extrabold uppercase tracking-[.45px] text-[#82788b]">
                  <tr><th className="px-5 py-3">ผู้ถูกลงโทษ</th><th className="px-3 py-3">เหตุผล</th><th className="px-3 py-3">รายละเอียด</th><th className="px-3 py-3">คะแนน</th><th className="px-3 py-3">องค์กร</th><th className="px-5 py-3">วันที่</th></tr>
                </thead>
                <tbody>
                  {visibleRows.map((penalty) => (
                    <tr key={penalty.id} className="border-t border-[#f0ebf3] align-top">
                      <td className="px-5 py-4"><strong className="block text-[#242032]">{penalty.user.fullName}</strong><span className="mt-1 block text-xs text-[#82788b]">{penalty.user.email}</span></td>
                      <td className="px-3 py-4"><span className="rounded-md bg-[#fff4df] px-2 py-1 text-[11px] font-extrabold text-[#9a570f]">{penaltyReasonLabel(penalty.reason)}</span></td>
                      <td className="max-w-[300px] px-3 py-4 text-xs leading-5 text-[#62576c]">{penalty.description || "—"}</td>
                      <td className="px-3 py-4"><strong className="text-[#b42318]">{penalty.points.toLocaleString("th-TH")}</strong> แต้ม</td>
                      <td className="px-3 py-4"><span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6d28d9]"><Building2 className="h-3.5 w-3.5" />{penalty.organization.name}</span></td>
                      <td className="whitespace-nowrap px-5 py-4 text-xs text-[#716675]">{formatDateTime(penalty.issuedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
          </PagedTable>
        )}
      </Panel>

      <Panel
        title="ผู้ใช้ที่ถูกแบน"
        description="คลิกแถวเพื่อเปิดประวัติผู้ใช้ใน user drawer"
        controls={<Summary icon={Ban} label="ผู้ใช้ที่ถูกแบน" value={overview.blacklistedUsers.length} />}
      >
        {overview.blacklistedUsers.length === 0 ? (
          <StatePanel title="ยังไม่มีผู้ใช้ที่ถูกแบน" detail="ระบบยังไม่พบผู้ใช้ที่อยู่ใน blacklist" icon={Ban} />
        ) : (
          <PagedTable rows={overview.blacklistedUsers} page={blacklistPage} onPage={setBlacklistPage} minWidth="760px">
            {(visibleRows) => (
              <>
                <thead className="bg-[#faf7fd] text-[11px] font-extrabold uppercase tracking-[.45px] text-[#82788b]">
                  <tr><th className="px-5 py-3">ผู้ใช้</th><th className="px-3 py-3">อีเมล</th><th className="px-3 py-3">เหตุผลแบน</th><th className="px-5 py-3 text-right">รายละเอียด</th></tr>
                </thead>
                <tbody>
                  {visibleRows.map((user) => (
                    <tr
                      key={user.id}
                      tabIndex={0}
                      role="link"
                      aria-label={`เปิดข้อมูลผู้ใช้ ${user.fullName}`}
                      onClick={() => openUser(user.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openUser(user.id);
                        }
                      }}
                      className="cursor-pointer border-t border-[#f0ebf3] transition hover:bg-[#fcf9ff] focus:bg-[#fcf9ff] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#c7a7f4]"
                    >
                      <td className="px-5 py-4"><span className="inline-flex items-center gap-2 font-black text-[#242032]"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#fff0ef] text-[#b42318]"><UserRound className="h-4 w-4" /></span>{user.fullName}</span></td>
                      <td className="px-3 py-4 text-[#62576c]">{user.email}</td>
                      <td className="max-w-[360px] px-3 py-4 text-xs leading-5 text-[#716675]">{user.blacklistReason || "ไม่ระบุเหตุผล"}</td>
                      <td className="px-5 py-4 text-right font-extrabold text-[#6d28d9]">ดูข้อมูลผู้ใช้ →</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
          </PagedTable>
        )}
      </Panel>
    </div>
  );
}

function Panel({ title, description, controls, children }: { title: string; description: string; controls: React.ReactNode; children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-[15px] border border-[#e7dfea] bg-white shadow-[0_12px_32px_rgba(65,43,85,.055)]"><div className="border-b border-[#ebe4ef] bg-[#fdfbff] p-4"><h2 className="m-0 text-base font-black text-[#312939]">{title}</h2><p className={`mt-1 text-xs text-[#82788b] ${controls ? "mb-4" : "mb-0"}`}>{description}</p>{controls}</div>{children}</section>;
}

function TabButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof ShieldAlert; children: React.ReactNode }) {
  return <button type="button" aria-current={active ? "page" : undefined} onClick={onClick} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-extrabold transition ${active ? "bg-[#6d28d9] text-white shadow-sm" : "text-[#716675] hover:bg-[#f5effc]"}`}><Icon className="h-4 w-4" />{children}</button>;
}

function Select({ value, onChange, label, children }: { value: string; onChange: (value: string) => void; label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-xs font-bold text-[#716675]"><span className="sr-only">{label}</span><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="min-h-10 min-w-[210px] rounded-[9px] border border-[#ded5e7] bg-white px-3 text-sm text-[#28202f] outline-none focus:border-[#9b6be1] focus:ring-4 focus:ring-[#f0e7ff]">{children}</select></label>;
}

function Summary({ icon: Icon, label, value }: { icon: typeof ShieldAlert; label: string; value: number }) {
  return <div className="inline-flex items-center gap-2 rounded-lg bg-[#f2eaff] px-3 py-2 text-xs font-bold text-[#6d28d9]"><Icon className="h-4 w-4" />{label}: <strong>{value.toLocaleString("th-TH")}</strong></div>;
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

function StatePanel({ title, detail, icon: Icon }: { title: string; detail: string; icon: typeof ShieldAlert }) {
  return <div className="grid min-h-[240px] place-items-center p-8 text-center"><div><span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#f2eaff] text-[#6d28d9]"><Icon className="h-5 w-5" /></span><h2 className="mb-1 mt-4 text-base font-black text-[#312939]">{title}</h2><p className="m-0 text-sm text-[#82788b]">{detail}</p></div></div>;
}

function TableSkeleton() {
  return <div className="grid gap-3 p-5">{[1, 2, 3, 4, 5].map((item) => <div key={item} className="h-16 animate-pulse rounded-lg bg-[#f2edf8]" />)}</div>;
}

function TicketStatusPill({ status }: { status: SupportTicketStatus }) {
  const styles: Record<SupportTicketStatus, string> = { OPEN: "bg-[#fff4df] text-[#9a570f]", PROCESSING: "bg-[#eaf2ff] text-[#2459b5]", CLOSED: "bg-[#e7f8ef] text-[#147653]" };
  return <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-extrabold ${styles[status]}`}>{ticketStatusLabel(status)}</span>;
}

function ticketStatusLabel(status: SupportTicketStatus) {
  return { OPEN: "เปิดอยู่", PROCESSING: "กำลังดำเนินการ", CLOSED: "ปิดแล้ว" }[status];
}

function ticketTypeLabel(type: string) {
  const labels: Record<string, string> = { REFUND_REQUEST: "คำร้องคืนเงิน", BOOTH_CHANGE: "ขอเปลี่ยนบูธ", ISSUE_REPORT: "รายงานปัญหา", GENERAL_INQUIRY: "สอบถามทั่วไป", OTHER: "อื่นๆ" };
  return labels[type] ?? type;
}

function penaltyReasonLabel(reason: PenaltyReason) {
  return { NO_SHOW: "ไม่มาตามนัด", RULE_VIOLATION: "ทำผิดกติกาพื้นที่", CONTRACT_BREACH: "ผิดสัญญา", BAD_REVIEW: "ได้รับรีวิวไม่ดี", OTHER: "อื่นๆ" }[reason];
}

function formatDateTime(value: string) {
  return THAI_DATE_TIME.format(new Date(value));
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
