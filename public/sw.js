// BandForge service worker: offline app shell + cache-first instrument samples.
const SHELL = 'bandforge-shell';
const SAMPLES = 'bandforge-samples-v1';
const SAMPLE_HOSTS = ['tonejs.github.io', 'nbrosowsky.github.io'];
const CORE = ['./', './index.html', './manifest.webmanifest', './favicon.svg', './icon-192.png', './icon-512.png'];

async function readManifest(fromNetwork) {
  try {
    const res = fromNetwork ? await fetch('./asset-manifest.json', { cache: 'no-store' }) : await (await caches.open(SHELL)).match('./asset-manifest.json');
    return res && res.ok ? await res.clone().json() : null;
  } catch {
    return null;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      const manifest = await readManifest(true);
      const files = manifest ? manifest.files.map((f) => './' + f) : [];
      // Keep the previous version's file list so pages still running it can lazy-load chunks.
      const prev = await cache.match('./asset-manifest.json');
      if (prev) await cache.put('./asset-manifest.prev.json', prev);
      await cache.addAll([...CORE, ...files.filter((f) => !CORE.includes(f))]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      const keep = new Set();
      for (const key of ['./asset-manifest.json', './asset-manifest.prev.json']) {
        const res = await cache.match(key);
        if (!res) continue;
        try {
          for (const f of (await res.json()).files) keep.add(new URL('./' + f, self.registration.scope).href);
        } catch {
          /* ignore */
        }
      }
      if (keep.size) {
        for (const req of await cache.keys()) {
          const path = new URL(req.url).pathname;
          if (path.includes('/assets/') && !keep.has(req.url)) await cache.delete(req);
        }
      }
      for (const name of await caches.keys()) if (name.startsWith('bandforge-samples-') && name !== SAMPLES) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

async function cacheFirst(cacheName, request) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
  return res;
}

async function networkFirstPage(request) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put('./index.html', res.clone());
    return res;
  } catch {
    return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (SAMPLE_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(SAMPLES, req));
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(networkFirstPage(req));
    return;
  }
  if (url.pathname.endsWith('asset-manifest.json')) return;
  event.respondWith(cacheFirst(SHELL, req));
});
