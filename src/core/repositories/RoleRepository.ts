import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { IRoleRepository, CreateRoleData, UpdateRoleData } from '@domain/interfaces/IRoleRepository'
import type { PaginatedResult, QueryParams } from '@domain/interfaces/IRepository'
import { Role, RoleJSON } from '@domain/models/Role'
import { Permission, PermissionJSON } from '@domain/models/Permission'

@injectable()
export class RoleRepository implements IRoleRepository {
    constructor(
        @inject(TYPES.HttpClient) private readonly httpClient: IHttpClient,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    async findAll(params?: QueryParams): Promise<PaginatedResult<Role>> {
        try {
            this.logger.debug('Fetching all roles', { params })

            const flatParams: Record<string, unknown> = {}
            if (params?.page !== undefined) flatParams.page = params.page
            if (params?.pageSize !== undefined) flatParams.size = params.pageSize
            if (params?.sort) flatParams.sort = params.sort
            if (params?.order) flatParams.order = params.order
            if (params?.filters) {
                Object.entries(params.filters).forEach(([key, value]) => {
                    if (value !== undefined && value !== null) {
                        flatParams[key] = value
                    }
                })
            }

            type RoleListResponse =
                | RoleJSON[]
                | { content: RoleJSON[]; totalElements?: number }

            const response = await this.httpClient.get<RoleListResponse>('/roles', {
                params: flatParams,
            })

            let roles: Role[]
            let total: number

            if (Array.isArray(response.data)) {
                roles = response.data.map((data: RoleJSON) => Role.fromJSON(data))
                total = roles.length
            } else if ('content' in response.data && response.data.content) {
                roles = response.data.content.map((data: RoleJSON) => Role.fromJSON(data))
                total = response.data.totalElements ?? roles.length
            } else {
                roles = []
                total = 0
            }

            const pageSize = params?.pageSize || 20
            const page = params?.page || 0

            return {
                items: roles,
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
            }
        } catch (error) {
            this.logger.error('Failed to fetch roles', error)
            throw error
        }
    }

    async findById(id: string): Promise<Role | null> {
        try {
            this.logger.debug(`Fetching role ${id}`)
            const response = await this.httpClient.get<RoleJSON>(`/roles/${id}`)
            return Role.fromJSON(response.data)
        } catch (error: unknown) {
            const axiosError = error as { response?: { status?: number } }
            if (axiosError.response?.status === 404) {
                return null
            }
            this.logger.error(`Failed to fetch role ${id}`, error)
            throw error
        }
    }

    async findByTenant(tenantId: string): Promise<Role[]> {
        try {
            this.logger.debug(`Fetching roles for tenant ${tenantId}`)
            const response = await this.httpClient.get<RoleJSON[]>(`/roles/tenant/${tenantId}`)
            return response.data.map((data) => Role.fromJSON(data))
        } catch (error) {
            this.logger.error(`Failed to fetch roles for tenant ${tenantId}`, error)
            throw error
        }
    }

    async create(data: CreateRoleData): Promise<Role> {
        try {
            this.logger.info('Creating new role', { name: data.name })
            const response = await this.httpClient.post<RoleJSON>('/roles', data)
            return Role.fromJSON(response.data)
        } catch (error) {
            this.logger.error('Failed to create role', error)
            throw error
        }
    }

    async update(id: string, data: UpdateRoleData): Promise<Role> {
        try {
            this.logger.info(`Updating role ${id}`)
            const response = await this.httpClient.put<RoleJSON>(`/roles/${id}`, data)
            return Role.fromJSON(response.data)
        } catch (error) {
            this.logger.error(`Failed to update role ${id}`, error)
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            this.logger.info(`Deleting role ${id}`)
            await this.httpClient.delete(`/roles/${id}`)
        } catch (error) {
            this.logger.error(`Failed to delete role ${id}`, error)
            throw error
        }
    }

    async assignPermission(roleId: string, permissionId: string): Promise<void> {
        try {
            this.logger.info(`Assigning permission ${permissionId} to role ${roleId}`)
            await this.httpClient.post(`/roles/${roleId}/permissions/${permissionId}`, {})
        } catch (error) {
            this.logger.error('Failed to assign permission', error)
            throw error
        }
    }

    async revokePermission(roleId: string, permissionId: string): Promise<void> {
        try {
            this.logger.info(`Revoking permission ${permissionId} from role ${roleId}`)
            await this.httpClient.delete(`/roles/${roleId}/permissions/${permissionId}`)
        } catch (error) {
            this.logger.error('Failed to revoke permission', error)
            throw error
        }
    }

    async getAllPermissions(): Promise<Permission[]> {
        try {
            this.logger.debug('Fetching all permissions')
            const response = await this.httpClient.get<PermissionJSON[]>('/permissions')
            return response.data.map((data) => Permission.fromJSON(data))
        } catch (error) {
            this.logger.error('Failed to fetch permissions', error)
            throw error
        }
    }
}
