const CACHE_NAME = 'balance-board-v20';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './game.js',
    './icons.svg',
    './logo.svg',
    './logo_header.png',
    './logo_icon.png',
    './inst_step1.png',
    './inst_step2.png',
    './inst_step3.png',
    './inst_step4.png',
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

// Fetch event - network-first for HTML/JS/CSS (picks up updates), cache-first for assets
self.addEventListener('fetch', event => {
    const req = event.request;
    const url = new URL(req.url);

    if (url.origin === location.origin &&
        (req.destination === 'document' || req.destination === 'script' || req.destination === 'style')) {
        event.respondWith(
            fetch(req)
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(c => c.put(req, clone));
                    return response;
                })
                .catch(() => caches.match(req))
        );
        return;
    }

    event.respondWith(
        caches.match(req).then(response => response || fetch(req))
    );
});
