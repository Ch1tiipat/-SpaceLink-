'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { AuthLayout } from '@/components/auth-layout';
import { OTP_LENGTH, OtpInput } from '@/components/otp-input';
import { ApiError, getMe } from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabase';

/** Deliberately loose. The address is proved by whether the code arrives; this
 * only catches the typo worth catching before a network round trip. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RESEND_COOLDOWN_SECONDS = 60;

const GENERIC_ERROR = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';

export default function LoginPage() {
  const router = useRouter();

  // One route, two steps. A second route for the code would lose the email on
  // reload and give the back button a meaning nobody wants here.
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ReactNode>(null);
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
      // Called here, in an event handler — never during render. The client is
      // built on first call and the build has no Supabase variables at all.
      const supabase = getSupabaseBrowserClient();

      const { error: sendError } = await supabase.auth.signInWithOtp({
        email: address,
        options: {
          // No account is ever created from this screen. Supabase applies user
          // metadata only at creation time, so an account born here would lose
          // the name /register collects — permanently (AGENTS.md §7, §A3.4).
          shouldCreateUser: false,
        },
      });

      if (sendError) {
        setError(describeSendError(sendError));
        return false;
      }

      setCooldown(RESEND_COOLDOWN_SECONDS);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : GENERIC_ERROR);
      return false;
    } finally {
      setPending(false);
    }
  }

  async function handleEmailSubmit(event: FormEvent) {
    event.preventDefault();

    const address = email.trim();
    if (!EMAIL_PATTERN.test(address)) {
      setError('รูปแบบอีเมลไม่ถูกต้อง กรุณากรอกใหม่ เช่น name@example.com');
      return;
    }

    setEmail(address);
    if (await sendCode(address)) {
      setCode('');
      setStep('code');
    }
  }

  async function handleVerify(event: FormEvent) {
    event.preventDefault();

    if (code.length !== OTP_LENGTH) {
      setError(`กรอกรหัสยืนยันให้ครบ ${OTP_LENGTH} หลัก`);
      return;
    }

    setPending(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        // 'email' for both a first sign-in and a returning one. The 'signup'
        // and 'magiclink' types are deprecated, and Supabase picks the mail
        // template from the account's state rather than from this (§A3.1).
        type: 'email',
      });

      if (verifyError || !data.session) {
        setError('รหัสยืนยันไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอรหัสใหม่');
        setCode('');
        setPending(false);
        return;
      }

      // Role comes from our database, never from the token (AGENTS.md §7).
      const me = await getMe(data.session.access_token);

      if (me.isBlacklisted) {
        // Signed out rather than left holding a valid session: the account is
        // suspended, so it should not be able to call anything else meanwhile.
        // The reason is admin-facing and is never shown here (§14.5).
        await supabase.auth.signOut();
        setError(
          'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลองค์กรที่คุณจองบูธไว้',
        );
        setCode('');
        setPending(false);
        return;
      }

      // VENDOR, ORG_ADMIN and SUPER_ADMIN all land on Discovery for now.
      // TODO(SCRUM-54): redirect admins to /admin once it exists
      //
      // `pending` stays true so the button remains disabled while the router
      // navigates away.
      router.replace('/');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : GENERIC_ERROR);
      setPending(false);
    }
  }

  const errorId = 'login-error';
  const errorBox = error ? (
    <p
      id={errorId}
      role="alert"
      className="mt-4 rounded-2xl bg-danger/[0.06] px-4 py-3 text-sm font-semibold leading-6 text-danger"
    >
      {error}
    </p>
  ) : null;

  return (
    <AuthLayout>
      {step === 'email' ? (
        <form onSubmit={handleEmailSubmit} noValidate>
          <h1 className="text-[32px] font-black tracking-[-0.04em]">
            เข้าสู่ระบบ
          </h1>
          <p className="mt-3 leading-7 text-muted">
            กรอกอีเมลที่ใช้สมัคร เราจะส่งรหัสยืนยัน {OTP_LENGTH} หลักไปให้
          </p>

          <label
            htmlFor="email"
            className="mt-8 block text-sm font-bold text-ink"
          >
            อีเมล
          </label>
          <input
            id="email"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            placeholder="name@example.com"
            value={email}
            disabled={pending}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 h-[52px] w-full rounded-2xl border border-line bg-white px-4 text-ink transition-colors placeholder:text-muted/70 focus:border-violet disabled:bg-mist disabled:text-muted"
          />

          {errorBox}

          <button
            type="submit"
            disabled={pending}
            className="mt-7 h-[52px] w-full rounded-full bg-violet text-base font-bold text-white shadow-lg shadow-violet/25 transition-opacity disabled:opacity-55"
          >
            {pending ? 'กำลังส่งรหัส…' : 'ส่งรหัสยืนยัน'}
          </button>

          <p className="mt-7 text-center text-sm text-muted">
            ยังไม่มีบัญชี?{' '}
            <Link
              href="/register"
              className="font-bold text-violet underline-offset-4 hover:underline"
            >
              สร้างบัญชีใหม่
            </Link>
          </p>
        </form>
      ) : (
        <form onSubmit={handleVerify} noValidate>
          <h1 className="text-[32px] font-black tracking-[-0.04em]">
            กรอกรหัสยืนยัน
          </h1>
          <p className="mt-3 leading-7 text-muted">
            เราส่งรหัส {OTP_LENGTH} หลักไปที่{' '}
            <span className="font-bold text-ink">{email}</span> แล้ว
            กรอกรหัสเพื่อเข้าสู่ระบบ
          </p>

          <div className="mt-8">
            <OtpInput
              value={code}
              onChange={setCode}
              disabled={pending}
              invalid={Boolean(error)}
              describedBy={error ? errorId : undefined}
              autoFocus
            />
          </div>

          {errorBox}

          <button
            type="submit"
            disabled={pending || code.length !== OTP_LENGTH}
            className="mt-7 h-[52px] w-full rounded-full bg-violet text-base font-bold text-white shadow-lg shadow-violet/25 transition-opacity disabled:opacity-55"
          >
            {pending ? 'กำลังตรวจสอบ…' : 'เข้าสู่ระบบ'}
          </button>

          <div className="mt-7 flex flex-col items-center gap-3 text-sm">
            <button
              type="button"
              disabled={pending || cooldown > 0}
              onClick={() => void sendCode(email)}
              className="font-bold text-violet underline-offset-4 hover:underline disabled:text-muted disabled:no-underline"
            >
              {cooldown > 0
                ? `ขอรหัสใหม่ได้ในอีก ${cooldown} วินาที`
                : 'ส่งรหัสอีกครั้ง'}
            </button>

            <button
              type="button"
              disabled={pending}
              onClick={() => {
                // The email is kept, so coming back does not mean retyping it.
                setStep('email');
                setCode('');
                setError(null);
              }}
              className="text-muted underline-offset-4 hover:underline"
            >
              ใช้อีเมลอื่น
            </button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}

/**
 * Turns a Supabase auth error into copy that says what happened and what to do
 * next. An unregistered address is the case worth naming: /login cannot create
 * an account (§A3.4), so Supabase rejects it and the only way forward is
 * /register.
 */
function describeSendError(error: {
  code?: string;
  message: string;
}): ReactNode {
  if (
    error.code === 'otp_disabled' ||
    /signups? not allowed/i.test(error.message)
  ) {
    return (
      <>
        อีเมลนี้ยังไม่ได้สมัครสมาชิก{' '}
        <Link
          href="/register"
          className="font-bold underline underline-offset-2"
        >
          สร้างบัญชีใหม่
        </Link>
      </>
    );
  }

  if (error.code === 'over_email_send_rate_limit') {
    return 'ขอรหัสยืนยันบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง';
  }

  return 'ส่งรหัสยืนยันไม่สำเร็จ กรุณาตรวจสอบอีเมลแล้วลองใหม่อีกครั้ง';
}
