'use client';

import Link from 'next/link';
import { AuthLayout } from '@/components/auth-layout';
import { OTP_LENGTH, OtpInput } from '@/components/otp-input';
import { useEmailOtp } from '@/lib/use-email-otp';

export default function LoginPage() {
  const {
    step,
    email,
    setEmail,
    code,
    setCode,
    pending,
    error,
    cooldown,
    submitEmail,
    verify,
    resend,
    editEmail,
  } = useEmailOtp({
    mode: 'login',
    signInOptions: {
      // No account is ever created from this screen. Supabase applies user
      // metadata only at creation time, so an account born here would lose the
      // name /register collects — permanently (AGENTS.md §7, §A3.4).
      shouldCreateUser: false,
    },
  });

  const errorId = 'login-error';
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
      eyebrow="สำหรับผู้ขายและผู้ดูแลองค์กร"
      headline="จองบูธในงานที่ใช่ ได้ในไม่กี่ขั้นตอน"
      description="เข้าสู่ระบบด้วยอีเมล เราจะส่งรหัสยืนยัน 6 หลักไปให้ ไม่ต้องตั้งและไม่ต้องจำรหัสผ่าน"
    >
      {step === 'email' ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submitEmail();
          }}
          noValidate
        >
          <span className="sl-kicker">Welcome back</span>
          <h1 className="mt-2 text-[32px] font-black tracking-[-0.04em]">
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
            className="mt-2 h-[54px] w-full rounded-2xl border border-line bg-[#fcfbfe] px-4 text-base text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition-colors placeholder:text-muted/70 focus:border-violet focus:bg-white disabled:bg-mist disabled:text-muted"
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
            className="sl-action-primary mt-7 h-[52px] w-full text-base disabled:opacity-55"
          >
            {pending ? 'กำลังตรวจสอบ…' : 'เข้าสู่ระบบ'}
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
              // The email is kept, so coming back does not mean retyping it.
              onClick={editEmail}
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
