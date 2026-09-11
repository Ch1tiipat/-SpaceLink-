export const OTP_LENGTH = 6;

export type OtpTransition = {
  value: string;
  focusIndex: number;
};

export function normalizeOtpValue(value: string): string {
  return value.replace(/\D/g, '').slice(0, OTP_LENGTH);
}

export function clampOtpFocus(index: number): number {
  return Math.max(0, Math.min(OTP_LENGTH - 1, index));
}

export function changeOtpValue(
  currentValue: string,
  index: number,
  rawValue: string,
): OtpTransition {
  const current = normalizeOtpValue(currentValue);
  const safeIndex = Math.max(
    0,
    Math.min(index, current.length, OTP_LENGTH - 1),
  );
  const typed = rawValue.replace(/\D/g, '');

  if (typed.length > 1) {
    const value = `${current.slice(0, safeIndex)}${typed}`.slice(0, OTP_LENGTH);
    return { value, focusIndex: clampOtpFocus(value.length) };
  }

  const digits = current.split('');

  if (!typed) {
    digits.splice(safeIndex, 1);
    return {
      value: digits.join(''),
      focusIndex: clampOtpFocus(safeIndex),
    };
  }

  digits[safeIndex] = typed;
  return {
    value: digits.join('').slice(0, OTP_LENGTH),
    focusIndex: clampOtpFocus(safeIndex + 1),
  };
}

export function backspaceOtpValue(
  currentValue: string,
  index: number,
): OtpTransition {
  const digits = normalizeOtpValue(currentValue).split('');
  const safeIndex = Math.max(
    0,
    Math.min(index, digits.length, OTP_LENGTH - 1),
  );

  if (digits[safeIndex]) {
    digits.splice(safeIndex, 1);
    return {
      value: digits.join(''),
      focusIndex: clampOtpFocus(safeIndex),
    };
  }

  if (safeIndex > 0) {
    digits.splice(safeIndex - 1, 1);
    return { value: digits.join(''), focusIndex: safeIndex - 1 };
  }

  return { value: digits.join(''), focusIndex: 0 };
}

export function pasteOtpValue(rawValue: string): OtpTransition | null {
  const value = normalizeOtpValue(rawValue);
  if (!value) return null;
  return { value, focusIndex: clampOtpFocus(value.length) };
}
