'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { AuthLayout } from '@/components/auth-layout';
import { OTP_LENGTH, OtpInput } from '@/components/otp-input';
import { MISSING_NAME_MESSAGE } from '@/lib/auth-errors';
import { useEmailOtp } from '@/lib/use-email-otp';

export default function RegisterPage() {
  // Stays on the page: this screen is the only one that collects a name, and
  // the flow itself has no use for it beyond handing it to Supabase below.
  const [fullName, setFullName] = useState('');

  const {
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
  } = useEmailOtp({
    mode: 'register',
    signInOptions: {
      data: { full_name: fullName.trim() },
      // Account creation happens here and nowhere else. Supabase applies
      // `data` only when it creates the user, so /login sends
      // shouldCreateUser: false to keep this the only door in (§A3.4).
      shouldCreateUser: true,
      // TODO(SCRUM-54): backend ignores user_metadata.full_name — see PART E-1
    },
  });

  async function handleDetailsSubmit(event: FormEvent) {
    event.preventDefault();

    // Checked before the address, so the first thing missing is the first thing
    // reported. The hook validates the address itself.
    const name = fullName.trim();
    if (name.length === 0) {
      setError(MISSING_NAME_MESSAGE);
      return;
    }

    // Normalising the name is deferred to the hook's callback so that it, like
    // the address, happens only once the address is known to be valid.
    await submitEmail(() => setFullName(name));
  }

  const errorId = 'register-error';
  const errorBox = error ? (
    <p
      id={errorId}
      role="alert"
      className="mt-4 rounded-2xl bg-danger/[0.06] px-4 py-3 text-sm font-semibold leading-6 text-danger"
    >
      {error.text}
      {error.link ? (
        <>
          {' '}
          <Link
            href={error.link.href}
            className="font-bold underline underline-offset-2"
          >
            {error.link.label}
          </Link>
        </>
      ) : null}
    </p>
  ) : null;

  return (
    <AuthLayout
      eyebrow="สมัครใช้งานฟรี"
      headline="เปิดร้านในงานถัดไป เริ่มจากบัญชีเดียว"
      description="สร้างบัญชีด้วยอีเมล ไม่ต้องตั้งรหัสผ่าน แล้วเริ่มมองหาบูธที่ใช่ได้ทันที"
    >
      {step === 'email' ? (
        <form onSubmit={handleDetailsSubmit} noValidate>
          <span className="sl-kicker">Create your space</span>
          <h1 className="mt-2 text-[32px] font-black tracking-[-0.04em]">
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
            className="mt-2 h-[54px] w-full rounded-2xl border border-line bg-[#fcfbfe] px-4 text-ink transition-colors placeholder:text-muted/70 focus:border-violet focus:bg-white disabled:bg-mist disabled:text-muted"
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
            className="mt-2 h-[54px] w-full rounded-2xl border border-line bg-[#fcfbfe] px-4 text-ink transition-colors placeholder:text-muted/70 focus:border-violet focus:bg-white disabled:bg-mist disabled:text-muted"
          />

          {errorBox}

          <button
            type="submit"
            disabled={pending}
            className="sl-action-primary mt-7 h-[52px] w-full text-base disabled:opacity-55"
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
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void verify();
          }}
          noValidate
        >
          <span className="sl-kicker">Secure verification</span>
          <h1 className="mt-2 text-[32px] font-black tracking-[-0.04em]">
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
            className="sl-action-primary mt-7 h-[52px] w-full text-base disabled:opacity-55"
          >
            {pending ? 'กำลังสร้างบัญชี…' : 'สร้างบัญชี'}
          </button>

          <div className="mt-7 flex flex-col items-center gap-3 text-sm">
            <button
              type="button"
              disabled={pending || cooldown > 0}
              onClick={resend}
              className="font-bold text-violet underline-offset-4 hover:underline disabled:text-muted disabled:no-underline"
            >
              {cooldown > 0
                ? `ขอรหัสใหม่ได้ในอีก ${cooldown} วินาที`
                : 'ส่งรหัสอีกครั้ง'}
            </button>

            <button
              type="button"
              disabled={pending}
              // Name and email are kept, so coming back is not a retype.
              onClick={editEmail}
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
