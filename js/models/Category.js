export const CATEGORIES = {
    DANGER:  { id: 'danger',  name: 'Danger',   color: '#D64045', icon: '⚠️',  scale: 1.5, urgent: true  },
    PANNE:   { id: 'panne',   name: 'Panne',    color: '#E8A317', icon: '🔧',  scale: 1.0, urgent: false },
    INFO:    { id: 'info',    name: 'Info',     color: '#0078B4', icon: 'ℹ️',  scale: 1.0, urgent: false },
    BONPLAN: { id: 'bonplan', name: 'Bon Plan', color: '#10997D', icon: '⭐',  scale: 1.2, urgent: false },
    SOCIAL:  { id: 'social',  name: 'Social',   color: '#7B2D8B', icon: '👥',  scale: 1.0, urgent: false },
    NATURE:  { id: 'nature',  name: 'Nature',   color: '#2D6A4F', icon: '🌿',  scale: 1.0, urgent: false },
    AIDE:    { id: 'aide',    name: 'Aide',     color: '#FF6B6B', icon: '🆘',  scale: 1.3, urgent: true  },
    AUTRE:   { id: 'autre',   name: 'Autre',    color: '#6C757D', icon: '📌',  scale: 0.8, urgent: false }
};

export class Category {
    static getAll() { return Object.values(CATEGORIES); }
    static getById(id) { return Object.values(CATEGORIES).find(c => c.id === id) || CATEGORIES.AUTRE; }
}