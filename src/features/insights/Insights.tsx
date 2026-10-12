import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useApp } from '../../app/Store';
import { Badge, Empty, PageTitle, Search, ScrollArea } from '../../design-system/ui';
import { date, matches, money, newOrder } from '../../domain/model';
export function Insights() {
    const { state: { data: d } } = useApp();
    const [params, setParams] = useSearchParams();
    const [q, setQ] = useState('');
    const reviewed = params.get('tab') === 'reviewed';
    const insights = d.insights.filter(i => i.status === (reviewed ? 'REVIEWED' : 'TO_REVIEW'));
    const customers = d.customers.filter(c => insights.some(i => i.customerId === c.id) && matches(q, c.businessName, c.code));
    return <div className="view insights-view">
    <PageTitle title="Statistiche e segnalazioni" subtitle="Evolutiva · Analisi dimostrative del portafoglio clienti"/>
    <Search value={q} onChange={setQ} label="Cerca cliente per nome o codice"/>
    <nav className="tabs">
    <button aria-pressed={!reviewed} onClick={() => setParams({ tab: 'pending' })}>Da valutare</button>
    <button aria-pressed={reviewed} onClick={() => setParams({ tab: 'reviewed' })}>Valutate</button>
    </nav>
    <p className="result-count">{customers.length} clienti · {insights.filter(i => customers.some(c => c.id === i.customerId)).length} segnalazioni</p><ScrollArea label="Segnalazioni clienti">{customers.map(c => <article className="card" key={c.id}>
        <div className="row between">
        <h2>{c.businessName}</h2>
        <Badge tone="warning">{insights.filter(i => i.customerId === c.id).length} segnalazioni</Badge>
        </div>{insights.filter(i => i.customerId === c.id).map(i => <p key={i.id}>{i.summary}</p>)}<Link className="button" to={`/insights/${c.id}`}>Apri analisi →</Link>
        </article>)}{!customers.length && <Empty text="Nessuna segnalazione in questa vista."/>}</ScrollArea></div>;
}
export function Analysis() {
    const { customerId } = useParams();
    const { state: { data: d }, update, notify } = useApp();
    const nav = useNavigate();
    const a = d.analyses.find(a => a.customerId === customerId), c = d.customers.find(c => c.id === customerId);
    if (!a || !c)
        return <Empty text="Analisi non disponibile."/>;
    const previous = a.previousPeriod, current = a.currentPeriod;
    const reviewed = d.insights.filter(i => i.customerId === c.id).every(i => i.status === 'REVIEWED');
    function create() { const id = `BOZ-${crypto.randomUUID().slice(0, 8).toUpperCase()}`; update(data => { data.orders.push(newOrder(data, c!.id, id)); }); nav(`/orders/${id}/products`); }
    return <div className="view analysis-view">
    <PageTitle title={`Analisi acquisti · ${c.businessName}`} back="/insights" backLabel="Segnalazioni" subtitle="Evolutiva · Snapshot sintetico approvato"/>
    <section className="card row between">
    <div>{current && previous ? <>
        <p>Periodo {date(current.start)} – {date(current.end)}</p>
        <small>Confronto {date(previous.start)} – {date(previous.end)}</small>
        </> : <p>Ultimo ordine {date(a.lastOrderDate ?? null)} · Intervallo abituale {a.usualGapDays} giorni</p>}</div>
    <Link className="button" to={`/customers/${c.id}?tab=orders&from=${current?.start ?? '2026-08-01'}&to=${current?.end ?? '2026-09-21'}&returnTo=${encodeURIComponent(`/insights/${c.id}`)}`}>Mostra dati</Link>
    </section>
    <ScrollArea label="Analisi acquisti" kind="content"><section className="card">
    <h2>Il quadro del cliente</h2>
    <p>{a.headline}</p>{previous && current && <div className="grid three">{[['Ordini', previous.orderCount, current.orderCount], ['Spesa', money(previous.netCents), money(current.netCents)], ['Valore medio', money(previous.averageOrderCents), money(current.averageOrderCents)]].map(([label, prev, now]) => <div key={label}>
            <small>{label}</small>
            <p className="metric-number">{prev} → {now}</p>
            </div>)}</div>}</section>{a.categoryObservations && <div className="grid two">
        <section className="card">
        <h2>Dove si concentra il calo</h2>{a.categoryObservations.map(x => <div className="summary-line" key={x.label}>
            <h3>{x.label} <Badge tone="warning">{x.changePercent}%</Badge>
            </h3>
            <p>{money(x.previousNetCents)} → <b>{money(x.currentNetCents)}</b>
            </p>
            <div className="bar" style={{ width: `${Math.max(1, x.currentNetCents / x.previousNetCents * 100)}%` }} aria-label={`${x.label}: ${x.changePercent}%`}/>
            </div>)}</section>
        <section className="card">
        <h2>Come cambia l’assortimento</h2>{a.productObservations?.map(x => <div className="summary-line" key={x.productId}>
            <h3>{d.products.find(p => p.id === x.productId)?.name}</h3>
            <p>{x.previousOrders}/{previous?.orderCount} → {x.currentOrders}/{current?.orderCount} ordini</p>
            <p>{x.label}</p>
            </div>)}</section>
        </div>}<section className="card" id="actions">
    <h2>Ipotesi da verificare</h2>{a.hypotheses.map(h => <p key={h}>{h}</p>)}</section>
    <section className="card">
    <h2>Azioni consigliate</h2>
    <ol>{a.recommendedActions.map(h => <li key={h}>
        <p>{h}</p>
        </li>)}</ol>
    </section></ScrollArea><div className="card action-bar analysis-actions"><div className="actions">
    <Link className="button" to={`/customers/${c.id}?returnTo=${encodeURIComponent(`/insights/${c.id}`)}`}>Apri scheda cliente</Link>
    <button onClick={create}>Nuovo ordine</button>
    <button className="primary" disabled={reviewed} onClick={() => { update(data => { data.insights.filter(i => i.customerId === c.id).forEach(i => i.status = 'REVIEWED'); }); notify('Segnalazioni segnate come valutate.'); nav('/insights?tab=reviewed'); }}>{reviewed ? 'Già valutate' : 'Segna come valutate'}</button>
    </div>
    </div>
    </div>;
}
