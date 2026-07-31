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

export default function RegisterPage() {
  const router = useRouter();

  const [step, setStep] = useState<'form' | 'code'>('form');
  const [fullName, setFullName] = useState('');
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

  /** Asks Supabase to mail a code, creating the account if it does not exist.
   * Returns whether it went out. */
  async function sendCode(address: string, name: string): Promise<boolean> {
    setPending(true);
    setError(null);

    try {
      // Called from an event handler, never during render — the client is built
      // on first call and the build has no Supabase variables at all.
      const supabase = getSupabaseBrowserClient();

      const { error: sendError } = await supabase.auth.signInWithOtp({
        email: address,
        options: {
          data: { full_name: name },
          // Account creation happens here and nowhere else. Supabase applies
          // `data` only when it creates the user, so /login sends
          // shouldCreateUser: false to keep this the only door in (§A3.4).
          shouldCreateUser: true,
        },
      });
      // TODO(SCRUM-54): backend ignores user_metadata.full_name — see PART E-1

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

  async function handleDetailsSubmit(event: FormEvent) {
    event.preventDefault();

    const name = fullName.trim();
    if (name.length === 0) {
      setError('กรอกชื่อ-นามสกุลของคุณ');
      return;
    }

    const address = email.trim();
    if (!EMAIL_PATTERN.test(address)) {
      setError('รูปแบบอีเมลไม่ถูกต้อง กรุณากรอกใหม่ เช่น name@example.com');
      return;
    }

    setFullName(name);
    setEmail(address);
    if (await sendCode(address, name)) {
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
        // 'email' for a first sign-in and a returning one alike; 'signup' and
        // 'magiclink' are deprecated and Supabase picks the mail template from
        // the account's state rather than from this (§A3.1).
        type: 'email',
      });

      if (verifyError || !data.session) {
        setError('รหัสยืนยันไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอรหัสใหม่');
        setCode('');
        setPending(false);
        return;
      }

      // First authenticated call provisions the `app_user` row (AGENTS.md §7).
      // Role comes from our database, never from the token.
      const me = await getMe(data.session.access_token);

      if (me.isBlacklisted) {
        // Reachable because an address that already has an account is signed in
        // here rather than rejected. The reason is admin-facing (§14.5).
        await supabase.auth.signOut();
        setError(
          'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลองค์กรที่คุณจองบูธไว้',
        );
        setCode('');
        setPending(false);
        return;
      }

      // Every role lands on Discovery, as on /login. `pending` stays true so
      // the button remains disabled while the router navigates away.
      router.replace('/');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : GENERIC_ERROR);
      setPending(false);
    }
  }

  const errorId = 'register-error';
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
    <AuthLayout
      eyebrow="สมัครใช้งานฟรี"
      headline="เปิดร้านในงานถัดไป เริ่มจากบัญชีเดียว"
      description="สร้างบัญชีด้วยอีเมล ไม่ต้องตั้งรหัสผ่าน แล้วเริ่มมองหาบูธที่ใช่ได้ทันที"
    >
      {step === 'form' ? (
        <form onSubmit={handleDetailsSubmit} noValidate>
          <h1 className="text-[32px] font-black tracking-[-0.04em]">
            สร้างบัญชีใหม่
          </h1>
          <p className="mt-3 leading-7 text-muted">
            กรอกชื่อและอีเมล เราจะส่งรหัสยืนยัน {OTP_LENGTH} หลักไปให้
          </p>

          <label
            htmlFor="fullName"
            className="mt-8 block text-sm font-bold text-ink"
          >
            ชื่อ-นามสกุล
          </label>
          <input
            id="fullName"
            type="text"
            name="fullName"
            autoComplete="name"
            placeholder="เช่น สมชาย ใจดี"
            value={fullName}
            disabled={pending}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => setFullName(event.target.value)}
            className="mt-2 h-[52px] w-full rounded-2xl border border-line bg-white px-4 text-ink transition-colors placeholder:text-muted/70 focus:border-violet disabled:bg-mist disabled:text-muted"
          />

          <label
            htmlFor="email"
            className="mt-5 block text-sm font-bold text-ink"
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
            มีบัญชีอยู่แล้ว?{' '}
            <Link
              href="/login"
              className="font-bold text-violet underline-offset-4 hover:underline"
            >
              เข้าสู่ระบบ
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
            กรอกรหัสเพื่อสร้างบัญชี
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
            {pending ? 'กำลังสร้างบัญชี…' : 'สร้างบัญชี'}
          </button>

          <div className="mt-7 flex flex-col items-center gap-3 text-sm">
            <button
              type="button"
              disabled={pending || cooldown > 0}
              onClick={() => void sendCode(email, fullName)}
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
                // Name and email are kept, so coming back is not a retype.
                setStep('form');
                setCode('');
                setError(null);
              }}
              className="text-muted underline-offset-4 hover:underline"
            >
              แก้ไขชื่อหรืออีเมล
            </button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}

/**
 * Turns a Supabase auth error into copy that says what happened and what to do
 * next. There is no "this address already exists" case to handle: with
 * `shouldCreateUser: true` Supabase mails a code to a known address instead of
 * refusing it, so that path signs the person in rather than failing.
 */
function describeSendError(error: {
  code?: string;
  message: string;
}): ReactNode {
  if (
    error.code === 'signup_disabled' ||
    /signups? not allowed/i.test(error.message)
  ) {
    return (
      <>
        ตอนนี้ระบบปิดรับสมัครสมาชิกใหม่ชั่วคราว หากคุณมีบัญชีอยู่แล้ว{' '}
        <Link
          href="/login"
          className="font-bold underline underline-offset-2"
        >
          เข้าสู่ระบบที่นี่
        </Link>
      </>
    );
  }

  if (error.code === 'over_email_send_rate_limit') {
    return 'ขอรหัสยืนยันบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง';
  }

  return 'ส่งรหัสยืนยันไม่สำเร็จ กรุณาตรวจสอบอีเมลแล้วลองใหม่อีกครั้ง';
}
