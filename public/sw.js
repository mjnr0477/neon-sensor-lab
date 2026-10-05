const CACHE = 'neon-sensor-lab-v3';
const CORE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/research-engine.js',
  '/ble-engine.js',
  '/ble-stream.js',
  '/sensor-source.js',
  '/session-store.js',
  '/dataset-manager.js',
  '/research-session.js',
  '/research-diagnostics.js',
  '/research-quality.js',
  '/dataset-explorer.js',
  '/experiment-protocol.js',
  '/measurement-registry.js',
  '/storage-manager.js',
  '/pwa.js',
  '/manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const request = event.request;
  const isAppAsset =
    request.url.startsWith(self.location.origin) &&
    (request.destination === 'document' ||
      request.destination === 'script' ||
      request.destination === 'style' ||
      request.destination === 'manifest');

  event.respondWith(
    (isAppAsset ? fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy));
      }
      return response;
    }) : fetch(request))
      .catch(() => caches.match(request).then(cached => cached || caches.match('/index.html')))
  );
});
