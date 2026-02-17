export default class StorageManager {
    constructor(apiService) {
        this.apiService = apiService;
    }

    saveLocal(pin) {
        // Simulation IndexedDB via LocalStorage
        const key = `pin_local_${pin.id}`;
        localStorage.setItem(key, JSON.stringify(pin));
        console.log("💾 [Storage] Sauvegardé en local.");
    }

    async pushToRemote(pin) {
        try {
            const response = await this.apiService.post('/pins', pin);
            if(response.success) {
                pin.serverId = response.id;
                console.log("📡 [Storage] Sync réussie !");
            }
        } catch (error) {
            console.error("❌ [Storage] Erreur réseau, mise en cache...", error);
            this.saveLocal(pin); // Fallback
        }
    }

    // --- Cache des pins partagés (API) ---

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

    // --- Cache des points d'intérêt (POI) ---

    savePOIs(pois) {
        localStorage.setItem('pois_cache', JSON.stringify(pois));
        console.log(`💾 [Storage] ${pois.length} POI mis en cache.`);
    }

    loadPOIs() {
        const raw = localStorage.getItem('pois_cache');
        return raw ? JSON.parse(raw) : [];
    }
}