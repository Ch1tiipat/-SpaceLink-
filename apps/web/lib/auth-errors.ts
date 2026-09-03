import { ApiError } from './api';

/**
 * Error copy for the authentication screens, kept in one place so /login and
 * /register cannot drift apart.
 *
 * Every message names what happened and what to do next. There is deliberately
 * no "something went wrong" fallback: an unexpected failure still gets copy
 * scoped to the action the person was taking, because "try again" is only
 * useful advice when the reader knows what to try again.
 *
 * Returned as data rather than JSX so this stays a plain .ts module; the pages
 * render `link` themselves.
 */
export type AuthErrorMessage = {
  text: string;
  link?: { href: string; label: string };
};

/** The shape of a Supabase `AuthError` we actually read. */
type SupabaseAuthErrorLike = {
  code?: string;
  message: string;
};

export const INVALID_EMAIL_MESSAGE: AuthErrorMessage = {
  text: 'รูปแบบอีเมลไม่ถูกต้อง ต้องมีเครื่องหมาย @ และชื่อโดเมน เช่น name@example.com',
};

export const MISSING_NAME_MESSAGE: AuthErrorMessage = {
  text: 'กรอกชื่อ-นามสกุลของคุณก่อน เราใช้ชื่อนี้แสดงในระบบ',
};

export function incompleteCodeMessage(length: number): AuthErrorMessage {
  return {
    text: `กรอกรหัสยืนยันให้ครบ ${length} หลัก ตรวจสอบตัวเลขในอีเมลอีกครั้ง`,
  };
}

/**
 * A suspended account is told that it is suspended and nothing else. The
 * reason and the penalty history are admin-facing (AGENTS.md §14.5).
 */
export const BLACKLISTED_MESSAGE: AuthErrorMessage = {
  text: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลองค์กรที่คุณจองบูธไว้',
};

/**
 * Failure to mail a code. `mode` differs on one case only: the branch below,
 * which is reachable on /login and not on /register.
 *
 * That branch does **not** say the address has no account (SCRUM-152). Supabase
 * answers a /login send with `otp_disabled` / "Signups not allowed for otp" for
 * an account that demonstrably exists and has signed in before, so the old copy
 * told a returning vendor they had never registered. The cause of the mismatch
 * is not established, so the copy names neither cause: it says the code did not
 * go out and offers both ways forward — register if new, retry if not.
 */
export function describeSendError(
  error: SupabaseAuthErrorLike,
  mode: 'login' | 'register',
): AuthErrorMessage {
  if (
    mode === 'login' &&
    (error.code === 'otp_disabled' ||
      error.code === 'user_not_found' ||
      /signups? not allowed/i.test(error.message))
  ) {
    return {
      text: 'ส่งรหัสยืนยันไม่สำเร็จ ถ้ายังไม่เคยสมัครสมาชิกกด "สร้างบัญชีใหม่" ด้านล่าง หรือถ้าเคยสมัครแล้วลองกดส่งรหัสอีกครั้งในอีกสักครู่',
      link: { href: '/register', label: 'สร้างบัญชีใหม่' },
    };
  }

  if (mode === 'register' && error.code === 'signup_disabled') {
    return {
      text: 'ตอนนี้ระบบปิดรับสมัครสมาชิกใหม่ชั่วคราว หากคุณมีบัญชีอยู่แล้ว',
      link: { href: '/login', label: 'เข้าสู่ระบบที่นี่' },
    };
  }

  if (
    error.code === 'over_email_send_rate_limit' ||
    error.code === 'over_request_rate_limit'
  ) {
    return {
      text: 'ขอรหัสยืนยันถี่เกินไป รอประมาณ 1 นาทีแล้วกดส่งรหัสอีกครั้ง',
    };
  }

  if (error.code === 'email_address_invalid') {
    return {
      text: 'ระบบไม่รับอีเมลนี้ ตรวจสอบตัวสะกดหรือลองใช้อีเมลอื่น',
    };
  }

  return {
    text: 'ส่งรหัสยืนยันไม่สำเร็จ ตรวจสอบอีเมลอีกครั้งแล้วกดส่งรหัสใหม่',
  };
}

/**
 * Failure to verify a typed code.
 *
 * Wrong and expired are separate messages because the reader does different
 * things about them — retype, versus ask for a new code. Supabase reports the
 * two with distinct codes (`invalid_credentials` vs `otp_expired`), though its
 * message text for `otp_expired` reads "Token has expired or is invalid", so a
 * wrong code arriving late may still be reported as expired. That errs toward
 * telling someone to request a new code, which works either way.
 */
export function describeVerifyError(
  error: SupabaseAuthErrorLike | null,
): AuthErrorMessage {
  if (error?.code === 'otp_expired') {
    return {
      text: 'รหัสยืนยันหมดอายุแล้ว กดปุ่มส่งรหัสอีกครั้งเพื่อรับรหัสใหม่',
    };
  }

  if (
    error?.code === 'invalid_credentials' ||
    error?.code === 'validation_failed'
  ) {
    return {
      text: 'รหัสยืนยันไม่ถูกต้อง ตรวจสอบตัวเลข 6 หลักในอีเมลแล้วกรอกใหม่',
    };
  }

  // Includes the case where Supabase reports no error but returns no session,
  // which is not something the reader can act on differently.
  return {
    text: 'ยืนยันรหัสไม่สำเร็จ ตรวจสอบตัวเลข 6 หลักในอีเมลแล้วกรอกใหม่ หรือกดส่งรหัสอีกครั้ง',
  };
}

/**
 * Failure of `GET /auth/me` after the code was already accepted.
 *
 * This is its own case because the sign-in itself worked: saying "wrong code"
 * here would send someone back to retype a code that was correct. The API runs
 * on a free Render instance that sleeps, so the first request after an idle
 * period can take tens of seconds or time out outright — the common cause by
 * far, and the one the copy names.
 */
export function describeProfileError(cause: unknown): AuthErrorMessage {
  if (cause instanceof ApiError) {
    // status 0 is `lib/api.ts` reporting that the request never completed.
    if (cause.status === 0) {
      return {
        text: 'ยืนยันรหัสสำเร็จแล้ว แต่ยังเชื่อมต่อเซิร์ฟเวอร์ SpaceLink ไม่ได้ เซิร์ฟเวอร์อาจกำลังเริ่มทำงาน รอสักครู่แล้วกดปุ่มอีกครั้ง',
      };
    }

    if (cause.status === 401 || cause.status === 403) {
      return {
        text: 'เซิร์ฟเวอร์ไม่รับรองการเข้าสู่ระบบนี้ กดส่งรหัสอีกครั้งแล้วยืนยันใหม่',
      };
    }

    return {
      text: 'ยืนยันรหัสสำเร็จแล้ว แต่โหลดข้อมูลบัญชีไม่สำเร็จ รอสักครู่แล้วกดปุ่มอีกครั้ง',
    };
  }

  return {
    text: 'ยืนยันรหัสสำเร็จแล้ว แต่โหลดข้อมูลบัญชีไม่สำเร็จ รอสักครู่แล้วกดปุ่มอีกครั้ง',
  };
}

/** An exception thrown before the request left the browser — in practice the
 * missing-environment-variable error, whose message is already specific. */
export function describeUnexpectedSendError(cause: unknown): AuthErrorMessage {
  if (cause instanceof Error && cause.message.length > 0) {
    return { text: cause.message };
  }

  return { text: 'ส่งรหัสยืนยันไม่สำเร็จ ตรวจสอบอีเมลอีกครั้งแล้วกดส่งรหัสใหม่' };
}
