/* eslint-disable @typescript-eslint/no-require-imports -- Node runs TypeScript tests directly. */
import type { OrganizationTeamMember } from './api';
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const { test }: typeof import('node:test') = require('node:test');
const ts: typeof import('typescript') = require('typescript');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const vm: typeof import('node:vm') = require('node:vm');
const React: typeof import('react') = require('react');
const { renderToStaticMarkup }: typeof import('react-dom/server') = require('react-dom/server');

type Effect = () => void | (() => void);
type Props = {
  children?: import('react').ReactNode;
  disabled?: boolean;
  checked?: boolean;
  onChange?: (event?: { target: { value: string } }) => void;
  onClick?: () => void;
  onSubmit?: (event: { preventDefault: () => void }) => Promise<void>;
};
type Element = import('react').ReactElement<Props>;
function nodes(tree: import('react').ReactNode): Element[] {
  const found: Element[] = [];
  React.Children.forEach(tree, (child) => {
    if (!React.isValidElement<Props>(child)) return;
    found.push(child, ...nodes(child.props.children));
  });
  return found;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function member(name: string, role: OrganizationTeamMember['role'] = 'ADMIN'): OrganizationTeamMember {
  return {
    id: name, role, canEditQuota: false, canManagePayments: false, canManageZones: false,
    joinedAt: '2026-10-05T00:00:00Z',
    user: { id: name, fullName: name, email: name + '@example.invalid' },
  };
}

// Exercise the real component with controlled hooks and API promises. Requests
// deliberately ignore AbortSignal, proving correctness without relying on fetch.
function harness(membershipRole: 'OWNER' | 'ADMIN' | null = 'OWNER') {
  const access = {
    access: 'allowed', token: 'mock-token', organizationId: 'org-a',
    organization: { membershipRole },
  };
  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  const memos: Array<{ deps: unknown[]; value: unknown }> = [];
  const effects: Array<{ deps: unknown[]; cleanup?: () => void }> = [];
  const pending = new Map<number, Effect>();
  const requests: Array<ReturnType<typeof deferred<OrganizationTeamMember[]>> & {
    organizationId: string; signal?: AbortSignal;
  }> = [];
  const writes: Array<ReturnType<typeof deferred<OrganizationTeamMember>> & {
    kind: string; organizationId: string;
  }> = [];
  let stateIndex = 0, refIndex = 0, memoIndex = 0, effectIndex = 0;
  const changed = (before: unknown[], after: unknown[]) =>
    before.length !== after.length || after.some((dep, i) => !Object.is(dep, before[i]));
  function memo(factory: () => unknown, deps: unknown[]) {
    const index = memoIndex++;
    if (!memos[index] || changed(memos[index].deps, deps)) {
      memos[index] = { deps, value: factory() };
    }
    return memos[index].value;
  }
  const hooks = {
    ...React,
    useState(initial: unknown) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (next: unknown) => {
        states[index] = typeof next === 'function' ? next(states[index]) : next;
      }];
    },
    useRef(initial: unknown) {
      const index = refIndex++;
      return refs[index] ?? (refs[index] = { current: initial });
    },
    useMemo: memo,
    useCallback: (callback: unknown, deps: unknown[]) => memo(() => callback, deps),
    useEffect(effect: Effect, deps: unknown[]) {
      const index = effectIndex++;
      if (!effects[index] || changed(effects[index].deps, deps)) {
        pending.set(index, effect);
        effects[index] = { deps, cleanup: effects[index]?.cleanup };
      }
    },
  };
  function write(kind: string, organizationId: string) {
    const call = { kind, organizationId, ...deferred<OrganizationTeamMember>() };
    writes.push(call);
    return call.promise;
  }
  const api = {
    getOrganizationTeam(organizationId: string, _token: string, signal?: AbortSignal) {
      const call = { organizationId, signal, ...deferred<OrganizationTeamMember[]>() };
      requests.push(call);
      return call.promise;
    },
    addOrganizationAdmin: (id: string) => write('add', id),
    updateOrganizationAdminPermissions: (id: string) => write('permission', id),
    removeOrganizationAdmin: (id: string) => write('remove', id),
  };
  const result = { exports: {} as { AdminTeamManagement: () => Element | null } };
  const filename = path.resolve('components/admin-team-management.tsx');
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    module: result, exports: result.exports,
    require: (id: string) => {
      if (id === 'react') return hooks;
      if (id === '@/components/admin-ui') return { useAdminPageAccess: () => access };
      if (id === '@/lib/api') return api;
      return require(id);
    },
    AbortController, DOMException, Error, window: { confirm: () => true },
  });
  function render() {
    stateIndex = refIndex = memoIndex = effectIndex = 0;
    return result.exports.AdminTeamManagement();
  }
  function flush() {
    for (const [index, effect] of pending) {
      effects[index].cleanup?.();
      effects[index].cleanup = effect() || undefined;
    }
    pending.clear();
  }
  async function settle() {
    render(); flush();
    await new Promise<void>((resolve) => setImmediate(resolve));
    return render();
  }
  async function switchTo(id: string) {
    access.organizationId = id;
    return settle();
  }
  return {
    access, requests, writes, render, settle, switchTo,
    html: () => renderToStaticMarkup(render()),
    unmount: () => effects.forEach((effect) => effect.cleanup?.()),
  };
}

test('team rows disappear on the first render of a new organization, before effects', async () => {
  const h = harness(); await h.settle();
  h.requests[0].resolve([member('old-a')]); await h.settle();
  assert.match(h.html(), /old-a/);
  h.access.organizationId = 'org-b';
  assert.doesNotMatch(h.html(), /old-a/, 'no old member may render under the new Header');
  await h.settle();
  assert.equal(h.requests[0].signal?.aborted, true);
  h.requests[1].resolve([member('new-b')]); await h.settle();
  assert.match(h.html(), /new-b/);
});

test('A -> B -> A never accepts a response from the first A, even if it ignores abort', async () => {
  const h = harness(); await h.settle();
  await h.switchTo('org-b'); await h.switchTo('org-a');
  assert.deepEqual(h.requests.map((call) => call.organizationId), ['org-a', 'org-b', 'org-a']);
  h.requests[2].resolve([member('current-a')]); await h.settle();
  h.requests[0].resolve([member('obsolete-a')]);
  h.requests[1].resolve([member('obsolete-b')]); await h.settle();
  assert.match(h.html(), /current-a/);
  assert.doesNotMatch(h.html(), /obsolete-/);
});

test('old rejection after returning to A cannot replace current feedback', async () => {
  const h = harness(); await h.settle();
  await h.switchTo('org-b'); await h.switchTo('org-a');
  h.requests[2].resolve([member('current-a')]); await h.settle();
  h.requests[0].reject(new Error('obsolete-error')); await h.settle();
  assert.doesNotMatch(h.html(), /obsolete-error/);
  assert.match(h.html(), /current-a/);
});

test('token changes hide prior account rows; access loss hides the team and does not fetch', async () => {
  const h = harness(); await h.settle();
  h.requests[0].resolve([member('first-session')]); await h.settle();
  h.access.token = 'new-mock-token';
  assert.doesNotMatch(h.html(), /first-session/);
  await h.settle();
  h.requests[1].resolve([member('second-session')]); await h.settle();
  h.access.access = 'denied'; await h.settle();
  assert.equal(h.html(), ''); assert.equal(h.requests.length, 2);
});

test('new-organization load failure shows its error without old rows or errors', async () => {
  const h = harness(); await h.settle();
  h.requests[0].resolve([member('old-a')]); await h.settle();
  await h.switchTo('org-b');
  h.requests[1].reject(new Error('current-load-error')); await h.settle();
  assert.match(h.html(), /current-load-error/);
  assert.doesNotMatch(h.html(), /old-a/);
  h.access.organizationId = 'org-c';
  assert.doesNotMatch(h.html(), /current-load-error/);
});

for (const kind of ['add', 'permission', 'remove']) {
  for (const outcome of ['resolve', 'reject']) {
    test('obsolete ' + kind + ' ' + outcome + ' cannot affect a new A round', async () => {
      const h = harness(); await h.settle();
      h.requests[0].resolve([member('original')]); await h.settle();
      let action: Promise<void> | undefined;
      if (kind === 'add') {
        nodes(h.render()).find((node) => node.type === 'input')?.props.onChange?.({ target: { value: 'mock@example.invalid' } });
        action = nodes(h.render()).find((node) => node.type === 'form')?.props.onSubmit?.({ preventDefault() {} });
      } else if (kind === 'permission') {
        nodes(h.render()).find((node) => typeof node.type === 'function' && node.type.name === 'PermissionToggle')?.props.onChange?.();
      } else {
        nodes(h.render()).find((node) => node.type === 'button' && node.props.onClick)?.props.onClick?.();
      }
      assert.equal(h.writes.length, 1); assert.equal(h.writes[0].organizationId, 'org-a');
      await h.switchTo('org-b'); await h.switchTo('org-a');
      h.requests[2].resolve([member('original'), member('current-only')]); await h.settle();
      if (outcome === 'resolve') h.writes[0].resolve({ ...member('original'), canManagePayments: true });
      else h.writes[0].reject(new Error('obsolete-write-error'));
      await action; await h.settle();
      assert.equal(h.requests.length, 3, 'old add completion must not refresh the new round');
      assert.match(h.html(), /current-only/); assert.match(h.html(), /original/);
      assert.doesNotMatch(h.html(), /obsolete-write-error/);
      const toggles = nodes(h.render()).filter((node) => typeof node.type === 'function' && node.type.name === 'PermissionToggle');
      assert.ok(toggles.every((node) => node.props.checked === false));
    });
  }
}

test('latest refresh in one scope wins over an older pending GET', async () => {
  const h = harness(); await h.settle();
  nodes(h.render()).find((node) => node.type === 'input')?.props.onChange?.({ target: { value: 'mock@example.invalid' } });
  const action = nodes(h.render()).find((node) => node.type === 'form')?.props.onSubmit?.({ preventDefault() {} });
  h.writes[0].resolve(member('added')); await h.settle();
  assert.equal(h.requests.length, 2);
  h.requests[1].resolve([member('latest')]); await action; await h.settle();
  h.requests[0].resolve([member('outdated-result')]); await h.settle();
  assert.match(h.html(), /latest/); assert.doesNotMatch(h.html(), /outdated-result/);
});

test('ADMIN and SUPER_ADMIN without OWNER membership keep read-only team controls', async () => {
  for (const role of ['ADMIN', null] as const) {
    const h = harness(role); await h.settle();
    h.requests[0].resolve([member('teammate')]); await h.settle();
    const tree = nodes(h.render());
    assert.equal(tree.some((node) => node.type === 'form'), false);
    const toggles = tree.filter((node) => typeof node.type === 'function' && node.type.name === 'PermissionToggle');
    assert.equal(toggles.length, 2);
    assert.ok(toggles.every((node) => node.props.disabled));
    toggles[0].props.onChange?.(); await h.settle();
    assert.equal(h.writes.length, 0, 'a stale/forced handler must not expand write rights');
  }
});

test('unmounted component ignores a late successful response', async () => {
  const h = harness(); await h.settle(); h.unmount();
  h.requests[0].resolve([member('late-unmounted')]);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.doesNotMatch(h.html(), /late-unmounted/);
});
