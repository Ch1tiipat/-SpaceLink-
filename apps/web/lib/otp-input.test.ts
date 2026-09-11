/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this test directly. */
const otpAssert: typeof import('node:assert/strict') = require(
  'node:assert/strict',
);
const { test: otpTest }: typeof import('node:test') = require('node:test');
const {
  backspaceOtpValue,
  changeOtpValue,
  clampOtpFocus,
  pasteOtpValue,
} = require('../components/otp-input-logic.ts') as typeof import('../components/otp-input-logic');

otpTest('advances through 082946 without losing rapid changes', () => {
  let value = '';
  let focusIndex = 0;

  for (const digit of '082946') {
    ({ value, focusIndex } = changeOtpValue(value, focusIndex, digit));
  }

  otpAssert.equal(value, '082946');
  otpAssert.equal(focusIndex, 5);
});

otpTest('accepts multi-digit browser autofill at the active position', () => {
  otpAssert.deepEqual(changeOtpValue('08', 2, '2946'), {
    value: '082946',
    focusIndex: 5,
  });
});

otpTest('parses paste, filters non-digits, and truncates after six digits', () => {
  otpAssert.deepEqual(pasteOtpValue(' 08a-29 46!7 '), {
    value: '082946',
    focusIndex: 5,
  });
  otpAssert.equal(pasteOtpValue('letters only'), null);
});

otpTest('backspace removes the active digit or the preceding digit from an empty box', () => {
  otpAssert.deepEqual(backspaceOtpValue('082', 1), {
    value: '02',
    focusIndex: 1,
  });
  otpAssert.deepEqual(backspaceOtpValue('082', 3), {
    value: '08',
    focusIndex: 2,
  });
});

otpTest('replaces an existing digit and preserves a dense value', () => {
  otpAssert.deepEqual(changeOtpValue('082', 1, '9'), {
    value: '092',
    focusIndex: 2,
  });
  otpAssert.deepEqual(changeOtpValue('08', 5, '2'), {
    value: '082',
    focusIndex: 3,
  });
  otpAssert.deepEqual(changeOtpValue('082', 1, ''), {
    value: '02',
    focusIndex: 1,
  });
});

otpTest('clamps focus to the first and last boxes', () => {
  otpAssert.equal(clampOtpFocus(-1), 0);
  otpAssert.equal(clampOtpFocus(6), 5);
  otpAssert.deepEqual(backspaceOtpValue('', 0), {
    value: '',
    focusIndex: 0,
  });
});
