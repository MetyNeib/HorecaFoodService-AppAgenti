import { test, expect } from '@playwright/test';

const email = 'pwa@hfs.invalid';
const password = 'HfsDemoLocale2026!';

async function login(page, account = email) {
  await page.goto('/users/sign_in');
  await page.getByLabel('Email', { exact: true }).fill(account);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Accedi', exact: true }).click();
  await page.waitForFunction(() => !!window.HFS?.client?.record);
  await page.evaluate(async () => { await window.HFS.ready; });
}
async function command(page, type, payload = {}) {
  return page.evaluate(async ({ type, payload }) => {
    const before = await fetch('/snapshot', { headers: { Accept: 'application/json' } }).then(response => response.json());
    const response = await fetch('/commands', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': before.csrfToken, 'X-HFS-User-Id': String(before.user.id) },
      body: JSON.stringify({ operationId: crypto.randomUUID(), baseVersion: before.version, epoch: before.epoch, type, payload }) });
    if (!response.ok) throw Error(await response.text());
    return response.json();
  }, { type, payload });
}
async function readyOffline(page) {
  await page.waitForFunction(() => window.HFS?.offlinePrepared === true && !!navigator.serviceWorker.controller);
}
const state = page => page.evaluate(() => window.HFS.client.snapshot.state);
const outbox = page => page.evaluate(() => window.HFS.client.record.outbox);
async function navigate(page, path) { await page.evaluate(path => window.HFS.navigate(path), path); }

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error; });
  page.on('request', request => {
    if (/^https?:/.test(request.url())) expect(['127.0.0.1', 'localhost']).toContain(new URL(request.url()).hostname);
  });
  await login(page);
  await command(page, 'RESET_DEMO');
  await page.reload();
  await page.waitForFunction(() => !!window.HFS?.client?.record);
  await readyOffline(page);
});

test('offline reale: riapertura, clienti/catalogo, ordine modificato e sincronizzato una sola volta', async ({ page, context }, info) => {
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'La tua giornata', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Inserisci nuovo ordine', exact: true }).click();
  await page.getByRole('searchbox').fill('99000000011');
  await expect(page.getByRole('button', { name: /Seleziona/ })).toHaveCount(1);
  await page.getByRole('button', { name: /Seleziona/ }).click();
  await expect(page.getByRole('heading', { name: 'Cerca e aggiungi prodotti' })).toBeVisible();
  const orderId = new URL(page.url()).pathname.split('/')[2];
  await page.getByRole('searchbox').fill('0107417');
  const product = page.getByTestId('product-0107417');
  await product.getByRole('combobox').selectOption('CT');
  await product.getByRole('button', { name: '+ Aggiungi', exact: true }).click();
  await expect(page.getByTestId('line-0107417')).toContainText('15 PZ');
  await page.getByTestId('line-0107417').getByRole('link', { name: 'Modifica', exact: true }).click();
  await page.getByLabel('Prezzo finale', { exact: true }).fill('1,50');
  await page.getByRole('button', { name: 'Salva modifiche', exact: true }).click();
  await expect(page.getByTestId('line-0107417')).toContainText('22,50');
  await page.getByRole('link', { name: /Vai al riepilogo/ }).click();
  await page.getByLabel('Nota sul documento di consegna').fill('Salvata senza rete');
  await page.getByLabel('Pagamento dell’ordine').selectOption('PAY-BON30');
  await page.getByRole('button', { name: /Conferma ordine/ }).click();
  await expect.poll(async () => (await state(page)).data.orders.find(item => item.id === orderId)).toMatchObject({ status: 'PENDING_SEND', note: 'Salvata senza rete', paymentId: 'PAY-BON30' });
  expect((await outbox(page)).length).toBeGreaterThan(2);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'I miei ordini' })).toBeVisible();
  expect((await state(page)).data.orders.filter(item => item.id === orderId)).toHaveLength(1);
  await navigate(page, '/catalog?q=0207423');
  await expect(page.locator('main')).toContainText('Esaurito');
  await navigate(page, '/customers/CLI-061001');
  await expect(page.getByRole('heading', { name: 'Osteria del Faro SRL', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  await page.screenshot({ path: `qa/rails/${info.project.name}-offline-customer.png`, fullPage: true });
  await context.setOffline(false);
  await page.evaluate(() => window.HFS.reconnect());
  await expect.poll(() => outbox(page), { timeout: 20000 }).toEqual([]);
  const server = await page.evaluate(() => fetch('/snapshot').then(response => response.json()));
  expect(server.state.data.orders.filter(item => item.id === orderId)).toHaveLength(1);
  expect(server.state.data.orders.find(item => item.id === orderId).totals.netCents).toBe(2250);
  await page.evaluate(() => window.HFS.reconnect());
  expect((await page.evaluate(() => fetch('/snapshot').then(response => response.json()))).version).toBe(server.version);
});

test('conflitto: due dispositivi non sovrascrivono modifiche e reset blocca vecchie operazioni', async ({ page, browser }) => {
  const second = await browser.newContext(); const other = await second.newPage();
  try {
    await login(other);
    await page.context().setOffline(true);
    await page.evaluate(() => window.HFS.client.enqueue('SAVE_REVIEW', { orderId: 'BOZ-26-00021', note: 'Copia offline' }));
    await command(other, 'SAVE_REVIEW', { orderId: 'BOZ-26-00021', note: 'Copia server' });
    await page.context().setOffline(false);
    await page.evaluate(() => window.HFS.reconnect());
    await expect.poll(() => page.evaluate(() => window.HFS.client.record.conflict?.kind)).toBe('version');
    expect((await state(page)).data.orders.find(item => item.id === 'BOZ-26-00021').note).toBe('Copia offline');
    expect((await outbox(page))).toHaveLength(1);
    const server = await other.evaluate(() => fetch('/snapshot').then(response => response.json()));
    expect(server.state.data.orders.find(item => item.id === 'BOZ-26-00021').note).toBe('Copia server');
    await page.evaluate(() => window.HFS.client.useServerVersion());
    expect(await page.evaluate(() => window.HFS.client.record.recovery.length)).toBe(1);
    await page.context().setOffline(true);
    await page.evaluate(() => window.HFS.client.enqueue('SAVE_REVIEW', { orderId: 'BOZ-26-00021', note: 'Prima del reset' }));
    await command(other, 'RESET_DEMO');
    await page.context().setOffline(false);
    await page.evaluate(() => window.HFS.reconnect());
    await expect.poll(() => page.evaluate(() => window.HFS.client.record.conflict?.kind)).toBe('version');
  } finally { await second.close(); }
});

test('sessione scaduta: outbox preservata e cache pubblica senza dati cliente', async ({ page, context }) => {
  await context.setOffline(true);
  await page.evaluate(() => window.HFS.client.enqueue('SAVE_REVIEW', { orderId: 'BOZ-26-00021', note: 'Da conservare' }));
  await context.clearCookies();
  await context.setOffline(false);
  await page.evaluate(() => window.HFS.reconnect());
  await expect.poll(() => page.evaluate(() => window.HFS.client.authRequired)).toBe(true);
  expect(await outbox(page)).toHaveLength(1);
  expect((await state(page)).data.orders.find(item => item.id === 'BOZ-26-00021').note).toBe('Da conservare');
  const cached = await page.evaluate(async () => {
    const results = [];
    for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) results.push(new URL(request.url).pathname);
    return results;
  });
  expect(cached).not.toContain('/snapshot'); expect(cached).not.toContain('/orders'); expect(cached).not.toContain('/');
  const shell = await page.evaluate(async () => (await caches.match('/offline')).text());
  expect(shell).not.toContain('Osteria del Faro'); expect(shell).not.toContain(email);
});

test('risposta persa dopo commit: retry idempotente e nessun duplicato', async ({ page, context }) => {
  const id = 'BOZ-' + crypto.randomUUID();
  await context.setOffline(true);
  await page.evaluate(id => window.HFS.client.enqueue('CREATE_DRAFT', { id, customerId: 'CLI-061001' }), id);
  await page.evaluate(() => {
    const client = window.HFS.client;
    client.testOriginalFetch = client.fetch;
    client.fetch = async (...args) => {
      const response = await client.testOriginalFetch(...args);
      if (String(args[0]) === '/commands' && response.ok) {
        window.testCommitted = true;
        throw new TypeError('Risposta di rete persa dopo il commit');
      }
      return response;
    };
  });
  await context.setOffline(false);
  await page.evaluate(() => window.HFS.reconnect());
  await expect.poll(() => page.evaluate(() => !!window.testCommitted), { timeout: 20000 }).toBe(true);
  expect(await outbox(page)).toHaveLength(1);
  const afterCommit = await page.evaluate(() => fetch('/snapshot').then(response => response.json()));
  expect(afterCommit.state.data.orders.filter(order => order.id === id)).toHaveLength(1);
  await page.evaluate(() => { window.HFS.client.fetch = window.HFS.client.testOriginalFetch; });
  await page.evaluate(() => window.HFS.reconnect());
  await expect.poll(() => outbox(page), { timeout: 20000 }).toEqual([]);
  const afterRetry = await page.evaluate(() => fetch('/snapshot').then(response => response.json()));
  expect(afterRetry.version).toBe(afterCommit.version);
  expect(afterRetry.state.data.orders.filter(order => order.id === id)).toHaveLength(1);
});

test('quota locale: transazione atomica e logout protetto finché esistono modifiche', async ({ page, context }) => {
  await context.setOffline(true);
  const failure = await page.evaluate(async () => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function () { throw new DOMException('Quota piena', 'QuotaExceededError'); };
    try { await window.HFS.client.enqueue('SAVE_REVIEW', { orderId: 'BOZ-26-00021', note: 'Non deve risultare salvata' }); }
    catch (error) { return error.name; }
    finally { IDBObjectStore.prototype.put = original; }
  });
  expect(failure).toBe('QuotaExceededError');
  expect(await outbox(page)).toEqual([]);
  expect((await state(page)).data.orders.find(order => order.id === 'BOZ-26-00021').note).not.toBe('Non deve risultare salvata');
  await page.evaluate(() => window.HFS.client.enqueue('SAVE_REVIEW', { orderId: 'BOZ-26-00021', note: 'Da sincronizzare prima di uscire' }));
  const logoutError = await page.evaluate(async () => {
    try { await window.HFS.client.logout(document.querySelector('.logout_form_js')); }
    catch (error) { return error.message; }
  });
  expect(logoutError).toContain('Sincronizza');
  expect(await outbox(page)).toHaveLength(1);
});

test('uscita completata elimina dati offline e non rivela il precedente account', async ({ page, context }) => {
  await page.evaluate(async () => { await window.HFS.client.logout(document.querySelector('.logout_form_js')); });
  await expect(page).toHaveURL(/users\/sign_in/);
  expect(await page.evaluate(() => localStorage.getItem('hfs-rails-active-user-v2'))).toBeNull();
  await context.setOffline(true);
  await page.goto('/');
  await expect(page.locator('main')).toContainText('Per il primo utilizzo accedi');
  await expect(page.locator('body')).not.toContainText('Osteria del Faro');
});

test('sessione di un altro account non riceve la coda del precedente utente', async ({ page, context }) => {
  const id = 'BOZ-' + crypto.randomUUID();
  await context.setOffline(true);
  await page.evaluate(id => window.HFS.client.enqueue('CREATE_DRAFT', { id, customerId: 'CLI-061001' }), id);
  await context.clearCookies(); await context.setOffline(false);
  const second = await context.newPage(); await login(second, 'agente@hfs.invalid');
  await page.waitForFunction(() => !window.HFS.client.syncing);
  await page.evaluate(async () => { window.HFS.client.authRequired = false; await window.HFS.client.sync(); });
  expect(await outbox(page)).toHaveLength(1);
  await expect.poll(() => page.evaluate(() => window.HFS.client.authRequired)).toBe(true);
  const other = await second.evaluate(() => fetch('/snapshot').then(response => response.json()));
  expect(other.user.email).toBe('agente@hfs.invalid');
  expect(other.state.data.orders.some(order => order.id === id)).toBe(false);
  await second.close();
});

test('viste offline essenziali: quattro dimensioni, dati e comandi raggiungibili', async ({ page, context }, info) => {
  test.setTimeout(120000); // Twenty full-page screenshots plus all controls on both browser engines.
  await context.setOffline(true); await page.reload();
  await page.waitForFunction(() => !!window.HFS?.client?.record);
  for (const [width, height] of [[390, 844], [768, 1024], [1024, 768], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    for (const [path, name] of [['/orders/new/customer', 'customers'], ['/orders/BOZ-26-00021/products?q=0107417', 'products'], ['/orders/BOZ-26-00021/lines/BOZ-26-00021-L01/edit', 'line'], ['/orders/BOZ-26-00021/review', 'review'], ['/catalog?q=latte', 'catalog']]) {
      await navigate(page, path);
      await expect(page.locator('main h1')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name} ${width}`).toBeTruthy();
      for (const button of await page.locator('main button[type=submit],main a.button').all()) {
        await button.scrollIntoViewIfNeeded();
        await expect(button).toBeVisible();
      }
      await page.screenshot({ path: `qa/rails/${info.project.name}-offline-${name}-${width}.png`, fullPage: true });
    }
  }
});

test('archivio corrotto: annullamento conserva originale e ripristino esplicito lo archivia', async ({ page }) => {
  const original = await page.evaluate(async () => {
    const storage = window.HFS.client.storage;
    const raw = { schemaVersion: 999, outbox: [{ operationId: 'local-unsent-original', payload: { note: 'Da riconciliare' } }], diagnostic: 'Archivio incompatibile' };
    await new Promise((resolve, reject) => {
      const tx = storage.db.transaction('workspace', 'readwrite');
      tx.objectStore('workspace').put(raw, 'state'); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
    return raw;
  });
  await page.reload();
  await page.waitForFunction(() => !!window.HFS?.storageFailure);
  expect(await page.evaluate(() => window.HFS.client.storage.readRaw())).toEqual(original);
  await page.evaluate(() => window.HFS.storageRecoveryDialog());
  await page.getByRole('button', { name: 'Annulla', exact: true }).click();
  expect(await page.evaluate(() => window.HFS.client.storage.readRaw())).toEqual(original);
  await page.evaluate(() => window.HFS.storageRecoveryDialog());
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Scarica archivio originale JSON', exact: true }).click();
  expect((await downloaded).suggestedFilename()).toBe('hfs-archivio-originale.json');
  await page.getByRole('button', { name: 'Ripristina dal server e conserva copia', exact: true }).click();
  await page.waitForFunction(() => !window.HFS.storageFailure && window.HFS.client.record?.schemaVersion === 2);
  expect(await page.evaluate(() => window.HFS.client.record.recovery[0].raw)).toEqual(original);
  expect(await outbox(page)).toEqual([]);
  await page.reload(); await page.waitForFunction(() => !!window.HFS?.client?.record);
  expect(await page.evaluate(() => window.HFS.client.record.recovery[0].raw)).toEqual(original);
});

test('archivio negato: modifica online via form Rails e nessun falso salvataggio offline', async ({ page }) => {
  await page.addInitScript(() => {
    IDBFactory.prototype.open = function () { throw new DOMException('Archivio negato', 'SecurityError'); };
  });
  await page.goto('/orders/BOZ-26-00021/review');
  await page.waitForFunction(() => !!window.HFS?.storageFailure);
  await page.getByLabel('Nota sul documento di consegna').fill('Salvata dal form Rails senza IndexedDB');
  const navigation = page.waitForEvent('framenavigated', frame => frame === page.mainFrame());
  await page.getByRole('button', { name: 'Salva bozza', exact: true }).click();
  await navigation;
  await page.waitForLoadState('load');
  const server = await page.evaluate(() => fetch('/snapshot').then(response => response.json()));
  expect(server.state.data.orders.find(order => order.id === 'BOZ-26-00021').note).toBe('Salvata dal form Rails senza IndexedDB');
  expect(await page.evaluate(() => !!window.HFS?.storageFailure)).toBe(true);
  await page.goto('/orders/BOZ-26-00021/lines/BOZ-26-00021-L01/edit');
  await page.waitForFunction(() => !!window.HFS?.storageFailure);
  await page.locator('.price_input_js').fill('1,50');
  await page.getByRole('button', { name: /Salva modifiche/ }).click();
  await page.waitForURL(/\/products/);
  const priced = await page.evaluate(() => fetch('/snapshot').then(response => response.json()));
  expect(priced.state.data.orders.find(order => order.id === 'BOZ-26-00021').lines[0].unitPriceBaseCents).toBe(150);
});

test('aggiornamento shell: risorse pubbliche rinfrescate senza alterare operazioni locali', async ({ page, context }) => {
  await context.setOffline(true);
  await page.evaluate(() => window.HFS.client.enqueue('SAVE_REVIEW', { orderId: 'BOZ-26-00021', note: 'Conservata durante aggiornamento' }));
  const pending = await outbox(page);
  await page.evaluate(async () => {
    const key = (await caches.keys()).find(name => name.startsWith('hfs-public-shell-'));
    const cache = await caches.open(key); const shell = await cache.match('/offline');
    await cache.put('/offline', new Response((await shell.text()).replace('App Agenti offline', 'SHELL PRECEDENTE'), { headers: shell.headers }));
    // Prevent automatic synchronization so this test isolates the asset update from user data.
    window.HFS.reconnect = async () => {};
  });
  await context.setOffline(false);
  await page.evaluate(async () => { window.HFS.offlinePrepared = false; await window.HFS.registerWorker(); });
  await readyOffline(page);
  expect(await outbox(page)).toEqual(pending);
  const shell = await page.evaluate(async () => (await caches.match('/offline')).text());
  expect(shell).not.toContain('SHELL PRECEDENTE'); expect(shell).not.toContain(email);
  await context.setOffline(true); await page.reload();
  await page.waitForFunction(() => !!window.HFS?.client?.record);
  expect(await outbox(page)).toEqual(pending);
  expect((await state(page)).data.orders.find(order => order.id === 'BOZ-26-00021').note).toBe('Conservata durante aggiornamento');
});

test('due schede: salvataggi simultanei serializzati e invio unico della stessa coda', async ({ page, context }) => {
  const second = await context.newPage(); await second.goto('/');
  await second.waitForFunction(() => !!window.HFS?.client?.record); await second.evaluate(() => window.HFS.ready);
  await context.setOffline(true);
  await Promise.all([
    page.evaluate(() => window.HFS.client.enqueue('SAVE_REVIEW', { orderId: 'BOZ-26-00021', note: 'Prima scheda' })),
    second.evaluate(() => window.HFS.client.enqueue('SAVE_REVIEW', { orderId: 'BOZ-26-00021', customerReference: 'Seconda scheda' }))
  ]);
  const pending = await page.evaluate(() => window.HFS.client.storage.read());
  expect(pending.outbox).toHaveLength(2);
  expect(pending.outbox[1].baseVersion).toBe(pending.outbox[0].baseVersion + 1);
  await context.setOffline(false);
  await Promise.all([page.evaluate(() => window.HFS.reconnect()), second.evaluate(() => window.HFS.reconnect())]);
  await expect.poll(() => outbox(page), { timeout: 20000 }).toEqual([]);
  const server = await page.evaluate(() => fetch('/snapshot').then(response => response.json()));
  expect(server.version).toBe(pending.server.version + 2);
  expect(server.state.data.orders.find(order => order.id === 'BOZ-26-00021')).toMatchObject({ note: 'Prima scheda', customerReference: 'Seconda scheda' });
  await second.close();
});

test('token CSRF rinnovato: stesso comando ritentato senza conflitto o duplicati', async ({ page }) => {
  const before = await page.evaluate(() => fetch('/snapshot').then(response => response.json()));
  await page.evaluate(async () => {
    const client = window.HFS.client;
    await client.enqueue('SAVE_REVIEW', { orderId: 'BOZ-26-00021', note: 'Token aggiornato automaticamente' });
    client.setCsrf('token-scaduto'); await client.sync();
  });
  expect(await outbox(page)).toEqual([]);
  expect(await page.evaluate(() => window.HFS.client.record.conflict)).toBeNull();
  const server = await page.evaluate(() => fetch('/snapshot').then(response => response.json()));
  expect(server.version).toBe(before.version + 1);
  expect(server.state.data.orders.find(order => order.id === 'BOZ-26-00021').note).toBe('Token aggiornato automaticamente');
});

test('uscita concorrente: altra scheda non può aggiungere operazioni durante il logout', async ({ page, context }) => {
  const second = await context.newPage(); await second.goto('/');
  await second.waitForFunction(() => !!window.HFS?.client?.record); await second.evaluate(() => window.HFS.ready);
  const holdLogout = async fail => {
    await page.evaluate(fail => {
      const client = window.HFS.client;
      client.testOriginalFetch ||= client.fetch;
      client.fetch = async (...args) => {
        if (String(args[0]).includes('/users/sign_out')) {
          await new Promise(resolve => { window.releaseLogout = resolve; });
          if (fail) throw new TypeError('Connessione interrotta prima dell’uscita');
        }
        return client.testOriginalFetch(...args);
      };
      window.logoutResult = client.logout(document.querySelector('.logout_form_js')).then(() => null).catch(error => error.message);
    }, fail);
    await page.waitForFunction(() => !!window.HFS.client.record.closing);
    const error = await second.evaluate(async () => {
      try { await window.HFS.client.enqueue('SAVE_REVIEW', { orderId: 'BOZ-26-00021', note: 'Non eliminare senza avviso' }); }
      catch (error) { return error.message; }
    });
    expect(error).toContain('Uscita in corso');
    expect(await page.evaluate(async () => (await window.HFS.client.storage.read()).outbox)).toEqual([]);
  };
  await holdLogout(true);
  await page.evaluate(() => window.releaseLogout());
  expect(await page.evaluate(() => window.logoutResult)).toContain('Connessione interrotta');
  expect(await page.evaluate(async () => (await window.HFS.client.storage.read()).closing)).toBeUndefined();
  await second.evaluate(() => {
    const client = window.HFS.client, fetchOriginal = client.fetch;
    client.fetch = async (...args) => {
      const response = await fetchOriginal(...args);
      if (String(args[0]) === '/snapshot') await new Promise(resolve => { window.releaseSnapshot = resolve; });
      return response;
    };
    window.lateSnapshot = client.refresh().then(() => 'unexpected-success').catch(error => error.message);
  });
  await second.waitForFunction(() => !!window.releaseSnapshot);
  await holdLogout(false);
  await page.evaluate(() => window.releaseLogout());
  await expect(page).toHaveURL(/users\/sign_in/);
  expect(await second.evaluate(() => localStorage.getItem('hfs-rails-active-user-v2'))).toBeNull();
  await second.evaluate(() => window.releaseSnapshot());
  expect(await second.evaluate(() => window.lateSnapshot)).toContain('Sessione locale chiusa');
  expect(await second.evaluate(() => localStorage.getItem('hfs-rails-active-user-v2'))).toBeNull();
  expect(await second.evaluate(async () => (await indexedDB.databases()).some(db => db.name === `hfs-rails-user-v2-${window.HFS.client.userId}`))).toBe(false);
  await second.close();
});
