// Müteahhit Online - High-Performance Resilient Service Worker Cache
const CACHE_NAME = 'muteahhit-cache-v5';
const STATIC_ASSET_REGEX = /\.(?:glb|gltf|wasm|webp|png|jpg|jpeg|svg|mp3|wav|ogg|woff2?|ttf|eot)$/i;

// Install event: Pre-cache SPA shell (index.html) and skip waiting
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/', '/index.html', '/favicon.svg']).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Activate event: Clean up legacy caches and immediately take control
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

// Fetch event
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
    url.pathname.startsWith('/wsrelay') ||
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
        const cachedResponse = await cache.match(request, { ignoreSearch: true });
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
          return cachedResponse || new Response('', { status: 404, statusText: 'Not Found' });
        }
      })
    );
    return;
  }

  // 2. Network-First with Resilient SPA Shell Fallback for HTML Documents (e.g. /?room=X2W5QG)
  if (request.destination === 'document' || request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('/index.html', clone);
              cache.put(request, clone.clone());
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Query string içeren SPA linklerinde (?room=XYZ) önbellekteki ana sayfayı (index.html) sun
          const cached = (await caches.match(request, { ignoreSearch: true }))
            || (await caches.match('/index.html'))
            || (await caches.match('/'));
          if (cached) {
            return cached;
          }

          // Önbellekte hiç sayfa yoksa dahi düz metin "Offline" 503 vermek yerine otomatik yenileyen kurtarma sayfası dön:
          return new Response(
            `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Müteahhit Online | Bağlantı</title><style>body{background:#020617;color:#f8fafc;font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;text-align:center}h2{color:#f59e0b;margin-bottom:8px}.spin{width:36px;height:36px;border:3px solid rgba(245,158,11,0.2);border-top-color:#f59e0b;border-radius:50%;animation:s 1s linear infinite;margin-bottom:16px}@keyframes s{to{transform:rotate(360deg)}}button{margin-top:16px;padding:12px 24px;background:#f59e0b;color:#020617;font-weight:bold;border:none;border-radius:12px;cursor:pointer;font-size:14px}</style></head><body><div class="spin"></div><h2>Bağlantı Kuruluyor...</h2><p style="color:#94a3b8;font-size:14px;max-width:320px">Oyun açılıyor, lütfen bekleyin...</p><button onclick="window.location.reload()">Yeniden Dene</button><script>setTimeout(function(){window.location.reload();},2000);</script></body></html>`,
            {
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            }
          );
        })
    );
    return;
  }

  // 3. Stale-While-Revalidate Strategy for JS chunks and CSS
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request, { ignoreSearch: true });
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            const contentType = networkResponse?.headers?.get('content-type') || '';
            // Sunucu SPA HTML fallback dönerse asla script/style gibi önbelleğe alma!
            if (networkResponse && networkResponse.status === 200 && !contentType.includes('text/html')) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }
});
