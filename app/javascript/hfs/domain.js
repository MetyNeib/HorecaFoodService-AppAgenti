import { baseQuantity, lineAmounts, sumAmounts, resolvePrice, listPrice, halfUp, queueValidatedOrder } from 'hfs/core';

export const OFFLINE_COMMANDS = new Set(['CREATE_DRAFT', 'CHANGE_CUSTOMER', 'ADD_LINE', 'UPDATE_LINE', 'REMOVE_LINE', 'SAVE_REVIEW', 'DELETE_DRAFT', 'CONFIRM_ORDER']);
export const number = value => Number(String(value).replace(',', '.'));
export const boolean = value => value === true || value === 'true' || value === '1' || value === 'on';
export const money = cents => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100);
export const percent = value => value == null ? '—' : `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(value)}%`;
export const stock = (data, productId, warehouseId) => data.stocks.find(row => row.productId === productId && row.warehouseId === warehouseId)?.availableBaseQuantity ?? 0;
export const editable = order => ['DRAFT', 'WHATSAPP_REVIEW'].includes(order.status);
export const uid = prefix => `${prefix}-${crypto.randomUUID()}`;
export const demoClock = data => data.meta.demoClock;

export function parseCents(text) {
  const input = String(text).trim();
  if (!/^\d+([,.]\d{1,2})?$/.test(input)) throw new Error('Inserisci un prezzo valido, con massimo due decimali.');
  const [whole, decimal = ''] = input.replace(',', '.').split('.');
  const result = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  if (!Number.isSafeInteger(result)) throw new Error('Prezzo fuori intervallo.');
  return result;
}

export function nextDelivery(data, customer, destinationId = customer.defaultDestinationId) {
  const destination = data.destinations.find(item => item.id === destinationId && item.customerId === customer.id);
  const route = data.deliveryRoutes.find(item => item.id === (destination?.deliveryRouteId || customer.deliveryRouteId));
  if (!route?.weekdaysISO?.length) throw new Error('Giro di consegna non disponibile.');
  const date = new Date(demoClock(data).slice(0, 10) + 'T12:00:00Z');
  do { date.setUTCDate(date.getUTCDate() + 1); } while (!route.weekdaysISO.includes(date.getUTCDay() || 7));
  return date.toISOString().slice(0, 10);
}

export function makeOrder(data, customerId, id) {
  const customer = data.customers.find(item => item.id === customerId && item.agentId === data.demoDefaults.currentAgentId && data.demoDefaults.activeCustomerIds.includes(item.id));
  if (!customer) throw new Error('Cliente non assegnato.');
  const clock = demoClock(data);
  return { id, number: id, customerId, agentId: data.demoDefaults.currentAgentId, channel: 'AGENT', status: 'DRAFT', createdAt: clock, updatedAt: clock, sentAt: null,
    warehouseId: customer.warehouseId, destinationId: customer.defaultDestinationId, deliveryDate: nextDelivery(data, customer), deliveryTime: null,
    customerReference: '', contactId: data.contacts.find(item => item.customerId === customerId)?.id || '', paymentId: customer.defaultPaymentId,
    priceListId: customer.defaultPriceListId, note: '', noteDestination: 'DELIVERY_DOCUMENT', lines: [], totals: sumAmounts([]), synthetic: true };
}

export function calculateLine(product, line) {
  const base = baseQuantity(product, number(line.quantity), line.unit);
  const amounts = lineAmounts(base.quantity, number(line.unitPriceBaseCents), number(line.costBaseCents), boolean(line.isGift));
  return { ...line, quantity: number(line.quantity), baseQuantity: base.quantity, conversionIsEstimated: base.estimated,
    lineNetCents: amounts.netCents, lineCostCents: amounts.costCents, marginCents: amounts.marginCents, marginPercent: amounts.marginPercent };
}

export function recalculate(data, order) {
  order.totals = sumAmounts(order.lines.map(line => ({ netCents: line.lineNetCents, costCents: line.lineCostCents })));
  order.updatedAt = demoClock(data);
}

export function orderErrors(data, order) {
  const errors = [];
  const customer = data.customers.find(item => item.id === order.customerId);
  if (!customer || !data.demoDefaults.activeCustomerIds.includes(customer.id)) errors.push('Cliente non assegnato.');
  if (!order.lines.length) errors.push('Aggiungi almeno un articolo.');
  const destination = data.destinations.find(item => item.id === order.destinationId && item.customerId === order.customerId);
  if (!destination) errors.push('Seleziona una destinazione del cliente.');
  if (!data.paymentMethods.some(item => item.id === order.paymentId)) errors.push('Seleziona un pagamento valido.');
  if (!data.warehouses.some(item => item.id === order.warehouseId)) errors.push('Seleziona un deposito valido.');
  const route = data.deliveryRoutes.find(item => item.id === (destination?.deliveryRouteId || customer?.deliveryRouteId));
  if (!isIsoDay(order.deliveryDate) || order.deliveryDate <= demoClock(data).slice(0, 10) || !route?.weekdaysISO.includes(new Date(order.deliveryDate + 'T12:00:00Z').getUTCDay() || 7)) errors.push('Scegli una data successiva a oggi prevista dal giro di consegna.');
  if (data.whatsappInbox.find(item => item.orderId === order.id)?.requests.some(item => !['MATCHED', 'RESOLVED', 'EXCLUDED'].includes(item.status))) errors.push('Risolvi o escludi tutte le richieste WhatsApp online.');
  const quantities = new Map();
  for (const line of order.lines) {
    try {
      const product = data.products.find(item => item.id === line.productId);
      if (!product?.active || product.blocked) throw new Error('Articolo non ordinabile.');
      const calculated = calculateLine(product, line);
      quantities.set(line.productId, (quantities.get(line.productId) || 0) + Math.round(calculated.baseQuantity * 1000));
    } catch (error) { errors.push(error.message); }
  }
  for (const [productId, quantity] of quantities) if (quantity > Math.round(stock(data, productId, order.warehouseId) * 1000)) errors.push(`${data.products.find(item => item.id === productId)?.name}: disponibilità insufficiente.`);
  return errors;
}

const REVIEW_FIELDS = ['warehouseId', 'destinationId', 'deliveryDate', 'deliveryTime', 'customerReference', 'contactId', 'paymentId', 'note'];
const PAYLOAD_FIELDS = {
  CREATE_DRAFT: ['id', 'customerId'], CHANGE_CUSTOMER: ['orderId', 'customerId', 'confirmClear'],
  ADD_LINE: ['orderId', 'lineId', 'productId', 'quantity', 'unit'],
  UPDATE_LINE: ['orderId', 'lineId', 'quantity', 'unit', 'priceMode', 'priceListId', 'unitPriceBaseCents', 'discountBasisPoints', 'isGift', 'note', 'condition'],
  REMOVE_LINE: ['orderId', 'lineId'], DELETE_DRAFT: ['orderId'], SAVE_REVIEW: ['orderId', ...REVIEW_FIELDS], CONFIRM_ORDER: ['orderId', ...REVIEW_FIELDS]
};
function strictKeys(payload, fields) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || Object.keys(payload).some(key => !fields.includes(key))) throw new Error('Campi non modificabili.');
}
function validId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value)) throw new Error('Identificativo non valido.');
  return value;
}
function validText(value, label, max = 2000) {
  if (typeof value !== 'string' || value.length > max) throw new Error(`${label} non valido.`);
  return value;
}
function validBoolean(value) {
  if (value !== true && value !== false) throw new Error('Valore booleano richiesto.');
  return value;
}
function validInteger(value) {
  if (!Number.isSafeInteger(value)) throw new Error('Richiesto intero sicuro.');
  return value;
}
function quantityNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Quantità non valida.');
  return value;
}
function isIsoDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function conditionDay(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) || !isIsoDay(value.slice(0, 10))) throw new Error('Data non valida.');
  return value.slice(0, 10);
}
function productFor(data, id) {
  const product = data.products.find(item => item.id === id);
  if (!product?.active || product.blocked) throw new Error('Articolo non ordinabile.');
  return product;
}
function finishProjection(next) {
  if (next.network === 'ONLINE' && next.data.syncQueue.some(item => item.status === 'WAITING_NETWORK')) next.network = 'SYNCING';
  next.revision += 1;
  return next;
}
function saveReview(data, order, payload) {
  for (const key of REVIEW_FIELDS) {
    if (payload[key] === undefined) continue;
    let value = payload[key];
    if (key === 'deliveryTime') {
      if (value !== null && value !== '' && (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value))) throw new Error('Ora di consegna non valida.');
      if (value === '') value = null;
    } else {
      validText(value, key);
      if (key === 'destinationId' || key === 'contactId') {
        const list = key === 'destinationId' ? data.destinations : data.contacts;
        if (value && !list.some(item => item.id === value && item.customerId === order.customerId)) throw new Error('Destinazione o referente di un altro cliente.');
      }
      if (key === 'warehouseId' && value && !data.warehouses.some(item => item.id === value)) throw new Error('Deposito non valido.');
      if (key === 'paymentId' && value && !data.paymentMethods.some(item => item.id === value)) throw new Error('Pagamento non valido.');
      if (key === 'deliveryDate' && value && !isIsoDay(value)) throw new Error('Data non valida.');
    }
    order[key] = value;
  }
  if (payload.destinationId !== undefined && payload.deliveryDate === undefined && order.destinationId) {
    order.deliveryDate = nextDelivery(data, data.customers.find(item => item.id === order.customerId), order.destinationId);
  }
  order.updatedAt = demoClock(data);
  if (order.status === 'WHATSAPP_REVIEW') data.whatsappInbox.find(item => item.orderId === order.id).verificationSaved = true;
}

/** Pure offline projection. The server validates the same intent again on reconnection. */
export function projectCommand(state, command) {
  if (!OFFLINE_COMMANDS.has(command.type)) return structuredClone(state);
  const next = structuredClone(state);
  const data = next.data;
  const payload = command.payload;
  strictKeys(payload, PAYLOAD_FIELDS[command.type]);
  const clock = demoClock(data);
  const order = data.orders.find(item => item.id === payload.orderId);
  if (order && (order.agentId !== data.demoDefaults.currentAgentId || !data.demoDefaults.activeCustomerIds.includes(order.customerId))) throw new Error('Ordine non assegnato.');
  if (command.type === 'CONFIRM_ORDER' && order && ['PENDING_SEND', 'SENT'].includes(order.status)) return finishProjection(next);
  if (command.type !== 'CREATE_DRAFT' && (!order || !editable(order))) throw new Error('Ordine non modificabile.');
  if (command.type === 'CREATE_DRAFT') {
    validId(payload.id);
    if (data.orders.some(item => item.id === payload.id)) throw new Error('Identificativo ordine già presente.');
    data.orders.push(makeOrder(data, payload.customerId, payload.id));
  }
  if (command.type === 'CHANGE_CUSTOMER') {
    if (order.status !== 'DRAFT') throw new Error('Il cliente WhatsApp non può essere sostituito.');
    if (order.customerId === payload.customerId) return finishProjection(next);
    if (order.lines.length && payload.confirmClear !== true) throw new Error('Conferma lo svuotamento del carrello.');
    Object.assign(order, makeOrder(data, payload.customerId, order.id));
  }
  if (command.type === 'ADD_LINE') {
    const product = productFor(data, payload.productId);
    validId(payload.lineId);
    quantityNumber(payload.quantity);
    baseQuantity(product, payload.quantity, payload.unit);
    if (order.lines.some(line => line.id === payload.lineId)) throw new Error('Identificativo riga già presente.');
    const customer = data.customers.find(item => item.id === order.customerId);
    const price = resolvePrice(data, customer, product, clock);
    const unit = payload.unit === 'COLLI' ? 'CT' : payload.unit;
    const existing = order.lines.find(line => line.productId === product.id && line.unit === unit && line.unitPriceBaseCents === price.unitPriceBaseCents && !line.isGift && !line.whatsappRequestId && !line.note);
    if (existing) {
      existing.quantity = (Math.round(existing.quantity * 1000) + Math.round(payload.quantity * 1000)) / 1000;
      Object.assign(existing, calculateLine(product, existing));
    } else order.lines.push(calculateLine(product, { id: payload.lineId, productId: product.id, quantity: payload.quantity, unit,
      unitPriceBaseCents: price.unitPriceBaseCents, costBaseCents: product.costBaseCents, priceMode: price.source,
      priceReferenceId: price.conditionId, isGift: false, note: '', whatsappRequestId: null }));
    recalculate(data, order);
  }
  if (command.type === 'REMOVE_LINE') {
    const line = order.lines.find(item => item.id === payload.lineId);
    if (!line) throw new Error('Riga inesistente.');
    if (line.whatsappRequestId) throw new Error('Per una riga WhatsApp usa Escludi richiesta.');
    order.lines = order.lines.filter(item => item.id !== payload.lineId);
    recalculate(data, order);
  }
  if (command.type === 'UPDATE_LINE') {
    const line = order.lines.find(item => item.id === payload.lineId);
    if (!line) throw new Error('Riga inesistente.');
    const product = productFor(data, line.productId);
    if (payload.quantity !== undefined) quantityNumber(payload.quantity);
    if (payload.note !== undefined) validText(payload.note, 'Commento');
    for (const key of ['quantity', 'unit', 'note']) if (payload[key] !== undefined) line[key] = payload[key];
    if (line.unit === 'COLLI') line.unit = 'CT';
    if (payload.isGift !== undefined) line.isGift = validBoolean(payload.isGift);
    const mode = payload.priceMode;
    if (['priceMode', 'priceListId', 'unitPriceBaseCents', 'discountBasisPoints'].some(key => payload[key] !== undefined)) {
      if (!['FIXED_PRICE', 'PRICE_LIST', 'DISCOUNT'].includes(mode)) throw new Error('Modalità prezzo non valida.');
      const list = payload.priceListId || order.priceListId;
      if (!data.priceLists.some(item => item.id === list)) throw new Error('Listino non valido.');
      const reference = listPrice(data, product, list);
      if (mode === 'FIXED_PRICE') line.unitPriceBaseCents = validInteger(payload.unitPriceBaseCents);
      if (mode === 'PRICE_LIST') line.unitPriceBaseCents = reference;
      if (mode === 'DISCOUNT') {
        const points = validInteger(payload.discountBasisPoints);
        if (points < 0 || points > 10000) throw new Error('Sconto non valido.');
        line.unitPriceBaseCents = halfUp(BigInt(reference) * BigInt(10000 - points), 10000n);
      }
      line.priceMode = mode;
      line.priceReferenceId = list;
    }
    Object.assign(line, calculateLine(product, line));
    if (payload.condition) {
      const condition = payload.condition;
      strictKeys(condition, ['id', 'validFrom', 'validTo', 'replaceOverlaps']);
      validId(condition.id);
      if (!['FIXED_PRICE', 'PRICE_LIST', 'DISCOUNT'].includes(mode)) throw new Error('Modalità prezzo richiesta per salvare una condizione.');
      const start = conditionDay(condition.validFrom);
      const finish = conditionDay(condition.validTo);
      if (start && finish && start > finish) throw new Error('Intervallo validità non corretto.');
      const overlap = item => item.customerId === order.customerId && item.productId === product.id && (!item.validTo || !start || item.validTo >= start) && (!finish || !item.validFrom || item.validFrom <= finish);
      if (data.customerConditions.some(overlap) && condition.replaceOverlaps !== true) throw new Error('Conferma la sostituzione delle condizioni sovrapposte.');
      if (data.customerConditions.some(item => item.id === condition.id && !overlap(item))) throw new Error('Identificativo condizione già presente.');
      data.customerConditions = data.customerConditions.filter(item => !overlap(item));
      data.customerConditions.push({ id: condition.id, customerId: order.customerId, productId: product.id, type: mode,
        unitPriceBaseCents: mode === 'FIXED_PRICE' ? line.unitPriceBaseCents : null, priceListId: mode === 'FIXED_PRICE' ? null : line.priceReferenceId,
        discountBasisPoints: mode === 'DISCOUNT' ? payload.discountBasisPoints : null, validFrom: start, validTo: finish, savedByAgentId: order.agentId });
    }
    recalculate(data, order);
  }
  if (command.type === 'SAVE_REVIEW' || command.type === 'CONFIRM_ORDER' && REVIEW_FIELDS.some(key => payload[key] !== undefined)) saveReview(data, order, payload);
  if (command.type === 'CONFIRM_ORDER') {
    const errors = orderErrors(data, order);
    if (errors.length) throw new Error(errors.join(' '));
    order.lines = order.lines.map(line => calculateLine(productFor(data, line.productId), line));
    recalculate(data, order);
    const queued = queueValidatedOrder(data, order.id, clock);
    next.data.orders = queued.orders;
    next.data.syncQueue = queued.syncQueue;
  }
  if (command.type === 'DELETE_DRAFT') {
    if (order.status !== 'DRAFT') throw new Error('Puoi eliminare soltanto una bozza.');
    data.orders = data.orders.filter(item => item.id !== order.id);
  }
  return finishProjection(next);
}
