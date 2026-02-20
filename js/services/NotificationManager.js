import SensorManager from './SensorManager.js';

// Seuil de proximité en mètres pour déclencher une notification
const PROXIMITY_THRESHOLD = 30;

export default class NotificationManager {
    constructor() {
        // Set des pin IDs déjà notifiés (persiste en localStorage pour éviter le spam)
        this._notifiedPins = new Set(
            JSON.parse(localStorage.getItem('notified_pins') ?? '[]')
        );
    }

    // ── Demande de permission ─────────────────────────────────────────────────
    async requestPermission() {
        if (!('Notification' in window)) {
            console.warn('[Notif] API Notification non supportée');
            return false;
        }
        if (Notification.permission === 'granted') return true;
        if (Notification.permission === 'denied')  return false;

        const perm = await Notification.requestPermission();
        return perm === 'granted';
    }

    get isGranted() {
        return 'Notification' in window && Notification.permission === 'granted';
    }

    // ── Vérification de proximité ─────────────────────────────────────────────
    /**
     * Vérifie si l'utilisateur s'approche d'un pin et envoie une notification si besoin.
     * @param {{ lat: number, lng: number }} userPos
     * @param {Array} pins - liste de SharedPin ou objets avec position, id, title, category
     */
    checkProximity(userPos, pins) {
        if (!this.isGranted || !userPos || !pins?.length) return;

        pins.forEach(pin => {
            if (!pin?.position) return;
            const dist = SensorManager.getDistance(userPos, pin.position);

            if (dist <= PROXIMITY_THRESHOLD && !this._notifiedPins.has(pin.id)) {
                this._notifiedPins.add(pin.id);
                this._persistNotified();
                this._notify(pin, dist);
            }
        });
    }

    // ── Réinitialiser les pins notifiés (ex: lors d'un rafraîchissement de pins) ──
    resetNotified() {
        this._notifiedPins.clear();
        localStorage.removeItem('notified_pins');
    }

    // ── Envoi d'une notification ──────────────────────────────────────────────
    _notify(pin, distMeters) {
        const dist  = SensorManager.formatDistance(distMeters);
        const title = `📍 ${pin.title}`;
        const body  = `Vous êtes à ${dist} — ${pin.category?.name ?? 'Signalement'}`;

        try {
            const notif = new Notification(title, {
                body,
                icon:    './icons/icon-192.png',
                tag:     `pin-${pin.id}`,   // évite les doublons si déjà affichée
                vibrate: [200, 100, 200],
            });

            notif.onclick = () => {
                window.focus();
                notif.close();
            };
            console.log(`[Notif] 🔔 ${title} — ${body}`);
        } catch (err) {
            console.warn('[Notif] Erreur :', err);
        }
    }

    _persistNotified() {
        localStorage.setItem('notified_pins', JSON.stringify([...this._notifiedPins]));
    }
}
