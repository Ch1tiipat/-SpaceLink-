import type { Config } from 'tailwindcss';
import colors from 'tailwindcss/colors';

/**
 * Colours are migrated from `prototype/vendor/styles.css` (`:root`), which is
 * the pre-approved design. Several of its values are Tailwind's own palette —
 * `--violet` is `violet-600`, `--green` is `green-500`, `--amber` is
 * `amber-500`, `--payment` is `blue-500` — so each semantic token is layered
 * on top of the matching scale with `DEFAULT` rather than replacing it.
 *
 * That spread is load-bearing, not tidiness. A bare `red: '#EF4444'` removes
 * `red-50`, `red-200`, `red-700` and `red-800` from the build, and Tailwind
 * drops unknown classes silently — the error page in `app/page.tsx` would lose
 * its styling with nothing failing to report it.
 */
const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#201B2E',
        muted: '#726B80',
        line: '#E9E6F0',
        // `--bg` / `--card`: the page behind the shell, and the shell itself.
        canvas: '#FAFAFA',
        card: '#FFFFFF',

        violet: {
          ...colors.violet,
          DEFAULT: '#7C3AED',
          // `--violet-50`, kept under its own name so `bg-violet-tint` reads as
          // the design's tint rather than an arbitrary step of the scale.
          tint: '#F5F3FF',
        },
        green: { ...colors.green, DEFAULT: '#22C55E', bg: '#ECFDF3' },
        amber: { ...colors.amber, DEFAULT: '#F59E0B', bg: '#FFF7E6' },
        red: { ...colors.red, DEFAULT: '#EF4444', bg: '#FEF2F2' },
        // `--payment`: the status tone for a booking awaiting a slip. Not a
        // Tailwind name, so it needs no scale behind it.
        payment: { DEFAULT: '#3B82F6', bg: '#EFF6FF' },

        // Retained from the previous config: both are still referenced by
        // existing screens, and neither has an equivalent in the prototype.
        mist: '#f6f3ff',
        emerald: '#13795b',
        // The one error tone. Contrast 5.5:1 on white, so it carries body-sized
        // text on its own; kept in the same weight class as `emerald` rather
        // than a brighter alarm red, which would not belong next to `violet`.
        danger: '#c62448',
      },
      borderRadius: {
        // `--r`: the single radius every panel in the prototype shares.
        surface: '20px',
      },
      boxShadow: {
        // `--shadow`.
        surface: '0 12px 38px rgba(54, 36, 91, 0.08)',
        soft: '0 20px 60px rgba(38, 30, 72, 0.10)',
      },
    },
  },
  plugins: [],
};

export default config;
