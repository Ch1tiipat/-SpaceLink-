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
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  importScripts: ['/push-sw.js'],
  register: true,
  runtimeCaching,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default withPWA(nextConfig);
