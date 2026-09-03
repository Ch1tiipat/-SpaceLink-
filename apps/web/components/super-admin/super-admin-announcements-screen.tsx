"use client";

import {
  Building2,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Megaphone,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  ApiError,
  deleteSuperAdminAnnouncement,
  getSuperAdminAnnouncements,
  type SuperAdminAnnouncement,
} from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const PAGE_SIZE = 25;
const BODY_PREVIEW_LENGTH = 180;
const THAI_DATE_TIME = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok",
});

export function SuperAdminAnnouncementsScreen() {
  const [announcements, setAnnouncements] = useState<SuperAdminAnnouncement[]>([]);
  const [query, setQuery] = useState("");
  const [organizationId, setOrganizationId] = useState("ALL");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError("");

    void (async () => {
      try {
        const token = await getAccessToken();
        const rows = await getSuperAdminAnnouncements(token, controller.signal);
        if (active) setAnnouncements(rows);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        if (active) setError(errorMessage(cause, "โหลดประกาศกลางไม่สำเร็จ"));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadKey]);

  useEffect(() => setPage(1), [organizationId, query]);

  const organizations = useMemo(() => {
    const unique = new Map<string, string>();
    announcements.forEach((announcement) =>
      unique.set(announcement.organization.id, announcement.organization.name),
    );
    return [...unique.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) =>
        left.name.localeCompare(right.name, "th-TH", { sensitivity: "base" }),
      );
  }, [announcements]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("th-TH");
    return announcements.filter((announcement) => {
      const matchesOrganization =
        organizationId === "ALL" ||
        announcement.organization.id === organizationId;
      const matchesQuery =
        !normalized ||
        announcement.title.toLocaleLowerCase("th-TH").includes(normalized) ||
        announcement.body.toLocaleLowerCase("th-TH").includes(normalized) ||
        announcement.organization.name
          .toLocaleLowerCase("th-TH")
          .includes(normalized);
      return matchesOrganization && matchesQuery;
    });
  }, [announcements, organizationId, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleRows = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );
  const activeCount = announcements.filter((item) => item.isActive).length;
  const hasFilters = query.trim().length > 0 || organizationId !== "ALL";

  function toggleExpanded(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function removeAnnouncement(announcement: SuperAdminAnnouncement) {
    if (
      !window.confirm(
        `ยืนยันลบประกาศ “${announcement.title}” ของ ${announcement.organization.name}?\n\nเมื่อลบแล้วจะไม่สามารถกู้คืนได้`,
      )
    ) {
      return;
    }

    setDeletingId(announcement.id);
    setError("");
    setNotice("");
    try {
      const token = await getAccessToken();
      await deleteSuperAdminAnnouncement(announcement.id, token);
      setAnnouncements((current) =>
        current.filter((item) => item.id !== announcement.id),
      );
      setExpandedIds((current) => {
        const next = new Set(current);
        next.delete(announcement.id);
        return next;
      });
      setNotice(`ลบประกาศ “${announcement.title}” เรียบร้อยแล้ว`);
    } catch (cause) {
      setError(errorMessage(cause, "ลบประกาศกลางไม่สำเร็จ"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="relative z-0 mx-auto w-full max-w-[1440px] px-[15px] pb-11 pt-[23px] before:absolute before:right-[6%] before:top-[110px] before:-z-10 before:h-[280px] before:w-[280px] before:rounded-full before:bg-[rgba(124,58,237,.05)] sm:px-[34px] sm:pt-[31px]">
      <header className="mb-6 flex flex-col items-start justify-between gap-[18px] sm:flex-row sm:items-end">
        <div>
          <span className="text-[11px] font-extrabold tracking-[1.1px] text-[#7c3aed]">
            PLATFORM ANNOUNCEMENTS
          </span>
          <h1 className="mb-[5px] mt-[7px] text-[27px] font-black tracking-[-.8px] text-[#242032]">
            ประกาศกลาง
          </h1>
          <p className="m-0 text-[15px] text-[#82788b]">
            ตรวจสอบและลบประกาศจากทุกองค์กรในระบบ
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
        className="mb-[18px] grid gap-3.5 sm:grid-cols-3"
        aria-label="สรุปประกาศกลาง"
      >
        <SummaryCard label="ประกาศทั้งหมด" value={announcements.length} loading={loading} />
        <SummaryCard label="กำลังเผยแพร่" value={activeCount} loading={loading} />
        <SummaryCard label="องค์กรที่มีประกาศ" value={organizations.length} loading={loading} />
      </section>

      {notice ? (
        <p
          role="status"
          className="mb-[18px] rounded-[10px] border border-[#bce8d2] bg-[#ecfbf3] px-4 py-3 text-sm font-bold text-[#147653]"
        >
          {notice}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-[15px] border border-[#e7dfea] bg-white shadow-[0_12px_32px_rgba(65,43,85,.055)]">
        <div className="grid gap-3 border-b border-[#ebe4ef] bg-[#fdfbff] p-4 lg:grid-cols-[minmax(280px,1fr)_280px_auto]">
          <label className="flex min-h-10 items-center gap-2 rounded-[9px] border border-[#ded5e7] bg-white px-3 text-[#82788b] focus-within:border-[#9b6be1] focus-within:ring-4 focus-within:ring-[#f0e7ff]">
            <Search className="h-4 w-4 shrink-0" />
            <span className="sr-only">ค้นหาประกาศ</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหาหัวข้อ เนื้อหา หรือชื่อองค์กร"
              className="min-w-0 flex-1 bg-transparent text-sm text-[#28202f] outline-none"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-bold text-[#716675]">
            <span className="sr-only">กรองตามองค์กร</span>
            <select
              aria-label="กรองตามองค์กร"
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
              className="min-h-10 rounded-[9px] border border-[#ded5e7] bg-white px-3 text-sm text-[#28202f] outline-none focus:border-[#9b6be1] focus:ring-4 focus:ring-[#f0e7ff]"
            >
              <option value="ALL">ทุกองค์กร</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!hasFilters}
            onClick={() => {
              setQuery("");
              setOrganizationId("ALL");
            }}
            className="min-h-10 rounded-[9px] border border-[#e7dfea] bg-white px-3 text-xs font-bold text-[#716675] disabled:opacity-45"
          >
            ล้างตัวกรอง
          </button>
        </div>

        {loading ? (
          <CardSkeleton />
        ) : error ? (
          <StatePanel title="โหลดประกาศกลางไม่สำเร็จ" detail={error} />
        ) : filtered.length === 0 ? (
          <StatePanel
            title={hasFilters ? "ไม่พบประกาศที่ตรงกับตัวกรอง" : "ยังไม่มีประกาศในระบบ"}
            detail={hasFilters ? "ลองเปลี่ยนคำค้นหาหรือเลือกองค์กรอื่น" : "รายการจะปรากฏเมื่อองค์กรสร้างประกาศ"}
          />
        ) : (
          <div className="grid gap-4 p-5 lg:grid-cols-2">
            {visibleRows.map((announcement) => {
              const expanded = expandedIds.has(announcement.id);
              const canExpand = announcement.body.length > BODY_PREVIEW_LENGTH;
              const body =
                canExpand && !expanded
                  ? `${announcement.body.slice(0, BODY_PREVIEW_LENGTH).trimEnd()}…`
                  : announcement.body;
              return (
                <article
                  key={announcement.id}
                  className="flex min-h-[250px] flex-col rounded-[15px] border border-[#e7dfea] bg-[linear-gradient(145deg,#fff,#fcf9ff)] p-5 shadow-[0_8px_24px_rgba(65,43,85,.045)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-[#f2eaff] px-2 py-1 text-[11px] font-extrabold text-[#6d28d9]">
                      <Building2 className="h-3.5 w-3.5" />
                      {announcement.organization.name}
                    </span>
                    <StatusPill active={announcement.isActive} />
                  </div>
                  <h2 className="mb-0 mt-4 text-lg font-black leading-7 text-[#242032]">
                    {announcement.title}
                  </h2>
                  <p className="mb-0 mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#62576c]">
                    {body}
                  </p>
                  {canExpand ? (
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => toggleExpanded(announcement.id)}
                      className="mt-2 inline-flex w-fit items-center gap-1 text-xs font-extrabold text-[#6d28d9]"
                    >
                      {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      {expanded ? "ย่อเนื้อหา" : "ดูเนื้อหาเต็ม"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void removeAnnouncement(announcement)}
                    disabled={deletingId !== null}
                    className="mt-4 inline-flex min-h-9 w-fit items-center gap-2 rounded-lg border border-[#f0caca] bg-[#fff7f7] px-3 text-xs font-extrabold text-[#b4232c] transition hover:bg-[#ffeded] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {deletingId === announcement.id ? "กำลังลบ…" : "ลบประกาศ"}
                  </button>
                  <footer className="mt-auto grid gap-1.5 border-t border-[#eee8f2] pt-4 text-[11px] text-[#82788b] sm:grid-cols-2">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarClock className="h-3.5 w-3.5" />
                      สร้าง {formatDateTime(announcement.createdAt)}
                    </span>
                    <span className="sm:text-right">
                      {announcement.publishedAt
                        ? `เผยแพร่ ${formatDateTime(announcement.publishedAt)}`
                        : "ยังไม่กำหนดวันเผยแพร่"}
                    </span>
                  </footer>
                </article>
              );
            })}
          </div>
        )}

        {!loading && !error && filtered.length > PAGE_SIZE ? (
          <Pagination page={safePage} totalPages={totalPages} total={filtered.length} onPage={setPage} />
        ) : null}
      </section>
    </div>
  );
}

function SummaryCard({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return <article className="flex items-center gap-3 rounded-[14px] border border-[#e7def4] bg-[linear-gradient(145deg,#fff,#fbf8ff)] p-4 shadow-[0_10px_26px_rgba(74,48,112,.05)]"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f1eaff] text-[#6d28d9]"><Megaphone className="h-5 w-5" /></span><div><span className="text-xs text-[#82788b]">{label}</span>{loading ? <div className="mt-1 h-6 w-12 animate-pulse rounded bg-[#eee8f4]" /> : <strong className="mt-0.5 block text-xl text-[#242032]">{value.toLocaleString("th-TH")}</strong>}</div></article>;
}

function StatusPill({ active }: { active: boolean }) {
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${active ? "bg-[#e7f8ef] text-[#147653]" : "bg-[#f1eef4] text-[#655d70]"}`}>{active ? "กำลังเผยแพร่" : "ปิดใช้งาน"}</span>;
}

function Pagination({ page, totalPages, total, onPage }: { page: number; totalPages: number; total: number; onPage: (page: number) => void }) {
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);
  return <footer className="flex flex-col gap-3 border-t border-[#ebe4ef] bg-[#fdfbff] px-5 py-3.5 text-xs text-[#82788b] sm:flex-row sm:items-center sm:justify-between"><span>แสดง {first.toLocaleString("th-TH")}–{last.toLocaleString("th-TH")} จาก {total.toLocaleString("th-TH")} รายการ</span><div className="flex items-center gap-2"><button type="button" aria-label="หน้าก่อนหน้า" disabled={page <= 1} onClick={() => onPage(page - 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-[#e1d7e8] bg-white disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><strong className="min-w-12 text-center text-[#62576c]">{page}/{totalPages}</strong><button type="button" aria-label="หน้าถัดไป" disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-[#e1d7e8] bg-white disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></footer>;
}

function StatePanel({ title, detail }: { title: string; detail: string }) {
  return <div className="grid min-h-[280px] place-items-center p-8 text-center"><div><span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#f2eaff] text-[#6d28d9]"><Megaphone className="h-5 w-5" /></span><h2 className="mb-1 mt-4 text-base font-black text-[#312939]">{title}</h2><p className="m-0 text-sm text-[#82788b]">{detail}</p></div></div>;
}

function CardSkeleton() {
  return <div className="grid gap-4 p-5 lg:grid-cols-2">{[1, 2, 3, 4].map((item) => <div key={item} className="h-60 animate-pulse rounded-[15px] bg-[#f2edf8]" />)}</div>;
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
