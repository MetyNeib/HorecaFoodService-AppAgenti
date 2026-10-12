import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { money, percent } from '../domain/model';
export function Icon({ name = 'box' }: {
    name?: string;
}) {
    const paths: Record<string, ReactNode> = { order: <>
        <path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h5"/>
        <path d="M3 7H1v16h14"/>
        </>, 'new-order': <>
        <path d="M13 21H6a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v6M7 7h6M7 11h5M7 15h2"/>
        <circle cx="17" cy="17" r="5"/>
        <path d="M17 14.5v5M14.5 17h5"/>
        </>, chat: <>
        <path d="M21 11.5a9 9 0 0 1-13.2 8L3 22l1.5-5.1A9 9 0 1 1 21 11.5Z"/>
        <circle cx="7.5" cy="11.5" r=".65" fill="currentColor" stroke="none"/>
        <circle cx="12" cy="11.5" r=".65" fill="currentColor" stroke="none"/>
        <circle cx="16.5" cy="11.5" r=".65" fill="currentColor" stroke="none"/>
        </>, users: <>
        <rect x="3" y="3" width="18" height="19" rx="3"/>
        <circle cx="12" cy="10" r="3"/>
        <path d="M7 19v-2a5 5 0 0 1 10 0v2M7 1v4M17 1v4"/>
        </>, chart: <>
        <path d="M3 21V11h4v10M10 21V3h4v18M17 21V7h4v14"/>
        </>, box: <>
        <path d="m12 2 10 5v11l-10 5L2 18V7zm0 10v11M2 7l10 5 10-5M7 4.5l10 5V15"/>
        </> };
    return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.box}</svg>;
}
export function PageTitle({ title, subtitle, back = '/', backLabel = 'Home' }: {
    title: string;
    subtitle?: string;
    back?: string;
    backLabel?: string;
}) {
    return <header className="view-heading">
    <Link className="back" to={back}>← {backLabel}</Link>
    <div className="page-title">
    <h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
    </header>;
}
export function ScrollArea({ children, label, className = '', kind = 'list' }: { children: ReactNode; label: string; className?: string; kind?: 'list' | 'content' }) {
    return <div className={`scroll-area ${className}`} data-kind={kind} role="region" aria-label={label} tabIndex={0}>{children}</div>;
}
export function Search({ value, onChange, label = 'Cerca per nome o codice' }: {
    value: string;
    onChange: (s: string) => void;
    label?: string;
}) {
    return <label className="field search">
    <span>{label}</span>
    <input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={label}/>
    </label>;
}
export function Empty({ text = 'Nessun risultato. Modifica i filtri per continuare.' }: {
    text?: string;
}) { return <div className="empty">{text}</div>; }
export function Badge({ children, tone = '' }: {
    children: ReactNode;
    tone?: string;
}) { return <span className={`badge ${tone}`}>{children}</span>; }
export function Totals({ totals, label = 'ordine' }: {
    label?: string;
    totals: {
        netCents: number;
        marginCents: number;
        marginPercent: number | null;
    };
}) {
    return <div className="totals">
    <div>
    <small>Totale imponibile · IVA esclusa</small>
    <strong>{money(totals.netCents)}</strong>
    </div>
    <div>
    <small>Margine {label}</small>
    <b>{money(totals.marginCents)} · {percent(totals.marginPercent)}</b>{totals.marginCents < 0 && <p className="error">Attenzione: margine negativo</p>}</div>
    </div>;
}
export function Stepper({ step }: {
    step: number;
}) {
    return <ol className="stepper" aria-label="Avanzamento ordine">{['Cliente', 'Prodotti', 'Riepilogo'].map((s, i) => <li key={s} aria-current={i + 1 === step ? 'step' : undefined}>
        <b>{i + 1 < step ? '✓' : i + 1}</b>{s}</li>)}</ol>;
}
export function Dialog({ title, children, onClose }: {
    title: string;
    children: ReactNode;
    onClose: () => void;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const opener = useRef(document.activeElement as HTMLElement);
    useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => { dialog?.close(); queueMicrotask(() => opener.current?.focus()); }; }, []);
    return <dialog ref={ref} onCancel={e => { e.preventDefault(); onClose(); }} aria-label={title}>
    <div className="row">
    <h2>{title}</h2>
    <button onClick={onClose} aria-label="Chiudi finestra">×</button>
    </div>{children}<div className="actions">
    <button onClick={onClose}>Chiudi</button>
    </div>
    </dialog>;
}
