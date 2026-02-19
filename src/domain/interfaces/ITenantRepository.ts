import type { Tenant } from '@domain/models/Tenant'
import type { PaginatedResult, QueryParams } from './IRepository'

/**
 * Create tenant data (without generated fields)
 */
export interface CreateTenantData {
    name: string
    slug: string
    description?: string
    contactEmail?: string
    contactPhone?: string
    maxUsers: number
}

/**
 * Update tenant data (all fields optional)
 */
export interface UpdateTenantData {
    name?: string
    slug?: string
    description?: string
    contactEmail?: string
    contactPhone?: string
    maxUsers?: number
}

/**
 * Tenant Repository interface
 * Handles tenant data access operations
 */
export interface ITenantRepository {
    /**
     * Find all tenants with optional filters and pagination
     */
    findAll(params?: QueryParams): Promise<PaginatedResult<Tenant>>

    /**
     * Find tenant by ID
     * @returns Tenant if found, null otherwise
     */
    findById(id: string): Promise<Tenant | null>

    /**
     * Create new tenant
     */
    create(data: CreateTenantData): Promise<Tenant>

    /**
     * Update existing tenant
     */
    update(id: string, data: UpdateTenantData): Promise<Tenant>

    /**
     * Delete tenant
     */
    delete(id: string): Promise<void>

    /**
     * Activate tenant
     */
    activate(id: string): Promise<Tenant>

    /**
     * Suspend tenant
     */
    suspend(id: string): Promise<Tenant>
}
