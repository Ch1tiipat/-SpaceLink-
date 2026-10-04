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

authTest('signed-in auth re-verification never emits loading; failures still fail closed', async () => {
  const effects: Array<() => (() => void) | undefined> = [];
  const states: unknown[] = [];
  const emitted: string[] = [];
  let notify: (event: string, session: { access_token: string } | null) => void = () => undefined;
  let complete: (value: unknown) => void = () => undefined;
  let fail: (cause: unknown) => void = () => undefined;
  let failSession = false;
  let timeoutCallback: () => void = () => undefined;
  const hookModule: { exports: Record<string, unknown> } = { exports: {} };
  const profile = { fullName: 'Test user', role: 'VENDOR', organizations: [] };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/use-auth-state.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    module: hookModule, exports: hookModule.exports, AbortController,
    window: { setTimeout: (callback: () => void, delay: number) => {
      timeoutCallback = callback;
      return setTimeout(callback, delay);
    }, clearTimeout },
    require: (id: string): unknown => {
      if (id === 'react') return {
        useCallback: (callback: unknown) => callback,
        useEffect: (effect: () => (() => void) | undefined) => effects.push(effect),
        useState: (initial: unknown) => {
          const index = states.push(initial) - 1;
          return [initial, (next: unknown) => {
            states[index] = typeof next === 'function' ? next(states[index]) : next;
            if (index === 0) emitted.push((states[index] as { status: string }).status);
          }];
        },
      };
      if (id === '@/lib/api') return { getMe: (_token: string, signal: AbortSignal) => new Promise((resolve, reject) => {
        complete = resolve;
        fail = reject;
        signal.addEventListener('abort', () => reject(new DOMException('timeout', 'AbortError')), { once: true });
      }) };
      if (id === '@/lib/supabase') return { getSupabaseBrowserClient: () => ({ auth: {
        getSession: async () => ({ data: { session: failSession ? null : { access_token: 'test-token' } }, error: null }),
        onAuthStateChange: (callback: typeof notify) => {
          notify = callback;
          return { data: { subscription: { unsubscribe: () => undefined } } };
        },
      } }) };
      if (id === '@/lib/ux-preview') return { getUxPreviewMode: () => null };
      if (id === '@/lib/network-error') return loadLocal(path.resolve('lib/network-error.ts'));
      return require(id);
    },
  });
  (hookModule.exports.useAuthState as () => unknown)();
  const cleanup = effects[0]();
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  try {
    await settle();
    complete(profile);
    await settle();
    authAssert.equal((states[0] as { status: string }).status, 'signed-in');
    for (const event of ['SIGNED_IN', 'TOKEN_REFRESHED']) {
      emitted.length = 0;
      notify(event, { access_token: 'test-token' });
      authAssert.equal((states[0] as { status: string }).status, 'signed-in');
      complete(profile);
      await settle();
      authAssert.ok(!emitted.includes('loading'), event + ' must retain mounted children');
    }
    notify('TOKEN_REFRESHED', { access_token: 'new-token' });
    fail(new TypeError('Failed to fetch'));
    await settle();
    authAssert.equal((states[0] as { status: string }).status, 'unavailable');
    notify('SIGNED_IN', { access_token: 'new-token' });
    complete(profile);
    await settle();
    notify('TOKEN_REFRESHED', { access_token: 'new-token' });
    timeoutCallback();
    await settle();
    authAssert.equal((states[0] as { status: string }).status, 'unavailable', 'timeout must still fail closed');
    failSession = true;
    notify('SIGNED_OUT', null);
    authAssert.equal((states[0] as { status: string }).status, 'signed-out');
  } finally { cleanup?.(); }
});

authTest('ready favorites ignore repeated same-token auth events but reload for changed token, sign-out and failures', async () => {
  // Execute the actual homepage effect with controlled API/auth dependencies.
  const source = ts.createSourceFile('page.tsx', fs.readFileSync('app/page.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let effectSource = '';
  function visit(node: import('typescript').Node) {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect'
      && node.arguments[1]?.getText(source) === '[savedLoadAttempt]') effectSource = node.arguments[0].getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source);
  authAssert.ok(effectSource, 'homepage saved-events effect exists');
  let notify: (event: string, session: { access_token: string } | null) => void = () => undefined;
  let state: { status: string; token?: string } = { status: 'loading' };
  const emitted: string[] = [];
  const requests: string[] = [];
  const pending: Array<{ resolve: (ids: string[]) => void; reject: (cause: unknown) => void }> = [];
  const savedGeneration = { current: 0 };
  const context = {
    AbortController, navigator: { onLine: true }, window: { setTimeout, clearTimeout }, savedGeneration,
    setSavedEvents: (next: typeof state) => { state = next; emitted.push(next.status); },
    setPendingSavedEventId: () => undefined, setSavedNotice: () => undefined,
    isNetworkFailure: () => true, connectionMessage: () => 'connection failed',
    getSavedEventIds: (token: string) => {
      requests.push(token);
      return new Promise<string[]>((resolve, reject) => pending.push({ resolve, reject }));
    },
    getSupabaseBrowserClient: () => ({ auth: {
      getSession: async () => ({ data: { session: { access_token: 'token-a' } }, error: null }),
      onAuthStateChange: (callback: typeof notify) => {
        notify = callback;
        return { data: { subscription: { unsubscribe: () => undefined } } };
      },
    } }),
  };
  const runEffect = vm.runInNewContext(ts.transpileModule('(' + effectSource + ')', {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText, context) as () => () => void;
  const cleanup = runEffect();
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  try {
    await settle();
    pending[0].resolve(['saved-event']);
    await settle();
    authAssert.equal(state.status, 'ready');
    const generation = savedGeneration.current;
    emitted.length = 0;
    for (const event of ['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED']) notify(event, { access_token: 'token-a' });
    await settle();
    authAssert.equal(requests.length, 1);
    authAssert.equal(savedGeneration.current, generation);
    authAssert.deepEqual(emitted, []);
    notify('TOKEN_REFRESHED', { access_token: 'token-b' });
    authAssert.equal(state.status, 'loading');
    authAssert.equal(requests[1], 'token-b');
    pending[1].reject(new TypeError('Failed to fetch'));
    await settle();
    authAssert.equal(state.status, 'error');
    notify('SIGNED_IN', { access_token: 'token-b' });
    authAssert.equal(requests.length, 3, 'failed load must permit same-token retry');
    pending[2].resolve([]);
    await settle();
    notify('SIGNED_OUT', null);
    authAssert.equal(state.status, 'signed-out');
    notify('SIGNED_IN', { access_token: 'token-b' });
    authAssert.equal(requests.length, 4, 'sign-out must clear the ready token');
    pending[3].resolve([]);
    await settle();
  } finally { cleanup(); }
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
