import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { login, reset } from './helpers.mjs';

const views = [
  ['home', '/'], ['customer-picker', '/orders/new/customer'],
  ['products', '/orders/BOZ-26-00021/products'],
  ['line', '/orders/BOZ-26-00021/lines/BOZ-26-00021-L01/edit'],
  ['review', '/orders/BOZ-26-00021/review'], ['inbox', '/fastorder'],
  ['wa-review', '/fastorder/WA-26-00841'],
  ['wa-resolve', '/fastorder/WA-26-00841/resolve/WA-26-00841-R07'],
  ['drafts', '/orders?tab=drafts'], ['pending', '/orders?tab=pending'], ['sent', '/orders?tab=sent'],
  ['customers', '/customers'], ['customer-details', '/customers/CLI-061001'],
  ['customer-orders', '/customers/CLI-061001?tab=orders'],
  ['open-items', '/customers/CLI-061001?tab=open-items'], ['share', '/customers/CLI-061001/share'],
  ['commercial', '/customers/CLI-061001?tab=commercial'], ['catalog', '/catalog'],
  ['product-detail', '/catalog/ART-0107417'], ['insights', '/insights'],
  ['analysis', '/insights/CLI-061001'], ['actions', '/insights/CLI-061001/actions'],
];

async function geometry(page) {
  return page.evaluate(() => {
    const main = document.querySelector('main');
    const footer = document.querySelector('.app-footer');
    const clipped = [...main.querySelectorAll('.view,.pane,.workspace-split,.cart,.hero-card,.navigation-card,.resolver-confirm,.action-bar')]
      .filter(el => getComputedStyle(el).overflowY !== 'auto' && (el.scrollWidth > el.clientWidth + 3 || el.scrollHeight > el.clientHeight + 3))
      .map(el => ({ class: el.className, width: [el.clientWidth, el.scrollWidth], height: [el.clientHeight, el.scrollHeight] }));
    return { width: document.documentElement.scrollWidth, viewport: innerWidth,
      mainBottom: main.getBoundingClientRect().bottom, footerTop: footer.getBoundingClientRect().top,
      footerBottom: footer.getBoundingClientRect().bottom, height: innerHeight, clipped };
  });
}

test('22 viste Rails: contenuti completi, layout e screenshot nei quattro formati', async ({ page }, info) => {
  const errors = []; const external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!['localhost', '127.0.0.1'].includes(new URL(request.url()).hostname)) external.push(request.url()); });
  await login(page); await reset(page);
  const dir = path.join('qa', 'rails-ui', 'screenshots'); fs.mkdirSync(dir, { recursive: true });
  const results = [];
  for (const [name, route] of views) {
    const response = await page.goto(route);
    expect.soft(response.status(), `${name}: HTTP`).toBe(200);
    if (response.status() !== 200) {
      results.push({ name, route, error: (await page.locator('body').innerText()).slice(0, 2000) });
      continue;
    }
    await expect.soft(page.locator('main .view'), name).toBeVisible();
    await page.waitForTimeout(1350);
    const result = await geometry(page); results.push({ name, route, ...result });
    expect.soft(result.width, `${name}: horizontal overflow`).toBeLessThanOrEqual(result.viewport + 1);
    expect.soft(result.mainBottom, `${name}: footer overlap`).toBeLessThanOrEqual(result.footerTop + 1);
    expect.soft(result.footerBottom, `${name}: footer outside viewport`).toBeLessThanOrEqual(result.height + 1);
    expect.soft(result.clipped, `${name}: clipped containers`).toEqual([]);
    await page.screenshot({ path: path.join(dir, `${info.project.name}-${name}.png`) });
  }
  fs.writeFileSync(path.join('qa', 'rails-ui', `${info.project.name}-layout.json`), JSON.stringify(results, null, 2));
  expect(errors).toEqual([]); expect(external).toEqual([]);
});

test('dock, dialog, filtri, form cliente e visual prodotto', async ({ page }) => {
  await login(page); await reset(page);
  await page.goto('/catalog');
  await expect(page.locator('.header-dock')).toHaveAttribute('data-open', 'false');
  await page.locator('.header-toggle').click();
  await page.locator('.footer-toggle').click();
  await page.waitForTimeout(1200);
  await expect(page.locator('.header-dock')).toHaveAttribute('data-open', 'true');
  await expect(page.locator('.status-dock')).toHaveAttribute('data-open', 'true');
  await page.getByRole('button', { name: 'Stato sincronizzazione', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Stato sincronizzazione', exact: true })).toBeFocused();
  await page.getByRole('searchbox').fill('0207423');
  await expect(page.locator('main')).toContainText('Esaurito');
  await page.getByLabel('Solo disponibili').check();
  await expect(page.locator('main')).toContainText('Nessun risultato.');
  await page.getByLabel('Solo disponibili').uncheck();
  await page.getByRole('link', { name: /Scheda prodotto/ }).click();
  await page.getByRole('button', { name: 'Ingrandisci visual' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Leggi tutto' }).click();
  await expect(page.locator('main')).toContainText('Unità commerciale');
  await page.goto('/customers/CLI-061001');
  await page.getByRole('button', { name: 'Modifica referente' }).first().click();
  await page.getByRole('dialog').getByLabel('Nome', { exact: true }).fill('NonSalvare');
  await page.getByRole('button', { name: 'Annulla', exact: true }).click();
  await expect(page.locator('main')).not.toContainText('NonSalvare');
  await page.goto('/customers/CLI-061001?tab=open-items');
  await expect(page.locator('main')).toContainText('587,46');
  await page.getByRole('button', { name: 'Apri', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toContainText('Non è un documento fiscale');
});
