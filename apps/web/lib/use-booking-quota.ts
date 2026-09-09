'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getBookingQuotaContext,
  type BookingQuotaContext,
} from '@/lib/api';

export type BookingQuotaState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; value: BookingQuotaContext }
  | { status: 'error'; message: string };

const PREVIEW_QUOTA: BookingQuotaContext = {
  configuredQuota: 10,
  activeBookingCount: 0,
  remainingQuota: 10,
  effectiveSelectionLimit: 10,
};

/**
 * Reads the signed-in vendor's event quota from the server. Re-mounting a page,
 * changing the event, or calling refresh always performs a new lookup; the
 * browser never derives another vendor's count or treats its value as the final
 * booking guard.
 */
export function useBookingQuota(
  eventId: string | null,
  token: string | null,
  preview: boolean,
): { state: BookingQuotaState; refresh: () => void } {
  const requestKey = eventId && token ? `${eventId}:${token}` : null;
  const [stored, setStored] = useState<{
    key: string | null;
    state: BookingQuotaState;
  }>({ key: null, state: { status: 'idle' } });
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    void reloadCount;

    if (!eventId || !token) {
      setStored({ key: null, state: { status: 'idle' } });
      return;
    }
    if (preview) {
      setStored({
        key: requestKey,
        state: { status: 'ready', value: PREVIEW_QUOTA },
      });
      return;
    }

    const controller = new AbortController();
    let active = true;
    setStored({ key: requestKey, state: { status: 'loading' } });

    getBookingQuotaContext(eventId, token, controller.signal)
      .then((value) => {
        if (active) {
          setStored({
            key: requestKey,
            state: { status: 'ready', value },
          });
        }
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        if (active) {
          setStored({
            key: requestKey,
            state: {
              status: 'error',
              message:
                cause instanceof Error
                  ? cause.message
                  : 'ตรวจสอบโควตาการจองไม่สำเร็จ',
            },
          });
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [eventId, preview, reloadCount, requestKey, token]);

  const refresh = useCallback(() => setReloadCount((count) => count + 1), []);
  const state: BookingQuotaState =
    stored.key === requestKey
      ? stored.state
      : requestKey
        ? { status: 'loading' }
        : { status: 'idle' };

  return { state, refresh };
}
