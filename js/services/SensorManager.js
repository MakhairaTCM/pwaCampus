export default class SensorManager {

    // ── Géolocalisation ───────────────────────────────────────────────────────
    watchPosition(callback) {
        if (!('geolocation' in navigator)) {
            console.warn('[GPS] API Géolocalisation non disponible.');
            return;
        }
        navigator.geolocation.watchPosition(
            (pos) => callback({
                lat:      pos.coords.latitude,
                lng:      pos.coords.longitude,
                accuracy: pos.coords.accuracy,
            }),
            (err) => console.warn('[GPS] Erreur :', err.message),
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
        );
    }

    // ── Orientation (boussole) — DeviceOrientation API ────────────────────────
    /**
     * @param {function} callback - appelé avec { alpha, beta, gamma, absolute }
     *   alpha = cap magnétique en degrés (0 = Nord, sens horaire)
     * @returns {Promise<boolean>} true si l'accès est accordé
     */
    watchOrientation(callback) {
        const handler = (e) => {
            if (e.alpha === null && e.beta === null) return;
            callback({
                alpha:    e.alpha ?? 0,
                beta:     e.beta  ?? 0,
                gamma:    e.gamma ?? 0,
                absolute: e.absolute ?? false,
            });
        };

        // iOS 13+ : nécessite une permission explicite (doit être déclenché par un geste utilisateur)
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            return DeviceOrientationEvent.requestPermission()
                .then(state => {
                    if (state === 'granted') {
                        window.addEventListener('deviceorientationabsolute', handler, true);
                        window.addEventListener('deviceorientation',         handler, true);
                        return true;
                    }
                    console.warn('[Compass] Permission refusée');
                    return false;
                })
                .catch(err => {
                    console.warn('[Compass] Erreur permission :', err);
                    return false;
                });
        }

        // Android / Desktop
        window.addEventListener('deviceorientationabsolute', handler, true);
        window.addEventListener('deviceorientation',         handler, true);
        return Promise.resolve(true);
    }

    // ── Utilitaires géographiques (statiques) ─────────────────────────────────

    /**
     * Distance en mètres entre deux positions (Haversine)
     */
    static getDistance(from, to) {
        const R    = 6371000;
        const lat1 = from.lat * Math.PI / 180;
        const lat2 = to.lat   * Math.PI / 180;
        const dLat = (to.lat - from.lat) * Math.PI / 180;
        const dLng = (to.lng - from.lng) * Math.PI / 180;
        const a    = Math.sin(dLat / 2) ** 2
                   + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    /**
     * Cap (bearing) en degrés depuis `from` vers `to` (0 = Nord, sens horaire)
     */
    static getBearing(from, to) {
        const lat1 = from.lat * Math.PI / 180;
        const lat2 = to.lat   * Math.PI / 180;
        const dLng = (to.lng - from.lng) * Math.PI / 180;
        const y    = Math.sin(dLng) * Math.cos(lat2);
        const x    = Math.cos(lat1) * Math.sin(lat2)
                   - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
        return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    }

    /** Direction cardinale depuis un cap en degrés */
    static toCardinal(bearing) {
        const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
        return dirs[Math.round(bearing / 45) % 8];
    }

    /** Formate une distance en m ou km */
    static formatDistance(meters) {
        return meters < 1000
            ? `${Math.round(meters)} m`
            : `${(meters / 1000).toFixed(1)} km`;
    }

    /** Temps de marche estimé à 5 km/h */
    static formatWalkTime(meters) {
        const minutes = Math.max(1, Math.round(meters / (5000 / 60)));
        return `~${minutes} min à pied`;
    }

    /** Âge relatif d'une date ("à l'instant", "il y a 3h", "il y a 2j"…) */
    static formatAge(date) {
        if (!date) return '';
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d)) return '';
        const diff = Date.now() - d.getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1)   return 'à l\'instant';
        if (mins < 60)  return `il y a ${mins} min`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24)   return `il y a ${hrs}h`;
        const days = Math.floor(hrs / 24);
        if (days < 30)  return `il y a ${days}j`;
        return `il y a ${Math.floor(days / 30)} mois`;
    }
}
