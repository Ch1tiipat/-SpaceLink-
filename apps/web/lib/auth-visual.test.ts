/* eslint-disable @typescript-eslint/no-require-imports -- Node runs these tests directly. */
import type {} from './use-email-otp';
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const { test }: typeof import('node:test') = require('node:test');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const vm: typeof import('node:vm') = require('node:vm');
const ts: typeof import('typescript') = require('typescript');
const React: typeof import('react') = require('react');
const { renderToStaticMarkup }: typeof import('react-dom/server') = require('react-dom/server');

function load(file: string, mocks: Record<string, unknown> = {}): Record<string, unknown> {
  const filename = path.resolve(file);
  const testModule = { exports: {} };
  const localRequire = (id: string): unknown => {
    if (id in mocks) return mocks[id];
    if (id.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_target, key) => String(key) }) };
    if (id.startsWith('./') || id.startsWith('@/')) {
      const target = id.startsWith('@/') ? path.resolve(id.slice(2)) : path.resolve(path.dirname(filename), id);
      return load(fs.existsSync(target + '.tsx') ? target + '.tsx' : target + '.ts', mocks);
    }
    return require(id);
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { module: testModule, exports: testModule.exports, require: localRequire, process, TypeError, Error, DOMException, ...mocks.__globals as object });
  return testModule.exports;
}

const copy = load('lib/auth-errors.ts') as typeof import('./auth-errors');
const nextMocks = {
  'next/link': { __esModule: true, default: ({ children, ...props }: React.ComponentProps<'a'>) => React.createElement('a', props, children) },
  'next/image': { __esModule: true, default: (props: React.ComponentProps<'img'>) => {
    const { src, alt, width, height, sizes } = props;
    return React.createElement('img', { src, alt, width, height, sizes });
  } },
};
const ui = load('components/auth-layout.tsx', nextMocks) as typeof import('../components/auth-layout');
function fixture(overrides: Partial<import('./use-email-otp').UseEmailOtp> = {}): import('./use-email-otp').UseEmailOtp {
  return {
    step: 'code', email: 'sample@example.test', code: '', pending: false, error: null, cooldown: 60,
    setEmail() {}, setCode() {}, setError() {}, async submitEmail() {}, async verify() {}, resend() {}, editEmail() {},
    ...overrides,
  };
}
function otpMarkup(overrides: Partial<import('./use-email-otp').UseEmailOtp> = {}) {
  return renderToStaticMarkup(React.createElement(ui.AuthOtpForm, { flow: fixture(overrides), errorId: 'test-error' }));
}

test('both real routes retain auth options, registration metadata and account navigation', () => {
  for (const mode of ['login', 'register'] as const) {
    let config: unknown;
    const page = load('app/' + mode + '/page.tsx', {
      ...nextMocks,
      '@/lib/use-email-otp': { useEmailOtp: (options: unknown) => { config = options; return fixture({ step: 'email' }); } },
    }) as { default: React.FunctionComponent };
    const html = renderToStaticMarkup(React.createElement(page.default));
    assert.deepEqual(JSON.parse(JSON.stringify(config)), {
      mode, signInOptions: mode === 'login' ? { shouldCreateUser: false } : { data: { full_name: '' }, shouldCreateUser: true },
    });
    assert.match(html, /name="email"/);
    assert.match(html, /autoComplete="email"/i);
    assert.match(html, new RegExp('href="/' + (mode === 'login' ? 'register' : 'login') + '"'));
    assert.doesNotMatch(html, /prototype|ทดลองยืนยัน|demo@example|ภายใน 5 นาที/);
    if (mode === 'register') {
      assert.match(html, /name="fullName"/);
      assert.match(html, /register-accept-terms/);
      assert.match(html, /href="\/terms" target="_blank" rel="noopener noreferrer"/);
      assert.match(html, /href="\/privacy" target="_blank" rel="noopener noreferrer"/);
    }
  }
});

test('OTP uses six accessible numeric inputs and blocks incomplete verification/resend', () => {
  const html = otpMarkup();
  assert.equal((html.match(/inputMode="numeric"/g) || []).length, 6);
  assert.match(html, /autoComplete="one-time-code"/i);
  assert.match(html, /type="submit"[^>]*disabled=""/);
  assert.match(html, /class="resend"[^>]*disabled=""/);
  assert.match(html, /ส่งรหัสอีกครั้ง \(60s\)/);
});

test('complete OTP enables verification and elapsed cooldown enables resend', () => {
  const html = otpMarkup({ code: '082946', cooldown: 0 });
  assert.doesNotMatch(html, /disabled=""/);
  assert.match(html, /value="0"/);
});

test('pending disables every OTP action including email editing', () => {
  const html = otpMarkup({ pending: true, code: '082946', cooldown: 0 });
  assert.equal((html.match(/disabled=""/g) || []).length, 9);
  assert.match(html, /aria-busy="true"/);
});

test('OTP error messages stay accessible and preserve remediation links', () => {
  const html = otpMarkup({ error: { text: 'กรุณาลองอีกครั้ง', link: { href: '/register', label: 'สมัครสมาชิก' } } });
  assert.equal((html.match(/aria-invalid="true"/g) || []).length, 6);
  assert.equal((html.match(/aria-describedby="test-error"/g) || []).length, 6);
  assert.match(html, /id="test-error" role="alert"/);
  assert.match(html, /href="\/register"/);
});

test('layout covers both modes and OTP without exposing any fake success or expiry', () => {
  for (const mode of ['login', 'register'] as const) for (const step of ['email', 'code'] as const) {
    const html = renderToStaticMarkup(React.createElement(ui.AuthLayout, {
      mode, step, email: 'very-long-local-part@example.test', pending: false, onEditEmail() {},
    }, 'form'));
    assert.match(html, new RegExp('data-auth-screen="' + (step === 'code' ? 'otp' : mode) + '"'));
    assert.match(html, /href="\/"/);
    assert.match(html, /src="\/auth-market-photo.png"/);
    assert.match(html, /src="\/brand\/auth-mark.png"/);
    assert.doesNotMatch(html, /prototype|ทดลองยืนยัน|ภายใน 5 นาที/);
  }
});

test('responsive styles stay local, wrap long emails and avoid iOS form auto-zoom', () => {
  const css = fs.readFileSync('components/auth-layout.module.css', 'utf8');
  assert.match(css, /max-width: 1023px/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /\.root \.field input \{ font-size: 16px;/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(css, /body:has|header\.sticky|100vw.*min-width/);
  assert.ok(fs.statSync('public/auth-market-photo.png').size > 1000);
  assert.ok(fs.statSync('public/brand/auth-mark.png').size > 1000);
});

/** Isolated hook tests exercise production code, not the prototype or real accounts. */
function hookHarness(mode: 'login' | 'register' = 'login') {
  const state: unknown[] = [];
  let cursor = 0;
  let sendError: unknown = null;
  let verifyError: unknown = null;
  let profileError = false;
  let hasSession = true;
  let role = 'VENDOR';
  let blacklisted = false;
  let offline = false;
  let releaseSend: (() => void) | undefined;
  let holdSend = false;
  const calls = { sends: [] as unknown[], verifies: [] as unknown[], redirects: [] as string[], signOut: 0, profiles: 0 };
  const timers: Array<() => void> = [];
  const hooks = {
    useState(initial: unknown) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value: unknown) => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    },
    useEffect(effect: () => void) { effect(); },
  };
  const client = { auth: {
    async signInWithOtp(input: unknown) {
      calls.sends.push(input);
      if (holdSend) await new Promise<void>((resolve) => { releaseSend = resolve; });
      return { error: sendError };
    },
    async verifyOtp(input: unknown) { calls.verifies.push(input); return { error: verifyError, data: { session: hasSession ? { access_token: 'isolated-test-token' } : null } }; },
    async signOut() { calls.signOut++; },
  } };
  const mod = load('lib/use-email-otp.ts', {
    react: hooks, 'next/navigation': { useRouter: () => ({ replace: (url: string) => calls.redirects.push(url) }) },
    '@/components/otp-input': { OTP_LENGTH: 6 }, './auth-errors': copy,
    './supabase': { getSupabaseBrowserClient: () => client },
    './api': { getMe: async () => { calls.profiles++; if (profileError) throw new Error('isolated-profile-failure'); return { role, isBlacklisted: blacklisted }; } },
    __globals: {
      navigator: { get onLine() { return !offline; } },
      window: { setTimeout: (callback: () => void) => { timers.push(callback); return timers.length; }, clearTimeout() {} },
    },
  }) as typeof import('./use-email-otp');
  const render = () => { cursor = 0; return mod.useEmailOtp({ mode, signInOptions: { shouldCreateUser: mode === 'register', ...(mode === 'register' ? { data: { full_name: 'Test Vendor' } } : {}) } }); };
  return { render, calls, timers,
    setSendError(value: unknown) { sendError = value; }, setVerifyError(value: unknown) { verifyError = value; },
    setHasSession(value: boolean) { hasSession = value; }, setProfileError() { profileError = true; },
    setRole(value: string) { role = value; }, setBlacklisted() { blacklisted = true; }, setOffline() { offline = true; },
    holdSend() { holdSend = true; }, releaseSend() { releaseSend?.(); },
  };
}

test('invalid email never reaches Supabase or advances to OTP', async () => {
  const h = hookHarness();
  h.render().setEmail('invalid');
  await h.render().submitEmail();
  assert.equal(h.calls.sends.length, 0);
  assert.equal(h.render().step, 'email');
  assert.equal(h.render().error?.text, copy.INVALID_EMAIL_MESSAGE.text);
});

test('successful real email handler normalizes email and starts cooldown only after send', async () => {
  const h = hookHarness('register');
  h.render().setEmail('  sample@example.test  ');
  h.holdSend();
  const send = h.render().submitEmail();
  assert.equal(h.render().pending, true);
  assert.equal(h.render().step, 'email');
  h.releaseSend(); await send;
  assert.equal(h.render().pending, false);
  assert.equal(h.render().email, 'sample@example.test');
  assert.equal(h.render().step, 'code');
  assert.equal(h.render().cooldown, 60);
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls.sends[0])), { email: 'sample@example.test', options: { shouldCreateUser: true, data: { full_name: 'Test Vendor' } } });
});

test('offline and send failure retain form and release pending', async () => {
  for (const offline of [true, false]) {
    const h = hookHarness();
    h.render().setEmail('sample@example.test');
    if (offline) h.setOffline(); else h.setSendError({ message: 'rate limit', status: 429, code: 'over_email_send_rate_limit' });
    await h.render().submitEmail();
    assert.equal(h.render().step, 'email');
    assert.equal(h.render().pending, false);
    assert.ok(h.render().error);
    assert.equal(h.render().cooldown, 0);
  }
});

test('verification rejects incomplete, wrong and missing-session OTP without profile access', async () => {
  for (const failure of ['incomplete', 'wrong', 'no-session']) {
    const h = hookHarness();
    h.render().setEmail('sample@example.test');
    h.render().setCode(failure === 'incomplete' ? '082' : '082946');
    if (failure === 'wrong') h.setVerifyError({ message: 'Token expired', code: 'otp_expired' });
    if (failure === 'no-session') h.setHasSession(false);
    await h.render().verify();
    assert.ok(h.render().error);
    assert.equal(h.render().pending, false);
    assert.equal(h.calls.profiles, 0);
    assert.equal(h.calls.redirects.length, 0);
  }
});

test('successful OTP preserves type=email and role-based redirects for both modes', async () => {
  for (const mode of ['login', 'register'] as const) for (const [role, destination] of [['VENDOR', '/'], ['ORG_ADMIN', '/admin/bookings'], ['SUPER_ADMIN', '/super-admin']]) {
    const h = hookHarness(mode);
    h.setRole(role);
    h.render().setEmail('sample@example.test');
    h.render().setCode('082946');
    await h.render().verify();
    assert.deepEqual(JSON.parse(JSON.stringify(h.calls.verifies[0])), { email: 'sample@example.test', token: '082946', type: 'email' });
    assert.deepEqual(h.calls.redirects, [destination]);
    assert.equal(h.render().pending, true);
  }
});

test('blacklisted profile signs out and never redirects', async () => {
  const h = hookHarness(); h.setBlacklisted();
  h.render().setCode('082946'); await h.render().verify();
  assert.equal(h.calls.signOut, 1);
  assert.equal(h.calls.redirects.length, 0);
  assert.equal(h.render().error?.text, copy.BLACKLISTED_MESSAGE.text);
  assert.equal(h.render().code, '');
});

test('profile failure is distinct from OTP failure and editing keeps email', async () => {
  const h = hookHarness(); h.setProfileError();
  h.render().setEmail('sample@example.test');
  h.render().setCode('082946'); await h.render().verify();
  assert.ok(h.render().error);
  assert.equal(h.calls.redirects.length, 0);
  assert.equal(h.render().pending, false);
  h.render().editEmail();
  assert.equal(h.render().email, 'sample@example.test');
  assert.equal(h.render().code, '');
  assert.equal(h.render().error, null);
  assert.equal(h.render().step, 'email');
});

test('real cooldown ticks to zero and successful resend starts a fresh cooldown', async () => {
  const h = hookHarness();
  h.render().setEmail('sample@example.test');
  await h.render().submitEmail();
  for (let second = 0; second < 60; second++) {
    h.render();
    h.timers[h.timers.length - 1]();
  }
  assert.equal(h.render().cooldown, 0);
  h.render().resend();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(h.calls.sends.length, 2);
  assert.equal(h.render().cooldown, 60);
  assert.equal(h.render().pending, false);
});

test('failed resend does not falsely announce a newly delivered OTP', async () => {
  const h = hookHarness();
  h.render().setEmail('sample@example.test');
  h.setSendError({ message: 'rate limit', status: 429, code: 'over_email_send_rate_limit' });
  h.render().resend();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.ok(h.render().error);
  assert.equal(h.render().cooldown, 0);
  assert.equal(h.render().pending, false);
});
