/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const chartAssert: typeof import('node:assert/strict') = require('node:assert/strict');
const { readFileSync: readChartSource }: typeof import('node:fs') = require('node:fs');
const { join: joinChartPath }: typeof import('node:path') = require('node:path');
const { test: chartTest }: typeof import('node:test') = require('node:test');
const { runInNewContext: runChartInNewContext }: typeof import('node:vm') = require('node:vm');
const { createElement }: typeof import('react') = require('react');
const { renderToStaticMarkup }: typeof import('react-dom/server') = require('react-dom/server');
const typescript: typeof import('typescript') = require('typescript');

const dashboardSource = readChartSource(
  joinChartPath(process.cwd(), 'components', 'super-admin', 'super-admin-dashboard.tsx'),
  'utf8',
);
const superAdminMotionStyles = readChartSource(
  joinChartPath(process.cwd(), 'app', 'globals.css'),
  'utf8',
);

type StatusCounts = { ACTIVE: number; INACTIVE: number; SUSPENDED: number };
type StatusChartComponent = (props: {
  mode: 'line';
  counts: StatusCounts;
  total: number;
}) => import('react').ReactElement;

function loadStatusChart(): StatusChartComponent {
  const source = `${dashboardSource}\nexports.__StatusChart = StatusChart;`;
  const compiled = typescript.transpileModule(source, {
    compilerOptions: {
      jsx: typescript.JsxEmit.ReactJSX,
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
  const chartModule: { exports: Record<string, unknown> } = { exports: {} };

  runChartInNewContext(compiled, {
    exports: chartModule.exports,
    module: chartModule,
    require: (id: string) => {
      if (id === 'react/jsx-runtime') return require('react/jsx-runtime');
      return {};
    },
  });

  return chartModule.exports.__StatusChart as StatusChartComponent;
}

chartTest('line chart keeps its full normalized stroke with many organizations', () => {
  const StatusChart = loadStatusChart();
  const markup = renderToStaticMarkup(
    createElement(StatusChart, {
      mode: 'line',
      counts: { ACTIVE: 100_000, INACTIVE: 50_000, SUSPENDED: 25_000 },
      total: 175_000,
    }),
  );

  chartAssert.match(markup, /<polyline[^>]*pathLength="1"/);
  chartAssert.match(markup, /100000/);
  chartAssert.match(markup, /50000/);
  chartAssert.match(markup, /25000/);
  chartAssert.match(superAdminMotionStyles, /stroke-dasharray:\s*1;/);
  chartAssert.match(superAdminMotionStyles, /stroke-dashoffset:\s*1;/);
  chartAssert.doesNotMatch(superAdminMotionStyles, /stroke-dasharray:\s*900;/);
});

chartTest('Super Admin card motion excludes articles containing data tables', () => {
  const watchlistHeading = dashboardSource.indexOf('ORGANIZATION WATCHLIST');
  const watchlistStart = dashboardSource.lastIndexOf('<article', watchlistHeading);
  const watchlist = dashboardSource.slice(
    watchlistStart,
    dashboardSource.indexOf('</article>', watchlistHeading),
  );

  chartAssert.match(watchlist, /<table/);
  chartAssert.doesNotMatch(watchlist, /sl-super-motion-card/);
  chartAssert.doesNotMatch(superAdminMotionStyles, /\.sl-super-main article(?:\s|:|\{)/);
  chartAssert.match(superAdminMotionStyles, /\.sl-super-main \.sl-super-motion-card:hover/);
});
