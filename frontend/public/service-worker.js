/* eslint-disable no-restricted-globals */

// Cache version - increment when you want to force update
const CACHE_VERSION = 'cooking-sync-v2';
const STATIC_CACHE = 'cooking-sync-static-v2';
const DYNAMIC_CACHE = 'cooking-sync-dynamic-v2';

// Files to cache for offline access
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-96.png',
  '/icon-144.png',
  '/icon-192.png',
  '/icon-384.png',
  '/icon-512.png',
  '/offline.html'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[ServiceWorker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[ServiceWorker] Installed successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[ServiceWorker] Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');
  const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE];
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!currentCaches.includes(cacheName)) {
              console.log('[ServiceWorker] Removing old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[ServiceWorker] Activated successfully');
        return self.clients.claim();
      })
  );
});

// Fetch event - network first for API, cache first for static
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // API calls - network only (don't cache user data)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .catch(() => {
          return new Response(
            JSON.stringify({ error: 'You are offline. Please check your connection.' }),
            { 
              status: 503, 
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // Static assets - cache first, then network
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version and update cache in background
          event.waitUntil(
            fetch(request)
              .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                  caches.open(DYNAMIC_CACHE)
                    .then((cache) => cache.put(request, networkResponse));
                }
              })
              .catch(() => {})
          );
          return cachedResponse;
        }

        // Not in cache - fetch from network
        return fetch(request)
          .then((networkResponse) => {
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }

            // Cache the new response
            const responseToCache = networkResponse.clone();
            caches.open(DYNAMIC_CACHE)
              .then((cache) => cache.put(request, responseToCache));

            return networkResponse;
          })
          .catch(() => {
            // Offline fallback for navigation requests
            if (request.mode === 'navigate') {
              return caches.match('/offline.html') || caches.match('/index.html');
            }
            return new Response('Offline', { status: 503 });
          });
      })
  );
});

// Background Sync - sync data when back online
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Background sync:', event.tag);
  
  if (event.tag === 'sync-cooking-data') {
    event.waitUntil(syncCookingData());
  }
  
  if (event.tag === 'sync-dishes') {
    event.waitUntil(syncDishes());
  }
});

async function syncCookingData() {
  console.log('[ServiceWorker] Syncing cooking data...');
  // Get pending data from IndexedDB and sync to server
  try {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'SYNC_COMPLETE', data: 'cooking-data' });
    });
  } catch (error) {
    console.error('[ServiceWorker] Sync failed:', error);
  }
}

async function syncDishes() {
  console.log('[ServiceWorker] Syncing dishes...');
  try {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'SYNC_COMPLETE', data: 'dishes' });
    });
  } catch (error) {
    console.error('[ServiceWorker] Dish sync failed:', error);
  }
}

// Periodic Background Sync - check for updates periodically
self.addEventListener('periodicsync', (event) => {
  console.log('[ServiceWorker] Periodic sync:', event.tag);
  
  if (event.tag === 'update-cooking-data') {
    event.waitUntil(updateCookingData());
  }
});

async function updateCookingData() {
  console.log('[ServiceWorker] Periodic update check...');
  // Check for app updates or sync data
}

// Push Notifications
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push notification received');
  
  let notificationData = {
    title: 'Cooking Sync',
    body: 'Time to check your dish!',
    icon: '/icon-192.png',
    badge: '/icon-96.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: 'cooking-timer',
    renotify: true,
    requireInteraction: true,
    actions: [
      { action: 'view', title: 'View Timer', icon: '/icon-96.png' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    data: {
      url: '/',
      timestamp: Date.now()
    }
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = { ...notificationData, ...payload };
    } catch (e) {
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification clicked:', event.action);
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if available
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Notification close handler
self.addEventListener('notificationclose', (event) => {
  console.log('[ServiceWorker] Notification closed');
});

// Message handler - communicate with main app
self.addEventListener('message', (event) => {
  console.log('[ServiceWorker] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(DYNAMIC_CACHE)
        .then((cache) => cache.addAll(event.data.urls))
    );
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((names) => {
        return Promise.all(names.map((name) => caches.delete(name)));
      })
    );
  }
});

// Share Target handler
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (url.pathname === '/share' && event.request.method === 'GET') {
    event.respondWith(
      (async () => {
        const params = url.searchParams;
        const sharedData = {
          name: params.get('name') || params.get('title'),
          description: params.get('description') || params.get('text'),
          link: params.get('link') || params.get('url')
        };
        
        // Redirect to main app with shared data
        const redirectUrl = `/?shared=${encodeURIComponent(JSON.stringify(sharedData))}`;
        return Response.redirect(redirectUrl, 303);
      })()
    );
  }
});

console.log('[ServiceWorker] Script loaded');
