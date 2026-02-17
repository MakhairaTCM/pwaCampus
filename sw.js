self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installé');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activé');
});

self.addEventListener('fetch', (event) => {
    // Pour l'instant on laisse tout passer (Network Only)
    // Plus tard, on mettra ici la stratégie de Cache
});