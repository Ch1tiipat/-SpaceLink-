import type { ReactNode } from 'react';

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
    <div className="flex min-h-screen flex-col bg-[#f8f6ff] lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Compact brand header — the panel's stand-in below `lg`. */}
      <div className="relative overflow-hidden bg-gradient-to-br from-violet via-[#6330d9] to-[#4e21bd] px-5 pb-16 pt-4 text-white lg:hidden">
        <div className="absolute -right-16 -top-12 h-48 w-48 rounded-full border-[34px] border-white/[0.07]" />
        <div className="absolute -bottom-20 -left-20 h-52 w-52 rounded-full bg-[#a442e8]/25 blur-2xl" />

        <div className="relative">
          <BrandMark />

          <div className="mt-10">
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
              {eyebrow}
            </span>
            <h2 className="mt-4 max-w-[18ch] text-[28px] font-black leading-[1.18] tracking-[-0.04em]">
              {headline}
            </h2>
            <p className="mt-3 max-w-[42ch] text-sm leading-6 text-white/75">
              {description}
            </p>
          </div>

          <div className="mt-7">
            <MobileBoothStrip />
          </div>
        </div>
      </div>

      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-violet to-[#4e21bd] px-14 py-16 text-white lg:flex lg:flex-col">
        <BrandMark />

        <div className="mt-auto pt-16">
          <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-sm font-semibold text-white/90">
            {eyebrow}
          </span>

          <h2 className="mt-7 max-w-[15ch] text-[42px] font-black leading-[1.1] tracking-[-0.045em]">
            {headline}
          </h2>

          <p className="mt-5 max-w-[42ch] text-[17px] leading-8 text-white/75">
            {description}
          </p>
        </div>

        <div className="mt-14">
          <BoothGrid />
        </div>
      </aside>

      <main className="relative flex flex-1 items-start justify-center px-4 pb-12 lg:items-center lg:bg-white lg:px-5 lg:py-14">
        <div className="-mt-9 w-full max-w-[430px] rounded-[28px] border border-white/80 bg-white p-6 shadow-[0_20px_60px_rgba(67,34,139,0.14)] sm:p-8 lg:mt-0 lg:max-w-[390px] lg:rounded-none lg:border-0 lg:p-0 lg:shadow-none">
          {children}
        </div>
      </main>
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
            'h-3 flex-1 rounded-full',
            BOOKED_BOOTHS.has(index)
              ? 'bg-white shadow-sm'
              : 'border border-white/30 bg-white/10',
          ].join(' ')}
        />
      ))}
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
