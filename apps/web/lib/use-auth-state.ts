'use client';

import { useCallback, useEffect, useState } from 'react';
import { getMe, type CurrentUser, type UserRole } from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { isAuthorizationFailure } from '@/lib/network-error';
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
  | { status: 'unavailable' }
  | {
      status: 'signed-in';
      fullName: string;
      role: UserRole;
      organizations: CurrentUser['organizations'];
    };

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
  retry: () => void;
} {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    const previewMode = getUxPreviewMode();
    if (previewMode) {
      const applyPreview = (mode: 'signed-in' | 'signed-out') => {
        setAuth(
          mode === 'signed-in'
            ? {
                status: 'signed-in',
                fullName: UX_PREVIEW_PROFILE.fullName,
                role: 'VENDOR',
                organizations: [],
              }
            : { status: 'signed-out' },
        );
      };
      applyPreview(previewMode);
      return subscribeToUxPreview(applyPreview);
    }

    let controller = new AbortController();
    let active = true;
    let generation = 0;
    let authEventSeen = false;
    const sessionTimeout = window.setTimeout(() => {
      if (active) setAuth({ status: 'unavailable' });
    }, 15_000);

    let supabase: ReturnType<typeof getSupabaseBrowserClient>;
    try {
      supabase = getSupabaseBrowserClient();
    } catch {
      // No Supabase variables configured: there is no session to resolve and
      // the caller still has to render. Discovery is public and must not
      // depend on auth being set up.
      setAuth({ status: 'signed-out' });
      window.clearTimeout(sessionTimeout);
      return;
    }

    async function resolve(token: string | undefined) {
      const requestGeneration = ++generation;
      controller.abort();
      controller = new AbortController();
      const requestController = controller;
      window.clearTimeout(sessionTimeout);
      if (!token) {
        if (active) {
          setAuth({ status: 'signed-out' });
        }
        return;
      }

      // Re-verification must keep mounted pages intact while rights are checked.
      // Failures still replace the signed-in state with unavailable/signed-out.
      setAuth((current) => current.status === 'signed-in' ? current : { status: 'loading' });
      const timeout = window.setTimeout(() => requestController.abort(), 15_000);
      try {
        const me = await getMe(token, requestController.signal);
        if (active && requestGeneration === generation) {
          setAuth({
            status: 'signed-in',
            fullName: me.fullName,
            role: me.role,
            organizations: me.organizations,
          });
        }
      } catch (cause) {
        // Missing rights cannot be inferred from a failed request. No session
        // is deleted; a retry must resolve rights from the API again.
        if (active && requestGeneration === generation) {
          setAuth({ status: isAuthorizationFailure(cause) ? 'signed-out' : 'unavailable' });
        }
      } finally {
        window.clearTimeout(timeout);
      }
    }

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        if (!authEventSeen && active) return resolve(data.session?.access_token);
      })
      .catch((cause: unknown) => {
        // A failed session lookup cannot establish that the user signed out.
        if (active && !authEventSeen) {
          window.clearTimeout(sessionTimeout);
          setAuth({ status: isAuthorizationFailure(cause) ? 'signed-out' : 'unavailable' });
        }
      });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // The initial session is already being resolved above; handling it here
      // too would call /auth/me twice on every page load.
      if (event === 'INITIAL_SESSION') {
        return;
      }
      authEventSeen = true;
      void resolve(session?.access_token);
    });

    return () => {
      active = false;
      window.clearTimeout(sessionTimeout);
      controller.abort();
      data.subscription.unsubscribe();
    };
  }, [attempt]);

  useEffect(() => {
    if (auth.status !== 'unavailable') return;
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [auth.status, retry]);

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

  return { auth, signOut, retry };
}
