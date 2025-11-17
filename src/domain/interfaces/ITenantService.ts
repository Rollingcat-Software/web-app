import type { Tenant } from '@domain/models/Tenant'
import type { PaginatedResult } from './IRepository'
import type { CreateTenantData, UpdateTenantData } from './ITenantRepository'

/**
 * Tenant filters for querying
 */
export interface TenantFilters {
    search?: string
    status?: string
}

/**
 * Tenant Service interface
 * Handles tenant business logic
 */
export interface ITenantService {
    /**
     * Get all tenants with optional filters
     */
    getTenants(filters?: TenantFilters, page?: number, pageSize?: number): Promise<PaginatedResult<Tenant>>

    /**
     * Get tenant by ID
     * @throws NotFoundError if tenant doesn't exist
     */
    getTenantById(id: number): Promise<Tenant>

    /**
     * Create new tenant
     * @throws ValidationError if data is invalid
     * @throws ConflictError if domain already exists
     */
    createTenant(data: CreateTenantData): Promise<Tenant>

    /**
     * Update tenant
     * @throws NotFoundError if tenant doesn't exist
     * @throws ValidationError if data is invalid
     */
    updateTenant(id: number, data: UpdateTenantData): Promise<Tenant>

    /**
     * Delete tenant
     * @throws NotFoundError if tenant doesn't exist
     */
    deleteTenant(id: number): Promise<void>
}
