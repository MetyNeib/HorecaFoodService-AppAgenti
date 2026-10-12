/** Visible rows, including their controls; content/forms are intentionally excluded. */
export function listItems(region: HTMLElement): HTMLElement[] {
    const cards = [...region.querySelectorAll<HTMLElement>(':scope > article, :scope > .summary-line')];
    if (cards.length) return cards;
    const rows = [...region.querySelectorAll<HTMLElement>(':scope > table > tbody > tr')];
    return rows.length ? rows : [...region.querySelectorAll<HTMLElement>(':scope > button')];
}

export function sizeListRegions(main: HTMLElement) {
    main.querySelectorAll<HTMLElement>('.scroll-area[data-kind="list"]').forEach(region => {
        const items = listItems(region);
        region.dataset.shortList = String(items.length <= 2);
        let minimum = 120;
        if (items.length) {
            const boxes = items.map(item => item.getBoundingClientRect());
            const prefix = Math.max(0, boxes[0].top - region.getBoundingClientRect().top + region.scrollTop);
            const pairs = boxes.map((box, i) => (boxes[i + 1] ?? box).bottom - box.top);
            minimum = Math.ceil(prefix + Math.max(...pairs) + 6);
        }
        const value = `${minimum}px`;
        if (region.style.getPropertyValue('--list-min-height') !== value) region.style.setProperty('--list-min-height', value);
    });
}
