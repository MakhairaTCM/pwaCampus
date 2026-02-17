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
}