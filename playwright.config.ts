import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'qa/playwright-report', open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'tablet-landscape', use: { browserName: 'chromium', viewport: {width:1024,height:768} } },
    { name: 'tablet-portrait', use: { browserName: 'chromium', viewport: {width:768,height:1024} } },
    { name: 'phone', use: { browserName: 'chromium', viewport: {width:390,height:844} } },
    { name: 'desktop', use: { browserName: 'chromium', viewport: {width:1440,height:900} } },
  ],
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: false, timeout: 30000 },
});
