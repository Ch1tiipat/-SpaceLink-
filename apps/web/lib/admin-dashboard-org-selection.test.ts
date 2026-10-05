/* eslint-disable @typescript-eslint/no-require-imports -- Node runs TypeScript tests directly. */
import type { AdminDashboardSummary, CurrentUser } from './api';
import type { AdminOrganization } from './admin-organization-access';
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const { test }: typeof import('node:test') = require('node:test');
const ts: typeof import('typescript') = require('typescript');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const vm: typeof import('node:vm') = require('node:vm');
const React: typeof import('react') = require('react');
const { renderToStaticMarkup }: typeof import('react-dom/server') = require('react-dom/server');

type Membership = CurrentUser['organizations'][number];
type ElementProps = {
  children?: import('react').ReactNode;
  id?: string;
  type?: string;
  value?: string;
  disabled?: boolean;
  onChange?: (event: { target: { value: string } }) => void;
  onSubmit?: (event: { preventDefault: () => void }) => Promise<void>;
};
type Element = import('react').ReactElement<ElementProps>;
type Effect = () => void | (() => void);
type Request = {
  id: string;
  signal: AbortSignal;
  resolve: (value: AdminDashboardSummary) => void;
  reject: (cause: Error) => void;
};

function membership(id: string, role: Membership['membershipRole'] = 'OWNER'): Membership {
  return {
    id, name: id, membershipRole: role, promptpayId: '0812345678',
    facebookUrl: '', lineUrl: 'https://line.me/example',
    canEditQuota: true, canManagePayments: true, canManageZones: true,
    bookingQuotaPerVendor: 2,
  };
}

function summary(id: string): AdminDashboardSummary {
  return {
    organizationId: id,
    bookings: { pendingPayment: 1, confirmed: 7, cancelled: 0 },
    resources: { venues: 1, zones: 1, booths: 8 },
    events: { published: 1, upcoming: 1 },
    analytics: { bookingTrend: { day: [], week: [], month: [], year: [] } },
  };
}

function elements(tree: import('react').ReactNode): Element[] {
  const result: Element[] = [];
  React.Children.forEach(tree, (child) => {
    if (!React.isValidElement<ElementProps>(child)) return;
    result.push(child);
    result.push(...elements(child.props.children));
  });
  return result;
}

function screenHarness(
  screen: 'AdminDashboard' | 'AdminOrganizationSettings',
  role: CurrentUser['role'],
  memberships: Membership[],
) {
  const context = {
    organizations: ['org-a', 'org-b', 'org-c'].map((id): AdminOrganization => ({
      id, name: id, accessSource: 'SUPER_ADMIN', membershipRole: null,
      canEditQuota: false, canManagePayments: false, canManageZones: false,
    })),
    selectedOrganizationId: 'org-a',
    catalogStatus: 'ready',
    selectOrganization(id: string) { context.selectedOrganizationId = id; },
  };
  if (role === 'ORG_ADMIN') context.organizations = memberships.map((member) => ({
    ...member, accessSource: 'MEMBERSHIP',
  }));
  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  const effectSlots: Array<{ deps: unknown[]; cleanup?: () => void }> = [];
  const pending = new Map<number, Effect>();
  const timers = new Map<number, () => void>();
  let stateIndex = 0;
  let refIndex = 0;
  let effectIndex = 0;
  let nextTimerId = 0;
  let meCalls = 0;
  let meFailure: Error | null = null;
  let hangMe = false;
  const pendingWrites = new Map<string, Promise<unknown>>();
  const requests: Request[] = [];
  const writes: Array<{ kind: string; args: unknown[] }> = [];
  const router = { replace: () => undefined, push: () => undefined };
  const modules = new Map<string, { exports: Record<string, unknown> }>();
  const api = {
    async getMe() {
      meCalls++;
      if (hangMe) return new Promise<never>(() => undefined);
      if (meFailure) throw meFailure;
      return { role, organizations: memberships };
    },
    getAdminDashboardSummary(id: string, _token: string, signal: AbortSignal) {
      return new Promise<AdminDashboardSummary>((resolve, reject) => {
        requests.push({ id, signal, resolve, reject });
      });
    },
    async updateOrganizationPromptPay(...args: unknown[]) {
      writes.push({ kind: 'promptpay', args });
      return pendingWrites.get('promptpay') ?? { promptpayId: String(args[1]) };
    },
    async updateOrganizationSocialLinks(...args: unknown[]) {
      writes.push({ kind: 'social', args });
      return pendingWrites.get('social') ?? args[1];
    },
    async updateOrganizationBookingQuota(...args: unknown[]) {
      writes.push({ kind: 'quota', args });
      await pendingWrites.get('quota');
    },
  };
  function localRequire(id: string, from: string): unknown {
    if (id === 'react') return {
      ...React,
      useMemo: (factory: () => unknown) => factory(),
      useRef: (initial: unknown) => {
        const index = refIndex++;
        return refs[index] ?? (refs[index] = { current: initial });
      },
      useState: (initial: unknown) => {
        const index = stateIndex++;
        if (!(index in states)) states[index] = initial;
        return [states[index], (next: unknown) => {
          states[index] = typeof next === 'function' ? next(states[index]) : next;
        }];
      },
      useEffect: (effect: Effect, deps: unknown[]) => {
        const index = effectIndex++;
        const previous = effectSlots[index];
        if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))) {
          pending.set(index, effect);
          effectSlots[index] = { deps, cleanup: previous?.cleanup };
        }
      },
    };
    if (id === 'next/navigation') return { useRouter: () => router };
    if (id === '@/components/app-shell') return { useAdminOrganizationSelection: () => context };
    if (id === '@/components/admin-team-management') return { AdminTeamManagement: () => null };
    if (id === '@/lib/api' || (id === './api' && from.endsWith('network-error.ts'))) {
      return { ...api, ApiError };
    }
    if (id === '@/lib/supabase') return {
      getSupabaseBrowserClient: () => ({
        auth: { getSession: async () => ({
          data: { session: { access_token: 'fixture-token' } }, error: null,
        }) },
      }),
    };
    if (id.startsWith('@/')) return load(path.resolve(id.slice(2)));
    if (id.startsWith('./')) return load(path.resolve(path.dirname(from), id));
    return require(id);
  }
  function load(filename: string): Record<string, unknown> {
    const file = /\.tsx?$/.test(filename) ? filename
      : fs.existsSync(filename + '.tsx') ? filename + '.tsx' : filename + '.ts';
    const cached = modules.get(file);
    if (cached) return cached.exports;
    const result = { exports: {} as Record<string, unknown> };
    modules.set(file, result);
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, {
      module: result, exports: result.exports,
      require: (id: string) => localRequire(id, file),
      process, AbortController, DOMException, Error, TypeError, URL,
      window: {
        setTimeout: (callback: () => void) => {
          const id = ++nextTimerId;
          timers.set(id, callback);
          return id;
        },
        clearTimeout: (id: number) => timers.delete(id),
      },
    });
    return result.exports;
  }
  const { ApiError } = load(path.resolve('lib/api.ts')) as typeof import('./api');
  const file = screen === 'AdminDashboard' ? 'admin-dashboard' : 'admin-organization-settings';
  const component = load(path.resolve('components/' + file + '.tsx'))[screen] as () => Element;
  function render() {
    stateIndex = 0;
    refIndex = 0;
    effectIndex = 0;
    return component();
  }
  function flushEffects() {
    for (const [index, effect] of pending) {
      effectSlots[index].cleanup?.();
      effectSlots[index].cleanup = effect() || undefined;
    }
    pending.clear();
  }
  async function settle() {
    for (let i = 0; i < 5; i++) {
      render();
      flushEffects();
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    return render();
  }
  return {
    context, requests, writes, states, render, flushEffects, settle,
    html: () => renderToStaticMarkup(render()),
    meCalls: () => meCalls,
    failMe: () => { meFailure = new TypeError('Failed to fetch'); },
    hangMe: () => { hangMe = true; },
    timeout: () => { for (const callback of timers.values()) callback(); },
    delaySave: (promise: Promise<{ promptpayId: string }>) => { pendingWrites.set('promptpay', promise); },
    delayWrite: (kind: 'social' | 'quota', promise: Promise<unknown>) => { pendingWrites.set(kind, promise); },
  };
}

for (const memberships of [[], [membership('org-a')], [membership('org-a'), membership('org-b')]]) {
  test('dashboard uses the full shared catalog with ' + memberships.length + ' memberships', async () => {
    const harness = screenHarness('AdminDashboard', 'SUPER_ADMIN', memberships);
    const tree = await harness.settle();
    const dropdown = elements(tree).find((element) => element.type === 'select');
    assert.ok(dropdown);
    assert.deepEqual(elements(dropdown).filter((element) => element.type === 'option')
      .map((element) => element.props.value), ['org-a', 'org-b', 'org-c']);
    assert.equal(harness.requests[0].id, 'org-a');
    dropdown.props.onChange?.({ target: { value: 'org-c' } });
    assert.equal(harness.context.selectedOrganizationId, 'org-c');
    await harness.settle();
    assert.equal(harness.requests.at(-1)?.id, 'org-c');
    harness.context.selectOrganization('org-b');
    const switched = await harness.settle();
    assert.equal(elements(switched).find((element) => element.type === 'select')?.props.value, 'org-b');
    assert.equal(harness.meCalls(), 1, 'selection does not restart access verification');
  });
}

test('dashboard preserves ORG_ADMIN membership selection and no-organization', async () => {
  const harness = screenHarness('AdminDashboard', 'ORG_ADMIN', [membership('org-a')]);
  const tree = await harness.settle();
  const dropdown = elements(tree).find((element) => element.type === 'select');
  assert.deepEqual(elements(dropdown).filter((element) => element.type === 'option')
    .map((element) => element.props.value), ['org-a']);
  const empty = screenHarness('AdminDashboard', 'ORG_ADMIN', []);
  await empty.settle();
  assert.match(empty.html(), /ยังไม่มีองค์กรที่ดูแล/);
  assert.equal(empty.requests.length, 0);
});

test('dashboard fails closed for VENDOR, network failure and unavailable catalog', async () => {
  for (const scenario of ['vendor', 'network', 'catalog-error', 'catalog-unavailable']) {
    const harness = screenHarness('AdminDashboard', scenario === 'vendor' ? 'VENDOR' : 'SUPER_ADMIN', []);
    if (scenario === 'network') harness.failMe();
    if (scenario.startsWith('catalog-')) harness.context.catalogStatus = scenario.slice(8);
    await harness.settle();
    assert.equal(harness.requests.length, 0);
    assert.doesNotMatch(harness.html(), /<select/);
    assert.match(harness.html(), scenario === 'vendor' ? /ไม่มีสิทธิ์เข้าถึง/ : /ยังตรวจสอบสิทธิ์ไม่ได้/);
  }
});

test('dashboard auth timeout renders unavailable without dropdown or summary requests', async () => {
  const harness = screenHarness('AdminDashboard', 'SUPER_ADMIN', []);
  harness.hangMe();
  await harness.settle();
  harness.timeout();
  await harness.settle();
  assert.match(harness.html(), /ยังตรวจสอบสิทธิ์ไม่ได้/);
  assert.doesNotMatch(harness.html(), /<select/);
  assert.equal(harness.requests.length, 0);
});

test('dashboard clears old summary and ignores aborted completion, failure and finally', async () => {
  const harness = screenHarness('AdminDashboard', 'SUPER_ADMIN', []);
  await harness.settle();
  const first = harness.requests[0];
  first.resolve(summary('org-a'));
  await harness.settle();
  assert.ok(harness.states.some((value) => (value as AdminDashboardSummary | null)?.organizationId === 'org-a'));
  harness.context.selectOrganization('org-b');
  await harness.settle();
  assert.equal(first.signal.aborted, true);
  assert.ok(!harness.states.some((value) => (value as AdminDashboardSummary | null)?.organizationId === 'org-a'));
  const second = harness.requests.at(-1)!;
  harness.context.selectOrganization('org-c');
  await harness.settle();
  second.resolve(summary('org-b'));
  await harness.settle();
  assert.doesNotMatch(harness.html(), /โหลด Dashboard ไม่สำเร็จ/);
  assert.ok(!harness.states.some((value) => (value as AdminDashboardSummary | null)?.organizationId === 'org-b'));
  const third = harness.requests.at(-1)!;
  harness.context.selectOrganization('org-a');
  await harness.settle();
  third.reject(new Error('stale org-c error'));
  await harness.settle();
  assert.doesNotMatch(harness.html(), /stale org-c error|โหลด Dashboard ไม่สำเร็จ/);
  harness.requests.at(-1)!.resolve(summary('org-a'));
  await harness.settle();
  const calls = harness.requests.length;
  await harness.settle();
  assert.equal(harness.requests.length, calls, 'ordinary rerenders retain loaded data');
});

test('dashboard source removes membership-local wiring and uses shared hook/context', () => {
  const source = fs.readFileSync('components/admin-dashboard.tsx', 'utf8');
  assert.doesNotMatch(source, /getMe|me\.organizations|setOrganizations|selectGlobalOrganization/);
  assert.match(source, /useAdminPageAccess\(\)/);
  assert.match(source, /organizations, selectOrganization.*useAdminOrganizationSelection/);
  assert.match(source, /organizations\.map/);
  assert.match(source, /selectOrganization\(event.target.value\)/);
});

test('dashboard hides the previous organization error before selection effects run', async () => {
  const harness = screenHarness('AdminDashboard', 'SUPER_ADMIN', []);
  await harness.settle();
  harness.requests[0].reject(new Error('org-a summary failure'));
  await harness.settle();
  assert.match(harness.html(), /org-a summary failure/);

  harness.context.selectOrganization('org-b');
  const immediateHtml = harness.html();
  assert.doesNotMatch(immediateHtml, /org-a summary failure|โหลด Dashboard ไม่สำเร็จ/);
  assert.match(immediateHtml, /skeleton/);
  await harness.settle();
  harness.requests.at(-1)!.reject(new Error('org-b summary failure'));
  await harness.settle();
  assert.match(harness.html(), /org-b summary failure/);
});

test('dashboard initially shows loading before its first summary effect runs', async () => {
  const harness = screenHarness('AdminDashboard', 'SUPER_ADMIN', []);
  harness.render();
  harness.flushEffects();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(harness.requests.length, 0);
  const firstAllowedHtml = harness.html();
  assert.match(firstAllowedHtml, /skeleton/);
  assert.doesNotMatch(firstAllowedHtml, /โหลด Dashboard ไม่สำเร็จ|ไม่พบข้อมูลสรุปขององค์กร/);
  await harness.settle();
  assert.equal(harness.requests.length, 1);
});

test('settings clears non-member selection and rejects submissions before and after effects', async () => {
  const harness = screenHarness('AdminOrganizationSettings', 'SUPER_ADMIN', [membership('org-a')]);
  await harness.settle();
  assert.match(harness.html(), /0812345678/);
  harness.context.selectOrganization('org-c');
  const immediateTree = harness.render();
  const immediateForms = elements(immediateTree).filter((element) => element.type === 'form');
  assert.equal(immediateForms.length, 2);
  for (const form of immediateForms) await form.props.onSubmit?.({ preventDefault() {} });
  assert.equal(harness.writes.length, 0);
  await harness.settle();
  assert.match(harness.html(), /ไม่สามารถแก้ไของค์กรนี้ที่หน้านี้ได้/);
  for (const id of ['promptpay-id', 'organization-facebook-url', 'organization-line-url']) {
    assert.equal(elements(harness.render()).find((element) => element.type === 'input' && element.props.id === id)?.props.value, '');
  }
  const tree = harness.render();
  const buttons = elements(tree).filter((element) => element.type === 'button' && element.props.type === 'submit');
  assert.ok(buttons.length > 0);
  assert.ok(buttons.every((button) => button.props.disabled === true));
  for (const form of elements(tree).filter((element) => element.type === 'form')) {
    await form.props.onSubmit?.({ preventDefault() {} });
  }
  assert.equal(harness.writes.length, 0);
  harness.context.selectOrganization('org-a');
  await harness.settle();
  assert.match(harness.html(), /0812345678/);
  assert.ok(elements(harness.render()).filter((element) => element.props.type === 'submit')
    .every((button) => button.props.disabled === false));
});

test('settings guards stale member forms for ORG_ADMIN OWNER/ADMIN and then saves the selected member', async () => {
  for (const role of ['OWNER', 'ADMIN'] as const) {
    const harness = screenHarness('AdminOrganizationSettings', 'ORG_ADMIN', [
      membership('org-a', role), membership('org-b', role),
    ]);
    await harness.settle();
    harness.context.selectOrganization('org-b');
    for (const form of elements(harness.render()).filter((element) => element.type === 'form')) {
      await form.props.onSubmit?.({ preventDefault() {} });
    }
    assert.equal(harness.writes.length, 0);
    await harness.settle();
    for (const form of elements(harness.render()).filter((element) => element.type === 'form')) {
      await form.props.onSubmit?.({ preventDefault() {} });
    }
    assert.deepEqual(harness.writes.map((write) => write.kind), ['promptpay', 'social', 'quota']);
    assert.ok(harness.writes.every((write) => write.args[0] === 'org-b'));
  }
});

test('settings ignores late save response after switching to a non-member organization', async () => {
  const harness = screenHarness('AdminOrganizationSettings', 'SUPER_ADMIN', [membership('org-a')]);
  await harness.settle();
  let complete: (value: { promptpayId: string }) => void = () => undefined;
  harness.delaySave(new Promise((resolve) => { complete = resolve; }));
  const firstForm = elements(harness.render()).find((element) => element.type === 'form')!;
  const pendingSave = firstForm.props.onSubmit!({ preventDefault() {} });
  harness.context.selectOrganization('org-c');
  await harness.settle();
  complete({ promptpayId: '0899999999' });
  await pendingSave;
  await harness.settle();
  assert.doesNotMatch(harness.html(), /0899999999|บันทึกหมายเลข PromptPay เรียบร้อยแล้ว/);
  assert.equal(harness.writes.length, 1);
  assert.equal(harness.writes[0].args[0], 'org-a', 'only the request authorized before switching was sent');
});

for (const outcome of ['success', 'failure'] as const) {
  test('settings ignores old save ' + outcome + ' after switching away and returning to the same organization', async () => {
    const harness = screenHarness('AdminOrganizationSettings', 'SUPER_ADMIN', [membership('org-a')]);
    await harness.settle();
    let complete: (value: { promptpayId: string }) => void = () => undefined;
    let fail: (cause: Error) => void = () => undefined;
    harness.delaySave(new Promise((resolve, reject) => { complete = resolve; fail = reject; }));
    const firstForm = elements(harness.render()).find((element) => element.type === 'form')!;
    const pendingSave = firstForm.props.onSubmit!({ preventDefault() {} });
    harness.context.selectOrganization('org-c');
    await harness.settle();
    harness.context.selectOrganization('org-a');
    await harness.settle();
    const promptpay = elements(harness.render()).find((element) => element.props.id === 'promptpay-id')!;
    promptpay.props.onChange!({ target: { value: '0877777777' } });
    await harness.settle();

    if (outcome === 'success') complete({ promptpayId: '0899999999' });
    else fail(new Error('obsolete save failure'));
    await pendingSave;
    await harness.settle();
    assert.equal(elements(harness.render()).find((element) => element.props.id === 'promptpay-id')?.props.value, '0877777777');
    assert.doesNotMatch(harness.html(), /บันทึกหมายเลข PromptPay เรียบร้อยแล้ว|obsolete save failure/);
    assert.equal(harness.writes.length, 1);
  });
}

for (const kind of ['social', 'quota'] as const) {
  for (const outcome of ['success', 'failure'] as const) {
    test('settings ignores old ' + kind + ' ' + outcome + ' after returning to the same organization', async () => {
      const harness = screenHarness('AdminOrganizationSettings', 'ORG_ADMIN', [membership('org-a'), membership('org-b')]);
      await harness.settle();
      let complete: (value: unknown) => void = () => undefined;
      let fail: (cause: Error) => void = () => undefined;
      harness.delayWrite(kind, new Promise((resolve, reject) => { complete = resolve; fail = reject; }));
      const inputId = kind === 'social' ? 'organization-line-url' : 'booking-quota-per-vendor';
      const form = elements(harness.render()).find((element) => element.type === 'form'
        && elements(element).some((child) => child.props.id === inputId))!;
      const pendingSave = form.props.onSubmit!({ preventDefault() {} });
      harness.context.selectOrganization('org-b');
      await harness.settle();
      harness.context.selectOrganization('org-a');
      await harness.settle();
      const draft = kind === 'social' ? 'https://line.me/draft' : '7';
      elements(harness.render()).find((element) => element.props.id === inputId)!.props.onChange!({ target: { value: draft } });
      await harness.settle();

      if (outcome === 'success') complete({ facebookUrl: null, lineUrl: 'https://line.me/old-response' });
      else fail(new Error('obsolete ' + kind + ' failure'));
      await pendingSave;
      await harness.settle();
      assert.equal(elements(harness.render()).find((element) => element.props.id === inputId)?.props.value, draft);
      assert.doesNotMatch(harness.html(), /บันทึกช่องทางติดต่อขององค์กรเรียบร้อยแล้ว|บันทึกโควตาการจองเรียบร้อยแล้ว|obsolete .* failure/);
      assert.equal(harness.meCalls(), 1, 'an obsolete quota write does not start a membership refresh');
      assert.equal(harness.writes.length, 1);
      assert.equal(harness.writes[0].args[0], 'org-a');
    });
  }
}
