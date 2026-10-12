import { test, expect } from '@playwright/test';

const agent = 'amelia-agent-qa@example.invalid', admin = 'amelia-admin-qa@example.invalid';
async function login(page, email = agent) {
  await page.goto('/users/sign_in');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('TestHfsLocale2026!');
  await page.getByRole('button', { name: 'Accedi', exact: true }).click();
  await page.waitForFunction(() => !!window.HFS?.client?.record);
  await page.evaluate(() => window.HFS.ready);
  await page.waitForFunction(() => !window.HFS.client.syncing);
}
async function snapshot(page) { return page.evaluate(() => fetch('/amelia3/snapshot', { headers: { Accept: 'application/json' } }).then(r => r.json())); }
const outbox = page => page.evaluate(() => window.HFS.client.record.outbox);
const state = page => page.evaluate(() => window.HFS.client.snapshot.state.data);
async function command(page, type, payload = {}) {
  return page.evaluate(async ({ type, payload }) => {
    const before = await fetch('/amelia3/snapshot', { headers: { Accept: 'application/json' } }).then(r => r.json());
    const order = before.state.data.orders.find(row => row.id === payload.orderId);
    const response = await fetch('/amelia3/commands', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': before.csrfToken, 'X-HFS-User-Id': before.user.id },
      body: JSON.stringify({ operationId: crypto.randomUUID(), baseVersion: before.version, epoch: 1, type,
        payload: { batchId: before.state.data.batchId, ...(order ? { expectedVersion: order.version } : {}), ...payload } }) });
    if (!response.ok) throw Error(await response.text()); return response.json();
  }, { type, payload });
}
async function create(page) {
  const id = await page.evaluate(() => crypto.randomUUID());
  await command(page, 'CREATE_DRAFT', { id, customerId: 'C001' }); return id;
}
async function readyOffline(page) { await page.waitForFunction(() => window.HFS.offlinePrepared === true && !!navigator.serviceWorker.controller); }
async function navigate(page, path) { await page.evaluate(path => window.HFS.navigate(path), path); }
test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error; });
  page.on('request', request => { if (/^https?:/.test(request.url())) expect(['127.0.0.1', 'localhost']).toContain(new URL(request.url()).hostname); });
});

test('agent portfolio, four client tabs, catalog and history remain accessible without horizontal overflow', async ({ page }, info) => {
  await login(page);
  expect((await snapshot(page)).state.data.customers.map(row => row.id)).toEqual(['C001', 'C002']);
  for (const path of ['/amelia3', '/amelia3/customers', '/amelia3/customers/C001?tab=details', '/amelia3/customers/C001?tab=orders', '/amelia3/customers/C001?tab=open_items', '/amelia3/customers/C001?tab=commercial', '/amelia3/catalog', '/amelia3/catalog/P001', '/amelia3/orders', '/amelia3/history', '/amelia3/insights']) {
    await navigate(page, path); await expect(page.locator('main h1')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await expect(page.locator('main')).not.toContainText('Cliente sintetico esterno');
  }
  await expect(page.locator('main')).toContainText('1');
  await page.screenshot({ path: `qa/amelia3/${info.project.name}-synthetic-insights.png`, fullPage: true });
  expect((await snapshot(page)).state.data).not.toHaveProperty('history');
});

test('Admin sees all customers and creates one canonical order that the agent can open and confirm', async ({ page, browser }, info) => {
  await login(page, admin);
  expect((await snapshot(page)).state.data.portfolioCount).toBe(3);
  await navigate(page, '/amelia3/sync'); await expect(page.locator('main')).toContainText('Sincronizzazione');
  const id = await create(page);
  await command(page, 'ADD_LINE', { orderId: id, lineId: await page.evaluate(() => crypto.randomUUID()), productId: 'P001', quantity: '3', expectedUnitPrice: '1.1913504' });
  const second = await browser.newContext({ viewport: info.project.use.viewport });
  try {
    const other = await second.newPage(); await login(other);
    await navigate(other, `/amelia3/orders/${id}`);
    await expect(other.locator('main')).toContainText('3,57');
    await other.getByLabel('Nota sul documento di consegna').fill('Nota sintetica condivisa');
    await other.getByRole('button', { name: 'Conferma ordine locale', exact: true }).click();
    await expect.poll(async () => (await snapshot(other)).state.data.orders.find(row => row.id === id)?.status).toBe('CONFIRMED_LOCAL');
    const adminOrder = (await snapshot(page)).state.data.orders.filter(row => row.id === id);
    expect(adminOrder).toHaveLength(1); expect(adminOrder[0]).toMatchObject({ agentCode: '34', netCents: 357, note: 'Nota sintetica condivisa' });
  } finally { await second.close(); }
});

test('real offline cold reload, touch quantities, local confirmation and idempotent reconnect', async ({ page, context }, info) => {
  await login(page); await readyOffline(page); await context.setOffline(true); await page.reload();
  await expect(page.getByRole('heading', { name: 'Home Amelia3', exact: true })).toBeVisible();
  await page.getByRole('link', { name: /Inserisci nuovo ordine/ }).click();
  await page.getByRole('searchbox').fill('C001'); await page.getByRole('button', { name: 'Cerca', exact: true }).click();
  await expect(page.getByRole('button', { name: /Seleziona/ })).toHaveCount(1);
  await page.getByRole('button', { name: /Seleziona/ }).click();
  await expect(page.getByRole('heading', { name: 'Cerca e aggiungi prodotti' })).toBeVisible();
  const id = new URL(page.url()).searchParams.get('order_id');
  const product = page.locator('[data-product-code="P001"]');
  await product.getByRole('button', { name: 'Aumenta quantità', exact: true }).click();
  await product.getByRole('button', { name: '+ Aggiungi', exact: true }).click();
  await expect(page.locator('[data-line-id]')).toHaveCount(1);
  await page.getByRole('link', { name: /Vai al riepilogo/ }).click();
  await page.getByLabel('Nota sul documento di consegna').fill('Salvata senza rete');
  await page.getByLabel('Indicazione pagamento (locale)').fill('Nota pagamento sintetica');
  await page.getByRole('button', { name: 'Conferma ordine locale', exact: true }).click();
  await expect.poll(async () => (await state(page)).orders.find(row => row.id === id)?.status).toBe('CONFIRMED_LOCAL');
  expect((await outbox(page)).length).toBeGreaterThanOrEqual(4);
  await page.reload(); await expect(page.locator('main')).toContainText('Confermato localmente');
  expect((await state(page)).orders.filter(row => row.id === id)).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: `qa/amelia3/${info.project.name}-synthetic-offline.png`, fullPage: true });
  await context.setOffline(false); await page.evaluate(() => window.HFS.reconnect());
  await expect.poll(() => outbox(page), { timeout: 30000 }).toEqual([]);
  const saved = (await snapshot(page)).state.data.orders.filter(row => row.id === id);
  expect(saved).toHaveLength(1); expect(saved[0]).toMatchObject({ status: 'CONFIRMED_LOCAL', note: 'Salvata senza rete', netCents: 238 });
  await page.evaluate(() => window.HFS.reconnect());
  expect((await snapshot(page)).state.data.orders.filter(row => row.id === id)).toHaveLength(1);
});

test('concurrent account edits preserve the pending copy and require explicit conflict recovery', async ({ page, context, browser }) => {
  await login(page); const id = await create(page); await page.reload(); await page.waitForFunction(() => !!window.HFS?.client?.record);
  const second = await browser.newContext();
  try {
    const other = await second.newPage(); await login(other, admin);
    await context.setOffline(true);
    await page.evaluate(id => { const order = window.HFS.client.snapshot.state.data.orders.find(row => row.id === id); return window.HFS.client.enqueue('SAVE_REVIEW', { orderId: id, expectedVersion: order.version, batchId: window.HFS.client.snapshot.state.data.batchId, destinationId: 'C001', deliveryDate: order.deliveryDate, note: 'Copia offline' }); }, id);
    const order = (await snapshot(other)).state.data.orders.find(row => row.id === id);
    await command(other, 'SAVE_REVIEW', { orderId: id, destinationId: 'C001', deliveryDate: order.deliveryDate, note: 'Copia sul server' });
    await context.setOffline(false); await page.evaluate(() => window.HFS.reconnect());
    await expect.poll(() => page.evaluate(() => window.HFS.client.record.conflict?.kind)).toBe('version');
    expect((await state(page)).orders.find(row => row.id === id).note).toBe('Copia offline'); expect(await outbox(page)).toHaveLength(1);
    await page.evaluate(() => window.HFS.client.useServerVersion());
    expect(await page.evaluate(() => window.HFS.client.record.recovery.length)).toBe(1);
    expect((await state(page)).orders.find(row => row.id === id).note).toBe('Copia sul server');
  } finally { await second.close(); }
});

test('expired sessions and expired offline permissions preserve the outbox and hide business pages', async ({ page, context }) => {
  await login(page); await readyOffline(page); const id = await create(page); await page.reload(); await page.waitForFunction(() => !!window.HFS?.client?.record);
  await context.setOffline(true);
  await page.evaluate(id => { const order = window.HFS.client.snapshot.state.data.orders.find(row => row.id === id); return window.HFS.client.enqueue('SAVE_REVIEW', { orderId: id, expectedVersion: order.version, batchId: window.HFS.client.snapshot.state.data.batchId, destinationId: 'C001', deliveryDate: order.deliveryDate, note: 'Da recuperare' }); }, id);
  await context.clearCookies(); await context.setOffline(false); await page.evaluate(() => window.HFS.reconnect());
  await expect(page.getByRole('heading', { name: 'Accesso richiesto', exact: true })).toBeVisible(); expect(await outbox(page)).toHaveLength(1);
  await page.evaluate(() => window.HFS.client.storage.update(record => { record.projected.data.expiresAt = '2020-01-01T00:00:00Z'; return record; }));
  await context.setOffline(true); await page.reload();
  await expect(page.getByRole('heading', { name: 'Accesso richiesto', exact: true })).toBeVisible();
  expect(await outbox(page)).toHaveLength(1);
  const cached = await page.evaluate(async () => { const paths = []; for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) paths.push(new URL(request.url).pathname); return paths; });
  expect(cached).not.toContain('/amelia3/snapshot'); expect(cached).not.toContain('/amelia3');
  const shell = await page.evaluate(async () => (await caches.match('/offline')).text());
  expect(shell).not.toContain('Cliente sintetico'); expect(shell).not.toContain(agent);
  await context.setOffline(false); await login(page);
  await expect.poll(() => outbox(page), { timeout: 30000 }).toEqual([]);
  expect((await snapshot(page)).state.data.orders.find(row => row.id === id)?.note).toBe('Da recuperare');
});

test('business blocks also apply to direct API calls and unverified units', async ({ page }) => {
  await login(page); await navigate(page, '/amelia3/customers?pick=1');
  await expect(page.locator('[data-customer-code="C002"]').getByRole('button', { name: /Seleziona/ })).toBeDisabled();
  const result = await page.evaluate(async () => {
    const data = await fetch('/amelia3/snapshot').then(r => r.json());
    const response = await fetch('/amelia3/commands', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': data.csrfToken, 'X-HFS-User-Id': data.user.id }, body: JSON.stringify({ operationId: crypto.randomUUID(), baseVersion: data.version, epoch: 1, type: 'CREATE_DRAFT', payload: { id: crypto.randomUUID(), customerId: 'C002', batchId: data.state.data.batchId } }) });
    return { status: response.status, code: (await response.json()).code };
  });
  expect(result).toEqual({ status: 422, code: 'CUSTOMER_BLOCKED' });
  const id = await create(page); await navigate(page, `/amelia3/catalog?order_id=${id}`);
  await expect(page.locator('[data-product-code="K001"]').getByRole('button', { name: '+ Aggiungi', exact: true })).toBeDisabled();
  await page.evaluate(() => window.HFS.reconnect());
  expect((await state(page)).products.some(row => row.id === 'K001')).toBe(true);
  await navigate(page, '/amelia3/catalog/K001'); await page.evaluate(() => window.HFS.reconnect());
  expect((await state(page)).products.some(row => row.id === 'K001')).toBe(true);
  const response = await page.request.get('/amelia3/customers/C003'); expect(response.status()).toBe(404);
});

test('role switching isolates cache namespaces and rejects a command from the old Admin tab', async ({ page, context }) => {
  await login(page, admin); await readyOffline(page);
  const oldOwner = await page.evaluate(() => window.HFS.client.userId);
  // The obsolete tab is disconnected while the other account signs in, so an
  // in-flight response cannot restore its old cookie after clearCookies().
  await page.route('**/amelia3/**', route => route.abort());
  await context.clearCookies();
  const other = await context.newPage(); await login(other); await readyOffline(other);
  expect(await other.evaluate(() => window.HFS.client.userId)).not.toBe(oldOwner);
  await page.unroute('**/amelia3/**');
  await page.evaluate(() => window.HFS.reconnect());
  await expect(page.getByRole('heading', { name: 'Accesso richiesto', exact: true })).toBeVisible();
  await context.setOffline(true); await other.reload();
  await expect(other.getByRole('heading', { name: 'Home Amelia3', exact: true })).toBeVisible();
  expect((await state(other)).customers.map(row => row.id)).toEqual(['C001', 'C002']);
  await navigate(other, '/amelia3/customers');
  await expect(other.locator('main')).not.toContainText('Cliente sintetico esterno');
});

test('storage unavailable keeps online HTML order forms operational without claiming an offline save', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }); });
  await page.goto('/users/sign_in');
  await page.getByLabel('Email', { exact: true }).fill(agent);
  await page.getByLabel('Password', { exact: true }).fill('TestHfsLocale2026!');
  await page.getByRole('button', { name: 'Accedi', exact: true }).click();
  await page.waitForFunction(() => !!window.HFS?.storageFailure);
  await page.goto('/amelia3/customers?pick=1');
  await page.locator('[data-customer-code="C001"]').getByRole('button', { name: /Seleziona/ }).click();
  await page.waitForURL('**/amelia3/catalog?order_id=*');
  const id = new URL(page.url()).searchParams.get('order_id');
  await page.locator('[data-product-code="P001"]').getByRole('button', { name: '+ Aggiungi', exact: true }).click();
  await expect(page.locator('[data-line-id]')).toHaveCount(1);
  await page.getByRole('link', { name: /Vai al riepilogo/ }).click();
  await page.getByRole('button', { name: 'Conferma ordine locale', exact: true }).click();
  await expect(page.locator('main')).toContainText('Ordine confermato nel database locale');
  expect((await snapshot(page)).state.data.orders.find(row => row.id === id)?.status).toBe('CONFIRMED_LOCAL');
});

test('a new offline draft syncs from its editor and searched products remain prepared after refresh', async ({ page, context }) => {
  await login(page); await readyOffline(page); await context.setOffline(true);
  await navigate(page, '/amelia3/customers?pick=1&q=C001');
  await page.getByRole('button', { name: /Seleziona/ }).click();
  const id = new URL(page.url()).searchParams.get('order_id');
  await page.locator('[data-product-code="P001"]').getByRole('button', { name: '+ Aggiungi', exact: true }).click();
  expect(await outbox(page)).toHaveLength(2);
  await context.setOffline(false); await page.evaluate(() => window.HFS.reconnect());
  await expect.poll(() => outbox(page), { timeout: 30000 }).toEqual([]);
  const saved = (await snapshot(page)).state.data.orders.filter(row => row.id === id);
  expect(saved).toHaveLength(1); expect(saved[0]).toMatchObject({ status: 'DRAFT', netCents: 119 });
  await navigate(page, `/amelia3/catalog?order_id=${id}&q=K001`);
  await page.evaluate(() => window.HFS.reconnect());
  expect((await state(page)).products.some(row => row.id === 'K001')).toBe(true);
  await context.setOffline(true); await page.reload();
  await expect(page.getByRole('heading', { name: 'Prodotto sintetico senza conversione', exact: true })).toBeVisible();
  await expect(page.locator('[data-product-code="K001"]').getByRole('button', { name: '+ Aggiungi', exact: true })).toBeDisabled();
  expect((await state(page)).orders.find(row => row.id === id)?.netCents).toBe(119);
});
