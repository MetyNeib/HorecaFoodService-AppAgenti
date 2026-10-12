import { mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
process.env.PLAYWRIGHT_BROWSERS_PATH = fileURLToPath(new URL('../../.playwright-browsers', import.meta.url));
const { chromium } = await import('@playwright/test');
await mkdir('public/icons', { recursive: true });
const browser = await chromium.launch({ headless: true });
for (const size of [180, 192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#2e60ff"/><text x="256" y="294" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="144" font-weight="800">HFS</text><circle cx="401" cy="180" r="20" fill="#c5f268"/></svg></body></html>`);
  await page.screenshot({ path: `public/icons/hfs-${size}.png` });
  await page.close();
}
await copyFile('public/icons/hfs-180.png', 'public/icons/apple-touch-icon.png');
await browser.close();
