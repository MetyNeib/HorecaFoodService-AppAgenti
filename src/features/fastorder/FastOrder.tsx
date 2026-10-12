import {useFilters} from '../../app/useFilters';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../../app/Store';
import { PageTitle, Search, Empty, Badge, Dialog, ScrollArea } from '../../design-system/ui';
import { date, matches, unresolved, type Request, type Order, makeLine, recalc, stock, money } from '../../domain/model';
import { normalizeSearch } from '../../domain/core';
import { Cart, Quantity, StockBadge, CustomerStrip, OrderReview } from '../order-editor/Editor';
export function Inbox() {
    const { state: { data: d } } = useApp();
    const [q, setQ] = useState(''), [delivery, setDelivery] = useState(''), [only, setOnly] = useState(false);
    const inbox = d.whatsappInbox.filter(i => d.orders.find(o => o.id === i.orderId)?.status === 'WHATSAPP_REVIEW');
    const found = inbox.filter(i => { const c = d.customers.find(c => c.id === i.customerId)!, sender = d.contacts.find(c => c.id === i.contactId)!; return matches(q, c.businessName, c.code, i.orderId, sender.firstName, sender.lastName, sender.phoneDisplay) && (!delivery || i.requestedDeliveryDate === delivery) && (!only || i.requests.some(unresolved)); });
    return <div className="view inbox-view">
    <PageTitle title="Ordini WhatsApp da verificare" subtitle={`${inbox.length} ordini in attesa della tua conferma`}/>
    <Search value={q} onChange={setQ} label="Cerca cliente, numero ordine o mittente"/>
    <div className="filters">
    <label className="field">
    <span>Consegna</span>
    <select value={delivery} onChange={e => setDelivery(e.target.value)}>
    <option value="">Tutte le date</option>{[...new Set(inbox.map(i => i.requestedDeliveryDate))].map(v => <option key={v} value={v}>{date(v)}</option>)}</select>
    </label>
    <label className="check">
    <input type="checkbox" checked={only} onChange={e => setOnly(e.target.checked)}/>Solo con richieste da risolvere</label>
    </div><ScrollArea label="Ordini WhatsApp">{found.map(i => {
            const c = d.customers.find(c => c.id === i.customerId)!, sender = d.contacts.find(c => c.id === i.contactId)!;
            return <article className="card list-row" key={i.id}>
            <div className="details">
            <h3>{c.businessName}</h3>
            <p>{c.code} · {i.orderId}</p>
            <small>Mittente: {sender.firstName} {sender.lastName} · {sender.phoneDisplay}</small>
            <small>Ricevuto {date(i.receivedAt)} {i.receivedAt.slice(11, 16)} · Consegna {date(i.requestedDeliveryDate)}</small>
            </div>
            <div>
            <p>{i.requests.length} richieste</p>
            <Badge tone={i.requests.some(unresolved) ? 'warning' : 'success'}>{i.requests.filter(unresolved).length} da risolvere</Badge>
            </div>
            <Link className="button primary" to={`/fastorder/${i.orderId}`}>{i.verificationSaved ? 'Riprendi verifica' : 'Verifica ordine'} →</Link>
            </article>;
        })}{!found.length && <Empty />}</ScrollArea></div>;
}
function Exceptions({ order: o, selected }: {
    order: Order;
    selected?: string;
}) {
    const { state: { data: d } } = useApp();
    const inbox = d.whatsappInbox.find(i => i.orderId === o.id)!;
    return <section className="card pane" id="requests" tabIndex={-1}>
    <h2>Da definire <Badge tone="warning">{inbox.requests.filter(unresolved).length}</Badge>
    </h2><ScrollArea label="Richieste WhatsApp">{inbox.requests.filter(r => unresolved(r) || r.id === selected).map(r => <article className="card" key={r.id}>
        <h3>{r.rawText}</h3>
        <p className="muted">{r.reason ?? 'Verifica la scelta e la quantità.'}</p>
        <Link className="button wide" to={`/fastorder/${o.id}/resolve/${r.id}`}>{r.status === 'NO_MATCH' ? 'Cerca prodotto' : 'Scegli prodotto'} →</Link>
        </article>)}{!inbox.requests.some(unresolved) && <p className="notice">Tutte le richieste sono state definite.</p>}<p>{inbox.requests.filter(r => !unresolved(r) && r.status !== 'EXCLUDED').length} richieste abbinate nella bozza</p>{inbox.requests.filter(r => r.status === 'EXCLUDED').map(r => <p key={r.id}>Esclusa: “{r.rawText}” · {r.resolution?.reason}</p>)}<details>
    <summary>Leggi il messaggio sintetico completo</summary>{inbox.messageParts.map(m => <pre key={m.id}>{m.text}</pre>)}</details>
    </ScrollArea></section>;
}
export function FastReview() {
    const { orderId, requestId } = useParams();
    const { state: { data: d } } = useApp();
    const o = d.orders.find(o => o.id === orderId);
    const inbox = d.whatsappInbox.find(i => i.orderId === orderId);
    if (!o || !inbox)
        return <Empty text="Verifica non trovata."/>;
    if (o.status !== 'WHATSAPP_REVIEW')
        return <OrderReview />;
    const req = inbox.requests.find(r => r.id === requestId);
    return <div className="view fastorder-view">
    <PageTitle title={`Verifica ${o.number}`} subtitle={`Consegna richiesta ${date(inbox.requestedDeliveryDate)} · ${inbox.requests.length} richieste`} back="/fastorder" backLabel="Ordini WhatsApp"/>
    <CustomerStrip order={o} detail={<>Mittente: {d.contacts.find(c => c.id === inbox.contactId)?.phoneDisplay} · Ricevuto {date(inbox.receivedAt)} alle {inbox.receivedAt.slice(11, 16)}</>}/>
    <div className="grid editor workspace-split">
    <Exceptions order={o} selected={requestId}/>{req ? <Resolver key={req.id} order={o} request={req}/> : <Cart order={o} blocked={inbox.requests.some(unresolved)}/>}</div>
    </div>;
}
function Resolver({ order: o, request: r }: {
    order: Order;
    request: Request;
}) {
    const { state: { data: d }, update, notify } = useApp();
    const nav = useNavigate(), loc = useLocation();
    const [filters,setFilters]=useFilters();const q=filters.get('q')??'';const setQ=(value:string)=>{const next=new URLSearchParams(filters);next.set('q',value);setFilters(next);};const [chosen, setChosen] = useState(''), [quantity, setQuantity] = useState(r.quantityRequested ?? 0), [unit, setUnit] = useState(r.unitRequested ?? ''), [error, setError] = useState(''), [exclude, setExclude] = useState(false), [reason, setReason] = useState('');
    const p = d.products.find(p => p.id === chosen);
    const candidates = q ? d.products.filter(p => matches(q, p.name, p.code)) : r.alternatives.map(a => d.products.find(p => p.id === a.productId)!).filter(Boolean);
    const usual = d.products.find(p => p.id === r.usualProductId);
    function choose(id: string) { setChosen(id); const prod = d.products.find(x => x.id === id)!; setUnit(r.unitRequested && prod.units.some(u => u.code === r.unitRequested) ? r.unitRequested : ''); setQuantity(r.quantityRequested ?? 0); setError(''); }
    function save() { if (!p || !unit) {
        setError('Seleziona un prodotto e conferma esplicitamente l’unità di misura.');
        return;
    } try {
        const line = makeLine(d, o, p, quantity, unit, `${r.id}-LINE`, r.id);
        const other = o.lines.filter(l => l.whatsappRequestId !== r.id && l.productId === p.id).reduce((s, l) => s + l.baseQuantity, 0);
        if (other + line.baseQuantity > stock(d, p.id, o.warehouseId))
            throw Error('Quantità superiore alla disponibilità nello stesso deposito.');
        update(data => { const ord = data.orders.find(x => x.id === o.id)!; ord.lines = ord.lines.filter(l => l.whatsappRequestId !== r.id); ord.lines.push(line); recalc(ord); const req = data.whatsappInbox.find(i => i.orderId === o.id)!.requests.find(x => x.id === r.id)!; req.status = 'RESOLVED'; req.productId = p.id; req.resolution = { productId: p.id, quantity, unit }; const phrase = normalizeSearch(r.rawText); data.learnedMappings = data.learnedMappings.filter(m => m.customerId !== o.customerId || m.phrase !== phrase); data.learnedMappings.push({ customerId: o.customerId, phrase, productId: p.id }); });
        notify('Associazione salvata nella demo.');
        nav(`/fastorder/${o.id}`);
    }
    catch (e) {
        setError((e as Error).message);
    } }
    return <section className="pane resolver">
    <div className="card pane resolver-options">
    <div className="row between">
    <h2>Scegli il prodotto</h2>
    <Link to={`/fastorder/${o.id}`}>← Torna alla bozza</Link>
    </div>
    <Search value={q} onChange={setQ} label="Cerca altro prodotto per nome o codice"/><ScrollArea label="Prodotti da associare"><p>Richiesta originale: <b>{r.rawText}</b>
    </p>{usual && <p className="notice warning">Abituale esaurito: {usual.name} · {usual.code}</p>}{candidates.map(prod => <article className="card" key={prod.id}>
        <h3>{prod.name}</h3>
        <small>Cod. {prod.code} · 1 CT = {prod.caseQuantityBase} {prod.baseUnit}</small>
        <p>
        <StockBadge product={prod} warehouseId={o.warehouseId}/>
        </p>{r.alternatives.find(a => a.productId === prod.id) && <small>Confidenza: {r.alternatives.find(a => a.productId === prod.id)?.confidencePercent}%</small>}<div className="actions">
        <button disabled={stock(d, prod.id, o.warehouseId) <= 0} onClick={() => choose(prod.id)}>{chosen === prod.id ? 'Selezionato' : 'Scegli'}</button>
        <Link className="button" to={`/catalog/${prod.id}?warehouse=${o.warehouseId}&returnTo=${encodeURIComponent(loc.pathname+'?'+filters.toString())}`}>Scheda</Link>
        </div>
        </article>)}{!candidates.length && <Empty text={q ? 'Nessun prodotto trovato.' : 'Cerca il prodotto da associare alla richiesta.'}/>}</ScrollArea><button className="quiet danger" onClick={() => setExclude(true)}>Escludi questa richiesta</button>
    </div>{p && <section className="card resolver-confirm">
        <h2>Conferma prodotto, quantità e UM</h2>
        <p>{p.name}</p>
        <Quantity product={p} quantity={quantity} unit={unit} onChange={(q, u) => { setQuantity(q); setUnit(u); }}/>{!r.unitRequested && <p className="notice warning">Il messaggio non specifica l’unità. Selezionala esplicitamente.</p>}<button className="primary" onClick={save}>Conferma associazione</button>
        </section>}{error && <p role="alert" className="error">{error}</p>}{exclude && <Dialog title="Escludi richiesta" onClose={() => setExclude(false)}>
        <p>Il testo originale sarà conservato.</p>
        <label className="field">
        <span>Motivo dell’esclusione</span>
        <textarea value={reason} onChange={e => setReason(e.target.value)}/>
        </label>
        <button className="primary" disabled={!reason.trim()} onClick={() => { update(data => { const req = data.whatsappInbox.find(i => i.orderId === o.id)!.requests.find(x => x.id === r.id)!; req.status = 'EXCLUDED'; req.resolution = { reason: reason.trim() }; const ord = data.orders.find(x => x.id === o.id)!; ord.lines = ord.lines.filter(l => l.whatsappRequestId !== r.id); recalc(ord); }); nav(`/fastorder/${o.id}`); }}>Conferma esclusione</button>
        </Dialog>}</section>;
}
