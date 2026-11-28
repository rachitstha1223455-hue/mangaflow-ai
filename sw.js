/* Offline-first service worker for the static GitHub Pages app. */
const CACHE = 'manhwa-flow-v5';
const PRECACHE = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './js/storage.js',
  './js/ai/provider-manager.js',
  './js/story/story-intelligence.js',
  './js/story/story-bible.js',
  './js/scenes/scene-intelligence.js',
  './js/comic/comic-studio.js',
  './js/audio/audio-studio.js',
  './js/audio/audio-ui.js',
  './js/video/video-studio.js',
  './js/video/video-ui.js',
  './js/core/project-data.js',
  './js/core/project-bundle.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE.map(path => new Request(new URL(path, self.registration.scope), { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith('manhwa-flow-') && key !== CACHE).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        if (response && response.ok) await cache.put(request, response.clone());
        return response;
      } catch (_) {
        return (await cache.match(request)) ||
          (await cache.match(new URL('./index.html', self.registration.scope).href)) ||
          Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok) await cache.put(request, response.clone());
      return response;
    } catch (_) {
      return Response.error();
    }
  })());
});
