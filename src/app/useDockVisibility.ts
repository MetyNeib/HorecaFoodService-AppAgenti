import { useEffect, useRef, useState, type RefObject } from 'react';

/** One-second introduction; explicit interaction keeps controls open until scroll. */
export function useDockVisibility(view: string, dockRef: RefObject<HTMLElement | null>) {
    const [open, setOpen] = useState(true);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const retain = () => { clearTimeout(timer.current); timer.current = undefined; };
    const toggle = () => { retain(); setOpen(value => !value); };

    useEffect(() => {
        setOpen(true);
        timer.current = setTimeout(() => setOpen(false), 1000);
        const main = document.getElementById('main');
        const positions = new WeakMap<Element, number>();
        let ready = false;
        const frame = requestAnimationFrame(() => {
            if (main) [main, ...main.querySelectorAll('.scroll-area')].forEach(el => positions.set(el, el.scrollTop));
            ready = true;
        });
        const collapse = (event: Event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            const top = target.scrollTop;
            const previous = positions.get(target) ?? 0;
            positions.set(target, top);
            const animating = [...document.querySelectorAll('.dock-panel')]
                .some(panel => panel.getAnimations().some(animation => animation.playState === 'running'));
            if (ready && Math.abs(top - previous) > 1 && !animating) {
                clearTimeout(timer.current);
                setOpen(false);
            }
        };
        main?.addEventListener('scroll', collapse, { passive: true, capture: true });
        return () => {
            clearTimeout(timer.current);
            cancelAnimationFrame(frame);
            main?.removeEventListener('scroll', collapse, true);
        };
    }, [view]);

    useEffect(() => {
        const dock = dockRef.current;
        if (!open && dock?.contains(document.activeElement)) dock.querySelector<HTMLButtonElement>('.dock-toggle')?.focus();
    }, [open, dockRef]);
    return { open, toggle, retain };
}
