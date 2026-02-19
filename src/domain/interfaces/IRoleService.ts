import type { Role } from '@domain/models/Role'
import type { Permission } from '@domain/models/Permission'
import type { PaginatedResult } from './IRepository'
import type { CreateRoleData, UpdateRoleData } from './IRoleRepository'

export interface IRoleService {
    getRoles(): Promise<PaginatedResult<Role>>
    getRoleById(id: string): Promise<Role>
    getRolesByTenant(tenantId: string): Promise<Role[]>
    createRole(data: CreateRoleData): Promise<Role>
    updateRole(id: string, data: UpdateRoleData): Promise<Role>
    deleteRole(id: string): Promise<void>
    assignPermission(roleId: string, permissionId: string): Promise<void>
    revokePermission(roleId: string, permissionId: string): Promise<void>
    getPermissions(): Promise<Permission[]>
}
