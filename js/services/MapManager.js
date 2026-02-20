import SensorManager from './SensorManager.js';

export default class MapManager {
    constructor() {
        this.map            = null;
        this.markersCluster = null;
        this.sharedMarkers  = [];
        this._pinMarkers    = new Map(); // pinId → marker (pour focusPin)
        this.userPosition   = null;
        this._onPinSelect       = null;
        this._onPinDeselect     = null;
        this._onRepositionStart = null;
        this._onRepositionEnd   = null;

        // État du mode repositionnement
        this._reposMode      = false;
        this._reposMarker    = null;
        this._reposCallback  = null;
        this._reposMapClick  = null;
        this._reposDragEnd   = null;
        this._onEscapeRepos  = null;
    }

    // ── Initialisation de la carte ────────────────────────────────────────────
    init(elementId, center) {
        // zoomControl: false — PWA mobile : pinch-to-zoom suffit,
        // et les boutons Leaflet entraient en conflit avec #btn-my-pins (top-left)
        this.map = L.map(elementId, { zoomControl: false }).setView(center, 16);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom:     19,
            attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>'
        }).addTo(this.map);

        this.markersCluster = L.markerClusterGroup();
        this.map.addLayer(this.markersCluster);

        this.map.on('popupclose', () => {
            if (this._onPinDeselect) this._onPinDeselect();
        });
    }

    // ── Position utilisateur ──────────────────────────────────────────────────
    setUserPosition(coords) {
        this.userPosition = coords;
    }

    updateUserMarker(coords) {
        if (!this.map) return;
        this.map.eachLayer((layer) => {
            if (layer.options?.id === 'user-pos') this.map.removeLayer(layer);
        });

        const icon = L.divIcon({
            className:  'custom-pin',
            html:       '<div class="user-pin-dot"></div>',
            iconSize:   [22, 22],
            iconAnchor: [11, 11],
        });

        L.marker([coords.lat, coords.lng], { icon, id: 'user-pos', interactive: false })
            .addTo(this.map);

        L.circle([coords.lat, coords.lng], {
            id: 'user-pos', radius: coords.accuracy,
            color: '#3388ff', fillColor: '#3388ff', fillOpacity: 0.1, weight: 1,
            interactive: false,
        }).addTo(this.map);
    }

    // ── Icône DivIcon teardrop personnalisée ──────────────────────────────────
    _createPinIcon(cat) {
        const size      = Math.round(36 * (cat.scale ?? 1));
        const tailH     = Math.round(size * 0.28);
        const fontSize  = Math.round(size * 0.52);

        return L.divIcon({
            className:   'custom-pin',
            html: `<div class="pin-marker" style="width:${size}px;height:${size}px;background:${cat.color}">
                       <span class="pin-emoji" style="font-size:${fontSize}px">${cat.icon}</span>
                       <span class="pin-tail"  style="border-top-color:${cat.color};border-top-width:${tailH}px"></span>
                   </div>`,
            iconSize:    [size, size + tailH],
            iconAnchor:  [size / 2, size + tailH],
            popupAnchor: [0, -(size + 6)],
        });
    }

    // ── Construit le HTML structuré d'un popup ───────────────────────────────
    _buildPopupHtml(pin, cat, canDelete, canMove, canReport = false) {
        const authorName = pin.author?.username ?? pin.authorName ?? 'Anonyme';

        const descHtml = pin.description
            ? `<p class="popup-desc">${pin.description}</p>`
            : '';

        const ageStr  = SensorManager.formatAge(pin.createdAt);
        const ageHtml = ageStr ? `<span class="popup-age">🕐 ${ageStr}</span>` : '';

        const distHtml = `<span class="popup-dist" id="popup-dist-${pin.id}"></span>`;

        const moveBtnHtml = canMove
            ? `<button class="popup-btn popup-btn-move">↕ Déplacer</button>`
            : '';

        const delBtnHtml = canDelete
            ? `<button class="popup-btn popup-btn-delete" data-del="${pin.serverId ?? pin.id}">🗑️ Supprimer</button>`
            : '';

        const reportBtnHtml = canReport
            ? `<button class="popup-btn popup-btn-report">⚑ Signaler</button>`
            : '';

        const shareBtnHtml = `<button class="popup-btn popup-btn-share">📤 Partager</button>`;

        const actionsHtml = `<div class="popup-actions">${moveBtnHtml}${delBtnHtml}${reportBtnHtml}${shareBtnHtml}</div>`;

        return `
            <div class="pin-popup">
                <div class="pin-popup-header" style="background:${cat.color}1a">
                    <span class="pin-popup-icon">${cat.icon}</span>
                    <p class="pin-popup-title">${pin.title}</p>
                </div>
                ${descHtml}
                <div class="pin-popup-meta">
                    <span class="popup-cat">${cat.name}</span>
                    <span class="popup-author">par ${authorName}</span>
                    ${ageHtml}
                </div>
                ${distHtml}
                ${actionsHtml}
            </div>`;
    }

    // ── Ajouter un pin créé localement ────────────────────────────────────────
    addPin(pin, onMove, onShare) {
        const cat    = pin.category;
        const icon   = this._createPinIcon(cat);
        const marker = L.marker([pin.position.lat, pin.position.lng], { icon });

        marker.bindPopup(this._buildPopupHtml(pin, cat, false, true));

        marker.on('popupopen', () => {
            if (this.userPosition) {
                const dist    = SensorManager.getDistance(this.userPosition, pin.position);
                const bearing = SensorManager.getBearing(this.userPosition, pin.position);
                const card    = SensorManager.toCardinal(bearing);
                const distEl  = marker.getPopup().getElement()?.querySelector(`#popup-dist-${pin.id}`);
                if (distEl) distEl.textContent = `📐 ${SensorManager.formatDistance(dist)} ${card} · ${SensorManager.formatWalkTime(dist)}`;
                if (this._onPinSelect) this._onPinSelect(bearing, dist, pin.title);
            }

            const moveBtn = marker.getPopup().getElement()?.querySelector('.popup-btn-move');
            if (moveBtn) {
                moveBtn.addEventListener('click', () => {
                    marker.closePopup();
                    this.startReposition(marker, (newLatLng) => {
                        if (onMove) onMove(pin.id, null, newLatLng, marker);
                    });
                });
            }

            const shareBtn = marker.getPopup().getElement()?.querySelector('.popup-btn-share');
            if (shareBtn && onShare) {
                shareBtn.addEventListener('click', () => {
                    marker.closePopup();
                    onShare(pin);
                });
            }
        });

        this.markersCluster.addLayer(marker);
        return marker;
    }

    // ── Afficher les pins partagés (API) ──────────────────────────────────────
    renderSharedPins(pins, currentUserId, onDelete, onMove, onReport, checkReported, onShare) {
        pins.forEach(pin => {
            const cat       = pin.category;
            const icon      = this._createPinIcon(cat);
            const canDelete = pin.authorId === currentUserId;
            const canReport = !canDelete; // on ne signale pas ses propres pins
            const marker    = L.marker([pin.position.lat, pin.position.lng], { icon });

            marker.bindPopup(this._buildPopupHtml(pin, cat, canDelete, canDelete, canReport));

            marker.on('popupopen', () => {
                if (this.userPosition) {
                    const dist    = SensorManager.getDistance(this.userPosition, pin.position);
                    const bearing = SensorManager.getBearing(this.userPosition, pin.position);
                    const card    = SensorManager.toCardinal(bearing);
                    const distEl  = marker.getPopup().getElement()?.querySelector(`#popup-dist-${pin.id}`);
                    if (distEl) distEl.textContent = `📐 ${SensorManager.formatDistance(dist)} ${card} · ${SensorManager.formatWalkTime(dist)}`;
                    if (this._onPinSelect) this._onPinSelect(bearing, dist, pin.title);
                }

                const popupEl = marker.getPopup().getElement();
                if (!popupEl) return;

                const delBtn = popupEl.querySelector(`[data-del="${pin.serverId ?? pin.id}"]`);
                if (delBtn) {
                    delBtn.addEventListener('click', () => {
                        marker.closePopup();
                        if (onDelete) onDelete(pin.serverId, marker);
                    });
                }

                const moveBtn = popupEl.querySelector('.popup-btn-move');
                if (moveBtn) {
                    moveBtn.addEventListener('click', () => {
                        marker.closePopup();
                        this.startReposition(marker, (newLatLng) => {
                            if (onMove) onMove(pin.id, pin.serverId, newLatLng, marker);
                        });
                    });
                }

                // Bouton Signaler — vérification de l'état au moment de l'ouverture
                const repBtn = popupEl.querySelector('.popup-btn-report');
                if (repBtn) {
                    if (checkReported && checkReported(String(pin.id))) {
                        repBtn.outerHTML = '<span class="popup-reported-badge">⚑ Déjà signalé</span>';
                    } else {
                        repBtn.addEventListener('click', () => {
                            marker.closePopup();
                            if (onReport) onReport(pin.id, pin.serverId);
                        });
                    }
                }

                const shareBtn = popupEl.querySelector('.popup-btn-share');
                if (shareBtn && onShare) {
                    shareBtn.addEventListener('click', () => {
                        marker.closePopup();
                        onShare(pin);
                    });
                }
            });

            this.markersCluster.addLayer(marker);
            this.sharedMarkers.push(marker);
            this._pinMarkers.set(String(pin.id), marker);
        });
    }

    // ── Mode repositionnement ─────────────────────────────────────────────────
    startReposition(marker, callback) {
        if (this._reposMode) this._cancelReposition();

        this._reposMode     = true;
        this._reposMarker   = marker;
        this._reposCallback = callback;

        marker.dragging?.enable();

        if (this._onRepositionStart) this._onRepositionStart();

        const finish = (latlng) => {
            marker.setLatLng(latlng);
            this.map.off('click', onMapClick);
            marker.off('dragend', onDragEnd);
            this._finishReposition(latlng);
        };

        const onMapClick = (e) => finish(e.latlng);
        const onDragEnd  = (e) => finish(e.target.getLatLng());

        this._reposMapClick = onMapClick;
        this._reposDragEnd  = onDragEnd;

        this.map.once('click', onMapClick);
        marker.once('dragend', onDragEnd);

        this._onEscapeRepos = (e) => {
            if (e.key === 'Escape') this._cancelReposition();
        };
        document.addEventListener('keydown', this._onEscapeRepos);
    }

    _finishReposition(latlng) {
        this._reposMode = false;
        const marker = this._reposMarker;
        const cb     = this._reposCallback;
        this._reposMarker   = null;
        this._reposCallback = null;
        document.removeEventListener('keydown', this._onEscapeRepos);
        marker?.dragging?.disable();
        if (this._onRepositionEnd) this._onRepositionEnd();
        if (cb) cb(latlng);
    }

    _cancelReposition() {
        if (!this._reposMode) return;
        this.map.off('click', this._reposMapClick);
        if (this._reposMarker) {
            this._reposMarker.off('dragend', this._reposDragEnd);
            this._reposMarker.dragging?.disable();
        }
        this._reposMode     = false;
        this._reposMarker   = null;
        this._reposCallback = null;
        document.removeEventListener('keydown', this._onEscapeRepos);
        if (this._onRepositionEnd) this._onRepositionEnd();
    }

    // ── Points d'intérêt campus ───────────────────────────────────────────────
    renderPOIs(pois) {
        pois.forEach(poi => {
            const icon = L.divIcon({
                className: 'custom-pin',
                html: `<div class="pin-marker" style="width:28px;height:28px;background:#2c3e50">
                           <span class="pin-emoji" style="font-size:14px">🏛️</span>
                           <span class="pin-tail" style="border-top-color:#2c3e50;border-top-width:8px"></span>
                       </div>`,
                iconSize:    [28, 36],
                iconAnchor:  [14, 36],
                popupAnchor: [0, -38],
            });

            const marker = L.marker([poi.lat, poi.lng], { icon });
            marker.bindTooltip(poi.name, { permanent: false, direction: 'top', className: 'poi-tooltip' });
            marker.bindPopup(`
                <div class="pin-popup">
                    <div class="pin-popup-header" style="background:#2c3e5020">
                        <span class="pin-popup-icon">🏛️</span>
                        <p class="pin-popup-title">${poi.name}</p>
                    </div>
                </div>`);
            this.map.addLayer(marker);
        });
    }

    // ── Nettoyage ─────────────────────────────────────────────────────────────
    clearSharedPins() {
        this.sharedMarkers.forEach(m => this.markersCluster.removeLayer(m));
        this.sharedMarkers = [];
        this._pinMarkers.clear();
    }

    // ── Focaliser un pin (zoom + ouvrir popup, même si clusterisé) ───────────
    focusPin(pinId) {
        const marker = this._pinMarkers.get(String(pinId));
        if (!marker) return;
        this.markersCluster.zoomToShowLayer(marker, () => marker.openPopup());
    }

    removeMarker(marker) {
        this.markersCluster.removeLayer(marker);
        this.sharedMarkers = this.sharedMarkers.filter(m => m !== marker);
    }

    // ── Événements ────────────────────────────────────────────────────────────
    onClick(callback) {
        this.map.on('click', (e) => {
            if (this._reposMode) return; // le mode reposition gère ses propres clics
            callback(e.latlng);
        });
    }

    onPinSelect(callback)       { this._onPinSelect       = callback; }
    onPinDeselect(callback)     { this._onPinDeselect     = callback; }
    onRepositionStart(callback) { this._onRepositionStart = callback; }
    onRepositionEnd(callback)   { this._onRepositionEnd   = callback; }
}
