import type { ReactNode } from "react";
import { CalendarCheck2, MapPinned, ShieldCheck } from "lucide-react";
import Link from "next/link";

type AuthLayoutProps = {
  /** Small pill above the headline. */
  eyebrow: string;
  headline: string;
  description: string;
  children: ReactNode;
};

/**
 * The two-column shell shared by every authentication screen: a decorative
 * brand panel on the left, the form column on the right. Below `lg` the panel
 * collapses to a compact header and the form takes the full width.
 *
 * The panel's structure is fixed and its copy is not — signing in and signing
 * up are different promises, and each page states its own.
 *
 * Nothing here fetches. The login screen has to render completely while the
 * API is still cold-starting, so the most critical page in the product is not
 * coupled to decoration.
 */
export function AuthLayout({
  eyebrow,
  headline,
  description,
  children,
}: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[#f8f6ff] lg:grid lg:grid-cols-[minmax(440px,0.92fr)_minmax(540px,1.08fr)]">
      {/* Compact brand header — the panel's stand-in below `lg`. */}
      <div className="relative overflow-hidden bg-gradient-to-br from-violet via-[#6330d9] to-[#4e21bd] px-5 pb-11 pt-4 text-white lg:hidden">
        <div className="absolute -right-16 -top-12 h-48 w-48 rounded-full border-[34px] border-white/[0.07]" />
        <div className="absolute -bottom-20 -left-20 h-52 w-52 rounded-full bg-[#a442e8]/25 blur-2xl" />

        <div className="relative">
          <BrandMark />

          <div className="mt-6 sm:mt-8">
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
              {eyebrow}
            </span>
            <h2 className="sl-thai-heading mt-3 max-w-[20ch] text-[25px] font-black leading-[1.22] tracking-[-0.025em] sm:text-[28px]">
              {headline}
            </h2>
            <p className="mt-2.5 max-w-[42ch] text-[13px] leading-5 text-white/78 sm:text-sm sm:leading-6">
              {description}
            </p>
          </div>

          <div className="mt-5">
            <MobileBoothStrip />
          </div>
        </div>
      </div>

      <aside className="relative hidden overflow-hidden bg-[radial-gradient(circle_at_15%_12%,rgba(255,255,255,0.16),transparent_18rem),linear-gradient(145deg,#7c3aed,#4e21bd)] px-[clamp(40px,5vw,76px)] py-12 text-white lg:flex lg:flex-col">
        <span className="absolute -right-24 -top-24 h-80 w-80 rounded-full border-[55px] border-white/[0.055]" />
        <span className="absolute -bottom-36 left-1/3 h-96 w-96 rounded-full bg-[#b44de7]/20 blur-3xl" />
        <BrandMark />

        <div className="mt-auto pt-10">
          <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-sm font-semibold text-white/90">
            {eyebrow}
          </span>

          <h2 className="sl-thai-heading mt-6 max-w-[21ch] text-[clamp(34px,3.25vw,48px)] font-black leading-[1.24] tracking-[-0.028em]">
            {headline}
          </h2>

          <p className="mt-5 max-w-[48ch] text-[16px] leading-8 text-white/78">
            {description}
          </p>

          <AuthBenefits />
        </div>

        <div className="mt-9">
          <BoothGrid />
        </div>
      </aside>

      <main className="relative flex flex-1 items-start justify-center overflow-hidden px-4 pb-8 lg:items-center lg:bg-[radial-gradient(circle_at_85%_10%,rgba(124,58,237,0.1),transparent_25rem),radial-gradient(circle_at_15%_92%,rgba(91,33,182,0.06),transparent_20rem),#fff] lg:px-10 lg:py-12">
        <span className="pointer-events-none absolute -bottom-40 -right-40 hidden h-96 w-96 rounded-full bg-violet-tint blur-3xl lg:block" />
        <Link
          href="/"
          className="absolute right-8 top-7 hidden rounded-full border border-[#e8e2f1] bg-white/85 px-4 py-2 text-sm font-bold text-[#655d70] shadow-sm transition hover:border-[#d3c6e8] hover:text-violet lg:inline-flex"
        >
          ← กลับหน้าแรก
        </Link>
        <div className="relative -mt-6 w-full max-w-[460px] rounded-[26px] border border-white/80 bg-white p-5 shadow-[0_20px_60px_rgba(67,34,139,0.14)] sm:-mt-8 sm:rounded-[28px] sm:p-8 lg:mt-0 lg:max-w-[480px] lg:rounded-[32px] lg:border lg:border-[#eee8f7] lg:p-10 lg:shadow-[0_26px_80px_rgba(67,34,139,0.12)]">
          {children}
          <div className="mt-8 flex items-start gap-3 border-t border-line pt-5 text-xs leading-5 text-muted">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#edf9f4] text-[#13795b]">
              <ShieldCheck className="h-4 w-4" aria-hidden />
            </span>
            <p>
              เข้าสู่ระบบด้วย Email OTP อย่างปลอดภัย SpaceLink
              ไม่ขอให้คุณตั้งหรือจดจำรหัสผ่าน
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function AuthBenefits() {
  const benefits = [
    { icon: MapPinned, label: "เลือกโซนและดูตำแหน่งบูธจากแผนผังจริง" },
    { icon: CalendarCheck2, label: "ติดตามการจองและกำหนดชำระเงินในที่เดียว" },
    { icon: ShieldCheck, label: "เข้าสู่ระบบด้วยรหัสยืนยัน ไม่ต้องจำรหัสผ่าน" },
  ];

  return (
    <div className="mt-7 grid gap-2.5">
      {benefits.map(({ icon: Icon, label }) => (
        <div
          key={label}
          className="flex max-w-[520px] items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.08] px-4 py-3 text-sm font-semibold text-white/88 backdrop-blur-sm"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/12">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <span className="leading-6">{label}</span>
        </div>
      ))}
    </div>
  );
}

function MobileBoothStrip() {
  return (
    <div aria-hidden="true" className="flex max-w-[320px] gap-2">
      {Array.from({ length: 9 }, (_, index) => (
        <span
          key={index}
          className={[
            "h-3 flex-1 rounded-full",
            BOOKED_BOOTHS.has(index)
              ? "bg-white shadow-sm"
              : "border border-white/30 bg-white/10",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

/** The `S` tile and wordmark, inverted for a dark panel. Authentication
 * screens render outside `AppShell`, so this is their only branding. */
function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-lg font-black text-violet">
        S
      </span>
      <span className="text-xl font-extrabold tracking-[-0.03em] text-white">
        SpaceLink
      </span>
    </div>
  );
}

const BOOTH_COUNT = 96;

/**
 * Which squares read as taken. A fixed list, not `Math.random()`: a random
 * pattern would differ between the server render and hydration, and React would
 * warn about it on a page that has no business being dynamic at all.
 */
const BOOKED_BOOTHS = new Set([
  0, 1, 4, 9, 12, 13, 18, 22, 25, 26, 31, 33, 37, 40, 41, 44, 49, 52, 55, 58,
  60, 63, 66, 69, 70, 74, 77, 81, 84, 85, 88, 92,
]);

/**
 * Decorative only — `aria-hidden`, no data behind it. It deliberately shows no
 * count, ratio or event name: an invented number that looks real is worse than
 * no number, and there is nothing here to source a real one from.
 */
function BoothGrid() {
  return (
    <div aria-hidden="true">
      {/* 16 columns, written out because Tailwind's grid-cols scale stops at 12. */}
      <div className="grid max-w-[420px] grid-cols-[repeat(16,minmax(0,1fr))] gap-1.5">
        {Array.from({ length: BOOTH_COUNT }, (_, index) =>
          BOOKED_BOOTHS.has(index) ? (
            <span
              key={index}
              className="aspect-square rounded-[4px] bg-gradient-to-br from-[#a442e8] to-violet"
            />
          ) : (
            <span
              key={index}
              className="aspect-square rounded-[4px] border border-white/25"
            />
          ),
        )}
      </div>

      <div className="mt-5 flex items-center gap-5 text-[13px] font-semibold text-white/70">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-[3px] bg-gradient-to-br from-[#a442e8] to-violet" />
          จองแล้ว
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-[3px] border border-white/35" />
          ว่าง
        </span>
      </div>
    </div>
  );
}
