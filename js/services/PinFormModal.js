import { CATEGORIES } from '../models/Category.js';

export default class PinFormModal {
    constructor() {
        this.modal          = document.getElementById('pin-modal');
        this.titleInput     = document.getElementById('pin-title');
        this.descInput      = document.getElementById('pin-description');
        this.catGrid        = document.getElementById('cat-grid');
        this._resolve       = null;
        this._selectedCat   = null;

        // ── Caméra (MediaDevices API) ──
        this._stream        = null;
        this._capturedBlob  = null;
        this._videoEl       = document.getElementById('camera-video');
        this._canvasEl      = document.getElementById('camera-canvas');
        this._photoImg      = document.getElementById('camera-photo');
        this._previewWrap   = document.getElementById('camera-preview-wrap');
        this._btnOpenCamera = document.getElementById('btn-open-camera');
        this._btnCapture    = document.getElementById('btn-capture');
        this._btnRetake     = document.getElementById('btn-retake');

        this._buildCategoryGrid();
        this._bindEvents();
    }

    // ── Grille de catégories ──────────────────────────────────────────────────
    _buildCategoryGrid() {
        Object.entries(CATEGORIES).forEach(([key, cat]) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'cat-btn';
            btn.dataset.catKey = key;
            btn.innerHTML = `<span>${cat.icon}</span><small>${cat.name}</small>`;
            btn.style.borderColor = cat.color;

            btn.addEventListener('click', () => {
                document.querySelectorAll('.cat-btn').forEach(b => {
                    b.classList.remove('selected');
                    b.style.backgroundColor = '';
                });
                btn.classList.add('selected');
                btn.style.backgroundColor = cat.color + '22';
                this._selectedCat = cat;
            });

            this.catGrid.appendChild(btn);
        });
    }

    // ── Gestion des événements formulaire ─────────────────────────────────────
    _bindEvents() {
        document.getElementById('pin-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const title = this.titleInput.value.trim();
            if (!title || !this._selectedCat) {
                if (!this._selectedCat) this.catGrid.style.outline = '2px solid #e94560';
                return;
            }
            const isPublic    = document.getElementById('toggle-public').checked;
            const description = this.descInput.value.trim();
            this._close({ title, description, category: this._selectedCat, isPublic, photo: this._capturedBlob });
        });

        document.getElementById('btn-cancel').addEventListener('click', () => {
            this._stopCamera();
            this._close(null);
        });

        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this._stopCamera();
                this._close(null);
            }
        });

        // ── Boutons caméra ──
        this._btnOpenCamera.addEventListener('click', () => this._startCamera());
        this._btnCapture.addEventListener('click',    () => this._capturePhoto());
        this._btnRetake.addEventListener('click',     () => this._retakePhoto());
    }

    // ── Démarrer la caméra (MediaDevices API) ────────────────────────────────
    async _startCamera() {
        if (!navigator.mediaDevices?.getUserMedia) {
            alert('Caméra non disponible sur cet appareil/navigateur.');
            return;
        }
        try {
            this._stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
                audio: false,
            });
            this._videoEl.srcObject = this._stream;
            this._previewWrap.classList.remove('hidden');
            this._videoEl.classList.remove('hidden');
            this._photoImg.classList.add('hidden');
            this._btnCapture.classList.remove('hidden');
            this._btnOpenCamera.classList.add('hidden');
            this._btnRetake.classList.add('hidden');
        } catch (err) {
            console.error('[Camera] Erreur accès caméra :', err);
            alert('Impossible d\'accéder à la caméra. Vérifiez les permissions.');
        }
    }

    // ── Capturer une photo depuis le flux vidéo ───────────────────────────────
    _capturePhoto() {
        const video  = this._videoEl;
        const canvas = this._canvasEl;
        canvas.width  = video.videoWidth  || 640;
        canvas.height = video.videoHeight || 480;
        canvas.getContext('2d').drawImage(video, 0, 0);

        // Arrêter le flux caméra
        this._stopCamera();

        // Convertir en Blob JPEG et afficher la prévisualisation
        canvas.toBlob(blob => {
            this._capturedBlob = blob;
            const url = URL.createObjectURL(blob);
            this._photoImg.src = url;
            this._photoImg.classList.remove('hidden');
            this._videoEl.classList.add('hidden');
            this._btnCapture.classList.add('hidden');
            this._btnRetake.classList.remove('hidden');
        }, 'image/jpeg', 0.85);
    }

    // ── Reprendre une photo ───────────────────────────────────────────────────
    _retakePhoto() {
        this._capturedBlob = null;
        if (this._photoImg.src) URL.revokeObjectURL(this._photoImg.src);
        this._photoImg.src = '';
        this._photoImg.classList.add('hidden');
        this._previewWrap.classList.add('hidden');
        this._btnRetake.classList.add('hidden');
        this._btnOpenCamera.classList.remove('hidden');
    }

    // ── Arrêter le flux caméra ────────────────────────────────────────────────
    _stopCamera() {
        if (this._stream) {
            this._stream.getTracks().forEach(t => t.stop());
            this._stream = null;
        }
    }

    // ── Ouvrir le modal ───────────────────────────────────────────────────────
    open() {
        return new Promise(resolve => {
            this._resolve       = resolve;
            this._selectedCat   = null;
            this._capturedBlob  = null;

            this.titleInput.value = '';
            this.descInput.value  = '';
            this.catGrid.style.outline = '';

            document.querySelectorAll('.cat-btn').forEach(b => {
                b.classList.remove('selected');
                b.style.backgroundColor = '';
            });

            // Réinitialiser la section caméra
            this._previewWrap.classList.add('hidden');
            this._videoEl.classList.remove('hidden');
            this._photoImg.classList.add('hidden');
            this._btnOpenCamera.classList.remove('hidden');
            this._btnCapture.classList.add('hidden');
            this._btnRetake.classList.add('hidden');

            this.modal.classList.remove('hidden');
            this.titleInput.focus();
        });
    }

    // ── Fermer le modal ───────────────────────────────────────────────────────
    _close(result) {
        this.modal.classList.add('hidden');
        if (this._resolve) {
            this._resolve(result);
            this._resolve = null;
        }
    }
}
