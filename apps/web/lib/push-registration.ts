export const PUSH_REGISTRATION_TIMEOUT_MS = 5_000;
export const SYSTEM_BROADCAST_REFRESH_INTERVAL_MS = 30_000;
export const SYSTEM_BROADCAST_PUSH_MESSAGE = 'SPACELINK_PUSH_RECEIVED';

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

type BroadcastRecord = { id: string };

type EventListenerTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

type SystemBroadcastRefreshOptions<T extends BroadcastRecord> = {
  clearInterval: (handle: ReturnType<typeof setInterval>) => void;
  documentEvents: EventListenerTarget;
  fetchBroadcast: (signal: AbortSignal) => Promise<T | null>;
  getDismissedBroadcastId: () => string | null;
  isVisible: () => boolean;
  onBroadcast: (broadcast: T | null) => void;
  serviceWorkerEvents?: EventListenerTarget;
  setInterval: (
    callback: () => void,
    delay: number,
  ) => ReturnType<typeof setInterval>;
  windowEvents: EventListenerTarget;
};

export function createSystemBroadcastRefreshController<
  T extends BroadcastRecord,
>(
  options: SystemBroadcastRefreshOptions<T>,
): { dispose: () => void; refresh: () => Promise<void> } {
  let active = true;
  let controller: AbortController | null = null;

  async function refresh() {
    controller?.abort();
    const requestController = new AbortController();
    controller = requestController;

    try {
      const broadcast = await options.fetchBroadcast(requestController.signal);
      if (
        !active ||
        requestController.signal.aborted ||
        controller !== requestController
      ) {
        return;
      }

      if (
        !broadcast ||
        options.getDismissedBroadcastId() === broadcast.id
      ) {
        options.onBroadcast(null);
        return;
      }

      options.onBroadcast(broadcast);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      // Broadcasts are supplemental and must not replace page-level errors.
    }
  }

  const refreshWhenVisible = () => {
    if (options.isVisible()) void refresh();
  };
  const refreshAfterPush = (event: Event) => {
    if (
      'data' in event &&
      (event as MessageEvent).data?.type === SYSTEM_BROADCAST_PUSH_MESSAGE
    ) {
      void refresh();
    }
  };

  void refresh();
  const refreshInterval = options.setInterval(
    refreshWhenVisible,
    SYSTEM_BROADCAST_REFRESH_INTERVAL_MS,
  );
  options.windowEvents.addEventListener('focus', refreshWhenVisible);
  options.documentEvents.addEventListener(
    'visibilitychange',
    refreshWhenVisible,
  );
  options.serviceWorkerEvents?.addEventListener('message', refreshAfterPush);

  return {
    refresh,
    dispose() {
      active = false;
      controller?.abort();
      options.clearInterval(refreshInterval);
      options.windowEvents.removeEventListener('focus', refreshWhenVisible);
      options.documentEvents.removeEventListener(
        'visibilitychange',
        refreshWhenVisible,
      );
      options.serviceWorkerEvents?.removeEventListener(
        'message',
        refreshAfterPush,
      );
    },
  };
}
