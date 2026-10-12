import { initialState, calculateLine, type State } from '../domain/model';
/** Reject malformed envelopes without overwriting the user's stored value. */
export function decodeState(raw: string): State {
    const s = JSON.parse(raw) as State;
    const baseline = initialState();
    if (s.schemaVersion !== 1 || s.datasetId !== baseline.datasetId || !s.data || !['OFFLINE', 'SYNCING', 'ONLINE'].includes(s.network))
        throw Error('Schema non compatibile');
    const d = s.data;
    for (const key of Object.keys(baseline.data) as (keyof typeof d)[]) {
        if (Array.isArray(baseline.data[key]) && !Array.isArray(d[key]))
            throw Error('Collezione mancante');
        if (Array.isArray(d[key]) && (d[key] as unknown[]).some(x => !x || typeof x !== 'object'))
            throw Error('Entità non valida');
    }
    // Immutable catalog/config data must retain their approved shape and values.
    for (const key of ['products', 'customers', 'warehouses', 'stocks', 'categories', 'paymentMethods', 'priceLists', 'priceListItems', 'destinations', 'deliveryRoutes', 'meta', 'demoDefaults', 'invoices', 'receivables', 'payments', 'analyses'] as const) {
        if (JSON.stringify(d[key]) !== JSON.stringify(baseline.data[key]))
            throw Error('Riferimenti incompatibili');
    }
    const ids = new Set<string>();
    for (const o of d.orders) {
        if (!o || typeof o.id !== 'string' || ids.has(o.id) || !d.customers.some(c => c.id === o.customerId) || !['DRAFT', 'WHATSAPP_REVIEW', 'PENDING_SEND', 'SENT'].includes(o.status) || !Array.isArray(o.lines) || !o.totals || !Number.isSafeInteger(o.totals.netCents))
            throw Error('Ordine non valido');
        ids.add(o.id);
        for (const l of o.lines) {
            const p = d.products.find(p => p.id === l.productId);
            if (!p || typeof l.id !== 'string')
                throw Error('Riga non valida');
            calculateLine(p, l);
        }
    }
    for (const inbox of d.whatsappInbox) {
        if (!ids.has(inbox.orderId) || !Array.isArray(inbox.requests))
            throw Error('Inbox non valida');
        for (const r of inbox.requests) {
            if (typeof r.rawText !== 'string' || !Array.isArray(r.alternatives))
                throw Error('Richiesta non valida');
        }
    }
    for (const c of d.contacts) {
        if (typeof c.id !== 'string' || typeof c.firstName !== 'string' || typeof c.lastName !== 'string' || !d.customers.some(x => x.id === c.customerId))
            throw Error('Referente non valido');
    }
    for (const c of d.customerConditions) {
        if (!d.products.some(p => p.id === c.productId) || !d.customers.some(x => x.id === c.customerId))
            throw Error('Condizione non valida');
    }
    for (const j of d.syncQueue) {
        if (typeof j.id !== 'string' || !Number.isInteger(j.attempts) || (j.entityType === 'ORDER' && !ids.has(j.entityId)))
            throw Error('Coda non valida');
    }
    if (typeof s.lastSyncAt !== 'string' || !Number.isInteger(s.revision))
        throw Error('Stato non valido');
    return { ...s, network: s.network === 'OFFLINE' ? 'OFFLINE' : 'SYNCING', warning: '' };
}
