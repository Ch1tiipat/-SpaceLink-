/* eslint-disable @typescript-eslint/no-require-imports -- Node runs TypeScript tests directly. */
import type {} from './api';
const authAssert: typeof import('node:assert/strict') = require('node:assert/strict');
const { test: authTest }: typeof import('node:test') = require('node:test');
const ts: typeof import('typescript') = require('typescript');
const fs: typeof import('node:fs') = require('node:fs');
const vm: typeof import('node:vm') = require('node:vm');
const path: typeof import('node:path') = require('node:path');
function loadLocal(file: string): Record<string, unknown> {
  const testModule = { exports: {} };
  const localRequire = (id: string) => id.startsWith('./')
    ? loadLocal(path.resolve(path.dirname(file), id + '.ts'))
    : require(id);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { module: testModule, exports: testModule.exports, require: localRequire, process, TypeError, Error, DOMException });
  return testModule.exports;
}
const authCopy = loadLocal(path.resolve('lib/auth-errors.ts')) as typeof import('./auth-errors');
const { AuthRetryableFetchError: RetryError } = require('@supabase/auth-js') as typeof import('@supabase/auth-js');
authTest('OTP connection copy distinguishes known offline from failed fetch while online', () => {
  const error = new RetryError('Failed to fetch', 0);
  for (const mode of ['login', 'register'] as const) {
    authAssert.equal(authCopy.describeSendError(error, mode, true).text, 'ขณะนี้เชื่อมต่อไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองส่งรหัสอีกครั้ง');
    authAssert.equal(authCopy.describeSendError(error, mode, false).text, 'ขณะนี้ออฟไลน์ กรุณาเชื่อมต่ออินเทอร์เน็ตก่อนขอรหัสยืนยัน');
  }
  authAssert.match(authCopy.describeUnexpectedSendError(new TypeError('Failed to fetch'), false).text, /ขณะนี้ออฟไลน์/);
  authAssert.doesNotMatch(authCopy.describeUnexpectedSendError(new Error('Missing configuration'), false).text, /ออฟไลน์/);
});
authTest('OTP service responses and verification copy keep their existing meanings even offline', () => {
  authAssert.equal(authCopy.describeSendError({ code: 'otp_disabled', message: '' }, 'login', false).link?.href, '/register');
  authAssert.equal(authCopy.describeSendError({ code: 'signup_disabled', message: '' }, 'register', false).link?.href, '/login');
  for (const code of ['over_email_send_rate_limit', 'over_request_rate_limit']) authAssert.match(authCopy.describeSendError({ code, message: '' }, 'login', false).text, /รอประมาณ 1 นาที/);
  authAssert.match(authCopy.describeSendError({ code: 'email_address_invalid', message: '' }, 'login', false).text, /ระบบไม่รับอีเมลนี้/);
  authAssert.match(authCopy.describeVerifyError({ code: 'otp_expired', message: '' }).text, /หมดอายุ/);
  authAssert.match(authCopy.describeVerifyError({ code: 'invalid_credentials', message: '' }).text, /ไม่ถูกต้อง/);
  authAssert.doesNotMatch(authCopy.describeSendError(new RetryError('server error', 503), 'login', false).text, /ออฟไลน์/);
});

authTest('auth hook keeps failed profile/session checks unavailable without deleting the session; real 401/403 remain signed-out', async () => {
  for (const kind of ['profile', 'session'] as const) {
    for (const status of [0, 401, 403, 503]) {
      const effects: Array<() => (() => void) | undefined> = [];
      const states: unknown[] = [];
      let signOutCalls = 0;
      const cause = Object.assign(new Error('test response'), { name: 'ApiError', status });
      const hookModule: { exports: Record<string, unknown> } = { exports: {} };
      const mockRequire = (id: string): unknown => {
        if (id === 'react') return {
          useCallback: (callback: unknown) => callback,
          useEffect: (effect: () => (() => void) | undefined) => effects.push(effect),
          useState: (initial: unknown) => {
            const index = states.push(initial) - 1;
            return [initial, (next: unknown) => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
          },
        };
        if (id === '@/lib/api') return { getMe: async () => { throw cause; } };
        if (id === '@/lib/supabase') return {
          getSupabaseBrowserClient: () => ({ auth: {
            getSession: async () => kind === 'session'
              ? { data: { session: null }, error: cause }
              : { data: { session: { access_token: 'synthetic-test-token' } }, error: null },
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
            signOut: async () => { signOutCalls += 1; },
          } }),
        };
        if (id === '@/lib/ux-preview') return { getUxPreviewMode: () => null };
        if (id === '@/lib/network-error') return loadLocal(path.resolve('lib/network-error.ts'));
        return require(id);
      };
      vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/use-auth-state.ts', 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
      }).outputText, {
        module: hookModule, exports: hookModule.exports, require: mockRequire,
        AbortController, window: { setTimeout, clearTimeout },
      });
      (hookModule.exports.useAuthState as () => unknown)();
      const cleanup = effects[0]();
      try {
        await new Promise((resolve) => setImmediate(resolve));
        authAssert.equal((states[0] as { status: string }).status,
          status === 401 || status === 403 ? 'signed-out' : 'unavailable',
          kind + ' status ' + status);
        authAssert.equal(signOutCalls, 0);
      } finally { cleanup?.(); }
    }
  }
});
