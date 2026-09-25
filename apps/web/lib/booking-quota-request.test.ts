/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const quotaRequestAssert: typeof import('node:assert/strict') =
  require('node:assert/strict');
const { test: quotaRequestTest }: typeof import('node:test') =
  require('node:test');
const {
  BookingQuotaTimeoutError,
  requestBookingQuotaWithTimeout,
} =
  require('./booking-quota-request.ts') as typeof import('./booking-quota-request');

quotaRequestTest('returns a quota response that arrives before timeout', async () => {
  const quota = await requestBookingQuotaWithTimeout(
    async () => ({ effectiveSelectionLimit: 2 }),
    { timeoutMs: 100 },
  );

  quotaRequestAssert.deepEqual(quota, { effectiveSelectionLimit: 2 });
});

quotaRequestTest(
  'fails a stalled quota request instead of leaving loading active forever',
  async () => {
    let requestSignal: AbortSignal | undefined;
    const pending = requestBookingQuotaWithTimeout(
      async (signal) => {
        requestSignal = signal;
        return new Promise<never>(() => undefined);
      },
      { timeoutMs: 5 },
    );

    await quotaRequestAssert.rejects(pending, BookingQuotaTimeoutError);
    quotaRequestAssert.equal(requestSignal?.aborted, true);
  },
);

quotaRequestTest('keeps caller cancellation distinct from a timeout', async () => {
  const controller = new AbortController();
  const pending = requestBookingQuotaWithTimeout(
    async () => new Promise<never>(() => undefined),
    { signal: controller.signal, timeoutMs: 100 },
  );

  controller.abort();

  await quotaRequestAssert.rejects(
    pending,
    (cause: unknown) =>
      cause instanceof DOMException && cause.name === 'AbortError',
  );
});
