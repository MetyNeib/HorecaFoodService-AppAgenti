import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= fileURLToPath(new URL('../.playwright-browsers', import.meta.url));
const { chromium, webkit } = await import('@playwright/test');
const credentials = JSON.parse(fs.readFileSync('imports/private/amelia3/local_accounts.json', 'utf8').replace(/^\uFEFF/, ''));
const privateDir = path.resolve('imports/private/amelia3/verification-v5/browser');
fs.mkdirSync(privateDir, { recursive: true });
const results = [];
const profiles = [
  ['phone', chromium, { width: 390, height: 844 }], ['tablet', chromium, { width: 768, height: 1024 }],
  ['landscape', chromium, { width: 1024, height: 768 }], ['desktop', chromium, { width: 1440, height: 900 }],
  ['webkit-tablet', webkit, { width: 768, height: 1024 }]
];
for (const [name, engine, viewport] of profiles) {
  const browser = await engine.launch();
  try {
    for (const role of ['agent', 'admin']) {
      const account = credentials.find(row => row.role === role);
      assert.ok(account, 'Local account missing');
      const context = await browser.newContext({ viewport, locale: 'it-IT' });
      const page = await context.newPage();
      const errors = [], remote = [];
      page.on('pageerror', () => errors.push('javascript_error'));
      page.on('request', request => { if (/^https?:/.test(request.url()) && !['127.0.0.1', 'localhost'].includes(new URL(request.url()).hostname)) remote.push('external_request'); });
      await page.goto('http://127.0.0.1:3002/users/sign_in');
      await page.getByLabel('Email', { exact: true }).fill(account.email);
      await page.getByLabel('Password', { exact: true }).fill(account.password);
      await page.getByRole('button', { name: 'Accedi', exact: true }).click();
      await page.waitForFunction(() => !!window.HFS?.client?.record);
      await page.evaluate(() => window.HFS.ready);
      const first = await page.evaluate(() => window.HFS.client.snapshot.state.data);
      if (role === 'agent') { assert.equal(first.portfolioCount, 16); assert.equal(first.customers.filter(customer => !customer.blocked).length, 12); }
      assert.ok(!Object.hasOwn(first, 'history') && !Object.hasOwn(first, 'alerts'));
      const customer = first.customers.find(row => !row.blocked);
      const routes = ['/amelia3', '/amelia3/customers', '/amelia3/catalog', '/amelia3/orders?status=HISTORY', '/amelia3/alerts', '/amelia3/whatsapp', `/amelia3/customers/${encodeURIComponent(customer.id)}?tab=orders`];
      let historicalRows = 0, alertRows = 0;
      for (const [index, route] of routes.entries()) {
        await page.evaluate(route => window.HFS.navigate(route), route);
        await page.locator('main h1').waitFor({ state: 'visible' });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Horizontal overflow');
        assert.equal(await page.locator('header, footer, .header-dock, .status-dock').count(), 0);
        assert.equal(await page.getByText('Reset demo', { exact: true }).count(), 0);
        if (route.includes('status=HISTORY')) { historicalRows = await page.locator('[aria-label="Ordini storici"] article').count(); assert.equal(historicalRows, 20); }
        if (route === '/amelia3/alerts') { alertRows = await page.locator('[data-alert-id]').count(); assert.equal(alertRows, role === 'admin' ? 10 : 0); }
        if ([2, 3, 4].includes(index)) await page.screenshot({ path: path.join(privateDir, `${name}-${role}-${index}.png`), fullPage: true, animations: 'disabled' });
      }
      await page.getByRole('button', { name: 'Apri menu', exact: true }).click();
      assert.equal(await page.locator('.amelia-menu-links a').count(), 7);
      await page.screenshot({ path: path.join(privateDir, `${name}-${role}-drawer.png`), animations: 'disabled' });
      await page.keyboard.press('Escape');
      assert.equal(errors.length, 0, 'Client-side error'); assert.equal(remote.length, 0, 'Unexpected external request');
      results.push({ profile: name, role, pages: routes.length, historical_orders_on_page: historicalRows, alerts_on_page: alertRows, status: 'PASS', business_mutations: 0, screenshots: 'private-only' });
      await context.close();
    }
  } finally { await browser.close(); }
  console.log(JSON.stringify({ profile: name, status: 'PASS', roles: 2 }));
}
fs.writeFileSync('qa/amelia3-v5/real-browser.json', JSON.stringify({ status: 'PASS', checks: results, physical_devices: 'NOT_RUN' }, null, 2) + '\n');
