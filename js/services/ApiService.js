export default class ApiService {
    constructor() {
        this.baseUrl = "https://api.uttop-campus.fr";
    }

    async post(endpoint, payload) {
        // Simulation Latence Réseau
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log(`☁️ [API] POST ${endpoint}`, payload);
                resolve({ success: true, id: `srv_${Date.now()}` });
            }, 800);
        });
    }

    async get(endpoint) {
        console.log(`☁️ [API] GET ${endpoint}`);
        // Mock data
        return []; 
    }
}