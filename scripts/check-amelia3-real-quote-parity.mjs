import fs from 'node:fs';
import assert from 'node:assert/strict';
import { priceFor, fractionData, lineCents } from '../app/javascript/amelia3/domain.js';
const rows = JSON.parse(fs.readFileSync('imports/private/amelia3/verification-v5/quote-parity-private.json', 'utf8'));
assert.ok(rows.length > 0);
for (const row of rows) {
  const data = { customers: [], customerConditions: [] };
  const price = priceFor(data, null, row.product, undefined, row.unit);
  assert.deepEqual(fractionData(price.amount), row.exactPrice, 'Exact price mismatch (private product details omitted)');
  assert.equal(lineCents(row.quantity, price.amount), row.expectedCents, 'Line rounding mismatch (private product details omitted)');
}
const result = { status: 'PASS', quotes: rows.length, exact_price_and_line_cents: true, data_source: 'private locally imported Amelia3 data' };
fs.writeFileSync('qa/amelia3-v5/real-quote-js-parity.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
