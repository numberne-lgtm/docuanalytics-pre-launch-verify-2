/* DocuAnalytics service worker — network-first for fresh assets, cache fallback offline */
const CACHE = 'docuanalytics-v2';
const CORE = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // never intercept API calls or cross-origin resources (CDNs, PayPal, analytics)
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api')) return;

  // network-first for page navigations so the SPA always gets fresh HTML
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html')));
    return;
  }

  // network-first for static assets: always fetch fresh when online, update cache,
  // fall back to cache only when offline. Prevents stale bundles/logos in preview & prod.
  event.respondWith(
    fetch(request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(request))
  );
});
