import type { Role } from '@domain/models/Role'
import type { Permission } from '@domain/models/Permission'
import type { PaginatedResult, QueryParams } from './IRepository'

export interface CreateRoleData {
    name: string
    description?: string
    tenantId: string
    permissionIds?: string[]
}

export interface UpdateRoleData {
    name?: string
    description?: string
    active?: boolean
}

export interface IRoleRepository {
    findAll(params?: QueryParams): Promise<PaginatedResult<Role>>
    findById(id: string): Promise<Role | null>
    findByTenant(tenantId: string): Promise<Role[]>
    create(data: CreateRoleData): Promise<Role>
    update(id: string, data: UpdateRoleData): Promise<Role>
    delete(id: string): Promise<void>
    assignPermission(roleId: string, permissionId: string): Promise<void>
    revokePermission(roleId: string, permissionId: string): Promise<void>
    getAllPermissions(): Promise<Permission[]>
}
