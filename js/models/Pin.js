import { CATEGORIES } from './Category.js';

// --- CLASS ABSTRAITE ---
export class Pin {
    constructor(data, author) {
        if (this.constructor === Pin) {
            throw new Error("Abstract Class 'Pin' cannot be instantiated directly.");
        }
        
        this.id = data.id || `pin_${Date.now()}`;
        this.title = data.title;
        this.description = data.description || "";
        this.position = data.position; // {lat, lng}
        this.category = data.category || CATEGORIES.AUTRE;
        this.author = author; // Objet User
        this.createdAt = new Date();
        
        // Feature: Pins Éphémères (TTL par défaut 24h)
        this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); 
    }

    isExpired() {
        return new Date() > this.expiresAt;
    }

    isEditableBy(user) {
        // L'auteur ou la sécurité peut éditer
        return user.id === this.author.id || user.role === 'security';
    }

    // Méthode abstraite simulée
    save(storageManager) {
        throw new Error("Method 'save()' must be implemented by subclass.");
    }
}

// --- PIN PRIVÉ (Local) ---
export class PrivatePin extends Pin {
    constructor(data, author) {
        super(data, author);
        this.localId = this.id;
        this.isSynced = false;
    }

    save(storageManager) {
        console.log(`[PrivatePin] Sauvegarde Locale de : ${this.title}`);
        storageManager.saveLocal(this);
    }
}

// --- PIN COLLABORATIF (API) ---
export class CollaborativePin extends Pin {
    constructor(data, author) {
        super(data, author);
        this.serverId = null;
        this.upvotes = 0; // Feature: Vote
    }

    save(storageManager) {
        console.log(`[CollaborativePin] Envoi Serveur de : ${this.title}`);
        storageManager.pushToRemote(this);
    }
}