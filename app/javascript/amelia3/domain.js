export const COMMANDS = new Set(['CREATE_DRAFT', 'ADD_LINE', 'UPDATE_LINE', 'REMOVE_LINE', 'SAVE_REVIEW', 'CONFIRM_ORDER', 'DELETE_DRAFT']);
const MAX_CENTS = BigInt(Number.MAX_SAFE_INTEGER);
const DIVISOR = 1000000000000n;

export function integer(value) {
  const text = String(value ?? '');
  if (!/^\d+(?:\.0+)?$/.test(text)) throw new Error('Inserisci una quantità intera nell’UM P.');
  return BigInt(text.split('.')[0]);
}

function decimal(value) {
  const text = String(value ?? '');
  if (!/^\d+(?:\.\d{1,12})?$/.test(text)) throw new Error('Prezzo non valido.');
  const [whole, fraction = ''] = text.split('.');
  return BigInt(whole) * DIVISOR + BigInt(fraction.padEnd(12, '0'));
}

export function decimalText(value) {
  const whole = value / DIVISOR;
  const fraction = String(value % DIVISOR).padStart(12, '0').replace(/0+$/, '');
  return String(whole) + (fraction ? '.' + fraction : '.0');
}

export function romeDate() {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return ['year', 'month', 'day'].map(kind => parts.find(part => part.type === kind).value).join('-');
}

export function priceFor(data, customerId, product, date = romeDate()) {
  if (product.unavailableReason || !product.basePriceMicros) throw new Error(product.unavailableReason || 'Prezzo base non disponibile.');
  const matches = data.customerConditions.filter(row => row.customerId === customerId && row.productId === product.id && row.validFrom <= date && row.validTo >= date);
  if (matches.length > 1) throw new Error('Condizioni sovrapposte: prezzo non attestato.');
  const condition = matches[0];
  if (condition?.unavailableReason) throw new Error(condition.unavailableReason);
  const base = BigInt(condition?.priceMicros || product.basePriceMicros);
  const discount = BigInt(condition?.discountUnits || '0');
  if (base <= 0n || discount < 0n || discount >= 1000000n || condition?.priceMicros && discount > 0n) throw new Error('Personalizzazione prezzo non valida.');
  return { amount: base * (1000000n - discount), condition };
}

export function lineCents(quantity, amount) {
  const cents = (integer(quantity) * amount + 5000000000n) / 10000000000n;
  if (cents > MAX_CENTS) throw new Error('Importo fuori intervallo.');
  return Number(cents);
}

function validateProduct(data, customerId, productId, quantity, excluding, order) {
  const customer = data.customers.find(row => row.id === customerId);
  if (!customer || customer.blocked) throw new Error('Cliente bloccato o non preparato sul dispositivo.');
  const product = data.products.find(row => row.id === productId);
  if (!product || product.blocked || product.unit !== 'P' || product.orderUnit !== 'P') throw new Error('Articolo o UM non ordinabile.');
  const price = priceFor(data, customerId, product);
  const count = integer(quantity), step = BigInt(product.quantityStep || 0);
  const existing = order.lines.filter(line => line.productId === productId && line.id !== excluding).reduce((sum, line) => sum + integer(line.quantity), 0n);
  if (count <= 0n || count > 100000n || step <= 0n || count % step || count + existing > integer(product.stockPieces)) throw new Error('Quantità non valida per divisibilità o disponibilità attestata.');
  return { product, price, count };
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
      const { product, price, count } = validateProduct(data, customer.id, payload.productId, payload.quantity, null, order);
      if (decimal(payload.expectedUnitPrice) !== price.amount) throw new Error('Il prezzo è cambiato. Verifica la proposta locale.');
      order.lines.push({ id: payload.lineId, productId: product.id, name: product.name, unit: 'P', quantity: String(count) + '.0',
        unitPrice: decimalText(price.amount), lineNetCents: lineCents(count, price.amount), priceSnapshot: { batchId: data.batchId, listCode: '000',
          basePrice: decimalText(BigInt(product.basePriceMicros) * 1000000n), discount: String(Number(price.condition?.discountUnits || 0) / 10000), conditionRow: price.condition?.id || null } });
      break;
    }
    case 'UPDATE_LINE': {
      if (!line) throw new Error('Riga non trovata.');
      validateProduct(data, customer.id, line.productId, payload.quantity, line.id, order);
      line.quantity = String(integer(payload.quantity)) + '.0'; line.lineNetCents = lineCents(payload.quantity, decimal(line.unitPrice));
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
      order.lines.forEach(row => validateProduct(data, customer.id, row.productId, row.quantity, row.id, order));
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
  if (snapshot.state.data.batchId !== previous.state.data.batchId) return snapshot;
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
  if (record.outbox.some(command => command.payload.batchId !== snapshot.state.data.batchId)) {
    record.conflict = { kind: 'dataset', message: 'Il catalogo è stato aggiornato. Prezzi e modifiche locali sono conservati: verifica la copia prima di usare i dati nuovi.',
      server: snapshot, recordedAt: new Date().toISOString() };
    return;
  }
  record.projected = record.outbox.reduce(projectCommand, record.server.state);
}
