// Müteahhit Online - High-Performance Service Worker Cache
const CACHE_NAME = 'muteahhit-cache-v2';
const STATIC_ASSET_REGEX = /\.(?:glb|gltf|wasm|webp|png|jpg|jpeg|svg|mp3|wav|ogg|woff2?|ttf|eot)$/i;

// Install event: skip waiting to activate immediately
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Activate event: clean up legacy caches and take control of all clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event: Cache-First for static assets (GLB models, WebP images, Audio, WASM)
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only intercept GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Bypass API, WebSocket, and PeerJS connections
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/peerjs') ||
    url.pathname.startsWith('/socket.io') ||
    url.protocol === 'ws:' ||
    url.protocol === 'wss:'
  ) {
    return;
  }

  // 1. Cache-First Strategy for static heavy assets (3D GLBs, Draco WASM, WebP, Sounds, Fonts)
  if (
    STATIC_ASSET_REGEX.test(url.pathname) ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('fonts.googleapis.com')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          return cachedResponse || new Response('Offline asset unavailable', { status: 503 });
        }
      })
    );
    return;
  }

  // 2. Network-First Strategy for HTML Documents (always get fresh bundle index when online)
  if (request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || new Response('Offline', { status: 503 });
        })
    );
    return;
  }

  // 3. Stale-While-Revalidate Strategy for JS chunks and CSS
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
  }
});
