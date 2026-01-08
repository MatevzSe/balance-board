const CACHE_NAME = 'balance-board-v1';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './game.js',
    './logo.png',
    './tailwind.min.js',
    'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap'
];

// Install event - caching assets with individual error logging
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async (cache) => {
                console.log('[Service Worker] Caching app shell and content');
                for (const asset of ASSETS) {
                    try {
                        await cache.add(asset);
                        console.log(`[Service Worker] Cached: ${asset}`);
                    } catch (err) {
                        console.error(`[Service Worker] Failed to cache: ${asset}`, err);
                    }
                }
            })
    );
});

// Activate event - cleaning up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Clearing Old Cache');
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// Fetch event - serving from cache or network
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});
