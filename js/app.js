import { User, ROLES } from './models/User.js';
import { CATEGORIES } from './models/Category.js';
import { PrivatePin, CollaborativePin } from './models/Pin.js';

import MapManager from './services/MapManager.js';
import SensorManager from './services/SensorManager.js';
import ApiService from './services/ApiService.js';
import StorageManager from './services/StorageManager.js';

class App {
    constructor() {
        // 1. Authentification Mockée
        this.currentUser = new User("u1", "EtudiantLambda", ROLES.STUDENT);
        
        // 2. Initialisation des Services
        this.mapManager = new MapManager();
        this.sensorManager = new SensorManager();
        this.apiService = new ApiService();
        this.storageManager = new StorageManager(this.apiService);

        // UI Refs
        this.uiStatus = document.getElementById('status');
        this.uiRole = document.getElementById('user-role');
        
        this.init();
    }

    init() {
        console.log("🚀 App Started. User:", this.currentUser);
        this.uiRole.innerText = `Role: ${this.currentUser.role.toUpperCase()}`;

        // Init Map (Tarbes)
        this.mapManager.init('map', [43.2328, 0.0782]);

        // Start GPS
        this.sensorManager.watchPosition((coords) => {
            this.uiStatus.innerText = "GPS Actif 🛰️";
            this.mapManager.updateUserMarker(coords);
        });

        // Gestion Clic Carte -> Création Pin
        this.mapManager.onClick((latlng) => this.handlePinCreation(latlng));
        
        // Simulation: Ajout d'un pin existant pour tester
        this.loadDemoData();
    }

    handlePinCreation(latlng) {
        // Simulation Formulaire (PinFormView simplifié)
        const title = prompt("Titre du signalement ?");
        if (!title) return;

        // Choix Scope (Privé vs Collaboratif)
        const isPublic = confirm("Voulez-vous partager ce pin avec le campus ?\nOK = Public, Annuler = Privé");
        
        // Choix Catégorie (Simplifié pour la démo: Prompt 1-6)
        // En production, ce serait une modale HTML
        const catInput = prompt("Type ? (danger, info, bonplan, panne, social)");
        const category = Object.values(CATEGORIES).find(c => c.id === catInput) || CATEGORIES.AUTRE;

        const pinData = {
            title: title,
            position: latlng,
            category: category
        };

        // Factory Pattern logique
        let newPin;
        if (isPublic) {
            newPin = new CollaborativePin(pinData, this.currentUser);
        } else {
            newPin = new PrivatePin(pinData, this.currentUser);
        }

        // Sauvegarde via StorageManager
        newPin.save(this.storageManager);

        // Ajout visuel
        this.mapManager.addPin(newPin);
    }

    loadDemoData() {
        // Un pin Danger chargé au démarrage
        const demoPin = new CollaborativePin({
            title: "Sol glissant Hall B",
            position: { lat: 43.2330, lng: 0.0785 },
            category: CATEGORIES.DANGER
        }, new User("u2", "Sécurité", ROLES.SECURITY));
        
        this.mapManager.addPin(demoPin);
    }
}

// Lancement
const app = new App();