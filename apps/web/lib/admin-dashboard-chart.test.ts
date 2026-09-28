/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const adminChartAssert: typeof import('node:assert/strict') = require(
  'node:assert/strict',
);
const { readFileSync: readAdminDashboardSource }: typeof import('node:fs') =
  require('node:fs');
const { join: joinAdminDashboardPath }: typeof import('node:path') =
  require('node:path');
const { test: adminChartTest }: typeof import('node:test') =
  require('node:test');

const adminDashboardSource = readAdminDashboardSource(
  joinAdminDashboardPath(process.cwd(), 'components', 'admin-dashboard.tsx'),
  'utf8',
);

function middleTick(ceiling: number) {
  const top = 25;
  const bottom = 205;
  const value = Math.round(ceiling / 2);

  return {
    value,
    y: bottom - (value / ceiling) * (bottom - top),
  };
}

adminChartTest('middle chart tick uses the same scale as its rounded label', () => {
  adminChartAssert.match(
    adminDashboardSource,
    /const middleValue = Math\.round\(ceiling \/ 2\);/,
  );
  adminChartAssert.match(
    adminDashboardSource,
    /const middleY = bottom - \(middleValue \/ ceiling\) \* \(bottom - top\);/,
  );
  adminChartAssert.match(
    adminDashboardSource,
    /value: middleValue,[\s\S]*?label: String\(middleValue\),[\s\S]*?y: middleY/,
  );
});

adminChartTest('odd and even ceilings keep the middle tick within chart bounds', () => {
  adminChartAssert.deepEqual(middleTick(5), { value: 3, y: 97 });
  adminChartAssert.deepEqual(middleTick(10), { value: 5, y: 115 });

  for (const ceiling of [4, 5, 10, 15, 20]) {
    const tick = middleTick(ceiling);
    adminChartAssert.ok(tick.y >= 25 && tick.y <= 205);
  }
});

adminChartTest('empty chart fallback keeps a centered and correctly labelled tick', () => {
  adminChartAssert.match(
    adminDashboardSource,
    /const ceiling = maximum === 0 \? 4/,
  );
  adminChartAssert.deepEqual(middleTick(4), { value: 2, y: 115 });
});
