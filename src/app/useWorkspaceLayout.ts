import { useLayoutEffect, useState, type RefObject } from 'react';
import { sizeListRegions } from './listLayout';

/** Try usable proportions before allowing the central workspace to scroll.
 * Probe the actual rendered content, including errors, wrapping and zoom.
 * Footer probes reserve its normal height so opening it cannot oscillate density.
 */
export function useWorkspaceLayout(shellRef: RefObject<HTMLDivElement | null>, route: string) {
    const [layout, setLayout] = useState({ compact: false, flowing: false });
    useLayoutEffect(() => {
        const shell = shellRef.current;
        const main = shell?.querySelector<HTMLElement>('main');
        if (!shell || !main) return;
        let frame = 0;
        const animating = new Set<EventTarget>();
        const usable = () => {
            const view = main.querySelector<HTMLElement>('.view');
            if (!view || main.clientHeight < 180) return false;
            const blocks = main.querySelectorAll<HTMLElement>(
                '.view,.pane,.workspace-split,.cart,.home-view .grid,.hero-card,.navigation-card,.action-bar,.resolver-confirm,.customer-strip',
            );
            return [...blocks].every(el => {
                const style = getComputedStyle(el);
                return style.overflowY === 'auto' || (
                    el.scrollHeight <= el.clientHeight + 2 && el.scrollWidth <= el.clientWidth + 2
                );
            }) && [...main.querySelectorAll<HTMLElement>('.scroll-area')].every(el => el.clientHeight >= 120);
        };
        const assess = () => {
            if (animating.size) return;
            const positions = [main, ...main.querySelectorAll<HTMLElement>('.scroll-area')].map(el => [el, el.scrollTop] as const);
            const footer = shell.querySelector<HTMLElement>('.status-dock');
            const content = footer?.querySelector<HTMLElement>('.footer-content');
            const mainHeight = main.getBoundingClientRect().height;
            const footerHeight = footer?.getBoundingClientRect().height ?? 48;
            const expandedHeight = Math.max(48, (content?.offsetHeight ?? 60) + 5);
            const originalHeight = main.style.height;
            const originalFlex = main.style.flex;
            main.style.flex = 'none';
            const portraitPhone = matchMedia('(max-width:650px) and (max-aspect-ratio:93/200)').matches;
            const narrowPhone = innerWidth < 600;
            shell.dataset.layout = 'fit';
            shell.dataset.density = 'regular';
            sizeListRegions(main);
            main.style.height = `${Math.max(0, mainHeight + footerHeight - expandedHeight)}px`;
            const regular = !portraitPhone && !narrowPhone && usable();
            const compact = !regular && (!portraitPhone || innerHeight < 720);
            shell.dataset.density = compact ? 'compact' : 'regular';
            sizeListRegions(main);
            main.style.height = `${Math.max(0, mainHeight + footerHeight - (compact ? 49 : expandedHeight))}px`;
            let flowing = portraitPhone || narrowPhone || !usable();
            main.style.height = originalHeight;
            main.style.flex = originalFlex;
            // Expanded controls may need more room than the compact footer probe.
            if (!flowing && !usable()) flowing = true;
            shell.dataset.layout = flowing ? 'flow' : 'fit';
            sizeListRegions(main);
            if (!flowing && !usable()) {
                flowing = true;
                shell.dataset.layout = 'flow';
                sizeListRegions(main);
            }
            positions.forEach(([el, top]) => { el.scrollTop = top; });
            setLayout(previous => previous.compact === compact && previous.flowing === flowing
                ? previous : { compact, flowing });
        };
        const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(assess); };
        const panels = shell.querySelectorAll('.dock-panel');
        const animationStart = (event: Event) => { if (event.target === event.currentTarget && event.target) animating.add(event.target); };
        const animationEnd = (event: Event) => { if (event.target === event.currentTarget && event.target) { animating.delete(event.target); schedule(); } };
        panels.forEach(panel => {
            panel.addEventListener('transitionrun', animationStart);
            panel.addEventListener('transitionend', animationEnd);
            panel.addEventListener('transitioncancel', animationEnd);
        });
        assess();
        const resize = new ResizeObserver(schedule);
        resize.observe(shell);
        resize.observe(main);
        const changes = new MutationObserver(schedule);
        changes.observe(main, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class', 'open', 'hidden'] });
        window.addEventListener('resize', schedule);
        window.visualViewport?.addEventListener('resize', schedule);
        document.fonts?.addEventListener('loadingdone', schedule);
        return () => {
            cancelAnimationFrame(frame);
            resize.disconnect();
            changes.disconnect();
            panels.forEach(panel => {
                panel.removeEventListener('transitionrun', animationStart);
                panel.removeEventListener('transitionend', animationEnd);
                panel.removeEventListener('transitioncancel', animationEnd);
            });
            window.removeEventListener('resize', schedule);
            window.visualViewport?.removeEventListener('resize', schedule);
            document.fonts?.removeEventListener('loadingdone', schedule);
        };
    }, [shellRef, route]);
    return layout;
}
