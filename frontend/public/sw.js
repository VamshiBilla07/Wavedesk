// Wavedesk Progressive Web App (PWA) Service Worker
const CACHE_NAME = 'wavedesk-v1';
const STATIC_ASSETS = ['/', '/dashboard', '/icon.svg', '/manifest.json'];

// Install event: pre-cache critical shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event: clean up stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event: network-first for dynamic content, cache fallback for assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass cache for API, webhooks, and Socket.io transport requests
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/socket.io') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache successful responses for static chunks
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (url.pathname.startsWith('/_next/static') || url.pathname.endsWith('.svg') || url.pathname.endsWith('.png'))
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        // Offline fallback to cache
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        if (event.request.mode === 'navigate') {
          return caches.match('/dashboard');
        }
      })
  );
});
