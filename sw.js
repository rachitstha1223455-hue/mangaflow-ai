
const CACHE = 'manhwa-flow-v2';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith('manhwa-flow-') && key !== CACHE)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  // Always fetch the latest manifest.
  if (url.pathname.endsWith('/manifest.json')) {
    event.respondWith(fetch(request));
    return;
  }

  // Network-first for website navigation.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache =>
          cache.put(request, copy)
        );
        return response;
      }).catch(() =>
        caches.match(request).then(cached =>
          cached || caches.match('./index.html')
        )
      )
    );
  }
});
