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

function createClient() {
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

  return createBrowserClient(url, anonKey);
}

/**
 * Inferred from a call, not from `typeof createBrowserClient`.
 *
 * `createBrowserClient` is overloaded, and `ReturnType` over an overload set
 * resolves to the last signature — which here collapses to `any`. Writing it
 * that way compiles, lints and passes every gate while silently removing type
 * checking from every Supabase call in the app. Going through a local,
 * non-overloaded function is what keeps the real type.
 *
 * @supabase/supabase-js is still not imported: it is a peer dependency npm
 * installs on its own and is not declared in our package.json.
 */
type SupabaseBrowserClient = ReturnType<typeof createClient>;

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
  if (!client) {
    client = createClient();
  }

  return client;
}
