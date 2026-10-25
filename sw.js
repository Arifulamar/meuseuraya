const CACHE = 'meuseuraya-inklusi-root-v3';
const BASE_URL = new URL('./', self.registration.scope);
const INDEX_URL = new URL('index.html', BASE_URL).href;
const ASSETS = [
  BASE_URL.href,
  INDEX_URL,
  new URL('styles.css', BASE_URL).href,
  new URL('app.js', BASE_URL).href,
  new URL('manifest.webmanifest', BASE_URL).href,
  new URL('icon.svg', BASE_URL).href
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('meuseuraya-inklusi-') && key !== CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(INDEX_URL, copy));
          return response;
        }
        return caches.match(INDEX_URL).then(cached => cached || response);
      }).catch(() =>
        caches.match(request).then(cached =>
          cached || caches.match(INDEX_URL)
        )
      )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});