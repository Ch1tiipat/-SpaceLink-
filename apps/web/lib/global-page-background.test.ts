/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const backgroundAssert: typeof import('node:assert/strict') = require(
  'node:assert/strict',
);
const { readFileSync: readBackgroundSource }: typeof import('node:fs') =
  require('node:fs');
const { join: joinBackgroundPath }: typeof import('node:path') =
  require('node:path');
const { test: backgroundTest }: typeof import('node:test') =
  require('node:test');
const { parse: parseBackgroundCss }: typeof import('postcss') =
  require('postcss');

const appRoot = process.cwd();
const globalStyles = readBackgroundSource(
  joinBackgroundPath(appRoot, 'app', 'globals.css'),
  'utf8',
);
const backgroundAsset = readBackgroundSource(
  joinBackgroundPath(appRoot, 'public', 'spacelink-page-background.png'),
);
const appShell = readBackgroundSource(
  joinBackgroundPath(appRoot, 'components', 'app-shell.tsx'),
  'utf8',
);
const authLayout = readBackgroundSource(
  joinBackgroundPath(appRoot, 'components', 'auth-layout.tsx'),
  'utf8',
);
const superAdminShell = readBackgroundSource(
  joinBackgroundPath(
    appRoot,
    'components',
    'super-admin',
    'super-admin-shell.tsx',
  ),
  'utf8',
);
const adminDashboard = readBackgroundSource(
  joinBackgroundPath(appRoot, 'components', 'admin-dashboard.tsx'),
  'utf8',
);

function declarationsFor(selector: string): Map<string, string> {
  const declarations = new Map<string, string>();

  parseBackgroundCss(globalStyles).walkRules(selector, (rule) => {
    rule.walkDecls((declaration) => {
      declarations.set(declaration.prop, declaration.value);
    });
  });

  return declarations;
}

backgroundTest('body owns one fixed full-viewport SpaceLink canvas', () => {
  const body = declarationsFor('body');
  const canvas = declarationsFor('body::before');
  const assetReferences = globalStyles.match(
    /url\('\/spacelink-page-background\.png'\)/g,
  );

  backgroundAssert.equal(body.get('position'), 'relative');
  backgroundAssert.equal(body.get('isolation'), 'isolate');
  backgroundAssert.equal(canvas.get('position'), 'fixed');
  backgroundAssert.equal(canvas.get('inset'), '0');
  backgroundAssert.equal(canvas.get('z-index'), '-1');
  backgroundAssert.equal(
    canvas.get('background-image'),
    "url('/spacelink-page-background.png')",
  );
  backgroundAssert.equal(canvas.get('background-position'), 'center');
  backgroundAssert.equal(canvas.get('background-repeat'), 'no-repeat');
  backgroundAssert.equal(canvas.get('background-size'), 'cover');
  backgroundAssert.equal(canvas.get('pointer-events'), 'none');
  backgroundAssert.equal(assetReferences?.length, 1);
});

backgroundTest('route canvases stay transparent instead of restarting the artwork', () => {
  for (const selector of ['.sl-page', '.sl-app-background']) {
    const declarations = declarationsFor(selector);

    backgroundAssert.equal(declarations.get('background'), 'transparent');
    backgroundAssert.equal(declarations.has('background-image'), false);
    backgroundAssert.equal(declarations.has('background-color'), false);
  }

  backgroundAssert.doesNotMatch(
    globalStyles,
    /\.sl-(?:page|app-background)::before/,
  );
  backgroundAssert.doesNotMatch(globalStyles, /background-attachment\s*:/);
  backgroundAssert.doesNotMatch(globalStyles, /background-repeat:\s*repeat/);
});

backgroundTest('approved PNG is full-frame and keeps the supplied composition', () => {
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  backgroundAssert.deepEqual(backgroundAsset.subarray(0, 8), pngSignature);
  backgroundAssert.equal(backgroundAsset.readUInt32BE(16), 1672);
  backgroundAssert.equal(backgroundAsset.readUInt32BE(20), 941);
  backgroundAssert.ok(
    backgroundAsset.byteLength > 1_000_000,
    'The approved full-resolution artwork must not be replaced by a placeholder.',
  );
});

backgroundTest('AppShell canvas does not trap dialogs in a stacking context', () => {
  const appCanvas = declarationsFor('.sl-app-background');

  backgroundAssert.equal(appCanvas.has('isolation'), false);
  backgroundAssert.equal(appCanvas.has('z-index'), false);
});

backgroundTest('shared user and super admin layouts use transparent route canvases', () => {
  backgroundAssert.match(appShell, /sl-app-background min-w-0/);
  backgroundAssert.match(superAdminShell, /sl-app-background min-h-screen/);
});

backgroundTest('approved auth layout owns a locally scoped rounded frame without changing global canvases', () => {
  const authStyles = readBackgroundSource(
    joinBackgroundPath(appRoot, 'components', 'auth-layout.module.css'),
    'utf8',
  );
  backgroundAssert.match(authLayout, /className=\{styles\.root\}/);
  backgroundAssert.match(authLayout, /auth-layout\.module\.css/);
  backgroundAssert.match(authStyles, /\.root \{[^}]*background: #eee8ff/);
  backgroundAssert.match(authStyles, /\.root \.layout \{[^}]*border-radius: 28px/);
  backgroundAssert.doesNotMatch(authStyles, /body|\.sl-app-background/);
});

backgroundTest('the live Admin dashboard keeps the global canvas visible', () => {
  const dashboardCanvas = adminDashboard.match(
    /<main className="([^"]*sl-app-background[^"]*)"/,
  );

  backgroundAssert.ok(dashboardCanvas, 'Admin dashboard must use the shared canvas');
  backgroundAssert.doesNotMatch(
    dashboardCanvas[1],
    /\bbg-\[/,
    'An opaque route gradient would hide the global background.',
  );
});
