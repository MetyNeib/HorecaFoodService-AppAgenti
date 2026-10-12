import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useDockVisibility } from './useDockVisibility';

export function AppHeader({ view }: { view: string }) {
    const ref = useRef<HTMLElement>(null);
    const { open, toggle, retain } = useDockVisibility(view, ref);
    return <header ref={ref} className="app-header header-dock" data-open={open} aria-label="Intestazione e agente">
        <div className="dock-panel header-panel" id="header-controls" inert={!open}>
            <div className="dock-panel-clip">
                <div className="header-content" onPointerDownCapture={retain} onKeyDownCapture={retain}>
                    <Link to="/" className="wordmark">
                        <b>HFS<span>•</span></b>
                        <span>Horeca Food Service<small>App Agenti</small></span>
                    </Link>
                    <div className="agent">
                        <span className="avatar">MR</span>
                        <span><b>Marco Rossi</b><small>Agente 014 · Marche / Emilia-Romagna</small></span>
                    </div>
                </div>
            </div>
        </div>
        <button className="dock-toggle header-toggle" aria-controls="header-controls" aria-expanded={open}
            aria-label={open ? 'Comprimi intestazione e agente' : 'Apri intestazione e agente'}
            title={open ? 'Comprimi intestazione e agente' : 'Apri intestazione e agente'} onClick={toggle}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/><circle cx="12" cy="8" r="3"/><path d="M5 19a7 7 0 0 1 14 0"/>
            </svg>
        </button>
    </header>;
}
