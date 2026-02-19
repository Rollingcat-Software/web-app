import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { ITenantService, TenantFilters } from '@domain/interfaces/ITenantService'
import type { ITenantRepository, CreateTenantData, UpdateTenantData } from '@domain/interfaces/ITenantRepository'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { PaginatedResult } from '@domain/interfaces/IRepository'
import { Tenant } from '@domain/models/Tenant'
import { ValidationError, NotFoundError } from '@core/errors'

/**
 * Tenant Service
 * Handles tenant business logic
 */
@injectable()
export class TenantService implements ITenantService {
    constructor(
        @inject(TYPES.TenantRepository) private readonly tenantRepository: ITenantRepository,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    /**
     * Get all tenants with optional filters
     */
    async getTenants(
        filters?: TenantFilters,
        page: number = 0,
        pageSize: number = 20
    ): Promise<PaginatedResult<Tenant>> {
        try {
            this.logger.debug('Getting tenants', { filters, page, pageSize })

            const result = await this.tenantRepository.findAll({
                page,
                pageSize,
                filters: filters as Record<string, unknown>,
            })

            return result
        } catch (error) {
            this.logger.error('Failed to get tenants', error)
            throw error
        }
    }

    /**
     * Get tenant by ID
     */
    async getTenantById(id: string): Promise<Tenant> {
        this.logger.debug(`Getting tenant ${id}`)

        const tenant = await this.tenantRepository.findById(id)

        if (!tenant) {
            throw new NotFoundError(`Tenant with ID ${id} not found`)
        }

        return tenant
    }

    /**
     * Create new tenant
     */
    async createTenant(data: CreateTenantData): Promise<Tenant> {
        // Basic validation
        if (!data.name || data.name.trim().length === 0) {
            throw new ValidationError('Tenant name is required', [
                { field: 'name', message: 'Name cannot be empty' },
            ])
        }

        if (!data.slug || data.slug.trim().length === 0) {
            throw new ValidationError('Tenant slug is required', [
                { field: 'slug', message: 'Slug cannot be empty' },
            ])
        }

        if (data.maxUsers === undefined || data.maxUsers < 0) {
            throw new ValidationError('Max users must be a positive number', [
                { field: 'maxUsers', message: 'Max users must be >= 0' },
            ])
        }

        // Create tenant
        try {
            this.logger.info('Creating new tenant', { name: data.name })

            const tenant = await this.tenantRepository.create(data)

            this.logger.info('Tenant created successfully', { tenantId: tenant.id })

            return tenant
        } catch (error) {
            this.logger.error('Failed to create tenant', error)
            throw error
        }
    }

    /**
     * Update tenant
     */
    async updateTenant(id: string, data: UpdateTenantData): Promise<Tenant> {
        // Basic validation
        if (data.name !== undefined && data.name.trim().length === 0) {
            throw new ValidationError('Tenant name cannot be empty', [
                { field: 'name', message: 'Name cannot be empty' },
            ])
        }

        if (data.slug !== undefined && data.slug.trim().length === 0) {
            throw new ValidationError('Tenant slug cannot be empty', [
                { field: 'slug', message: 'Slug cannot be empty' },
            ])
        }

        if (data.maxUsers !== undefined && data.maxUsers < 0) {
            throw new ValidationError('Max users must be a positive number', [
                { field: 'maxUsers', message: 'Max users must be >= 0' },
            ])
        }

        // Check if tenant exists
        const existingTenant = await this.tenantRepository.findById(id)
        if (!existingTenant) {
            throw new NotFoundError(`Tenant with ID ${id} not found`)
        }

        try {
            this.logger.info(`Updating tenant ${id}`)

            const tenant = await this.tenantRepository.update(id, data)

            this.logger.info('Tenant updated successfully', { tenantId: tenant.id })

            return tenant
        } catch (error) {
            this.logger.error(`Failed to update tenant ${id}`, error)
            throw error
        }
    }

    /**
     * Delete tenant
     */
    async deleteTenant(id: string): Promise<void> {
        // Check if tenant exists
        const existingTenant = await this.tenantRepository.findById(id)
        if (!existingTenant) {
            throw new NotFoundError(`Tenant with ID ${id} not found`)
        }

        try {
            this.logger.info(`Deleting tenant ${id}`)

            await this.tenantRepository.delete(id)

            this.logger.info('Tenant deleted successfully', { tenantId: id })
        } catch (error) {
            this.logger.error(`Failed to delete tenant ${id}`, error)
            throw error
        }
    }

    /**
     * Activate tenant
     */
    async activateTenant(id: string): Promise<Tenant> {
        try {
            this.logger.info(`Activating tenant ${id}`)
            return await this.tenantRepository.activate(id)
        } catch (error) {
            this.logger.error(`Failed to activate tenant ${id}`, error)
            throw error
        }
    }

    /**
     * Suspend tenant
     */
    async suspendTenant(id: string): Promise<Tenant> {
        try {
            this.logger.info(`Suspending tenant ${id}`)
            return await this.tenantRepository.suspend(id)
        } catch (error) {
            this.logger.error(`Failed to suspend tenant ${id}`, error)
            throw error
        }
    }
}
