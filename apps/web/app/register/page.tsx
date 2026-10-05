'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { ArrowRight, UserRound } from 'lucide-react';
import { AuthLayout, AuthEmailField, AuthErrorBox, AuthOtpForm } from '@/components/auth-layout';
import styles from '@/components/auth-layout.module.css';
import { INVALID_EMAIL_MESSAGE, MISSING_NAME_MESSAGE } from '@/lib/auth-errors';
import { useEmailOtp } from '@/lib/use-email-otp';

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const flow = useEmailOtp({
    mode: 'register',
    signInOptions: {
      // Applied at account creation, never used for authorization.
      data: { full_name: fullName.trim() },
      shouldCreateUser: true,
    },
  });
  const errorId = 'register-error';
  async function handleDetailsSubmit(event: FormEvent) {
    event.preventDefault();
    const name = fullName.trim();
    if (!name) { flow.setError(MISSING_NAME_MESSAGE); return; }
    if (!acceptedTerms) { setTermsError(true); flow.setError(null); return; }
    setTermsError(false);
    await flow.submitEmail(() => setFullName(name));
  }
  return (
    <AuthLayout mode="register" step={flow.step} email={flow.email} pending={flow.pending} onEditEmail={flow.editEmail}>
      {flow.step === 'email' ? (
        <form onSubmit={handleDetailsSubmit} noValidate aria-busy={flow.pending}>
          <label htmlFor="fullName" className={styles.label}>ชื่อ-นามสกุล</label>
          <div className={styles.field}>
            <UserRound aria-hidden />
            <input id="fullName" name="fullName" type="text" autoComplete="name" placeholder="เช่น สมชาย ใจดี"
              value={fullName} disabled={flow.pending}
              aria-invalid={flow.error?.text === MISSING_NAME_MESSAGE.text || undefined}
              aria-describedby={flow.error?.text === MISSING_NAME_MESSAGE.text ? errorId : undefined}
              onChange={(event) => { setFullName(event.target.value); flow.setError(null); }} />
          </div>
          <div className={styles.nextField}>
            <AuthEmailField value={flow.email} disabled={flow.pending}
              invalid={flow.error?.text === INVALID_EMAIL_MESSAGE.text}
              describedBy={flow.error?.text === INVALID_EMAIL_MESSAGE.text ? errorId : undefined}
              onChange={(value) => { flow.setEmail(value); flow.setError(null); }} />
          </div>
          <AuthErrorBox error={flow.error} id={errorId} />
          <div className={styles.consent}>
            <input id="register-accept-terms" type="checkbox" checked={acceptedTerms} disabled={flow.pending}
              aria-invalid={termsError || undefined} aria-describedby={termsError ? 'register-terms-error' : undefined}
              onChange={(event) => { setAcceptedTerms(event.target.checked); if (event.target.checked) setTermsError(false); }} />
            <span><label htmlFor="register-accept-terms">ฉันยอมรับ</label>{' '}
              <Link href="/terms" target="_blank" rel="noopener noreferrer">ข้อกำหนดการใช้งาน</Link>{' '}และ{' '}
              <Link href="/privacy" target="_blank" rel="noopener noreferrer">นโยบายความเป็นส่วนตัว</Link>
            </span>
          </div>
          {termsError ? <p id="register-terms-error" role="alert" className={styles.error}>กรุณายอมรับเงื่อนไขการใช้งานก่อนสมัครสมาชิก</p> : null}
          <button type="submit" disabled={flow.pending} className={styles.action}>
            {flow.pending ? 'กำลังส่งรหัส…' : 'สร้างบัญชี'}<ArrowRight aria-hidden />
          </button>
          <div className={styles.divider}>หรือ</div>
          <p className={styles.account}>มีบัญชีอยู่แล้ว? <Link href="/login">เข้าสู่ระบบ<ArrowRight aria-hidden /></Link></p>
        </form>
      ) : <AuthOtpForm flow={flow} errorId={errorId} />}
    </AuthLayout>
  );
}
