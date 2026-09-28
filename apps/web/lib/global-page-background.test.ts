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

type CanvasNode = {
  classes: string[];
  children?: CanvasNode[];
};

function descendants(node: CanvasNode): CanvasNode[] {
  return (node.children ?? []).flatMap((child) => [child, ...descendants(child)]);
}

function activeAmbientLayers(root: CanvasNode): number {
  const styleSheet = parseBackgroundCss(globalStyles);
  const animatedClasses = new Set<string>();
  const suppressedDescendantClasses = new Set<string>();

  styleSheet.walkRules((rule) => {
    if (rule.selector.includes('::before')) {
      for (const selector of rule.selectors) {
        const animatedMatch = selector.match(/^\.(sl-(?:page|app-background))::before$/);
        if (animatedMatch && rule.nodes.some((node) => node.type === 'decl' && node.prop === 'animation')) {
          animatedClasses.add(animatedMatch[1]);
        }
      }
    }

    if (
      rule.selector.startsWith('.sl-app-background:has(') &&
      rule.selector.endsWith(')::before') &&
      rule.nodes.some(
        (node) =>
          node.type === 'decl' && node.prop === 'display' && node.value === 'none',
      )
    ) {
      const hasArguments = rule.selector.match(/:has\(([^)]+)\)/)?.[1] ?? '';
      for (const className of hasArguments.matchAll(/\.([\w-]+)/g)) {
        suppressedDescendantClasses.add(className[1]);
      }
    }
  });

  function count(node: CanvasNode): number {
    const hasAnimatedClass = node.classes.some((className) =>
      animatedClasses.has(className),
    );
    const isSuppressed =
      node.classes.includes('sl-app-background') &&
      descendants(node).some((descendant) =>
        descendant.classes.some((className) =>
          suppressedDescendantClasses.has(className),
        ),
      );

    return (
      (hasAnimatedClass && !isSuppressed ? 1 : 0) +
      (node.children ?? []).reduce((total, child) => total + count(child), 0)
    );
  }

  return count(root);
}

backgroundTest('global canvas uses the scalable SpaceLink background', () => {
  backgroundAssert.match(
    globalStyles,
    /url\('\/spacelink-page-background\.svg'\)/,
  );
  backgroundAssert.match(globalStyles, /background-attachment: scroll/);
  backgroundAssert.match(
    globalStyles,
    /background-repeat:\s*no-repeat,\s*no-repeat/,
  );
  backgroundAssert.doesNotMatch(globalStyles, /background-repeat:\s*repeat-y/);
  backgroundAssert.doesNotMatch(globalStyles, /background-attachment: fixed/);
  backgroundAssert.match(globalStyles, /\.sl-app-background/);
});

backgroundTest('background motion uses a bounded transform layer without tiling the SVG', () => {
  const decorativeLayer = globalStyles.match(
    /\.sl-page::before,\s*\.sl-app-background::before\s*\{([\s\S]*?)\n\}/,
  );

  backgroundAssert.ok(decorativeLayer, 'Decorative motion layer must exist');
  backgroundAssert.match(decorativeLayer[1], /position: absolute/);
  backgroundAssert.match(decorativeLayer[1], /width: 92%/);
  backgroundAssert.match(decorativeLayer[1], /height: min\(34rem, 65vh\)/);
  backgroundAssert.match(decorativeLayer[1], /will-change: transform/);
  backgroundAssert.match(decorativeLayer[1], /translate3d/);
  backgroundAssert.doesNotMatch(
    decorativeLayer[1],
    /spacelink-page-background\.svg/,
  );
  backgroundAssert.match(
    globalStyles,
    /\.sl-app-background:has\(\.sl-page, \.sl-app-background\)::before\s*\{[\s\S]*?display: none/,
  );
  backgroundAssert.doesNotMatch(
    globalStyles,
    /\.sl-app-background \.sl-page::before\s*\{[\s\S]*?display: none/,
  );
  backgroundAssert.match(globalStyles, /@keyframes sl-background-drift/);
  backgroundAssert.match(
    globalStyles,
    /animation: sl-background-drift 24s ease-in-out infinite alternate/,
  );
  backgroundAssert.doesNotMatch(
    globalStyles,
    /@keyframes sl-background-drift\s*\{[^@]*background-position/,
  );
});

backgroundTest('rendered canvas compositions keep exactly one ambient layer', () => {
  const userRoute: CanvasNode = {
    classes: ['sl-app-background'],
    children: [{ classes: ['sl-page'] }],
  };
  const adminRoute: CanvasNode = {
    classes: ['sl-app-background'],
    children: [{ classes: ['sl-app-background'] }],
  };
  const standaloneCanvas: CanvasNode = { classes: ['sl-app-background'] };

  backgroundAssert.equal(activeAmbientLayers(userRoute), 1);
  backgroundAssert.equal(activeAmbientLayers(adminRoute), 1);
  backgroundAssert.equal(activeAmbientLayers(standaloneCanvas), 1);
});

backgroundTest('AppShell canvas does not trap dialogs in a stacking context', () => {
  const appCanvas = globalStyles.match(/\.sl-app-background\s*\{([\s\S]*?)\n\}/);

  backgroundAssert.ok(appCanvas, 'AppShell canvas styles must exist');
  backgroundAssert.doesNotMatch(appCanvas[1], /\bisolation\s*:/);
  backgroundAssert.doesNotMatch(appCanvas[1], /\bz-index\s*:/);
});

backgroundTest('standalone canvas paints ambient glow above its background and below content', () => {
  const styleSheet = parseBackgroundCss(globalStyles);
  let standaloneAmbientZIndex: string | undefined;
  styleSheet.walkRules('.sl-app-background::before', (rule) => {
    rule.walkDecls('z-index', (declaration) => {
      standaloneAmbientZIndex = declaration.value;
    });
  });
  const standaloneContent = globalStyles.match(
    /\.sl-app-background > :not\(\.absolute, \.fixed, \.sticky\)\s*\{([\s\S]*?)\n\}/,
  );

  backgroundAssert.equal(standaloneAmbientZIndex, '0');
  backgroundAssert.ok(
    standaloneContent,
    'Standalone content paint-order guard must exist',
  );
  backgroundAssert.match(standaloneContent[1], /position: relative/);
  backgroundAssert.doesNotMatch(standaloneContent[1], /z-index\s*:/);
  backgroundAssert.match(
    globalStyles,
    /\.sl-page::before\s*\{[\s\S]*?z-index: -1/,
  );
});

backgroundTest('background motion respects reduced-motion preferences', () => {
  backgroundAssert.match(
    globalStyles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.sl-page::before,[\s\S]*?\.sl-app-background::before \{[\s\S]*?animation: none[\s\S]*?will-change: auto/,
  );
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
