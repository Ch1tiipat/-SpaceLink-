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

netTest('homepage live gate hides recommendations and keeps the real journey fallback offline, loading or failed', () => {
  const React = require('react') as typeof import('react');
  const { renderToStaticMarkup } = require('react-dom/server') as typeof import('react-dom/server');
  const source = netTs.createSourceFile('page.tsx', netFs.readFileSync('app/page.tsx', 'utf8'), netTs.ScriptTarget.Latest, true, netTs.ScriptKind.TSX);
  let liveDeclaration = '';
  let recommendation = '';
  let journeyCall = '';
  let journeyFunction = '';
  function visit(node: import('typescript').Node) {
    if (netTs.isVariableDeclaration(node) && node.name.getText(source) === 'live') liveDeclaration = node.getText(source);
    if (netTs.isJsxExpression(node) && node.expression?.getText(source).includes('<PopularAreaRecommendations')) recommendation = node.expression.getText(source);
    if (netTs.isJsxSelfClosingElement(node) && node.tagName.getText(source) === 'BookingJourney') journeyCall = node.getText(source);
    if (netTs.isFunctionDeclaration(node) && node.name?.text === 'BookingJourney') journeyFunction = node.getText(source);
    netTs.forEachChild(node, visit);
  }
  visit(source);
  netAssert.ok(liveDeclaration && recommendation && journeyCall && journeyFunction);
  const code = netTs.transpileModule(journeyFunction + '\nconst ' + liveDeclaration
    + '; module.exports = [' + recommendation + ', ' + journeyCall + '];', {
    compilerOptions: { module: netTs.ModuleKind.CommonJS, jsx: netTs.JsxEmit.ReactJSX },
  }).outputText;
  for (const state of [
    { online: false, loading: false, error: null },
    { online: true, loading: true, error: null },
    { online: true, loading: false, error: 'API failure' },
    { online: true, loading: false, error: null },
  ]) {
    const testModule: { exports: import('react').ReactNode[] } = { exports: [] };
    const icon = () => React.createElement('span');
    netVm.runInNewContext(code, {
      ...state, module: testModule, exports: testModule.exports, require,
      featuredEvent: { slug: 'event-a' }, CalendarSearch: icon, CreditCard: icon, Store: icon,
      Link: ({ href, children }: { href: string; children: import('react').ReactNode }) => React.createElement('a', { href }, children),
      PopularAreaRecommendations: () => React.createElement('div', {}, 'LIVE_AVAILABILITY'),
    });
    const html = renderToStaticMarkup(React.createElement(React.Fragment, {}, ...testModule.exports));
    if (!state.online || state.loading || state.error) {
      netAssert.doesNotMatch(html, /LIVE_AVAILABILITY|\/events\/event-a\/map/);
      netAssert.match(html, /href="#events"/);
    } else {
      netAssert.match(html, /LIVE_AVAILABILITY/);
      netAssert.match(html, /href="\/events\/event-a\/map"/);
    }
  }
});

netTest('other homepage event consumers gate their live data without changing featured-event selection', () => {
  const source = netFs.readFileSync('app/page.tsx', 'utf8');
  netAssert.match(source, /const featuredEvent = visibleEvents\.find\(\(event\) => isEventBookable\(event\)\);/);
  for (const field of ['events', 'areas', 'categories']) netAssert.ok(source.includes('live ? filters.' + field + ' : []'));
  netAssert.match(source, /live && savedEvents\.status !== 'signed-out'/);
  netAssert.match(source, /live && selectedEvent \? \(/);
  netAssert.match(source, /live && selectedAnnouncement \? \(/);
  netAssert.match(source, /if \(!live \|\| events\.length === 0 \|\| selectedEvent\) return;/);
  netAssert.match(source, /if \(live\) return;\s*announcementDialogRef\.current\?\.close\(\);\s*setSelectedAnnouncement\(null\);\s*setSelectedEvent\(null\);/);
});
