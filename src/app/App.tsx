import { useEffect, useRef, useState } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Provider, useApp } from './Store';
import { Dialog } from '../design-system/ui';
import { StatusFooter } from './StatusFooter';
import { AppHeader } from './AppHeader';
import { useWorkspaceLayout } from './useWorkspaceLayout';
import { Home } from '../features/home/Home';
import { CustomerList, CustomerDetail, SharePage } from '../features/customers/Customers';
import { ProductPicker, LineEditor, OrderReview } from '../features/order-editor/Editor';
import { OrdersList } from '../features/orders/Orders';
import { Inbox, FastReview } from '../features/fastorder/FastOrder';
import { Catalog, ProductDetail } from '../features/catalog/Catalog';
import { Insights, Analysis } from '../features/insights/Insights';
function Shell() {
    const { state, dispatch, notice, storageError } = useApp();
    const [dialog, setDialog] = useState('');
    const [leaving, setLeaving] = useState('');
    const location = useLocation();
    const nav = useNavigate();
    const shellRef = useRef<HTMLDivElement>(null);
    const route = location.pathname + location.search;
    const workspaceKey = `${route}|${state.revision}`;
    const dockKey = `${location.pathname}|${new URLSearchParams(location.search).get('tab') ?? ''}|${state.revision}`;
    const layout = useWorkspaceLayout(shellRef, workspaceKey);
    useEffect(() => { document.getElementById('main')?.scrollTo(0, 0); }, [location.pathname, state.revision]);
    return <div ref={shellRef} className="app-shell workspace-shell" data-density={layout.compact ? 'compact' : 'regular'} data-layout={layout.flowing ? 'flow' : 'fit'} onClickCapture={e => { const a = (e.target as HTMLElement).closest('a'); const to = a?.getAttribute('href')?.slice(1); const order = state.data.orders.find(o => location.pathname.includes('/' + o.id + '/') || location.pathname === '/fastorder/' + o.id); if (order && order.lines.length && ['DRAFT', 'WHATSAPP_REVIEW'].includes(order.status) && to && ['/', '/orders?tab=drafts', '/fastorder'].includes(to)) {
        e.preventDefault();
        e.stopPropagation();
        setLeaving(to);
    } }}>
    <a className="skip" href="#main" onClick={e => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Vai al contenuto</a>
    <AppHeader view={dockKey}/>{(state.warning || storageError) && <div role="alert" className="notice warning">{state.warning || storageError}</div>}<main id="main" tabIndex={-1} key={state.revision}>
    <Routes>
    <Route path="/" element={<Home />}/>
    <Route path="/orders/new/customer" element={<CustomerList picker/>}/>
    <Route path="/orders/:orderId/products" element={<ProductPicker />}/>
    <Route path="/orders/:orderId/lines/:lineId/edit" element={<LineEditor />}/>
    <Route path="/orders/:orderId/review" element={<OrderReview />}/>
    <Route path="/orders" element={<OrdersList />}/>
    <Route path="/fastorder" element={<Inbox />}/>
    <Route path="/fastorder/:orderId" element={<FastReview />}/>
    <Route path="/fastorder/:orderId/resolve/:requestId" element={<FastReview />}/>
    <Route path="/customers" element={<CustomerList />}/>
    <Route path="/customers/:customerId" element={<CustomerDetail />}/>
    <Route path="/customers/:customerId/share" element={<SharePage />}/>
    <Route path="/catalog" element={<Catalog />}/>
    <Route path="/catalog/:productId" element={<ProductDetail />}/>
    <Route path="/insights" element={<Insights />}/>
    <Route path="/insights/:customerId" element={<Analysis />}/>
    <Route path="/insights/:customerId/actions" element={<Analysis />}/>
    <Route path="*" element={<>
        <h1>Pagina non trovata</h1>
        <Link to="/">Torna alla Home</Link>
        </>}/>
    </Routes>
    </main>
    <StatusFooter route={dockKey} onDialog={setDialog}/>{notice && <div role="status" className="snackbar">{notice}</div>}{leaving && <Dialog title="Conservare la bozza?" onClose={() => setLeaving('')}>
        <p>Gli articoli e le modifiche salvate resteranno disponibili per riprendere lo stesso ordine.</p>
        <div className="actions">
        <button className="primary" onClick={() => { const to = leaving; setLeaving(''); nav(to); }}>Conserva bozza ed esci</button>
        <button onClick={() => setLeaving('')}>Continua modifica</button>
        </div>
        </Dialog>}{dialog === 'sync' && <Dialog title="Sincronizzazione demo" onClose={() => setDialog('')}>
        <p>Gli ordini confermati vengono trasmessi nella simulazione al ritorno online. Nessun invio reale.</p>
        <p>{state.data.syncQueue.filter(j => j.status === 'WAITING_NETWORK').length} operazioni in attesa · {state.data.syncQueue.filter(j => j.status === 'DONE').length} completate</p>{state.data.syncQueue.map(j => <p key={j.id}>{j.entityId} · {j.status === 'DONE' ? 'Completata' : 'In attesa di rete'} · tentativi {j.attempts}</p>)}</Dialog>}{dialog === 'reset' && <Dialog title="Ripristinare la demo?" onClose={() => setDialog('')}>
        <p>Tutte le modifiche locali saranno sostituite dal seed iniziale. La rete tornerà offline.</p>
        <button className="primary" onClick={() => { dispatch({ type: 'RESET' }); setDialog(''); nav('/'); }}>Ripristina seed</button>
        </Dialog>}</div>;
}
export function App() {
    return <Provider>
    <HashRouter useTransitions={false}>
    <Shell />
    </HashRouter>
    </Provider>;
}
