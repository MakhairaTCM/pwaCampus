import { User, ROLES } from './models/User.js';
import { PrivatePin, CollaborativePin } from './models/Pin.js';
import { SharedPin } from './models/SharedPin.js';

import MapManager from './services/MapManager.js';
import SensorManager from './services/SensorManager.js';
import ApiService from './services/ApiService.js';
import StorageManager from './services/StorageManager.js';
import PinFormModal from './services/PinFormModal.js';

class App {
    constructor() {
        // 1. Authentification Mockée
        this.currentUser = new User("u1", "EtudiantLambda", ROLES.STUDENT);
        
        // 2. Initialisation des Services
        this.mapManager    = new MapManager();
        this.sensorManager = new SensorManager();
        this.apiService    = new ApiService();
        this.storageManager = new StorageManager(this.apiService);
        this.pinFormModal  = new PinFormModal();

        // UI Refs
        this.uiStatus = document.getElementById('status');
        this.uiRole = document.getElementById('user-role');
        
        this.init();
    }

    init() {
        console.log("🚀 App Started. User:", this.currentUser);
        this.uiRole.innerText = `Role: ${this.currentUser.role.toUpperCase()}`;

        // Init Map (Campus IUT/ENIT Tarbes)
        this.mapManager.init('map', [43.2261, 0.0493]);

        // Start GPS
        this.sensorManager.watchPosition((coords) => {
            this.uiStatus.innerText = "GPS Actif 🛰️";
            this.mapManager.updateUserMarker(coords);
        });

        // Gestion Clic Carte -> Création Pin
        this.mapManager.onClick((latlng) => this.handlePinCreation(latlng));

        // Chargement depuis l'API (offline-first)
        this.loadSharedPins();
        this.loadPOIs();
    }

    async handlePinCreation(latlng) {
        const result = await this.pinFormModal.open();
        if (!result) return; // annulé

        const { title, category, isPublic } = result;
        const pinData = { title, position: latlng, category };

        const newPin = isPublic
            ? new CollaborativePin(pinData, this.currentUser)
            : new PrivatePin(pinData, this.currentUser);

        newPin.save(this.storageManager);
        this.mapManager.addPin(newPin);
    }

    async loadSharedPins() {
        const renderPins = (dataList) => {
            const pins = dataList.map(data => new SharedPin(data));
            this.mapManager.renderSharedPins(pins, this.currentUser.id, (id, marker) => this.handleDeletePin(id, marker));
        };

        // Offline-first : afficher le cache immédiatement s'il existe
        const cached = this.storageManager.loadSharedPins();
        if (cached.length > 0) {
            renderPins(cached);
            console.log('📦 [App] Pins chargés depuis le cache local.');
        }

        // Puis fetch l'API et rafraîchir
        try {
            const apiData = await this.apiService.get('/api/pins');
            this.storageManager.saveSharedPins(apiData);

            // Re-render avec les données fraîches (remplace le cache affiché)
            this.mapManager.clearSharedPins();
            renderPins(apiData);
            console.log('📡 [App] Pins mis à jour depuis l\'API.');
        } catch (e) {
            console.warn('📴 [App] API indisponible, cache utilisé.', e);
        }
    }

    async loadPOIs() {
        // Offline-first : cache immédiat
        const cached = this.storageManager.loadPOIs();
        if (cached.length > 0) {
            this.mapManager.renderPOIs(cached);
            console.log('📦 [App] POI chargés depuis le cache local.');
        }

        try {
            const apiData = await this.apiService.get('/api/pois');
            this.storageManager.savePOIs(apiData);
            if (cached.length === 0) {
                this.mapManager.renderPOIs(apiData);
                console.log('📡 [App] POI chargés depuis l\'API.');
            }
        } catch (e) {
            console.warn('📴 [App] API indisponible, cache POI utilisé.', e);
        }
    }

    async handleDeletePin(serverId, marker) {
        if (!confirm('Supprimer ce pin ?')) return;

        try {
            await this.apiService.delete(`/api/pins/${serverId}`);
            this.mapManager.removeMarker(marker);
            this.storageManager.removeSharedPin(serverId);
            console.log(`🗑️ [App] Pin ${serverId} supprimé.`);
        } catch (e) {
            console.error('❌ [App] Erreur lors de la suppression :', e);
            alert('Impossible de supprimer ce pin.');
        }
    }
}

// Lancement
const app = new App();