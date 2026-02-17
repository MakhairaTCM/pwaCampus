export default class MapManager {
    constructor() {
        this.map = null;
        this.markersCluster = null;
        this.sharedMarkers = []; // référence aux marqueurs partagés (pour clearSharedPins)
    }

    init(elementId, center) {
        this.map = L.map(elementId).setView(center, 16);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: 'OpenStreetMap'
        }).addTo(this.map);

        this.markersCluster = L.markerClusterGroup();
        this.map.addLayer(this.markersCluster);
    }

    updateUserMarker(coords) {
        if (!this.map) return;
        // Nettoyage simplifié pour la démo (en prod on garde une ref)
        this.map.eachLayer((layer) => {
            if (layer.options.id === 'user-pos') this.map.removeLayer(layer);
        });

        L.circleMarker([coords.lat, coords.lng], {
            id: 'user-pos', radius: 8, fillColor: "#3388ff", color: "#fff", fillOpacity: 1
        }).addTo(this.map).bindPopup("Vous êtes ici");
        
        L.circle([coords.lat, coords.lng], { id: 'user-pos', radius: coords.accuracy }).addTo(this.map);
    }

    addPin(pin) {
        // Rendu visuel basé sur la Category du Pin (Couleur + Scale)
        const cat = pin.category;
        
        const marker = L.circleMarker([pin.position.lat, pin.position.lng], {
            radius: 10 * cat.scale, // Utilisation du scaleFactor UML
            fillColor: cat.color,
            color: "#000",
            weight: 1,
            fillOpacity: 0.9
        });

        const popupContent = `
            <div style="text-align:center">
                <span style="font-size:20px">${cat.icon}</span>
                <strong>${pin.title}</strong><br>
                <small>${cat.name}</small><br>
                ${pin.author ? `<i>par ${pin.author.username}</i>` : ''}
            </div>
        `;

        marker.bindPopup(popupContent);
        this.markersCluster.addLayer(marker);
    }

    // Affiche une liste de SharedPin avec bouton "Supprimer" pour l'auteur
    renderSharedPins(pins, currentUserId, onDelete) {
        pins.forEach(pin => {
            const cat    = pin.category;
            const marker = L.circleMarker([pin.position.lat, pin.position.lng], {
                radius: 10 * cat.scale,
                fillColor: cat.color,
                color: "#000",
                weight: 1,
                fillOpacity: 0.9
            });

            const canDelete = pin.authorId === currentUserId;
            const deleteBtn = canDelete
                ? `<br><button data-pin-id="${pin.serverId}" style="margin-top:6px;padding:2px 8px;color:red;cursor:pointer;border:1px solid red;background:none;border-radius:4px;">🗑️ Supprimer</button>`
                : '';

            marker.bindPopup(`
                <div style="text-align:center">
                    <span style="font-size:20px">${cat.icon}</span>
                    <strong>${pin.title}</strong><br>
                    <small>${cat.name}</small><br>
                    <i>par ${pin.author.username}</i>
                    ${deleteBtn}
                </div>
            `);

            marker.on('popupopen', () => {
                const btn = document.querySelector(`[data-pin-id="${pin.serverId}"]`);
                if (btn) btn.addEventListener('click', () => onDelete(pin.serverId, marker));
            });

            this.markersCluster.addLayer(marker);
            this.sharedMarkers.push(marker);
        });
    }

    // Affiche les points d'intérêt du campus (hors cluster, toujours visibles)
    renderPOIs(pois) {
        pois.forEach(poi => {
            const marker = L.circleMarker([poi.lat, poi.lng], {
                radius: 7,
                fillColor: '#2c3e50',
                color: '#fff',
                weight: 2,
                fillOpacity: 0.9
            });
            marker.bindTooltip(poi.name, { permanent: false, direction: 'top', className: 'poi-tooltip' });
            marker.bindPopup(`<div style="text-align:center"><strong>🏛️ ${poi.name}</strong></div>`);
            this.map.addLayer(marker); // hors markerCluster pour rester toujours visibles
        });
    }

    // Retire tous les marqueurs partagés de la carte
    clearSharedPins() {
        this.sharedMarkers.forEach(m => this.markersCluster.removeLayer(m));
        this.sharedMarkers = [];
    }

    // Retire un marqueur individuel
    removeMarker(marker) {
        this.markersCluster.removeLayer(marker);
        this.sharedMarkers = this.sharedMarkers.filter(m => m !== marker);
    }

    // Binding d'événement (Pattern Observer)
    onClick(callback) {
        this.map.on('click', (e) => callback(e.latlng));
    }
}