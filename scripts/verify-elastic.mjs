import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
process.env.PLAYWRIGHT_BROWSERS_PATH = fileURLToPath(new URL('../.playwright-browsers', import.meta.url));
const { chromium, expect } = await import('@playwright/test');
const url = process.env.HFS_QA_URL || 'http://127.0.0.1:4173';
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
const sizes = [
    ['phone',390,844], ['tablet-portrait',768,1024], ['tablet-landscape',1024,768], ['desktop',1440,900],
    ['wide-desktop',1920,872], ['laptop',1366,768], ['compact-tablet',600,960], ['tall-phone',412,915],
    ['short-desktop',1276,550], ['compact-desktop',1276,650], ['short-landscape',1024,568],
    ['short-portrait',768,650], ['low-portrait',768,500], ['low-tablet',600,500],
    ['low-desktop',1440,400], ['zoom-space',736,414], ['short-phone',390,500],
    ['browser-chrome',1276,738], ['minimum-landscape',1024,350],
];
const directory = 'qa/elastic/screenshots';
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] });
const results = [], failures = [];
const settle = async page => {
    await expect(page.locator('.header-dock')).toHaveAttribute('data-open', 'false');
    await expect(page.locator('.status-dock')).toHaveAttribute('data-open', 'false');
    await expect(page.locator('.workspace-shell')).toHaveAttribute('data-layout', /fit|flow/);
    await page.waitForTimeout(280);
};
async function verify(page, name, screen) {
    await settle(page);
    const metrics = await page.evaluate(() => {
        const rect = el => { const r = el.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right }; };
        const main = document.querySelector('main');
        const shell = document.querySelector('.workspace-shell');
        const clipped = [...main.querySelectorAll('.view,.pane,.workspace-split,.cart,.home-view .grid,.hero-card,.navigation-card,.resolver-confirm,.action-bar')]
            .filter(el => getComputedStyle(el).overflowY !== 'auto' && (el.scrollHeight > el.clientHeight + 3 || el.scrollWidth > el.clientWidth + 3))
            .map(el => ({ class:el.className, height:el.clientHeight, required:el.scrollHeight, width:el.clientWidth, requiredWidth:el.scrollWidth }));
        const regions = [...main.querySelectorAll('.scroll-area')].map(el => {
            let items = [...el.querySelectorAll(':scope > article, :scope > .summary-line')];
            if (!items.length) items = [...el.querySelectorAll(':scope > table > tbody > tr')];
            if (!items.length) items = [...el.querySelectorAll(':scope > button')];
            const bounds = el.getBoundingClientRect();
            const boxes = items.map(item => item.getBoundingClientRect());
            return { name:el.getAttribute('aria-label'),...rect(el),scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,
                kind:el.dataset.kind,items:items.length,visibleItems:boxes.filter(box=>box.top>=bounds.top-1&&box.bottom<=bounds.bottom+1).length,
                clippedItems:items.filter(item=>item.scrollWidth>item.clientWidth+2||item.scrollHeight>item.clientHeight+2).length };
        });
        return { width:innerWidth,height:innerHeight,layout:shell.dataset.layout,density:shell.dataset.density,
            documentWidth:document.documentElement.scrollWidth,documentHeight:document.documentElement.scrollHeight,
            main:{...rect(main),clientHeight:main.clientHeight,scrollHeight:main.scrollHeight},
            footer:rect(document.querySelector('.app-footer')),clipped,regions };
    });
    const problems = [];
    if (metrics.documentWidth > metrics.width + 1) problems.push('horizontal document overflow');
    if (metrics.documentHeight > metrics.height + 1) problems.push('vertical document overflow outside workspace');
    if (metrics.footer.bottom > metrics.height + 1 || metrics.main.bottom > metrics.footer.y + 1) problems.push('footer overlap');
    if (metrics.main.height < 120) problems.push('workspace under 120px');
    if (metrics.clipped.length) problems.push('clipped containers '+JSON.stringify(metrics.clipped));
    if (metrics.regions.some(r => r.scrollHeight > r.clientHeight + 3 && r.clientHeight < 120)) problems.push('scrolling region under 120px');
    if (metrics.regions.some(r => r.kind === 'list' && r.items >= 2 && r.visibleItems < 2)) problems.push('fewer than two complete list items');
    if (metrics.regions.some(r => r.kind === 'list' && r.clippedItems)) problems.push('clipped list items');
    if (metrics.layout === 'fit' && metrics.main.scrollHeight > metrics.main.clientHeight + 2) problems.push('fit mode requires scrolling');
    // Every primary action must be fully reachable, even after the dock reveals.
    for (const control of await page.locator('.action-bar button,.action-bar a,.cart-summary button,.resolver-confirm > button').all()) {
        try {
            await control.scrollIntoViewIfNeeded();
            await settle(page);
            await control.scrollIntoViewIfNeeded();
            await expect(control).toBeInViewport({ ratio:1, timeout:1500 });
        } catch { problems.push('unreachable action: '+await control.textContent()); }
    }
    const row = { viewport:name,screen,status:problems.length?'FAIL':'PASS',problems,...metrics };
    results.push(row);
    if (problems.length) failures.push(`${name}/${screen}: ${problems.join('; ')}`);
    await page.locator('main').evaluate(el => { el.scrollTop = 0; });
    await settle(page);
    await page.screenshot({ path:`${directory}/${name}-${screen}.png` });
    if (metrics.layout === 'flow') {
        await page.locator('main').evaluate(el => { el.scrollTop = el.scrollHeight; });
        await settle(page);
        await page.locator('main').evaluate(el => { el.scrollTop = el.scrollHeight; });
        await page.screenshot({ path:`${directory}/${name}-${screen}-bottom.png` });
    }
}
async function verifyViewport([name,width,height]) {
        const page = await browser.newPage({ viewport:{width,height},locale:'it-IT' });
        page.on('pageerror', error => failures.push(`${name}: ${error.message}`));
        page.on('download', () => failures.push(`${name}: unexpected download`));
        await page.route('**/*', route => {
            if (new URL(route.request().url()).origin !== new URL(url).origin) {
                failures.push('External request: '+route.request().url()); return route.abort();
            }
            return route.continue();
        });
        for (const [path,screen] of routes) {
            await page.goto(url+'/#'+path);
            await expect(page.locator('h1')).toBeVisible();
            await verify(page,name,screen);
            if (screen === 'wa-resolve') {
                await page.locator('article').filter({hasText:'0207430'}).getByRole('button',{name:'Scegli',exact:true}).click();
                await verify(page,name,'wa-resolve-selected');
            }
        }
        await page.close();
        console.log(`${name}: ${results.filter(r=>r.viewport===name&&r.status==='PASS').length}/23 PASS`);
}
try {
    for (let offset = 0; offset < sizes.length; offset += 3) {
        await Promise.all(sizes.slice(offset, offset + 3).map(verifyViewport));
    }
} finally { await browser.close(); }
writeFileSync('qa/elastic/layout-results.json',JSON.stringify({url,status:failures.length?'FAIL':'PASS',viewports:sizes.length,results,failures},null,2));
writeFileSync(directory+'/index.html',`<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HFS — layout elastico</title><style>body{font:16px system-ui;margin:24px;background:#f7f4ef;color:#111827}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}a{background:white;color:#204ee0;border:1px solid #cbd2df;border-radius:8px;padding:8px}img{width:100%;height:230px;object-fit:contain}span{display:block}</style><h1>HFS — layout elastico</h1><p>${results.length} verifiche · ${sizes.length} viewport · ${failures.length} errori</p><div class="grid">${results.map(r=>`<a href="${r.viewport}-${r.screen}.png"><img loading="lazy" src="${r.viewport}-${r.screen}.png"><span>${r.viewport} · ${r.screen} · ${r.layout}/${r.density} · ${r.status}</span></a>`).join('')}</div></html>`);
console.log(JSON.stringify({screens:results.length,status:failures.length?'FAIL':'PASS',failures},null,2));
if (failures.length) process.exitCode = 1;
