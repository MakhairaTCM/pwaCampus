export const CATEGORIES = {
    DANGER:  { id: 'danger',  name: 'Danger',   color: '#ff0000', icon: '⚠️', scale: 1.5, urgent: true },
    PANNE:   { id: 'panne',   name: 'Panne',    color: '#ffaa00', icon: '🔧', scale: 1.0, urgent: false },
    INFO:    { id: 'info',    name: 'Info',     color: '#0000ff', icon: 'ℹ️', scale: 1.0, urgent: false },
    BONPLAN: { id: 'bonplan', name: 'Bon Plan', color: '#00cc00', icon: '💸', scale: 1.2, urgent: false },
    SOCIAL:  { id: 'social',  name: 'Social',   color: '#8e44ad', icon: '🎉', scale: 1.0, urgent: false },
    AUTRE:   { id: 'autre',   name: 'Autre',    color: '#7f8c8d', icon: '📍', scale: 0.8, urgent: false }
};

export class Category {
    static getAll() { return Object.values(CATEGORIES); }
    static getById(id) { return Object.values(CATEGORIES).find(c => c.id === id) || CATEGORIES.AUTRE; }
}