/* eslint-disable @typescript-eslint/no-require-imports -- Node runs TypeScript tests directly. */
import type {} from './api';
const adminAssert: typeof import('node:assert/strict') = require('node:assert/strict');
const { test: adminTest }: typeof import('node:test') = require('node:test');
const ts: typeof import('typescript') = require('typescript');
const fs: typeof import('node:fs') = require('node:fs');
const vm: typeof import('node:vm') = require('node:vm');
const path: typeof import('node:path') = require('node:path');
function loadLocal(file: string): Record<string, unknown> {
  const testModule = { exports: {} };
  const localRequire = (id: string) => id.startsWith('./')
    ? loadLocal(path.resolve(path.dirname(file), id + '.ts'))
    : require(id);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { module: testModule, exports: testModule.exports, require: localRequire, process, TypeError, Error, DOMException });
  return testModule.exports;
}
const access = loadLocal(path.resolve('lib/admin-access-state.ts')) as typeof import('./admin-access-state');
const { ApiError: AccessApiError } = loadLocal(path.resolve('lib/api.ts')) as typeof import('./api');
adminTest('failed rights checks are unavailable except actual 401/403; unavailable never permits protected content', () => {
  for (const status of [0, 500, 503]) adminAssert.equal(access.accessAfterFailure(new AccessApiError('failure', status)), 'unavailable');
  for (const status of [401, 403]) adminAssert.equal(access.accessAfterFailure(new AccessApiError('denied', status)), 'denied');
  adminAssert.equal(access.accessAfterFailure(new TypeError('Failed to fetch')), 'unavailable');
  for (const state of ['loading', 'denied', 'unavailable', 'no-organization'] as const) adminAssert.equal(access.canShowProtectedContent(state), false);
  adminAssert.equal(access.canShowProtectedContent('allowed'), true);
});

const React = require('react') as typeof import('react');
const { renderToStaticMarkup } = require('react-dom/server') as typeof import('react-dom/server');
function loadScreen(file: string): Record<string, unknown> {
  const testModule = { exports: {} };
  const localRequire = (id: string): unknown => {
    if (id === 'react') return {
      ...React, useEffect: () => undefined,
      useState: (initial: unknown) => [initial === 'loading' ? 'unavailable' : initial, () => undefined],
    };
    if (id === 'next/navigation') return { useRouter: () => ({ replace: () => undefined }) };
    if (id === '@/components/app-shell') return {
      useAdminOrganizationSelection: () => ({ selectedOrganizationId: '', organizations: [], catalogStatus: 'ready', selectOrganization: () => undefined }),
    };
    if (id.startsWith('@/')) {
      const target = id.slice(2);
      const extension = fs.existsSync(target + '.tsx') ? '.tsx' : '.ts';
      return loadScreen(path.resolve(target + extension));
    }
    if (id.startsWith('./')) return loadScreen(path.resolve(path.dirname(file), id + '.ts'));
    return require(id);
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { module: testModule, exports: testModule.exports, require: localRequire, process, TypeError, Error, DOMException });
  return testModule.exports;
}

const adminScreens = [
  ['admin-announcements-screen', 'AdminAnnouncementsScreen'],
  ['admin-booking-rescue-screen', 'AdminBookingRescueScreen'],
  ['admin-dashboard', 'AdminDashboard'],
  ['admin-map-designer', 'AdminMapDesigner'],
  ['admin-organization-settings', 'AdminOrganizationSettings'],
  ['admin-zone-booth-screen', 'AdminZoneBoothScreen'],
];
for (const [file, exportName] of adminScreens) {
  adminTest(file + ' renders unavailable before protected UI', () => {
    const screen = loadScreen(path.resolve('components/' + file + '.tsx'))[exportName] as import('react').ComponentType;
    const html = renderToStaticMarkup(React.createElement(screen));
    adminAssert.match(html, /ยังตรวจสอบสิทธิ์ไม่ได้/);
    adminAssert.match(html, /ลองอีกครั้ง/);
    adminAssert.doesNotMatch(html, /<form|<table|ไม่มีสิทธิ์/);
  });
}
adminTest('shared AdminAccessGate renders unavailable without its protected children', () => {
  const { AdminAccessGate } = loadScreen(path.resolve('components/admin-ui.tsx')) as typeof import('../components/admin-ui');
  const html = renderToStaticMarkup(AdminAccessGate({
    access: 'unavailable', children: React.createElement('div', {}, 'PROTECTED_CONTENT'),
  }));
  adminAssert.match(html, /ยังตรวจสอบสิทธิ์ไม่ได้/);
  adminAssert.doesNotMatch(html, /PROTECTED_CONTENT|ไม่มีสิทธิ์/);
});
