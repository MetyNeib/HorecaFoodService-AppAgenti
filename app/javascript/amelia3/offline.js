import { priceFor, lineCents } from 'amelia3/domain';
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
function quantity(value, step = 1) {
  const label = field('Quantità (P)', 'quantity', value, 'number'), input = label.querySelector('input');
  input.min = step; input.step = step; input.max = 100000; input.required = true;
  input.className = 'quantity_input_js amelia_quantity_js'; input.setAttribute('aria-label', 'Quantità');
  const minus = button('−', 'quantity_step_js'), plus = button('+', 'quantity_step_js');
  minus.type = plus.type = 'button'; minus.dataset.direction = '-1'; plus.dataset.direction = '1';
  minus.setAttribute('aria-label', 'Riduci quantità'); plus.setAttribute('aria-label', 'Aumenta quantità');
  const controls = box('span', 'stepper-input', minus, input, plus); label.append(controls);
  return box('div', 'quantity quantity_js', label, box('span', 'field', node('span', 'UM'), node('b', 'P')));
}
function search(path, value, extras = {}) {
  const input = node('input'); input.type = 'search'; input.name = 'q'; input.value = value || ''; input.placeholder = 'Nome o codice';
  const element = box('form', 'filters amelia_search_form_js', box('label', 'field search', node('span', 'Cerca nei dati preparati'), input), button('Cerca'));
  element.method = 'get'; element.action = path;
  Object.entries(extras).forEach(([key, value]) => { const input = node('input'); input.type = 'hidden'; input.name = key; input.value = value; element.append(input); });
  return element;
}
function region(label, ...children) { const element = box('div', 'scroll-area', children); element.dataset.kind = 'list'; element.setAttribute('aria-label', label); return element; }
function nav(role) {
  const element = box('nav', 'amelia-nav', ...[['Home', '/amelia3'], ['Clienti', '/amelia3/customers'], ['Catalogo', '/amelia3/catalog'], ['Ordini locali', '/amelia3/orders'], ['Storico', '/amelia3/history'], ['Analisi acquisti', '/amelia3/insights']].map(([label, path]) => link(label, path, '')));
  if (role === 'admin') element.append(link('Sincronizzazione dati', '/amelia3/sync', '')); return element;
}
function title(name, subtitle = '') { return box('div', 'page-title', node('h1', name), node('p', subtitle)); }
const normalized = value => String(value || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const matches = (value, query) => normalized(value).includes(normalized(query));

function customers(data, params) {
  const picker = params.get('pick') === '1', query = params.get('q');
  const rows = data.customers.filter(customer => matches(`${customer.name} ${customer.id} ${customer.city}`, query));
  return [title(picker ? 'Seleziona il cliente' : 'Clienti Amelia3', `${data.customers.length} preparati su ${data.portfolioCount} autorizzati`),
    search('/amelia3/customers', query, { pick: picker ? '1' : '' }),
    region('Clienti', rows.map(customer => box('article', 'card list-row', box('div', 'details', node('h2', customer.name), node('p', `${customer.city} · Cod. ${customer.id}`), node('span', customer.blocked ? 'Bloccato · non ordinabile' : 'Non bloccato', 'badge')),
      box('div', 'actions', link('Scheda cliente', `/amelia3/customers/${encodeURIComponent(customer.id)}`), ...(picker ? [form('CREATE_DRAFT', { id: crypto.randomUUID(), customerId: customer.id }, '/amelia3/catalog?order_id=:id', button('Seleziona →', 'primary', customer.blocked))] : [])))) )];
}
function orderRows(orders) {
  return orders.length ? orders.map(order => {
    const element = box('article', 'card list-row', box('div', '', node('h2', order.customerName), node('p', `Ordine ${order.id}`), node('p', order.status === 'DRAFT' ? 'Bozza' : 'Confermato localmente')), box('div', 'actions', node('b', money(order.netCents)), link('Apri ordine', `/amelia3/orders/${order.id}`)));
    element.dataset.orderId = order.id; return element;
  }) : [node('p', 'Nessun ordine preparato per questa selezione.')];
}
function cart(data, order, target) {
  const lines = order.lines.map(line => {
    const element = box('article', 'card cart-line', node('h3', line.name), node('small', `Cod. ${line.productId} · UM ${line.unit}`),
      form('UPDATE_LINE', { orderId: order.id, lineId: line.id }, target, quantity(line.quantity, data.products.find(product => product.id === line.productId)?.quantityStep || 1), button('Salva quantità')),
      node('p', `${line.quantity} P × ${line.unitPrice.replace('.', ',')} € = ${money(line.lineNetCents)}`),
      form('REMOVE_LINE', { orderId: order.id, lineId: line.id }, target, button('Rimuovi', 'quiet danger')));
    element.dataset.lineId = line.id; return element;
  });
  return box('section', 'cart', box('div', 'pane-heading', node('h2', `Il tuo ordine · ${lines.length} articoli`)), region('Articoli nel carrello', lines.length ? lines : [node('p', 'Il carrello è vuoto.')]),
    box('div', 'card cart-summary', node('span', 'Totale netto · IVA esclusa'), node('h2', money(order.netCents)), node('p', 'Margine non disponibile: costi non forniti.'), box('div', 'actions', link('Vai al riepilogo →', `/amelia3/orders/${order.id}`, 'button primary'), link('Salva bozza', '/amelia3/orders?status=DRAFT'))));
}
function catalog(data, params) {
  const query = params.get('q'), order = data.orders.find(row => row.id === params.get('order_id'));
  const customer = data.customers.find(row => row.id === order?.customerId), target = '/amelia3/catalog?' + params;
  const rows = data.products.filter(product => matches(`${product.id} ${product.name}`, query)).map(product => {
    let reason = product.unavailableReason, price;
    try { price = priceFor(data, customer?.id, product); } catch (error) { reason = error.message; }
    const article = box('article', 'card product-card', box('div', 'product-heading', node('h2', product.name), link('Scheda prodotto', `/amelia3/catalog/${encodeURIComponent(product.id)}`, '')),
      node('p', `Cod. ${product.id} · UM ${product.unit} · UM ordine ${product.orderUnit}`, 'meta'),
      node('p', reason || `Disponibili ${product.stockPieces} P`, `badge ${reason ? 'warning' : 'success'}`));
    if (price) article.append(node('b', `Prezzo per ${product.quantityStep} P: ${money(lineCents(product.quantityStep, price.amount))}`));
    if (order?.status === 'DRAFT') article.append(form('ADD_LINE', { orderId: order.id, productId: product.id, lineId: crypto.randomUUID() }, target,
      box('div', 'product-controls', quantity(product.quantityStep || 1, product.quantityStep || 1), button('+ Aggiungi', 'primary', !!reason || customer?.blocked))));
    article.dataset.productCode = product.id; return article;
  });
  return [title(order ? 'Cerca e aggiungi prodotti' : 'Catalogo Amelia3', `${data.products.length} prodotti preparati su ${data.catalogCount}`),
    ...(customer ? [box('div', 'customer-strip', node('b', customer.name), link('Scheda cliente', `/amelia3/customers/${encodeURIComponent(customer.id)}`, ''))] : []),
    box('div', order ? 'grid editor workspace-split' : '', box('section', 'pane', search('/amelia3/catalog', query, order ? { order_id: order.id } : {}), region('Lista prodotti', rows.length ? rows : [node('p', 'Nessun risultato nei prodotti preparati.')])), ...(order ? [cart(data, order, target)] : []))];
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
    box('div', 'grid two review-layout workspace-split', box('section', 'card pane', node('h2', 'Articoli'), region('Articoli riepilogo', order.lines.map(line => box('article', 'summary-line', node('h3', line.name), node('p', `${line.quantity} P · ${money(line.lineNetCents)}`)))), field('Nota sul documento di consegna', 'note', order.note, 'textarea')),
      box('section', 'card pane', node('h2', 'Consegna e pagamento'), box('label', 'field', node('span', 'Destinazione'), select), date, field('Indicazione pagamento (locale)', 'paymentNote', order.paymentNote))),
    box('div', 'action-bar', node('h2', `Totale netto ${money(order.netCents)}`), box('div', 'actions', link('Modifica articoli', `/amelia3/catalog?order_id=${order.id}`), button('Salva bozza'), confirm))), deletion];
}
function customerPage(data, id) {
  const customer = data.customers.find(row => row.id === id);
  if (!customer) return [title('Cliente non preparato'), node('p', 'Collegati al server per consultare gli altri clienti autorizzati.')];
  return [title(customer.name, `Cod. ${customer.id} · ${customer.city}`), box('nav', 'tabs', ...['Anagrafica', 'Ordini', 'Partite aperte', 'Info commerciali'].map((label, index) => link(label, `/amelia3/customers/${encodeURIComponent(id)}?tab=${['details', 'orders', 'open_items', 'commercial'][index]}`, ''))),
    box('section', 'card', node('h2', 'Anagrafica preparata'), node('p', customer.address), node('p', customer.taxId), node('p', customer.email), node('p', customer.telephone), node('p', customer.blocked ? 'Cliente bloccato · non ordinabile' : 'Cliente non bloccato')),
    region('Ordini cliente preparati', orderRows(data.orders.filter(order => order.customerId === id))), node('p', 'Partite, credito, giri e analisi richiedono il collegamento al server.')];
}

export function renderOffline(snapshot) {
  const data = snapshot.state.data, url = new URL(location.href), path = url.pathname, params = url.searchParams;
  let children;
  if (path === '/amelia3' || path === '/amelia3/') children = [title('Home Amelia3', 'Dati preparati sul dispositivo'),
    box('div', 'grid two home-primary', link('Inserisci nuovo ordine →', '/amelia3/customers?pick=1', 'card hero-card'), link('Ordini locali →', '/amelia3/orders', 'card hero-card')),
    box('div', 'grid home-links', link('Clienti', '/amelia3/customers', 'card navigation-card'), link('Catalogo', '/amelia3/catalog', 'card navigation-card'))];
  else if (path === '/amelia3/customers') children = customers(data, params);
  else if (path.startsWith('/amelia3/customers/')) children = customerPage(data, decodeURIComponent(path.split('/')[3]));
  else if (path === '/amelia3/catalog') children = catalog(data, params);
  else if (path.startsWith('/amelia3/catalog/')) {
    const product = data.products.find(row => row.id === decodeURIComponent(path.split('/')[3]));
    children = product ? [title(product.name, `Cod. ${product.id}`), node('p', `UM base ${product.unit} · UM ordine ${product.orderUnit}`), node('p', product.unavailableReason || 'Ordinabilità nell’UM P'), ...Object.entries(product.stocks).map(([unit, value]) => node('p', `Esistenza ${unit}: ${value ?? 'non fornita'}`))] : [title('Prodotto non preparato')];
  } else if (path === '/amelia3/orders') {
    const orders = data.orders.filter(order => !params.get('status') || order.status === params.get('status'));
    children = [title('Ordini locali Amelia3'), region('Ordini locali', orderRows(orders))];
  } else if (path.startsWith('/amelia3/orders/')) {
    const order = data.orders.find(row => row.id === path.split('/')[3]); children = order ? review(data, order) : [title('Ordine non preparato')];
  } else children = [title('Collegamento richiesto'), node('p', 'Storico, analisi e sincronizzazione FTP vengono interrogati sul server; clienti, catalogo e ordini preparati restano disponibili offline.')];
  return box('div', 'view', nav(snapshot.user.role), children);
}
