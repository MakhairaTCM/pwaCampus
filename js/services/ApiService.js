export default class ApiService {
    constructor() {
        this.baseUrl = "https://api.uttop-campus.fr";
    }

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async post(endpoint, payload) {
        await this._delay(800);
        console.log(`☁️ [API] POST ${endpoint}`, payload);
        return { success: true, id: `srv_${Date.now()}` };
    }

    async get(endpoint) {
        await this._delay(800);
        console.log(`☁️ [API] GET ${endpoint}`);
        return this._mockGet(endpoint);
    }

    async delete(endpoint) {
        await this._delay(500);
        console.log(`☁️ [API] DELETE ${endpoint}`);
        return { success: true };
    }

    async put(endpoint, payload) {
        await this._delay(800);
        console.log(`☁️ [API] PUT ${endpoint}`, payload);
        return { success: true };
    }

    // --- MOCK DATA ---

    _mockGet(endpoint) {
        if (endpoint === '/api/pins')       return this._mockPins();
        if (endpoint === '/api/categories') return this._mockCategories();
        if (endpoint === '/api/pois')       return this._mockPOIs();
        return [];
    }

    _mockPins() {
        return [
            { id: 'srv_001', title: 'Sol glissant devant GEI',  lat: 43.22600, lng: 0.04835, categorie: 'danger',  authorId: 'u2', authorName: 'Sécurité' },
            { id: 'srv_002', title: 'Distributeur en panne',    lat: 43.22671, lng: 0.04930, categorie: 'panne',   authorId: 'u1', authorName: 'EtudiantLambda' },
            { id: 'srv_003', title: 'Cours annulé amphi A',     lat: 43.22491, lng: 0.05182, categorie: 'info',    authorId: 'u3', authorName: 'Prof Martin' },
            { id: 'srv_004', title: 'Pizza gratuite au RU',     lat: 43.22752, lng: 0.05091, categorie: 'bonplan', authorId: 'u1', authorName: 'EtudiantLambda' },
            { id: 'srv_005', title: 'Tournoi FIFA salle 12',    lat: 43.22496, lng: 0.05009, categorie: 'social',  authorId: 'u4', authorName: 'BDE' },
        ];
    }

    _mockCategories() {
        return ['danger', 'panne', 'info', 'bonplan', 'social', 'autre'];
    }

    _mockPOIs() {
        return [
            { id: 'poi_01', name: 'Crelam',                    lat: 43.227030, lng: 0.048392 },
            { id: 'poi_02', name: 'Parking Nord',              lat: 43.227675, lng: 0.049267 },
            { id: 'poi_03', name: 'Arrêt bus Université',      lat: 43.227823, lng: 0.048714 },
            { id: 'poi_04', name: 'GMP',                       lat: 43.226631, lng: 0.047813 },
            { id: 'poi_05', name: 'GCCD',                      lat: 43.226146, lng: 0.047523 },
            { id: 'poi_06', name: 'GEI',                       lat: 43.225990, lng: 0.048349 },
            { id: 'poi_07', name: 'GEA',                       lat: 43.226709, lng: 0.049294 },
            { id: 'poi_08', name: 'Gymnase',                   lat: 43.224962, lng: 0.050088 },
            { id: 'poi_09', name: 'ENIT bât. C',               lat: 43.224907, lng: 0.050822 },
            { id: 'poi_10', name: 'ENIT bât. E',               lat: 43.224950, lng: 0.051139 },
            { id: 'poi_11', name: 'ENIT bât. D',               lat: 43.224563, lng: 0.051364 },
            { id: 'poi_12', name: 'ENIT bât. A',               lat: 43.225236, lng: 0.051815 },
            { id: 'poi_13', name: 'Restaurant Universitaire',  lat: 43.227522, lng: 0.050914 },
            { id: 'poi_14', name: 'ENIT bât. M',               lat: 43.223969, lng: 0.049953 },
        ];
    }
}
