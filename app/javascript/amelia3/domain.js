export const COMMANDS = new Set(['CREATE_DRAFT', 'ADD_LINE', 'UPDATE_LINE', 'REMOVE_LINE', 'SAVE_REVIEW', 'CONFIRM_ORDER', 'DELETE_DRAFT']);
const MAX_CENTS = BigInt(Number.MAX_SAFE_INTEGER);
export const CONTRACT_VERSION = 'AMELIA3-QUOTE-v2';
const abs = value => value < 0n ? -value : value;
function gcd(a, b) { a = abs(a); b = abs(b); while (b) [a, b] = [b, a % b]; return a || 1n; }
function ratio(n, d = 1n) {
  if (d === 0n) throw new Error('Rapporto non valido.');
  if (d < 0n) { n = -n; d = -d; }
  const divisor = gcd(n, d); return { n: n / divisor, d: d / divisor };
}
export function exact(value) {
  if (value && typeof value === 'object') {
    if (!/^-?\d{1,100}$/.test(String(value.n)) || !/^\d{1,100}$/.test(String(value.d))) throw new Error('Rapporto non valido.');
    return ratio(BigInt(value.n), BigInt(value.d));
  }
  const text = String(value ?? '');
  if (!/^-?\d+(?:\.\d{1,12})?$/.test(text)) throw new Error('Valore decimale non valido.');
  const digits = text.replace('-', ''), [whole, fraction = ''] = digits.split('.'), factor = 10n ** BigInt(fraction.length);
  return ratio((BigInt(whole) * factor + BigInt(fraction || '0')) * (text.startsWith('-') ? -1n : 1n), factor);
}
export const fractionData = value => ({ n: exact(value).n.toString(), d: exact(value).d.toString() });
const mul = (a, b) => ratio(a.n * b.n, a.d * b.d);
const div = (a, b) => ratio(a.n * b.d, a.d * b.n);
const sum = (a, b) => ratio(a.n * b.d + b.n * a.d, a.d * b.d);
const greater = (a, b) => a.n * b.d > b.n * a.d;
const equal = (a, b) => a.n * b.d === b.n * a.d;

export function decimalText(value) {
  const r = exact(value), scale = 1000000000000n;
  const scaled = (abs(r.n) * scale * 2n + r.d) / (r.d * 2n);
  const fraction = String(scaled % scale).padStart(12, '0').replace(/0+$/, '');
  return (r.n < 0n ? '-' : '') + String(scaled / scale) + (fraction ? '.' + fraction : '.0');
}
export function stepQuantity(value, step, direction) {
  const minimum = exact(step === 'any' ? '0' : step), increment = exact(step === 'any' ? '1' : step), next = sum(exact(value || '0'), mul(increment, exact(direction)));
  return decimalText(greater(minimum, next) ? minimum : greater(next, exact('100000')) ? exact('100000') : next);
}

export function romeDate() {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return ['year', 'month', 'day'].map(kind => parts.find(part => part.type === kind).value).join('-');
}

export function priceFor(data, customerId, product, date = romeDate(), unit = product?.preferredUm) {
  const terms = product?.unitQuotes?.[unit];
  if (!terms || terms.contractVersion !== CONTRACT_VERSION) throw new Error('Collegati per aggiornare il contratto delle unità.');
  if (product.blocked) throw new Error('Articolo bloccato.');
  if (data.customers.find(customer => customer.id === customerId)?.blocked) throw new Error('Cliente bloccato.');
  const assignedList = data.customers.find(customer => customer.id === customerId)?.assignedListCode;
  if (assignedList && assignedList !== '000') throw new Error(`Listino cliente ${assignedList}: applicazione del prezzo da verificare`);
  if (terms.reason || !product.basePriceMicros) throw new Error(terms.reason || 'Prezzo base non disponibile.');
  const matches = data.customerConditions.filter(row => row.customerId === customerId && row.productId === product.id && row.validFrom <= date && row.validTo >= date);
  if (matches.length > 1) throw new Error('Condizioni sovrapposte: prezzo non attestato.');
  const condition = matches[0];
  if (condition?.unavailableReason) throw new Error(condition.unavailableReason);
  const base = BigInt(condition?.priceMicros || product.basePriceMicros);
  const discount = BigInt(condition?.discountUnits || '0');
  if (base <= 0n || discount < 0n || discount >= 1000000n || condition?.priceMicros && discount > 0n) throw new Error('Personalizzazione prezzo non valida.');
  const factor = condition?.priceMicros ? terms.personalPriceFactor : terms.priceFactor;
  if (!factor) throw new Error('Unità del prezzo personalizzato non attestata.');
  return { amount: mul(ratio(base * (1000000n - discount), 1000000000000n), exact(factor)), condition, terms };
}

export function orderableUnits(data, customerId, product, date = romeDate()) {
  const name = String(product.name || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  if (product.catalogExcluded || /^(?:(?:DS|OM)\s+)?(?:ARTICOL[OI]|ART|PRODOTT[OI]|MERCE|MERCI)\s+(?:VARI[OAIE]?|GENERIC[OAIE]|GENERICHE|DIVERS[OAIE])\b/.test(name)) return [];
  return (product.orderableUms || []).filter(unit => {
    try { priceFor(data, customerId, product, date, unit); return true; }
    catch { return false; }
  });
}

export function lineCents(quantity, amount) {
  const value = mul(mul(exact(quantity), exact(amount)), exact('100'));
  if (value.n < 0n) throw new Error('Importo fuori intervallo.');
  const cents = (value.n * 2n + value.d) / (value.d * 2n);
  if (cents > MAX_CENTS) throw new Error('Importo fuori intervallo.');
  return Number(cents);
}

function validateProduct(data, customerId, productId, quantity, excluding, order, unit) {
  const customer = data.customers.find(row => row.id === customerId);
  if (!customer || customer.blocked) throw new Error('Cliente bloccato o non preparato sul dispositivo.');
  const product = data.products.find(row => row.id === productId);
  if (!product || product.blocked || !product.orderableUms?.includes(unit)) throw new Error('Articolo o UM non ordinabile.');
  const price = priceFor(data, customerId, product, romeDate(), unit), terms = price.terms;
  const count = exact(quantity), step = terms.quantityStep === 'any' ? null : exact(terms.quantityStep);
  const existing = order.lines.filter(line => line.productId === productId && line.id !== excluding).reduce((total, line) => {
    const other = product.unitQuotes[line.unit]; validateSaved(line, other);
    if (other.stockUnit !== terms.stockUnit) throw new Error('Giacenze delle due UM non confrontabili.');
    return sum(total, mul(div(exact(line.quantity), exact(other.stockFactor)), exact(terms.stockFactor)));
  }, exact('0'));
  if (count.n <= 0n || greater(count, exact('100000')) || step && (step.n <= 0n || div(count, step).d !== 1n) || greater(sum(count, existing), exact(terms.available))) throw new Error('Quantità non valida per divisibilità o disponibilità attestata.');
  return { product, price, count };
}

function validateSaved(line, terms) {
  if (!terms || line.priceSnapshot?.conversionVersion !== terms.conversionVersion) throw new Error('Regole UM aggiornate: copia locale conservata, verifica la conversione.');
}

export function projectCommand(state, command) {
  if (state.datasetMode !== 'amelia3' || !COMMANDS.has(command.type)) throw new Error('Operazione non consentita nel dataset corrente.');
  const next = structuredClone(state), data = next.data, payload = command.payload;
  if (command.type === 'CREATE_DRAFT') {
    const customer = data.customers.find(row => row.id === payload.customerId);
    if (!customer || customer.blocked) throw new Error('Cliente bloccato o non preparato.');
    if (data.orders.some(row => row.id === payload.id)) throw new Error('Ordine già presente.');
    if (data.orders.filter(row => row.status === 'DRAFT').length >= 20) throw new Error('Sincronizza e completa le bozze preparate prima di crearne altre offline.');
    const tomorrow = new Date(romeDate() + 'T12:00:00Z'); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const destination = data.customers.find(row => row.deliveryPoint && !row.blocked && (row.id === customer.id || row.parentCode === customer.id));
    data.orders.unshift({ id: payload.id, customerId: customer.id, customerName: customer.name, agentCode: customer.agentCode,
      status: 'DRAFT', version: 0, lines: [], destinationId: destination?.id || null, deliveryDate: tomorrow.toISOString().slice(0, 10), note: '', paymentNote: '', netCents: 0 });
    return next;
  }
  const order = data.orders.find(row => row.id === payload.orderId);
  if (!order || order.status !== 'DRAFT' || order.version !== payload.expectedVersion) throw new Error('Ordine non modificabile o versione locale non valida.');
  const customer = data.customers.find(row => row.id === order.customerId);
  if (!customer || customer.blocked && !['REMOVE_LINE', 'DELETE_DRAFT'].includes(command.type)) throw new Error('Cliente bloccato o fuori portafoglio.');
  const line = order.lines.find(row => row.id === payload.lineId);
  switch (command.type) {
    case 'ADD_LINE': {
      if (line || order.lines.length >= 100) throw new Error('Riga duplicata o limite articoli raggiunto.');
      const { product, price, count } = validateProduct(data, customer.id, payload.productId, payload.quantity, null, order, payload.unit);
      if (payload.expectedConversionVersion !== price.terms.conversionVersion) throw new Error('Contratto UM aggiornato: verifica la proposta locale.');
      if (!equal(exact(payload.expectedExactPrice || payload.expectedUnitPrice), price.amount)) throw new Error('Il prezzo è cambiato. Verifica la proposta locale.');
      order.lines.push({ id: payload.lineId, productId: product.id, name: product.name, unit: payload.unit, quantity: decimalText(count),
        unitPrice: decimalText(price.amount), exactUnitPrice: fractionData(price.amount), lineNetCents: lineCents(count, price.amount),
        priceSnapshot: { ...structuredClone(price.terms), batchId: data.batchId, batchFingerprint: data.batchFingerprint, listCode: '000',
          basePrice: decimalText(ratio(BigInt(product.basePriceMicros), 1000000n)), discount: decimalText(ratio(BigInt(price.condition?.discountUnits || '0'), 10000n)), conditionRow: price.condition?.id || null } });
      break;
    }
    case 'UPDATE_LINE': {
      if (!line) throw new Error('Riga non trovata.');
      validateSaved(line, data.products.find(product => product.id === line.productId)?.unitQuotes?.[line.unit]);
      validateProduct(data, customer.id, line.productId, payload.quantity, line.id, order, line.unit);
      line.quantity = decimalText(exact(payload.quantity)); line.lineNetCents = lineCents(payload.quantity, exact(line.exactUnitPrice));
      break;
    }
    case 'REMOVE_LINE':
      if (!line) throw new Error('Riga non trovata.');
      order.lines = order.lines.filter(row => row.id !== payload.lineId); break;
    case 'SAVE_REVIEW': {
      const destination = data.customers.find(row => row.id === payload.destinationId);
      if (!destination?.deliveryPoint || destination.blocked || destination.id !== customer.id && destination.parentCode !== customer.id) throw new Error('Punto di consegna non autorizzato.');
      const date = String(payload.deliveryDate || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) !== date || date < romeDate()) throw new Error('Data consegna non valida.');
      if (String(payload.note || '').length > 2000 || String(payload.paymentNote || '').length > 200) throw new Error('Nota troppo lunga.');
      Object.assign(order, { destinationId: destination.id, deliveryDate: date, note: payload.note || '', paymentNote: payload.paymentNote || '' }); break;
    }
    case 'CONFIRM_ORDER': {
      if (!order.lines.length || order.deliveryDate < romeDate()) throw new Error('Aggiungi articoli e verifica la consegna.');
      const destination = data.customers.find(row => row.id === order.destinationId);
      if (!destination?.deliveryPoint || destination.blocked || destination.id !== customer.id && destination.parentCode !== customer.id) throw new Error('Punto di consegna non autorizzato.');
      order.lines.forEach(row => {
        validateSaved(row, data.products.find(product => product.id === row.productId)?.unitQuotes?.[row.unit]);
        validateProduct(data, customer.id, row.productId, row.quantity, row.id, order, row.unit);
      });
      order.status = 'CONFIRMED_LOCAL'; order.confirmedAt = new Date().toISOString(); break;
    }
    case 'DELETE_DRAFT':
      data.orders = data.orders.filter(row => row.id !== order.id); return next;
  }
  order.version += 1;
  order.netCents = order.lines.reduce((sum, row) => sum + row.lineNetCents, 0);
  if (!Number.isSafeInteger(order.netCents)) throw new Error('Totale fuori intervallo.');
  return next;
}

export function mergeSnapshot(snapshot, previous, outbox) {
  if (snapshot.state.data.batchId !== previous.state.data.batchId || snapshot.state.data.verificationVersion !== previous.state.data.verificationVersion) return snapshot;
  const result = structuredClone(snapshot), data = result.state.data;
  const ids = new Set(outbox.map(command => command.payload.orderId).filter(Boolean));
  previous.state.data.orders.filter(order => ids.has(order.id) && !data.orders.some(row => row.id === order.id)).forEach(order => {
    data.orders.push(order);
  });
  const customers = new Set(outbox.map(command => command.payload.customerId).filter(Boolean));
  const products = new Set(outbox.map(command => command.payload.productId).filter(Boolean));
  data.orders.filter(order => ids.has(order.id)).forEach(order => {
    customers.add(order.customerId); if (order.destinationId) customers.add(order.destinationId);
    order.lines.forEach(line => products.add(line.productId));
  });
  for (const [key, needed, limit] of [['customers', customers, 100], ['products', products, 500]]) {
    const retained = previous.state.data[key].filter(row => needed.has(row.id) && !data[key].some(current => current.id === row.id));
    const combined = [...retained, ...data[key]];
    data[key] = [...combined.filter(row => needed.has(row.id)), ...combined.filter(row => !needed.has(row.id))].slice(0, limit);
  }
  const customerIds = new Set(data.customers.map(row => row.id)), productIds = new Set(data.products.map(row => row.id));
  const conditionIds = new Set(data.customerConditions.map(row => row.id));
  data.customerConditions.push(...previous.state.data.customerConditions.filter(row => customerIds.has(row.customerId) && productIds.has(row.productId) && !conditionIds.has(row.id)));
  return result;
}

export function reconcileRecord(record, snapshot) {
  const previous = record.projected?.data, incoming = snapshot.state.data;
  const changed = previous && (previous.quoteContractVersion !== incoming.quoteContractVersion || previous.verificationVersion !== incoming.verificationVersion);
  if (record.outbox.length && changed || record.outbox.some(command => command.payload.batchId !== incoming.batchId)) {
    record.conflict = { kind: 'dataset', message: 'Il catalogo è stato aggiornato. Prezzi e modifiche locali sono conservati: verifica la copia prima di usare i dati nuovi.',
      server: snapshot, recordedAt: new Date().toISOString() };
    return;
  }
  record.projected = record.outbox.reduce(projectCommand, record.server.state);
}
