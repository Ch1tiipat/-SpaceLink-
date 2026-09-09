/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const { test }: typeof import('node:test') = require('node:test');
const {
  PushRegistrationTimeoutError,
  resolvePushRegistration,
} = require('./push-registration.ts') as typeof import('./push-registration');

const registration = {} as ServiceWorkerRegistration;

function serviceWorkerContainer({
  existing = null,
  ready = Promise.resolve(registration),
}: {
  existing?: ServiceWorkerRegistration | null;
  ready?: Promise<ServiceWorkerRegistration>;
} = {}) {
  return {
    getRegistration: async () => existing ?? undefined,
    ready,
  } as Pick<ServiceWorkerContainer, 'getRegistration' | 'ready'>;
}

test('returns an existing service worker registration immediately', async () => {
  const result = await resolvePushRegistration(
    serviceWorkerContainer({ existing: registration }),
    { waitForReady: true },
  );

  assert.equal(result, registration);
});

test('waits for a production registration when it becomes ready', async () => {
  const result = await resolvePushRegistration(serviceWorkerContainer(), {
    waitForReady: true,
    timeoutMs: 50,
  });

  assert.equal(result, registration);
});

test('returns null without waiting when registration is unavailable outside production', async () => {
  const result = await resolvePushRegistration(serviceWorkerContainer(), {
    waitForReady: false,
  });

  assert.equal(result, null);
});

test('rejects with a bounded timeout when service worker readiness never settles', async () => {
  const neverReady = new Promise<ServiceWorkerRegistration>(() => undefined);

  await assert.rejects(
    resolvePushRegistration(serviceWorkerContainer({ ready: neverReady }), {
      waitForReady: true,
      timeoutMs: 5,
    }),
    PushRegistrationTimeoutError,
  );
});

test('preserves registration lookup errors for the UI error state', async () => {
  const lookupError = new Error('registration lookup failed');
  const serviceWorker = {
    getRegistration: async () => {
      throw lookupError;
    },
    ready: Promise.resolve(registration),
  } as Pick<ServiceWorkerContainer, 'getRegistration' | 'ready'>;

  await assert.rejects(
    resolvePushRegistration(serviceWorker, { waitForReady: true }),
    lookupError,
  );
});
