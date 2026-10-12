import { normalizeSearch, resolvePrice, homeCounts, receivablesSummary, isConditionActive } from 'hfs/core';
import { money, percent, stock, editable, uid, orderErrors } from 'hfs/domain';

/** Clone public ERB templates; all business values use textContent or safe attributes. */
function template(name) {
  const source = document.getElementById(`hfs-offline-${name}`);
  if (!source) throw new Error('Interfaccia offline non pronta. Riapri l’app connessa.');
  return source.content.firstElementChild.cloneNode(true);
}
function append(element, children) {
  for (const item of children.flat(Infinity)) if (item !== null && item !== undefined && item !== false) element.append(item instanceof Node ? item : document.createTextNode(String(item)));
  return element;
}
function node(tag, classes = '', ...children) {
  const source = document.getElementById('hfs-offline-elements').content.querySelector(tag);
  const element = source.cloneNode(true);
  if (classes) element.className = classes;
  return append(element, children);
}
const text = (tag, value, classes = '') => node(tag, classes, value);
const section = (heading, ...children) => node('section', 'card', text('h2', heading), children);
const actions = (...children) => node('div', 'actions', children);
const search = (query, ...values) => normalizeSearch(values.join(' ')).includes(normalizeSearch(query));
const empty = (message = 'Nessun risultato. Modifica i filtri per continuare.') => node('div', 'empty', message);
function button(label, classes = '', attributes = {}) {
  const element = node('button', classes, label);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}
function link(label, path, classes = 'button') {
  const element = node('a', classes, label); element.href = safePath(path); return element;
}
function hidden(name, value) {
  const input = node('input'); input.type = 'hidden'; input.name = name; input.value = value ?? ''; return input;
}
function field(label, name, value, type = 'text', classes = '', attributes = {}) {
  const input = node(type === 'textarea' ? 'textarea' : 'input', classes);
  if (type !== 'textarea') input.type = type;
  input.name = `payload[${name}]`; input.value = value ?? '';
  for (const [key, val] of Object.entries(attributes)) input.setAttribute(key, String(val));
  return node('label', 'field', text('span', label), input);
}
function checkbox(label, name, checked = false, classes = '') {
  const input = node('input', classes); input.type = 'checkbox'; input.name = name; input.value = 'true'; input.checked = checked;
  return node('label', 'check', input, label);
}
function select(label, name, rows, selected, filter = false) {
  const input = node('select', filter ? 'filter_input_js' : ''); input.name = filter ? name : `payload[${name}]`;
  rows.forEach(row => { const item = node('option', '', row.name || row.label || `${row.firstName} ${row.lastName}`); item.value = row.id; item.selected = String(row.id) === String(selected); input.append(item); });
  return node('label', 'field', text('span', label), input);
}
function title(label, back = '/', backLabel = 'Home', subtitle = '') {
  const element = template('title');
  const anchor = element.querySelector('a'); anchor.textContent = '← ' + backLabel; anchor.href = safePath(back);
  element.querySelector('h1').textContent = label;
  const paragraph = element.querySelector('p'); paragraph.textContent = subtitle; paragraph.hidden = !subtitle;
  return element;
}
function region(label, children, classes = '', kind = 'list') {
  const element = template('region'); element.className += ' ' + classes;
  element.setAttribute('aria-label', label); element.dataset.kind = kind;
  return append(element, [children]);
}
function totals(amounts) {
  const element = template('totals');
  element.querySelector('.total_net_js').textContent = money(amounts.netCents);
  element.querySelector('.total_margin_js').textContent = `${money(amounts.marginCents)} · ${percent(amounts.marginPercent)}`;
  element.querySelector('.error').hidden = amounts.marginCents >= 0;
  return element;
}
function form(type, payload, children, returnTo, classes = '') {
  return node('form', `command_form_js ${classes}`, hidden('type', type), Object.entries(payload).map(([key, value]) => hidden(`payload[${key}]`, value)), hidden('return_to', returnTo), children);
}
function filtering(path, children) {
  const element = node('form', 'filter_form_js filter-form', children); element.method = 'get'; element.action = path; return element;
}
function filterSearch(query, label = 'Cerca per nome o codice') {
  const input = node('input', 'filter_input_js'); input.type = 'search'; input.name = 'q'; input.value = query; input.placeholder = label;
  return node('label', 'field search', text('span', label), input);
}
function stepper(step) {
  return node('ol', 'stepper', ['Cliente', 'Prodotti', 'Riepilogo'].map((label, index) => {
    const item = node('li', '', text('b', index + 1 < step ? '✓' : index + 1), label);
    if (index + 1 === step) item.setAttribute('aria-current', 'step'); return item;
  }));
}
function quantity(product, count = 1, unit = product.baseUnit) {
  const element = template('quantity'); element.dataset.units = JSON.stringify(product.units);
  const step = product.units.find(item => item.code === unit)?.step || 1;
  const input = element.querySelector('input'); input.min = step; input.step = step; input.value = count;
  element.querySelector('[data-direction="-1"]').disabled = count <= step;
  const select = element.querySelector('select');
  for (const current of product.units) { const option = node('option', '', current.code === 'CT' ? 'CT · Colli' : current.code); option.value = current.code; option.selected = current.code === unit; select.append(option); }
  return element;
}
function stockBadge(data, product, warehouse) {
  const value = stock(data, product.id, warehouse);
  return node('span', `badge ${value ? 'success' : 'error'}`, `${value ? 'Disponibile' : 'Esaurito'} · ${value} ${product.baseUnit}`);
}
function customerStrip(data, order, change = false) {
  const customer = data.customers.find(item => item.id === order.customerId);
  return node('div', 'customer-strip', node('span', '', text('b', customer.businessName), ` · ${customer.code} · ${customer.city}`),
    link('Scheda cliente', `/customers/${customer.id}?returnTo=${encodeURIComponent(`/orders/${order.id}/products`)}`, ''),
    change ? link('Cambia cliente', `/orders/new/customer?change=${order.id}`, 'change-customer') : null);
}
function customerCards(data, params, picker) {
  const query = params.get('q') || '', change = params.get('change');
  const customers = data.customers.filter(customer => data.demoDefaults.activeCustomerIds.includes(customer.id) && search(query, customer.businessName, customer.code, customer.taxId, customer.city));
  return customers.length ? customers.map(customer => node('article', 'card list-row', node('div', 'details', text('h3', customer.businessName), text('p', `${customer.city} · Cod. ${customer.code}`), text('small', 'P.IVA DEMO ' + customer.taxId)),
    picker ? form(change ? 'CHANGE_CUSTOMER' : 'CREATE_DRAFT', change ? { orderId: change, customerId: customer.id, confirmClear: true } : { id: uid('BOZ'), customerId: customer.id },
      button('Seleziona →', 'primary', { type: 'submit', ...(change ? { 'data-confirm-message': 'Il carrello verrà svuotato. Continuare?' } : {}) }), change ? `/orders/${change}/products` : '/orders/:id/products') : link('Apri scheda →', `/customers/${customer.id}`))) : empty();
}
function home(data) {
  const counts = homeCounts(data, data.demoDefaults.currentAgentId, data.demoDefaults.activeCustomerIds);
  return node('div', 'view home-view', title('La tua giornata', '/', 'Home', 'Clienti, prodotti e ordini disponibili su questo dispositivo'),
    node('div', 'grid two home-primary', link('Inserisci nuovo ordine', '/orders/new/customer', 'card hero-card'), link('Ordini WhatsApp · richiede connessione', '/fastorder', 'card hero-card')),
    node('div', 'grid three home-orders', link(`${counts.drafts} Bozze`, '/orders?tab=drafts', 'card navigation-card'), link(`${counts.pending} Da inviare`, '/orders?tab=pending', 'card navigation-card'), link(`${counts.sent} Inviati`, '/orders?tab=sent', 'card navigation-card')),
    node('div', 'grid home-links', link('Clienti', '/customers', 'card navigation-card'), link('Catalogo prodotti', '/catalog', 'card navigation-card'), link('Statistiche e segnalazioni · richiede connessione', '/insights', 'card navigation-card')));
}
function products(data, order, params) {
  if (!editable(order)) return review(data, order);
  const query = params.get('q') || '', category = params.get('category') || '', past = params.get('past') === '1';
  const prior = new Set(data.orders.filter(item => item.status === 'SENT' && item.customerId === order.customerId).flatMap(item => item.lines.map(line => line.productId)));
  const path = `/orders/${order.id}/products`, current = path + '?' + params;
  const items = data.products.filter(product => search(query, product.name, product.code) && (!category || product.categoryId === category) && (!past || prior.has(product.id)));
  const cards = items.map(product => {
    const price = resolvePrice(data, data.customers.find(item => item.id === order.customerId), product, data.meta.demoClock);
    const card = node('article', 'card product-card', node('div', 'product-heading', text('h3', product.name), link('Scheda prodotto', `/catalog/${product.id}?warehouse=${order.warehouseId}&returnTo=${encodeURIComponent(current)}`, 'product-detail-link')),
      text('p', `Cod. ${product.code} · 1 CT = ${product.caseQuantityBase} ${product.baseUnit}`, 'meta'), node('div', 'row', text('b', `${money(price.unitPriceBaseCents)} / ${product.baseUnit}`), stockBadge(data, product, order.warehouseId)),
      form('ADD_LINE', { orderId: order.id, lineId: uid('L'), productId: product.id }, node('div', 'product-controls', quantity(product), button('+ Aggiungi', 'primary', { type: 'submit' })), current));
    card.dataset.testid = 'product-' + product.code; return card;
  });
  const history = checkbox('Già acquistati', 'past', past, 'filter_input_js'); history.querySelector('input').value = '1';
  const heading = text('h1', 'Cerca e aggiungi prodotti'); heading.id = 'product-search'; heading.tabIndex = -1;
  return node('div', 'view picker-view', node('div', 'order-toolbar', link('← Home', '/', 'back'), stepper(2)), customerStrip(data, order, true),
    node('div', 'grid editor workspace-split', node('section', 'pane product_search_js', heading, filtering(path, [filterSearch(query), node('div', 'filters', select('Categoria', 'category', [{ id: '', name: 'Tutte le categorie' }, ...data.categories], category, true), history)]),
      region('Lista prodotti', cards.length ? cards : empty())), cart(data, order, current)));
}
function cart(data, order, path) {
  const lines = order.lines.map(line => {
    const product = data.products.find(item => item.id === line.productId);
    const card = node('article', 'card cart-line', text('h3', product.name), text('small', 'Cod. ' + product.code),
      form('UPDATE_LINE', { orderId: order.id, lineId: line.id }, [quantity(product, line.quantity, line.unit), button('Salva quantità', '', { type: 'submit' })], path),
      text('p', `${line.baseQuantity} ${product.baseUnit} × ${money(line.unitPriceBaseCents)} = ${money(line.lineNetCents)}${line.conversionIsEstimated ? ' · peso indicativo' : ''}`),
      text('small', `Costo ${money(line.lineCostCents)} · Margine ${money(line.marginCents)} / ${percent(line.marginPercent)}`),
      actions(link('Modifica', `/orders/${order.id}/lines/${line.id}/edit`), line.whatsappRequestId ? null : form('REMOVE_LINE', { orderId: order.id, lineId: line.id }, button('Rimuovi', 'quiet danger', { type: 'submit' }), path)));
    card.dataset.testid = 'line-' + product.code; return card;
  });
  const element = node('section', 'cart', node('div', 'pane-heading', node('h2', '', 'Il tuo ordine ', node('span', 'badge', `${order.lines.length} articoli`))),
    region('Articoli nel carrello', lines.length ? lines : empty('Il carrello è vuoto. Scegli i prodotti a sinistra.'), 'cart-lines'),
    node('div', 'card cart-summary', totals(order.totals), actions(link('Vai al riepilogo →', `/orders/${order.id}/review`, 'button primary'), link('Salva bozza', '/orders?tab=drafts'))));
  element.id = 'cart'; return element;
}
function lineEditor(data, order, line) {
  const product = data.products.find(item => item.id === line.productId);
  const mode = ['FIXED_PRICE', 'PRICE_LIST', 'DISCOUNT'].includes(line.priceMode) ? line.priceMode : 'FIXED_PRICE';
  const price = section('Prezzo', actions(...[['PRICE_LIST', 'Listino'], ['FIXED_PRICE', 'Prezzo libero'], ['DISCOUNT', 'Sconto %']].map(([value, label]) => button(label, `price_mode_js ${value === mode ? 'primary' : ''}`, { 'data-mode': value }))), hidden('payload[priceMode]', mode),
    select('Listino di riferimento', 'priceListId', data.priceLists, order.priceListId), field('Prezzo finale', 'unitPriceBaseCents', (line.unitPriceBaseCents / 100).toFixed(2).replace('.', ','), 'text', 'price_input_js', { inputmode: 'decimal' }),
    field('Sconto sul listino %', 'discountBasisPoints', '0', 'number', 'discount_input_js', { min: '0', max: '100', step: '0.01' }), hidden('payload[isGift]', 'false'), checkbox('Riga in omaggio', 'payload[isGift]', line.isGift), field('Commento riga', 'note', line.note));
  const preview = node('div', 'line_preview_js', totals({ netCents: line.lineNetCents, marginCents: line.marginCents, marginPercent: line.marginPercent }));
  const condition = section('Condizione futura', checkbox('Salva queste condizioni', 'save_condition', false, 'condition_enabled_js'), hidden('payload[condition][id]', uid('COND')),
    field('Validità dal', 'condition][validFrom', data.meta.demoClock.slice(0, 10), 'date'), field('Validità al', 'condition][validTo', '', 'date'), checkbox('Sostituisci condizioni sovrapposte', 'payload[condition][replaceOverlaps]'));
  return node('div', 'view line-editor-view', title('Modifica articolo', `/orders/${order.id}/products`, 'Torna ai prodotti'),
    form('UPDATE_LINE', { orderId: order.id, lineId: line.id }, [node('div', 'grid two editor workspace-split', region('Quantità e prezzo', [section(product.name, quantity(product, line.quantity, line.unit)), price], '', 'content'),
      region('Margine e condizione', [section('Margine della riga', preview), condition], '', 'content')), node('div', 'action-bar', actions(link('Annulla', `/orders/${order.id}/products`), button('Salva modifiche', 'primary', { type: 'submit' })))], `/orders/${order.id}/products`, 'filter-form line_editor_js'));
}
function review(data, order) {
  const readOnly = !editable(order), errors = orderErrors(data, order), customer = data.customers.find(item => item.id === order.customerId);
  const rows = order.lines.map(line => node('article', 'summary-line', text('h3', data.products.find(item => item.id === line.productId)?.name), text('p', `${line.quantity} ${line.unit} · ${line.baseQuantity} ${data.products.find(item => item.id === line.productId)?.baseUnit} · ${money(line.lineNetCents)}`), text('small', `Margine ${money(line.marginCents)} · ${percent(line.marginPercent)}`), line.note ? text('p', line.note) : null));
  const details = node('fieldset', '', select('Destinazione', 'destinationId', data.destinations.filter(item => item.customerId === order.customerId), order.destinationId), field('Data consegna', 'deliveryDate', order.deliveryDate, 'date'),
    field('Ora consegna (opzionale)', 'deliveryTime', order.deliveryTime, 'time'), select('Deposito', 'warehouseId', data.warehouses, order.warehouseId), field('Riferimento cliente', 'customerReference', order.customerReference),
    select('Referente', 'contactId', [{ id: '', name: 'Nessun referente' }, ...data.contacts.filter(item => item.customerId === order.customerId)], order.contactId), select('Pagamento dell’ordine', 'paymentId', data.paymentMethods, order.paymentId), button('Ripristina pagamento cliente', 'reset_payment_js', { 'data-payment-id': customer.defaultPaymentId }));
  details.disabled = readOnly;
  const note = field('Nota sul documento di consegna', 'note', order.note, 'textarea'); note.querySelector('textarea').readOnly = readOnly;
  const error = text('p', errors.join(' '), 'error form_error_js'); error.setAttribute('role', 'alert'); error.hidden = readOnly || !errors.length;
  const content = [node('div', 'grid two review-layout workspace-split', node('section', 'card pane', text('h2', 'Articoli'), region('Articoli del riepilogo', rows.length ? rows : empty('Nessun articolo.')), note), region('Dati di consegna', details, 'card', 'content')),
    node('div', 'action-bar', totals(order.totals), readOnly ? text('p', 'Ordine in sola lettura.') : actions(link('Modifica articoli', `/orders/${order.id}/products`), button('Salva bozza', '', { type: 'submit' }), button('Conferma ordine →', 'primary', { type: 'submit', name: 'next_command', value: 'CONFIRM_ORDER' })), error)];
  return node('div', 'view review-view', title('Riepilogo ordine', readOnly ? '/orders' : `/orders/${order.id}/products`, readOnly ? 'I miei ordini' : 'Prodotti'), stepper(3), customerStrip(data, order), readOnly ? content : form('SAVE_REVIEW', { orderId: order.id }, content, '/orders?tab=drafts', 'filter-form review_form_js'));
}
function orders(data, params) {
  const tab = params.get('tab') || 'drafts', status = { drafts: 'DRAFT', pending: 'PENDING_SEND', sent: 'SENT' }[tab] || 'DRAFT', query = params.get('q') || '';
  const items = data.orders.filter(order => order.status === status && data.demoDefaults.activeCustomerIds.includes(order.customerId) && search(query, order.number, data.customers.find(item => item.id === order.customerId)?.businessName));
  const cards = items.map(order => node('article', 'card list-row', node('div', 'details', text('h3', data.customers.find(item => item.id === order.customerId)?.businessName), text('p', `${order.number} · ${order.deliveryDate} · ${money(order.totals.netCents)}`), text('small', order.channel === 'WHATSAPP' ? 'WhatsApp' : 'Agente')),
    actions(link(editable(order) ? 'Riprendi →' : 'Dettaglio →', `/orders/${order.id}/${editable(order) ? 'products' : 'review'}`), status === 'DRAFT' ? form('DELETE_DRAFT', { orderId: order.id }, button('Elimina bozza', 'danger', { type: 'submit', 'data-confirm-message': 'Eliminare definitivamente la bozza?' }), '/orders?tab=drafts') : null)));
  return node('div', 'view orders-view', title('I miei ordini'), node('nav', 'tabs', [['drafts', 'Bozze'], ['pending', 'Da inviare'], ['sent', 'Inviati']].map(([key, label]) => link(label, '/orders?tab=' + key, key === tab ? 'active' : ''))), filtering('/orders', [hidden('tab', tab), filterSearch(query)]), text('p', `${items.length} risultati`), region('Lista ordini', cards.length ? cards : empty()));
}
function catalog(data, params) {
  const query = params.get('q') || '', category = params.get('category') || '', warehouse = params.get('warehouse') || 'DEP-07', available = params.get('available') === '1';
  const items = data.products.filter(product => search(query, product.name, product.code) && (!category || product.categoryId === category) && (!available || stock(data, product.id, warehouse) > 0));
  const availableField = checkbox('Solo disponibili', 'available', available, 'filter_input_js'); availableField.querySelector('input').value = '1';
  return node('div', 'view catalog-view', title('Catalogo prodotti'), filtering('/catalog', [filterSearch(query), node('div', 'filters', select('Deposito', 'warehouse', data.warehouses, warehouse, true), select('Categoria', 'category', [{ id: '', name: 'Tutte le categorie' }, ...data.categories], category, true), availableField)]),
    text('h2', `${items.length} prodotti`), region('Lista catalogo', items.length ? items.map(product => node('article', 'card list-row', node('div', 'details', text('h3', product.name), text('p', `Cod. ${product.code} · UM ${product.baseUnit}`), stockBadge(data, product, warehouse)), link('Scheda prodotto →', `/catalog/${product.id}?warehouse=${warehouse}&returnTo=${encodeURIComponent('/catalog?' + params)}`))) : empty()));
}
function productDetail(data, product, params) {
  const warehouse = params.get('warehouse') || 'DEP-07', back = safePath(params.get('returnTo') || '/catalog');
  const dialog = node('dialog', 'dialog_js', text('h2', product.name), node('div', 'product-visual', 'HFS · ' + product.code), button('Chiudi', 'dialog_close_js')); dialog.id = 'product-visual-dialog'; dialog.setAttribute('aria-label', product.name);
  return node('div', 'view product-detail-view', title(product.name, back, 'Torna alla selezione', 'Cod. ' + product.code), node('div', 'grid two editor workspace-split',
    region('Visual prodotto', [node('div', 'product-visual', text('strong', 'HFS · ' + product.code), text('p', 'Visual sintetico · Confezione dimostrativa')), button('Ingrandisci visual', 'dialog_open_js', { 'data-dialog': dialog.id }), dialog], 'card', 'content'),
    region('Informazioni prodotto', [section('Disponibilità nel deposito', stockBadge(data, product, warehouse), text('p', 'Snapshot demo del 22/09/2026 alle 08:30')),
      section('Confezionamento', text('p', 'UM base: ' + product.baseUnit), text('p', product.caseLabel), product.units.map(unit => text('p', `1 ${unit.code} = ${unit.factorToBase} ${product.baseUnit}${unit.estimated ? ' · peso indicativo' : ''}`))),
      section('Altri dati', text('p', 'Conservazione: ' + product.storage), text('p', 'Allergeni: ' + (product.allergens || 'Non disponibile nella demo')), text('p', 'Nutrizione: ' + (product.nutrition || 'Non disponibile nella demo'))),
      section('Descrizione', text('p', product.description), node('details', '', text('summary', 'Leggi tutto'), text('p', product.baseUnitMeaning)))], '', 'content')));
}
function customerDetail(data, customer, params) {
  const tab = params.get('tab') || 'details'; let content;
  if (tab === 'orders') content = data.orders.filter(order => order.customerId === customer.id).map(order => node('article', 'card', text('h3', order.number), text('p', `${order.status} · ${money(order.totals.netCents)}`), link('Apri ordine', `/orders/${order.id}/${editable(order) ? 'products' : 'review'}`)));
  else if (tab === 'open-items') {
    const total = receivablesSummary(data, customer.id, data.meta.demoClock);
    content = section('Partite aperte · snapshot scaricato', text('p', `Saldo ${money(total.balanceCents)} · Scaduto ${money(total.overdueCents)} · Incassato ${money(total.receivedCents)}`), text('p', 'Documenti e condivisioni simulate disponibili online.'));
  } else if (tab === 'commercial') {
    content = data.customerConditions.filter(item => item.customerId === customer.id).map(condition => node('article', 'card', text('h3', data.products.find(item => item.id === condition.productId)?.name), text('p', `${condition.unitPriceBaseCents == null ? condition.type : money(condition.unitPriceBaseCents)} · ${isConditionActive(condition, data.meta.demoClock) ? 'Attiva' : condition.validFrom > data.meta.demoClock.slice(0, 10) ? 'Futura' : 'Scaduta'}`), text('p', `${condition.validFrom || 'Senza limite iniziale'} — ${condition.validTo || 'Senza scadenza'}`)));
    if (!content.length) content = empty('Nessuna condizione personalizzata.');
  } else content = [section('Dati cliente', text('p', customer.address), text('p', `${customer.city} · ${customer.province} · ${customer.region}`), text('p', `Cod. ${customer.code} · P.IVA DEMO ${customer.taxId}`), text('p', `${customer.phoneDisplay} · ${customer.email}`)),
    section('Referenti', data.contacts.filter(item => item.customerId === customer.id).map(contact => node('article', '', text('h3', `${contact.firstName} ${contact.lastName}`), text('p', `${contact.role} · ${contact.phoneDisplay}`), text('p', `${contact.email} · WhatsApp ${contact.whatsappEnabled ? 'abilitato' : 'disabilitato'}`))), text('p', 'Modifica referenti disponibile online.'))];
  return node('div', 'view customer-view', title(customer.businessName, safePath(params.get('returnTo') || '/customers'), 'Torna ai clienti'), node('nav', 'tabs', [['details', 'Informazioni'], ['orders', 'Ordini'], ['open-items', 'Partite aperte'], ['commercial', 'Info commerciali']].map(([key, label]) => link(label, `/customers/${customer.id}?tab=${key}`, key === tab ? 'active' : ''))), region('Informazioni cliente', content, '', 'content'), node('div', 'action-bar', form('CREATE_DRAFT', { id: uid('BOZ'), customerId: customer.id }, button('Nuovo ordine', 'primary', { type: 'submit' }), '/orders/:id/products')));
}
export function safePath(value) {
  try { const url = new URL(value, location.origin); return url.origin === location.origin ? url.pathname + url.search : '/'; } catch { return '/'; }
}
export function renderOffline(snapshot, pathname = location.pathname, params = new URLSearchParams(location.search)) {
  const data = snapshot.state.data, path = pathname === '/offline' ? '/' : pathname;
  if (path === '/') return home(data);
  if (path === '/orders/new/customer' || path === '/customers') return node('div', 'view customers-view', title(path === '/customers' ? 'Clienti' : 'Seleziona cliente'), path === '/customers' ? null : stepper(1), filtering(path, [filterSearch(params.get('q') || '', 'Cerca per nome, codice o P.IVA'), params.get('change') ? hidden('change', params.get('change')) : null]), region('Lista clienti', customerCards(data, params, path !== '/customers')));
  if (path === '/orders') return orders(data, params);
  if (path === '/catalog') return catalog(data, params);
  let match = path.match(/^\/catalog\/([^/]+)$/);
  if (match) { const product = data.products.find(item => item.id === decodeURIComponent(match[1])); if (product) return productDetail(data, product, params); }
  match = path.match(/^\/customers\/([^/]+)$/);
  if (match) { const customer = data.customers.find(item => item.id === decodeURIComponent(match[1]) && data.demoDefaults.activeCustomerIds.includes(item.id)); if (customer) return customerDetail(data, customer, params); }
  match = path.match(/^\/orders\/([^/]+)\/(products|review|lines\/([^/]+)\/edit)$/);
  if (match) {
    const order = data.orders.find(item => item.id === decodeURIComponent(match[1]));
    if (order) {
      if (match[2] === 'products') return products(data, order, params);
      if (match[2] === 'review') return review(data, order);
      const line = order.lines.find(item => item.id === decodeURIComponent(match[3]));
      if (line && editable(order)) return lineEditor(data, order, line);
    }
  }
  return node('div', 'view', title('Collegamento necessario'), section('Questa vista richiede il server', text('p', 'Rimangono disponibili clienti, catalogo e creazione o modifica degli ordini già scaricati.'), actions(link('Clienti', '/customers'), link('Catalogo', '/catalog'), link('I miei ordini', '/orders'))));
}
