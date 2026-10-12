import seed from '../../src/data/hfs_demo_data.json' with { type: 'json' };
import { baseQuantity, lineAmounts, sumAmounts, resolvePrice, queueValidatedOrder, transmitQueuedOrders, normalizeSearch, type Amounts, type Condition } from './core.ts';
export type Product = typeof seed.products[number];
export type Customer = typeof seed.customers[number];
export type Line = Omit<typeof seed.orders[number]['lines'][number], 'marginPercent' | 'priceReferenceId' | 'whatsappRequestId'> & {
    marginPercent: number | null;
    priceReferenceId: string | null;
    whatsappRequestId: string | null;
};
export type Order = Omit<typeof seed.orders[number], 'lines' | 'totals' | 'deliveryTime' | 'sentAt'> & {
    lines: Line[];
    totals: Amounts;
    deliveryTime: string | null;
    sentAt: string | null;
};
export type Contact = typeof seed.contacts[number];
export type Request = Omit<typeof seed.whatsappInbox[number]['requests'][number], 'resolution'> & {
    usualProductId?: string;
    resolution: {
        productId?: string;
        quantity?: number;
        unit?: string;
        reason?: string;
    } | null;
};
export type Mapping = {
    customerId: string;
    phrase: string;
    productId: string;
};
export type Share = {
    id: string;
    customerId: string;
    channel: string;
    recipient: string;
    overdue: boolean;
    status: string;
};
export type Data = Omit<typeof seed, 'branding' | 'orders' | 'customerConditions' | 'learnedMappings' | 'shareJobs' | 'whatsappInbox'> & {
    branding: Omit<typeof seed.branding, 'visualSystem'>;
    orders: Order[];
    customerConditions: (Condition & {
        savedByAgentId: string;
    })[];
    learnedMappings: Mapping[];
    shareJobs: Share[];
    whatsappInbox: (Omit<typeof seed.whatsappInbox[number], 'requests'> & {
        requests: Request[];
    })[];
};
export const clock = seed.meta.demoClock, today = clock.slice(0, 10);
// Keep approved business data verbatim; design-source provenance is development-only.
const runtimeSeed: Data = {
    meta: seed.meta,
    branding: { brandName: seed.branding.brandName, appName: seed.branding.appName, wordmark: seed.branding.wordmark, logoMode: seed.branding.logoMode, logoCreationAuthorized: seed.branding.logoCreationAuthorized, geographicScope: seed.branding.geographicScope },
    demoDefaults: seed.demoDefaults,
    categories: seed.categories,
    agents: seed.agents,
    warehouses: seed.warehouses,
    deliveryRoutes: seed.deliveryRoutes,
    paymentMethods: seed.paymentMethods,
    priceLists: seed.priceLists,
    priceListItems: seed.priceListItems,
    products: seed.products,
    stocks: seed.stocks,
    customers: seed.customers,
    contacts: seed.contacts,
    destinations: seed.destinations,
    customerConditions: seed.customerConditions,
    orders: seed.orders,
    whatsappInbox: seed.whatsappInbox,
    scenarioBank: seed.scenarioBank,
    invoices: seed.invoices,
    receivables: seed.receivables,
    payments: seed.payments,
    insights: seed.insights,
    analyses: seed.analyses,
    learnedMappings: seed.learnedMappings,
    syncQueue: seed.syncQueue,
    shareJobs: seed.shareJobs,
    derived: seed.derived
};
export const freshData = (): Data => structuredClone(runtimeSeed);
export const money = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n / 100);
export const percent = (n: number | null) => n === null ? '—' : new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(n) + '%';
export const date = (s: string | null) => s ? s.slice(0, 10).split('-').reverse().join('/') : '—';
export const matches = (q: string, ...s: string[]) => normalizeSearch(s.join(' ')).includes(normalizeSearch(q));
export const stock = (d: Data, p: string, w: string) => d.stocks.find(s => s.productId === p && s.warehouseId === w)?.availableBaseQuantity ?? 0;
export const unresolved = (r: Request) => !['MATCHED', 'RESOLVED', 'EXCLUDED'].includes(r.status);
export const editable = (o: Order) => ['DRAFT', 'WHATSAPP_REVIEW'].includes(o.status);
export function calculateLine(p: Product, l: Line): Line { const b = baseQuantity(p, l.quantity, l.unit); const a = lineAmounts(b.quantity, l.unitPriceBaseCents, l.costBaseCents, l.isGift); return { ...l, baseQuantity: b.quantity, conversionIsEstimated: b.estimated, lineNetCents: a.netCents, lineCostCents: a.costCents, marginCents: a.marginCents, marginPercent: a.marginPercent }; }
export function recalc(o: Order) { o.totals = sumAmounts(o.lines.map(l => ({ netCents: l.lineNetCents, costCents: l.lineCostCents, marginCents: l.marginCents, marginPercent: l.marginPercent }))); o.updatedAt = clock; }
export function makeLine(d: Data, o: Order, p: Product, quantity: number, unit: string, id: string, requestId: string | null = null): Line { const c = d.customers.find(c => c.id === o.customerId)!; const price = resolvePrice(d, c, p, today); return calculateLine(p, { id, productId: p.id, quantity, unit, baseQuantity: 0, conversionIsEstimated: false, unitPriceBaseCents: price.unitPriceBaseCents, costBaseCents: p.costBaseCents, priceMode: price.source, priceReferenceId: price.conditionId, lineNetCents: 0, lineCostCents: 0, marginCents: 0, marginPercent: null, isGift: false, note: '', whatsappRequestId: requestId }); }
export function nextDelivery(d: Data, c: Customer, destinationId = c.defaultDestinationId) { const dest = d.destinations.find(x => x.id === destinationId); const route = d.deliveryRoutes.find(r => r.id === (dest?.deliveryRouteId ?? c.deliveryRouteId))!; const dt = new Date(today + 'T12:00:00Z'); do {
    dt.setUTCDate(dt.getUTCDate() + 1);
} while (!route.weekdaysISO.includes(dt.getUTCDay() || 7)); return dt.toISOString().slice(0, 10); }
export function newOrder(d: Data, customerId: string, id: string): Order { const c = d.customers.find(c => c.id === customerId)!; return { id, number: id, customerId, agentId: d.demoDefaults.currentAgentId, channel: 'AGENT', status: 'DRAFT', createdAt: clock, updatedAt: clock, sentAt: null, warehouseId: c.warehouseId, destinationId: c.defaultDestinationId, deliveryDate: nextDelivery(d, c), deliveryTime: null, customerReference: '', contactId: d.contacts.find(x => x.customerId === c.id)?.id ?? '', paymentId: c.defaultPaymentId, priceListId: c.defaultPriceListId, note: '', noteDestination: 'DELIVERY_DOCUMENT', lines: [], totals: sumAmounts([]), synthetic: true }; }
export function orderErrors(d: Data, o: Order): string[] { const e: string[] = []; if (!o.lines.length)
    e.push('Aggiungi almeno un articolo.'); if (!o.destinationId || !o.paymentId || !o.deliveryDate)
    e.push('Completa destinazione, data e pagamento.'); const c = d.customers.find(c => c.id === o.customerId)!; const dest = d.destinations.find(x => x.id === o.destinationId); const route = d.deliveryRoutes.find(r => r.id === (dest?.deliveryRouteId ?? c.deliveryRouteId)); if (o.deliveryDate <= today || !route?.weekdaysISO.includes(new Date(o.deliveryDate + 'T12:00:00Z').getUTCDay() || 7))
    e.push('Scegli una data successiva a oggi prevista dal giro di consegna.'); if (d.whatsappInbox.find(i => i.orderId === o.id)?.requests.some(unresolved))
    e.push('Risolvi o escludi tutte le richieste WhatsApp.'); const quantities = new Map<string, number>(); for (const l of o.lines) {
    try {
        calculateLine(d.products.find(p => p.id === l.productId)!, l);
    }
    catch (err) {
        e.push(String(err));
    }
    quantities.set(l.productId, (quantities.get(l.productId) ?? 0) + l.baseQuantity);
} for (const [id, q] of quantities) {
    if (q > stock(d, id, o.warehouseId))
        e.push(`${d.products.find(p => p.id === id)!.name}: disponibilità insufficiente (${stock(d, id, o.warehouseId)}).`);
} return e; }
export function parseCents(s: string) { if (!/^\d+([,.]\d{1,2})?$/.test(s.trim()))
    throw new Error('Inserisci un prezzo valido, con massimo due decimali.'); const [a, b = ''] = s.replace(',', '.').split('.'); const n = Number(a) * 100 + Number(b.padEnd(2, '0')); if (!Number.isSafeInteger(n))
    throw new Error('Prezzo fuori intervallo.'); return n; }
export type State = {
    schemaVersion: number;
    datasetId: string;
    data: Data;
    network: 'OFFLINE' | 'SYNCING' | 'ONLINE';
    lastSyncAt: string;
    warning: string;
    revision: number;
};
export const initialState = (): State => ({ schemaVersion: 1, datasetId: seed.meta.datasetId, data: freshData(), network: 'OFFLINE', lastSyncAt: seed.demoDefaults.lastSyncAt, warning: '', revision: 0 });
export type Action = {
    type: 'RESET';
} | {
    type: 'NETWORK';
    online: boolean;
} | {
    type: 'SYNC';
} | {
    type: 'DATA';
    update: (data: Data) => void;
} | {
    type: 'CONFIRM';
    id: string;
};
export function reducer(state: State, action: Action): State {
    if (action.type === 'RESET')
        return { ...initialState(), revision: state.revision + 1 };
    if (action.type === 'NETWORK')
        return { ...state, network: action.online ? 'SYNCING' : 'OFFLINE' };
    if (action.type === 'SYNC') {
        if (state.network === 'OFFLINE')
            return state;
        const data = transmitQueuedOrders(state.data, clock);
        for (const job of data.syncQueue.filter(j => j.status === 'WAITING_NETWORK')) {
            if (job.operation === 'UPSERT_CONTACT') {
                const c = data.contacts.find(c => c.id === job.entityId);
                if (c)
                    c.whatsappActivationStatus = c.whatsappEnabled ? 'ACTIVE' : 'DISABLED';
            }
            if (job.operation === 'SHARE_SIMULATED') {
                const s = data.shareJobs.find(s => s.id === job.entityId);
                if (s)
                    s.status = 'DONE';
            }
            job.status = 'DONE';
            job.attempts++;
        }
        return { ...state, data, network: 'ONLINE', lastSyncAt: clock };
    }
    if (action.type === 'CONFIRM') {
        const o = state.data.orders.find(o => o.id === action.id);
        if (!o || !editable(o) || orderErrors(state.data, o).length)
            return state;
        return { ...state, data: queueValidatedOrder(state.data, action.id, clock), network: state.network === 'OFFLINE' ? 'OFFLINE' : 'SYNCING' };
    }
    const data = structuredClone(state.data);
    action.update(data);
    return { ...state, data, network: state.network === 'ONLINE' && data.syncQueue.some(j => j.status === 'WAITING_NETWORK') ? 'SYNCING' : state.network };
}
export function enqueue(d: Data, entityType: string, entityId: string, operation: string) { const key = `${operation}:${entityId}`; const old = d.syncQueue.find(j => j.idempotencyKey === key); if (old) {
    old.status = 'WAITING_NETWORK';
    return;
} d.syncQueue.push({ id: key, entityType, entityId, operation, idempotencyKey: key, status: 'WAITING_NETWORK', attempts: 0 }); }
