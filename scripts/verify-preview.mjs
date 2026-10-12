import {fileURLToPath} from 'node:url';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
process.env.PLAYWRIGHT_BROWSERS_PATH=fileURLToPath(new URL('../.playwright-browsers',import.meta.url));
const {chromium,expect}=await import('@playwright/test');
const browser=await chromium.launch();
const results=[];
try {
 for(const [name,width,height] of [['phone',390,844],['tablet-portrait',768,1024],['tablet-landscape',1024,768],['desktop',1440,900]]){
  const page=await browser.newPage({viewport:{width,height},locale:'it-IT'});
  const failures=[];
  page.on('pageerror',e=>failures.push(e.message));
  page.on('download',()=>failures.push('Download inatteso'));
  page.on('popup',()=>failures.push('Popup inatteso'));
  await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='http://127.0.0.1:4173'){failures.push('Richiesta esterna '+u.href);return route.abort();}return route.continue();});
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.getByRole('heading',{name:'Home',exact:true})).toBeVisible();
  await expect(page.getByText('3 da verificare')).toBeVisible();
  await page.screenshot({path:`qa/screenshots/preview-${name}-home.png`,fullPage:true});
  await page.goto('http://127.0.0.1:4173/#/orders/BOZ-26-00021/products?q=0107417');
  await expect(page.getByTestId('product-0107417')).toBeVisible();
  await page.getByTestId('product-0107417').getByRole('link',{name:'Scheda prodotto'}).click();
  await page.getByRole('button',{name:'Ingrandisci visual'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('link',{name:/Torna alla selezione/}).click();
  await expect(page.getByRole('searchbox')).toHaveValue('0107417');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.goto('http://127.0.0.1:4173/#/customers/CLI-061002?tab=open-items');
  await expect(page.locator('main')).toContainText('360,00');
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await page.goto('http://127.0.0.1:4173/#/customers/CLI-061001/share');
  await page.getByRole('button',{name:'Scarica PDF · simulato'}).click();
  await page.getByRole('button',{name:'Simula download PDF'}).click();
  await expect(page.getByRole('button',{name:'Simulazione registrata'})).toBeDisabled();
  assert.deepEqual(failures,[]);
  results.push({viewport:name,width,height,status:'PASS',externalRequests:0,unexpectedDownloads:0,errors:0});
  await page.close();
 }
 writeFileSync(new URL('../qa/preview-verification.json',import.meta.url),JSON.stringify({url:'http://127.0.0.1:4173/',status:'PASS',results},null,2));
 console.log('PASS: build dist verificata su 4 viewport; nessuna richiesta esterna, download o errore.');
} finally {await browser.close();}
