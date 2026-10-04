import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

type ApiModule = typeof import('./api');

function loadApi(fetchMock: typeof fetch): ApiModule {
  const source = readFileSync(join(process.cwd(), 'lib', 'api.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports: Record<string, unknown> = {};
  const environment = {
    env: { NEXT_PUBLIC_API_URL: 'https://api.example.test' },
  };
  new Function('exports', 'process', 'fetch', compiled)(
    exports,
    environment,
    fetchMock,
  );
  return exports as ApiModule;
}

test('map upload sends one file to the event-scoped route and returns the saved URL', async () => {
  let requestUrl = '';
  let requestInit: RequestInit | undefined;
  const expected = {
    id: 'event-1',
    mapImageUrl: 'https://example.test/map.png',
  };
  const fetchMock = (async (url: string, init: RequestInit) => {
    requestUrl = url;
    requestInit = init;
    return new Response(JSON.stringify(expected), { status: 200 });
  }) as typeof fetch;
  const api = loadApi(fetchMock);
  const file = new File(['image'], 'map.png', { type: 'image/png' });

  const actual = await api.uploadAdminEventMapImage(
    'org-1',
    'event-1',
    file,
    'token',
  );

  assert.equal(actual.mapImageUrl, expected.mapImageUrl);
  assert.equal(
    requestUrl,
    'https://api.example.test/organizations/org-1/events/event-1/map-image',
  );
  assert.equal(requestInit?.method, 'POST');
  assert.equal(
    new Headers(requestInit?.headers).get('Authorization'),
    'Bearer token',
  );
  assert.deepEqual((requestInit?.body as FormData).getAll('file'), [file]);
});

test('map upload exposes a clear error without changing the current image', async () => {
  const fetchMock = (async () =>
    new Response(JSON.stringify({ message: 'รองรับเฉพาะไฟล์ JPEG และ PNG' }), {
      status: 400,
    })) as typeof fetch;
  const api = loadApi(fetchMock);

  await assert.rejects(
    api.uploadAdminEventMapImage(
      'org-1',
      'event-1',
      new File(['bad'], 'bad.txt'),
      'token',
    ),
    /รองรับเฉพาะไฟล์ JPEG และ PNG/,
  );
});

test('map removal uses the same event-scoped route', async () => {
  let requestUrl = '';
  let requestInit: RequestInit | undefined;
  const fetchMock = (async (url: string, init: RequestInit) => {
    requestUrl = url;
    requestInit = init;
    return new Response(JSON.stringify({ id: 'event-1', mapImageUrl: null }), {
      status: 200,
    });
  }) as typeof fetch;
  const api = loadApi(fetchMock);

  const actual = await api.deleteAdminEventMapImage(
    'org-1',
    'event-1',
    'token',
  );

  assert.equal(actual.mapImageUrl, null);
  assert.equal(
    requestUrl,
    'https://api.example.test/organizations/org-1/events/event-1/map-image',
  );
  assert.equal(requestInit?.method, 'DELETE');
});
