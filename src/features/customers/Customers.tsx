import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useApp } from '../../app/Store';
import { Badge, Dialog, Empty, PageTitle, Search, Stepper, ScrollArea } from '../../design-system/ui';
import { type Customer, type Contact, type Data, date, matches, money, newOrder, today, enqueue } from '../../domain/model';
import { isConditionActive, receivablesSummary } from '../../domain/core';
import { OrderFilters } from '../orders/Orders';
export function CustomerList({ picker = false }: {
    picker?: boolean;
}) {
    const { state: { data: d }, update } = useApp();
    const nav = useNavigate();
    const [params] = useSearchParams();
    const [q, setQ] = useState('');
    const [selected, setSelected] = useState<Customer | null>(null);
    const customers = d.customers.filter(c => d.demoDefaults.activeCustomerIds.includes(c.id) && matches(q, c.businessName, c.code, c.taxId)).sort((a, b) => a.businessName.localeCompare(b.businessName, 'it'));
    const changing = d.orders.find(o => o.id === params.get('change'));
    function choose(c: Customer) { if (changing && changing.lines.length && changing.customerId !== c.id) {
        setSelected(c);
        return;
    } create(c); }
    function create(c: Customer) { const id = changing?.id ?? `BOZ-${crypto.randomUUID().slice(0, 8).toUpperCase()}`; update(data => { if (changing) {
        const idx = data.orders.findIndex(o => o.id === id);
        if (data.orders[idx].customerId !== c.id)
            data.orders[idx] = newOrder(data, c.id, id);
    }
    else
        data.orders.push(newOrder(data, c.id, id)); }); nav(`/orders/${id}/products`); }
    return <div className="view customer-list-view">
    <PageTitle title={picker ? 'Seleziona il cliente' : 'Clienti'} subtitle={picker ? 'Listino e condizioni vengono applicati automaticamente.' : 'Anagrafiche, ordini e partite aperte'}/>{picker && <Stepper step={1}/>}<Search value={q} onChange={setQ} label="Cerca per nome, codice o P. IVA"/>
    <p className="result-count">{customers.length} clienti · Ordine alfabetico</p><ScrollArea label="Lista clienti">{customers.map(c => <article className="card list-row" key={c.id}>
        <div>
        <h3>{c.businessName}</h3>
        <p>{c.code} · {c.city} ({c.province})</p>
        <small>P. IVA DEMO {c.taxId}</small>
        </div>{picker ? <button className="primary" onClick={() => choose(c)}>Seleziona →</button> : <Link className="button" to={`/customers/${c.id}`}>Apri scheda →</Link>}</article>)}{!customers.length && <Empty />}</ScrollArea>{selected && <Dialog title="Cambiare cliente?" onClose={() => setSelected(null)}>
        <p>Il carrello verrà svuotato e destinazione, pagamento e condizioni saranno reimpostati per {selected.businessName}.</p>
        <button className="primary" onClick={() => create(selected)}>Svuota e cambia cliente</button>
        </Dialog>}</div>;
}
export function CustomerHeader({ customer: c, tab = 'details' }: {
    customer: Customer;
    tab?: string;
}) {
    const [params] = useSearchParams();
    return <>
    <PageTitle title={c.businessName} subtitle={`Cod. ${c.code} · ${c.city} (${c.province})`} back={params.get('returnTo') || '/customers'} backLabel="Torna all’origine"/>
    <nav className="tabs" aria-label="Scheda cliente">{[['details', 'Anagrafica'], ['orders', 'Ordini'], ['open-items', 'Partite aperte'], ['commercial', 'Info commerciali']].map(([id, label]) => <Link key={id} className="button" aria-current={tab === id ? 'page' : undefined} to={`/customers/${c.id}?tab=${id}${params.get('returnTo') ? '&returnTo=' + encodeURIComponent(params.get('returnTo')!) : ''}`}>{label}</Link>)}</nav>
    </>;
}
export function CustomerDetail() {
    const { customerId } = useParams();
    const { state: { data: d } } = useApp();
    const [params] = useSearchParams();
    const c = d.customers.find(c => c.id === customerId && d.demoDefaults.activeCustomerIds.includes(c.id));
    if (!c)
        return <Empty text="Cliente non trovato nel portafoglio."/>;
    const tab = params.get('tab') ?? 'details';
    return <div className="view customer-view">
    <CustomerHeader customer={c} tab={tab}/>{tab === 'details' ? <Details customer={c}/> : tab === 'orders' ? <OrderFilters customerId={c.id}/> : tab === 'open-items' ? <OpenItems customer={c}/> : <Commercial customer={c}/>}</div>;
}
function Details({ customer: c }: {
    customer: Customer;
}) {
    const { state: { data: d }, update, notify } = useApp();
    const [form, setForm] = useState<Contact | null>(null), [error, setError] = useState('');
    function save() { if (!form)
        return; if (!form.firstName.trim() || !form.lastName.trim() || !form.role.trim() || !form.phoneDisplay.trim()) {
        setError('Compila nome, cognome, ruolo e telefono dimostrativo.');
        return;
    } const value = { ...form, whatsappActivationStatus: 'PENDING_SYNC' }; update(data => { const idx = data.contacts.findIndex(x => x.id === value.id); if (idx < 0)
        data.contacts.push(value);
    else
        data.contacts[idx] = value; enqueue(data, 'CONTACT', value.id, 'UPSERT_CONTACT'); }); setForm(null); setError(''); notify('Referente salvato. Abilitazione WhatsApp simulata al prossimo sync.'); }
    return <div className="grid two workspace-split">
    <ScrollArea label="Dati aziendali" className="card" kind="content">
    <h2>Dati aziendali</h2>
    <dl>{[['P. IVA DEMO', c.taxId], ['Intestatario', c.businessName], ['Indirizzo', c.address], ['Telefono', c.phoneDisplay], ['Email', c.email], ['Territorio', `${c.region} · ${c.province}`]].map(([k, v]) => <div key={k}>
        <dt>{k}</dt>
        <dd>{v}</dd>
        </div>)}</dl>
    </ScrollArea>
    <section className="card pane contacts-pane">
    <div className="row between">
    <h2>Referenti e ordini WhatsApp</h2>
    <button onClick={() => { setError(''); setForm({ id: crypto.randomUUID(), customerId: c.id, firstName: '', lastName: '', role: '', phoneDisplay: '+39 3XX XXX ', email: 'referente@example.invalid', whatsappEnabled: false, whatsappActivationStatus: 'DISABLED', synthetic: true }); }}>+ Aggiungi referente</button>
    </div><ScrollArea label="Referenti cliente">{d.contacts.filter(x => x.customerId === c.id).map(x => <article className="card spaced" key={x.id}>
        <h3>{x.firstName} {x.lastName}</h3>
        <p>{x.role} · {x.phoneDisplay}</p>
        <Badge tone={x.whatsappActivationStatus === 'PENDING_SYNC' ? 'warning' : x.whatsappEnabled ? 'success' : ''}>{x.whatsappActivationStatus === 'PENDING_SYNC' ? 'WhatsApp: in attesa sync' : x.whatsappEnabled ? 'WhatsApp abilitato' : 'WhatsApp non abilitato'}</Badge>
        <div className="actions">
        <button onClick={() => { setError(''); setForm({ ...x }); }}>Modifica referente</button>
        </div>
        </article>)}</ScrollArea>{form && <Dialog title="Modifica referente" onClose={() => setForm(null)}><form onSubmit={e => { e.preventDefault(); save(); }}>
        <h3>Modifica referente</h3>
        <div className="grid two">{[['firstName', 'Nome'], ['lastName', 'Cognome'], ['role', 'Ruolo'], ['phoneDisplay', 'Telefono demo']].map(([k, label]) => <label className="field" key={k}>
            <span>{label}</span>
            <input value={form[k as keyof Contact] as string} onChange={e => setForm({ ...form, [k]: e.target.value })}/>
            </label>)}</div>
        <label className="check">
        <input type="checkbox" checked={form.whatsappEnabled} onChange={e => setForm({ ...form, whatsappEnabled: e.target.checked })}/>Abilita agli ordini WhatsApp</label>
        <small>Modifica simulata, applicata dopo sincronizzazione.</small>{error && <p role="alert" className="error">{error}</p>}<div className="actions">
        <button type="button" onClick={() => setForm(null)}>Annulla</button>
        <button className="primary" type="submit">Salva referente</button>
        </div>
        </form></Dialog>}</section>
    </div>;
}
function Commercial({ customer: c }: {
    customer: Customer;
}) {
    const { state: { data: d } } = useApp();
    const [q, setQ] = useState('');
    const found = d.customerConditions.filter(x => x.customerId === c.id && matches(q, d.products.find(p => p.id === x.productId)!.name, d.products.find(p => p.id === x.productId)!.code));
    return <div className="pane commercial-pane">
    <div className="grid two">
    <section className="card">
    <h2>Pagamento predefinito</h2>
    <p>{d.paymentMethods.find(x => x.id === c.defaultPaymentId)?.label}</p>
    </section>
    <section className="card">
    <h2>Listino predefinito</h2>
    <p>{d.priceLists.find(x => x.id === c.defaultPriceListId)?.name}</p>
    </section>
    </div>
    <section className="card pane conditions-table">
    <h2>Condizioni dedicate per prodotto</h2>
    <Search value={q} onChange={setQ}/>
    <ScrollArea label="Condizioni dedicate"><table>
    <thead>
    <tr>
    <th>Prodotto</th>
    <th>Condizione</th>
    <th>Validità</th>
    </tr>
    </thead>
    <tbody>{found.map(x => {
            const p = d.products.find(p => p.id === x.productId)!;
            const active = isConditionActive(x, today);
            return <tr key={x.id}>
            <td data-label="Prodotto">
            <div>
            <b>{p.name}</b>
            <small>Cod. {p.code}</small>
            </div>
            </td>
            <td data-label="Condizione">{x.type === 'FIXED_PRICE' ? money(x.unitPriceBaseCents!) + ` / ${p.baseUnit}` : x.type === 'DISCOUNT' ? `${x.discountBasisPoints! / 100}% sul listino ${d.priceLists.find(l => l.id === x.priceListId)?.name}` : d.priceLists.find(l => l.id === x.priceListId)?.name}</td>
            <td data-label="Validità">
            <div>{date(x.validFrom)} → {date(x.validTo)}<br />
            <Badge tone={active ? 'success' : 'warning'}>{active ? 'Attiva' : x.validFrom && x.validFrom > today ? 'Futura' : 'Scaduta'}</Badge>
            </div>
            </td>
            </tr>;
        })}</tbody>
    </table>{!found.length && <Empty />}</ScrollArea></section>
    </div>;
}
export function ledgerRows(d: Data, customerId: string) { return d.receivables.filter(r => r.customerId === customerId).map(r => { const invoice = d.invoices.find(i => i.id === r.invoiceId)!; const paid = d.payments.filter(p => p.receivableId === r.id).reduce((s, p) => s + p.amountCents, 0); const residual = r.faceValueCents - paid; return { ...r, invoice, paid, residual, overdue: residual > 0 && r.dueDate < today }; }); }
function LedgerTable({ rows, onOpen }: {
    rows: ReturnType<typeof ledgerRows>;
    onOpen?: (id: string) => void;
}) {
    return <table>
    <thead>
    <tr>{['Documento / rata', 'Scadenza', 'Importo rata', 'Incassato', 'Residuo', 'Stato', 'Dettaglio'].map(x => <th key={x}>{x}</th>)}</tr>
    </thead>
    <tbody>{rows.map(r => <tr key={r.id}>
        <td data-label="Documento / rata">
        <div>
        <b>{r.invoice.number}</b>
        <small>{r.invoice.documentType === 'CREDIT_NOTE' ? 'Nota credito' : `Rata ${r.instalmentNumber}`} · Del {date(r.invoice.issueDate)}</small>
        </div>
        </td>
        <td data-label="Scadenza">{date(r.dueDate)}</td>
        <td data-label="Importo rata">{money(r.faceValueCents)}</td>
        <td data-label="Incassato">{money(r.paid)}</td>
        <td data-label="Residuo">
        <b>{money(r.residual)}</b>
        </td>
        <td data-label="Stato">
        <Badge tone={r.overdue ? 'error' : r.residual < 0 ? 'success' : ''}>{r.residual < 0 ? 'Credito' : r.residual === 0 ? 'Saldata' : r.overdue ? 'Scaduta' : 'A scadere'}</Badge>
        </td>
        <td data-label="Dettaglio">{onOpen ? <button onClick={() => onOpen(r.invoiceId)}>Apri</button> : 'Demo'}</td>
        </tr>)}</tbody>
    </table>;
}
function OpenItems({ customer: c }: {
    customer: Customer;
}) {
    const { state: { data: d } } = useApp();
    const [q, setQ] = useState(''), [only, setOnly] = useState(false), [doc, setDoc] = useState('');
    const s = receivablesSummary(d, c.id, today);
    const rows = ledgerRows(d, c.id).filter(r => matches(q, r.invoice.number) && (!only || r.overdue));
    const invoice = d.invoices.find(i => i.id === doc);
    return <div className="pane ledger-pane">
    <div className="grid three ledger-metrics">{[['Saldo aperto', s.balanceCents], ['Di cui scaduto', s.overdueCents], ['Incassato', s.receivedCents]].map(([label, value]) => <div className="card" key={label}>
        <small>{label}</small>
        <strong className="metric-number">{money(Number(value))}</strong>
        </div>)}</div>
    <div className="filters">
    <Search value={q} onChange={setQ} label="Cerca numero documento"/>
    <label className="check">
    <input type="checkbox" checked={only} onChange={e => setOnly(e.target.checked)}/>Solo scadute</label>
    <Link className="button primary" to={`/customers/${c.id}/share`}>Invia / scarica PDF</Link>
    </div>
    <section className="card pane ledger-table">
    <ScrollArea label="Partite del cliente"><LedgerTable rows={rows} onOpen={setDoc}/></ScrollArea>
    <p>{rows.length} partite · Importi per rata; i totali documento non vengono duplicati.</p>
    </section>{invoice && <Dialog title={`Documento ${invoice.number}`} onClose={() => setDoc('')}>
        <p className="notice warning">Anteprima sintetica · Non è un documento fiscale</p>
        <p>{c.businessName} · Data {date(invoice.issueDate)}</p>
        <p>Totale documento: <b>{money(invoice.faceValueCents)}</b>
        </p>
        <LedgerTable rows={ledgerRows(d, c.id).filter(r => r.invoiceId === invoice.id)}/>
        </Dialog>}</div>;
}
export function SharePage() {
    const { customerId } = useParams();
    const { state: { data: d, network }, update, notify } = useApp();
    const nav = useNavigate();
    const c = d.customers.find(c => c.id === customerId);
    const [only, setOnly] = useState(false), [channel, setChannel] = useState('WHATSAPP'), [recipient, setRecipient] = useState(d.contacts.find(x => x.customerId === customerId)?.id ?? ''), [preview, setPreview] = useState(false), [sent, setSent] = useState(false);
    if (!c)
        return <Empty />;
    const rows = ledgerRows(d, c.id).filter(r => !only || r.overdue);
    const contact = d.contacts.find(x => x.id === recipient);
    function send() { if (sent)
        return; setSent(true); const id = crypto.randomUUID(); update(data => { data.shareJobs.push({ id, customerId: c!.id, channel, recipient, overdue: only, status: 'WAITING_NETWORK' }); enqueue(data, 'SHARE', id, 'SHARE_SIMULATED'); }); notify('Simulazione registrata: nessun messaggio o PDF reale inviato o scaricato.'); }
    return <div className="view share-view">
    <CustomerHeader customer={c} tab="open-items"/>
    <section className="card pane share-panel">
    <div className="row between">
    <h2>Invia / scarica PDF</h2>
    <Link to={`/customers/${c.id}?tab=open-items`}>← Torna alle partite</Link>
    </div>
    <p className="notice warning">Tutti i canali sono simulati, incluso Scarica PDF. Non viene creato un documento fiscale.</p>
    <ScrollArea label="Opzioni di condivisione" kind="content">
    <label className="field">
    <span>Includi</span>
    <select value={only ? 'overdue' : 'all'} onChange={e => { setOnly(e.target.value === 'overdue'); setSent(false); }}>
    <option value="all">Tutte le partite aperte</option>
    <option value="overdue">Solo scadute</option>
    </select>
    </label>
    <p>{rows.length} partite · Residuo {money(rows.reduce((s, r) => s + r.residual, 0))}</p>
    <button onClick={() => setPreview(true)}>Anteprima PDF simulato</button>
    <h2 className="spaced">Scegli il canale</h2>
    <div className="tabs">{[['WHATSAPP', 'WhatsApp'], ['EMAIL', 'Email'], ['DOWNLOAD', 'Scarica PDF']].map(([id, label]) => <button key={id} aria-pressed={channel === id} onClick={() => { setChannel(id); setSent(false); }}>{label} · simulato</button>)}</div>
    <div className="grid two">
    <label className="field">
    <span>Mittente</span>
    <input readOnly value="Horeca Food Service · mittente demo"/>
    </label>
    <label className="field">
    <span>Destinatario sintetico</span>
    <select value={recipient} onChange={e => { setRecipient(e.target.value); setSent(false); }}>{d.contacts.filter(x => x.customerId === c.id).map(x => <option key={x.id} value={x.id}>{x.firstName} {x.lastName} · {x.role}</option>)}</select>
    <small>{channel === 'EMAIL' ? contact?.email : contact?.phoneDisplay}</small>
    </label>
    </div></ScrollArea>{sent && <p role="status">Simulazione {network === 'OFFLINE' ? 'accodata localmente' : 'registrata'}. Nessun invio o download reale.</p>}<div className="actions">
    <button onClick={() => nav(`/customers/${c.id}?tab=open-items`)}>Annulla</button>
    <button className="primary" disabled={sent || !recipient || !rows.length} onClick={send}>{sent ? 'Simulazione registrata' : channel === 'DOWNLOAD' ? 'Simula download PDF' : network === 'OFFLINE' ? 'Accoda invio simulato' : 'Simula invio'}</button>
    </div>
    </section>{preview && <Dialog title="Anteprima PDF simulato" onClose={() => setPreview(false)}>
        <h2>Horeca Food Service</h2>
        <p>{c.businessName} · P. IVA DEMO {c.taxId}</p>
        <p>Situazione al 22/09/2026 · Documento sintetico non fiscale</p>
        <LedgerTable rows={rows}/>
        <b>Residuo {money(rows.reduce((s, r) => s + r.residual, 0))}</b>
        </Dialog>}</div>;
}
