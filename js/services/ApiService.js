const API_BASE = "https://cedreek.fr/mytp-poo/";
const API_TOKEN = "campuspin-dev-2026";

// Catégories API  →  App  (seules les différences)
const CAT_TO_APP = { "bon-plan": "bonplan", nature: "autre", aide: "autre" };
// Catégories App  →  API
const CAT_TO_API = { bonplan: "bon-plan" };

export default class ApiService {
  constructor() {
    this.baseUrl = API_BASE;
  }

  _authHeader() {
    return { Authorization: `Bearer ${API_TOKEN}` };
  }

  _mapCatToApp(cat) {
    return CAT_TO_APP[cat] ?? cat;
  }
  _mapCatToApi(cat) {
    return CAT_TO_API[cat] ?? cat;
  }

  // Normalise un pin brut de l'API → format attendu par SharedPin
  _normalizePin(p) {
    return {
      id: String(p.id),
      title: p.title,
      categorie: this._mapCatToApp(p.category ?? p.categorie ?? "autre"),
      lat: parseFloat(p.latitude ?? p.lat),
      lng: parseFloat(p.longitude ?? p.lng),
      authorId: String(p.author_id ?? p.authorId ?? "api"),
      authorName: p.author ?? p.authorName ?? "Anonyme",
    };
  }

  async get(endpoint) {
    // POIs : pas de route API → données statiques
    if (endpoint === "/api/pois") return this._staticPOIs();

    let url;
    if (endpoint === "/api/pins") url = `${this.baseUrl}pins.php?action=list`;
    else if (endpoint === "/api/categories")
      url = `${this.baseUrl}pins.php?action=categories`;
    else url = `${this.baseUrl}${endpoint}`;

    const res = await fetch(url, { headers: this._authHeader() });
    if (!res.ok) throw new Error(`[API] GET ${url} → ${res.status}`);
    const data = await res.json();

    if (endpoint === "/api/pins") return data.map((p) => this._normalizePin(p));
    return data;
  }

  async post(_endpoint, pin) {
    const url = `${this.baseUrl}pins.php?action=create`;
    const body = JSON.stringify({
      title: pin.title,
      category: this._mapCatToApi(pin.category?.id ?? "autre"),
      latitude: pin.position.lat,
      longitude: pin.position.lng,
      description: pin.description ?? "",
      author: pin.author?.username ?? "anonyme",
    });

    const res = await fetch(url, {
      method: "POST",
      headers: { ...this._authHeader(), "Content-Type": "application/json" },
      body,
    });
    if (!res.ok) throw new Error(`[API] POST ${url} → ${res.status}`);
    const data = await res.json();

    // Normalise la réponse pour StorageManager (attend { success, id })
    return {
      success: true,
      id: data.id ?? data.pin_id ?? `srv_${Date.now()}`,
      ...data,
    };
  }

  async delete(endpoint) {
    // endpoint : '/api/pins/42'
    const id = endpoint.split("/").pop();
    const url = `${this.baseUrl}pins.php?action=delete&id=${id}`;

    const res = await fetch(url, {
      method: "DELETE",
      headers: this._authHeader(),
    });
    if (!res.ok) throw new Error(`[API] DELETE ${url} → ${res.status}`);
    return await res.json();
  }

  async put(endpoint, payload) {
    console.warn("[API] PUT non implémenté sur cette API.", endpoint, payload);
    return { success: true };
  }

  // --- Points d'intérêt statiques (campus IUT/ENIT Tarbes) ---
  _staticPOIs() {
    return [
      { id: "poi_01", name: "Crelam", lat: 43.22703, lng: 0.048392 },
      { id: "poi_02", name: "Parking Nord", lat: 43.227675, lng: 0.049267 },
      {
        id: "poi_03",
        name: "Arrêt bus Université",
        lat: 43.227823,
        lng: 0.048714,
      },
      { id: "poi_04", name: "GMP", lat: 43.226631, lng: 0.047813 },
      { id: "poi_05", name: "GCCD", lat: 43.226146, lng: 0.047523 },
      { id: "poi_06", name: "GEI", lat: 43.22599, lng: 0.048349 },
      { id: "poi_07", name: "GEA", lat: 43.226709, lng: 0.049294 },
      { id: "poi_08", name: "Gymnase", lat: 43.224962, lng: 0.050088 },
      { id: "poi_09", name: "ENIT bât. C", lat: 43.224907, lng: 0.050822 },
      { id: "poi_10", name: "ENIT bât. E", lat: 43.22495, lng: 0.051139 },
      { id: "poi_11", name: "ENIT bât. D", lat: 43.224563, lng: 0.051364 },
      { id: "poi_12", name: "ENIT bât. A", lat: 43.225236, lng: 0.051815 },
      {
        id: "poi_13",
        name: "Restaurant Universitaire",
        lat: 43.227522,
        lng: 0.050914,
      },
      { id: "poi_14", name: "ENIT bât. M", lat: 43.223969, lng: 0.049953 },
    ];
  }
}
