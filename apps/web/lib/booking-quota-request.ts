export const BOOKING_QUOTA_REQUEST_TIMEOUT_MS = 10_000;

export class BookingQuotaTimeoutError extends Error {
  constructor() {
    super('ตรวจสอบโควตานานเกินไป กรุณาลองอีกครั้ง');
    this.name = 'BookingQuotaTimeoutError';
  }
}

function createAbortError(signal: AbortSignal): DOMException {
  return signal.reason instanceof DOMException
    ? signal.reason
    : new DOMException('The operation was aborted.', 'AbortError');
}

/**
 * Bounds quota lookups so a stalled API connection cannot leave booth
 * selection in the loading state forever. The signal passed to `request` is
 * aborted for both caller cancellation and timeout cleanup.
 */
export function requestBookingQuotaWithTimeout<T>(
  request: (signal: AbortSignal) => Promise<T>,
  {
    signal,
    timeoutMs = BOOKING_QUOTA_REQUEST_TIMEOUT_MS,
  }: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError(signal));
      return;
    }

    const requestController = new AbortController();
    let settled = false;

    const cleanup = () => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', handleCallerAbort);
    };
    const settle = (action: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      action();
    };
    const handleCallerAbort = () => {
      settle(() => {
        requestController.abort(signal?.reason);
        reject(
          signal
            ? createAbortError(signal)
            : new DOMException('The operation was aborted.', 'AbortError'),
        );
      });
    };

    signal?.addEventListener('abort', handleCallerAbort, { once: true });
    const timeout = setTimeout(() => {
      settle(() => {
        requestController.abort();
        reject(new BookingQuotaTimeoutError());
      });
    }, timeoutMs);

    Promise.resolve()
      .then(() => request(requestController.signal))
      .then(
        (value) => settle(() => resolve(value)),
        (cause: unknown) => settle(() => reject(cause)),
      );
  });
}
