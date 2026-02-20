import { User, ROLES } from './models/User.js';
import { PrivatePin, CollaborativePin } from './models/Pin.js';
import { SharedPin } from './models/SharedPin.js';
import { CATEGORIES } from './models/Category.js';

import MapManager          from './services/MapManager.js';
import SensorManager       from './services/SensorManager.js';
import ApiService          from './services/ApiService.js';
import StorageManager      from './services/StorageManager.js';
import PinFormModal        from './services/PinFormModal.js';
import NotificationManager from './services/NotificationManager.js';

const DRAGGABLE_WIDGET_IDS = [
    'info-box', 'btn-my-pins', 'btn-settings',
    'btn-locate', 'btn-pin-here', 'btn-sos',
    'btn-search', 'compass-overlay',
];

class App {
    constructor() {
        // ── Utilisateur (mocké) ──
        this.currentUser = new User("u1", "EtudiantLambda", ROLES.STUDENT);

        // ── Services ──
        this.mapManager          = new MapManager();
        this.sensorManager       = new SensorManager();
        this.apiService          = new ApiService();
        this.storageManager      = new StorageManager(this.apiService);
        this.pinFormModal        = new PinFormModal();
        this.notificationManager = new NotificationManager();

        // ── État interne ──
        this.currentPosition   = null;
        this._sharedPins       = [];
        this._compassHeading   = 0;
        this._currentBearing   = null;
        this._searchQuery      = '';
        this._searchCatFilter  = '';
        this._searchSortMode   = 'distance';
        this._refreshPillTimer = null;
        this._uiPrefs          = this._loadUIPrefs();
        this._widgetPositions  = this._loadWidgetPositions();
        this._isLayoutEditMode = false;

        // ── Références UI ──
        this.uiStatus          = document.getElementById('status');
        this.uiRole            = document.getElementById('user-role');
        this._compassOverlay   = document.getElementById('compass-overlay');
        this._compassArrow     = document.getElementById('compass-arrow');
        this._compassDist      = document.getElementById('compass-dist');
        this._reposBanner      = document.getElementById('reposition-banner');

        this.init();
    }

    // ── Initialisation ────────────────────────────────────────────────────────
    async init() {
        console.log('🚀 App Started. User:', this.currentUser);
        this.uiRole.innerText = `Role: ${this.currentUser.role.toUpperCase()}`;

        this.mapManager.init('map', [43.2261, 0.0493]);

        // ── GPS ──
        this.sensorManager.watchPosition((coords) => {
            this.currentPosition = coords;
            this.uiStatus.innerText = `GPS Actif 🛰️ (±${Math.round(coords.accuracy)}m)`;
            this.mapManager.updateUserMarker(coords);
            this.mapManager.setUserPosition(coords);
            this.notificationManager.checkProximity(coords, this._sharedPins);
        });

        // ── Boussole (DeviceOrientation) ──
        this.sensorManager.watchOrientation((orientation) => {
            this._compassHeading = orientation.alpha;
            this._updateCompassArrow();
        });

        // ── Clic sur la carte → créer un pin ──
        this.mapManager.onClick((latlng) => this.handlePinCreation(latlng));

        // ── Bouton "Recentrer" → revenir sur la position GPS ──
        document.getElementById('btn-locate').addEventListener('click', () => {
            if (!this.currentPosition) {
                this._showToast('Position GPS non disponible', 'error');
                return;
            }
            this.mapManager.map.flyTo(
                [this.currentPosition.lat, this.currentPosition.lng],
                17,
                { duration: 0.8 }
            );
        });

        // ── Bouton "Pin ici" → créer un pin à la position GPS ──
        document.getElementById('btn-pin-here').addEventListener('click', () => {
            if (!this.currentPosition) {
                this._showToast('Position GPS non disponible', 'error');
                return;
            }
            this.handlePinCreation({ lat: this.currentPosition.lat, lng: this.currentPosition.lng });
        });

        // ── Boussole overlay ──
        this.mapManager.onPinSelect((bearing, dist) => {
            this._currentBearing = bearing;
            this._compassDist.textContent = `${SensorManager.formatDistance(dist)} · ${SensorManager.formatWalkTime(dist)}`;
            this._compassOverlay.classList.remove('hidden');
            this._updateCompassArrow();
        });

        this.mapManager.onPinDeselect(() => {
            this._currentBearing = null;
            this._compassOverlay.classList.add('hidden');
        });

        // ── Bannière mode repositionnement ──
        this.mapManager.onRepositionStart(() => this._reposBanner.classList.remove('hidden'));
        this.mapManager.onRepositionEnd(()   => this._reposBanner.classList.add('hidden'));

        // ── Recherche + Urgences + Mes pins + Paramètres ──
        this._initSearch();
        this._initSOS();
        this._initMyPins();
        this._initSettings();
        this._applyUIPrefs(this._uiPrefs);
        this._initDraggableWidgets();
        this._applyWidgetPositions();

        // ── Notifications ──
        this.notificationManager.requestPermission()
            .then(granted => {
                if (granted) console.log('[App] Notifications activées');
            });

        // ── Synchronisation hors-ligne ──
        window.addEventListener('app-online',      () => this._syncPendingPins());
        window.addEventListener('sw-sync-request', () => this._syncPendingPins());

        await Promise.all([this.loadSharedPins(), this.loadPOIs()]);
        this._startAutoRefresh();
    }

    // ── Boîte de dialogue de confirmation (bottom-sheet) ─────────────────────
    _confirmDialog({ icon = '❓', title = 'Confirmer ?', sub = '', okLabel = 'OK' } = {}) {
        return new Promise((resolve) => {
            const overlay = document.getElementById('confirm-overlay');
            document.getElementById('confirm-icon').textContent  = icon;
            document.getElementById('confirm-title').textContent = title;
            document.getElementById('confirm-sub').textContent   = sub;
            document.getElementById('confirm-ok').textContent    = okLabel;

            overlay.classList.remove('hidden');

            const cleanup = () => {
                overlay.classList.add('hidden');
                document.getElementById('confirm-ok').removeEventListener('click', onOk);
                document.getElementById('confirm-cancel').removeEventListener('click', onCancel);
                overlay.removeEventListener('click', onOverlayClick);
            };

            const onOk          = () => { cleanup(); resolve(true); };
            const onCancel      = () => { cleanup(); resolve(false); };
            const onOverlayClick = (e) => { if (e.target === overlay) onCancel(); };

            document.getElementById('confirm-ok').addEventListener('click', onOk);
            document.getElementById('confirm-cancel').addEventListener('click', onCancel);
            overlay.addEventListener('click', onOverlayClick);
        });
    }

    // ── Création d'un pin ─────────────────────────────────────────────────────
    async handlePinCreation(latlng) {
        const result = await this.pinFormModal.open();
        if (!result) return;

        const { title, description, category, isPublic, photo } = result;
        const pinData = { title, description, position: latlng, category };

        const newPin = isPublic
            ? new CollaborativePin(pinData, this.currentUser)
            : new PrivatePin(pinData, this.currentUser);

        newPin.save(this.storageManager);
        this.mapManager.addPin(
            newPin,
            (pinId, serverId, newLatLng, marker) => this.handleMovePin(pinId, serverId, newLatLng, marker),
            (pin) => this.handleSharePin(pin)
        );

        if (photo && isPublic) {
            this._schedulePhotoUpload(newPin, photo);
        }
    }

    // ── Upload photo après création du pin ────────────────────────────────────
    _schedulePhotoUpload(pin, blob) {
        let attempts = 0;
        const check = setInterval(async () => {
            attempts++;
            if (pin.serverId) {
                clearInterval(check);
                try {
                    await this.apiService.uploadPhoto(pin.serverId, blob);
                    console.log(`[App] 📷 Photo uploadée pour pin ${pin.serverId}`);
                } catch (e) {
                    console.warn('[App] Erreur upload photo :', e);
                }
            } else if (attempts >= 20) {
                clearInterval(check);
                console.warn('[App] Photo non uploadée (pin sans serverId après 10s)');
            }
        }, 500);
    }

    // ── Chargement des pins partagés (offline-first) ──────────────────────────
    async loadSharedPins() {
        const renderPins = (dataList) => {
            const pins = dataList.map(d => new SharedPin(d));
            this._sharedPins = pins;
            this.mapManager.renderSharedPins(
                pins,
                this.currentUser.username,
                (id, marker)                         => this.handleDeletePin(id, marker),
                (pinId, serverId, newLatLng, marker)  => this.handleMovePin(pinId, serverId, newLatLng, marker),
                (pinId, serverId)                     => this.handleReportPin(pinId, serverId),
                (pinId)                               => this.storageManager.isPinReported(pinId),
                (pin)                                 => this.handleSharePin(pin)
            );
            this._showUrgentBanner(pins.filter(p => p.category.urgent));
            this._renderMyPins(); // met à jour le badge de compte
        };

        const cached = this.storageManager.loadSharedPins();
        if (cached.length > 0) {
            renderPins(cached);
            this._renderSearchResults();
            console.log('📦 [App] Pins chargés depuis le cache local.');
        }

        try {
            const apiData = await this.apiService.get('/api/pins');
            this.storageManager.saveSharedPins(apiData);
            this.mapManager.clearSharedPins();
            renderPins(apiData);
            this._renderSearchResults();
            console.log('📡 [App] Pins mis à jour depuis l\'API.');
        } catch (e) {
            console.warn('📴 [App] API indisponible, cache utilisé.', e);
        }
    }

    // ── Chargement des POI (offline-first) ───────────────────────────────────
    async loadPOIs() {
        const cached = this.storageManager.loadPOIs();
        if (cached.length > 0) {
            this.mapManager.renderPOIs(cached);
            console.log('📦 [App] POI chargés depuis le cache local.');
        }

        try {
            const apiData = await this.apiService.get('/api/pois');
            this.storageManager.savePOIs(apiData);
            if (cached.length === 0) {
                this.mapManager.renderPOIs(apiData);
                console.log('📡 [App] POI chargés depuis l\'API.');
            }
        } catch (e) {
            console.warn('📴 [App] API indisponible, cache POI utilisé.', e);
        }
    }

    // ── Suppression d'un pin ──────────────────────────────────────────────────
    async handleDeletePin(serverId, marker) {
        const confirmed = await this._confirmDialog({
            icon:    '🗑️',
            title:   'Supprimer ce pin ?',
            sub:     'Cette action est irréversible.',
            okLabel: 'Supprimer',
        });
        if (!confirmed) return;

        try {
            await this.apiService.delete(`/api/pins/${serverId}`);
            this.mapManager.removeMarker(marker);
            this.storageManager.removeSharedPin(serverId);
            console.log(`🗑️ [App] Pin ${serverId} supprimé.`);
        } catch (e) {
            console.error('❌ [App] Erreur lors de la suppression :', e);
            this._showToast('Impossible de supprimer ce pin', 'error');
        }
    }

    // ── Repositionnement d'un pin ─────────────────────────────────────────────
    async handleMovePin(pinId, serverId, newLatLng) {
        const lat = newLatLng.lat;
        const lng = newLatLng.lng;

        // Mise à jour du cache local
        this.storageManager.updateSharedPinPosition(serverId ?? pinId, lat, lng);

        console.log(`[App] Pin ${serverId ?? pinId} repositionné → ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        // Note : l'API ne supporte pas le PUT — la position mise à jour reste locale
    }

    // ── Panneau de recherche / filtrage ──────────────────────────────────────
    _initSearch() {
        const overlay   = document.getElementById('search-overlay');
        const input     = document.getElementById('search-input');
        const closeBtn  = document.getElementById('btn-search-close');
        const filtersEl = document.getElementById('cat-filters');

        // Ouvrir
        document.getElementById('btn-search').addEventListener('click', () => {
            overlay.classList.remove('hidden');
            input.focus();
            this._renderSearchResults();
        });

        // Fermer
        const closePanel = () => overlay.classList.add('hidden');
        closeBtn.addEventListener('click', closePanel);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closePanel(); });

        // Recherche textuelle en temps réel
        input.addEventListener('input', () => {
            this._searchQuery = input.value.trim().toLowerCase();
            this._renderSearchResults();
        });

        // Filtres catégorie (Tous + Urgents + chaque catégorie)
        const cats = [
            { id: '',          name: 'Tous',    icon: '🗺️' },
            { id: '__urgent__', name: 'Urgents', icon: '🚨' },
            ...Object.values(CATEGORIES),
        ];
        cats.forEach(cat => {
            const btn = document.createElement('button');
            btn.className    = 'cat-filter-btn' + (cat.id === '' ? ' active' : '');
            btn.dataset.cat  = cat.id;
            btn.textContent  = cat.id ? `${cat.icon} ${cat.name}` : 'Tous';
            btn.addEventListener('click', () => {
                filtersEl.querySelectorAll('.cat-filter-btn')
                    .forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._searchCatFilter = cat.id;
                this._renderSearchResults();
            });
            filtersEl.appendChild(btn);
        });

        // Ligne de tri
        const sortRow = document.createElement('div');
        sortRow.className = 'sort-row';
        const sorts = [
            { id: 'distance', label: '📍 Distance' },
            { id: 'date',     label: '🕐 Date' },
            { id: 'name',     label: '🔤 Nom' },
        ];
        sorts.forEach(s => {
            const btn = document.createElement('button');
            btn.className   = 'sort-btn' + (s.id === this._searchSortMode ? ' active' : '');
            btn.dataset.sort = s.id;
            btn.textContent  = s.label;
            btn.addEventListener('click', () => {
                sortRow.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._searchSortMode = s.id;
                this._renderSearchResults();
            });
            sortRow.appendChild(btn);
        });
        overlay.querySelector('.search-header').appendChild(sortRow);
    }

    _renderSearchResults() {
        const resultsEl = document.getElementById('search-results');
        const countEl   = document.getElementById('search-count');
        if (!resultsEl) return;

        const filtered = this._sharedPins.filter(pin => {
            const matchText = !this._searchQuery
                || pin.title.toLowerCase().includes(this._searchQuery)
                || (pin.description ?? '').toLowerCase().includes(this._searchQuery)
                || (pin.author?.username ?? '').toLowerCase().includes(this._searchQuery);
            const matchCat = !this._searchCatFilter
                || (this._searchCatFilter === '__urgent__'
                    ? pin.category.urgent
                    : pin.category.id === this._searchCatFilter);
            return matchText && matchCat;
        });

        // ── Tri ──
        const sorted = [...filtered];
        if (this._searchSortMode === 'distance' && this.currentPosition) {
            sorted.sort((a, b) =>
                SensorManager.getDistance(this.currentPosition, a.position) -
                SensorManager.getDistance(this.currentPosition, b.position)
            );
        } else if (this._searchSortMode === 'date') {
            sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } else if (this._searchSortMode === 'name') {
            sorted.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
        }

        countEl.textContent = `${sorted.length} résultat${sorted.length !== 1 ? 's' : ''}`;

        if (sorted.length === 0) {
            resultsEl.innerHTML = '<p class="search-empty">Aucun pin trouvé 🔍</p>';
            return;
        }

        resultsEl.innerHTML = sorted.map(pin => {
            const cat      = pin.category;
            const author   = pin.author?.username ?? pin.authorName ?? 'Anonyme';
            const desc     = pin.description
                ? pin.description.slice(0, 65) + (pin.description.length > 65 ? '…' : '')
                : '';
            const distText = this.currentPosition
                ? (() => {
                    const dist = SensorManager.getDistance(this.currentPosition, pin.position);
                    const card = SensorManager.toCardinal(SensorManager.getBearing(this.currentPosition, pin.position));
                    return `${SensorManager.formatDistance(dist)}\u00a0${card} · ${SensorManager.formatWalkTime(dist)}`;
                })()
                : '';
            const urgentBadge = cat.urgent
                ? `<span class="sri-urgent-badge">⚠️ Urgent</span>`
                : '';

            return `
                <div class="search-result-item" data-pin-id="${pin.id}">
                    <div class="sri-icon" style="background:${cat.color}">${cat.icon}</div>
                    <div class="sri-body">
                        <div class="sri-title">${pin.title}</div>
                        <div class="sri-meta">${cat.name} · par ${author}${SensorManager.formatAge(pin.createdAt) ? ` · ${SensorManager.formatAge(pin.createdAt)}` : ''}</div>
                        ${desc ? `<div class="sri-desc">${desc}</div>` : ''}
                    </div>
                    <div class="sri-right">
                        ${distText ? `<span class="sri-dist">${distText}</span>` : ''}
                        ${urgentBadge}
                    </div>
                </div>`;
        }).join('');

        // Clic sur un résultat → fermer + centrer sur le pin
        resultsEl.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                document.getElementById('search-overlay').classList.add('hidden');
                this.mapManager.focusPin(item.dataset.pinId);
            });
        });
    }

    // ── Signalement d'un pin ─────────────────────────────────────────────────
    async handleReportPin(pinId) {
        const reason = await this._showReportSheet();
        if (!reason) return;

        this.storageManager.addPinReport(pinId, reason);
        this._showToast('⚑ Pin signalé — merci !', 'warn');
    }

    _showReportSheet() {
        return new Promise((resolve) => {
            const overlay = document.getElementById('report-overlay');
            document.querySelectorAll('input[name="report-reason"]')
                .forEach(r => r.checked = false);
            overlay.classList.remove('hidden');

            const cleanup = () => {
                overlay.classList.add('hidden');
                document.getElementById('report-submit').removeEventListener('click', onSubmit);
                document.getElementById('report-cancel').removeEventListener('click', onCancel);
                overlay.removeEventListener('click', onOverlay);
            };

            const onSubmit = () => {
                const checked = document.querySelector('input[name="report-reason"]:checked');
                cleanup();
                resolve(checked ? checked.value : null);
            };
            const onCancel  = () => { cleanup(); resolve(null); };
            const onOverlay = (e) => { if (e.target === overlay) onCancel(); };

            document.getElementById('report-submit').addEventListener('click', onSubmit);
            document.getElementById('report-cancel').addEventListener('click', onCancel);
            overlay.addEventListener('click', onOverlay);
        });
    }

    // ── Partage d'un pin (Web Share API) ─────────────────────────────────────
    async handleSharePin(pin) {
        const cat  = pin.category;
        const pos  = pin.position;
        const dist = this.currentPosition && pos
            ? SensorManager.getDistance(this.currentPosition, pos)
            : null;

        const lines = [
            `${cat.name} sur le campus UTTOP`,
            pin.description || null,
            dist !== null
                ? `📐 ${SensorManager.formatDistance(dist)} · ${SensorManager.formatWalkTime(dist)}`
                : null,
        ].filter(Boolean);

        const shareData = {
            title: `${cat.icon} ${pin.title}`,
            text:  lines.join('\n'),
            url:   window.location.href,
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (e) {
                if (e.name !== 'AbortError') this._copyToClipboard(shareData);
            }
        } else {
            this._copyToClipboard(shareData);
        }
    }

    _copyToClipboard({ title, text, url }) {
        const content = `${title}\n${text}\n${url}`;
        navigator.clipboard?.writeText(content)
            .then(()  => this._showToast('📋 Copié dans le presse-papier !', 'info'))
            .catch(()  => this._showToast('Partage non disponible sur ce navigateur', 'warn'));
    }

    // ── Toast non-bloquant ────────────────────────────────────────────────────
    _showToast(message, type = 'success') {
        const el = document.createElement('div');
        el.className   = `toast toast-${type}`;
        el.textContent = message;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2600);
    }

    // ── Mes pins (historique personnel) ──────────────────────────────────────
    _initMyPins() {
        const overlay  = document.getElementById('my-pins-overlay');
        const closeBtn = document.getElementById('btn-my-pins-close');

        document.getElementById('btn-my-pins').addEventListener('click', () => {
            this._renderMyPins();
            overlay.classList.remove('hidden');
        });

        const close = () => overlay.classList.add('hidden');
        closeBtn.addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    }

    _renderMyPins() {
        const contentEl  = document.getElementById('my-pins-content');
        const countBadge = document.getElementById('my-pins-count');
        if (!contentEl) return;

        const localPins  = this.storageManager.loadMyLocalPins();
        const myShared   = this._sharedPins.filter(p => p.authorId === this.currentUser.username);

        const total = localPins.length + myShared.length;
        if (countBadge) {
            if (total > 0) {
                countBadge.textContent = total;
                countBadge.classList.remove('hidden');
            } else {
                countBadge.classList.add('hidden');
            }
        }

        const buildItem = (pin, isShared) => {
            const cat    = pin.category ?? { color: '#6C757D', icon: '📌', name: 'Autre' };
            const dist   = this.currentPosition && pin.position
                ? (() => {
                    const d = SensorManager.getDistance(this.currentPosition, pin.position);
                    return `${SensorManager.formatDistance(d)} · ${SensorManager.formatWalkTime(d)}`;
                })()
                : '';
            const badge  = isShared
                ? `<span class="mpp-badge mpp-badge-shared">Partagé</span>`
                : `<span class="mpp-badge mpp-badge-private">Privé</span>`;
            const dateStr = SensorManager.formatAge(pin.createdAt);

            return `
                <div class="search-result-item" data-pin-id="${pin.id}" data-shared="${isShared}" data-lat="${pin.position?.lat}" data-lng="${pin.position?.lng}">
                    <div class="sri-icon" style="background:${cat.color}">${cat.icon}</div>
                    <div class="sri-body">
                        <div class="sri-title">${pin.title}</div>
                        <div class="sri-meta">${cat.name}${dateStr ? ` · ${dateStr}` : ''}</div>
                        ${badge}
                    </div>
                    <div class="sri-right">
                        ${dist ? `<span class="sri-dist">${dist}</span>` : ''}
                    </div>
                </div>`;
        };

        let html = '';

        if (myShared.length > 0) {
            html += `<div class="mypins-section-header">Partagés (${myShared.length})</div>`;
            html += myShared.map(p => buildItem(p, true)).join('');
        }

        if (localPins.length > 0) {
            html += `<div class="mypins-section-header">Privés (${localPins.length})</div>`;
            html += localPins.map(p => buildItem(p, false)).join('');
        }

        if (total === 0) {
            html = '<p class="mypins-empty">Aucun pin créé pour l\'instant 📌</p>';
        }

        contentEl.innerHTML = html;

        // Clic → centrer sur le pin
        contentEl.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                document.getElementById('my-pins-overlay').classList.add('hidden');
                const isShared = item.dataset.shared === 'true';
                const pinId    = item.dataset.pinId;
                const lat      = parseFloat(item.dataset.lat);
                const lng      = parseFloat(item.dataset.lng);
                if (isShared) {
                    this.mapManager.focusPin(pinId);
                } else if (!isNaN(lat) && !isNaN(lng)) {
                    this.mapManager.map.flyTo([lat, lng], 17, { duration: 0.8 });
                }
            });
        });
    }

    _formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d)) return '';
        const diff = Date.now() - d.getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1)   return 'à l\'instant';
        if (mins < 60)  return `il y a ${mins} min`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24)   return `il y a ${hrs}h`;
        const days = Math.floor(hrs / 24);
        return `il y a ${days}j`;
    }

    // ── Bannière signalements urgents ─────────────────────────────────────────
    _showUrgentBanner(urgentPins) {
        const banner  = document.getElementById('urgent-banner');
        const textEl  = document.getElementById('urgent-banner-text');
        if (!banner || !textEl) return;

        if (!urgentPins.length) {
            banner.classList.add('hidden');
            return;
        }

        const count = urgentPins.length;
        const label = count === 1
            ? `⚠️ 1 signalement urgent sur le campus`
            : `⚠️ ${count} signalements urgents sur le campus`;
        textEl.textContent = label;
        banner.classList.remove('hidden');

        // Bouton "Voir" → ouvre le panneau recherche filtré "Urgents"
        const seeBtn   = document.getElementById('btn-urgent-see');
        const closeBtn = document.getElementById('btn-urgent-close');

        const dismiss = () => banner.classList.add('hidden');

        const onSee = () => {
            dismiss();
            this._searchCatFilter = '__urgent__';
            this._searchQuery     = '';
            document.getElementById('search-input').value = '';
            // Activer le bouton filtre "Urgents" visuellement
            document.querySelectorAll('.cat-filter-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.cat === '__urgent__');
            });
            document.getElementById('search-overlay').classList.remove('hidden');
            this._renderSearchResults();
        };

        // Remplacer les listeners précédents (clone pour éviter les doublons)
        const newSee   = seeBtn.cloneNode(true);
        const newClose = closeBtn.cloneNode(true);
        seeBtn.replaceWith(newSee);
        closeBtn.replaceWith(newClose);
        newSee.addEventListener('click',   onSee);
        newClose.addEventListener('click', dismiss);
    }

    // ── Urgences (SOS) ────────────────────────────────────────────────────────
    _initSOS() {
        const overlay  = document.getElementById('sos-overlay');
        const coordsEl = document.getElementById('sos-coords');

        document.getElementById('btn-sos').addEventListener('click', () => {
            coordsEl.textContent = this.currentPosition
                ? `${this.currentPosition.lat.toFixed(6)}, ${this.currentPosition.lng.toFixed(6)}`
                : 'Position GPS non disponible';
            overlay.classList.remove('hidden');
        });

        const close = () => overlay.classList.add('hidden');
        document.getElementById('btn-sos-close').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    }

    // ── Auto-refresh discret (toutes les 60 s) ───────────────────────────────
    _startAutoRefresh(intervalMs = 60_000) {
        setInterval(async () => {
            if (!navigator.onLine) return;
            try {
                const apiData    = await this.apiService.get('/api/pins');
                const currentIds = new Set(this._sharedPins.map(p => String(p.id)));
                const newOnes    = apiData.filter(d => !currentIds.has(String(d.id)));
                const changed    = newOnes.length > 0 || apiData.length !== this._sharedPins.length;

                if (changed) {
                    // Appliquer silencieusement
                    this.storageManager.saveSharedPins(apiData);
                    this.mapManager.clearSharedPins();
                    const pins = apiData.map(d => new SharedPin(d));
                    this._sharedPins = pins;
                    this.mapManager.renderSharedPins(
                        pins,
                        this.currentUser.username,
                        (id, marker)                        => this.handleDeletePin(id, marker),
                        (pinId, serverId, newLatLng, marker) => this.handleMovePin(pinId, serverId, newLatLng, marker),
                        (pinId, serverId)                    => this.handleReportPin(pinId, serverId),
                        (pinId)                              => this.storageManager.isPinReported(pinId),
                        (pin)                                => this.handleSharePin(pin)
                    );
                    this._showUrgentBanner(pins.filter(p => p.category.urgent));
                    this._renderSearchResults();
                    this._renderMyPins();
                }

                // Indicateur discret à chaque cycle (nouveaux pins ou simple mise à jour)
                this._showRefreshPill(newOnes.length);

            } catch { /* réseau indisponible — silencieux */ }
        }, intervalMs);
    }

    _showRefreshPill(newCount) {
        const pill   = document.getElementById('refresh-pill');
        const textEl = document.getElementById('refresh-pill-text');
        if (!pill || !textEl) return;

        if (newCount === 0) {
            textEl.textContent = 'Carte à jour';
        } else if (newCount === 1) {
            textEl.textContent = '1 nouveau signalement';
        } else {
            textEl.textContent = `${newCount} nouveaux signalements`;
        }

        pill.classList.remove('hidden');
        clearTimeout(this._refreshPillTimer);
        this._refreshPillTimer = setTimeout(() => pill.classList.add('hidden'), 4000);
    }

    // ── Synchronisation des pins en attente ───────────────────────────────────
    async _syncPendingPins() {
        const pending = this.storageManager.loadPendingPins();
        if (!pending.length) return;

        console.log(`🔄 [App] Synchronisation de ${pending.length} pin(s) en attente...`);
        let synced = 0;

        for (const pinData of pending) {
            try {
                const res = await this.apiService.post('/api/pins', pinData);
                this.storageManager.removePendingPin(pinData.id);
                synced++;
                console.log(`✅ [App] Pin synchronisé : ${pinData.title} → ID ${res.id}`);
            } catch (e) {
                console.warn(`⚠️ [App] Impossible de synchroniser ${pinData.title} :`, e);
            }
        }

        if (synced > 0) {
            console.log(`📡 [App] ${synced} pin(s) synchronisé(s). Rechargement...`);
            this.mapManager.clearSharedPins();
            await this.loadSharedPins();
        }
    }

    // ── Positions des widgets (drag & drop libre) ─────────────────────────────
    _loadWidgetPositions() {
        try {
            const stored = localStorage.getItem('widget_positions');
            return stored ? JSON.parse(stored) : {};
        } catch { return {}; }
    }

    _saveWidgetPositions() {
        localStorage.setItem('widget_positions', JSON.stringify(this._widgetPositions));
    }

    _applyWidgetPositions() {
        const pad = 5;
        const vw  = window.innerWidth;
        const vh  = window.innerHeight;

        DRAGGABLE_WIDGET_IDS.forEach(id => {
            const pos = this._widgetPositions[id];
            if (!pos) return;
            const el = document.getElementById(id);
            if (!el) return;

            // Taille réelle de l'élément (fallback 50px si masqué)
            const w = el.offsetWidth  || 50;
            const h = el.offsetHeight || 50;

            // Clamping : recadrage dans le viewport courant (portrait / paysage)
            const left = Math.max(pad, Math.min(vw - w - pad, pos.left));
            const top  = Math.max(pad, Math.min(vh - h - pad, pos.top));

            el.style.position  = 'fixed';
            el.style.top       = top  + 'px';
            el.style.left      = left + 'px';
            el.style.right     = 'auto';
            el.style.bottom    = 'auto';
            el.style.transform = 'none';
        });
    }

    _resetWidgetPositions() {
        this._widgetPositions = {};
        localStorage.removeItem('widget_positions');
        DRAGGABLE_WIDGET_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.style.position  = '';
            el.style.top       = '';
            el.style.left      = '';
            el.style.right     = '';
            el.style.bottom    = '';
            el.style.transform = '';
        });
    }

    _enterLayoutEditMode() {
        this._isLayoutEditMode = true;
        document.body.classList.add('layout-edit-mode');
        document.getElementById('layout-edit-bar').classList.remove('hidden');
        this._showToast('✋ Mode édition actif — glissez les éléments', 'info');
    }

    _exitLayoutEditMode() {
        this._isLayoutEditMode = false;
        document.body.classList.remove('layout-edit-mode');
        document.getElementById('layout-edit-bar').classList.add('hidden');
        this._saveWidgetPositions();
        this._showToast('✓ Disposition sauvegardée', 'success');
    }

    _initDraggableWidgets() {
        DRAGGABLE_WIDGET_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.add('draggable-widget');
            this._makeDraggable(el);
        });

        document.getElementById('btn-layout-edit')?.addEventListener('click', () => {
            document.getElementById('settings-overlay').classList.add('hidden');
            this._enterLayoutEditMode();
        });

        document.getElementById('btn-layout-done')?.addEventListener('click', () => {
            this._exitLayoutEditMode();
        });

        // Re-clamp les widgets lors d'un redimensionnement ou d'une rotation d'écran
        let _resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(_resizeTimer);
            _resizeTimer = setTimeout(() => this._applyWidgetPositions(), 120);
        });
    }

    _makeDraggable(el) {
        let startX = 0, startY = 0, startLeft = 0, startTop = 0;
        let isDragging = false;
        let didDrag    = false;

        el.addEventListener('pointerdown', (e) => {
            if (!this._isLayoutEditMode) return;
            e.preventDefault();
            el.setPointerCapture(e.pointerId);

            isDragging = true;
            didDrag    = false;
            startX = e.clientX;
            startY = e.clientY;

            const rect = el.getBoundingClientRect();
            startLeft  = rect.left;
            startTop   = rect.top;

            // Passe en position fixe pour un drag uniforme
            el.style.position  = 'fixed';
            el.style.left      = startLeft + 'px';
            el.style.top       = startTop  + 'px';
            el.style.right     = 'auto';
            el.style.bottom    = 'auto';
            el.style.transform = 'none';
            el.classList.add('dragging');
        });

        el.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didDrag = true;

            const pad     = 5;
            const newLeft = Math.max(pad, Math.min(window.innerWidth  - el.offsetWidth  - pad, startLeft + dx));
            const newTop  = Math.max(pad, Math.min(window.innerHeight - el.offsetHeight - pad, startTop  + dy));

            el.style.left = newLeft + 'px';
            el.style.top  = newTop  + 'px';
        });

        const onEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            el.classList.remove('dragging');

            if (didDrag) {
                this._widgetPositions[el.id] = {
                    top:  parseFloat(el.style.top),
                    left: parseFloat(el.style.left),
                };
            }
        };
        el.addEventListener('pointerup',     onEnd);
        el.addEventListener('pointercancel', onEnd);

        // Bloquer les clics pendant le mode édition (évite d'ouvrir les panneaux par erreur)
        el.addEventListener('click', (e) => {
            if (this._isLayoutEditMode) {
                e.stopPropagation();
                e.preventDefault();
            }
        }, true);
    }

    // ── Mise à jour de la flèche boussole ─────────────────────────────────────
    _updateCompassArrow() {
        if (this._currentBearing === null) return;
        const relDir = (this._currentBearing - this._compassHeading + 360) % 360;
        this._compassArrow.style.transform = `rotate(${relDir}deg)`;
    }

    // ── Préférences UI (localStorage) ────────────────────────────────────────
    _loadUIPrefs() {
        const DEFAULT = { infobox: true, sos: true, search: true, myPins: true, compass: true, hand: 'right' };
        try {
            const stored = localStorage.getItem('ui_prefs');
            return stored ? { ...DEFAULT, ...JSON.parse(stored) } : DEFAULT;
        } catch { return DEFAULT; }
    }

    _saveUIPrefs() {
        localStorage.setItem('ui_prefs', JSON.stringify(this._uiPrefs));
    }

    _applyUIPrefs(prefs) {
        const toggle = (id, visible) =>
            document.getElementById(id)?.classList.toggle('user-pref-hidden', !visible);

        toggle('info-box',        prefs.infobox);
        toggle('btn-sos',         prefs.sos);
        toggle('btn-search',      prefs.search);
        toggle('btn-my-pins',     prefs.myPins);
        toggle('compass-overlay', prefs.compass);
        document.body.classList.toggle('left-handed', prefs.hand === 'left');
    }

    _syncSettingsUI(prefs) {
        const setCheck = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.checked = val;
        };
        setCheck('pref-infobox', prefs.infobox);
        setCheck('pref-sos',     prefs.sos);
        setCheck('pref-search',  prefs.search);
        setCheck('pref-mypins',  prefs.myPins);
        setCheck('pref-compass', prefs.compass);
        document.querySelectorAll('.handedness-btn').forEach(btn =>
            btn.classList.toggle('active', btn.dataset.hand === prefs.hand)
        );
    }

    _initSettings() {
        const overlay  = document.getElementById('settings-overlay');
        const closeBtn = document.getElementById('btn-settings-close');

        document.getElementById('btn-settings').addEventListener('click', () => {
            this._syncSettingsUI(this._uiPrefs);
            overlay.classList.remove('hidden');
        });

        const close = () => overlay.classList.add('hidden');
        closeBtn.addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

        // Toggles de visibilité
        const prefMap = {
            'pref-infobox': 'infobox',
            'pref-sos':     'sos',
            'pref-search':  'search',
            'pref-mypins':  'myPins',
            'pref-compass': 'compass',
        };
        Object.entries(prefMap).forEach(([inputId, key]) => {
            document.getElementById(inputId)?.addEventListener('change', (e) => {
                this._uiPrefs[key] = e.target.checked;
                this._saveUIPrefs();
                this._applyUIPrefs(this._uiPrefs);
            });
        });

        // Boutons main dominante
        document.querySelectorAll('.handedness-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this._uiPrefs.hand = btn.dataset.hand;
                this._saveUIPrefs();
                this._applyUIPrefs(this._uiPrefs);
                document.querySelectorAll('.handedness-btn').forEach(b =>
                    b.classList.toggle('active', b.dataset.hand === this._uiPrefs.hand)
                );
            });
        });

        // Réinitialisation complète (prefs + positions)
        document.getElementById('btn-settings-reset')?.addEventListener('click', () => {
            this._uiPrefs = { infobox: true, sos: true, search: true, myPins: true, compass: true, hand: 'right' };
            this._saveUIPrefs();
            this._applyUIPrefs(this._uiPrefs);
            this._syncSettingsUI(this._uiPrefs);
            this._resetWidgetPositions();
        });
    }
}

// ── Lancement de l'application ────────────────────────────────────────────────
window.app = new App();
