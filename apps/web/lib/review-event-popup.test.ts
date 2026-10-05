/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const reviewPopupAssert: typeof import('node:assert/strict') = require('node:assert/strict');
const reviewPopupFs: typeof import('node:fs') = require('node:fs');
const reviewPopupPath: typeof import('node:path') = require('node:path');
const reviewPopupVm: typeof import('node:vm') = require('node:vm');
const reviewPopupTs: typeof import('typescript') = require('typescript');
const { test: reviewPopupTest }: typeof import('node:test') = require('node:test');

const reviewPopupSource = reviewPopupFs.readFileSync(
  reviewPopupPath.join(process.cwd(), 'components', 'my-reviews-screen.tsx'), 'utf8',
);
const sharedPopupSource = reviewPopupFs.readFileSync(
  reviewPopupPath.join(process.cwd(), 'components', 'event-details-popup.tsx'), 'utf8',
);
const adapterSource = reviewPopupSource.slice(
  reviewPopupSource.indexOf('function ReviewEventPopup({'),
  reviewPopupSource.indexOf('function SummaryCard({'),
);

type TestElement = { type: unknown; props: Record<string, unknown> };
type MapFixture = { event: { id: string; slug: string; organization: { id: string } }; zones: { categories: { id: string; name: string }[] }[] };

function makeReviewPopupHarness(request: (id: string, signal: AbortSignal) => Promise<MapFixture>, newsFails = false) {
  const states: unknown[] = [];
  const effects: (() => void | (() => void))[] = [];
  const effectSlots: { deps: unknown[]; cleanup?: void | (() => void) }[] = [];
  const calls: string[] = [];
  const sharedPopup = () => null;
  let cursor = 0;
  let effectCursor = 0;
  const dialog = { open: false, showModal() { this.open = true; }, close() { this.open = false; } };
  const documentStub = { body: { style: { overflow: 'auto' } } };
  const reactStub = {
    useState(initial: unknown) {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value: unknown) => {
        states[index] = typeof value === 'function' ? value(states[index]) : value;
      }];
    },
    useRef: () => ({ current: dialog }),
    useEffect(effect: () => void | (() => void), deps: unknown[]) {
      const index = effectCursor++;
      const previous = effectSlots[index];
      if (previous && deps.every((value, i) => Object.is(value, previous.deps[i]))) return;
      effects.push(() => {
        previous?.cleanup?.();
        effectSlots[index] = { deps, cleanup: effect() };
      });
    },
  };
  const moduleStub = { exports: {} as { popup: (props: object) => TestElement } };
  const compiled = reviewPopupTs.transpileModule(
    adapterSource + '\nexports.popup = ReviewEventPopup;',
    { compilerOptions: { jsx: reviewPopupTs.JsxEmit.ReactJSX, target: reviewPopupTs.ScriptTarget.ES2020, module: reviewPopupTs.ModuleKind.CommonJS } },
  ).outputText;
  // Run the production adapter with controlled API responses, without a real account/database.
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  reviewPopupVm.runInNewContext(compiled, {
    exports: moduleStub.exports, AbortController, Error,
    document: documentStub,
    ...reactStub,
    require: () => ({ jsx, jsxs: jsx, Fragment: 'fragment' }),
    EventPopup: sharedPopup,
    isUuid: (id: string) => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id),
    X: () => null,
    getEventMap: (id: string, signal: AbortSignal) => { calls.push('uuid'); return request(id, signal); },
    getEventMapBySlug: (id: string, signal: AbortSignal) => { calls.push('slug'); return request(id, signal); },
    getPublicAnnouncements: async (id: string) => {
      calls.push('news:' + id);
      if (newsFails) throw new Error('News unavailable');
      return [{ id: 'news-1', eventId: 'event-1' }];
    },
  });
  return {
    calls, states, dialog, documentStub, sharedPopup,
    render() {
      cursor = 0;
      effectCursor = 0;
      return moduleStub.exports.popup({ eventId: 'demo-event', eventName: 'Demo', onClose() {} });
    },
    renderId(eventId: string) {
      cursor = 0;
      effectCursor = 0;
      return moduleStub.exports.popup({ eventId, eventName: 'Demo', onClose() {} });
    },
    mountEffects() {
      for (const effect of effects.splice(0)) {
        effect();
      }
    },
    cleanup() { [...effectSlots].reverse().forEach((slot) => slot.cleanup?.()); },
  };
}

const popupMapFixture: MapFixture = {
  event: { id: 'event-1', slug: 'canonical-event', organization: { id: 'org-1' } },
  zones: [
    { categories: [{ id: 'food', name: 'Food' }] },
    { categories: [{ id: 'food', name: 'Food' }, { id: 'fashion', name: 'Fashion' }] },
  ],
};
async function settleReviewPopup() {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

reviewPopupTest('home and reviews share the approved popup, with no old detail renderer or route replacement', () => {
  reviewPopupAssert.match(reviewPopupSource, /import \{ EventPopup \} from '@\/components\/event-details-popup'/);
  reviewPopupAssert.doesNotMatch(reviewPopupSource, /EventDetailContent|Event preview|syncCanonicalRoute|router\.replace/);
  reviewPopupAssert.match(reviewPopupSource, /eventReturnFocusRef\.current\?\.focus\(\)/);
  reviewPopupAssert.match(sharedPopupSource, /\$\{summary\.availableBooths\} จาก \$\{summary\.totalBooths\} บูธ/);
  reviewPopupAssert.match(sharedPopupSource, /initialMap\) return \(\) => controller\.abort/);
  reviewPopupAssert.match(sharedPopupSource, /onCancel=/);
});

reviewPopupTest('slug details use resolved canonical data, unique categories and the fetched map without a second request', async () => {
  const harness = makeReviewPopupHarness(async () => popupMapFixture);
  const loading = harness.render();
  reviewPopupAssert.equal(loading.type, 'dialog');
  harness.mountEffects();
  reviewPopupAssert.equal(harness.dialog.open, true);
  await settleReviewPopup();
  const ready = harness.render();
  reviewPopupAssert.equal(ready.type, harness.sharedPopup);
  reviewPopupAssert.equal(ready.props.initialMap, popupMapFixture);
  const event = ready.props.event as { slug: string; categories: { id: string }[] };
  reviewPopupAssert.equal(event.slug, 'canonical-event');
  reviewPopupAssert.equal(JSON.stringify(event.categories.map((category) => category.id)), '["food","fashion"]');
  reviewPopupAssert.deepEqual(harness.calls, ['slug', 'news:org-1']);
  reviewPopupAssert.equal((ready.props.announcements as unknown[]).length, 1);
  (ready.props.onRequestClose as () => void)();
  reviewPopupAssert.equal(harness.dialog.open, false);
  harness.cleanup();
  reviewPopupAssert.equal(harness.documentStub.body.style.overflow, 'auto');
});

reviewPopupTest('legacy UUID lookup still works and optional news failure does not hide details', async () => {
  const harness = makeReviewPopupHarness(async () => popupMapFixture, true);
  harness.renderId('11111111-1111-4111-8111-111111111111');
  harness.mountEffects();
  await settleReviewPopup();
  const ready = harness.render();
  reviewPopupAssert.equal(ready.type, harness.sharedPopup);
  reviewPopupAssert.deepEqual(harness.calls, ['uuid', 'news:org-1']);
  harness.cleanup();
});

reviewPopupTest('closing during loading aborts the request and ignores a late successful response', async () => {
  let resolveMap!: (map: MapFixture) => void;
  let signal!: AbortSignal;
  const harness = makeReviewPopupHarness((_id, requestSignal) => {
    signal = requestSignal;
    return new Promise((resolve) => { resolveMap = resolve; });
  });
  harness.render();
  harness.mountEffects();
  harness.cleanup();
  reviewPopupAssert.equal(signal.aborted, true);
  resolveMap(popupMapFixture);
  await settleReviewPopup();
  reviewPopupAssert.equal((harness.states[0] as { status: string }).status, 'loading');
  reviewPopupAssert.deepEqual(harness.calls, ['slug']);
});

reviewPopupTest('failed details stay in a closable dialog and expose an error rather than invented data', async () => {
  const harness = makeReviewPopupHarness(async () => { throw new Error('Event not found'); });
  harness.render();
  harness.mountEffects();
  await settleReviewPopup();
  const failed = harness.render();
  reviewPopupAssert.equal(failed.type, 'dialog');
  reviewPopupAssert.equal((harness.states[0] as { message: string }).message, 'Event not found');
  reviewPopupAssert.match(adapterSource, /role="alert"/);
  reviewPopupAssert.match(adapterSource, /ลองโหลดอีกครั้ง/);
  reviewPopupAssert.match(adapterSource, /onClose=\{onClose\}/);
  harness.cleanup();
});

function findPopupElement(element: TestElement, predicate: (node: TestElement) => boolean): TestElement | undefined {
  if (predicate(element)) return element;
  const children = element.props.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child && typeof child === 'object' && 'props' in child) {
      const found = findPopupElement(child, predicate);
      if (found) return found;
    }
  }
}

reviewPopupTest('retry starts a fresh request, aborts the old one and shows resolved details', async () => {
  const signals: AbortSignal[] = [];
  const harness = makeReviewPopupHarness(async (_id, signal) => {
    signals.push(signal);
    if (signals.length === 1) throw new Error('Temporary failure');
    return popupMapFixture;
  });
  harness.render();
  harness.mountEffects();
  await settleReviewPopup();
  const failed = harness.render();
  harness.mountEffects();
  const retry = findPopupElement(failed, (node) => node.type === 'button' && node.props.children === 'ลองโหลดอีกครั้ง');
  reviewPopupAssert.ok(retry);
  (retry.props.onClick as () => void)();
  harness.render();
  harness.mountEffects();
  reviewPopupAssert.equal(signals[0].aborted, true);
  reviewPopupAssert.equal((harness.states[0] as { status: string }).status, 'loading');
  await settleReviewPopup();
  const ready = harness.render();
  harness.mountEffects();
  reviewPopupAssert.equal(ready.type, harness.sharedPopup);
  reviewPopupAssert.equal(harness.documentStub.body.style.overflow, 'auto');
  reviewPopupAssert.deepEqual(harness.calls, ['slug', 'slug', 'news:org-1']);
  harness.cleanup();
  reviewPopupAssert.equal(signals[1].aborted, true);
});

reviewPopupTest('aborted late failure is ignored and does not replace loading with an error', async () => {
  let rejectMap!: (cause: Error) => void;
  const harness = makeReviewPopupHarness(() => new Promise((_resolve, reject) => { rejectMap = reject; }));
  harness.render();
  harness.mountEffects();
  harness.cleanup();
  rejectMap(new Error('Late failure'));
  await settleReviewPopup();
  reviewPopupAssert.equal((harness.states[0] as { status: string }).status, 'loading');
  reviewPopupAssert.deepEqual(harness.calls, ['slug']);
});

reviewPopupTest('shared popup wraps Tab and Shift+Tab in details and map viewer, ignoring hidden controls', () => {
  const start = sharedPopupSource.indexOf('onKeyDown={(keyEvent) => {');
  const end = sharedPopupSource.indexOf('onClick={(clickEvent)', start);
  const handler = sharedPopupSource.slice(start, end)
    .replace('onKeyDown={(keyEvent) => {', 'exports.handler = (keyEvent) => {')
    .replace(/\}\}\s*$/, '};');
  for (const mapViewerOpen of [false, true]) {
    const documentStub: { activeElement: unknown } = { activeElement: null };
    const first = { getClientRects: () => [1], focus() { documentStub.activeElement = first; } };
    const last = { getClientRects: () => [1], focus() { documentStub.activeElement = last; } };
    const hidden = { getClientRects: () => [], focus() { throw new Error('Hidden control must not receive focus'); } };
    const scope = { querySelectorAll: () => [first, last, hidden], contains: (element: unknown) => element === first || element === last };
    const dialog = { ...scope, querySelector: () => scope };
    const exportsStub = {} as { handler: (event: { key: string; shiftKey: boolean; preventDefault: () => void }) => void };
    reviewPopupVm.runInNewContext(reviewPopupTs.transpileModule(handler, { compilerOptions: { target: reviewPopupTs.ScriptTarget.ES2020 } }).outputText, {
      exports: exportsStub, atmosphereIndex: null, mapViewerOpen,
      dialogRef: { current: dialog }, document: documentStub,
    });
    let prevented = 0;
    documentStub.activeElement = first;
    exportsStub.handler({ key: 'Tab', shiftKey: true, preventDefault: () => prevented++ });
    reviewPopupAssert.equal(documentStub.activeElement, last);
    exportsStub.handler({ key: 'Tab', shiftKey: false, preventDefault: () => prevented++ });
    reviewPopupAssert.equal(documentStub.activeElement, first);
    reviewPopupAssert.equal(prevented, 2);
  }
});
