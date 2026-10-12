import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useApp } from '../../app/Store';
import { Badge, Dialog, Empty, PageTitle, Search, ScrollArea } from '../../design-system/ui';
import { type Order, date, matches, money, today } from '../../domain/model';
import { orderPath } from '../order-editor/Editor';
export const statusLabel: Record<string, string> = { DRAFT: 'Bozza', PENDING_SEND: 'Da inviare', SENT: 'Inviato', WHATSAPP_REVIEW: 'Verifica WhatsApp' };
export function OrderRows({ orders }: {
    orders: Order[];
}) {
    const { state: { data: d }, update } = useApp();
    const [remove, setRemove] = useState<Order | null>(null);
    const loc = useLocation();
    return <>{orders.map(o => <article className="card list-row" key={o.id}>
        <div className="details">
        <h3>{d.customers.find(c => c.id === o.customerId)?.businessName}</h3>
        <p>{o.number} · {date(o.sentAt ?? o.updatedAt)}</p>
        <p>{o.channel === 'WHATSAPP' ? 'WhatsApp' : 'Agente'} · {o.lines.length} prodotti · <b>{money(o.totals.netCents)}</b>
        </p>
        <small>Consegna {date(o.deliveryDate)} · <Badge tone={o.status === 'SENT' ? 'success' : o.status === 'PENDING_SEND' ? 'warning' : ''}>{statusLabel[o.status]}</Badge>
        </small>
        </div>
        <div className="actions">
        <Link className="button" to={`${orderPath(o)}?returnTo=${encodeURIComponent(loc.pathname + loc.search)}`}>{o.status === 'DRAFT' || o.status === 'WHATSAPP_REVIEW' ? 'Riprendi' : 'Apri ordine'} →</Link>{o.status === 'DRAFT' && <button className="quiet danger" onClick={() => setRemove(o)}>Elimina bozza</button>}</div>
        </article>)}{!orders.length && <Empty />}{remove && <Dialog title="Eliminare la bozza?" onClose={() => setRemove(null)}>
        <p>{remove.number} sarà eliminata dalle liste e dalla scheda cliente.</p>
        <button className="primary" onClick={() => { update(d => { d.orders = d.orders.filter(o => o.id !== remove.id || o.status !== 'DRAFT'); }); setRemove(null); }}>Elimina definitivamente</button>
        </Dialog>}</>;
}
export function OrderFilters({ customerId }: {
    customerId?: string;
}) {
    const { state: { data: d } } = useApp();
    const [params, setParams] = useSearchParams();
    const tab = params.get('tab') ?? 'drafts';
    const [q, setQ] = useState(''), [status, setStatus] = useState(''), [period, setPeriod] = useState('all'), [from, setFrom] = useState(params.get('from') ?? ''), [to, setTo] = useState(params.get('to') ?? ''), [range, setRange] = useState({ from: params.get('from') ?? '', to: params.get('to') ?? '' }), [error, setError] = useState('');
    const expected = customerId ? status : ({ drafts: 'DRAFT', pending: 'PENDING_SEND', sent: 'SENT' }[tab] ?? 'DRAFT');
    const all = d.orders.filter(o => o.agentId === d.demoDefaults.currentAgentId && (!customerId || o.customerId === customerId) && (!expected || o.status === expected));
    const found = all.filter(o => { const day = (customerId ? o.createdAt : o.sentAt ?? o.updatedAt).slice(0, 10); return matches(q, o.number, d.customers.find(c => c.id === o.customerId)!.businessName) && (!range.from || day >= range.from) && (!range.to || day <= range.to); }).sort((a, b) => (b.sentAt ?? b.updatedAt).localeCompare(a.sentAt ?? a.updatedAt));
    function relative(value: string) { setPeriod(value); let start = ''; if (value === 'today')
        start = today; if (value === 'week') {
        const dt = new Date(today + 'T12:00:00Z');
        dt.setUTCDate(dt.getUTCDate() - 6);
        start = dt.toISOString().slice(0, 10);
    } if (value === 'month')
        start = today.slice(0, 7) + '-01'; if (value !== 'custom') {
        setFrom(start);
        setTo(value === 'all' ? '' : today);
        setRange({ from: start, to: value === 'all' ? '' : today });
    } }
    return <div className="pane orders-pane">{!customerId && <nav className="tabs" aria-label="Stato ordini">{[['drafts', 'Bozze', 'DRAFT'], ['pending', 'Da inviare', 'PENDING_SEND'], ['sent', 'Inviati', 'SENT']].map(([id, label, status]) => <Link className="button" key={id} aria-current={tab === id ? 'page' : undefined} to={`/orders?tab=${id}`} onClick={() => { setRange({ from: '', to: '' }); setPeriod('all'); setFrom(''); setTo(''); }}>{label} <Badge>{d.orders.filter(o => o.status === status && o.agentId === d.demoDefaults.currentAgentId).length}</Badge>
            </Link>)}</nav>}<div className="filters">
    <Search value={q} onChange={setQ} label={customerId ? 'Cerca numero ordine' : 'Cerca cliente o numero ordine'}/>{customerId && <label className="field">
        <span>Stato</span>
        <select value={status} onChange={e => setStatus(e.target.value)}>
        <option value="">Tutti</option>{Object.entries(statusLabel).map(([id, s]) => <option value={id} key={id}>{s}</option>)}</select>
        </label>}</div>{(customerId || tab === 'sent') && <section className="card date-filters">
        <div className="tabs" aria-label="Periodo">{[['today', 'Oggi'], ['week', 'Ultimi 7 giorni'], ['month', 'Questo mese'], ['custom', 'Personalizzato'], ['all', 'Tutti']].map(([id, label]) => <button key={id} aria-pressed={period === id} onClick={() => relative(id)}>{label}</button>)}</div>
        <div className="filters">
        <label className="field">
        <span>Dal</span>
        <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPeriod('custom'); }}/>
        </label>
        <label className="field">
        <span>Al</span>
        <input type="date" value={to} onChange={e => { setTo(e.target.value); setPeriod('custom'); }}/>
        </label>
        <button className="primary" onClick={() => { if (from && to && from > to) {
            setError('Intervallo non valido.');
            return;
        } setError(''); setRange({ from, to }); }}>Applica</button>
        <button onClick={() => { relative('all'); setQ(''); setStatus(''); setError(''); }}>Azzera filtri</button>
        </div>{error && <p role="alert" className="error">{error}</p>}</section>}<p>{found.length} risultati su {all.length} ordini · Più recenti prima</p>
    <ScrollArea label="Lista ordini"><OrderRows orders={found}/></ScrollArea>{tab === 'pending' && !customerId && <div className="notice warning">
        <b>Invio automatico al ritorno della connessione</b>
        <p>Gli ordini sono confermati e in sola lettura. La trasmissione è simulata.</p>
        </div>}</div>;
}
export function OrdersList() {
    return <div className="view orders-view">
    <PageTitle title="I miei ordini"/>
    <OrderFilters />
    </div>;
}
