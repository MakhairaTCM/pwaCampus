import { CATEGORIES } from '../models/Category.js';

export default class PinFormModal {
    constructor() {
        this.modal      = document.getElementById('pin-modal');
        this.titleInput = document.getElementById('pin-title');
        this.catGrid    = document.getElementById('cat-grid');
        this._resolve     = null;
        this._selectedCat = null;

        this._buildCategoryGrid();
        this._bindEvents();
    }

    // Génère dynamiquement les boutons de catégorie
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

    _bindEvents() {
        document.getElementById('pin-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const title = this.titleInput.value.trim();
            if (!title || !this._selectedCat) {
                if (!this._selectedCat) this.catGrid.style.outline = '2px solid #e94560';
                return;
            }
            const isPublic = document.getElementById('toggle-public').checked;
            this._close({ title, category: this._selectedCat, isPublic });
        });

        document.getElementById('btn-cancel').addEventListener('click', () => this._close(null));

        // Fermer en cliquant sur l'overlay
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this._close(null);
        });
    }

    // Ouvre la modale, retourne une Promise avec les données saisies (ou null si annulé)
    open() {
        return new Promise(resolve => {
            this._resolve     = resolve;
            this._selectedCat = null;
            this.titleInput.value = '';
            this.catGrid.style.outline = '';
            document.querySelectorAll('.cat-btn').forEach(b => {
                b.classList.remove('selected');
                b.style.backgroundColor = '';
            });
            this.modal.classList.remove('hidden');
            this.titleInput.focus();
        });
    }

    _close(result) {
        this.modal.classList.add('hidden');
        if (this._resolve) {
            this._resolve(result);
            this._resolve = null;
        }
    }
}
