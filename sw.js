// Service Worker for AI Productivity Tracker PWA
// Provides offline functionality and caching

const CACHE_NAME = 'ai-productivity-tracker-v1.0.0';
const STATIC_CACHE_NAME = `${CACHE_NAME}-static`;
const DYNAMIC_CACHE_NAME = `${CACHE_NAME}-dynamic`;

// Files to cache for offline functionality
const STATIC_FILES = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/firebase-config.js',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    // Firebase CDN files (will be cached when first requested)
    'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js'
];

// Maximum number of items in dynamic cache
const DYNAMIC_CACHE_LIMIT = 50;

// Install event - cache static files
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching static files');
                return cache.addAll(STATIC_FILES);
            })
            .then(() => {
                console.log('Service Worker: Static files cached successfully');
                return self.skipWaiting(); // Activate immediately
            })
            .catch((error) => {
                console.error('Service Worker: Error caching static files:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        // Delete old caches that don't match current version
                        if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
                            console.log('Service Worker: Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker: Activated successfully');
                return self.clients.claim(); // Take control of all clients
            })
            .catch((error) => {
                console.error('Service Worker: Error during activation:', error);
            })
    );
});

// Fetch event - intercept network requests
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-HTTP requests
    if (!request.url.startsWith('http')) {
        return;
    }
    
    // Handle different types of requests
    if (isStaticFile(request.url)) {
        // Static files: Cache First strategy
        event.respondWith(cacheFirst(request));
    } else if (isFirebaseRequest(request.url)) {
        // Firebase requests: Network First strategy (for real-time data)
        event.respondWith(networkFirst(request));
    } else if (isAPIRequest(request.url)) {
        // API requests: Network First strategy
        event.respondWith(networkFirst(request));
    } else {
        // Other requests: Cache First with network fallback
        event.respondWith(cacheFirst(request));
    }
});

/**
 * Cache First strategy - check cache first, then network
 * Good for static resources that don't change often
 */
async function cacheFirst(request) {
    try {
        // Try to get from cache first
        const cacheResponse = await caches.match(request);
        if (cacheResponse) {
            console.log('Service Worker: Serving from cache:', request.url);
            return cacheResponse;
        }
        
        // If not in cache, fetch from network
        const networkResponse = await fetch(request);
        
        // Cache the response for future use
        if (networkResponse.status === 200) {
            const cache = await caches.open(STATIC_CACHE_NAME);
            cache.put(request, networkResponse.clone());
            console.log('Service Worker: Cached new resource:', request.url);
        }
        
        return networkResponse;
        
    } catch (error) {
        console.error('Service Worker: Cache first failed:', error);
        
        // Return offline fallback if available
        if (request.destination === 'document') {
            const fallback = await caches.match('/index.html');
            return fallback || new Response('Offline', { status: 503 });
        }
        
        return new Response('Offline', { status: 503 });
    }
}

/**
 * Network First strategy - try network first, then cache
 * Good for dynamic data that should be fresh when possible
 */
async function networkFirst(request) {
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse.status === 200) {
            const cache = await caches.open(DYNAMIC_CACHE_NAME);
            
            // Limit cache size
            await limitCacheSize(DYNAMIC_CACHE_NAME, DYNAMIC_CACHE_LIMIT);
            
            cache.put(request, networkResponse.clone());
            console.log('Service Worker: Cached dynamic resource:', request.url);
        }
        
        return networkResponse;
        
    } catch (error) {
        console.log('Service Worker: Network failed, trying cache:', request.url);
        
        // If network fails, try cache
        const cacheResponse = await caches.match(request);
        if (cacheResponse) {
            console.log('Service Worker: Serving stale data from cache:', request.url);
            return cacheResponse;
        }
        
        // Return appropriate offline response
        return new Response('Offline', { status: 503 });
    }
}

/**
 * Check if request is for a static file
 */
function isStaticFile(url) {
    return STATIC_FILES.some(file => url.includes(file)) ||
           url.includes('.css') ||
           url.includes('.js') ||
           url.includes('.png') ||
           url.includes('.jpg') ||
           url.includes('.ico') ||
           url.includes('.svg');
}

/**
 * Check if request is for Firebase services
 */
function isFirebaseRequest(url) {
    return url.includes('firestore.googleapis.com') ||
           url.includes('firebase') ||
           url.includes('gstatic.com/firebasejs');
}

/**
 * Check if request is for API endpoints
 */
function isAPIRequest(url) {
    return url.includes('/api/') ||
           url.includes('firestore.googleapis.com');
}

/**
 * Limit cache size by removing oldest entries
 */
async function limitCacheSize(cacheName, maxSize) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    
    if (keys.length > maxSize) {
        // Remove oldest entries (first in, first out)
        const entriesToRemove = keys.slice(0, keys.length - maxSize);
        await Promise.all(
            entriesToRemove.map(key => cache.delete(key))
        );
        console.log(`Service Worker: Removed ${entriesToRemove.length} old cache entries`);
    }
}

// Background sync for offline data
self.addEventListener('sync', (event) => {
    console.log('Service Worker: Background sync triggered:', event.tag);
    
    if (event.tag === 'productivity-data-sync') {
        event.waitUntil(syncProductivityData());
    }
});

/**
 * Sync productivity data when back online
 */
async function syncProductivityData() {
    try {
        console.log('Service Worker: Syncing productivity data...');
        
        // Get offline data from IndexedDB or localStorage
        const offlineData = await getOfflineData();
        
        if (offlineData.length > 0) {
            // Send offline data to Firebase when back online
            const response = await fetch('/api/sync-offline-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(offlineData)
            });
            
            if (response.ok) {
                console.log('Service Worker: Offline data synced successfully');
                await clearOfflineData();
            }
        }
        
    } catch (error) {
        console.error('Service Worker: Error syncing offline data:', error);
        throw error; // This will cause the sync to be retried
    }
}

/**
 * Get offline data (placeholder - would integrate with app's offline storage)
 */
async function getOfflineData() {
    // This would integrate with the app's offline data storage
    // For now, return empty array
    return [];
}

/**
 * Clear offline data after successful sync
 */
async function clearOfflineData() {
    // This would clear the app's offline data storage
    console.log('Service Worker: Cleared offline data');
}

// Push notification support (for future features)
self.addEventListener('push', (event) => {
    console.log('Service Worker: Push notification received');
    
    const options = {
        body: 'Don\'t forget to log your productivity today!',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: 'productivity-reminder',
        renotify: true,
        requireInteraction: false,
        actions: [
            {
                action: 'log-now',
                title: 'Log Now'
            },
            {
                action: 'dismiss',
                title: 'Dismiss'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('AI Productivity Tracker', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('Service Worker: Notification clicked');
    
    event.notification.close();
    
    if (event.action === 'log-now') {
        // Open the app
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Handle message events from the main app
self.addEventListener('message', (event) => {
    console.log('Service Worker: Message received:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }
});

// Error handling
self.addEventListener('error', (event) => {
    console.error('Service Worker: Error occurred:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('Service Worker: Unhandled promise rejection:', event.reason);
});

console.log('Service Worker: Script loaded successfully');