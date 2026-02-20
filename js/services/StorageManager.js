export default class StorageManager {
    constructor(apiService) {
        this.apiService = apiService;
    }

    // ── Pins privés (localStorage) ────────────────────────────────────────────
    saveLocal(pin) {
        const key = `pin_local_${pin.id}`;
        localStorage.setItem(key, JSON.stringify(pin));
        console.log('💾 [Storage] Pin sauvegardé localement.');
    }

    // ── Push vers l'API (avec fallback file d'attente offline) ───────────────
    async pushToRemote(pin) {
        try {
            const response = await this.apiService.post('/api/pins', pin);
            if (response.success) {
                pin.serverId = response.id;
                console.log('📡 [Storage] Sync réussie ! serverId =', response.id);
            }
        } catch (error) {
            console.warn('❌ [Storage] Réseau indisponible, mise en file d\'attente...', error);
            this._addToPendingQueue(pin);
        }
    }

    // ── File d'attente hors-ligne ─────────────────────────────────────────────
    _addToPendingQueue(pin) {
        const queue = this.loadPendingPins();
        // Éviter les doublons
        if (!queue.find(p => p.id === pin.id)) {
            queue.push({
                id:          pin.id,
                title:       pin.title,
                description: pin.description ?? '',
                position:    pin.position,
                category:    pin.category,
                author:      pin.author,
                createdAt:   pin.createdAt,
            });
            localStorage.setItem('pending_pins', JSON.stringify(queue));
            console.log(`📌 [Storage] Pin "${pin.title}" ajouté à la file d'attente (${queue.length} en attente).`);
        }
    }

    loadPendingPins() {
        const raw = localStorage.getItem('pending_pins');
        return raw ? JSON.parse(raw) : [];
    }

    removePendingPin(pinId) {
        const queue = this.loadPendingPins().filter(p => p.id !== pinId);
        localStorage.setItem('pending_pins', JSON.stringify(queue));
    }

    // ── Cache des pins partagés (API) ─────────────────────────────────────────
    saveSharedPins(pinsData) {
        localStorage.setItem('shared_pins_cache', JSON.stringify(pinsData));
        console.log(`💾 [Storage] ${pinsData.length} pins partagés mis en cache.`);
    }

    loadSharedPins() {
        const raw = localStorage.getItem('shared_pins_cache');
        return raw ? JSON.parse(raw) : [];
    }

    removeSharedPin(serverId) {
        const pins = this.loadSharedPins().filter(p => p.id !== serverId);
        this.saveSharedPins(pins);
    }

    updateSharedPinPosition(id, lat, lng) {
        const pins = this.loadSharedPins().map(p =>
            String(p.id) === String(id) ? { ...p, lat, lng } : p
        );
        this.saveSharedPins(pins);
    }

    // ── Signalements de pins ──────────────────────────────────────────────────
    addPinReport(pinId, reason) {
        const reports = this._getReports();
        if (!reports[String(pinId)]) {
            reports[String(pinId)] = { reason, at: new Date().toISOString() };
            localStorage.setItem('pin_reports', JSON.stringify(reports));
            console.log(`⚑ [Storage] Pin ${pinId} signalé (${reason})`);
        }
    }

    isPinReported(pinId) {
        return !!this._getReports()[String(pinId)];
    }

    _getReports() {
        const raw = localStorage.getItem('pin_reports');
        return raw ? JSON.parse(raw) : {};
    }

    // ── Pins privés de l'utilisateur (localStorage) ───────────────────────────
    loadMyLocalPins() {
        const pins = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('pin_local_')) {
                try { pins.push(JSON.parse(localStorage.getItem(key))); } catch {}
            }
        }
        return pins.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // ── Cache des points d'intérêt (POI) ─────────────────────────────────────
    savePOIs(pois) {
        localStorage.setItem('pois_cache', JSON.stringify(pois));
        console.log(`💾 [Storage] ${pois.length} POI mis en cache.`);
    }

    loadPOIs() {
        const raw = localStorage.getItem('pois_cache');
        return raw ? JSON.parse(raw) : [];
    }
}
