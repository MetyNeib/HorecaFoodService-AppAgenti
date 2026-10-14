/* Only public application assets are cached. User data lives in isolated IndexedDB databases. */
const CACHE = 'hfs-public-shell-v6-amelia3-feeds-20261015';
const PUBLIC_PATHS = ['/offline', '/amelia3/offline', '/manifest.webmanifest', '/icons/hfs-192.png', '/icons/hfs-512.png', '/icons/hfs-180.png'];
const isPublic = url => url.origin === self.location.origin && (PUBLIC_PATHS.includes(url.pathname) || url.pathname.startsWith('/assets/'));

async function preparePublicShells(extraAssets = []) {
  const shellPaths = ['/offline', '/amelia3/offline'];
  const failed = [], assets = [...extraAssets, ...PUBLIC_PATHS];
  const shells = await Promise.all(shellPaths.map(async path => {
    try {
      const response = await fetch(path, { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok || response.redirected) throw new Error('Shell non disponibile');
      const markup = await response.clone().text();
      const importmap = JSON.parse(markup.match(/<script\b[^>]*type=["']importmap["'][^>]*>([\s\S]*?)<\/script>/i)?.[1] || '{}');
      assets.push(...Object.values(importmap.imports || {}));
      for (const match of markup.matchAll(/<(?:link|script|img)\b[^>]*(?:href|src)=["']([^"']+)["'][^>]*>/gi)) assets.push(match[1]);
      return [path, response];
    } catch { failed.push(path); return null; }
  }));
  const urls = [...new Set(assets)].map(value => new URL(value, self.location.origin))
    .filter(url => isPublic(url) && !shellPaths.includes(url.pathname));
  const prepared = await Promise.all(urls.map(async url => {
    try {
      const response = await fetch(url.href, { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok || response.redirected) throw new Error('Risorsa non disponibile');
      return [url.href, response];
    } catch { failed.push(url.pathname); return null; }
  }));
  if (!failed.length) {
    const cache = await caches.open(CACHE);
    await Promise.all(prepared.map(([url, response]) => cache.put(url, response)));
    // Publish neutral shells only after their entire asset graph has been saved.
    await Promise.all(shells.map(([url, response]) => cache.put(url, response)));
  }
  return failed;
}

self.addEventListener('install', event => {
  // A waiting upgrade prepares its own cache before activation removes the previous
  // version. It must not depend on a message sent to the still-active old worker.
  event.waitUntil(preparePublicShells().then(failed => { if (failed.length) throw new Error('Preparazione offline incompleta'); }));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Other applications and private IndexedDB data are never touched by asset upgrades.
    for (const name of await caches.keys()) if (name.startsWith('hfs-public-shell-') && name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'PRECACHE' || !Array.isArray(event.data.assets)) return;
  event.waitUntil((async () => {
    let failed;
    try { failed = await preparePublicShells(event.data.assets); }
    catch { failed = ['/offline', '/amelia3/offline']; }
    // A login redirect can create a new document after activation's first claim.
    // Claim again before announcing readiness so that initial offline reloads
    // are controlled as well as documents that existed during activation.
    await self.clients.claim();
    event.source?.postMessage({ type: 'PRECACHE_COMPLETE', failed });
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try { return await fetch(request); }
      catch {
        const response = await caches.match(url.pathname.startsWith('/amelia3') ? '/amelia3/offline' : '/offline', { cacheName: CACHE });
        return response || new Response('Collegati al server per preparare l’app offline.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
  } else if (isPublic(url)) {
    event.respondWith((async () => {
      const cached = await caches.match(request, { cacheName: CACHE });
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && !response.redirected) { const cache = await caches.open(CACHE); await cache.put(request, response.clone()); }
      return response;
    })());
  }
});
