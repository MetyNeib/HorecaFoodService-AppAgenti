import { test, expect } from '@playwright/test';
import { openFooter, settled, usable } from './workspace-helpers';

test.beforeEach(async ({ page }) => {
    await page.route('**/*', route => {
        expect(['127.0.0.1', 'localhost']).toContain(new URL(route.request().url()).hostname);
        return route.continue();
    });
    page.on('pageerror', error => { throw error; });
});

test('ridimensionamento continuo: card distinte, leggibili e raggiungibili', async ({ page }, info) => {
    await page.goto('/');
    for (const [width, height] of [[1440, 900], [1276, 650], [1276, 550], [768, 650], [768, 500], [600, 500], [390, 500], [1440, 400], [1440, 900]]) {
        await page.setViewportSize({ width, height });
        await usable(page);
        const cards = page.locator('.home-links > a');
        await expect(cards).toHaveCount(3);
        const boxes = await cards.evaluateAll(elements => elements.map(el => {
            const r = el.getBoundingClientRect();
            return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, font: parseFloat(getComputedStyle(el.querySelector('p')!).fontSize), border: getComputedStyle(el).borderTopWidth };
        }));
        expect(boxes.every(box => box.font >= 16 && parseFloat(box.border) >= 1)).toBeTruthy();
        for (let i = 1; i < boxes.length; i++) expect(boxes[i].x >= boxes[i - 1].right - 1 || boxes[i].y >= boxes[i - 1].bottom - 1).toBeTruthy();
        for (const card of await cards.all()) {
            await card.scrollIntoViewIfNeeded();
            await settled(page);
            await card.scrollIntoViewIfNeeded();
            await expect(card).toBeInViewport({ ratio: 1 });
        }
        await usable(page);
        if (width === 1440 && height === 900) {
            await expect(page.locator('.workspace-shell')).toHaveAttribute('data-layout', 'fit');
            await expect(page.locator('.workspace-shell')).toHaveAttribute('data-density', 'regular');
        }
        if (width === 1276 && height === 650) {
            expect(boxes[0].y).toBeCloseTo(boxes[2].y, 0);
            await page.screenshot({ path: `qa/elastic/${info.project.name}-home-three-cards.png` });
        }
    }
});

test('header e footer: un secondo, apertura manuale stabile, scroll e focus', async ({ page }, info) => {
    const time = new Date('2026-10-11T10:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(time);
    await page.goto('/#/catalog');
    const header = page.locator('.header-dock');
    const footer = page.locator('.status-dock');
    await expect(header).toHaveAttribute('data-open', 'true');
    await expect(footer).toHaveAttribute('data-open', 'true');
    await page.clock.runFor(900);
    await expect(header).toHaveAttribute('data-open', 'true');
    await expect(footer).toHaveAttribute('data-open', 'true');
    await page.clock.runFor(150);
    await expect(header).toHaveAttribute('data-open', 'false');
    await expect(footer).toHaveAttribute('data-open', 'false');
    await page.clock.resume();
    await settled(page);
    await page.locator('.header-toggle').focus();
    await page.keyboard.press('Enter');
    await openFooter(page);
    await page.waitForTimeout(1300);
    await expect(header).toHaveAttribute('data-open', 'true');
    await expect(footer).toHaveAttribute('data-open', 'true');
    await expect(page.locator('.wordmark')).toBeVisible();
    await expect(header).toContainText('Marco Rossi');
    await page.getByRole('searchbox').fill('a');
    await page.waitForTimeout(1300);
    await expect(header).toHaveAttribute('data-open', 'true');
    await expect(footer).toHaveAttribute('data-open', 'true');
    const list = page.getByRole('region', { name: 'Lista catalogo', exact: true });
    await list.evaluate(el => { el.scrollTop = 90; });
    await expect(header).toHaveAttribute('data-open', 'false');
    await expect(footer).toHaveAttribute('data-open', 'false');
    await settled(page);
    await expect(header.getByRole('link')).toHaveCount(0);
    await expect(header.getByRole('button')).toHaveCount(1);
    await expect(footer.getByRole('button')).toHaveCount(1);
    await expect(page.locator('.header-toggle')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.footer-toggle')).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: `qa/elastic/${info.project.name}-docks-auto-collapsed.png` });
    await openFooter(page);
    await page.getByRole('button', { name: 'Stato sincronizzazione', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Stato sincronizzazione', exact: true })).toBeFocused();
    // Upward list scroll also ends an explicit opening.
    await list.evaluate(el => { el.scrollTop = 40; });
    await expect(footer).toHaveAttribute('data-open', 'false');
    await expect(page.locator('.footer-toggle')).toBeFocused();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openFooter(page);
    await page.getByRole('button', { name: 'Reset demo', exact: true }).click();
    await page.getByRole('button', { name: 'Ripristina seed', exact: true }).click();
    await expect(header).toHaveAttribute('data-open', 'true');
    await expect(footer).toHaveAttribute('data-open', 'true');
    await expect(header).toHaveAttribute('data-open', 'false');
    await expect(footer).toHaveAttribute('data-open', 'false');
    await page.locator('.header-toggle').click();
    await settled(page);
    await page.locator('.wordmark').click();
    await usable(page);
});

test('liste: almeno due schede complete e controlli leggibili', async ({ page }) => {
    for (const path of ['/orders/new/customer', '/orders/BOZ-26-00021/products', '/fastorder/WA-26-00841', '/fastorder/WA-26-00841/resolve/WA-26-00841-R07', '/orders?tab=sent', '/catalog', '/customers/CLI-061001?tab=open-items', '/customers/CLI-061001?tab=commercial', '/insights']) {
        await page.goto('/#' + path);
        await expect(page.locator('.header-dock')).toHaveAttribute('data-open', 'false');
        await expect(page.locator('.status-dock')).toHaveAttribute('data-open', 'false');
        await usable(page);
        const regions = page.locator('.scroll-area[data-kind="list"]');
        for (const region of await regions.all()) {
            const result = await region.evaluate(el => {
                let items = [...el.querySelectorAll(':scope > article, :scope > .summary-line')];
                if (!items.length) items = [...el.querySelectorAll(':scope > table > tbody > tr')];
                if (!items.length) items = [...el.querySelectorAll(':scope > button')];
                const bounds = el.getBoundingClientRect();
                const boxes = items.map(item => item.getBoundingClientRect());
                return { count: items.length, visible: boxes.filter(box => box.top >= bounds.top - 1 && box.bottom <= bounds.bottom + 1).length,
                    clips: items.filter(item => item.scrollWidth > item.clientWidth + 2 || item.scrollHeight > item.clientHeight + 2).length,
                    titles: [...el.querySelectorAll('h3')].map(title => parseFloat(getComputedStyle(title).fontSize)),
                    controls: [...el.querySelectorAll('button,input,select,.button')].map(control => control.getBoundingClientRect().height) };
            });
            if (result.count >= 2) expect(result.visible, await region.getAttribute('aria-label')).toBeGreaterThanOrEqual(2);
            expect(result.clips).toBe(0);
            expect(result.titles.every(size => size >= 18)).toBeTruthy();
            expect(result.controls.every(height => height >= 44)).toBeTruthy();
        }
    }
});

test('altezza ridotta dopo selezione WA, errori e ingrandimento: azioni e dati accessibili', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 500 });
    await page.goto('/#/fastorder/WA-26-00841/resolve/WA-26-00841-R07');
    await page.locator('article').filter({ hasText: '0207430' }).getByRole('button', { name: 'Scegli', exact: true }).click();
    await usable(page);
    const confirm = page.getByRole('button', { name: 'Conferma associazione' });
    await confirm.scrollIntoViewIfNeeded();
    await settled(page);
    await confirm.scrollIntoViewIfNeeded();
    await expect(confirm).toBeInViewport({ ratio: 1 });
    await confirm.click();
    await expect(page.locator('main')).toContainText('Confidenza');
    await page.goto('/#/orders/BOZ-26-00021/lines/BOZ-26-00021-L01/edit');
    await page.getByLabel('Prezzo finale').fill('1,255');
    await expect(page.getByRole('alert')).toContainText('due decimali');
    await usable(page);
    await page.getByLabel('Prezzo finale').fill('1,20');
    await page.getByLabel('Salva queste condizioni').check();
    await page.setViewportSize({ width: 736, height: 414 }); // usable CSS space at ~200% browser zoom on a large display
    await usable(page);
    const save = page.getByRole('button', { name: /Salva modifiche/ });
    await save.scrollIntoViewIfNeeded();
    await settled(page);
    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeInViewport({ ratio: 1 });
    await page.goto('/#/orders/BOZ-26-00021/review');
    await page.getByLabel('Nota sul documento').fill('Verifica nota in finestra bassa');
    await page.getByLabel('Pagamento dell’ordine').selectOption('PAY-BON30');
    await usable(page);
    await page.getByRole('button', { name: /Conferma ordine/ }).click();
    const envelope = await page.evaluate(() => JSON.parse(localStorage.getItem('hfs-agent-demo-v1')!));
    const order = envelope.data.orders.find((o: { id: string }) => o.id === 'BOZ-26-00021');
    expect(order.status).toBe('PENDING_SEND');
    expect(order.note).toBe('Verifica nota in finestra bassa');
    expect(order.paymentId).toBe('PAY-BON30');
});
