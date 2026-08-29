import withPWAInit from 'next-pwa';
import defaultRuntimeCaching from 'next-pwa/cache.js';

const runtimeCaching = [
  {
    // Authenticated API responses contain account-specific data. They must
    // never fall back to a response cached for another user on this device.
    urlPattern: ({ request }) => request.headers.has('authorization'),
    handler: 'NetworkOnly',
    method: 'GET',
  },
  ...defaultRuntimeCaching,
];

const withPWA = withPWAInit({
  // Admin-only route chunks are loaded and cached when an admin opens them;
  // vendors should not download every admin screen during first install.
  buildExcludes: [
    // Next.js does not serve this internal manifest through `next start`; if
    // Workbox precaches it, the 404 makes the service-worker install fail.
    /app-build-manifest\.json$/,
    /static\/chunks\/app\/(?:admin|super-admin)\/.*\.js$/,
  ],
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  importScripts: ['/push-sw.js'],
  // These large reference images are not used by the current UI. Keep them
  // deployable, but do not make every PWA installation download them upfront.
  publicExcludes: [
    '!event-atmosphere-sut-2569.png',
    '!event-plan-sut-2569.png',
    '!event-travel-map-sut-2569.png',
    '!hero-spacelink.png',
  ],
  register: true,
  runtimeCaching,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default withPWA(nextConfig);
