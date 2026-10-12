import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
process.env.PLAYWRIGHT_BROWSERS_PATH = fileURLToPath(new URL('../.playwright-browsers', import.meta.url));
const { chromium, expect } = await import('@playwright/test');
const url = process.env.HFS_QA_URL || 'http://127.0.0.1:5173';
const quick = process.argv.includes('--quick');
const routes = [
  ['/', 'home'], ['/orders/new/customer', 'customer-picker'],
  ['/orders/BOZ-26-00021/products', 'products-cart'],
  ['/orders/BOZ-26-00021/lines/BOZ-26-00021-L01/edit', 'line-editor'],
  ['/orders/BOZ-26-00021/review', 'review'], ['/fastorder', 'inbox'],
  ['/fastorder/WA-26-00841', 'wa-review'],
  ['/fastorder/WA-26-00841/resolve/WA-26-00841-R07', 'wa-resolve'],
  ['/orders?tab=drafts', 'drafts'], ['/orders?tab=pending', 'pending'], ['/orders?tab=sent', 'sent'],
  ['/customers', 'customers'], ['/customers/CLI-061001', 'customer-details'],
  ['/customers/CLI-061001?tab=orders', 'customer-orders'],
  ['/customers/CLI-061001?tab=open-items', 'open-items'],
  ['/customers/CLI-061001/share', 'share'], ['/customers/CLI-061001?tab=commercial', 'commercial'],
  ['/catalog', 'catalog'], ['/catalog/ART-0107417', 'product-detail'],
  ['/insights', 'insights'], ['/insights/CLI-061001', 'analysis'], ['/insights/CLI-061001/actions', 'actions'],
];
const sizes = [['phone',390,844], ['tablet-portrait',768,1024], ['tablet-landscape',1024,768], ['desktop',1440,900], ['wide-desktop',1920,872], ['laptop',1366,768], ['compact-tablet',600,960], ['tall-phone',412,915]];
mkdirSync('qa/refit/screenshots', { recursive: true });
const browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] });
const results = [], failures = [];
try {
  for (const [name, width, height] of quick ? sizes.slice(0,5) : sizes) {
    const page = await browser.newPage({ viewport: { width, height }, locale: 'it-IT' });
    page.on('pageerror', error => failures.push(`${name}: ${error.message}`));
    await page.route('**/*', route => { if (new URL(route.request().url()).origin !== url) { failures.push('External request: ' + route.request().url()); return route.abort(); } return route.continue(); });
    for (const [path, screen] of quick ? routes.filter(([,s]) => ['home','products-cart','line-editor','open-items','wa-resolve'].includes(s)) : routes) {
      await page.goto(url + '/#' + path);
      await expect(page.locator('h1')).toBeVisible();
      const metrics = await page.evaluate(() => {
        const rect = el => { const r = el.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}; };
        const view = document.querySelector('.view');
        const mobile = matchMedia('(max-width:650px) and (max-aspect-ratio:93/200)').matches;
        const clipped = [...document.querySelectorAll('.view,.pane,.workspace-split,.cart,.home-view>.grid,.hero-card')].filter(el => el.scrollHeight > el.clientHeight + 3).map(el => ({class:el.className,height:el.clientHeight,scrollHeight:el.scrollHeight}));
        const regions = [...document.querySelectorAll('.scroll-area')].map(el => ({name:el.getAttribute('aria-label'),...rect(el),scrollHeight:el.scrollHeight,clientHeight:el.clientHeight}));
        const actions = [...document.querySelectorAll('.action-bar,.cart-summary')].map(rect);
        return {mobile,width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,documentHeight:document.documentElement.scrollHeight,view:rect(view),footer:rect(document.querySelector('.app-footer')),clipped,regions,actions};
      });
      const problems = [];
      if (metrics.documentWidth > width+1) problems.push('horizontal document overflow');
      if (metrics.clipped.length) problems.push('clipped containers '+JSON.stringify(metrics.clipped));
      if (!metrics.mobile) {
        if (metrics.documentHeight > height+1) problems.push('vertical document overflow');
        if (metrics.footer.bottom > height+1) problems.push('footer outside viewport');
        if (metrics.regions.some(r => r.height < 70)) problems.push('content region under 70px');
        if (metrics.actions.some(r => r.bottom > metrics.footer.y+1)) problems.push('action bar outside workspace');
      }
      const row={viewport:name,screen,status:problems.length?'FAIL':'PASS',problems,...metrics};
      results.push(row);
      if(problems.length) failures.push(`${name}/${screen}: ${problems.join('; ')}`);
      await page.screenshot({path:`qa/refit/screenshots/${name}-${screen}.png`,fullPage:true});
    }
    await page.close();
  }
} finally { await browser.close(); }
writeFileSync(`qa/refit/${quick?'diagnostic':'layout-results'}.json`,JSON.stringify({url,status:failures.length?'FAIL':'PASS',results,failures},null,2));
console.log(JSON.stringify({screens:results.length,failures},null,2));
if(failures.length) process.exitCode=1;
