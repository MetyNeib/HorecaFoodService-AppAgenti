import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= fileURLToPath(new URL('./.playwright-browsers', import.meta.url));
export default defineConfig({
  testDir: './tests/rails-ui',
  fullyParallel: false,
  workers: 1,
  timeout: 240000,
  retries: 0,
  outputDir: 'test-results/rails-ui',
  reporter: [['list'], ['json', { outputFile: 'qa/rails-ui/results.json' }]],
  use: {
    baseURL: process.env.HFS_RAILS_URL || 'http://127.0.0.1:3002',
    locale: 'it-IT',
    actionTimeout: 15000,
    launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'phone', use: { browserName: 'chromium', viewport: { width: 390, height: 844 } } },
    { name: 'tablet-portrait', use: { browserName: 'chromium', viewport: { width: 768, height: 1024 } } },
    { name: 'tablet-landscape', use: { browserName: 'chromium', viewport: { width: 1024, height: 768 } } },
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
  ],
});
