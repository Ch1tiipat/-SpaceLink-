'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { OTP_LENGTH } from '@/components/otp-input';
import { getMe } from './api';
import {
  BLACKLISTED_MESSAGE,
  INVALID_EMAIL_MESSAGE,
  describeProfileError,
  describeSendError,
  describeUnexpectedSendError,
  describeVerifyError,
  incompleteCodeMessage,
  type AuthErrorMessage,
} from './auth-errors';
import { getSupabaseBrowserClient } from './supabase';

/**
 * The email-OTP sign-in flow shared by /login and /register (AGENTS.md §7).
 *
 * The two screens differ in what they say and in whether they may create an
 * account; the steps between typing an address and landing on a page are the
 * same, so they live here once. What stays with each screen is everything a
 * reader sees — copy, the cross-link, /register's name field — plus the
 * `signInWithOtp` options, because `shouldCreateUser` is the one decision that
 * makes the two screens genuinely different.
 *
 * Nothing here is wrapped in `useCallback`: the returned functions are rebuilt
 * on every render and therefore always read the caller's current
 * `signInOptions`, which is what lets /register put live form state in them.
 */

/** Deliberately loose. The address is proved by whether the code arrives; this
 * only catches the typo worth catching before a network round trip. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * The `signInWithOtp` options each screen owns.
 *
 * `shouldCreateUser` is required rather than optional so neither screen can
 * leave it out and inherit Supabase's default, which creates accounts.
 */
export type EmailOtpSignInOptions = {
  shouldCreateUser: boolean;
  /** User metadata, applied by Supabase only when it creates the account. */
  data?: Record<string, unknown>;
};

type UseEmailOtpConfig = {
  /** Picks which copy `describeSendError` uses for a failure to mail a code. */
  mode: 'login' | 'register';
  signInOptions: EmailOtpSignInOptions;
};

export type UseEmailOtp = {
  step: 'email' | 'code';
  email: string;
  setEmail: (value: string) => void;
  code: string;
  setCode: (value: string) => void;
  pending: boolean;
  error: AuthErrorMessage | null;
  /** Exposed so a screen can report its own validation — /register's name. */
  setError: (message: AuthErrorMessage | null) => void;
  /** Seconds left before another code may be requested; 0 when it may. */
  cooldown: number;
  /**
   * Validates the address, mails a code, and advances to the code step.
   *
   * `onValidated` runs after the address is accepted and before the code is
   * requested — the point where a screen may normalise its own fields, which
   * an invalid address must leave untouched.
   */
  submitEmail: (onValidated?: () => void) => Promise<void>;
  /** Verifies the typed code, reads the profile, and redirects. */
  verify: () => Promise<void>;
  resend: () => void;
  /** Back to the first step, keeping what was typed there. */
  editEmail: () => void;
};

export function useEmailOtp({
  mode,
  signInOptions,
}: UseEmailOtpConfig): UseEmailOtp {
  const router = useRouter();

  // One route, two steps. A second route for the code would lose the email on
  // reload and give the back button a meaning nobody wants here.
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AuthErrorMessage | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }

    const timer = window.setTimeout(
      () => setCooldown((seconds) => seconds - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  /** Asks Supabase to mail a code. Returns whether it went out. */
  async function sendCode(address: string): Promise<boolean> {
    setPending(true);
    setError(null);

    try {
      // Called here, from an event handler — never during render. The client is
      // built on first call and the build has no Supabase variables at all.
      const supabase = getSupabaseBrowserClient();

      const { error: sendError } = await supabase.auth.signInWithOtp({
        email: address,
        options: signInOptions,
      });

      if (sendError) {
        setError(describeSendError(sendError, mode));
        return false;
      }

      setCooldown(RESEND_COOLDOWN_SECONDS);
      return true;
    } catch (cause) {
      setError(describeUnexpectedSendError(cause));
      return false;
    } finally {
      setPending(false);
    }
  }

  async function submitEmail(onValidated?: () => void): Promise<void> {
    const address = email.trim();
    if (!EMAIL_PATTERN.test(address)) {
      setError(INVALID_EMAIL_MESSAGE);
      return;
    }

    setEmail(address);
    onValidated?.();
    if (await sendCode(address)) {
      setCode('');
      setStep('code');
    }
  }

  async function verify(): Promise<void> {
    if (code.length !== OTP_LENGTH) {
      setError(incompleteCodeMessage(OTP_LENGTH));
      return;
    }

    setPending(true);
    setError(null);

    let supabase: ReturnType<typeof getSupabaseBrowserClient>;
    try {
      supabase = getSupabaseBrowserClient();
    } catch (cause) {
      setError(describeUnexpectedSendError(cause));
      setPending(false);
      return;
    }

    // Verifying the code and reading the profile are separated so each failure
    // gets its own message. Once the code is accepted, telling someone the code
    // was wrong would send them back to retype one that was correct.
    let accessToken: string;
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        // 'email' for both a first sign-in and a returning one. The 'signup'
        // and 'magiclink' types are deprecated, and Supabase picks the mail
        // template from the account's state rather than from this (§A3.1).
        type: 'email',
      });

      if (verifyError || !data.session) {
        setError(describeVerifyError(verifyError));
        setCode('');
        setPending(false);
        return;
      }

      accessToken = data.session.access_token;
    } catch {
      setError(describeVerifyError(null));
      setPending(false);
      return;
    }

    try {
      // First authenticated call provisions the `app_user` row (AGENTS.md §7).
      // Role comes from our database, never from the token.
      const me = await getMe(accessToken);

      if (me.isBlacklisted) {
        // Reachable from either screen, because an address that already has an
        // account is signed in rather than rejected. Signed out rather than
        // left holding a valid session: the account is suspended, so it should
        // not be able to call anything else meanwhile. The reason is
        // admin-facing and is never shown here (§14.5).
        await supabase.auth.signOut();
        setError(BLACKLISTED_MESSAGE);
        setCode('');
        setPending(false);
        return;
      }

      // `pending` stays true so the button remains disabled while the router
      // navigates away.
      router.replace(
        me.role === 'ORG_ADMIN' || me.role === 'SUPER_ADMIN'
          ? '/admin/bookings'
          : '/',
      );
    } catch (cause) {
      setError(describeProfileError(cause));
      setPending(false);
    }
  }

  function resend(): void {
    void sendCode(email);
  }

  function editEmail(): void {
    setStep('email');
    setCode('');
    setError(null);
  }

  return {
    step,
    email,
    setEmail,
    code,
    setCode,
    pending,
    error,
    setError,
    cooldown,
    submitEmail,
    verify,
    resend,
    editEmail,
  };
}
