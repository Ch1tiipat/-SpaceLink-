/* eslint-disable @typescript-eslint/no-require-imports -- Node runs TypeScript tests directly. */
import type { AuthState } from './use-auth-state';
import type { CurrentUser, UserRole } from './api';
import type { VendorProfileState } from './use-vendor-profile';
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const { test }: typeof import('node:test') = require('node:test');
const ts: typeof import('typescript') = require('typescript');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const vm: typeof import('node:vm') = require('node:vm');
const React: typeof import('react') = require('react');
const { renderToStaticMarkup }: typeof import('react-dom/server') = require('react-dom/server');

type Effect = () => void | (() => void);
type Props = Record<string, unknown> & { children?: import('react').ReactNode };
type Element = import('react').ReactElement<Props>;
type Component = (props: Props) => import('react').ReactNode;
const noop = () => undefined;
const passThrough = ({ children }: Props) => React.createElement(React.Fragment, {}, children);
const signedIn = (role: UserRole): AuthState => ({
  status: 'signed-in', role, fullName: 'Mock account', organizations: [],
});
function profile(role: UserRole): CurrentUser {
  return {
    id: 'mock-user', authUserId: 'mock-auth-user', fullName: 'Mock account',
    email: 'mock@example.invalid', phone: '0812345678', province: null,
    role, isBlacklisted: false, createdAt: '', updatedAt: '', organizations: [],
    shops: role === 'VENDOR' ? [{
      id: 'mock-shop', name: 'Mock shop', description: null, logoUrl: null, categories: [],
    }] : [],
  };
}
function nodes(tree: import('react').ReactNode): Element[] {
  const found: Element[] = [];
  React.Children.forEach(tree, (child) => {
    if (!React.isValidElement<Props>(child)) return;
    found.push(child, ...nodes(child.props.children));
  });
  return found;
}
function named(tree: import('react').ReactNode, name: string) {
  const result = nodes(tree).find((node) => typeof node.type === 'function' && node.type.name === name);
  assert.ok(result, name + ' must be present');
  return result;
}

// Controlled hooks execute the real components/effects without tokens, a DOM,
// network access or a new test dependency. State and effect dependencies persist.
function harness(overrides: Record<string, unknown> = {}, pathname = '/profile') {
  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  const effects: Array<{ deps: unknown[]; cleanup?: () => void }> = [];
  const pending = new Map<number, Effect>();
  const replacements: string[] = [];
  let stateIndex = 0, refIndex = 0, effectIndex = 0;
  let auth: AuthState = { status: 'loading' };
  let vendor: VendorProfileState = { status: 'loading' };
  const router = { replace: (href: string) => replacements.push(href) };
  const hooks = {
    ...React,
    useState(initial: unknown) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], (next: unknown) => {
        states[index] = typeof next === 'function' ? next(states[index]) : next;
      }];
    },
    useRef(initial: unknown) {
      const index = refIndex++;
      return refs[index] ?? (refs[index] = { current: initial });
    },
    useMemo: (factory: () => unknown) => factory(),
    useCallback: (callback: unknown) => callback,
    useEffect(effect: Effect, deps: unknown[] = []) {
      const index = effectIndex++;
      if (!effects[index] || deps.some((dep, i) => !Object.is(dep, effects[index].deps[i]))) {
        pending.set(index, effect);
        effects[index] = { deps, cleanup: effects[index]?.cleanup };
      }
    },
  };
  const modules: Record<string, unknown> = {
    'react': hooks,
    'react-dom': { createPortal: (child: unknown) => child },
    'next/link': { default: passThrough },
    'next/navigation': {
      useRouter: () => router, usePathname: () => pathname,
      useSearchParams: () => new URLSearchParams(),
    },
    '@/components/resilient-image': { ResilientImage: () => null },
    '@/lib/use-auth-state': { useAuthState: () => ({ auth, retry: noop, signOut: noop }) },
    '@/lib/use-vendor-profile': { useVendorProfile: () => ({ state: vendor, refresh: noop }) },
    ...overrides,
  };
  const cache = new Map<string, Record<string, unknown>>();
  const windowMock = {
    setTimeout: () => 1, clearTimeout: noop, setInterval: () => 1, clearInterval: noop,
    addEventListener: noop, removeEventListener: noop,
    location: { hash: '', search: '', reload: noop }, innerHeight: 900,
  };
  function load(file: string): Record<string, unknown> {
    const absolute = path.resolve(file);
    if (cache.has(absolute)) return cache.get(absolute)!;
    const result = { exports: {} as Record<string, unknown> };
    cache.set(absolute, result.exports);
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
    }).outputText, {
      module: result, exports: result.exports,
      require: (id: string) => {
        if (Object.prototype.hasOwnProperty.call(modules, id)) return modules[id];
        if (id.startsWith('@/') || id.startsWith('./')) {
          const target = id.startsWith('@/') ? path.resolve(id.slice(2)) : path.resolve(path.dirname(absolute), id);
          return load(target + (fs.existsSync(target + '.tsx') ? '.tsx' : '.ts'));
        }
        return require(id);
      },
      window: windowMock,
      document: { body: { style: {} }, addEventListener: noop, removeEventListener: noop },
      navigator: {}, localStorage: { getItem: () => null, setItem: noop },
      process: { env: {} }, AbortController, DOMException, Error, TypeError, URLSearchParams,
    });
    return result.exports;
  }
  function run(component: Component, props: Props = {}) {
    stateIndex = refIndex = effectIndex = 0;
    return component(props);
  }
  function flush(guardOnly = false) {
    for (const [index, effect] of pending) {
      if (guardOnly && !effects[index].deps.includes(router)) continue;
      effects[index].cleanup?.();
      effects[index].cleanup = effect() || undefined;
    }
    pending.clear();
  }
  return {
    load, run, flush, replacements, states,
    setAuth: (value: AuthState) => { auth = value; },
    setVendor: (value: VendorProfileState) => { vendor = value; },
    reset: () => { states.length = refs.length = effects.length = 0; pending.clear(); },
    unmount: () => effects.forEach((effect) => effect.cleanup?.()),
  };
}

test('profile forwards only verified SUPER_ADMIN with replace, once per role transition', () => {
  const h = harness();
  const page = h.load('app/profile/page.tsx').default as Component;
  for (const state of [
    { status: 'loading' }, { status: 'unavailable' }, { status: 'signed-out' },
    signedIn('ORG_ADMIN'), signedIn('VENDOR'),
  ] as AuthState[]) {
    h.setAuth(state); h.run(page); h.flush();
    assert.deepEqual(h.replacements, []);
  }
  h.setAuth(signedIn('SUPER_ADMIN'));
  assert.match(renderToStaticMarkup(h.run(page)), /กำลังเปิดโปรไฟล์ผู้ดูแลระบบส่วนกลาง/);
  h.flush(); h.run(page); h.flush();
  assert.deepEqual(h.replacements, ['/super-admin/profile']);
});

test('loading/offline/retry and non-super roles preserve the original profile element identity', () => {
  function ProfileShopScreen() { return null; }
  const h = harness({ '@/components/profile-shop-screen': { ProfileShopScreen } });
  const page = h.load('app/profile/page.tsx').default as Component;
  for (const state of [
    { status: 'loading' }, signedIn('ORG_ADMIN'), { status: 'unavailable' },
    { status: 'loading' }, signedIn('VENDOR'), { status: 'signed-out' },
  ] as AuthState[]) {
    h.setAuth(state);
    const element = h.run(page) as Element;
    assert.equal(element.type, ProfileShopScreen);
    assert.equal(element.key, null, 'React keeps this screen instance and its form state');
    h.flush();
  }
  assert.deepEqual(h.replacements, []);
});

test('new route reuses the real profile screen and contains no forwarding effect', () => {
  const h = harness();
  const page = h.load('app/super-admin/profile/page.tsx').default as Component;
  const screen = h.load('components/profile-shop-screen.tsx').ProfileShopScreen;
  assert.equal((h.run(page) as Element).type, screen);
  h.flush(); assert.deepEqual(h.replacements, []);
});

test('super shell account destination and profile main landmark are correct; other routes keep main', () => {
  for (const route of ['/super-admin/profile', '/super-admin']) {
    const h = harness({}, route); h.setAuth(signedIn('SUPER_ADMIN'));
    const shell = h.load('components/super-admin/super-admin-shell.tsx').SuperAdminShell as Component;
    const inner = (h.run(shell, { children: React.createElement('main', {}, 'PROFILE') }) as Element).props.children as Element;
    h.reset();
    const content = inner.type as Component;
    h.run(content, inner.props);
    h.states[5] = true; // Open the actual account popover.
    const tree = h.run(content, inner.props);
    const link = nodes(tree).find((node) => node.props.role === 'menuitem' && node.props.href);
    assert.equal(link?.props.href, '/super-admin/profile');
    const canvas = nodes(tree).find((node) => String(node.props.className).startsWith('sl-super-main '));
    assert.equal(canvas?.type, route.endsWith('/profile') ? 'div' : 'main');
    assert.equal(nodes(tree).filter((node) => node.type === 'main').length, route.endsWith('/profile') ? 1 : 2);
    h.flush(true); assert.deepEqual(h.replacements, []);
  }
});

test('super shell guard stays fail-closed and never sends non-super users back to profile', () => {
  for (const [state, expected] of [
    [{ status: 'loading' }, []], [{ status: 'unavailable' }, []],
    [{ status: 'signed-out' }, ['/login']],
    [signedIn('ORG_ADMIN'), ['/']], [signedIn('VENDOR'), ['/']],
  ] as Array<[AuthState, string[]]>) {
    const h = harness({}, '/super-admin/profile'); h.setAuth(state);
    const shell = h.load('components/super-admin/super-admin-shell.tsx').SuperAdminShell as Component;
    const inner = (h.run(shell, { children: 'PROTECTED' }) as Element).props.children as Element;
    h.reset(); const tree = h.run(inner.type as Component, inner.props);
    assert.ok(!nodes(tree).some((node) => node.props.children === 'PROTECTED'));
    h.flush(true); assert.deepEqual(h.replacements, expected);
  }
});

test('real profile screen retains loading/error/signed-out and role-specific content', () => {
  const h = harness();
  const screen = h.load('components/profile-shop-screen.tsx').ProfileShopScreen as Component;
  h.setVendor({ status: 'loading' });
  assert.ok(nodes(h.run(screen)).some((node) => String(node.props.className).includes('skeleton')));
  h.setVendor({ status: 'error', message: 'Mock offline failure' });
  assert.ok(nodes(h.run(screen)).some((node) => node.props.role === 'alert' && node.props.children === 'Mock offline failure'));
  h.setVendor({ status: 'signed-out' });
  assert.match(renderToStaticMarkup(h.run(screen)), /กรุณาเข้าสู่ระบบก่อน/);
  for (const role of ['ORG_ADMIN', 'VENDOR', 'SUPER_ADMIN'] as const) {
    const user = profile(role);
    h.setVendor({ status: 'ready', token: 'mock-token', profile: user, shop: user.shops[0] ?? null });
    const tree = h.run(screen);
    assert.equal((tree as Element).type, 'main');
    if (role === 'VENDOR') named(tree, 'ShopLogoAvatar');
    else {
      assert.equal(named(tree, 'AdminAccountProfile').props.profile, user);
      const html = renderToStaticMarkup(tree);
      assert.match(html, role === 'SUPER_ADMIN' ? /ผู้ดูแลระบบส่วนกลาง/ : /ผู้ดูแลองค์กร/);
      assert.doesNotMatch(html, /เพิ่มข้อมูลร้านค้า/);
    }
  }
});

test('ORG_ADMIN phone save still uses the original payload and refresh', async () => {
  const writes: unknown[] = []; let refreshes = 0;
  const h = harness({ '@/lib/api': { updateMe: async (...args: unknown[]) => { writes.push(args); } } });
  const screen = h.load('components/profile-shop-screen.tsx').ProfileShopScreen as Component;
  const user = profile('ORG_ADMIN');
  h.setVendor({ status: 'ready', token: 'mock-token', profile: user, shop: null });
  const account = named(h.run(screen), 'AdminAccountProfile');
  h.reset(); const props = { ...account.props, refresh: () => { refreshes++; } };
  let tree = h.run(account.type as Component, props);
  const input = nodes(tree).find((node) => node.type === 'input')!;
  (input.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: '0898765432' } });
  tree = h.run(account.type as Component, props);
  await (nodes(tree).find((node) => node.type === 'button')!.props.onClick as () => Promise<void>)();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(JSON.stringify(writes), JSON.stringify([[{ phone: '0898765432' }, 'mock-token']]));
  assert.equal(refreshes, 1);
});

test('VENDOR profile editor still saves the original payload and refresh', async () => {
  const writes: unknown[] = []; let refreshes = 0;
  const h = harness({ '@/lib/api': { updateMe: async (...args: unknown[]) => { writes.push(args); } } });
  const screen = h.load('components/profile-shop-screen.tsx').ProfileShopScreen as Component;
  const user = profile('VENDOR');
  h.setVendor({ status: 'ready', token: 'mock-token', profile: user, shop: user.shops[0] });
  h.run(screen); h.states[0] = true;
  const editor = named(h.run(screen), 'ProfileEditorDialog');
  h.reset();
  const props = { ...editor.props, refresh: () => { refreshes++; } };
  const tree = h.run(editor.type as Component, props);
  const form = nodes(tree).find((node) => node.type === 'form')!;
  await (form.props.onSubmit as (event: { preventDefault: () => void }) => Promise<void>)({ preventDefault: noop });
  assert.equal(JSON.stringify(writes), JSON.stringify([[{ phone: '0812345678' }, 'mock-token']]));
  assert.equal(refreshes, 1);
});

// Count actual getMe calls from the production hooks under a single session
// resolution (no StrictMode, token refresh or retries unless explicitly driven).
async function requestScenario(
  kinds: Array<'auth' | 'profile'>,
  tracker = { calls: 0, offline: false },
  role: UserRole = 'ORG_ADMIN',
) {
  const session = { access_token: 'mock-token' };
  const api = { getMe: async () => {
    tracker.calls++;
    if (tracker.offline) throw new TypeError('Mock offline failure');
    return profile(role);
  } };
  const supabase = { auth: {
    getSession: async () => ({ data: { session }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: noop } } }),
  } };
  const mounted = kinds.map((kind) => {
    const h = harness({
      '@/lib/api': api, '@/lib/supabase': { getSupabaseBrowserClient: () => supabase },
      '@/lib/ux-preview': { getUxPreviewMode: () => null },
    });
    const hook = h.load(kind === 'auth' ? 'lib/use-auth-state.ts' : 'lib/use-vendor-profile.ts')[kind === 'auth' ? 'useAuthState' : 'useVendorProfile'] as Component;
    h.run(hook); h.flush();
    return { h, hook };
  });
  const settle = async () => { await new Promise<void>((resolve) => setImmediate(resolve)); };
  await settle();
  return { mounted, settle, calls: () => tracker.calls };
}

test('request counts: baseline profile 2, wrapper profile 3, super profile 3; retry adds one', async () => {
  const baseline = await requestScenario(['auth', 'profile']);
  const wrapper = await requestScenario(['auth', 'auth', 'profile']);
  const destination = await requestScenario(['auth', 'auth', 'profile']);
  assert.equal(baseline.calls(), 2);
  assert.equal(wrapper.calls(), 3);
  assert.equal(destination.calls(), 3);
  const { h, hook } = wrapper.mounted[1];
  (h.run(hook) as unknown as { retry: () => void }).retry();
  h.run(hook); h.flush(); await wrapper.settle();
  assert.equal(wrapper.calls(), 4);
  for (const scenario of [baseline, wrapper, destination]) scenario.mounted.forEach(({ h }) => h.unmount());
});

test('controlled cold super redirect totals 5; warm super menu adds only 1 request', async () => {
  const coldTracker = { calls: 0, offline: false };
  const root = await requestScenario(['auth'], coldTracker, 'SUPER_ADMIN');
  const original = await requestScenario(['auth', 'profile'], coldTracker, 'SUPER_ADMIN');
  assert.equal(coldTracker.calls, 3);
  original.mounted.forEach(({ h }) => h.unmount());
  const destination = await requestScenario(['auth', 'profile'], coldTracker, 'SUPER_ADMIN');
  assert.equal(coldTracker.calls, 5);
  root.mounted.concat(destination.mounted).forEach(({ h }) => h.unmount());

  const warmTracker = { calls: 0, offline: false };
  const retainedShells = await requestScenario(['auth', 'auth'], warmTracker, 'SUPER_ADMIN');
  const before = warmTracker.calls;
  const page = await requestScenario(['profile'], warmTracker, 'SUPER_ADMIN');
  assert.equal(warmTracker.calls - before, 1);
  retainedShells.mounted.concat(page.mounted).forEach(({ h }) => h.unmount());
});

test('independent wrapper offline/retry never infers a role or changes another profile hook', async () => {
  const tracker = { calls: 0, offline: false };
  const scenario = await requestScenario(['auth', 'profile'], tracker);
  const { h, hook } = scenario.mounted[0];
  tracker.offline = true;
  (h.run(hook) as unknown as { retry: () => void }).retry();
  h.run(hook); h.flush(); await scenario.settle();
  const result = h.run(hook) as unknown as { auth: AuthState; retry: () => void };
  assert.equal(result.auth.status, 'unavailable');
  assert.equal('role' in result.auth, false);
  const other = scenario.mounted[1];
  assert.equal((other.h.run(other.hook) as unknown as { state: VendorProfileState }).state.status, 'ready');
  tracker.offline = false;
  result.retry(); h.run(hook); h.flush(); await scenario.settle();
  assert.equal((h.run(hook) as unknown as { auth: AuthState }).auth.status, 'signed-in');
  assert.equal(tracker.calls, 4); // Two initial reads plus two wrapper-only retries.
  scenario.mounted.forEach(({ h }) => h.unmount());
});

test('root shell loading/offline/login gates remain before wrapper mounting, including role-check races', () => {
  const root = harness();
  const appShell = root.load('components/app-shell.tsx').AppShell as Component;
  const marker = React.createElement('section', {}, 'MOCK_PROFILE_PAGE');
  for (const state of [{ status: 'loading' }, { status: 'unavailable' }, { status: 'signed-out' }] as AuthState[]) {
    root.setAuth(state);
    const tree = root.run(appShell, { children: marker });
    assert.ok(!nodes(tree).some((node) => node === marker));
    root.flush(true);
  }
  assert.deepEqual(root.replacements, ['/login']);
  for (const role of ['ORG_ADMIN', 'VENDOR'] as const) {
    root.setAuth(signedIn(role));
    assert.ok(nodes(root.run(appShell, { children: marker })).some((node) => node === marker));
    const wrapper = harness();
    const page = wrapper.load('app/profile/page.tsx').default as Component;
    for (const state of [{ status: 'loading' }, { status: 'unavailable' }, signedIn(role)] as AuthState[]) {
      wrapper.setAuth(state);
      assert.equal((wrapper.run(page) as Element).type, wrapper.load('components/profile-shop-screen.tsx').ProfileShopScreen);
      wrapper.flush();
    }
    assert.deepEqual(wrapper.replacements, []);
  }
});
