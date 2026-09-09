export const PUSH_REGISTRATION_TIMEOUT_MS = 5_000;

type PushServiceWorkerContainer = Pick<
  ServiceWorkerContainer,
  'getRegistration' | 'ready'
>;

type ResolvePushRegistrationOptions = {
  timeoutMs?: number;
  waitForReady: boolean;
};

export class PushRegistrationTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Service worker registration was not ready within ${timeoutMs}ms`);
    this.name = 'PushRegistrationTimeoutError';
  }
}

export async function resolvePushRegistration(
  serviceWorker: PushServiceWorkerContainer,
  {
    timeoutMs = PUSH_REGISTRATION_TIMEOUT_MS,
    waitForReady,
  }: ResolvePushRegistrationOptions,
): Promise<ServiceWorkerRegistration | null> {
  const existing = await serviceWorker.getRegistration();
  if (existing || !waitForReady) return existing ?? null;

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      serviceWorker.ready,
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new PushRegistrationTimeoutError(timeoutMs));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}
