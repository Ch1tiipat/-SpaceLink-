'use client';

import { useCallback, useEffect, useState } from 'react';
import { getMe } from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import {
  getUxPreviewMode,
  setUxPreviewMode,
  subscribeToUxPreview,
  UX_PREVIEW_PROFILE,
} from '@/lib/ux-preview';

/**
 * `loading` is a state of its own rather than an optimistic guess. Resolving a
 * session is asynchronous, so rendering the signed-out buttons first would show
 * every returning visitor a sign-in prompt for a moment and then swap it for
 * their own name — the flash is worse than a placeholder.
 */
export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; fullName: string };

/**
 * The session is read from Supabase, but the display name comes from
 * `app_user` via `/auth/me` — never from a token claim (§7).
 *
 * Every caller runs its own subscription and its own `/auth/me` request. That
 * is the cost of keeping this a plain hook rather than a context provider, and
 * it is small: the shell and the one page that needs it both mount once.
 * Should a third caller appear, lift it to a provider instead of accepting a
 * third duplicate request.
 */
export function useAuthState(): {
  auth: AuthState;
  signOut: () => void;
} {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    const previewMode = getUxPreviewMode();
    if (previewMode) {
      const applyPreview = (mode: 'signed-in' | 'signed-out') => {
        setAuth(
          mode === 'signed-in'
            ? { status: 'signed-in', fullName: UX_PREVIEW_PROFILE.fullName }
            : { status: 'signed-out' },
        );
      };
      applyPreview(previewMode);
      return subscribeToUxPreview(applyPreview);
    }

    const controller = new AbortController();
    let active = true;

    let supabase: ReturnType<typeof getSupabaseBrowserClient>;
    try {
      supabase = getSupabaseBrowserClient();
    } catch {
      // No Supabase variables configured: there is no session to resolve and
      // the caller still has to render. Discovery is public and must not
      // depend on auth being set up.
      setAuth({ status: 'signed-out' });
      return;
    }

    async function resolve(token: string | undefined) {
      if (!token) {
        if (active) {
          setAuth({ status: 'signed-out' });
        }
        return;
      }

      try {
        const me = await getMe(token, controller.signal);
        if (active) {
          setAuth({ status: 'signed-in', fullName: me.fullName });
        }
      } catch {
        // This drives presentation only; authorization is enforced server-side
        // on every request (§14.6). If the profile cannot be read — API cold,
        // token rejected — fall back to signed-out rather than a half-known
        // state.
        if (active) {
          setAuth({ status: 'signed-out' });
        }
      }
    }

    void supabase.auth
      .getSession()
      .then(({ data }) => resolve(data.session?.access_token))
      .catch(() => {
        // `getSession()` itself rejecting — corrupted session storage is the
        // usual cause. `resolve` never runs in that case, so without this the
        // header holds its placeholder for good and the rejection goes
        // unhandled. Signed-out for the same reason a failed `/auth/me` is.
        if (active) {
          setAuth({ status: 'signed-out' });
        }
      });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // The initial session is already being resolved above; handling it here
      // too would call /auth/me twice on every page load.
      if (event === 'INITIAL_SESSION') {
        return;
      }
      void resolve(session?.access_token);
    });

    return () => {
      active = false;
      controller.abort();
      data.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(() => {
    if (getUxPreviewMode()) {
      setUxPreviewMode('signed-out');
      setAuth({ status: 'signed-out' });
      return;
    }

    void (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        await supabase.auth.signOut();
      } finally {
        // Set directly rather than waiting for onAuthStateChange, so the UI
        // updates even if signing out failed to reach Supabase.
        setAuth({ status: 'signed-out' });
      }
    })();
  }, []);

  return { auth, signOut };
}
