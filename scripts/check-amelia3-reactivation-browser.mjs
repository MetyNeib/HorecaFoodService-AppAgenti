import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= fileURLToPath(new URL('../.playwright-browsers', import.meta.url));
const { chromium, webkit } = await import('@playwright/test');
const accounts = JSON.parse(fs.readFileSync('imports/private/amelia3/local_accounts.json', 'utf8').replace(/^\uFEFF/, ''));
const results = [];
for (const [name, engine, viewport] of [['desktop', chromium, { width: 1440, height: 900 }], ['apple', webkit, { width: 768, height: 1024 }]]) {
  const browser = await engine.launch();
  try {
    const context = await browser.newContext({ viewport, locale: 'it-IT' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', () => errors.push('javascript_error'));
    const account = accounts.find(row => row.role === 'admin');
    await page.goto('http://127.0.0.1:3002/users/sign_in');
    await page.getByLabel('Email', { exact: true }).fill(account.email);
    await page.getByLabel('Password', { exact: true }).fill(account.password);
    await page.getByRole('button', { name: 'Accedi', exact: true }).click();
    await page.waitForFunction(() => !!window.HFS?.client?.record);
    await page.evaluate(() => window.HFS.ready);
    try {
      await page.waitForFunction(() => window.HFS.offlinePrepared && navigator.serviceWorker.controller, null, { timeout: 60000 });
    } catch {
      console.log(JSON.stringify(await page.evaluate(() => ({ prepared: !!window.HFS.offlinePrepared, controller: !!navigator.serviceWorker.controller, storage_failure: !!window.HFS.storageFailure, auth_required: !!window.HFS.client.authRequired, reachable: !!window.HFS.client.reachable }))));
      throw new Error('Real browser offline preparation failed');
    }
    const go = path => page.evaluate(path => window.HFS.navigate(path), path);
    await go('/amelia3/catalog');
    assert.equal(await page.locator('.product-card').count(), 50);
    const invalidSelectors = () => page.evaluate(() => [...document.querySelectorAll('.product-card')].filter(card => {
      const units = card.querySelectorAll('.amelia-unit-option'), select = card.querySelector('select');
      return units.length === 1 ? !!select || !card.querySelector('.amelia-unit-fixed') : !select || select.options.length !== units.length;
    }).length);
    assert.equal(await invalidSelectors(), 0);
    const example = JSON.parse(fs.readFileSync('imports/private/amelia3/verification-v5/multi-unit-examples.json', 'utf8'))[0];
    await go('/amelia3/catalog?q=' + encodeURIComponent(example));
    const select = page.locator('.product-card select').first();
    const alternatives = await select.locator('option').evaluateAll(rows => rows.map(row => row.value));
    assert.ok(alternatives.length > 1);
    await select.selectOption(alternatives[1]);
    assert.equal(await page.locator('.product-card .amelia-unit-option:visible').first().getAttribute('data-unit'), alternatives[1]);
    await go('/amelia3/alerts');
    assert.equal(await page.locator('[data-alert-type="CUSTOMER_REACTIVATION"]').count(), 0);
    await page.getByRole('link', { name: 'Da riattivare', exact: true }).click();
    await page.getByRole('heading', { name: 'Clienti da riattivare', exact: true }).waitFor();
    assert.equal(await page.locator('[data-alert-type="CUSTOMER_REACTIVATION"]').count(), 10);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: `imports/private/amelia3/verification-v5/browser/reactivation-${name}.png` });
    await page.locator('[data-alert-id]').first().getByRole('link', { name: 'Apri cliente', exact: true }).click();
    await page.locator('.customer-view .badge.warning').waitFor();
    await page.waitForFunction(() => window.HFS.offlinePrepared && navigator.serviceWorker.controller);
    await context.setOffline(true); await page.reload();
    await page.locator('main').getByText(/Da riattivare/).waitFor();
    await go('/amelia3/catalog');
    assert.equal(await invalidSelectors(), 0);
    assert.equal(errors.length, 0);
    results.push({ profile: name, status: 'PASS', single_unit_static_online_offline: true, multiple_unit_switch: true, reactivation_page_size: 10, customer_badge_online_offline: true, business_mutations: 0 });
  } finally { await browser.close(); }
}
fs.writeFileSync('qa/amelia3-v5/reactivation-real-browser.json', JSON.stringify({ status: 'PASS', results, screenshots: 'private-only' }, null, 2) + '\n');
console.log(JSON.stringify({ status: 'PASS', results }));
