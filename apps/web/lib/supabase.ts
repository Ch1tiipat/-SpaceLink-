import { createBrowserClient } from '@supabase/ssr';

/**
 * The browser-side Supabase Auth client (AGENTS.md §7). The browser talks to
 * Supabase Auth directly to obtain a JWT; the NestJS API only ever verifies
 * that token, so nothing here calls our own backend.
 *
 * Deliberately not a module-level `const`. `next build` prerenders every route,
 * and CI's web job sets only NEXT_PUBLIC_API_URL — no Supabase variables at
 * all. A client built at import time would read `undefined` and throw during
 * the build, failing CI on a page that never needed auth in the first place.
 * Building it lazily moves that failure to the moment someone actually tries to
 * sign in, which is where a missing environment variable is worth reporting.
 */

/** Inferred rather than imported: @supabase/supabase-js is a peer dependency
 * that npm installs on its own, and is not declared in our package.json. */
type SupabaseBrowserClient = ReturnType<typeof createBrowserClient>;

/**
 * Memoised at module scope so repeated calls share one client. Supabase stores
 * the session in the browser; two independent clients would each keep their own
 * auth state listener and race each other on refresh.
 */
let client: SupabaseBrowserClient | undefined;

/**
 * Returns the shared browser client, creating it on first use.
 *
 * **Call this from an event handler or `useEffect` only** — never during render
 * and never at module top level, or the lazy construction above is defeated and
 * the build breaks again.
 *
 * @throws if the Supabase environment variables are missing.
 */
export function getSupabaseBrowserClient(): SupabaseBrowserClient {
  if (client) {
    return client;
  }

  // Written as two literal `process.env.X` reads because Next.js inlines
  // NEXT_PUBLIC_* by textual substitution at build time. A computed lookup
  // (`process.env[name]`) is not substituted and would always be undefined.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'ยังไม่ได้ตั้งค่า NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'สำหรับ SpaceLink Web',
    );
  }

  client = createBrowserClient(url, anonKey);
  return client;
}
