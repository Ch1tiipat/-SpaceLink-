/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const pushWorkerAssert: typeof import('node:assert/strict') = require(
  'node:assert/strict',
);
const { readFileSync: readPushWorkerFile }: typeof import('node:fs') =
  require('node:fs');
const { join: joinPushWorkerPath }: typeof import('node:path') =
  require('node:path');
const { test: pushWorkerTest }: typeof import('node:test') =
  require('node:test');
const { runInNewContext }: typeof import('node:vm') = require('node:vm');
const {
  createSystemBroadcastRefreshController,
  SYSTEM_BROADCAST_REFRESH_INTERVAL_MS,
  SYSTEM_BROADCAST_PUSH_MESSAGE,
} = require('./push-registration.ts') as typeof import('./push-registration');

type Broadcast = { id: string; title: string };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

pushWorkerTest('broadcast lifecycle executes push, visible timer, focus, and visibility refreshes', async () => {
  const windowEvents = new EventTarget();
  const documentEvents = new EventTarget();
  const serviceWorkerEvents = new EventTarget();
  const requests: AbortSignal[] = [];
  let intervalCallback: (() => void) | undefined;
  let intervalDelay: number | undefined;
  let visible = false;

  const controller = createSystemBroadcastRefreshController({
    clearInterval: () => undefined,
    documentEvents,
    async fetchBroadcast(signal) {
      requests.push(signal);
      return { id: String(requests.length), title: 'ประกาศ' };
    },
    getDismissedBroadcastId: () => null,
    isVisible: () => visible,
    onBroadcast: () => undefined,
    serviceWorkerEvents,
    setInterval(callback, delay) {
      intervalCallback = callback;
      intervalDelay = delay;
      return 1 as unknown as ReturnType<typeof setInterval>;
    },
    windowEvents,
  });

  await flushPromises();
  pushWorkerAssert.equal(requests.length, 1, 'initial refresh');
  pushWorkerAssert.equal(intervalDelay, SYSTEM_BROADCAST_REFRESH_INTERVAL_MS);

  intervalCallback?.();
  await flushPromises();
  pushWorkerAssert.equal(requests.length, 1, 'hidden polling is skipped');

  visible = true;
  intervalCallback?.();
  windowEvents.dispatchEvent(new Event('focus'));
  documentEvents.dispatchEvent(new Event('visibilitychange'));
  serviceWorkerEvents.dispatchEvent(
    new MessageEvent('message', {
      data: { type: SYSTEM_BROADCAST_PUSH_MESSAGE },
    }),
  );
  await flushPromises();
  pushWorkerAssert.equal(requests.length, 5);

  controller.dispose();
});

pushWorkerTest('broadcast lifecycle aborts stale work, ignores its late result, and cleans up', async () => {
  const windowEvents = new EventTarget();
  const documentEvents = new EventTarget();
  const serviceWorkerEvents = new EventTarget();
  const requests: Array<{
    result: ReturnType<typeof deferred<Broadcast | null>>;
    signal: AbortSignal;
  }> = [];
  const rendered: Array<Broadcast | null> = [];
  let clearedHandle: ReturnType<typeof setInterval> | undefined;

  const controller = createSystemBroadcastRefreshController({
    clearInterval: (handle) => {
      clearedHandle = handle;
    },
    documentEvents,
    fetchBroadcast(signal) {
      const result = deferred<Broadcast | null>();
      requests.push({ result, signal });
      return result.promise;
    },
    getDismissedBroadcastId: () => null,
    isVisible: () => true,
    onBroadcast: (broadcast) => rendered.push(broadcast),
    serviceWorkerEvents,
    setInterval: () => 42 as unknown as ReturnType<typeof setInterval>,
    windowEvents,
  });

  pushWorkerAssert.equal(requests.length, 1);
  serviceWorkerEvents.dispatchEvent(
    new MessageEvent('message', {
      data: { type: SYSTEM_BROADCAST_PUSH_MESSAGE },
    }),
  );
  pushWorkerAssert.equal(requests.length, 2);
  pushWorkerAssert.equal(requests[0].signal.aborted, true);

  requests[1].result.resolve({ id: 'new', title: 'ประกาศใหม่' });
  await flushPromises();
  requests[0].result.resolve({ id: 'old', title: 'ประกาศเก่า' });
  await flushPromises();
  pushWorkerAssert.deepEqual(rendered, [{ id: 'new', title: 'ประกาศใหม่' }]);

  controller.dispose();
  pushWorkerAssert.equal(requests[1].signal.aborted, true);
  pushWorkerAssert.equal(clearedHandle, 42);

  windowEvents.dispatchEvent(new Event('focus'));
  documentEvents.dispatchEvent(new Event('visibilitychange'));
  serviceWorkerEvents.dispatchEvent(
    new MessageEvent('message', {
      data: { type: SYSTEM_BROADCAST_PUSH_MESSAGE },
    }),
  );
  await flushPromises();
  pushWorkerAssert.equal(requests.length, 2, 'disposed listeners cannot refresh');
});

pushWorkerTest('dismissal hides only the matching broadcast and allows the next one', async () => {
  const serviceWorkerEvents = new EventTarget();
  const rendered: Array<Broadcast | null> = [];
  let dismissedId = 'old';
  const broadcasts: Broadcast[] = [
    { id: 'old', title: 'ประกาศเดิม' },
    { id: 'new', title: 'ประกาศใหม่' },
  ];

  const controller = createSystemBroadcastRefreshController({
    clearInterval: () => undefined,
    documentEvents: new EventTarget(),
    fetchBroadcast: async () => broadcasts.shift() ?? null,
    getDismissedBroadcastId: () => dismissedId,
    isVisible: () => true,
    onBroadcast: (broadcast) => rendered.push(broadcast),
    serviceWorkerEvents,
    setInterval: () => 1 as unknown as ReturnType<typeof setInterval>,
    windowEvents: new EventTarget(),
  });

  await flushPromises();
  pushWorkerAssert.deepEqual(rendered, [null]);

  dismissedId = 'old';
  serviceWorkerEvents.dispatchEvent(
    new MessageEvent('message', {
      data: { type: SYSTEM_BROADCAST_PUSH_MESSAGE },
    }),
  );
  await flushPromises();
  pushWorkerAssert.deepEqual(rendered, [
    null,
    { id: 'new', title: 'ประกาศใหม่' },
  ]);

  controller.dispose();
});

pushWorkerTest('service worker executes notification and fan-out for every open window inside waitUntil', async () => {
  const listeners = new Map<string, (event: Record<string, unknown>) => void>();
  const messages: unknown[] = [];
  const notifications: Array<{ options: unknown; title: string }> = [];
  const clients = [
    { postMessage: (message: unknown) => messages.push(message) },
    { postMessage: (message: unknown) => messages.push(message) },
  ];
  const matchedClients = deferred<typeof clients>();
  let matchOptions: unknown;
  let completion: Promise<unknown> | undefined;
  let waitUntilSettled = false;

  const serviceWorker = {
    addEventListener(type: string, listener: (event: Record<string, unknown>) => void) {
      listeners.set(type, listener);
    },
    clients: {
      matchAll(options: unknown) {
        matchOptions = options;
        return matchedClients.promise;
      },
      openWindow: async () => undefined,
    },
    location: { origin: 'https://space-link.example' },
    registration: {
      async showNotification(title: string, options: unknown) {
        notifications.push({ options, title });
      },
    },
  };

  const source = readPushWorkerFile(
    joinPushWorkerPath(process.cwd(), 'public', 'push-sw.js'),
    'utf8',
  );
  runInNewContext(source, { self: serviceWorker, URL });

  const pushListener = listeners.get('push');
  pushWorkerAssert.ok(pushListener);
  pushListener({
    data: {
      json: () => ({ body: 'รายละเอียด', title: 'หัวข้อ', url: '/notifications' }),
    },
    waitUntil: (promise: Promise<unknown>) => {
      completion = promise;
    },
  });

  pushWorkerAssert.ok(
    completion,
    'push handler must pass its work to waitUntil',
  );
  completion.then(() => {
    waitUntilSettled = true;
  });
  await flushPromises();
  pushWorkerAssert.equal(
    waitUntilSettled,
    false,
    'waitUntil must remain pending while client fan-out is pending',
  );
  pushWorkerAssert.equal(messages.length, 0);

  matchedClients.resolve(clients);
  await completion;
  pushWorkerAssert.equal(waitUntilSettled, true);
  pushWorkerAssert.equal(
    JSON.stringify(matchOptions),
    JSON.stringify({ type: 'window', includeUncontrolled: true }),
  );
  pushWorkerAssert.equal(notifications.length, 1);
  pushWorkerAssert.equal(notifications[0].title, 'หัวข้อ');
  pushWorkerAssert.equal(
    JSON.stringify(messages),
    JSON.stringify([
      { type: SYSTEM_BROADCAST_PUSH_MESSAGE },
      { type: SYSTEM_BROADCAST_PUSH_MESSAGE },
    ]),
  );
});

pushWorkerTest('worker forwards identity only, preserves PNG icon and opens the review destination', async () => {
  const listeners = new Map<string, (event: Record<string, unknown>) => void>();
  const messages: unknown[] = [];
  let shown: { data: { url: string; notificationId: string }; icon: string; tag: string } | undefined;
  let opened = '';
  let closed = false;
  let work: Promise<unknown> | undefined;
  runInNewContext(readPushWorkerFile(joinPushWorkerPath(process.cwd(), 'public', 'push-sw.js'), 'utf8'), {
    URL, self: {
      addEventListener: (type: string, listener: (event: Record<string, unknown>) => void) => listeners.set(type, listener),
      location: { origin: 'https://space-link.example' },
      registration: { showNotification: async (_title: string, options: typeof shown) => { shown = options; } },
      clients: { matchAll: async () => [{ url: 'https://space-link.example/', postMessage: (message: unknown) => messages.push(message) }],
        openWindow: async (url: string) => { opened = url; } },
    },
  });
  listeners.get('push')?.({ data: { json: () => ({ notificationId: 'new-review', title: 'รีวิว', body: 'รายละเอียด', url: '/bookings/booking-1/review' }) },
    waitUntil: (promise: Promise<unknown>) => { work = promise; } });
  await work;
  pushWorkerAssert.equal(shown?.icon, '/app-icon-192.png');
  pushWorkerAssert.equal(shown?.tag, 'new-review');
  pushWorkerAssert.equal(JSON.stringify(messages), JSON.stringify([{ type: SYSTEM_BROADCAST_PUSH_MESSAGE, notificationId: 'new-review' }]));
  listeners.get('notificationclick')?.({ notification: { data: shown?.data, close: () => { closed = true; } },
    waitUntil: (promise: Promise<unknown>) => { work = promise; } });
  await work;
  pushWorkerAssert.equal(closed, true);
  pushWorkerAssert.equal(opened, 'https://space-link.example/bookings/booking-1/review');
});
