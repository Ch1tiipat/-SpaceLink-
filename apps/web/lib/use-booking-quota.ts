'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
): { state: BookingQuotaState; refresh: () => Promise<BookingQuotaState> } {
  const requestKey = eventId && token ? `${eventId}:${token}` : null;
  const [stored, setStored] = useState<{
    key: string | null;
    state: BookingQuotaState;
  }>({ key: null, state: { status: 'idle' } });
  const requestIdRef = useRef(0);

  const load = useCallback(async (signal?: AbortSignal): Promise<BookingQuotaState> => {
    const requestId = ++requestIdRef.current;
    if (!eventId || !token) {
      const next: BookingQuotaState = { status: 'idle' };
      setStored({ key: null, state: next });
      return next;
    }
    if (preview) {
      const next: BookingQuotaState = {
        status: 'ready',
        value: PREVIEW_QUOTA,
      };
      setStored({ key: requestKey, state: next });
      return next;
    }

    setStored({ key: requestKey, state: { status: 'loading' } });
    try {
      const value = await getBookingQuotaContext(eventId, token, signal);
      const next: BookingQuotaState = { status: 'ready', value };
      if (requestIdRef.current === requestId && !signal?.aborted) {
        setStored({ key: requestKey, state: next });
      }
      return next;
    } catch (cause: unknown) {
      if (cause instanceof DOMException && cause.name === 'AbortError') {
        return { status: 'idle' };
      }
      const next: BookingQuotaState = {
        status: 'error',
        message:
          cause instanceof Error
            ? cause.message
            : 'ตรวจสอบโควตาการจองไม่สำเร็จ',
      };
      if (requestIdRef.current === requestId && !signal?.aborted) {
        setStored({ key: requestKey, state: next });
      }
      return next;
    }
  }, [eventId, preview, requestKey, token]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const refresh = useCallback(() => load(), [load]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [refresh]);
  const state: BookingQuotaState =
    stored.key === requestKey
      ? stored.state
      : requestKey
        ? { status: 'loading' }
        : { status: 'idle' };

  return { state, refresh };
}
