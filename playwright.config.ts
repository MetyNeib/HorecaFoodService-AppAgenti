import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= fileURLToPath(new URL('./.playwright-browsers', import.meta.url));
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 2,
  timeout: 60000,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'qa/playwright-report', open: 'never' }], ['json', {outputFile:'qa/e2e-results.json'}]],
  use: { baseURL: 'http://127.0.0.1:5173', locale:'it-IT', launchOptions:{ignoreDefaultArgs:['--hide-scrollbars']}, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'tablet-landscape', use: { browserName: 'chromium', viewport: {width:1024,height:768} } },
    { name: 'tablet-portrait', use: { browserName: 'chromium', viewport: {width:768,height:1024} } },
    { name: 'phone', use: { browserName: 'chromium', viewport: {width:390,height:844} } },
    { name: 'desktop', use: { browserName: 'chromium', viewport: {width:1440,height:900} } },
    { name: 'short-desktop', use: { browserName: 'chromium', viewport: {width:1276,height:550} } },
    { name: 'short-tablet', use: { browserName: 'chromium', viewport: {width:768,height:650} } },
  ],
  webServer: { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: false, timeout: 30000 },
});
