export default class MapManager {
    constructor() {
        this.map = null;
        this.markersCluster = null;
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

    // Binding d'événement (Pattern Observer)
    onClick(callback) {
        this.map.on('click', (e) => callback(e.latlng));
    }
}