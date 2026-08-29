"use client";

import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileJson2,
  Filter,
  RefreshCw,
  ScrollText,
  Target,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  ApiError,
  getSuperAdminAuditLogs,
  type SuperAdminAuditAction,
  type SuperAdminAuditLog,
} from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const PAGE_SIZE = 25;
const ACTIONS: SuperAdminAuditAction[] = [
  "ORGANIZATION_CREATED",
  "ORGANIZATION_STATUS_UPDATED",
  "ORG_ADMIN_GRANTED",
  "ORG_ADMIN_REVOKED",
  "PLATFORM_CONFIG_UPDATED",
];
const THAI_DATE_TIME = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok",
});

export function SuperAdminAuditLogsScreen() {
  const [logs, setLogs] = useState<SuperAdminAuditLog[]>([]);
  const [action, setAction] = useState<"ALL" | SuperAdminAuditAction>("ALL");
  const [page, setPage] = useState(1);
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
        const rows = await getSuperAdminAuditLogs(
          token,
          controller.signal,
          action === "ALL" ? {} : { action },
        );
        if (active) setLogs(rows);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError")
          return;
        if (active)
          setError(errorMessage(cause, "โหลดประวัติการดำเนินการไม่สำเร็จ"));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [action, reloadKey]);

  useEffect(() => setPage(1), [action]);

  const counts = useMemo(
    () => ({
      total: logs.length,
      organizations: logs.filter((log) => log.targetType === "ORGANIZATION")
        .length,
      users: logs.filter((log) => log.targetType === "USER").length,
      platform: logs.filter((log) => log.targetType === "PLATFORM_CONFIG")
        .length,
    }),
    [logs],
  );
  const totalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleRows = logs.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  return (
    <div className="relative z-0 mx-auto w-full max-w-[1440px] px-[15px] pb-11 pt-[23px] before:absolute before:right-[6%] before:top-[110px] before:-z-10 before:h-[280px] before:w-[280px] before:rounded-full before:bg-[rgba(124,58,237,.05)] sm:px-[34px] sm:pt-[31px]">
      <header className="mb-6 flex flex-col items-start justify-between gap-[18px] sm:flex-row sm:items-end">
        <div>
          <span className="text-[11px] font-extrabold tracking-[1.1px] text-[#7c3aed]">
            AUDIT TRAIL
          </span>
          <h1 className="mb-[5px] mt-[7px] text-[27px] font-black tracking-[-.8px] text-[#242032]">
            ประวัติการดำเนินการ
          </h1>
          <p className="m-0 text-[15px] text-[#82788b]">
            ตรวจสอบผู้กระทำ การเปลี่ยนแปลง เป้าหมาย และข้อมูลประกอบย้อนหลัง
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

      <section
        className="mb-[18px] grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="สรุป Audit logs"
      >
        <SummaryCard
          label="รายการที่โหลด"
          value={counts.total}
          icon={ScrollText}
          loading={loading}
        />
        <SummaryCard
          label="เป้าหมายองค์กร"
          value={counts.organizations}
          icon={Target}
          loading={loading}
        />
        <SummaryCard
          label="เป้าหมายผู้ใช้"
          value={counts.users}
          icon={UserRound}
          loading={loading}
        />
        <SummaryCard
          label="การตั้งค่าแพลตฟอร์ม"
          value={counts.platform}
          icon={FileJson2}
          loading={loading}
        />
      </section>

      <section className="overflow-hidden rounded-[15px] border border-[#e7dfea] bg-white shadow-[0_12px_32px_rgba(65,43,85,.055)]">
        <div className="flex flex-col gap-3 border-b border-[#ebe4ef] bg-[#fdfbff] p-4 sm:flex-row sm:items-end sm:justify-between">
          <label className="grid gap-1.5 text-xs font-bold text-[#716675]">
            กรองตามการกระทำ
            <span className="flex min-h-10 min-w-[280px] items-center gap-2 rounded-[9px] border border-[#ded5e7] bg-white px-3 focus-within:border-[#9b6be1] focus-within:ring-4 focus-within:ring-[#f0e7ff]">
              <Filter className="h-4 w-4 text-[#82788b]" />
              <select
                value={action}
                onChange={(event) =>
                  setAction(event.target.value as "ALL" | SuperAdminAuditAction)
                }
                className="min-h-9 flex-1 bg-transparent text-sm text-[#28202f] outline-none"
              >
                <option value="ALL">ทุกการกระทำ</option>
                {ACTIONS.map((item) => (
                  <option key={item} value={item}>
                    {actionLabel(item)}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <p className="m-0 text-xs text-[#82788b]">
            ตัวกรองนี้ส่ง query ไปยัง Backend โดยตรง
          </p>
        </div>

        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <StatePanel
            title="โหลด Audit logs ไม่สำเร็จ"
            detail={error}
            action={() => setReloadKey((value) => value + 1)}
          />
        ) : logs.length === 0 ? (
          <StatePanel
            title={
              action === "ALL"
                ? "ยังไม่มีกิจกรรมในระบบ"
                : "ไม่พบกิจกรรมประเภทนี้"
            }
            detail={
              action === "ALL"
                ? "รายการจะปรากฏเมื่อผู้ดูแลระบบดำเนินการที่มี Audit log"
                : "ลองเลือกการกระทำอื่นหรือแสดงทุกการกระทำ"
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] border-collapse text-left text-[13px] text-[#4f4658]">
              <thead className="bg-[#faf7fd] text-[11px] font-extrabold uppercase tracking-[.45px] text-[#82788b]">
                <tr>
                  <th className="px-5 py-3">เวลา</th>
                  <th className="px-3 py-3">ผู้กระทำ</th>
                  <th className="px-3 py-3">การกระทำ</th>
                  <th className="px-3 py-3">เป้าหมาย</th>
                  <th className="px-5 py-3">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((log) => {
                  const metadata = formatMetadata(log.metadata);
                  return (
                    <tr key={log.id} className="border-t border-[#f0ebf3] align-top">
                      <td className="whitespace-nowrap px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 text-xs text-[#716675]">
                          <Clock3 className="h-3.5 w-3.5 text-[#9b6be1]" />
                          <time dateTime={log.createdAt}>
                            {THAI_DATE_TIME.format(new Date(log.createdAt))}
                          </time>
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <strong className="block text-[#242032]">
                          {log.actor.fullName || "ไม่ระบุชื่อ"}
                        </strong>
                        <span className="mt-1 block text-xs text-[#82788b]">
                          {log.actor.email}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <ActionPill action={log.action} />
                        <code className="mt-1.5 block text-[10px] text-[#948a98]">
                          {log.action}
                        </code>
                      </td>
                      <td className="px-3 py-4">
                        <TargetCell log={log} />
                      </td>
                      <td className="px-5 py-4">
                        {metadata ? (
                          <details className="max-w-[340px] rounded-lg border border-[#e7dfea] bg-[#fdfbff] px-3 py-2">
                            <summary className="cursor-pointer text-xs font-bold text-[#6d28d9]">
                              ดูข้อมูลประกอบ
                            </summary>
                            <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-md bg-[#28202f] p-3 text-[10px] leading-relaxed text-[#f8f5fa]">
                              {metadata}
                            </pre>
                          </details>
                        ) : (
                          <span className="text-xs text-[#aaa1ad]">ไม่มีข้อมูล</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && logs.length > PAGE_SIZE ? (
          <Pagination
            page={safePage}
            totalPages={totalPages}
            total={logs.length}
            onPage={setPage}
          />
        ) : null}
      </section>
    </div>
  );
}

function TargetCell({ log }: { log: SuperAdminAuditLog }) {
  const content = (
    <>
      <strong className="block text-xs text-[#423b4c]">
        {targetLabel(log.targetType)}
      </strong>
      <code className="mt-1 block max-w-[230px] truncate text-[10px] text-[#948a98]">
        {log.targetId}
      </code>
    </>
  );

  return log.targetType === "ORGANIZATION" ? (
    <Link
      href="/super-admin/organizations"
      className="block rounded-lg px-2 py-1.5 transition hover:bg-[#f2eaff]"
    >
      {content}
    </Link>
  ) : (
    <div className="px-2 py-1.5">{content}</div>
  );
}

function ActionPill({ action }: { action: SuperAdminAuditAction }) {
  const styles: Record<SuperAdminAuditAction, string> = {
    ORGANIZATION_CREATED: "bg-[#ecfdf3] text-[#166534]",
    ORGANIZATION_STATUS_UPDATED: "bg-[#fff7ed] text-[#92400e]",
    ORG_ADMIN_GRANTED: "bg-[#f2eaff] text-[#6d28d9]",
    ORG_ADMIN_REVOKED: "bg-[#fff1f2] text-[#b91c1c]",
    PLATFORM_CONFIG_UPDATED: "bg-[#eef4ff] text-[#1d4ed8]",
  };
  return (
    <span
      className={`inline-block rounded-md px-2 py-1 text-[11px] font-extrabold ${styles[action]}`}
    >
      {actionLabel(action)}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: number;
  icon: typeof ScrollText;
  loading: boolean;
}) {
  return (
    <article className="flex items-center gap-3 rounded-[14px] border border-[#e7def4] bg-[linear-gradient(145deg,#fff,#fbf8ff)] p-4 shadow-[0_10px_26px_rgba(74,48,112,.05)]">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f1eaff] text-[#6d28d9]">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <span className="text-xs text-[#82788b]">{label}</span>
        {loading ? (
          <div className="mt-1 h-6 w-12 animate-pulse rounded bg-[#eee8f4]" />
        ) : (
          <strong className="mt-0.5 block text-xl text-[#242032]">
            {value.toLocaleString("th-TH")}
          </strong>
        )}
      </div>
    </article>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);
  return (
    <footer className="flex flex-col gap-3 border-t border-[#ebe4ef] bg-[#fdfbff] px-5 py-3.5 text-xs text-[#82788b] sm:flex-row sm:items-center sm:justify-between">
      <span>
        แสดง {first.toLocaleString("th-TH")}–{last.toLocaleString("th-TH")} จาก{" "}
        {total.toLocaleString("th-TH")} รายการ
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="หน้าก่อนหน้า"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="grid h-8 w-8 place-items-center rounded-lg border border-[#e1d7e8] bg-white disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <strong className="min-w-12 text-center text-[#62576c]">
          {page}/{totalPages}
        </strong>
        <button
          type="button"
          aria-label="หน้าถัดไป"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="grid h-8 w-8 place-items-center rounded-lg border border-[#e1d7e8] bg-white disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </footer>
  );
}

function StatePanel({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: () => void;
}) {
  return (
    <div className="grid min-h-[260px] place-items-center p-8 text-center">
      <div>
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#f2eaff] text-[#6d28d9]">
          <ScrollText className="h-5 w-5" />
        </span>
        <h2 className="mb-1 mt-4 text-base font-black text-[#312939]">{title}</h2>
        <p className="m-0 text-sm text-[#82788b]">{detail}</p>
        {action ? (
          <button
            type="button"
            onClick={action}
            className="mt-4 rounded-lg bg-[#6d28d9] px-4 py-2 text-xs font-bold text-white"
          >
            ลองอีกครั้ง
          </button>
        ) : null}
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="grid gap-3 p-5">
      {[1, 2, 3, 4, 5].map((item) => (
        <div key={item} className="h-14 animate-pulse rounded-lg bg-[#f2edf8]" />
      ))}
    </div>
  );
}

function actionLabel(action: SuperAdminAuditAction) {
  const labels: Record<SuperAdminAuditAction, string> = {
    ORGANIZATION_CREATED: "สร้างองค์กรใหม่",
    ORGANIZATION_STATUS_UPDATED: "เปลี่ยนสถานะองค์กร",
    ORG_ADMIN_GRANTED: "มอบสิทธิ์ผู้ดูแลองค์กร",
    ORG_ADMIN_REVOKED: "ถอนสิทธิ์ผู้ดูแลองค์กร",
    PLATFORM_CONFIG_UPDATED: "อัปเดตการตั้งค่าแพลตฟอร์ม",
  };
  return labels[action];
}

function targetLabel(targetType: SuperAdminAuditLog["targetType"]) {
  return {
    ORGANIZATION: "องค์กร",
    USER: "ผู้ใช้",
    PLATFORM_CONFIG: "การตั้งค่าแพลตฟอร์ม",
  }[targetType];
}

function formatMetadata(metadata: unknown) {
  if (metadata === null || metadata === undefined) return "";
  if (typeof metadata === "string") return metadata;
  try {
    return JSON.stringify(metadata, null, 2) ?? "";
  } catch {
    return String(metadata);
  }
}

async function getAccessToken() {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token)
    throw new Error("ไม่พบเซสชันผู้ดูแลระบบ กรุณาเข้าสู่ระบบใหม่");
  return token;
}

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof ApiError || cause instanceof Error
    ? cause.message || fallback
    : fallback;
}
