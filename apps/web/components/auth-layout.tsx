import type { ReactNode } from 'react';

/**
 * The two-column shell shared by every authentication screen: a decorative
 * brand panel on the left, the form column on the right. Below `lg` the panel
 * collapses to a compact header and the form takes the full width.
 *
 * Nothing here fetches. The login screen has to render completely while the
 * API is still cold-starting, so the most critical page in the product is not
 * coupled to decoration.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Compact brand header — the panel's stand-in below `lg`. */}
      <div className="bg-gradient-to-r from-violet to-[#4e21bd] px-5 py-4 lg:hidden">
        <BrandMark />
      </div>

      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-violet to-[#4e21bd] px-14 py-16 text-white lg:flex lg:flex-col">
        <BrandMark />

        <div className="mt-auto pt-16">
          <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-sm font-semibold text-white/90">
            สำหรับผู้ขายและผู้ดูแลองค์กร
          </span>

          <h2 className="mt-7 max-w-[15ch] text-[42px] font-black leading-[1.1] tracking-[-0.045em]">
            จองบูธในงานที่ใช่ ได้ในไม่กี่ขั้นตอน
          </h2>

          <p className="mt-5 max-w-[42ch] text-[17px] leading-8 text-white/75">
            เข้าสู่ระบบด้วยอีเมล เราจะส่งรหัสยืนยัน 6 หลักไปให้
            ไม่ต้องตั้งและไม่ต้องจำรหัสผ่าน
          </p>
        </div>

        <div className="mt-14">
          <BoothGrid />
        </div>
      </aside>

      <main className="flex flex-1 items-center justify-center bg-white px-5 py-14">
        <div className="w-full max-w-[390px]">{children}</div>
      </main>
    </div>
  );
}

/** The `S` tile and wordmark, matching the treatment in `AppHeader` but
 * inverted for a dark panel. */
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
