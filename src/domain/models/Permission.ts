import { UserRole } from './User'

export { UserRole }

export interface PermissionJSON {
    id: string
    name: string
    description?: string
    resource: string
    action: string
    authority?: string
}

export class Permission {
    constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly description: string,
        public readonly resource: string,
        public readonly action: string
    ) {}

    get authority(): string {
        return `${this.resource}:${this.action}`
    }

    toJSON(): PermissionJSON {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            resource: this.resource,
            action: this.action,
            authority: this.authority,
        }
    }

    static fromJSON(data: PermissionJSON): Permission {
        return new Permission(
            data.id,
            data.name,
            data.description ?? '',
            data.resource ?? '',
            data.action ?? ''
        )
    }

    // Well-known permission constants
    static readonly USERS_VIEW = new Permission('users:view', 'View Users', 'View user list', 'users', 'view')
    static readonly USERS_CREATE = new Permission('users:create', 'Create Users', 'Create new users', 'users', 'create')
    static readonly USERS_EDIT = new Permission('users:edit', 'Edit Users', 'Edit existing users', 'users', 'edit')
    static readonly USERS_DELETE = new Permission('users:delete', 'Delete Users', 'Delete users', 'users', 'delete')
    static readonly TENANTS_VIEW = new Permission('tenants:view', 'View Tenants', 'View tenant list', 'tenants', 'view')
    static readonly TENANTS_CREATE = new Permission('tenants:create', 'Create Tenants', 'Create new tenants', 'tenants', 'create')
    static readonly TENANTS_EDIT = new Permission('tenants:edit', 'Edit Tenants', 'Edit existing tenants', 'tenants', 'edit')
    static readonly TENANTS_DELETE = new Permission('tenants:delete', 'Delete Tenants', 'Delete tenants', 'tenants', 'delete')
    static readonly DASHBOARD_VIEW = new Permission('dashboard:view', 'View Dashboard', 'View dashboard', 'dashboard', 'view')
    static readonly ENROLLMENTS_VIEW = new Permission('enrollments:view', 'View Enrollments', 'View enrollments', 'enrollments', 'view')
    static readonly ENROLLMENTS_MANAGE = new Permission('enrollments:manage', 'Manage Enrollments', 'Manage enrollments', 'enrollments', 'manage')
    static readonly AUDIT_VIEW = new Permission('audit:view', 'View Audit Logs', 'View audit logs', 'audit', 'view')
    static readonly SETTINGS_VIEW = new Permission('settings:view', 'View Settings', 'View settings', 'settings', 'view')
    static readonly SETTINGS_EDIT = new Permission('settings:edit', 'Edit Settings', 'Edit settings', 'settings', 'edit')
    static readonly ROLES_VIEW = new Permission('roles:view', 'View Roles', 'View roles', 'roles', 'view')
    static readonly ROLES_MANAGE = new Permission('roles:manage', 'Manage Roles', 'Manage roles', 'roles', 'manage')
}

/**
 * Default role-to-permission mapping
 * SUPER_ADMIN gets all permissions, others get subsets
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
    [UserRole.SUPER_ADMIN]: [
        Permission.USERS_VIEW, Permission.USERS_CREATE, Permission.USERS_EDIT, Permission.USERS_DELETE,
        Permission.TENANTS_VIEW, Permission.TENANTS_CREATE, Permission.TENANTS_EDIT, Permission.TENANTS_DELETE,
        Permission.DASHBOARD_VIEW, Permission.ENROLLMENTS_VIEW, Permission.ENROLLMENTS_MANAGE,
        Permission.AUDIT_VIEW, Permission.SETTINGS_VIEW, Permission.SETTINGS_EDIT,
        Permission.ROLES_VIEW, Permission.ROLES_MANAGE,
    ],
    [UserRole.ADMIN]: [
        Permission.USERS_VIEW, Permission.USERS_CREATE, Permission.USERS_EDIT, Permission.USERS_DELETE,
        Permission.DASHBOARD_VIEW, Permission.ENROLLMENTS_VIEW, Permission.ENROLLMENTS_MANAGE,
        Permission.AUDIT_VIEW, Permission.SETTINGS_VIEW, Permission.ROLES_VIEW,
    ],
    [UserRole.TENANT_ADMIN]: [
        Permission.USERS_VIEW, Permission.USERS_CREATE, Permission.USERS_EDIT,
        Permission.DASHBOARD_VIEW, Permission.ENROLLMENTS_VIEW, Permission.ENROLLMENTS_MANAGE,
        Permission.SETTINGS_VIEW,
    ],
    [UserRole.USER]: [
        Permission.DASHBOARD_VIEW,
    ],
}
