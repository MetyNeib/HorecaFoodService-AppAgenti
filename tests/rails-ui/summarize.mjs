import fs from 'node:fs';
import path from 'node:path';

const reports = ['results-initial.json', 'results-recheck.json', 'results-draft-actions.json'];
const directory = path.join('qa', 'rails-ui');
const cases = new Map();

function collect(suite, reportName) {
  for (const spec of suite.specs || []) {
    for (const test of spec.tests) {
      const key = `${spec.file}::${spec.title}::${test.projectName}`;
      const current = cases.get(key) || {
        file: spec.file, title: spec.title, project: test.projectName, executions: [],
      };
      for (const result of test.results) {
        current.executions.push({
          report: reportName, status: result.status, durationMs: result.duration,
          errors: (result.errors || []).map(error => error.message),
        });
      }
      current.status = current.executions.at(-1)?.status || 'not_run';
      current.latestReport = reportName;
      cases.set(key, current);
    }
  }
  for (const child of suite.suites || []) collect(child, reportName);
}

for (const reportName of reports) {
  const report = JSON.parse(fs.readFileSync(path.join(directory, reportName), 'utf8'));
  for (const suite of report.suites) collect(suite, reportName);
}

const results = [...cases.values()].sort((a, b) => `${a.project}:${a.file}:${a.title}`.localeCompare(`${b.project}:${b.file}:${b.title}`));
const viewports = ['phone', 'tablet-portrait', 'tablet-landscape', 'desktop'];
const layouts = viewports.map(project => {
  const views = JSON.parse(fs.readFileSync(path.join(directory, `${project}-layout.json`), 'utf8'));
  return {
    project, views: views.length,
    passed: views.every(view => !view.error && view.width <= view.viewport + 1 && view.mainBottom <= view.footerTop + 1 && view.footerBottom <= view.height + 1 && view.clipped.length === 0),
  };
});
const parity = JSON.parse(fs.readFileSync(path.join(directory, 'css-parity.json'), 'utf8'));
const summary = {
  generatedAt: new Date().toISOString(),
  framework: 'Rails ERB + Ralix',
  playwrightVersion: JSON.parse(fs.readFileSync('node_modules/@playwright/test/package.json', 'utf8')).version,
  methodology: 'Cases are deduplicated by file, test title and viewport. The latest executed result determines the final status; earlier executions from the retained JSON reports remain listed with their original report.',
  testAdjustments: [
    'Expectation timeout increased from 5 to 15 seconds after traces showed successful command and SSR responses exceeding the original combined wait under concurrent Docker/browser test load. Assertions were unchanged.',
    'The added draft-actions test waits for the customer-picker heading before typing, so it cannot fill the previous product-search field during asynchronous navigation.',
    'The persisted quantity assertion compares the numeric value 2, accepting equivalent HTML representations 2 and 2.0 without changing the expected quantity.',
    'Quantity persistence is compared numerically, accepting equivalent HTML number-input values such as 2 and 2.0 without changing the required quantity.',
  ],
  reports,
  totals: {
    distinctCases: results.length,
    passed: results.filter(test => test.status === 'passed').length,
    failed: results.filter(test => ['failed', 'timedOut', 'interrupted'].includes(test.status)).length,
    notRun: results.filter(test => ['skipped', 'not_run'].includes(test.status)).length,
  },
  screenshots: { directory: 'screenshots', count: fs.readdirSync(path.join(directory, 'screenshots')).filter(file => file.endsWith('.png')).length },
  layouts,
  originalCssRulesIdentical: parity.sheets.every(sheet => sheet.identical),
  cases: results,
};
fs.writeFileSync(path.join(directory, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ ...summary.totals, screenshots: summary.screenshots.count, layoutsPassed: layouts.every(layout => layout.passed) }));
if (summary.totals.distinctCases !== 24 || summary.totals.passed !== 24 || layouts.some(layout => !layout.passed)) process.exitCode = 1;
