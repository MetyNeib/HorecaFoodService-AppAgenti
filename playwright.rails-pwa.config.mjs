import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= fileURLToPath(new URL('./.playwright-browsers', import.meta.url));
export default defineConfig({
  testDir: './tests/rails-pwa', outputDir: './test-results/rails-pwa', testMatch: '**/*.spec.mjs', workers: 1, fullyParallel: false, timeout: 60000, retries: 0,
  expect: { timeout: 15000 },
  reporter: [['list'], ['json', { outputFile: 'qa/rails/pwa-results.json' }], ['html', { outputFolder: 'qa/rails/pwa-report', open: 'never' }]],
  use: { baseURL: process.env.HFS_TEST_URL || 'http://127.0.0.1:3002', locale: 'it-IT', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'android-chromium', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'ipad-webkit', use: { browserName: 'webkit', viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true } }
  ]
});
