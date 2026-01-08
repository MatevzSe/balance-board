const CACHE_NAME = 'balance-board-v1';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './game.js',
    './logo.png',
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap'
];

// Install event - caching assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Caching all: app shell and content');
                return cache.addAll(ASSETS);
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
