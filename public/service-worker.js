/* Only public application assets are cached. User data lives in isolated IndexedDB databases. */
const CACHE = 'hfs-public-shell-v2-20261012';
const PUBLIC_PATHS = ['/offline', '/manifest.webmanifest', '/icons/hfs-192.png', '/icons/hfs-512.png', '/icons/hfs-180.png'];
const isPublic = url => url.origin === self.location.origin && (PUBLIC_PATHS.includes(url.pathname) || url.pathname.startsWith('/assets/'));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PUBLIC_PATHS)));
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
  const assets = [...new Set(event.data.assets)].map(value => new URL(value, self.location.origin)).filter(isPublic);
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const failed = [];
    await Promise.all(assets.map(async url => {
      try { const response = await fetch(url.href, { credentials: 'same-origin' }); if (response.ok && !response.redirected) await cache.put(url.href, response); else failed.push(url.pathname); } catch { failed.push(url.pathname); }
    }));
    if (!failed.length) {
      try { const shell = await fetch('/offline', { cache: 'no-store' }); if (shell.ok && !shell.redirected) await cache.put('/offline', shell); else failed.push('/offline'); } catch { failed.push('/offline'); }
    }
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
        const response = await caches.match('/offline', { cacheName: CACHE });
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
