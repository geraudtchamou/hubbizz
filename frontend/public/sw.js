// Service Worker for offline-first PWA functionality
// Optimized for low-bandwidth African markets

const CACHE_NAME = 'afrihub-v1';
const STATIC_CACHE = 'afrihub-static-v1';
const DYNAMIC_CACHE = 'afrihub-dynamic-v1';

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => {
            console.log('Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // API requests - network first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Image requests - cache first with network fallback
  if (request.destination === 'image') {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Static assets - cache first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // HTML pages - network first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstStrategy(request, true));
    return;
  }

  // Default - network first
  event.respondWith(networkFirstStrategy(request));
});

// Network-first strategy for dynamic content
async function networkFirstStrategy(request: Request, isNavigation = false) {
  try {
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('Network failed, trying cache:', error);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page for navigation requests
    if (isNavigation) {
      const offlinePage = await caches.match('/offline.html');
      return offlinePage || new Response('Offline', { status: 503 });
    }

    return new Response('Offline', { status: 503 });
  }
}

// Cache-first strategy for static assets and images
async function cacheFirstStrategy(request: Request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    // Update cache in background
    fetch(request).then((response) => {
      if (response.ok) {
        caches.open(DYNAMIC_CACHE).then((cache) => {
          cache.put(request, response);
        });
      }
    }).catch(() => {});
    
    return cachedResponse;
  }

  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('Fetch failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

// Check if URL is a static asset
function isStaticAsset(pathname: string): boolean {
  const staticExtensions = ['.js', '.css', '.woff', '.woff2', '.ttf', '.eot'];
  return staticExtensions.some((ext) => pathname.endsWith(ext));
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-leads') {
    event.waitUntil(syncLeads());
  }
});

async function syncLeads() {
  // Get pending leads from IndexedDB
  // This would be implemented with the frontend
  console.log('Syncing pending leads...');
}

// Push notifications for business updates
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const { title, body, icon, badge } = data;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || '/icon-192.png',
      badge: badge || '/icon-192.png',
      vibrate: [200, 100, 200],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: 1,
      },
    })
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
