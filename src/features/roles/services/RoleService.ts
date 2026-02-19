import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { IRoleService } from '@domain/interfaces/IRoleService'
import type { IRoleRepository, CreateRoleData, UpdateRoleData } from '@domain/interfaces/IRoleRepository'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { PaginatedResult } from '@domain/interfaces/IRepository'
import { Role } from '@domain/models/Role'
import { Permission } from '@domain/models/Permission'
import { NotFoundError, BusinessError } from '@core/errors'
import { RoleRepository } from '@core/repositories/RoleRepository'

@injectable()
export class RoleService implements IRoleService {
    constructor(
        @inject(TYPES.RoleRepository) private readonly roleRepository: IRoleRepository,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    async getRoles(): Promise<PaginatedResult<Role>> {
        try {
            return await this.roleRepository.findAll()
        } catch (error) {
            this.logger.error('Failed to get roles', error)
            throw error
        }
    }

    async getRoleById(id: string): Promise<Role> {
        const role = await this.roleRepository.findById(id)
        if (!role) {
            throw new NotFoundError(`Role with ID ${id} not found`)
        }
        return role
    }

    async getRolesByTenant(tenantId: string): Promise<Role[]> {
        return this.roleRepository.findByTenant(tenantId)
    }

    async createRole(data: CreateRoleData): Promise<Role> {
        try {
            this.logger.info('Creating role', { name: data.name })
            return await this.roleRepository.create(data)
        } catch (error) {
            this.logger.error('Failed to create role', error)
            throw error
        }
    }

    async updateRole(id: string, data: UpdateRoleData): Promise<Role> {
        const existing = await this.roleRepository.findById(id)
        if (!existing) {
            throw new NotFoundError(`Role with ID ${id} not found`)
        }
        if (existing.systemRole) {
            throw new BusinessError('Cannot modify system roles')
        }
        try {
            return await this.roleRepository.update(id, data)
        } catch (error) {
            this.logger.error(`Failed to update role ${id}`, error)
            throw error
        }
    }

    async deleteRole(id: string): Promise<void> {
        const existing = await this.roleRepository.findById(id)
        if (!existing) {
            throw new NotFoundError(`Role with ID ${id} not found`)
        }
        if (existing.systemRole) {
            throw new BusinessError('Cannot delete system roles')
        }
        try {
            await this.roleRepository.delete(id)
        } catch (error) {
            this.logger.error(`Failed to delete role ${id}`, error)
            throw error
        }
    }

    async assignPermission(roleId: string, permissionId: string): Promise<void> {
        await this.roleRepository.assignPermission(roleId, permissionId)
    }

    async revokePermission(roleId: string, permissionId: string): Promise<void> {
        await this.roleRepository.revokePermission(roleId, permissionId)
    }

    async getPermissions(): Promise<Permission[]> {
        return (this.roleRepository as RoleRepository).getAllPermissions()
    }
}
