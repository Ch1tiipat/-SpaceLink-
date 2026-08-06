'use client';

import { useCallback, useEffect, useState } from 'react';
import { getMe, type CurrentUser, type VendorShop } from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabase';

/**
 * `loading` is a state of its own for the same reason it is in `useAuthState`:
 * resolving a session is asynchronous, and rendering the signed-out card first
 * would flash a sign-in prompt at every returning vendor.
 *
 * `shop` is derived here rather than by each caller. `GET /auth/me` returns
 * `shops: VendorShop[]`, but a vendor may own **one** shop at most — the API
 * answers 409 on a second `POST /shops` — so every screen would otherwise write
 * the same `shops[0] ?? null` and be tempted to render a list that can never
 * have a second row. The wire type stays an array because that is genuinely
 * what the endpoint returns; narrowing it belongs to the API, not to the client.
 */
export type VendorProfileState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | {
      status: 'ready';
      token: string;
      profile: CurrentUser;
      shop: VendorShop | null;
    }
  | { status: 'error'; message: string };

/**
 * Resolves the signed-in vendor: the Supabase session for the token, then
 * `app_user` through `/auth/me` — never a token claim, which carries neither
 * role nor org membership (AGENTS.md §7).
 *
 * This is the shared version of the "read the session, call `getMe`, track the
 * result" block that `event-map-screen.tsx` and `booking-screen.tsx` each
 * copied. `use-auth-state.ts` accepts two copies of that pattern by name and
 * asks that a third caller lift it instead of adding a third duplicate; this
 * page is that third caller, so the pattern lives here and the two screens move
 * onto it in a later phase.
 *
 * It stays a plain hook rather than a provider: `useAuthState` still serves the
 * shell's display name from its own subscription, and the three profile callers
 * are page-level components that mount one at a time.
 *
 * Unlike `useAuthState`, a failed `/auth/me` surfaces as `error` rather than
 * `signed-out`. The shell can afford to fall back to the signed-out buttons
 * because it only decorates a header; a page whose entire content is the
 * profile must say that it could not be read instead of implying nobody is
 * signed in.
 */
export function useVendorProfile(): {
  state: VendorProfileState;
  /** Re-reads the session and `/auth/me` — call after creating or editing. */
  refresh: () => void;
} {
  const [state, setState] = useState<VendorProfileState>({ status: 'loading' });
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    // The effect's re-run signal. Read so it is a real dependency and not one
    // the exhaustive-deps rule reports as unnecessary.
    void reloadCount;

    const controller = new AbortController();
    let active = true;

    let supabase: ReturnType<typeof getSupabaseBrowserClient>;
    try {
      supabase = getSupabaseBrowserClient();
    } catch (cause) {
      // No Supabase variables configured. This page is signed-in-only, so
      // unlike discovery there is nothing to fall back to — say so.
      setState({
        status: 'error',
        message:
          cause instanceof Error
            ? cause.message
            : 'ยังไม่ได้ตั้งค่าระบบเข้าสู่ระบบ',
      });
      return;
    }

    async function resolve(token: string | undefined) {
      if (!token) {
        if (active) setState({ status: 'signed-out' });
        return;
      }

      try {
        const profile = await getMe(token, controller.signal);
        if (!active) return;
        setState({
          status: 'ready',
          token,
          profile,
          shop: profile.shops[0] ?? null,
        });
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') {
          return;
        }
        if (active) {
          setState({
            status: 'error',
            message:
              cause instanceof Error
                ? cause.message
                : 'ไม่สามารถอ่านข้อมูลร้านค้าได้',
          });
        }
      }
    }

    void supabase.auth
      .getSession()
      .then(({ data }) => resolve(data.session?.access_token));

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // The initial session is already being resolved above; handling it here
        // too would call /auth/me twice on every page load.
        if (event === 'INITIAL_SESSION') return;
        void resolve(session?.access_token);
      },
    );

    return () => {
      active = false;
      controller.abort();
      listener.subscription.unsubscribe();
    };
  }, [reloadCount]);

  const refresh = useCallback(() => setReloadCount((count) => count + 1), []);

  return { state, refresh };
}
