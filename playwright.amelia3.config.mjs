import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= fileURLToPath(new URL('./.playwright-browsers', import.meta.url));
export default defineConfig({
  testDir: './tests/amelia3', testMatch: '**/*.spec.mjs', outputDir: './test-results/amelia3',
  workers: 1, fullyParallel: false, timeout: 90000, retries: 0, expect: { timeout: 15000 },
  reporter: [['list'], ['json', { outputFile: 'qa/amelia3/playwright-results.json' }]],
  use: { baseURL: process.env.HFS_TEST_URL || 'http://127.0.0.1:3002', locale: 'it-IT', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'phone-chromium', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'tablet-chromium', use: { browserName: 'chromium', viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: 'landscape-chromium', use: { browserName: 'chromium', viewport: { width: 1024, height: 768 }, hasTouch: true } },
    { name: 'desktop-chromium', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
    { name: 'apple-webkit', use: { browserName: 'webkit', viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true } }
  ]
});
