"use client";

import { useRouter } from "next/navigation";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  ApiError,
  getSuperAdminCompanyAdmins,
  type SuperAdminCompanyAdmin,
} from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const PAGE_SIZE = 25;
const THAI_DATE_TIME = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok",
});

export function SuperAdminAdminsScreen() {
  const router = useRouter();
  const [admins, setAdmins] = useState<SuperAdminCompanyAdmin[]>([]);
  const [query, setQuery] = useState("");
  const [organizationId, setOrganizationId] = useState("ALL");
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
        const rows = await getSuperAdminCompanyAdmins(
          token,
          controller.signal,
        );
        if (active) setAdmins(rows);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError")
          return;
        if (active)
          setError(errorMessage(cause, "โหลดข้อมูลผู้ดูแลองค์กรไม่สำเร็จ"));
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
    admins.forEach((admin) =>
      unique.set(admin.organization.id, admin.organization.name),
    );
    return [...unique.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) =>
        left.name.localeCompare(right.name, "th-TH", { sensitivity: "base" }),
      );
  }, [admins]);

  const uniqueUsers = useMemo(
    () => new Set(admins.map((admin) => admin.user.id)).size,
    [admins],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("th-TH");
    return admins.filter((admin) => {
      const matchesOrganization =
        organizationId === "ALL" ||
        admin.organization.id === organizationId;
      const matchesQuery =
        !normalized ||
        admin.user.fullName.toLocaleLowerCase("th-TH").includes(normalized) ||
        admin.user.email.toLocaleLowerCase("th-TH").includes(normalized) ||
        admin.organization.name
          .toLocaleLowerCase("th-TH")
          .includes(normalized);
      return matchesOrganization && matchesQuery;
    });
  }, [admins, organizationId, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleRows = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );
  const hasFilters = query.trim().length > 0 || organizationId !== "ALL";

  function openUser(userId: string) {
    router.push(`/super-admin/users?id=${encodeURIComponent(userId)}`);
  }

  return (
    <div className="relative z-0 mx-auto w-full max-w-[1440px] px-[15px] pb-11 pt-[23px] before:absolute before:right-[6%] before:top-[110px] before:-z-10 before:h-[280px] before:w-[280px] before:rounded-full before:bg-[rgba(124,58,237,.05)] sm:px-[34px] sm:pt-[31px]">
      <header className="mb-6 flex flex-col items-start justify-between gap-[18px] sm:flex-row sm:items-end">
        <div>
          <span className="text-[11px] font-extrabold tracking-[1.1px] text-[#7c3aed]">
            COMPANY ADMINS
          </span>
          <h1 className="mb-[5px] mt-[7px] text-[27px] font-black tracking-[-.8px] text-[#242032]">
            ผู้ดูแลองค์กร
          </h1>
          <p className="m-0 text-[15px] text-[#82788b]">
            ตรวจสอบผู้ดูแลและองค์กรที่ได้รับสิทธิ์จากทุกองค์กรในระบบ
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
        aria-label="สรุปผู้ดูแลองค์กร"
      >
        <SummaryCard
          label="รายการสิทธิ์ทั้งหมด"
          value={admins.length}
          icon={ShieldCheck}
          loading={loading}
        />
        <SummaryCard
          label="ผู้ดูแลไม่ซ้ำ"
          value={uniqueUsers}
          icon={UsersRound}
          loading={loading}
        />
        <SummaryCard
          label="องค์กรที่มีผู้ดูแล"
          value={organizations.length}
          icon={Building2}
          loading={loading}
        />
      </section>

      <section className="overflow-hidden rounded-[15px] border border-[#e7dfea] bg-white shadow-[0_12px_32px_rgba(65,43,85,.055)]">
        <div className="grid gap-3 border-b border-[#ebe4ef] bg-[#fdfbff] p-4 lg:grid-cols-[minmax(280px,1fr)_280px_auto]">
          <label className="flex min-h-10 items-center gap-2 rounded-[9px] border border-[#ded5e7] bg-white px-3 text-[#82788b] focus-within:border-[#9b6be1] focus-within:ring-4 focus-within:ring-[#f0e7ff]">
            <Search className="h-4 w-4 shrink-0" />
            <span className="sr-only">ค้นหาผู้ดูแลองค์กร</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหาชื่อ อีเมล หรือชื่อองค์กร"
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
          <TableSkeleton />
        ) : error ? (
          <StatePanel
            title="โหลดข้อมูลผู้ดูแลองค์กรไม่สำเร็จ"
            detail={error}
            action={() => setReloadKey((value) => value + 1)}
          />
        ) : filtered.length === 0 ? (
          <StatePanel
            title={
              hasFilters
                ? "ไม่พบผู้ดูแลที่ตรงกับตัวกรอง"
                : "ยังไม่มีแอดมินองค์กรในระบบ"
            }
            detail={
              hasFilters
                ? "ลองเปลี่ยนคำค้นหาหรือเลือกองค์กรอื่น"
                : "รายการจะแสดงเมื่อมีการมอบสิทธิ์ผู้ดูแลองค์กร"
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-[13px] text-[#4f4658]">
              <thead className="bg-[#faf7fd] text-[11px] font-extrabold uppercase tracking-[.45px] text-[#82788b]">
                <tr>
                  <th className="px-5 py-3">ผู้ดูแล</th>
                  <th className="px-3 py-3">อีเมล</th>
                  <th className="px-3 py-3">องค์กร</th>
                  <th className="px-3 py-3">วันที่เข้าร่วม</th>
                  <th className="px-5 py-3 text-right">รายละเอียด</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((admin) => (
                  <tr
                    key={admin.id}
                    tabIndex={0}
                    role="link"
                    aria-label={`เปิดข้อมูลผู้ใช้ ${admin.user.fullName}`}
                    onClick={() => openUser(admin.user.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openUser(admin.user.id);
                      }
                    }}
                    className="cursor-pointer border-t border-[#f0ebf3] transition hover:bg-[#fcf9ff] focus:bg-[#fcf9ff] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#c7a7f4]"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <AdminAvatar name={admin.user.fullName} />
                        <div>
                          <strong className="block text-[#242032]">
                            {admin.user.fullName}
                          </strong>
                          <small className="mt-0.5 block max-w-[210px] truncate text-[10px] text-[#9a91a2]">
                            {admin.user.id}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4">{admin.user.email}</td>
                    <td className="px-3 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-[#f2eaff] px-2 py-1 text-[11px] font-extrabold text-[#6d28d9]">
                        <Building2 className="h-3.5 w-3.5" />
                        {admin.organization.name}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-xs text-[#716675]">
                      <time dateTime={admin.joinedAt}>
                        {THAI_DATE_TIME.format(new Date(admin.joinedAt))}
                      </time>
                    </td>
                    <td className="px-5 py-4 text-right font-extrabold text-[#6d28d9]">
                      ดูข้อมูลผู้ใช้ →
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && filtered.length > PAGE_SIZE ? (
          <Pagination
            page={safePage}
            totalPages={totalPages}
            total={filtered.length}
            onPage={setPage}
          />
        ) : null}
      </section>
    </div>
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
  icon: typeof ShieldCheck;
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

function AdminAvatar({ name }: { name: string }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[#f1eaff] text-xs font-extrabold text-[#6d28d9]">
      {name.trim().charAt(0).toUpperCase() || "A"}
    </span>
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
          <ShieldCheck className="h-5 w-5" />
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
