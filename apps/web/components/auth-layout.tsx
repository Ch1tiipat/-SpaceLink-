'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ChartNoAxesColumnIncreasing, Clock3, Hand, LockKeyhole, Mail, Search, Settings, ShieldCheck, Sparkles, Store, Zap } from 'lucide-react';
import { OTP_LENGTH, OtpInput } from './otp-input';
import type { AuthErrorMessage } from '@/lib/auth-errors';
import type { UseEmailOtp } from '@/lib/use-email-otp';
import styles from './auth-layout.module.css';

type AuthLayoutProps = {
  mode: 'login' | 'register';
  step: 'email' | 'code';
  email: string;
  pending: boolean;
  onEditEmail: () => void;
  children?: ReactNode;
};

/** Presentation only. Real verification and redirects remain in useEmailOtp. */
export function AuthLayout({ mode, step, email, pending, onEditEmail, children }: AuthLayoutProps) {
  const isOtp = step === 'code';
  const isRegister = mode === 'register';
  const title = isOtp ? 'กรอกรหัส OTP' : isRegister ? 'สร้างบัญชี' : 'เข้าสู่ระบบ';
  const BadgeIcon = isOtp ? ShieldCheck : isRegister ? Sparkles : Hand;
  const benefits = isOtp ? [
    { Icon: ShieldCheck, title: 'ปลอดภัย', detail: 'ปกป้องข้อมูลของคุณ' },
    { Icon: Settings, title: 'ใช้งานง่าย', detail: 'ไม่ยุ่งยาก ซับซ้อน' },
    { Icon: Zap, title: 'ยืนยันรวดเร็ว', detail: 'เข้าใช้งานได้ทันที' },
  ] : [
    { Icon: Search, title: 'ค้นหางานและจองบูธ', detail: 'เจอพื้นที่ที่ใช่สำหรับคุณ' },
    { Icon: Store, title: 'จัดการบูธได้ง่าย', detail: 'ทุกอย่างในที่เดียว' },
    { Icon: ChartNoAxesColumnIncreasing, title: 'ติดตามสถานะแบบเรียลไทม์', detail: 'อัปเดตทุกความเคลื่อนไหว' },
  ];
  return (
    <main className={styles.root} data-auth-screen={isOtp ? 'otp' : mode}>
      <div className={styles.layout}>
        <div className={styles.left}>
          <div className={styles.intro}>
            <ReferencePhoto mobile />
            {isOtp ? <button type="button" className={styles.mobileBack} disabled={pending} aria-label="กลับไปแก้ไขอีเมล" onClick={onEditEmail}><ArrowLeft aria-hidden /></button>
              : <span className={styles.sticker} aria-hidden>พื้นที่ดี<br />เริ่มได้ที่นี่</span>}
            <Link href="/" className={styles.brand} aria-label="SpaceLink กลับหน้าแรก">
              <span className={styles.logo}><Image src="/brand/auth-mark.png" alt="" width={132} height={132} sizes="132px" priority /></span>
              <span>Space<span>Link</span></span>
            </Link>
            <span className={styles.badge}><BadgeIcon aria-hidden />{isOtp ? 'ยืนยันอีเมล' : isRegister ? 'เริ่มต้นใช้งานกับเรา' : 'ยินดีต้อนรับกลับ'}</span>
            <h1 className={isRegister || isOtp ? styles.purpleTitle : undefined}>
              <span className={styles.desktopTitle}>{title}</span>
              <span className={styles.mobileTitle}>{isOtp ? title : isRegister ? 'สมัครสมาชิก' : 'ยินดีต้อนรับกลับ'}</span>
            </h1>
            <p className={styles.desktopDescription}>
              {isOtp ? <>เราได้ส่งรหัสยืนยัน {OTP_LENGTH} หลัก ไปยังอีเมลของคุณแล้ว<span className={styles.email}>{email}</span></>
                : isRegister ? 'สมัครสมาชิกเพื่อเริ่มจองบูธ และเข้าถึงทุกโอกาสในงานอีเวนต์และตลาดต่าง ๆ'
                  : 'เข้าสู่ SpaceLink เพื่อจัดการการจองบูธและใช้งานทุกฟีเจอร์ได้อย่างครบถ้วน'}
            </p>
            <p className={styles.mobileDescription}>
              {isOtp ? <>เราได้ส่งรหัสยืนยัน {OTP_LENGTH} หลักไปยังอีเมลของคุณ<span className={styles.email}>{email}</span></>
                : isRegister ? 'เริ่มต้นจองพื้นที่ร้านค้าไปกับ SpaceLink'
                  : <>จัดการการจองพื้นที่ร้านของคุณ<br />ได้ง่ายขึ้น ที่ SpaceLink</>}
            </p>
          </div>
          <div className={styles.card}>
            {children}
            <div className={styles.benefits}>
              {benefits.map(({ Icon, title: benefitTitle, detail }) => <div className={styles.benefit} key={benefitTitle}>
                <span className={styles.benefitIcon}><Icon aria-hidden /></span><strong>{benefitTitle}</strong><p>{detail}</p>
              </div>)}
            </div>
          </div>
          <MobileFooter />
        </div>
        <ReferencePhoto />
      </div>
    </main>
  );
}

export function AuthEmailField({ value, disabled, invalid, describedBy, onChange }: {
  value: string; disabled: boolean; invalid?: boolean; describedBy?: string; onChange: (value: string) => void;
}) {
  return <>
    <label className={styles.label} htmlFor="email">อีเมล</label>
    <div className={styles.field}><Mail aria-hidden /><input id="email" name="email" type="email" autoComplete="email" inputMode="email"
      placeholder="name@example.com" value={value} disabled={disabled} aria-invalid={invalid || undefined}
      aria-describedby={describedBy} onChange={(event) => onChange(event.target.value)} /></div>
  </>;
}

export function AuthErrorBox({ error, id }: { error: AuthErrorMessage | null; id: string }) {
  return error ? <p id={id} role="alert" className={styles.error}>{error.text}
    {error.link ? <> <Link href={error.link.href}>{error.link.label}</Link></> : null}
  </p> : null;
}

export function AuthOtpForm({ flow, errorId }: { flow: UseEmailOtp; errorId: string }) {
  return (
    <form onSubmit={(event) => { event.preventDefault(); void flow.verify(); }} noValidate aria-busy={flow.pending}>
      <div className={styles.otp}>
        <OtpInput value={flow.code} onChange={flow.setCode} disabled={flow.pending} invalid={Boolean(flow.error)}
          describedBy={flow.error ? errorId : 'auth-otp-help'} autoFocus />
      </div>
      {/* Supabase owns expiry; no simulated five-minute deadline in production. */}
      <p id="auth-otp-help" className={styles.otpTime}><Clock3 aria-hidden />กรอกรหัสยืนยัน {OTP_LENGTH} หลักจากอีเมล</p>
      <AuthErrorBox error={flow.error} id={errorId} />
      <button type="submit" className={styles.action} disabled={flow.pending || flow.code.length !== OTP_LENGTH}>
        {flow.pending ? 'กำลังตรวจสอบ…' : 'ยืนยันรหัส'}<ArrowRight aria-hidden />
      </button>
      <div className={styles.secondary}>
        <button className={styles.resend} type="button" disabled={flow.pending || flow.cooldown > 0} onClick={flow.resend}>
          {flow.cooldown > 0 ? `ส่งรหัสอีกครั้ง (${flow.cooldown}s)` : 'ส่งรหัสอีกครั้ง'}
        </button>
        <span aria-hidden>|</span><button type="button" className={styles.changeEmail} disabled={flow.pending} onClick={flow.editEmail}>เปลี่ยนอีเมล</button>
      </div>
      <div className={styles.divider}>หรือ</div>
      <p className={styles.helper}>หากไม่ได้รับรหัส โปรดตรวจสอบอีเมลขยะหรือรอสักครู่</p>
      <p className={styles.security}><LockKeyhole aria-hidden />ข้อมูลของคุณปลอดภัย</p>
    </form>
  );
}

function ReferencePhoto({ mobile = false }: { mobile?: boolean }) {
  return <div className={`${styles.photo} ${mobile ? styles.mobilePhoto : styles.desktopPhoto}`} aria-hidden="true">
    <Image src="/auth-market-photo.png" alt="" width={1701} height={925} unoptimized priority />
  </div>;
}

function MobileFooter() {
  return <div className={styles.mobileFooter} aria-hidden="true">
    <span className={styles.tagline}>More Space More Opportunities</span>
    <svg className={styles.skyline} viewBox="0 0 480 100" preserveAspectRatio="none">
      <path fill="currentColor" opacity=".38" d="M0 74h18V48h18v26h14V60h30v14h15V38h21v36h18V51h18v23h17V31h20v43h16V61h25v13h20V44h23v30h23V57h15v17h20V36h24v38h16V49h23v25h21V62h25v12h40v26H0z" />
      <path fill="currentColor" opacity=".6" d="M0 49c12-22 28-18 32-3 16-4 29 11 23 24l16 30H0zm480-9c-18-18-34-10-35 7-18-3-27 10-23 24l-15 29h73zM87 74l42-26 42 26zm202 9l38-25 38 25z" />
      <path fill="currentColor" opacity=".45" d="M97 75h64v25H97zm201 9h59v16h-59z" />
      <path stroke="currentColor" fill="none" strokeWidth="2" d="M31 69Q240 104 449 61M93 75v25m72-25v25m130-16v16m67-16v16" />
      <path fill="#fff1bd" d="M70 78h4v4h-4zm47 7h4v4h-4zm52 5h4v4h-4zm52 0h4v4h-4zm54-2h4v4h-4zm51-5h4v4h-4zm52-7h4v4h-4zm43-6h4v4h-4z" />
    </svg>
  </div>;
}
