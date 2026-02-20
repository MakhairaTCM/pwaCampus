// API réelle : https://cedreek.fr/mytp-poo/
// Tous les endpoints sont sur pins.php?action=...
// Les réponses sont wrappées dans { success: true, data: [...] }
const API_BASE  = "https://cedreek.fr/mytp-poo/";
const API_TOKEN = "campuspin-dev-2026";

// Seule différence de nom entre API et app locale
const CAT_TO_APP = { "bon-plan": "bonplan" };   // API → App
const CAT_TO_API = { "bonplan": "bon-plan"  };   // App → API

export default class ApiService {
    constructor() {
        this.baseUrl = API_BASE;
    }

    _authHeader() {
        return { Authorization: `Bearer ${API_TOKEN}` };
    }

    _mapCatToApp(cat) { return CAT_TO_APP[cat] ?? cat; }
    _mapCatToApi(cat) { return CAT_TO_API[cat] ?? cat; }

    // ── Déballage de la réponse wrappée { success, data } ────────────────────
    _unwrap(json) {
        // L'API renvoie { success: true, data: [...] } ou parfois directement un tableau
        return json?.data ?? json;
    }

    // ── Normalise un pin brut de l'API → format attendu par SharedPin ────────
    // Champs API : { id, title, description, category, latitude, longitude, author, created_at }
    // ⚠ L'API n'a pas de author_id → on utilise le nom auteur comme identifiant
    _normalizePin(p) {
        const authorName = p.author ?? p.authorName ?? "Anonyme";
        return {
            id:          String(p.id),
            title:       p.title       ?? "(sans titre)",
            description: p.description ?? "",
            categorie:   this._mapCatToApp(p.category ?? p.categorie ?? "autre"),
            lat:         parseFloat(p.latitude  ?? p.lat),
            lng:         parseFloat(p.longitude ?? p.lng),
            authorId:    authorName,   // utilisé pour la comparaison de propriété
            authorName:  authorName,
            createdAt:   p.created_at  ?? null,
        };
    }

    // ── GET ───────────────────────────────────────────────────────────────────
    async get(endpoint) {
        // POIs campus : données statiques (pas d'endpoint API)
        if (endpoint === "/api/pois") return this._staticPOIs();

        let url;
        if      (endpoint === "/api/pins")       url = `${this.baseUrl}pins.php?action=list`;
        else if (endpoint === "/api/categories") url = `${this.baseUrl}pins.php?action=categories`;
        else                                     url = `${this.baseUrl}${endpoint}`;

        const res = await fetch(url, { headers: this._authHeader() });
        if (!res.ok) throw new Error(`[API] GET ${url} → ${res.status}`);

        const json = await res.json();
        const data = this._unwrap(json);

        if (endpoint === "/api/pins")       return data.map(p => this._normalizePin(p));
        if (endpoint === "/api/categories") return data;
        return data;
    }

    // ── POST (créer un pin) ───────────────────────────────────────────────────
    async post(_endpoint, pin) {
        const url  = `${this.baseUrl}pins.php?action=create`;
        const body = JSON.stringify({
            title:       pin.title,
            description: pin.description ?? "",
            category:    this._mapCatToApi(pin.category?.id ?? "autre"),
            latitude:    pin.position.lat,
            longitude:   pin.position.lng,
            author:      pin.author?.username ?? "anonyme",
        });

        const res = await fetch(url, {
            method:  "POST",
            headers: { ...this._authHeader(), "Content-Type": "application/json" },
            body,
        });
        if (!res.ok) throw new Error(`[API] POST ${url} → ${res.status}`);

        const json = await res.json();
        const data = this._unwrap(json);

        return {
            success: json.success ?? true,
            id:      data?.id ?? data?.pin_id ?? `srv_${Date.now()}`,
            ...data,
        };
    }

    // ── DELETE ────────────────────────────────────────────────────────────────
    async delete(endpoint) {
        const id  = endpoint.split("/").pop();
        const url = `${this.baseUrl}pins.php?action=delete&id=${id}`;

        const res = await fetch(url, {
            method:  "DELETE",
            headers: this._authHeader(),
        });
        if (!res.ok) throw new Error(`[API] DELETE ${url} → ${res.status}`);
        return await res.json();
    }

    // ── PUT (modification — non documenté sur cette API) ─────────────────────
    async put(endpoint, payload) {
        console.warn("[API] PUT non supporté par cette API.", endpoint, payload);
        return { success: false };
    }

    // ── Upload photo (bonus) ─────────────────────────────────────────────────
    // POST /pins.php?action=photo&id=xxx  (non documenté, peut échouer)
    async uploadPhoto(pinId, blob) {
        const url      = `${this.baseUrl}pins.php?action=photo&id=${pinId}`;
        const formData = new FormData();
        formData.append('photo', blob, 'photo.jpg');

        const res = await fetch(url, {
            method:  "POST",
            headers: this._authHeader(), // pas de Content-Type : FormData le gère
            body:    formData,
        });
        if (!res.ok) throw new Error(`[API] Photo upload ${url} → ${res.status}`);
        return await res.json();
    }

    // ── Points d'intérêt statiques (campus IUT/ENIT Tarbes) ──────────────────
    _staticPOIs() {
        return [
            { id: "poi_01", name: "Crelam",                 lat: 43.22703,  lng: 0.048392 },
            { id: "poi_02", name: "Parking Nord",           lat: 43.227675, lng: 0.049267 },
            { id: "poi_03", name: "Arrêt bus Université",   lat: 43.227823, lng: 0.048714 },
            { id: "poi_04", name: "GMP",                    lat: 43.226631, lng: 0.047813 },
            { id: "poi_05", name: "GCCD",                   lat: 43.226146, lng: 0.047523 },
            { id: "poi_06", name: "GEI",                    lat: 43.22599,  lng: 0.048349 },
            { id: "poi_07", name: "GEA",                    lat: 43.226709, lng: 0.049294 },
            { id: "poi_08", name: "Gymnase",                lat: 43.224962, lng: 0.050088 },
            { id: "poi_09", name: "ENIT bât. C",            lat: 43.224907, lng: 0.050822 },
            { id: "poi_10", name: "ENIT bât. E",            lat: 43.22495,  lng: 0.051139 },
            { id: "poi_11", name: "ENIT bât. D",            lat: 43.224563, lng: 0.051364 },
            { id: "poi_12", name: "ENIT bât. A",            lat: 43.225236, lng: 0.051815 },
            { id: "poi_13", name: "Restaurant Universitaire", lat: 43.227522, lng: 0.050914 },
            { id: "poi_14", name: "ENIT bât. M",            lat: 43.223969, lng: 0.049953 },
        ];
    }
}
