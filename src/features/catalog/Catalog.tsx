import { useState } from 'react';
import { useFilters } from '../../app/useFilters';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useApp } from '../../app/Store';
import { PageTitle, Search, Empty, Icon, Dialog, ScrollArea } from '../../design-system/ui';
import { matches, type Product } from '../../domain/model';
import { StockBadge } from '../order-editor/Editor';
export function ProductVisual({ product }: {
    product: Product;
}) {
    return <div className="product-visual">
    <Icon name="box"/>
    <b style={{ display: 'block' }}>HFS · {product.code}</b>
    <small>Visual sintetico · Confezione dimostrativa</small>
    </div>;
}
export function Catalog() {
    const { state: { data: d } } = useApp();
    const [params, setParams] = useFilters();
    const q = params.get('q') ?? '', warehouse = params.get('warehouse') ?? 'DEP-07', cat = params.get('category') ?? '', available = params.get('available') === '1';
    const loc = useLocation();
    function filter(k: string, v: string) { const next = new URLSearchParams(params); next.set(k, v); setParams(next); }
    const products = d.products.filter(p => matches(q, p.name, p.code) && (!cat || p.categoryId === cat) && (!available || d.stocks.some(s => s.productId === p.id && s.warehouseId === warehouse && s.availableBaseQuantity > 0)));
    return <div className="view catalog-view">
    <PageTitle title="Catalogo prodotti" subtitle="Ricerca, categorie e disponibilità"/>
    <Search value={q} onChange={q => filter('q', q)}/>
    <div className="filters">
    <label className="field">
    <span>Deposito</span>
    <select value={warehouse} onChange={e => filter('warehouse', e.target.value)}>{d.warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
    </label>
    <label className="check">
    <input type="checkbox" checked={available} onChange={e => filter('available', e.target.checked ? '1' : '')}/>Solo disponibili</label>
    </div>
    <div className="grid catalog-grid workspace-split">
    <ScrollArea label="Categorie prodotti" className="card categories">
    <h2>Categorie</h2>
    <button className={!cat ? 'primary' : ''} onClick={() => filter('category', '')}>Tutti i prodotti</button>{d.categories.map(c => <button key={c.id} className={cat === c.id ? 'primary' : ''} onClick={() => filter('category', c.id)}>{c.name}</button>)}</ScrollArea>
    <section className="pane">
    <h2>{products.length} prodotti</h2><ScrollArea label="Lista catalogo">{products.map(p => <article className="card list-row" key={p.id}>
        <Icon />
        <div className="details">
        <h3>{p.name}</h3>
        <p>Cod. {p.code} · UM {p.baseUnit}</p>
        <StockBadge product={p} warehouseId={warehouse}/>
        </div>
        <Link className="button" to={`/catalog/${p.id}?warehouse=${warehouse}&returnTo=${encodeURIComponent(loc.pathname + '?' + params.toString())}`}>Scheda prodotto →</Link>
        </article>)}{!products.length && <Empty />}</ScrollArea></section>
    </div>
    </div>;
}
export function ProductDetail() {
    const { productId } = useParams();
    const { state: { data: d } } = useApp();
    const [params, setParams] = useSearchParams();
    const [zoom, setZoom] = useState(false), [expanded, setExpanded] = useState(false);
    const p = d.products.find(p => p.id === productId);
    if (!p)
        return <Empty text="Prodotto non trovato."/>;
    const warehouse = params.get('warehouse') ?? 'DEP-07';
    const back = params.get('returnTo') || '/catalog';
    return <div className="view product-detail-view">
    <PageTitle title={p.name} subtitle={`Cod. ${p.code} · ${d.categories.find(c => c.id === p.categoryId)?.name}`} back={back} backLabel="Torna alla selezione"/>
    <label className="field">
    <span>Deposito consultato</span>
    <select value={warehouse} disabled={back.startsWith('/orders/') || back.startsWith('/fastorder/')} onChange={e => { const next = new URLSearchParams(params); next.set('warehouse', e.target.value); setParams(next, { replace: true }); }}>{d.warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
    </label>
    <div className="grid editor workspace-split">
    <ScrollArea label="Visual prodotto" className="card" kind="content">
    <ProductVisual product={p}/>
    <button className="wide spaced" onClick={() => setZoom(true)}>Ingrandisci visual</button>
    </ScrollArea>
    <ScrollArea label="Informazioni prodotto" kind="content">
    <section className="card">
    <h2>Disponibilità nel deposito</h2>
    <StockBadge product={p} warehouseId={warehouse}/>
    <p className="muted">Snapshot demo del 22/09/2026 alle 08:30</p>
    </section>
    <div className="grid two">
    <section className="card">
    <h2>Confezionamento</h2>
    <p>UM base: {p.baseUnit}</p>
    <p>{p.caseLabel}</p>{p.units.map(u => <p key={u.code}>1 {u.code} = {u.factorToBase} {p.baseUnit}{u.estimated ? ' · peso indicativo' : ''}</p>)}</section>
    <section className="card">
    <h2>Altri dati</h2>
    <p>Conservazione: {p.storage}</p>
    <p>Allergeni: {p.allergens ?? 'Non disponibile nella demo'}</p>
    <p>Nutrizione: {p.nutrition ?? 'Non disponibile nella demo'}</p>
    </section>
    </div>
    <section className="card">
    <h2>Descrizione</h2>
    <p>{expanded ? p.description : p.description.slice(0, 85) + '…'}</p>{expanded && <p>{p.baseUnitMeaning}</p>}<button onClick={() => setExpanded(!expanded)}>{expanded ? 'Riduci' : 'Leggi tutto'}</button>
    </section>
    </ScrollArea>
    </div>{zoom && <Dialog title={p.name} onClose={() => setZoom(false)}>
        <ProductVisual product={p}/>
        <p>{p.caseLabel}</p>
        </Dialog>}</div>;
}
