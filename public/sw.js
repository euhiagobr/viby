
const CACHE_NAME = 'viby-image-cache-v1';
const MAX_IMAGES = 200;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Somente cachear imagens de domínios conhecidos
  const isCachableImage = 
    request.destination === 'image' && 
    (url.hostname === 'firebasestorage.googleapis.com' || 
     url.hostname === 'picsum.photos' || 
     url.hostname === 'images.unsplash.com');

  if (isCachableImage) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
            limitCacheSize(cache, MAX_IMAGES);
          });

          return networkResponse;
        });
      })
    );
  }
});

function limitCacheSize(cache, maxItems) {
  cache.keys().then((keys) => {
    if (keys.length > maxItems) {
      cache.delete(keys[0]).then(() => limitCacheSize(cache, maxItems));
    }
  });
}
