import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function harness() {
  const origin = 'https://local.example.invalid', events = {}, buckets = new Map();
  const requests = []; let online = true, missing = null;
  const key = value => new URL(typeof value === 'string' ? value : value.url, origin).href;
  const caches = {
    keys: async () => [...buckets.keys()], delete: async name => buckets.delete(name),
    open: async name => { if (!buckets.has(name)) buckets.set(name, new Map()); const data = buckets.get(name); return { put: async (url, response) => data.set(key(url), response.clone()), match: async url => data.get(key(url))?.clone() }; },
    match: async (url, options = {}) => { for (const [name, data] of buckets) if (!options.cacheName || options.cacheName === name) { const item = data.get(key(url)); if (item) return item.clone(); } }
  };
  const fetch = async input => {
    const url = new URL(key(input)); requests.push(url.pathname);
    if (!online || url.pathname === missing) throw Error('simulated network failure');
    if (url.pathname.endsWith('/offline')) return new Response(`<html><link rel="stylesheet" href="/assets/current.css"><img src="/assets/original-logo.png"><script type="importmap">{"imports":{"app":"/assets/current.js"}}</script><body>${url.pathname}</body></html>`);
    return new Response('current public asset');
  };
  vm.runInNewContext(fs.readFileSync('public/service-worker.js', 'utf8'), { URL, Response, caches, fetch,
    self: { location: { origin }, clients: { claim: async () => {} }, addEventListener: (name, handler) => { events[name] = handler; } } });
  const fire = (name, extra = {}) => new Promise((resolve, reject) => {
    events[name]({ ...extra, waitUntil: promise => Promise.resolve(promise).then(resolve, reject), respondWith: promise => Promise.resolve(promise).then(resolve, reject) });
  });
  return { caches, buckets, requests, fire, offline: () => { online = false; }, missing: path => { missing = path; } };
}

test('worker upgrade caches both shells, scripts, styles and original logo before removing old public caches', async () => {
  const h = harness();
  await (await h.caches.open('hfs-public-shell-v3-old')).put('/assets/old.js', new Response('old asset'));
  await (await h.caches.open('unrelated-app')).put('/other', new Response('unrelated'));
  await h.fire('install'); h.offline(); await h.fire('activate');
  const shell = await h.fire('fetch', { request: { method: 'GET', url: 'https://local.example.invalid/amelia3/orders', mode: 'navigate' } });
  assert.match(await shell.text(), /\/amelia3\/offline/);
  for (const asset of ['current.js', 'current.css', 'original-logo.png']) {
    const response = await h.fire('fetch', { request: { method: 'GET', url: `https://local.example.invalid/assets/${asset}`, mode: 'cors' } });
    assert.equal(await response.text(), 'current public asset');
  }
  assert.ok(!h.buckets.has('hfs-public-shell-v3-old')); assert.ok(h.buckets.has('unrelated-app'));
  assert.ok(!h.requests.some(path => path.includes('snapshot') || path.includes('commands')));
});

test('failed preparation never publishes incomplete shells or deletes the previous version', async () => {
  const h = harness();
  await (await h.caches.open('hfs-public-shell-v3-old')).put('/offline', new Response('previous intact'));
  h.missing('/assets/current.js');
  await assert.rejects(h.fire('install'), /Preparazione offline incompleta/);
  assert.equal(h.buckets.size, 1);
  assert.equal(await (await h.caches.match('/offline')).text(), 'previous intact');
});

test('a stale page cannot pin the old importmap or cache private/external URLs during refresh', async () => {
  const h = harness(); let result;
  await h.fire('message', { data: { type: 'PRECACHE', assets: ['/assets/old.js', '/amelia3/snapshot', '/amelia3/customers', 'https://external.invalid/assets/a.js'] }, source: { postMessage: value => { result = value; } } });
  assert.equal(result.failed.length, 0);
  assert.ok(h.requests.includes('/assets/current.js'));
  assert.ok(!h.requests.includes('/amelia3/snapshot')); assert.ok(!h.requests.includes('/amelia3/customers'));
  assert.match(await (await h.caches.match('/amelia3/offline')).text(), /current.js/);
});
