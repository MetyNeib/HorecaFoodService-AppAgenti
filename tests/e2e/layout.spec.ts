import { test, expect } from '@playwright/test';
import { isFlowing, usable } from './workspace-helpers';

test('Home raggiungibile e lista clienti navigabile da tastiera', async ({ page }) => {
    await page.goto('/');
    await usable(page);
    const statistics = page.getByRole('link', { name: /Statistiche e segnalazioni/ });
    if (await isFlowing(page)) await statistics.scrollIntoViewIfNeeded();
    await expect(statistics).toBeInViewport({ ratio: 1 });
    await page.getByRole('link', { name: /Inserisci nuovo ordine/ }).click();
    await usable(page);
    const list = page.getByRole('region', { name: 'Lista clienti', exact: true });
    await list.scrollIntoViewIfNeeded();
    await list.focus();
    await page.keyboard.press('End');
    await expect(list.getByRole('button', { name: 'Seleziona →' }).last()).toBeInViewport();
    expect(await list.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    await usable(page);
    if (!await isFlowing(page)) await expect(page.getByRole('searchbox')).toBeInViewport({ ratio: 1 });
});

test('liste indipendenti e conferma WhatsApp raggiungibile senza contenuti tagliati', async ({ page }) => {
    await page.goto('/#/orders/BOZ-26-00021/products');
    // Measure independence after the intentional one-second dock resize.
    await expect(page.locator('.header-dock')).toHaveAttribute('data-open', 'false');
    await expect(page.locator('.status-dock')).toHaveAttribute('data-open', 'false');
    await usable(page);
    const products = page.getByRole('region', { name: 'Lista prodotti', exact: true });
    const cart = page.getByRole('region', { name: 'Articoli nel carrello', exact: true });
    await products.scrollIntoViewIfNeeded();
    const summaryBefore = await page.locator('.cart-summary').boundingBox();
    await products.focus();
    await page.keyboard.press('End');
    await expect.poll(() => products.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    expect(await cart.evaluate(el => el.scrollTop)).toBe(0);
    if (!await isFlowing(page)) expect(await page.locator('.cart-summary').boundingBox()).toEqual(summaryBefore);
    const review = page.getByRole('button', { name: /Vai al riepilogo/ });
    if (await isFlowing(page)) await review.scrollIntoViewIfNeeded();
    await expect(review).toBeInViewport({ ratio: 1 });
    await usable(page);
    await page.goto('/#/fastorder/WA-26-00841/resolve/WA-26-00841-R07');
    await page.locator('article').filter({ hasText: '0207430' }).getByRole('button', { name: 'Scegli', exact: true }).click();
    await usable(page);
    const confirm = page.getByRole('button', { name: 'Conferma associazione' });
    if (await isFlowing(page)) await confirm.scrollIntoViewIfNeeded();
    await expect(confirm).toBeInViewport({ ratio: 1 });
    expect((await page.getByRole('region', { name: 'Prodotti da associare' }).boundingBox())!.height).toBeGreaterThanOrEqual(120);
    await page.goto('/#/customers/CLI-061001?tab=open-items');
    await usable(page);
    await page.locator('tbody tr').last().getByRole('button', { name: 'Apri', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
});
