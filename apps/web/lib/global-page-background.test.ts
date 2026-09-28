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

const appRoot = process.cwd();
const globalStyles = readBackgroundSource(
  joinBackgroundPath(appRoot, 'app', 'globals.css'),
  'utf8',
);
const backgroundAsset = readBackgroundSource(
  joinBackgroundPath(appRoot, 'public', 'spacelink-page-background.svg'),
  'utf8',
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

backgroundTest('global canvas uses the scalable SpaceLink background', () => {
  backgroundAssert.match(
    globalStyles,
    /background-image: url\('\/spacelink-page-background\.svg'\)/,
  );
  backgroundAssert.match(globalStyles, /background-size: cover/);
  backgroundAssert.match(globalStyles, /background-attachment: fixed/);
  backgroundAssert.match(globalStyles, /\.sl-app-background/);
});

backgroundTest('background asset stays sharp and preserves the approved composition', () => {
  backgroundAssert.match(backgroundAsset, /viewBox="0 0 1674 941"/);
  backgroundAssert.match(backgroundAsset, /preserveAspectRatio="xMidYMid slice"/);
  backgroundAssert.match(backgroundAsset, /id="lavender-orb"/);
  backgroundAssert.match(backgroundAsset, /id="dot-grid"/);
});

backgroundTest('shared user, auth, and super admin layouts use the same canvas', () => {
  backgroundAssert.match(appShell, /sl-app-background min-w-0/);
  backgroundAssert.match(authLayout, /sl-app-background flex/);
  backgroundAssert.match(superAdminShell, /sl-app-background min-h-screen/);
});

backgroundTest('the live Admin dashboard keeps the global canvas visible', () => {
  const dashboardCanvas = adminDashboard.match(
    /<main className="([^"]*sl-app-background[^"]*)"/,
  );
  backgroundAssert.ok(dashboardCanvas, 'Admin dashboard must use the shared canvas');
  backgroundAssert.doesNotMatch(
    dashboardCanvas[1],
    /\bbg-\[/,
    'An opaque route gradient would hide the shared SVG background',
  );
});
