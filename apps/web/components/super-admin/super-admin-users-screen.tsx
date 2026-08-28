"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Clock3,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ApiError,
  getSuperAdminUserDetail,
  getSuperAdminUserLastLogin,
  getSuperAdminUsers,
  type BookingStatus,
  type SuperAdminUserDetail,
  type SuperAdminUserListItem,
  type SupportTicketStatus,
  type UserRole,
} from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const PAGE_SIZE = 25;
const ROLES: UserRole[] = ["SUPER_ADMIN", "ORG_ADMIN", "VENDOR"];
const THAI_DATE_TIME = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok",
});
const THAI_DATE = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeZone: "Asia/Bangkok",
});

type BlacklistFilter = "ALL" | "BLACKLISTED" | "NORMAL";
type DetailTab = "overview" | "shops" | "bookings" | "refunds" | "issues";

export function SuperAdminUsersScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedUserId = searchParams.get("id") ?? "";
  const [users, setUsers] = useState<SuperAdminUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"ALL" | UserRole>("ALL");
  const [blacklist, setBlacklist] = useState<BlacklistFilter>("ALL");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError("");

    void (async () => {
      try {
        const token = await getAccessToken();
        const rows = await getSuperAdminUsers(token, controller.signal);
        if (active) setUsers(rows);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError")
          return;
        if (active) setError(errorMessage(cause, "โหลดข้อมูลผู้ใช้ไม่สำเร็จ"));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadKey]);

  useEffect(() => setPage(1), [query, role, blacklist]);

  const counts = useMemo(
    () => ({
      total: users.length,
      vendors: users.filter((user) => user.role === "VENDOR").length,
      admins: users.filter((user) => user.role === "ORG_ADMIN").length,
      blacklisted: users.filter((user) => user.isBlacklisted).length,
    }),
    [users],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("th-TH");
    return users.filter((user) => {
      const matchesQuery =
        !normalized ||
        user.fullName.toLocaleLowerCase("th-TH").includes(normalized) ||
        user.email.toLocaleLowerCase("th-TH").includes(normalized) ||
        user.id.toLocaleLowerCase("th-TH").includes(normalized);
      const matchesRole = role === "ALL" || user.role === role;
      const matchesBlacklist =
        blacklist === "ALL" ||
        (blacklist === "BLACKLISTED" && user.isBlacklisted) ||
        (blacklist === "NORMAL" && !user.isBlacklisted);
      return matchesQuery && matchesRole && matchesBlacklist;
    });
  }, [blacklist, query, role, users]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleRows = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  function selectUser(userId?: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (userId) params.set("id", userId);
    else params.delete("id");
    const queryString = params.toString();
    router.replace(
      queryString ? `/super-admin/users?${queryString}` : "/super-admin/users",
      { scroll: false },
    );
  }

  const hasFilters =
    query.trim().length > 0 || role !== "ALL" || blacklist !== "ALL";

  return (
    <>
      <div className="relative z-0 mx-auto w-full max-w-[1440px] px-[15px] pb-11 pt-[23px] before:absolute before:right-[6%] before:top-[110px] before:-z-10 before:h-[280px] before:w-[280px] before:rounded-full before:bg-[rgba(124,58,237,.05)] sm:px-[34px] sm:pt-[31px]">
      <header className="mb-6 flex flex-col items-start justify-between gap-[18px] sm:flex-row sm:items-end">
        <div>
          <span className="text-[11px] font-extrabold tracking-[1.1px] text-[#7c3aed]">
            USER DIRECTORY
          </span>
          <h1 className="mb-[5px] mt-[7px] text-[27px] font-black tracking-[-.8px] text-[#242032]">
            ผู้ใช้ทั้งหมด
          </h1>
          <p className="m-0 text-[15px] text-[#82788b]">
            ตรวจสอบบัญชี ร้านค้า ธุรกรรม และประวัติปัญหาในที่เดียว
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((value) => value + 1)}
          disabled={loading}
          className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-[#e7dfea] bg-white px-[13px] text-[13px] font-bold text-[#716675] disabled:opacity-55"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />{" "}
          โหลดข้อมูลใหม่
        </button>
      </header>

      <section
        className="mb-[18px] grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="สรุปผู้ใช้"
      >
        <SummaryCard
          label="ผู้ใช้ทั้งหมด"
          value={counts.total}
          icon={UsersRound}
          loading={loading}
        />
        <SummaryCard
          label="ผู้ขาย"
          value={counts.vendors}
          icon={Store}
          loading={loading}
        />
        <SummaryCard
          label="ผู้ดูแลองค์กร"
          value={counts.admins}
          icon={ShieldCheck}
          loading={loading}
        />
        <SummaryCard
          label="ถูกแบล็กลิสต์"
          value={counts.blacklisted}
          icon={Ban}
          loading={loading}
          danger
        />
      </section>

      <section className="overflow-hidden rounded-[15px] border border-[#e7dfea] bg-white shadow-[0_12px_32px_rgba(65,43,85,.055)]">
        <div className="grid gap-3 border-b border-[#ebe4ef] bg-[#fdfbff] p-4 lg:grid-cols-[minmax(260px,1fr)_190px_190px_auto]">
          <label className="flex min-h-10 items-center gap-2 rounded-[9px] border border-[#ded5e7] bg-white px-3 text-[#82788b] focus-within:border-[#9b6be1] focus-within:ring-4 focus-within:ring-[#f0e7ff]">
            <Search className="h-4 w-4 shrink-0" />
            <span className="sr-only">ค้นหาผู้ใช้</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหาชื่อ อีเมล หรือ User ID"
              className="min-w-0 flex-1 bg-transparent text-sm text-[#28202f] outline-none"
            />
          </label>
          <FilterSelect
            label="กรองตามบทบาท"
            value={role}
            onChange={(value) => setRole(value as "ALL" | UserRole)}
          >
            <option value="ALL">ทุกบทบาท</option>
            {ROLES.map((item) => (
              <option key={item} value={item}>
                {roleLabel(item)}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="กรองสถานะแบล็กลิสต์"
            value={blacklist}
            onChange={(value) => setBlacklist(value as BlacklistFilter)}
          >
            <option value="ALL">ทุกสถานะ</option>
            <option value="NORMAL">ใช้งานปกติ</option>
            <option value="BLACKLISTED">ถูกแบล็กลิสต์</option>
          </FilterSelect>
          <button
            type="button"
            disabled={!hasFilters}
            onClick={() => {
              setQuery("");
              setRole("ALL");
              setBlacklist("ALL");
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
            title="โหลดข้อมูลผู้ใช้ไม่สำเร็จ"
            detail={error}
            action={() => setReloadKey((value) => value + 1)}
          />
        ) : filtered.length === 0 ? (
          <StatePanel
            title={
              hasFilters
                ? "ไม่พบผู้ใช้ที่ตรงกับตัวกรอง"
                : "ยังไม่มีผู้ใช้ในระบบ"
            }
            detail={
              hasFilters
                ? "ลองเปลี่ยนคำค้นหาหรือตัวกรอง"
                : "ข้อมูลผู้ใช้จะแสดงที่นี่เมื่อมีการสร้างบัญชี"
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[780px] w-full border-collapse text-left text-[13px] text-[#4f4658]">
              <thead className="bg-[#faf7fd] text-[11px] font-extrabold uppercase tracking-[.45px] text-[#82788b]">
                <tr>
                  <th className="px-5 py-3">ผู้ใช้</th>
                  <th className="px-3 py-3">อีเมล</th>
                  <th className="px-3 py-3">บทบาท</th>
                  <th className="px-3 py-3">สถานะ</th>
                  <th className="px-5 py-3 text-right">รายละเอียด</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((user) => (
                  <tr
                    key={user.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`เปิดรายละเอียด ${user.fullName}`}
                    onClick={() => selectUser(user.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        selectUser(user.id);
                      }
                    }}
                    className="cursor-pointer border-t border-[#f0ebf3] transition hover:bg-[#fcf9ff] focus:bg-[#fcf9ff] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#c7a7f4]"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <UserAvatar name={user.fullName} />
                        <div>
                          <strong className="block text-[#242032]">
                            {user.fullName}
                          </strong>
                          <small className="block max-w-[210px] truncate text-[10px] text-[#9a91a2]">
                            {user.id}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">{user.email}</td>
                    <td className="px-3 py-3.5">
                      <RolePill role={user.role} />
                    </td>
                    <td className="px-3 py-3.5">
                      {user.isBlacklisted ? (
                        <Pill tone="red">แบล็กลิสต์</Pill>
                      ) : (
                        <Pill tone="green">ปกติ</Pill>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right font-extrabold text-[#6d28d9]">
                      ดูข้อมูล →
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

      {selectedUserId ? (
        <UserDetailDrawer
          userId={selectedUserId}
          onClose={() => selectUser()}
        />
      ) : null}
    </>
  );
}

function UserDetailDrawer({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<SuperAdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState<DetailTab>("overview");
  const [lastLogin, setLastLogin] = useState<string | null>(null);
  const [lastLoginLoading, setLastLoginLoading] = useState(true);
  const [lastLoginError, setLastLoginError] = useState("");

  useEffect(() => setTab("overview"), [userId]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError("");
    setDetail(null);
    void (async () => {
      try {
        const token = await getAccessToken();
        const row = await getSuperAdminUserDetail(
          userId,
          token,
          controller.signal,
        );
        if (active) setDetail(row);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError")
          return;
        if (active)
          setError(errorMessage(cause, "โหลดรายละเอียดผู้ใช้ไม่สำเร็จ"));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadKey, userId]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLastLoginLoading(true);
    setLastLoginError("");
    setLastLogin(null);
    void (async () => {
      try {
        const token = await getAccessToken();
        const result = await getSuperAdminUserLastLogin(
          userId,
          token,
          controller.signal,
        );
        if (active) setLastLogin(result.lastSignInAt);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError")
          return;
        if (active)
          setLastLoginError(
            errorMessage(cause, "โหลดเวลาเข้าสู่ระบบล่าสุดไม่สำเร็จ"),
          );
      } finally {
        if (active) setLastLoginLoading(false);
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [userId]);

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-[rgba(25,17,38,.46)] backdrop-blur-[2px]">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label="ปิดรายละเอียดผู้ใช้"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-detail-title"
        className="relative flex h-full w-full max-w-[780px] flex-col overflow-hidden border-l border-[#e3d8f0] bg-[#fbfaff] shadow-[-24px_0_70px_rgba(28,14,47,.2)]"
      >
        <header className="flex items-start justify-between border-b border-[#e9e1ee] bg-white px-5 py-4 sm:px-7">
          <div className="min-w-0">
            <span className="text-[10px] font-extrabold tracking-[1px] text-[#7c3aed]">
              USER DETAIL
            </span>
            <h2
              id="user-detail-title"
              className="mt-1 truncate text-xl font-black text-[#242032]"
            >
              {detail?.fullName ?? "รายละเอียดผู้ใช้"}
            </h2>
            {detail ? (
              <p className="mt-1 truncate text-xs text-[#82788b]">
                {detail.email}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] border border-[#e7dfea] bg-white text-[#716675]"
            aria-label="ปิด"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {loading ? (
          <DrawerSkeleton />
        ) : error ? (
          <StatePanel
            title="โหลดรายละเอียดผู้ใช้ไม่สำเร็จ"
            detail={error}
            action={() => setReloadKey((value) => value + 1)}
          />
        ) : detail ? (
          <>
            <nav
              className="flex shrink-0 gap-1 overflow-x-auto border-b border-[#e9e1ee] bg-white px-4 py-2 sm:px-6"
              aria-label="หมวดรายละเอียดผู้ใช้"
            >
              <TabButton
                active={tab === "overview"}
                onClick={() => setTab("overview")}
              >
                ข้อมูลทั่วไป
              </TabButton>
              <TabButton
                active={tab === "shops"}
                onClick={() => setTab("shops")}
              >
                ร้านค้า ({detail.shops.length})
              </TabButton>
              <TabButton
                active={tab === "bookings"}
                onClick={() => setTab("bookings")}
              >
                การจอง ({detail.bookings.length})
              </TabButton>
              <TabButton
                active={tab === "refunds"}
                onClick={() => setTab("refunds")}
              >
                คืนเงิน ({detail.refunds.length})
              </TabButton>
              <TabButton
                active={tab === "issues"}
                onClick={() => setTab("issues")}
              >
                บทลงโทษและคำร้อง
              </TabButton>
            </nav>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              {tab === "overview" ? (
                <OverviewTab
                  detail={detail}
                  lastLogin={lastLogin}
                  lastLoginLoading={lastLoginLoading}
                  lastLoginError={lastLoginError}
                />
              ) : null}
              {tab === "shops" ? <ShopsTab detail={detail} /> : null}
              {tab === "bookings" ? <BookingsTab detail={detail} /> : null}
              {tab === "refunds" ? <RefundsTab detail={detail} /> : null}
              {tab === "issues" ? <IssuesTab detail={detail} /> : null}
            </div>
          </>
        ) : null}
      </aside>
    </div>
  );
}

function OverviewTab({
  detail,
  lastLogin,
  lastLoginLoading,
  lastLoginError,
}: {
  detail: SuperAdminUserDetail;
  lastLogin: string | null;
  lastLoginLoading: boolean;
  lastLoginError: string;
}) {
  return (
    <div className="grid gap-4">
      <section className="rounded-[14px] border border-[#e7dfea] bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <UserAvatar name={detail.fullName} large />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-black text-[#242032]">
              {detail.fullName}
            </h3>
            <p className="truncate text-sm text-[#82788b]">{detail.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <RolePill role={detail.role} />
              {detail.isBlacklisted ? (
                <Pill tone="red">แบล็กลิสต์</Pill>
              ) : (
                <Pill tone="green">ใช้งานปกติ</Pill>
              )}
            </div>
          </div>
        </div>
      </section>
      <section className="grid gap-3 rounded-[14px] border border-[#e7dfea] bg-white p-5 sm:grid-cols-2">
        <Info label="โทรศัพท์" value={detail.phone || "ไม่ได้ระบุ"} />
        <Info label="สร้างบัญชี" value={formatDateTime(detail.createdAt)} />
        <Info label="แก้ไขล่าสุด" value={formatDateTime(detail.updatedAt)} />
        <Info
          label="เข้าสู่ระบบล่าสุด"
          value={
            lastLoginLoading
              ? "กำลังโหลด…"
              : lastLoginError ||
                (lastLogin ? formatDateTime(lastLogin) : "ยังไม่เคยเข้าสู่ระบบ")
          }
          muted={lastLoginLoading || Boolean(lastLoginError)}
        />
      </section>
      {detail.isBlacklisted ? (
        <section className="rounded-[14px] border border-[#fecdd3] bg-[#fff1f2] p-5">
          <h3 className="font-black text-[#b91c1c]">เหตุผลที่ถูกแบล็กลิสต์</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#7f1d1d]">
            {detail.blacklistReason || "ไม่ได้ระบุเหตุผล"}
          </p>
        </section>
      ) : null}
      <p className="break-all px-1 text-[10px] text-[#9a91a2]">
        User ID: {detail.id}
      </p>
    </div>
  );
}

function ShopsTab({ detail }: { detail: SuperAdminUserDetail }) {
  return detail.shops.length === 0 ? (
    <InlineEmpty icon={Store} title="ผู้ใช้นี้ยังไม่มีร้านค้า" />
  ) : (
    <div className="grid gap-3 sm:grid-cols-2">
      {detail.shops.map((shop) => (
        <article
          key={shop.id}
          className="rounded-[14px] border border-[#e7dfea] bg-white p-4"
        >
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f2eaff] font-black text-[#6d28d9]">
              {initial(shop.name)}
            </span>
            <div>
              <h3 className="font-black text-[#242032]">{shop.name}</h3>
              <p className="mt-1 text-xs text-[#82788b]">
                สร้างเมื่อ {formatDate(shop.createdAt)}
              </p>
            </div>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#716675]">
            {shop.description || "ไม่มีคำอธิบายร้านค้า"}
          </p>
        </article>
      ))}
    </div>
  );
}

function BookingsTab({ detail }: { detail: SuperAdminUserDetail }) {
  return detail.bookings.length === 0 ? (
    <InlineEmpty icon={Clock3} title="ยังไม่มีประวัติการจอง" />
  ) : (
    <DataTable
      headers={["รหัส", "Event / ร้าน", "ช่วงวันที่", "ราคา", "สถานะ"]}
    >
      {detail.bookings.map((booking) => (
        <tr key={booking.id} className="border-t border-[#f0ebf3]">
          <td className="px-3 py-3 font-bold text-[#242032]">
            {booking.bookingCode}
          </td>
          <td className="px-3 py-3">
            {booking.event.name}
            <small className="block text-[#82788b]">{booking.shop.name}</small>
          </td>
          <td className="whitespace-nowrap px-3 py-3">
            {formatDate(booking.bookingStartDate)}
            <small className="block text-[#82788b]">
              ถึง {formatDate(booking.bookingEndDate)}
            </small>
          </td>
          <td className="whitespace-nowrap px-3 py-3 font-bold">
            {formatMoney(booking.boothPrice)}
          </td>
          <td className="px-3 py-3">
            <BookingStatusPill status={booking.status} />
          </td>
        </tr>
      ))}
    </DataTable>
  );
}

function RefundsTab({ detail }: { detail: SuperAdminUserDetail }) {
  return detail.refunds.length === 0 ? (
    <InlineEmpty icon={Clock3} title="ยังไม่มีคำขอคืนเงิน" />
  ) : (
    <DataTable
      headers={[
        "Booking",
        "เหตุผล",
        "ยอดที่ขอ",
        "ยอดอนุมัติ",
        "สถานะ",
        "วันที่",
      ]}
    >
      {detail.refunds.map((refund) => (
        <tr key={refund.id} className="border-t border-[#f0ebf3]">
          <td className="px-3 py-3 font-bold">{refund.booking.bookingCode}</td>
          <td className="max-w-[220px] px-3 py-3">{refund.reason}</td>
          <td className="whitespace-nowrap px-3 py-3">
            {formatMoney(refund.requestedAmount)}
          </td>
          <td className="whitespace-nowrap px-3 py-3">
            {refund.approvedAmount ? formatMoney(refund.approvedAmount) : "—"}
          </td>
          <td className="px-3 py-3">
            <GenericStatusPill status={refund.status} />
          </td>
          <td className="whitespace-nowrap px-3 py-3">
            {formatDate(refund.createdAt)}
          </td>
        </tr>
      ))}
    </DataTable>
  );
}

function IssuesTab({ detail }: { detail: SuperAdminUserDetail }) {
  return (
    <div className="grid gap-5">
      <section>
        <SectionTitle title="ประวัติบทลงโทษ" count={detail.penalties.length} />
        {detail.penalties.length === 0 ? (
          <InlineEmpty icon={ShieldCheck} title="ไม่มีประวัติบทลงโทษ" compact />
        ) : (
          <div className="grid gap-2">
            {detail.penalties.map((penalty) => (
              <article
                key={penalty.id}
                className="rounded-xl border border-[#e7dfea] bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <strong className="text-[#242032]">{penalty.reason}</strong>
                    <p className="mt-1 text-xs text-[#82788b]">
                      {penalty.organization.name} ·{" "}
                      {formatDateTime(penalty.issuedAt)}
                    </p>
                  </div>
                  <Pill tone="red">{penalty.points} คะแนน</Pill>
                </div>
                {penalty.description ? (
                  <p className="mt-3 text-sm leading-6 text-[#716675]">
                    {penalty.description}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
      <section>
        <SectionTitle
          title="คำร้องช่วยเหลือ"
          count={detail.supportTickets.length}
        />
        {detail.supportTickets.length === 0 ? (
          <InlineEmpty icon={Clock3} title="ไม่มีประวัติคำร้อง" compact />
        ) : (
          <DataTable headers={["หัวข้อ", "ประเภท", "สถานะ", "วันที่"]}>
            {detail.supportTickets.map((ticket) => (
              <tr key={ticket.id} className="border-t border-[#f0ebf3]">
                <td className="px-3 py-3 font-bold text-[#242032]">
                  {ticket.subject}
                </td>
                <td className="px-3 py-3">{ticket.type}</td>
                <td className="px-3 py-3">
                  <TicketStatusPill status={ticket.status} />
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  {formatDate(ticket.createdAt)}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  loading,
  danger = false,
}: {
  label: string;
  value: number;
  icon: typeof UsersRound;
  loading: boolean;
  danger?: boolean;
}) {
  return (
    <article className="rounded-[14px] border border-[#e7def4] bg-[linear-gradient(145deg,#fff,#fbf8ff)] px-[17px] py-[15px] shadow-[0_10px_26px_rgba(74,48,112,.05)]">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-[#82788b]">{label}</span>
        <Icon
          className={`h-4 w-4 ${danger ? "text-[#b91c1c]" : "text-[#7c3aed]"}`}
        />
      </div>
      {loading ? (
        <div className="mt-2 h-7 w-14 animate-pulse rounded bg-[#eee8f4]" />
      ) : (
        <strong
          className={`mt-1 block text-[22px] ${danger ? "text-[#b91c1c]" : "text-[#242032]"}`}
        >
          {value.toLocaleString("th-TH")}
        </strong>
      )}
    </article>
  );
}
function UserAvatar({
  name,
  large = false,
}: {
  name: string;
  large?: boolean;
}) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-xl bg-[linear-gradient(135deg,#f2eaff,#e7d8fb)] font-black text-[#6d28d9] ${large ? "h-16 w-16 text-xl" : "h-9 w-9 text-sm"}`}
    >
      {initial(name)}
    </span>
  );
}
function RolePill({ role }: { role: UserRole }) {
  const tone =
    role === "SUPER_ADMIN" ? "purple" : role === "ORG_ADMIN" ? "blue" : "gray";
  return <Pill tone={tone}>{roleLabel(role)}</Pill>;
}
function BookingStatusPill({ status }: { status: BookingStatus }) {
  return <GenericStatusPill status={status} />;
}
function TicketStatusPill({ status }: { status: SupportTicketStatus }) {
  return <GenericStatusPill status={status} />;
}
function GenericStatusPill({ status }: { status: string }) {
  const green = ["CONFIRMED", "COMPLETED", "APPROVED", "PROCESSED", "CLOSED"];
  const red = ["CANCELLED", "REJECTED", "NO_SHOW"];
  return (
    <Pill
      tone={
        green.includes(status)
          ? "green"
          : red.includes(status)
            ? "red"
            : "orange"
      }
    >
      {status}
    </Pill>
  );
}
const PILL_STYLES = {
  green: "bg-[#ecfdf3] text-[#166534]",
  orange: "bg-[#fff7ed] text-[#92400e]",
  red: "bg-[#fff1f2] text-[#b91c1c]",
  purple: "bg-[#f2eaff] text-[#6d28d9]",
  blue: "bg-[#eff6ff] text-[#1d4ed8]",
  gray: "bg-[#f3f4f6] text-[#4b5563]",
};
function Pill({
  tone,
  children,
}: {
  tone: keyof typeof PILL_STYLES;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-extrabold ${PILL_STYLES[tone]}`}
    >
      {children}
    </span>
  );
}
function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-10 w-full rounded-[9px] border border-[#ded5e7] bg-white px-3 text-sm font-bold text-[#4d4356] outline-none focus:border-[#9b6be1] focus:ring-4 focus:ring-[#f0e7ff]"
      >
        {children}
      </select>
    </label>
  );
}
function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-lg px-3 py-2 text-xs font-extrabold ${active ? "bg-[#f2eaff] text-[#6d28d9]" : "text-[#716675] hover:bg-[#faf7fd]"}`}
    >
      {children}
    </button>
  );
}
function Info({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div>
      <span className="text-[11px] font-bold text-[#82788b]">{label}</span>
      <p
        className={`mt-1 text-sm font-bold ${muted ? "text-[#82788b]" : "text-[#342d3c]"}`}
      >
        {value}
      </p>
    </div>
  );
}
function SectionTitle({ title, count }: { title: string; count: number }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="font-black text-[#242032]">{title}</h3>
      <Pill tone="purple">{count.toLocaleString("th-TH")} รายการ</Pill>
    </div>
  );
}
function DataTable({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-[13px] border border-[#e7dfea] bg-white">
      <table className="min-w-[680px] w-full border-collapse text-left text-xs text-[#4f4658]">
        <thead className="bg-[#faf7fd] text-[10px] font-extrabold uppercase tracking-[.4px] text-[#82788b]">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-2.5">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function InlineEmpty({
  icon: Icon,
  title,
  compact = false,
}: {
  icon: typeof Store;
  title: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`grid place-items-center rounded-[13px] border border-dashed border-[#ded5e7] bg-white text-center ${compact ? "min-h-[110px]" : "min-h-[190px]"}`}
    >
      <div>
        <Icon className="mx-auto h-5 w-5 text-[#9b6be1]" />
        <p className="mt-2 text-sm font-bold text-[#716675]">{title}</p>
      </div>
    </div>
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
    <div className="grid min-h-[220px] place-items-center p-7 text-center">
      <div>
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#f1eaff] text-[#6d28d9]">
          <UsersRound className="h-5 w-5" />
        </span>
        <strong className="mt-3 block text-sm text-[#242032]">{title}</strong>
        <span className="mt-1 block text-xs text-[#82788b]">{detail}</span>
        {action ? (
          <button
            type="button"
            onClick={action}
            className="mt-3 text-xs font-extrabold text-[#6d28d9] underline"
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
        <div
          key={item}
          className="h-14 animate-pulse rounded-lg bg-[#f2edf8]"
        />
      ))}
    </div>
  );
}
function DrawerSkeleton() {
  return (
    <div className="grid gap-4 p-6">
      {[1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="h-20 animate-pulse rounded-xl bg-[#eee8f4]"
        />
      ))}
    </div>
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
  return (
    <div className="flex flex-col gap-3 border-t border-[#ebe4ef] px-[17px] py-[13px] text-xs text-[#82788b] sm:flex-row sm:items-center sm:justify-between">
      <span>
        แสดง {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}{" "}
        จาก {total} รายการ
      </span>
      <div className="flex gap-1.5">
        <PageButton
          label="หน้าก่อนหน้า"
          disabled={page === 1}
          onClick={() => onPage(Math.max(1, page - 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </PageButton>
        <span className="grid min-h-8 min-w-8 place-items-center rounded-[7px] border border-[#d7c3f5] bg-[#f2eaff] px-2 font-extrabold text-[#6d28d9]">
          {page}/{totalPages}
        </span>
        <PageButton
          label="หน้าถัดไป"
          disabled={page === totalPages}
          onClick={() => onPage(Math.min(totalPages, page + 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </PageButton>
      </div>
    </div>
  );
}
function PageButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid min-h-8 min-w-8 place-items-center rounded-[7px] border border-[#e7dfea] bg-white text-[#655d70] disabled:opacity-45"
    >
      {children}
    </button>
  );
}

function roleLabel(role: UserRole) {
  return role === "SUPER_ADMIN"
    ? "Super Admin"
    : role === "ORG_ADMIN"
      ? "ผู้ดูแลองค์กร"
      : "ผู้ขาย";
}
function initial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "U";
}
function formatDateTime(value: string) {
  return THAI_DATE_TIME.format(new Date(value));
}
function formatDate(value: string) {
  return THAI_DATE.format(new Date(value));
}
function formatMoney(value: string) {
  const [whole = "0", fraction = ""] = value.split(".");
  const formattedWhole = BigInt(whole || "0").toLocaleString("th-TH");
  const formattedFraction = fraction.replace(/0+$/, "");
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
  return cause instanceof ApiError || cause instanceof Error
    ? cause.message || fallback
    : fallback;
}
