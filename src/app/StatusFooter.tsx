import { useRef } from 'react';
import { Badge } from '../design-system/ui';
import { useApp } from './Store';
import { useDockVisibility } from './useDockVisibility';

export function StatusFooter({ route, onDialog }: {
    route: string; onDialog: (dialog: string) => void;
}) {
    const { state, dispatch } = useApp();
    const footerRef = useRef<HTMLElement>(null);
    const { open, toggle, retain } = useDockVisibility(route, footerRef);
    const status = state.network === 'OFFLINE' ? 'Offline' : state.network === 'SYNCING' ? 'Sincronizzazione…' : 'Online';
    return <footer ref={footerRef} className="app-footer status-dock" data-open={open} aria-label="Stato e sincronizzazione">
        <div className="footer-panel dock-panel" id="footer-controls" inert={!open}>
            <div className="footer-panel-clip">
                <div className="footer-content" onPointerDownCapture={retain} onKeyDownCapture={retain}>
                    <div className="row">
                        <Badge tone={state.network === 'ONLINE' ? 'success' : 'warning'}>{status}</Badge>
                        <span><b>Ultimo aggiornamento {state.lastSyncAt.slice(11, 16)}</b>
                            <small>22 settembre 2026 · Dati sintetici · Invii simulati</small></span>
                    </div>
                    <div className="actions">
                        <button onClick={() => onDialog('sync')}>Stato sincronizzazione</button>
                        <button onClick={() => dispatch({ type: 'NETWORK', online: state.network === 'OFFLINE' })}>{state.network === 'OFFLINE' ? 'Passa online' : 'Passa offline'}</button>
                        <button className="quiet" onClick={() => onDialog('reset')}>Reset demo</button>
                    </div>
                </div>
            </div>
        </div>
        <button className="footer-toggle dock-toggle" aria-controls="footer-controls" aria-expanded={open}
            aria-label={open ? 'Comprimi stato e sincronizzazione' : 'Apri stato e sincronizzazione'}
            title={open ? 'Comprimi stato e sincronizzazione' : 'Apri stato e sincronizzazione'} onClick={toggle}>
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 15 6-6 6 6"/></svg>
        </button>
    </footer>;
}
