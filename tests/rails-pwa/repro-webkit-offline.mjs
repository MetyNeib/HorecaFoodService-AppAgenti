import http from 'node:http';
import { chromium, webkit } from 'playwright';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const report = { platform: process.platform, playwright: require('playwright/package.json').version, cases: [] };
const sw = `self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') event.respondWith(Promise.resolve(new Response('<!doctype html><title>Worker only</title><h1>SW synthetic response</h1>', {headers: {'Content-Type': 'text/html'}})));
});`;

for (const [engine, type] of Object.entries({ chromium, webkit })) {
  const browser = await type.launch();
  try {
    for (const mode of ['emulated_offline', 'origin_unavailable']) {
      const server = http.createServer((req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        if (req.url === '/worker.js') {
          res.setHeader('Content-Type', 'text/javascript');
          res.end(sw);
        } else {
          res.setHeader('Content-Type', 'text/html');
          res.end('<!doctype html><h1>Origin response</h1>');
        }
      });
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const url = `http://127.0.0.1:${server.address().port}/`;
      const context = await browser.newContext();
      const page = await context.newPage();
      const result = { engine, mode, browserVersion: browser.version() };
      try {
        await page.goto(url);
        await page.evaluate(async () => {
          await navigator.serviceWorker.register('/worker.js');
          await navigator.serviceWorker.ready;
        });
        await page.waitForFunction(() => !!navigator.serviceWorker.controller);
        await page.reload();
        result.controlledBefore = await page.locator('h1').innerText();
        if (mode === 'emulated_offline') {
          await context.setOffline(true);
        } else {
          server.closeAllConnections();
          await new Promise(resolve => server.close(resolve));
        }
        await page.reload({ timeout: 10000 });
        result.after = await page.locator('h1').innerText();
        result.pass = result.after === 'SW synthetic response';
      } catch (error) {
        result.pass = false;
        result.error = error.message;
      } finally {
        await context.close();
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
      }
      report.cases.push(result);
    }
  } finally {
    await browser.close();
  }
}
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
