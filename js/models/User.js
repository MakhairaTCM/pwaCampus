export const ROLES = {
    STUDENT: 'student',
    SECURITY: 'security',
    STAFF: 'staff'
};

export class User {
    constructor(id, username, role) {
        this.id = id;
        this.username = username;
        this.role = role || ROLES.STUDENT;
        this.token = "mock_token_jwt_12345";
    }

    hasPermission(action) {
        if (this.role === ROLES.SECURITY) return true; // Sécurité peut tout faire
        if (action === 'create_danger' && this.role === ROLES.STUDENT) return true;
        return false;
    }
}