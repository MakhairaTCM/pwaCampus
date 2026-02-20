import { Pin } from './Pin.js';
import { CATEGORIES } from './Category.js';

// Pin venant de l'API — lecture seule, supprimable par son auteur
export class SharedPin extends Pin {
    constructor(apiData) {
        const category = Object.values(CATEGORIES).find(c => c.id === apiData.categorie) || CATEGORIES.AUTRE;
        const author   = { id: apiData.authorId, username: apiData.authorName };

        super({
            id:          apiData.id,
            title:       apiData.title,
            description: apiData.description ?? "",
            position:    { lat: apiData.lat, lng: apiData.lng },
            category,
        }, author);

        this.serverId  = apiData.id;
        this.authorId  = apiData.authorId;
        if (apiData.createdAt) this.createdAt = new Date(apiData.createdAt);
    }

    // Les pins partagés viennent de l'API : save() est une no-op
    save() {
        console.log('[SharedPin] Issu de l\'API, aucune sauvegarde locale directe.');
    }
}
