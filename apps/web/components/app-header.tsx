'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getMe } from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabase';

/**
 * `loading` is a state of its own rather than an optimistic guess. Resolving a
 * session is asynchronous, so rendering the signed-out buttons first would show
 * every returning visitor a sign-in prompt for a moment and then swap it for
 * their own name — the flash is worse than a placeholder.
 */
type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; fullName: string };

export function AppHeader() {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    let supabase: ReturnType<typeof getSupabaseBrowserClient>;
    try {
      supabase = getSupabaseBrowserClient();
    } catch {
      // No Supabase variables configured: there is no session to resolve and
      // the header still has to render. Discovery is public and must not
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
        // The name comes from `app_user`, never from a token claim (§7, §A3.3).
        const me = await getMe(token, controller.signal);
        if (active) {
          setAuth({ status: 'signed-in', fullName: me.fullName });
        }
      } catch {
        // The header is presentation; authorization is enforced server-side on
        // every request (§14.6). If the profile cannot be read — API cold, token
        // rejected — show the signed-out header rather than a half-known one.
        if (active) {
          setAuth({ status: 'signed-out' });
        }
      }
    }

    void supabase.auth
      .getSession()
      .then(({ data }) => resolve(data.session?.access_token));

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

  async function handleSignOut() {
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
    } finally {
      // Set directly rather than waiting for onAuthStateChange, so the header
      // updates even if signing out failed to reach Supabase.
      setAuth({ status: 'signed-out' });
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/70 bg-white/80 backdrop-blur-xl">
      <div className="shell flex h-[76px] items-center justify-between gap-3">
        <Link
          href="/"
          className="flex items-center gap-3"
          aria-label="SpaceLink หน้าหลัก"
        >
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-violet text-lg font-black text-white shadow-lg shadow-violet/25">
            S
          </span>
          {/* Hidden on the narrowest screens so the auth controls always fit:
              at 375px the shell is 355px wide, and the wordmark alone is about
              105px of it. The link keeps its aria-label, so nothing is lost to
              a screen reader. */}
          <span className="hidden text-xl font-extrabold tracking-[-0.03em] sm:inline">
            SpaceLink
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-semibold text-[#645f72] md:flex">
          <Link className="text-violet" href="/">
            ค้นหา Event
          </Link>
          <Link href="/#how-it-works">วิธีสำรวจพื้นที่</Link>
          <Link href="/#support">ช่วยเหลือ</Link>
        </nav>

        <div className="flex items-center gap-2">
          {auth.status === 'loading' && (
            // Holds the same footprint the resolved state will take, so the
            // header does not jump when it arrives.
            <span
              aria-hidden
              className="skeleton h-10 w-[132px] rounded-full sm:w-[190px]"
            />
          )}

          {auth.status === 'signed-out' && (
            <>
              <Link
                href="/login"
                className="rounded-full border border-[#e4dff0] bg-white px-3 py-2 text-[13px] font-bold text-violet shadow-sm sm:px-4 sm:text-sm"
              >
                เข้าสู่ระบบ
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-gradient-to-r from-violet to-[#a442e8] px-3 py-2 text-[13px] font-bold text-white shadow-lg shadow-violet/25 sm:px-4 sm:text-sm"
              >
                สมัครสมาชิก
              </Link>
            </>
          )}

          {auth.status === 'signed-in' && (
            <>
              <Link
                href="/bookings"
                aria-label="การจองของฉัน"
                className="inline-flex rounded-full border border-[#e4dff0] bg-white px-3 py-2 text-[13px] font-bold text-violet shadow-sm"
              >
                <span className="sm:hidden">การจอง</span>
                <span className="hidden sm:inline">การจองของฉัน</span>
              </Link>
              <span className="max-w-[84px] truncate text-[13px] font-bold text-ink sm:max-w-[180px] sm:text-sm">
                {auth.fullName}
              </span>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="rounded-full border border-[#e4dff0] bg-white px-3 py-2 text-[13px] font-bold text-violet shadow-sm sm:px-4 sm:text-sm"
              >
                ออกจากระบบ
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
