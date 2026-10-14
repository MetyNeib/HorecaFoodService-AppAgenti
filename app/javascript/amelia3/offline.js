import { priceFor, lineCents, orderableUnits } from 'amelia3/domain';
import { money } from 'hfs/domain';

function node(tag, text = '', classes = '') {
  const element = document.getElementById('amelia-elements').content.querySelector(tag).cloneNode(true);
  element.textContent = text; if (classes) element.className = classes; return element;
}
function box(tag, classes, ...children) { const element = node(tag, '', classes); element.append(...children.flat(Infinity)); return element; }
function link(label, path, classes = 'button') { const element = node('a', label, classes); element.href = path; return element; }
function button(label, classes = '', disabled = false) { const element = node('button', label, classes); element.type = 'submit'; element.disabled = disabled; return element; }
function field(label, name, value, type = 'text') {
  const input = node(type === 'textarea' ? 'textarea' : 'input');
  if (type !== 'textarea') input.type = type;
  input.name = `payload[${name}]`; input.value = value ?? '';
  return box('label', 'field', node('span', label), input);
}
function form(type, payload, target, ...children) {
  const element = box('form', 'amelia_command_form_js', children);
  element.dataset.command = type; element.dataset.payload = JSON.stringify(payload); element.dataset.returnTo = target; return element;
}
function quantity(value, step, unit) {
  const label = field(`Quantità (${unit})`, 'quantity', value, 'number'), input = label.querySelector('input');
  input.min = step === 'any' ? '0' : step || ''; input.step = step || 'any'; input.max = 100000; input.required = true; input.disabled = !step;
  input.className = 'quantity_input_js amelia_quantity_js'; input.setAttribute('aria-label', 'Quantità');
  const minus = button('−', 'amelia_step_js', !step), plus = button('+', 'amelia_step_js', !step);
  minus.type = plus.type = 'button'; minus.dataset.direction = '-1'; plus.dataset.direction = '1';
  minus.setAttribute('aria-label', 'Riduci quantità'); plus.setAttribute('aria-label', 'Aumenta quantità');
  const controls = box('span', 'stepper-input', minus, input, plus); label.append(controls);
  return box('div', 'quantity quantity_js', label, box('span', 'field', node('span', 'UM'), node('b', unit)));
}
function search(path, value, extras = {}) {
  const input = node('input'); input.type = 'search'; input.name = 'q'; input.value = value || ''; input.placeholder = 'Nome o codice';
  const element = box('form', 'filters amelia_search_form_js', box('label', 'field search', node('span', 'Cerca nei dati preparati'), input), button('Cerca'));
  element.method = 'get'; element.action = path;
  Object.entries(extras).forEach(([key, value]) => { const input = node('input'); input.type = 'hidden'; input.name = key; input.value = value; element.append(input); });
  return element;
}
function region(label, ...children) { const element = box('div', 'scroll-area', children); element.dataset.kind = 'list'; element.setAttribute('aria-label', label); return element; }
function title(name, subtitle = '') { return box('div', 'page-title', node('h1', name), node('p', subtitle)); }
const normalized = value => String(value || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const matches = (value, query) => normalized(value).includes(normalized(query));

function customerActivity(customer, date) {
  if (customer.blocked) return 'blocked';
  if (!customer.lastPurchaseDate) return 'dormant';
  return (Date.parse(date) - Date.parse(customer.lastPurchaseDate)) / 86400000 > 90 ? 'dormant' : 'active';
}
function customers(data, params) {
  const picker = params.get('pick') === '1', query = params.get('q');
  const category = ['active', 'dormant', 'blocked'].includes(params.get('category')) ? params.get('category') : 'active';
  const rows = data.customers.filter(customer => (picker ? !customer.blocked : customerActivity(customer, data.asOf) === category) && matches(`${customer.name} ${customer.id} ${customer.city}`, query));
  const tabs = box('nav', 'tabs', ...[['active', 'Attivi'], ['dormant', 'Fermi'], ['blocked', 'Bloccati']].map(([key, label]) => {
    const tab = link(label, '/amelia3/customers?' + new URLSearchParams({category: key, q: query || ''}), category === key ? 'active' : '');
    if (category === key) tab.setAttribute('aria-current', 'page');
    return tab;
  }));
  tabs.setAttribute('aria-label', 'Categorie clienti');
  return [title(picker ? 'Seleziona il cliente' : 'Clienti Amelia3', `${data.customers.length} preparati su ${data.portfolioCount} autorizzati`),
    ...(picker ? [] : [tabs]), search('/amelia3/customers', query, picker ? {pick: '1'} : {category}),
    region('Clienti', rows.length ? rows.map(customer => {
      const badges = [node('span', customer.blocked ? 'Bloccato · non ordinabile' : 'Non bloccato', 'badge')];
      if (customerActivity(customer, data.asOf) === 'dormant') badges.push(node('span', customer.lastPurchaseDate ? 'Fermo · oltre 90 giorni' : customer.lastPurchaseDate === null ? 'Fermo · senza storico acquisti' : 'Storico da aggiornare online', 'badge warning'));
      const card = box('article', 'card list-row', box('div', 'details', node('h2', customer.name), node('p', `${customer.city} · Cod. ${customer.id}`), badges),
        box('div', 'actions', link('Scheda cliente', `/amelia3/customers/${encodeURIComponent(customer.id)}`), ...(picker ? [form('CREATE_DRAFT', { id: crypto.randomUUID(), customerId: customer.id }, '/amelia3/catalog?order_id=:id', button('Seleziona →', 'primary'))] : [])));
      card.dataset.customerCode = customer.id;
      return card;
    }) : [node('p', 'Nessun cliente per questa selezione tra i dati preparati.')])];
}
function orderRows(orders) {
  return orders.length ? orders.map(order => {
    const element = box('article', 'card list-row', box('div', '', node('h2', order.customerName), node('p', `Ordine ${order.id}`), node('p', order.status === 'DRAFT' ? 'Bozza' : 'Confermato localmente')), box('div', 'actions', node('b', money(order.netCents)), link('Apri ordine', `/amelia3/orders/${order.id}`)));
    element.dataset.orderId = order.id; return element;
  }) : [node('p', 'Nessun ordine preparato per questa selezione.')];
}
function cart(data, order, target) {
  const lines = order.lines.map(line => {
    const product = data.products.find(product => product.id === line.productId);
    const units = product ? orderableUnits(data, order.customerId, product) : [];
    const controls = [];
    if (units.length > 1) {
      const selector = node('select'); selector.name = 'payload[unit]'; selector.className = 'amelia_line_unit_js'; selector.setAttribute('aria-label', 'Unità di misura');
      for (const unit of [...new Set([line.unit, ...units])]) { const option = node('option', unit); option.value = unit; selector.append(option); }
      selector.value = line.unit;
      const help = node('p', '', 'amelia-line-help'); help.setAttribute('aria-live', 'polite');
      controls.push(box('label', 'field amelia-unit-picker', node('span', 'Unità di misura'), selector), help);
    }
    const element = box('article', 'card cart-line', node('h3', line.name), node('small', `Cod. ${line.productId} · UM ${line.unit}`),
      form('UPDATE_LINE', { orderId: order.id, lineId: line.id }, target, controls, quantity(line.quantity, product?.unitQuotes?.[line.unit]?.quantityStep, line.unit), button('Salva riga')),
      node('p', `${line.quantity} ${line.unit} × ${line.unitPrice.replace('.', ',')} € = ${money(line.lineNetCents)}`),
      form('REMOVE_LINE', { orderId: order.id, lineId: line.id }, target, button('Rimuovi', 'quiet danger')));
    element.dataset.lineId = line.id; return element;
  });
  return box('section', 'cart', box('div', 'pane-heading', node('h2', `Il tuo ordine · ${lines.length} articoli`)), region('Articoli nel carrello', lines.length ? lines : [node('p', 'Il carrello è vuoto.')]),
    box('div', 'card cart-summary', node('span', 'Totale netto · IVA esclusa'), node('h2', money(order.netCents)), node('p', 'Margine non disponibile: costi non forniti.'), box('div', 'actions', link('Vai al riepilogo →', `/amelia3/orders/${order.id}`, 'button primary'), link('Salva bozza', '/amelia3/orders?status=DRAFT'))));
}
function catalog(data, params) {
  const query = params.get('q'), order = data.orders.find(row => row.id === params.get('order_id'));
  const customer = data.customers.find(row => row.id === order?.customerId), target = '/amelia3/catalog?' + params;
  const habitual = data.habitualProducts?.[customer?.id] || [];
  const habitualTab = customer && params.get('range') !== 'all' && habitual.length > 0;
  const eligible = data.products.filter(product => !habitualTab || habitual.includes(product.id)).map(product => ({ product, units: orderableUnits(data, customer?.id, product) })).filter(row => row.units.length);
  const rows = eligible.filter(({ product }) => matches(`${product.id} ${product.name}`, query)).map(({ product, units }) => {
    const article = box('article', 'card product-card', box('div', 'product-heading', node('h2', product.name), link('Scheda prodotto', `/amelia3/catalog/${encodeURIComponent(product.id)}`, '')),
      node('p', `Cod. ${product.id}`, 'meta'));
    if (units.length > 1) {
      const selector = node('select'); selector.className = 'amelia_unit_select_js'; selector.setAttribute('aria-label', 'Unità di misura');
      for (const unit of units) { const option = node('option', unit); option.value = unit; selector.append(option); }
      article.append(box('label', 'field amelia-unit-picker', node('span', 'Unità di misura'), selector));
    } else article.append(node('p', `Unità di misura: ${units[0]}`, 'amelia-unit-fixed'));
    for (const unit of units) {
      const terms = product.unitQuotes[unit]; let reason = terms.reason, price;
      try { price = priceFor(data, customer?.id, product, undefined, unit); } catch (error) { reason = error.message; }
      const option = box('div', 'amelia-unit-option', node('b', unit),
        node('p', reason || `Disponibili ${terms.maxQuantity} ${unit}`, `badge ${reason ? 'warning' : 'success'}`));
      option.dataset.unit = unit;
      option.hidden = unit !== units[0];
      option.append(node('p', `Ordine in ${unit} · Listino in €/ ${terms.priceUnit} · Giacenza di riferimento in ${terms.stockUnit}`, 'meta'));
      if (price) option.append(node('b', `Prezzo per ${terms.quantityStep === 'any' ? '1' : terms.quantityStep} ${unit}: ${money(lineCents(terms.quantityStep === 'any' ? '1' : terms.quantityStep, price.amount))}`));
      if (order?.status === 'DRAFT') option.append(form('ADD_LINE', { orderId: order.id, productId: product.id, lineId: crypto.randomUUID(), unit }, target,
        box('div', 'product-controls', quantity(terms.quantityStep === 'any' ? '' : terms.quantityStep, terms.quantityStep, unit), button('+ Aggiungi', 'primary', !!reason || customer?.blocked))));
      article.append(option);
    }
    article.dataset.productCode = product.id; return article;
  });
  return [title(order ? 'Cerca e aggiungi prodotti' : 'Catalogo Amelia3', `${eligible.length} prodotti ordinabili tra quelli preparati sul dispositivo. Solo unità con prezzo e disponibilità verificati.`),
    ...(customer ? [box('div', 'customer-strip', node('b', customer.name), link('Scheda cliente', `/amelia3/customers/${encodeURIComponent(customer.id)}`, ''))] : []),
    ...(customer ? [box('nav', 'tabs', link('Prodotti abituali', `/amelia3/catalog?order_id=${order.id}&range=habitual`, habitualTab ? 'active' : ''), link('Intero catalogo', `/amelia3/catalog?order_id=${order.id}&range=all`, !habitualTab ? 'active' : '')), node('p', habitual.length ? 'Prodotti abituali degli ultimi sei mesi, tra quelli salvati sul dispositivo.' : 'Nessun elenco abituale disponibile: cerca nel catalogo salvato.', 'meta')] : []),
    box('div', order ? 'grid editor workspace-split' : '', box('section', 'pane', search('/amelia3/catalog', query, order ? { order_id: order.id, range: habitualTab ? 'habitual' : 'all' } : {}), region('Lista prodotti', rows.length ? rows : [node('p', 'Nessun risultato nei prodotti preparati. La ricerca per sinonimi richiede la connessione.')])), ...(order ? [cart(data, order, target)] : []))];
}
function review(data, order) {
  if (order.status !== 'DRAFT') return [title('Riepilogo ordine', 'Confermato localmente'), node('h2', order.customerName), node('p', order.note), node('p', `Totale netto ${money(order.netCents)} · nessun invio al gestionale`), region('Articoli confermati', order.lines.map(line => box('article', 'card', node('h3', line.name), node('p', `${line.quantity} ${line.unit} · ${money(line.lineNetCents)}`))))];
  const destinations = data.customers.filter(customer => customer.deliveryPoint && !customer.blocked && (customer.id === order.customerId || customer.parentCode === order.customerId));
  const select = node('select'); select.name = 'payload[destinationId]'; select.required = true;
  destinations.forEach(customer => { const option = node('option', customer.name); option.value = customer.id; option.selected = customer.id === order.destinationId; select.append(option); });
  const confirm = button('Conferma ordine locale', 'primary', !order.lines.length); confirm.name = 'next_command'; confirm.value = 'CONFIRM_ORDER';
  const date = field('Data consegna', 'deliveryDate', order.deliveryDate, 'date'); date.querySelector('input').required = true;
  const deletion = form('DELETE_DRAFT', { orderId: order.id }, '/amelia3/orders', button('Elimina bozza', 'quiet danger')); deletion.querySelector('button').dataset.confirmMessage = 'Eliminare questa bozza?';
  return [title('Riepilogo ordine', order.customerName), form('SAVE_REVIEW', { orderId: order.id }, `/amelia3/orders/${order.id}`,
    box('div', 'grid two review-layout workspace-split', box('section', 'card pane', node('h2', 'Articoli'), region('Articoli riepilogo', order.lines.map(line => box('article', 'summary-line', node('h3', line.name), node('p', `${line.quantity} ${line.unit} · ${money(line.lineNetCents)}`)))), field('Nota sul documento di consegna', 'note', order.note, 'textarea')),
      box('section', 'card pane', node('h2', 'Consegna e pagamento'), box('label', 'field', node('span', 'Destinazione'), select), date, field('Indicazione pagamento (locale)', 'paymentNote', order.paymentNote))),
    box('div', 'action-bar', node('h2', `Totale netto ${money(order.netCents)}`), box('div', 'actions', link('Modifica articoli', `/amelia3/catalog?order_id=${order.id}`), button('Salva bozza'), confirm))), deletion];
}
function customerPage(data, id, params) {
  const customer = data.customers.find(row => row.id === id);
  if (!customer) return [title('Cliente non preparato'), node('p', 'Collegati al server per consultare gli altri clienti autorizzati.')];
  const tab = params.get('tab') || 'details';
  const content = tab === 'details' ? box('section', 'card', node('h2', 'Anagrafica preparata'), node('p', customer.address), node('p', customer.taxId), node('p', customer.email), node('p', customer.telephone), node('p', customer.blocked ? 'Cliente bloccato · non ordinabile' : 'Cliente non bloccato')) : tab === 'orders' ? box('section', '', link('Ordini storici', `/amelia3/history?customer_id=${encodeURIComponent(id)}`), region('Ordini cliente preparati', orderRows(data.orders.filter(order => order.customerId === id)))) : node('p', 'Questa scheda richiede connessione al server.');
  return [title(customer.name, `Cod. ${customer.id} · ${customer.city}`), ...(customer.reactivation ? [node('p', `Da riattivare · Ultimo acquisto registrato: ${customer.reactivation.lastDelivery}`, 'badge warning')] : []), box('nav', 'tabs', ...['Anagrafica', 'Ordini', 'Partite aperte', 'Info commerciali'].map((label, index) => { const key = ['details', 'orders', 'open_items', 'commercial'][index]; return link(label, `/amelia3/customers/${encodeURIComponent(id)}?tab=${key}`, key === tab ? 'active' : ''); })), content];
}

export function renderOffline(snapshot) {
  const data = snapshot.state.data, url = new URL(location.href), path = url.pathname, params = url.searchParams;
  let children;
  if (path === '/amelia3' || path === '/amelia3/') children = [title('Home Amelia3', 'Dati preparati sul dispositivo'),
    box('div', 'grid two home-primary', link('Inserisci nuovo ordine →', '/amelia3/customers?pick=1', 'card hero-card'), link('Ordini locali →', '/amelia3/orders', 'card hero-card')),
    box('div', 'grid home-links', link('Clienti', '/amelia3/customers', 'card navigation-card'), link('Catalogo', '/amelia3/catalog', 'card navigation-card'))];
  else if (path === '/amelia3/order_center') children = [title('Ordini'), box('nav', 'amelia-order-center', link('I miei ordini', '/amelia3/orders', 'card navigation-card'), link('Ordini da leggere', '/amelia3/whatsapp', 'card navigation-card'), link('Alert di vendita', '/amelia3/alerts', 'card navigation-card'))];
  else if (path.startsWith('/amelia3/whatsapp')) children = [title('Ordini da leggere'), node('p', 'Collegati al server per leggere e rivedere gli ordini ricevuti. Il contatore mostra l’ultimo dato disponibile.')];
  else if (path === '/amelia3/customers') children = customers(data, params);
  else if (path.startsWith('/amelia3/customers/')) children = customerPage(data, decodeURIComponent(path.split('/')[3]), params);
  else if (path === '/amelia3/catalog') children = catalog(data, params);
  else if (path.startsWith('/amelia3/catalog/')) {
    const product = data.products.find(row => row.id === decodeURIComponent(path.split('/')[3]));
    children = product ? [title(product.name, `Cod. ${product.id}`), node('p', `UM ordinabili ${product.orderableUms.join(', ')}`), ...product.orderableUms.map(unit => node('p', `${unit}: ${product.unitQuotes[unit].reason || 'Quotazione verificata'}`)), ...Object.entries(product.stocks).map(([unit, value]) => node('p', `Esistenza ${unit}: ${value ?? 'non fornita'}`))] : [title('Prodotto non preparato')];
  } else if (path === '/amelia3/orders') {
    const status = params.get('status') || 'DRAFT', orders = data.orders.filter(order => order.status === status);
    children = [title('I miei ordini'), box('nav', 'tabs', ...[['DRAFT', 'Bozze'], ['CONFIRMED_LOCAL', 'Confermati'], ['HISTORY', 'Storico']].map(([key, label]) => link(label, `/amelia3/orders?status=${key}`, status === key ? 'active' : ''))), status === 'HISTORY' ? node('p', 'Lo storico richiede connessione al server.') : region('Ordini locali', orderRows(orders))];
  } else if (path.startsWith('/amelia3/orders/')) {
    const order = data.orders.find(row => row.id === path.split('/')[3]); children = order ? review(data, order) : [title('Ordine non preparato')];
  } else children = [title('Collegamento richiesto'), node('p', 'Storico, analisi e sincronizzazione FTP vengono interrogati sul server; clienti, catalogo e ordini preparati restano disponibili offline.')];
  return box('div', 'view', children);
}
