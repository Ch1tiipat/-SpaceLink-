/* eslint-disable @typescript-eslint/no-require-imports -- Node runs TypeScript tests directly. */
import type {} from './api';
const netAssert: typeof import('node:assert/strict') = require('node:assert/strict');
const { test: netTest }: typeof import('node:test') = require('node:test');
const { isNetworkFailure, connectionMessage } = require('./network-error.ts') as typeof import('./network-error');
const { AuthRetryableFetchError } = require('@supabase/auth-js') as typeof import('@supabase/auth-js');
const netFs: typeof import('node:fs') = require('node:fs');
const netVm: typeof import('node:vm') = require('node:vm');
const netTs: typeof import('typescript') = require('typescript');
const apiModule = { exports: {} as typeof import('./api') };
netVm.runInNewContext(netTs.transpileModule(netFs.readFileSync('lib/api.ts', 'utf8'), {
  compilerOptions: { module: netTs.ModuleKind.CommonJS },
}).outputText, { exports: apiModule.exports, module: apiModule, require, process });
const { ApiError } = apiModule.exports;

netTest('API status zero and actual Supabase fetch errors are network failures', () => {
  netAssert.equal(isNetworkFailure(new ApiError('unreachable', 0)), true);
  netAssert.equal(isNetworkFailure(new AuthRetryableFetchError('Failed to fetch', 0)), true);
  netAssert.equal(isNetworkFailure(new AuthRetryableFetchError('server error', 503)), false);
  for (const status of [401, 403, 404, 429, 500, 503]) {
    netAssert.equal(isNetworkFailure(new ApiError('HTTP response', status)), false);
  }
});
netTest('fetch TypeError differs from programming, abort and unknown errors', () => {
  for (const message of ['Failed to fetch', 'fetch failed', 'Load failed', 'Network request failed']) {
    netAssert.equal(isNetworkFailure(new TypeError(message)), true);
  }
  for (const cause of [new TypeError('undefined is not a function'), new Error('failure'),
    new DOMException('aborted', 'AbortError'), null, {}, { name: 'AuthRetryableFetchError', status: 0 }]) {
    netAssert.equal(isNetworkFailure(cause), false);
  }
});
netTest('online hint changes copy without treating API unreachability as physical offline', () => {
  netAssert.match(connectionMessage(false), /ออฟไลน์/);
  netAssert.doesNotMatch(connectionMessage(true), /ออฟไลน์/);
  netAssert.equal(connectionMessage(undefined), connectionMessage(true));
});

function cachingRules(value: string | undefined) {
  const source = netFs.readFileSync('next.config.mjs', 'utf8')
    .replace(/^import .*;$/gm, '').replace('export default withPWA(nextConfig);', 'module.exports = runtimeCaching;');
  const result: { exports: Array<{ handler: string; urlPattern: RegExp | ((input: { request: Request }) => boolean) }> } = { exports: [] };
  netVm.runInNewContext(source, {
    URL, RegExp, module: result, process: { env: { NEXT_PUBLIC_API_URL: value } },
    defaultRuntimeCaching: [{ handler: 'default' }],
    withPWAInit: () => (config: unknown) => config,
  });
  return result.exports;
}
netTest('API cache rule follows unchanged Authorization and precedes default; other origins excluded', () => {
  const rules = cachingRules('https://api.example.test:444/api');
  netAssert.equal(rules[0].handler, 'NetworkOnly');
  netAssert.equal((rules[0].urlPattern as (input: { request: Request }) => boolean)({
    request: new Request('https://storage.example.test/image.png', { headers: { Authorization: 'test-fixture' } }),
  }), true);
  netAssert.equal(rules[1].handler, 'NetworkOnly');
  const pattern = rules[1].urlPattern as RegExp;
  for (const url of ['https://api.example.test:444/events/discovery', 'https://api.example.test:444/api/public']) netAssert.equal(pattern.test(url), true);
  for (const url of ['https://storage.example.test/image.png', 'https://api.example.test/events', 'https://api.example.test:444.evil.test/events']) netAssert.equal(pattern.test(url), false);
  netAssert.equal(rules[2].handler, 'default');
});
netTest('missing/invalid API env stays safe; placeholder still has a scoped NetworkOnly rule', () => {
  for (const value of [undefined, '', 'invalid', 'file:///tmp/file']) netAssert.equal(cachingRules(value).length, 2);
  const rules = cachingRules('https://placeholder.invalid');
  netAssert.equal((rules[1].urlPattern as RegExp).test('https://placeholder.invalid/events/discovery'), true);
});
