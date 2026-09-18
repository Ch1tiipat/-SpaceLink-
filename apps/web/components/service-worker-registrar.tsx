'use client';

import { useEffect } from 'react';

/**
 * Registers the next-pwa service worker.
 *
 * next-pwa@5.6.0 injects its own registration script into the `main.js`
 * webpack entry (`node_modules/next-pwa/index.js`), and only the Pages Router
 * loads that entry. This app is App Router only, so the injected script never
 * ran: `/sw.js` was built and deployed but never registered. Everything that
 * depends on an active worker was therefore dead in production — the offline
 * document fallback, runtime caching, and push notifications, whose
 * availability check timed out waiting on `navigator.serviceWorker.ready`, a
 * promise that stays pending forever when no registration exists.
 *
 * Registering from a client component puts the call in an entry the App Router
 * actually loads. `register: false` in next.config.mjs keeps next-pwa from
 * injecting its copy, so registration has exactly one owner.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // next-pwa does not emit /sw.js in development (`disable` in
    // next.config.mjs), so registering there would only request a 404.
    if (process.env.NODE_ENV !== 'production') return;

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((cause) => {
      // The app stays fully usable online without a worker, so this must not
      // surface to the user. The push card reports its own unavailable state.
      console.error('Service worker registration failed', cause);
    });
  }, []);

  return null;
}
