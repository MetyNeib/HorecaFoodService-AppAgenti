import { mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve('.playwright-browsers');
const { chromium } = await import('@playwright/test');

const root = resolve('qa/centro-cash-presentation');
const screens = resolve(root, 'screens');
const slides = resolve(root, 'slide-previews');
const html = resolve(root, 'presentazione.html');
const pdf = resolve(root, 'Centro-Cash-order-app-presentazione.pdf');
const base = process.env.CENTRO_CASH_URL ?? 'http://127.0.0.1:4173';
mkdirSync(screens, { recursive: true });
mkdirSync(slides, { recursive: true });

const views = [
  ['home', '/'],
  ['customer', '/orders/new/customer'],
  ['products', '/orders/BOZ-26-00021/products'],
  ['review', '/orders/BOZ-26-00021/review'],
  ['line', '/orders/BOZ-26-00021/lines/BOZ-26-00021-L01/edit'],
  ['inbox', '/fastorder'],
  ['wa-review', '/fastorder/WA-26-00841'],
  ['wa-resolve', '/fastorder/WA-26-00841/resolve/WA-26-00841-R07'],
  ['analysis', '/insights/CLI-061001'],
  ['insights', '/insights'],
  ['analysis-bottom', '/insights/CLI-061001'],
  ['orders', '/orders?tab=drafts'],
  ['catalog', '/catalog'],
  ['open-items', '/customers/CLI-061001?tab=open-items'],
];

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2, locale: 'it-IT' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const [name, route] of views) {
    const response = await page.goto(`${base}/#${route}`, { waitUntil: 'networkidle' });
    if (response && !response.ok()) throw new Error(`${name}: HTTP ${response.status()}`);
    await page.locator('.app-header img[alt="Centro Cash"]').waitFor();
    await page.locator('.view').waitFor();
    if (name === 'analysis-bottom') await page.locator('.scroll-area').first().evaluate(element => { element.scrollTop = element.scrollHeight; });
    await page.screenshot({ path: resolve(screens, `${name}.png`) });
  }
  await context.close();
  if (errors.length) throw new Error(`Errori nell'app: ${errors.join('; ')}`);

  const printPage = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await printPage.goto(pathToFileURL(html).href, { waitUntil: 'networkidle' });
  const count = await printPage.locator('.slide').count();
  if (count !== 7) throw new Error(`Attese 7 slide, trovate ${count}`);
  const broken = await printPage.locator('img').evaluateAll(images => images.filter(image => !image.complete || image.naturalWidth === 0).map(image => image.getAttribute('src')));
  if (broken.length) throw new Error(`Immagini non caricate: ${broken.join(', ')}`);
  for (let i = 0; i < count; i++) {
    const slide = printPage.locator('.slide').nth(i);
    const overflow = await slide.evaluate(element => element.scrollHeight > element.clientHeight + 2 || element.scrollWidth > element.clientWidth + 2);
    if (overflow) throw new Error(`Slide ${i + 1}: contenuto oltre il bordo`);
    await slide.screenshot({ path: resolve(slides, `slide-${String(i + 1).padStart(2, '0')}.png`) });
  }
  await printPage.pdf({ path: pdf, printBackground: true, preferCSSPageSize: true });
  await printPage.close();
  console.log(`PASS: ${views.length} schermate, ${count} slide, PDF ${statSync(pdf).size} byte`);
  console.log(pdf);
} finally {
  await browser.close();
}
