const CACHE_NAME = 'campuspin-v2';

// Uniquement nos propres fichiers (pas les CDN — le navigateur gère son propre cache HTTP)
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './css/style.css',
    './js/app.js',
    './js/models/User.js',
    './js/models/Pin.js',
    './js/models/Category.js',
    './js/models/SharedPin.js',
    './js/services/ApiService.js',
    './js/services/MapManager.js',
    './js/services/SensorManager.js',
    './js/services/StorageManager.js',
    './js/services/PinFormModal.js',
    './js/services/NotificationManager.js',
    './icons/icon.svg',
];

// ─── INSTALLATION : mise en cache des assets statiques ───────────────────────
self.addEventListener('install', (event) => {
    console.log('[SW] Installation...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => {
                console.log('[SW] Cache statique prêt');
                return self.skipWaiting();
            })
            .catch(e => {
                console.warn('[SW] Erreur de cache à l\'installation :', e);
                return self.skipWaiting();
            })
    );
});

// ─── ACTIVATION : suppression des anciens caches ─────────────────────────────
self.addEventListener('activate', (event) => {
    console.log('[SW] Activation...');
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(k => k !== CACHE_NAME)
                    .map(k => { console.log('[SW] Suppression ancien cache:', k); return caches.delete(k); })
            ))
            .then(() => self.clients.claim())
    );
});

// ─── FETCH : stratégies de cache ─────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Ignorer les requêtes non-GET et chrome-extension
    if (request.method !== 'GET') return;
    if (url.protocol === 'chrome-extension:') return;

    // ── Ressources EXTERNES (CDN Leaflet, unpkg, etc.) : NE PAS intercepter ──
    // Le navigateur utilise son propre cache HTTP pour les CDN.
    // Intercepter ces requêtes causerait des conflits avec SRI (integrity checks).
    if (url.origin !== self.location.origin && url.hostname !== 'cedreek.fr') {
        return; // laisse le navigateur gérer normalement
    }

    // ── API campus (cedreek.fr) : Network-First + cache fallback ──
    if (url.hostname === 'cedreek.fr') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                    return response;
                })
                .catch(() => {
                    console.warn('[SW] API hors ligne, cache utilisé:', url.pathname);
                    return caches.match(request)
                        .then(r => r || Response.error());
                })
        );
        return;
    }

    // ── Fichiers de l'app (même origine) : Cache-First + Network fallback ──
    event.respondWith(
        caches.match(request).then(cached => {
            if (cached) return cached;

            return fetch(request)
                .then(response => {
                    if (!response || response.status !== 200) return response;

                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                    return response;
                })
                .catch(() => {
                    if (request.mode === 'navigate') {
                        return caches.match('./index.html')
                            .then(r => r || Response.error());
                    }
                    return Response.error();
                });
        })
    );
});

// ─── SYNC : synchronisation des pins en attente ──────────────────────────────
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-pending-pins') {
        console.log('[SW] Background sync: pins en attente...');
        event.waitUntil(notifyClientsToSync());
    }
});

async function notifyClientsToSync() {
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    clients.forEach(client => client.postMessage({ type: 'SYNC_PENDING_PINS' }));
}

// ─── PUSH NOTIFICATIONS ──────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
    const data = event.data
        ? event.data.json()
        : { title: 'CampusPin', body: 'Nouveau signalement à proximité' };

    event.waitUntil(
        self.registration.showNotification(data.title ?? 'CampusPin', {
            body:  data.body,
            icon:  './icons/icon-192.png',
            badge: './icons/icon-192.png',
            tag:   data.tag ?? 'campuspin',
        })
    );
});
