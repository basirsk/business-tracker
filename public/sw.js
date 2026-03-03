/* ─── Bismillah Toys — Service Worker ──────────────────────────────── */
const CACHE = 'bt-v1';
const STATIC = [
    '/',
    '/index.html',
    '/offline.html',
];

/* Install — cache shell */
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
    );
});

/* Activate — clean old caches */
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

/* Fetch strategy:
   - Navigation → Network-first, fallback to /offline.html
   - Same-origin assets → Stale-while-revalidate
   - Fonts & CDN → Cache-first (long TTL)
   - Firebase/API calls → Network-only (never cache) */
self.addEventListener('fetch', e => {
    const { request } = e;
    const url = new URL(request.url);

    /* Skip non-GET and Firebase API calls */
    if (request.method !== 'GET') return;
    if (url.hostname.includes('firestore.googleapis.com')) return;
    if (url.hostname.includes('firebase')) return;

    /* Navigation → network-first */
    if (request.mode === 'navigate') {
        e.respondWith(
            fetch(request)
                .then(r => { caches.open(CACHE).then(c => c.put(request, r.clone())); return r; })
                .catch(() => caches.match('/offline.html') || caches.match('/index.html'))
        );
        return;
    }

    /* Google Fonts → cache-first */
    if (url.hostname.includes('fonts.g')) {
        e.respondWith(
            caches.match(request).then(cached => cached || fetch(request).then(r => {
                caches.open(CACHE).then(c => c.put(request, r.clone()));
                return r;
            }))
        );
        return;
    }

    /* Everything else → stale-while-revalidate */
    e.respondWith(
        caches.open(CACHE).then(cache =>
            cache.match(request).then(cached => {
                const network = fetch(request).then(r => { cache.put(request, r.clone()); return r; });
                return cached || network;
            })
        )
    );
});
