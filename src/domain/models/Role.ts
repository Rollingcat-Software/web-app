import { Permission, PermissionJSON } from './Permission'

export interface RoleJSON {
    id: string
    tenantId?: string
    name: string
    description?: string
    systemRole?: boolean
    active?: boolean
    permissions?: PermissionJSON[]
    createdAt?: string
    updatedAt?: string
}

export class Role {
    constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly description: string,
        public readonly tenantId: string,
        public readonly systemRole: boolean,
        public readonly active: boolean,
        public readonly permissions: Permission[],
        public readonly createdAt: Date,
        public readonly updatedAt: Date
    ) {}

    get permissionCount(): number {
        return this.permissions.length
    }

    hasPermission(authority: string): boolean {
        return this.permissions.some((p) => p.authority === authority)
    }

    toJSON(): RoleJSON {
        return {
            id: this.id,
            tenantId: this.tenantId,
            name: this.name,
            description: this.description,
            systemRole: this.systemRole,
            active: this.active,
            permissions: this.permissions.map((p) => p.toJSON()),
            createdAt: this.createdAt.toISOString(),
            updatedAt: this.updatedAt.toISOString(),
        }
    }

    static fromJSON(data: RoleJSON): Role {
        return new Role(
            data.id,
            data.name,
            data.description ?? '',
            data.tenantId ?? '',
            data.systemRole ?? false,
            data.active ?? true,
            (data.permissions ?? []).map((p) => Permission.fromJSON(p)),
            new Date(data.createdAt ?? new Date()),
            new Date(data.updatedAt ?? new Date())
        )
    }
}
