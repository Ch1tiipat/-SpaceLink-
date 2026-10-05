'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AuthLayout, AuthEmailField, AuthErrorBox, AuthOtpForm } from '@/components/auth-layout';
import styles from '@/components/auth-layout.module.css';
import { INVALID_EMAIL_MESSAGE } from '@/lib/auth-errors';
import { useEmailOtp } from '@/lib/use-email-otp';

export default function LoginPage() {
  // Login never creates accounts; registration is the only creation path.
  const flow = useEmailOtp({ mode: 'login', signInOptions: { shouldCreateUser: false } });
  const errorId = 'login-error';
  return (
    <AuthLayout mode="login" step={flow.step} email={flow.email} pending={flow.pending} onEditEmail={flow.editEmail}>
      {flow.step === 'email' ? (
        <form onSubmit={(event) => { event.preventDefault(); void flow.submitEmail(); }} noValidate aria-busy={flow.pending}>
          <AuthEmailField value={flow.email} disabled={flow.pending}
            invalid={flow.error?.text === INVALID_EMAIL_MESSAGE.text}
            describedBy={flow.error?.text === INVALID_EMAIL_MESSAGE.text ? errorId : undefined}
            onChange={(value) => { flow.setEmail(value); flow.setError(null); }} />
          <AuthErrorBox error={flow.error} id={errorId} />
          <button type="submit" disabled={flow.pending} className={styles.action}>
            {flow.pending ? 'กำลังส่งรหัส…' : 'เข้าสู่ระบบ'}<ArrowRight aria-hidden />
          </button>
          <div className={styles.divider}>หรือ</div>
          <p className={styles.account}>ยังไม่มีบัญชี? <Link href="/register">สมัครใช้งาน</Link></p>
        </form>
      ) : <AuthOtpForm flow={flow} errorId={errorId} />}
    </AuthLayout>
  );
}
