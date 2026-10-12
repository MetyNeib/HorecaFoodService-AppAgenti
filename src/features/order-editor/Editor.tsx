import { useState, type ReactNode } from 'react';
import { useFilters } from '../../app/useFilters';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useApp } from '../../app/Store';
import { Badge, Empty, PageTitle, Search, Stepper, Totals, Dialog, ScrollArea, Icon } from '../../design-system/ui';
import { type Product, type Order, type Line, calculateLine, makeLine, recalc, matches, money, percent, stock, editable, parseCents, orderErrors, nextDelivery, today } from '../../domain/model';
import { listPrice, halfUp } from '../../domain/core';
export const orderPath = (o: Order) => o.status === 'WHATSAPP_REVIEW' ? `/fastorder/${o.id}` : editable(o) ? `/orders/${o.id}/products` : `/orders/${o.id}/review`;
export function CustomerStrip({ order, change = false, detail }: {
    order: Order;
    change?: boolean;
    detail?: ReactNode;
}) {
    const { state: { data: d } } = useApp();
    const c = d.customers.find(c => c.id === order.customerId)!;
    return <div className="customer-strip">
    <span><b>{c.businessName}</b> · {c.code} · {c.city}</span><Link to={`/customers/${c.id}?returnTo=${encodeURIComponent(orderPath(order))}`}>Scheda cliente</Link>
    {change && <Link className="change-customer" to={`/orders/new/customer?change=${order.id}`}>Cambia cliente</Link>}
    {detail && <span className="strip-detail">{detail}</span>}
    </div>;
}
export function Quantity({ product, quantity, unit, onChange }: {
    product: Product;
    quantity: number;
    unit: string;
    onChange: (q: number, u: string) => void;
}) {
    const step = product.units.find(u => u.code === unit)?.step ?? 1;
    return <div className="quantity-fields">
    <label className="field">
    <span>Qtà</span>
    <div className="step-controls">
    <button type="button" aria-label="Diminuisci quantità" disabled={quantity <= step} onClick={() => onChange(Math.round((quantity - step) * 1000) / 1000, unit)}>−</button>
    <input aria-label="Quantità" type="number" min={step} step={step} value={quantity || ''} onChange={e => onChange(Number(e.target.value), unit)}/>
    <button type="button" aria-label="Aumenta quantità" onClick={() => onChange(Math.round((quantity + step) * 1000) / 1000, unit)}>+</button>
    </div>
    </label>
    <label className="field">
    <span>UM</span>
    <select aria-label="Unità di misura" value={unit} onChange={e => onChange(quantity, e.target.value)}>{!unit && <option value="">Conferma UM…</option>}{product.units.map(u => <option key={u.code} value={u.code}>{u.code === 'CT' ? 'CT · Colli' : u.code}</option>)}</select>
    </label>
    </div>;
}
export function StockBadge({ product, warehouseId }: {
    product: Product;
    warehouseId: string;
}) { const { state: { data: d } } = useApp(); const s = d.stocks.find(s => s.productId === product.id && s.warehouseId === warehouseId); const q = s?.availableBaseQuantity ?? 0; return <Badge tone={q === 0 ? 'error' : q <= (s?.lowStockThreshold ?? 0) ? 'warning' : 'success'}>{q === 0 ? 'Esaurito' : q <= (s?.lowStockThreshold ?? 0) ? 'In esaurimento' : 'Disponibile'} · {q} {product.baseUnit}</Badge>; }
export function ProductCard({ product: p, order: o, returnTo }: {
    product: Product;
    order: Order;
    returnTo?: string;
}) {
    const { state: { data: d }, update, notify } = useApp();
    const [q, setQ] = useState(1), [u, setU] = useState(p.baseUnit), [error, setError] = useState('');
    const loc = useLocation();
    const price = makeLine(d, o, p, 1, p.baseUnit, 'preview').unitPriceBaseCents;
    function add() { try {
        const line = makeLine(d, o, p, q, u, crypto.randomUUID());
        update(data => { const ord = data.orders.find(x => x.id === o.id)!; if (!editable(ord))
            return; const existing = ord.lines.find(l => l.productId === p.id && l.unit === u && l.unitPriceBaseCents === line.unitPriceBaseCents && !l.isGift && !l.whatsappRequestId && !l.note); if (existing) {
            Object.assign(existing, calculateLine(p, { ...existing, quantity: existing.quantity + q }));
        }
        else
            ord.lines.push(line); recalc(ord); });
        setError('');
        notify(`${p.name}: aggiunto al carrello`);
    }
    catch (e) {
        setError((e as Error).message);
    } }
    return <article className="card product-card" data-testid={`product-${p.code}`}>
    <div className="product-heading"><h3>{p.name}</h3>
    <Link className="product-detail-link" to={`/catalog/${p.id}?warehouse=${o.warehouseId}&returnTo=${encodeURIComponent(returnTo ?? loc.pathname + loc.search)}`}>Scheda prodotto</Link></div>
    <p className="meta">Cod. {p.code} · 1 CT = {p.caseQuantityBase} {p.baseUnit}</p>
    <div className="row">
    <b>{money(price)} / {p.baseUnit}</b>
    <StockBadge product={p} warehouseId={o.warehouseId}/>
    </div>
    <div className="product-controls"><Quantity product={p} quantity={q} unit={u} onChange={(q, u) => { setQ(q); setU(u); }}/>
    <button className="primary" onClick={add}>+ Aggiungi</button>
    </div>{error && <p role="alert" className="error">{error}</p>}
    </article>;
}
function CartLine({ order: o, line: l }: {
    order: Order;
    line: Line;
}) {
    const { state: { data: d }, update } = useApp();
    const [error, setError] = useState('');
    const p = d.products.find(p => p.id === l.productId)!;
    const request = d.whatsappInbox.find(i => i.orderId === o.id)?.requests.find(r => r.id === l.whatsappRequestId);
    return <article className="card cart-line" data-testid={`line-${p.code}`}>
    <h3>{p.name}</h3>
    <small>Cod. {p.code}</small>{request && <p className="muted">Richiesta: “{request.rawText}” · Confidenza: {request.confidencePercent == null ? '—' : `${request.confidencePercent}%`}</p>}<Quantity product={p} quantity={l.quantity} unit={l.unit} onChange={(q, u) => { try {
        const line = calculateLine(p, { ...l, quantity: q, unit: u });
        update(data => { const ord = data.orders.find(x => x.id === o.id)!; ord.lines = ord.lines.map(x => x.id === l.id ? line : x); recalc(ord); });
        setError('');
    }
    catch (e) {
        setError((e as Error).message);
    } }}/>
    <p>{l.baseQuantity} {p.baseUnit} × {money(l.unitPriceBaseCents)} = <b>{money(l.lineNetCents)}</b>{l.conversionIsEstimated && ' · peso indicativo'}</p>
    <small>Costo {money(l.lineCostCents)} · Margine {money(l.marginCents)} / {percent(l.marginPercent)}</small>{l.marginCents < 0 && <p className="error">Attenzione: margine negativo</p>}{error && <p role="alert" className="error">{error}</p>}<div className="actions">
    <Link className="button" to={`/orders/${o.id}/lines/${l.id}/edit`}>Modifica</Link>{!request && <button className="quiet danger" onClick={() => update(data => { const ord = data.orders.find(x => x.id === o.id)!; ord.lines = ord.lines.filter(x => x.id !== l.id); recalc(ord); })}>Rimuovi</button>}{request && <Link className="button" to={`/fastorder/${o.id}/resolve/${request.id}`}>Rivedi richiesta</Link>}</div>
    </article>;
}
export function Cart({ order: o, blocked = false }: {
    order: Order;
    blocked?: boolean;
}) {
    const { notify, update } = useApp();
    const nav = useNavigate();
    return <section className="cart" id="cart">
    <div className="pane-heading"><h2><Icon name="order"/> Il tuo ordine <Badge>{o.lines.length} articoli</Badge></h2>
    <button className="quiet pane-jump" onClick={() => document.getElementById(o.status === 'WHATSAPP_REVIEW' ? 'requests' : 'product-search')?.focus()}>↑ {o.status === 'WHATSAPP_REVIEW' ? 'Torna alle richieste' : 'Torna ai prodotti'}</button></div>
    <ScrollArea label="Articoli nel carrello" className="cart-lines">{o.lines.map(l => <CartLine key={l.id} order={o} line={l}/>)}{!o.lines.length && <Empty text="Il carrello è vuoto. Scegli i prodotti a sinistra."/>}</ScrollArea><div className="card cart-summary">
    <Totals totals={o.totals}/>
    <div className="actions">
    <button className="primary" disabled={blocked || !o.lines.length} onClick={() => nav(`/orders/${o.id}/review`)}>Vai al riepilogo →</button>
    <button onClick={() => { if (o.status === 'WHATSAPP_REVIEW')
        update(d => { d.whatsappInbox.find(i => i.orderId === o.id)!.verificationSaved = true; }); notify(o.status === 'WHATSAPP_REVIEW' ? 'Verifica salvata. Puoi riprenderla dalla inbox.' : 'Bozza salvata.'); nav(o.status === 'WHATSAPP_REVIEW' ? '/fastorder' : '/orders?tab=drafts'); }}>{o.status === 'WHATSAPP_REVIEW' ? 'Salva verifica' : 'Salva bozza'}</button>
    </div>{blocked && <p className="error">Completa le richieste da definire prima del riepilogo.</p>}</div>
    </section>;
}
export function ProductPicker() {
    const { orderId } = useParams();
    const { state: { data: d } } = useApp();
    const [params, setParams] = useFilters();
    const q = params.get('q') ?? '', cat = params.get('category') ?? '', past = params.get('past') === '1';
    const o = d.orders.find(o => o.id === orderId);
    const nav = useNavigate();
    const [exit, setExit] = useState(false);
    if (!o)
        return <Empty text="Ordine non trovato."/>;
    if (!editable(o))
        return <OrderReview />;
    const history = new Set(d.orders.filter(x => x.customerId === o.customerId && x.status === 'SENT').flatMap(x => x.lines.map(l => l.productId)));
    const products = d.products.filter(p => matches(q, p.name, p.code) && (!cat || p.categoryId === cat) && (!past || history.has(p.id)));
    function filter(k: string, v: string) { const next = new URLSearchParams(params); next.set(k, v); setParams(next); }
    return <div className="view picker-view">
    <div className="order-toolbar">
    <button className="quiet" onClick={() => o.lines.length ? setExit(true) : nav('/')}>← Home</button>
    <Stepper step={2}/>
    </div>
    <CustomerStrip order={o} change/>
    <div className="grid editor workspace-split">
    <section id="product-search" className="pane" tabIndex={-1}>
    <div className="pane-heading"><h1>Cerca e aggiungi prodotti</h1>
    <button className="quiet pane-jump" onClick={() => document.getElementById('cart')?.querySelector<HTMLElement>('.scroll-area')?.focus()}>Vai al carrello ↓</button></div>
    <Search value={q} onChange={s => filter('q', s)}/>
    <div className="filters">
    <label className="field">
    <span>Categoria</span>
    <select value={cat} onChange={e => filter('category', e.target.value)}>
    <option value="">Tutte</option>{d.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
    </label>
    <label className="check">
    <input type="checkbox" checked={past} onChange={e => filter('past', e.target.checked ? '1' : '')}/>Già acquistati</label>
    </div>
    <p className="result-count">{products.length} prodotti · {d.warehouses.find(w => w.id === o.warehouseId)?.name}</p><ScrollArea label="Lista prodotti">{products.map(p => <ProductCard key={p.id} product={p} order={o} returnTo={`/orders/${o.id}/products?${params.toString()}`}/>)}{!products.length && <Empty />}</ScrollArea></section>
    <Cart order={o}/>
    </div>{exit && <Dialog title="Conservare la bozza?" onClose={() => setExit(false)}>
        <p>Gli articoli selezionati sono conservati nello stesso ordine.</p>
        <div className="actions">
        <button className="primary" onClick={() => nav('/')}>Conserva bozza ed esci</button>
        <button onClick={() => setExit(false)}>Continua modifica</button>
        </div>
        </Dialog>}</div>;
}
export function LineEditor() { const { orderId, lineId } = useParams(); const { state: { data: d }, update, notify } = useApp(); const o = d.orders.find(o => o.id === orderId); const l = o?.lines.find(l => l.id === lineId); if (!o || !l)
    return <Empty text="Articolo non trovato."/>; if (!editable(o))
    return <OrderReview />; return <LineForm key={lineId} order={o} line={l}/>; }
function LineForm({ order: o, line: l }: {
    order: Order;
    line: Line;
}) {
    const { state: { data: d }, update, notify } = useApp();
    const nav = useNavigate();
    const p = d.products.find(p => p.id === l.productId)!;
    const [form, setForm] = useState({ ...l }), [mode, setMode] = useState('FIXED_PRICE'), [price, setPrice] = useState((l.unitPriceBaseCents / 100).toFixed(2).replace('.', ',')), [discount, setDiscount] = useState('0'), [list, setList] = useState(o.priceListId), [save, setSave] = useState(false), [from, setFrom] = useState(''), [to, setTo] = useState(''), [error, setError] = useState('');
    let preview: Line | undefined, calculationError = '';
    try {
        const reference = listPrice(d, p, list);
        const bp = parseCents(discount);
        if (bp > 10000)
            throw Error('Lo sconto deve essere tra 0 e 100%.');
        const priceCents = mode === 'FIXED_PRICE' ? parseCents(price) : mode === 'DISCOUNT' ? halfUp(BigInt(reference) * BigInt(10000 - bp), 10000n) : reference;
        preview = calculateLine(p, { ...form, unitPriceBaseCents: priceCents, priceMode: mode, priceReferenceId: list });
    }
    catch (e) {
        calculationError = (e as Error).message;
    }
    function submit() { if (!preview)
        return; if (save && from && to && from > to) {
        setError('La data finale deve essere successiva o uguale alla data iniziale.');
        return;
    } const overlaps = d.customerConditions.filter(c => c.customerId === o.customerId && c.productId === p.id && (!c.validTo || !from || c.validTo >= from) && (!to || !c.validFrom || c.validFrom <= to)); if (save && overlaps.length && !window.confirm('Sostituire le condizioni sovrapposte per questo cliente e prodotto?'))
        return; const line = preview; update(data => { const ord = data.orders.find(x => x.id === o.id)!; ord.lines = ord.lines.map(x => x.id === l.id ? line : x); recalc(ord); if (save) {
        data.customerConditions = data.customerConditions.filter(c => !overlaps.some(x => x.id === c.id));
        data.customerConditions.push({ id: crypto.randomUUID(), customerId: o.customerId, productId: p.id, type: mode, unitPriceBaseCents: mode === 'FIXED_PRICE' ? line.unitPriceBaseCents : null, priceListId: mode === 'FIXED_PRICE' ? null : list, discountBasisPoints: mode === 'DISCOUNT' ? parseCents(discount) : null, validFrom: from || null, validTo: to || null, savedByAgentId: data.demoDefaults.currentAgentId });
    } }); notify(save ? 'Articolo e condizione cliente salvati.' : 'Articolo aggiornato.'); nav(orderPath(o)); }
    return <div className="view line-editor-view">
    <PageTitle title={`Modifica articolo · ${p.name}`} back={orderPath(o)} backLabel={o.channel === 'WHATSAPP' ? 'Verifica WhatsApp' : 'Prodotti'}/>
    <CustomerStrip order={o} detail={<>Cod. {p.code} · 1 CT = {p.caseQuantityBase} {p.baseUnit} <StockBadge product={p} warehouseId={o.warehouseId}/></>}/>
    <div className="grid two workspace-split form-split">
    <ScrollArea label="Quantità e prezzo" className="card price-form" kind="content">
    <h2>Quantità e prezzo</h2>
    <Quantity product={p} quantity={form.quantity} unit={form.unit} onChange={(q, u) => setForm({ ...form, quantity: q, unit: u })}/>
    <label className="field">
    <span>Listino di riferimento<small>Prezzo: {money(listPrice(d, p, list))} / {p.baseUnit}</small></span>
    <select value={list} onChange={e => setList(e.target.value)}>{d.priceLists.map(x => <option value={x.id} key={x.id}>{x.name}</option>)}</select>
    </label>
    <div className="tabs">{[['PRICE_LIST', 'Listino'], ['FIXED_PRICE', 'Prezzo libero'], ['DISCOUNT', 'Sconto %']].map(([id, label]) => <button key={id} aria-pressed={mode === id} onClick={() => setMode(id)}>{label}</button>)}</div>
    <div className="grid two price-inputs"><label className="field">
    <span>Prezzo finale € / {p.baseUnit}</span>
    <input value={mode === 'FIXED_PRICE' ? price : preview ? (preview.unitPriceBaseCents / 100).toFixed(2).replace('.', ',') : ''} disabled={mode !== 'FIXED_PRICE'} onChange={e => setPrice(e.target.value)} inputMode="decimal"/>
    </label>
    <label className="field">
    <span>Sconto sul listino %</span>
    <input value={discount} disabled={mode !== 'DISCOUNT'} onChange={e => setDiscount(e.target.value)} inputMode="decimal"/>
    </label></div>
    <div className="grid two line-extras"><label className="check">
    <input type="checkbox" checked={form.isGift} onChange={e => setForm({ ...form, isGift: e.target.checked })}/>Riga in omaggio</label>
    <label className="field">
    <span>Commento di riga</span>
    <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}/>
    </label></div>
    </ScrollArea>
    <ScrollArea label="Margine e condizioni" className="conditions-pane" kind="content">
    <section className="card margin-card">
    <h2>Calcolo del margine</h2>
    <div className="cost-facts"><p><small>Costo unitario</small><b>{money(l.costBaseCents)} / {p.baseUnit}</b></p>{preview && <>
        <p><small>Quantità base</small><b>{preview.baseQuantity} {p.baseUnit}</b>{preview.conversionIsEstimated ? ' · peso indicativo' : ''}</p>
        <p><small>Costo riga</small><b>{money(preview.lineCostCents)}</b></p></>}</div>{preview && <>
        <div className="margin-highlight"><small>Margine riga</small><strong>{money(preview.marginCents)} · {percent(preview.marginPercent)}</strong></div>
        </>}</section>
    <section className="card">
    <h2>Condizioni per ordini futuri</h2>
    <label className="check">
    <input type="checkbox" checked={save} onChange={e => setSave(e.target.checked)}/>Salva queste condizioni</label>
    <p className="muted">Solo per questo cliente e prodotto. L’omaggio rimane relativo alla singola riga.</p>
    <div className="grid two"><label className="field">
    <span>Validità dal</span>
    <input type="date" value={from} disabled={!save} onChange={e => setFrom(e.target.value)}/>
    </label>
    <label className="field">
    <span>Validità al (incluso)</span>
    <input type="date" value={to} disabled={!save} onChange={e => setTo(e.target.value)}/>
    </label></div>
    <small>Senza date: validità indeterminata. Eventuali sovrapposizioni richiedono conferma di sostituzione.</small>
    </section>
    </ScrollArea>
    </div>{(error || calculationError) && <p className="error" role="alert">{error || calculationError}</p>}<section className="card action-bar">
    {preview && <><p>Prezzo finale: <b>{money(preview.isGift ? 0 : preview.unitPriceBaseCents)} / {p.baseUnit}</b></p><Totals label="riga" totals={{netCents:preview.lineNetCents,marginCents:preview.marginCents,marginPercent:preview.marginPercent}}/></>}
    <div className="actions">
    <Link className="button" to={orderPath(o)}>Annulla</Link>
    <button className="primary" disabled={!preview} onClick={submit}>Salva modifiche →</button>
    </div>
    </section>
    </div>;
}
export function OrderReview() {
    const { orderId } = useParams();
    const { state: { data: d }, update, dispatch, notify } = useApp();
    const [params] = useSearchParams();
    const nav = useNavigate();
    const o = d.orders.find(o => o.id === orderId);
    if (!o)
        return <Empty text="Ordine non trovato."/>;
    const c = d.customers.find(c => c.id === o.customerId)!;
    const read = !editable(o);
    const errors = read ? [] : orderErrors(d, o);
    function field(patch: Partial<Order>) { update(data => { const ord = data.orders.find(x => x.id === o!.id)!; if (editable(ord))
        Object.assign(ord, patch); }); }
    return <div className="view review-view">
    <PageTitle title={read ? `Ordine ${o.number}` : 'Riepilogo ordine'} back={read ? (params.get('returnTo') || '/orders?tab=sent') : orderPath(o)} backLabel={read ? 'Ordini' : 'Prodotti'}/>{!read && <Stepper step={3}/>}<CustomerStrip order={o}/>{read && <p className="notice warning">{o.status === 'SENT' ? 'Inviato nella simulazione' : 'Confermato, in attesa di rete'} · Dettaglio in sola lettura</p>}<div className="grid two workspace-split">
    <section className="card pane review-lines">
    <div className="row between">
    <h2>Articoli <Badge>{o.lines.length}</Badge>
    </h2>{!read && <Link to={orderPath(o)}>Modifica prodotti</Link>}</div><ScrollArea label="Articoli del riepilogo">{o.lines.map(l => {
            const p = d.products.find(p => p.id === l.productId)!;
            return <div className="summary-line" key={l.id}>
            <strong>{p.name}</strong>
            <small>Cod. {p.code}</small>
            <p>{l.quantity} {l.unit} = {l.baseQuantity} {p.baseUnit}{l.conversionIsEstimated ? ' · peso indicativo' : ''}</p>
            <div className="row between">
            <span>{money(l.unitPriceBaseCents)} / {p.baseUnit}{l.isGift ? ' · Omaggio' : ''}</span>
            <b>{money(l.lineNetCents)}</b>
            </div>{l.note && <p>{l.note}</p>}</div>;
        })}</ScrollArea><label className="field delivery-note">
    <span>Nota sul documento di consegna</span>
    <textarea value={o.note} readOnly={read} onChange={e => field({ note: e.target.value })}/>
    </label>
    </section>
    <ScrollArea className="card delivery-form" label="Consegna e pagamento" kind="content">
    <h2>Consegna e pagamento</h2>
    <label className="field">
    <span>Destinazione</span>
    <select value={o.destinationId} disabled={read} onChange={e => field({ destinationId: e.target.value, deliveryDate: nextDelivery(d, c, e.target.value) })}>{d.destinations.filter(x => x.customerId === c.id).map(x => <option key={x.id} value={x.id}>{x.name} · {x.city}</option>)}</select>
    </label>
    <p>{d.destinations.find(x => x.id === o.destinationId)?.address}</p>
    <div className="grid two">
    <label className="field">
    <span>Data consegna</span>
    <input type="date" min={today} value={o.deliveryDate} readOnly={read} onChange={e => field({ deliveryDate: e.target.value })}/>
    </label>
    <label className="field">
    <span>Ora (facoltativa)</span>
    <input type="time" value={o.deliveryTime ?? ''} readOnly={read} onChange={e => field({ deliveryTime: e.target.value || null })}/>
    </label>
    </div>
    <p className="muted">Giorni del giro: {d.deliveryRoutes.find(r => r.id === (d.destinations.find(x => x.id === o.destinationId)?.deliveryRouteId ?? c.deliveryRouteId))?.weekdaysISO.map(x => ['', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'][x]).join(', ')}</p>
    <label className="field">
    <span>Deposito</span>
    <select value={o.warehouseId} disabled={read} onChange={e => field({ warehouseId: e.target.value })}>{d.warehouses.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
    </label>
    <label className="field">
    <span>Riferimento cliente (facoltativo)</span>
    <input value={o.customerReference} readOnly={read} onChange={e => field({ customerReference: e.target.value })}/>
    </label>
    <label className="field">
    <span>Referente ordine</span>
    <select value={o.contactId} disabled={read} onChange={e => field({ contactId: e.target.value })}>
    <option value="">Nessuno</option>{d.contacts.filter(x => x.customerId === c.id).map(x => <option key={x.id} value={x.id}>{x.firstName} {x.lastName}</option>)}</select>
    </label>
    <label className="field">
    <span>Pagamento dell’ordine</span>
    <select value={o.paymentId} disabled={read} onChange={e => field({ paymentId: e.target.value })}>{d.paymentMethods.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
    </label>
    <p className="muted">Predefinito: {d.paymentMethods.find(x => x.id === c.defaultPaymentId)?.label}</p>{o.paymentId !== c.defaultPaymentId && <Badge tone="warning">Modificato per questo ordine</Badge>}{!read && <button className="quiet" onClick={() => field({ paymentId: c.defaultPaymentId })}>Ripristina predefinito</button>}</ScrollArea>
    </div>
    <section className="card action-bar">
    <Totals totals={o.totals}/>{errors.length > 0 && <div role="alert" className="error">{errors.map(e => <p key={e}>{e}</p>)}</div>}{!read && <div className="actions">
        <button onClick={() => { if (o.status === 'WHATSAPP_REVIEW')
            update(data => { data.whatsappInbox.find(i => i.orderId === o.id)!.verificationSaved = true; }); notify('Ordine salvato.'); nav(o.status === 'WHATSAPP_REVIEW' ? '/fastorder' : '/orders?tab=drafts'); }}>Salva {o.status === 'WHATSAPP_REVIEW' ? 'verifica' : 'bozza'}</button>
        <button className="primary" disabled={!!errors.length} onClick={() => { dispatch({ type: 'CONFIRM', id: o.id }); notify('Ordine confermato. Trasmissione esclusivamente simulata.'); nav('/orders?tab=pending'); }}>Conferma ordine →</button>
        </div>}</section>
    </div>;
}
