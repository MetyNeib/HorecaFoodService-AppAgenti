import test from 'node:test';
import assert from 'node:assert/strict';
import { priceFor, lineCents, decimalText, projectCommand, reconcileRecord, mergeSnapshot, romeDate } from '../../app/javascript/amelia3/domain.js';

const data = () => ({ batchId: 'synthetic-batch-1', customers: [{ id: 'C001', name: 'Cliente sintetico', agentCode: '34', deliveryPoint: true }, { id: 'C002', blocked: true, deliveryPoint: true }],
  products: [{ id: 'P001', name: 'Prodotto sintetico', unit: 'P', orderUnit: 'P', quantityStep: 1, stockPieces: '100.0', basePriceMicros: '1234560' },
    { id: 'K001', unit: 'K', orderUnit: 'L', unavailableReason: 'UM non attestata' }],
  customerConditions: [{ id: 1, customerId: 'C001', productId: 'P001', discountUnits: '35000', validFrom: '2020-01-01', validTo: '2099-12-31' }], orders: [] });
const initial = () => ({ schemaVersion: 2, datasetMode: 'amelia3', data: data() });
const draft = () => projectCommand(initial(), { type: 'CREATE_DRAFT', payload: { id: 'synthetic-order', customerId: 'C001' } });
const add = { type: 'ADD_LINE', payload: { orderId: 'synthetic-order', lineId: 'synthetic-line', productId: 'P001', quantity: '3', expectedUnitPrice: '1.1913504', expectedVersion: 0 } };

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
