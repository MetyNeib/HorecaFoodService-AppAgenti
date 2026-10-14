import test from 'node:test';
import assert from 'node:assert/strict';
import { priceFor, lineCents, decimalText, projectCommand, reconcileRecord, mergeSnapshot, romeDate, stepQuantity, orderableUnits } from '../../app/javascript/amelia3/domain.js';

const data = () => ({ batchId: 'synthetic-batch-1', customers: [{ id: 'C001', name: 'Cliente sintetico', agentCode: '34', deliveryPoint: true }, { id: 'C002', blocked: true, deliveryPoint: true }],
  products: [{ id: 'P001', name: 'Prodotto sintetico', unit: 'P', orderUnit: 'P', preferredUm: 'PZ', orderableUms: ['PZ'], basePriceMicros: '1234560',
    unitQuotes: { PZ: { unit: 'PZ', contractVersion: 'AMELIA3-QUOTE-v2', conversionVersion: 'synthetic-v1', quantityStep: '1', priceUnit: 'PZ', stockUnit: 'PZ',
      priceFactor: { n: '1', d: '1' }, personalPriceFactor: { n: '1', d: '1' }, stockFactor: { n: '1', d: '1' }, available: { n: '100', d: '1' } } } },
    { id: 'K001', unit: 'K', orderUnit: 'L', unavailableReason: 'UM non attestata' }],
  customerConditions: [{ id: 1, customerId: 'C001', productId: 'P001', discountUnits: '35000', validFrom: '2020-01-01', validTo: '2099-12-31' }], orders: [] });
const initial = () => ({ schemaVersion: 2, datasetMode: 'amelia3', data: data() });
const draft = () => projectCommand(initial(), { type: 'CREATE_DRAFT', payload: { id: 'synthetic-order', customerId: 'C001' } });
const add = { type: 'ADD_LINE', payload: { orderId: 'synthetic-order', lineId: 'synthetic-line', productId: 'P001', unit: 'PZ', expectedConversionVersion: 'synthetic-v1', quantity: '3', expectedUnitPrice: '1.1913504', expectedVersion: 0 } };

test('offline catalogue excludes invalid options and customer prices without removing stored records', () => {
  const source = data(), product = source.products[0];
  product.orderableUms.unshift('COLL');
  product.preferredUm = 'COLL';
  product.unitQuotes.COLL = { ...product.unitQuotes.PZ, reason: 'Conversione non attestata' };
  const before = structuredClone(source);
  assert.deepEqual(orderableUnits(source, 'C001', product), ['PZ']);
  assert.deepEqual(orderableUnits(source, 'C001', source.products[1]), []);
  assert.deepEqual(orderableUnits(source, 'C002', product), []);
  assert.deepEqual(source, before);
  source.customerConditions.push({ ...source.customerConditions[0] });
  assert.deepEqual(orderableUnits(source, 'C001', product), []);
  source.customerConditions.pop();
  product.unitQuotes.PZ.reason = 'Giacenza autorevole non disponibile';
  assert.deepEqual(orderableUnits(source, 'C001', product), []);
  delete product.unitQuotes.PZ.reason;
  product.blocked = true;
  assert.deepEqual(orderableUnits(source, 'C001', product), []);
});

test('generic placeholders are excluded even from old offline caches without excluding normal assorted products', () => {
  const source = data(), product = source.products[0];
  for (const name of ['**ARTICOLO VARIO FRESCO', 'Articoli vari', 'ART. VARIO', '(OM) MERCE VARIA', 'PRODOTTO GENERICO', 'MERCI DIVERSE']) {
    product.name = name;
    assert.deepEqual(orderableUnits(source, 'C001', product), []);
    assert.ok(priceFor(source, 'C001', product));
  }
  for (const name of ['Caramelle gusti vari', 'Mix verdure', 'Articolo variante speciale']) {
    product.name = name;
    assert.deepEqual(orderableUnits(source, 'C001', product), ['PZ']);
  }
});

test('Amelia3 BigInt matches Ruby BigDecimal: five decimals, discount and one rounding at line level', () => {
  const source = data(), quote = priceFor(source, 'C001', source.products[0]);
  assert.equal(decimalText(quote.amount), '1.1913504');
  assert.equal(lineCents('3', quote.amount), 357);
  const state = draft(), original = structuredClone(state), result = projectCommand(state, add);
  assert.deepEqual(state, original);
  assert.equal(result.data.orders[0].lines[0].unitPrice, '1.1913504');
  assert.equal(result.data.orders[0].netCents, 357);
});
test('condition validity is inclusive and overlapping or unrepresentable prices are rejected', () => {
  const source = data(), condition = source.customerConditions[0];
  condition.validFrom = condition.validTo = romeDate();
  assert.equal(decimalText(priceFor(source, 'C001', source.products[0]).amount), '1.1913504');
  source.customerConditions.push({ ...condition });
  assert.throws(() => priceFor(source, 'C001', source.products[0]));
  source.customerConditions.pop(); condition.unavailableReason = 'Precisione non attestata';
  assert.throws(() => priceFor(source, 'C001', source.products[0]));
});
test('blocked customers, unverified units, quantities, prices and unsupported commands fail without modifying the cache', () => {
  const state = draft();
  for (const payload of [{ productId: 'K001' }, { quantity: '101' }, { quantity: '0' }, { quantity: '1.5' }, { expectedVersion: 3 }, { expectedUnitPrice: '1.19' }]) {
    const original = structuredClone(state);
    assert.throws(() => projectCommand(state, { ...add, payload: { ...add.payload, ...payload } }));
    assert.deepEqual(state, original);
  }
  assert.throws(() => projectCommand(initial(), { type: 'CREATE_DRAFT', payload: { id: 'x', customerId: 'C002' } }));
  assert.throws(() => projectCommand(state, { type: 'RESET_DEMO', payload: {} }));
  assert.throws(() => projectCommand(state, { type: 'SEND_ORDER', payload: {} }));
});
test('quantity edits retain price snapshots after a catalog update and confirmation is local', () => {
  const state = projectCommand(draft(), add);
  state.data.products[0].basePriceMicros = '2500000';
  const result = projectCommand(state, { type: 'UPDATE_LINE', payload: { orderId: 'synthetic-order', lineId: 'synthetic-line', quantity: '4', expectedVersion: 1 } });
  assert.equal(result.data.orders[0].netCents, 477);
  assert.equal(result.data.orders[0].lines[0].priceSnapshot.basePrice, '1.23456');
  const confirmed = projectCommand(result, { type: 'CONFIRM_ORDER', payload: { orderId: 'synthetic-order', expectedVersion: 2 } });
  assert.equal(confirmed.data.orders[0].status, 'CONFIRMED_LOCAL');
});
test('a new import preserves the entire pending projection and creates an explicit recoverable conflict', () => {
  const projected = projectCommand(draft(), add), server = { state: initial() };
  const next = structuredClone(server); next.state.data.batchId = 'synthetic-batch-2';
  const record = { server: next, projected, outbox: [{ ...add, payload: { ...add.payload, batchId: 'synthetic-batch-1' } }] };
  reconcileRecord(record, next);
  assert.equal(record.conflict.kind, 'dataset'); assert.deepEqual(record.projected, projected);
});
test('bounded server snapshots retain the context of queued edits only within the same batch', () => {
  const previous = { state: projectCommand(draft(), add) }, next = { state: initial() };
  const merged = mergeSnapshot(next, previous, [add]);
  assert.equal(merged.state.data.orders.length, 1);
  next.state.data.batchId = 'synthetic-batch-2';
  assert.equal(mergeSnapshot(next, previous, [add]).state.data.orders.length, 0);
});
test('offline confirmation requires an attested delivery point without following a foreign billing parent', () => {
  const state = projectCommand(draft(), add);
  state.data.customers[0].deliveryPoint = false;
  assert.throws(() => projectCommand(state, { type: 'CONFIRM_ORDER', payload: { orderId: 'synthetic-order', expectedVersion: 1 } }));
  assert.throws(() => projectCommand(state, { type: 'SAVE_REVIEW', payload: { orderId: 'synthetic-order', expectedVersion: 1, destinationId: 'foreign-client', deliveryDate: romeDate() } }));
  assert.equal(state.data.orders[0].status, 'DRAFT');
});
test('acknowledging another order retains products and conditions needed by queued additions', () => {
  const previous = { state: draft() }, next = { state: initial() };
  next.state.data.products = []; next.state.data.customerConditions = [];
  const merged = mergeSnapshot(next, previous, [add]);
  const projected = projectCommand(merged.state, add);
  assert.equal(projected.data.orders[0].netCents, 357);
  assert.equal(projected.data.orders[0].lines[0].unitPrice, '1.1913504');
  assert.equal(merged.state.data.products.length, 1);
});

test('decimal quantities and recurring prices retain exact arithmetic with a single line rounding', () => {
  assert.equal(stepQuantity('0.1', '0.1', '1'), '0.2');
  assert.equal(stepQuantity('0.2', '0.1', '1'), '0.3');
  assert.equal(stepQuantity('0.1', '0.1', '-1'), '0.1');
  assert.equal(lineCents('3', { n: '1', d: '3' }), 100);
  assert.equal(lineCents('0.3', { n: '5', d: '1' }), 150);
  assert.equal(lineCents('1', { n: '1', d: '200' }), 1);
});

test('mixed COLL/KG lines share one stock and reject fractional steps, spoofed units and exhausted stock', () => {
  let state = draft(); state.data.customerConditions = [];
  const product = state.data.products[0], common = { ...product.unitQuotes.PZ, stockUnit: 'KG', priceUnit: 'KG' };
  Object.assign(product, { basePriceMicros: '5000000', preferredUm: 'COLL', orderableUms: ['COLL', 'KG'], unitQuotes: {
    COLL: { ...common, unit: 'COLL', quantityStep: '1', priceFactor: { n: '5', d: '1' }, stockFactor: { n: '1', d: '5' }, available: { n: '2', d: '1' } },
    KG: { ...common, unit: 'KG', quantityStep: '0.1', priceFactor: { n: '1', d: '1' }, stockFactor: { n: '1', d: '1' }, available: { n: '10', d: '1' } }
  } });
  const command = (unit, quantity, version, id) => ({ ...add, payload: { ...add.payload, unit, quantity, expectedVersion: version, lineId: id, expectedUnitPrice: unit === 'COLL' ? '25' : '5' } });
  state = projectCommand(state, command('COLL', '1', 0, 'case'));
  assert.throws(() => projectCommand(state, command('KG', '0.15', 1, 'invalid-step')));
  state = projectCommand(state, command('KG', '5', 1, 'weight'));
  assert.equal(state.data.orders[0].netCents, 5000);
  assert.throws(() => projectCommand(state, command('KG', '0.1', 2, 'excess')));
  assert.throws(() => projectCommand(state, command('PZ', '1', 2, 'spoofed-unit')));
  state.data.products[0].unitQuotes.COLL.conversionVersion = 'changed';
  assert.throws(() => projectCommand(state, { type: 'CONFIRM_ORDER', payload: { orderId: 'synthetic-order', expectedVersion: 2 } }));
  assert.equal(state.data.orders[0].status, 'DRAFT');
});

test('an evidence change in the same batch preserves pending data and requires explicit reconciliation', () => {
  const projected = projectCommand(draft(), add); projected.data.verificationVersion = 'old';
  const snapshot = { state: initial() }; snapshot.state.data.verificationVersion = 'new';
  const record = { server: snapshot, projected, outbox: [{ ...add, payload: { ...add.payload, batchId: projected.data.batchId } }] };
  reconcileRecord(record, snapshot);
  assert.equal(record.conflict.kind, 'dataset'); assert.deepEqual(record.projected, projected);
});

test('free decimal KG keeps sub-unit stock and rejects stock excess without imposing a milligram step', () => {
  let state = draft(); state.data.customerConditions = [];
  const product = state.data.products[0], terms = product.unitQuotes.PZ;
  Object.assign(product, { basePriceMicros: '5000000', preferredUm: 'KG', orderableUms: ['KG'], unitQuotes: { KG: { ...terms, unit: 'KG', quantityStep: 'any', stockUnit: 'KG', available: { n: '1', d: '8' } } } });
  const cmd = { ...add, payload: { ...add.payload, unit: 'KG', quantity: '0.123456', expectedUnitPrice: '5' } };
  state = projectCommand(state, cmd);
  assert.equal(state.data.orders[0].netCents, 62);
  assert.equal(state.data.orders[0].lines[0].quantity, '0.123456');
  assert.throws(() => projectCommand(state, { ...cmd, payload: { ...cmd.payload, expectedVersion: 1, lineId: 'excess', quantity: '0.01' } }));
  assert.equal(stepQuantity('0.125', 'any', '1'), '1.125');
  state.data.customers[0].assignedListCode = '123';
  assert.throws(() => projectCommand(state, { type: 'CONFIRM_ORDER', payload: { orderId: 'synthetic-order', expectedVersion: 1 } }));
});
