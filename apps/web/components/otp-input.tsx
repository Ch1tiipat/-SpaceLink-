'use client';

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import {
  backspaceOtpValue,
  changeOtpValue,
  clampOtpFocus,
  OTP_LENGTH,
  pasteOtpValue,
  type OtpTransition,
} from './otp-input-logic';

export { OTP_LENGTH } from './otp-input-logic';

type OtpInputProps = {
  /** The digits entered so far, densely packed and never longer than OTP_LENGTH. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  /** Id of the element describing the field — the error message, when there is one. */
  describedBy?: string;
  autoFocus?: boolean;
};

/**
 * Six single-digit boxes behaving as one field: typing advances, backspace
 * retreats, and pasting a whole code fills every box at once.
 *
 * `value` is kept dense — there is never a filled box after an empty one —
 * because a gap has no meaning in a six-digit code and would make the string
 * handed to `verifyOtp` ambiguous. Focusing past the end is redirected to the
 * first empty box, which is what makes that invariant hold.
 */
export function OtpInput({
  value,
  onChange,
  disabled,
  invalid,
  describedBy,
  autoFocus,
}: OtpInputProps) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const currentValue = useRef(value);
  const digits = value.split('');

  useEffect(() => {
    currentValue.current = value;
  }, [value]);

  const focusAt = (index: number) => {
    const clamped = clampOtpFocus(index);
    const input = inputs.current[clamped];
    input?.focus();
    // Selecting means the next keystroke replaces rather than appends, so a
    // digit typed into an already-filled box does the obvious thing.
    input?.select();
  };

  const commit = (transition: OtpTransition) => {
    // Keep the next event independent from React's controlled-state render.
    // A second digit may arrive after focus moves but before the parent value
    // prop commits, especially with password managers and fast typing.
    currentValue.current = transition.value;
    onChange(transition.value);
    focusAt(transition.focusIndex);
  };

  const handleChange = (index: number, raw: string) => {
    commit(changeOtpValue(currentValue.current, index, raw));
  };

  const handleKeyDown = (
    index: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      commit(backspaceOtpValue(currentValue.current, index));
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusAt(index - 1);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusAt(index + 1);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const transition = pasteOtpValue(event.clipboardData.getData('text'));

    if (!transition) {
      return;
    }

    event.preventDefault();
    commit(transition);
  };

  return (
    <div
      role="group"
      aria-label={`รหัสยืนยัน ${OTP_LENGTH} หลัก`}
      className="flex gap-2"
    >
      {Array.from({ length: OTP_LENGTH }, (_, index) => (
        <input
          key={index}
          ref={(element) => {
            inputs.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          // Lets a browser deliver the whole code into the first box; our
          // handler splits it. maxLength={1} would silently truncate it.
          maxLength={OTP_LENGTH}
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          autoFocus={autoFocus && index === 0}
          disabled={disabled}
          value={digits[index] ?? ''}
          aria-label={`รหัสยืนยัน หลักที่ ${index + 1} จาก ${OTP_LENGTH}`}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={() => {
            // Keeps `value` dense: clicking box 4 of an empty code lands on
            // box 1 instead of opening a gap.
            if (index > value.length) {
              focusAt(value.length);
            }
          }}
          className={`h-[54px] w-full min-w-0 rounded-2xl border bg-white text-center text-xl font-bold tabular-nums text-ink transition-colors disabled:bg-mist disabled:text-muted ${
            invalid ? 'border-danger' : 'border-line focus:border-violet'
          }`}
        />
      ))}
    </div>
  );
}
