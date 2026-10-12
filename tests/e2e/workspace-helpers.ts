import { expect, type Page } from '@playwright/test';

export async function settled(page: Page) {
    await expect(page.locator('.workspace-shell')).toHaveAttribute('data-layout', /fit|flow/);
    await page.waitForTimeout(280); // footer transition is 220 ms
}
export async function isFlowing(page: Page) {
    await settled(page);
    return page.locator('.workspace-shell').getAttribute('data-layout').then(mode => mode === 'flow');
}
export async function openFooter(page: Page) {
    await settled(page);
    const toggle = page.getByRole('button', { name: 'Apri stato e sincronizzazione', exact: true });
    if (await toggle.count()) await toggle.click();
    await expect(page.getByRole('button', { name: 'Stato sincronizzazione', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Stato sincronizzazione', exact: true }).focus();
    await page.getByRole('button', { name: 'Stato sincronizzazione', exact: true }).press('Shift');
    await settled(page);
}
export async function usable(page: Page) {
    await settled(page);
    const result = await page.evaluate(() => {
        const main = document.querySelector('main')!;
        const footer = document.querySelector('.app-footer')!;
        const flowing = document.querySelector('.workspace-shell')?.getAttribute('data-layout') === 'flow';
        const clipped = [...main.querySelectorAll('.view,.pane,.workspace-split,.cart,.home-view .grid,.hero-card,.navigation-card,.resolver-confirm,.action-bar')]
            .filter(el => getComputedStyle(el).overflowY !== 'auto' && (el.scrollHeight > el.clientHeight + 3 || el.scrollWidth > el.clientWidth + 3))
            .map(el => el.className);
        const regions = [...main.querySelectorAll('.scroll-area')].filter(el => el.scrollHeight > el.clientHeight + 3)
            .map(el => ({ label: el.getAttribute('aria-label'), height: el.clientHeight }));
        return { flowing, clipped, regions, width: document.documentElement.scrollWidth, viewportWidth: innerWidth,
            pageHeight: document.documentElement.scrollHeight, viewportHeight: innerHeight,
            footerBottom: footer.getBoundingClientRect().bottom, footerTop: footer.getBoundingClientRect().top,
            mainBottom: main.getBoundingClientRect().bottom, mainHeight: main.clientHeight, mainContent: main.scrollHeight };
    });
    expect(result.width).toBeLessThanOrEqual(result.viewportWidth + 1);
    expect(result.pageHeight).toBeLessThanOrEqual(result.viewportHeight + 1);
    expect(result.footerBottom).toBeLessThanOrEqual(result.viewportHeight + 1);
    expect(result.mainBottom).toBeLessThanOrEqual(result.footerTop + 1);
    expect(result.clipped).toEqual([]);
    for (const region of result.regions) expect(region.height, region.label ?? 'regione').toBeGreaterThanOrEqual(120);
    if (!result.flowing) expect(result.mainContent).toBeLessThanOrEqual(result.mainHeight + 2);
}
