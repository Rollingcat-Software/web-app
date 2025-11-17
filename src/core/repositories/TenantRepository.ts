import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ILogger } from '@domain/interfaces/ILogger'
import type {
    ITenantRepository,
    CreateTenantData,
    UpdateTenantData,
} from '@domain/interfaces/ITenantRepository'
import type { PaginatedResult, QueryParams } from '@domain/interfaces/IRepository'
import { Tenant } from '@domain/models/Tenant'

/**
 * Tenant Repository
 * Handles tenant API calls
 */
@injectable()
export class TenantRepository implements ITenantRepository {
    constructor(
        @inject(TYPES.HttpClient) private readonly httpClient: IHttpClient,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    /**
     * Find all tenants
     */
    async findAll(params?: QueryParams): Promise<PaginatedResult<Tenant>> {
        try {
            this.logger.debug('Fetching all tenants', { params })

            const response = await this.httpClient.get<any[]>('/tenants', {
                params: params as Record<string, unknown>,
            })

            // Backend currently returns array, not paginated response
            // Map to our paginated format
            const tenants = response.data.map((data) => Tenant.fromJSON(data))

            const pageSize = params?.pageSize || 20
            const page = params?.page || 0

            return {
                items: tenants,
                total: tenants.length,
                page,
                pageSize,
                totalPages: Math.ceil(tenants.length / pageSize),
            }
        } catch (error) {
            this.logger.error('Failed to fetch tenants', error)
            throw error
        }
    }

    /**
     * Find tenant by ID
     */
    async findById(id: number): Promise<Tenant | null> {
        try {
            this.logger.debug(`Fetching tenant ${id}`)

            const response = await this.httpClient.get<any>(`/tenants/${id}`)

            return Tenant.fromJSON(response.data)
        } catch (error: any) {
            if (error.response?.status === 404) {
                return null
            }
            this.logger.error(`Failed to fetch tenant ${id}`, error)
            throw error
        }
    }

    /**
     * Create new tenant
     */
    async create(data: CreateTenantData): Promise<Tenant> {
        try {
            this.logger.info('Creating new tenant', { name: data.name })

            const response = await this.httpClient.post<any>('/tenants', data)

            const tenant = Tenant.fromJSON(response.data)

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
    async update(id: number, data: UpdateTenantData): Promise<Tenant> {
        try {
            this.logger.info(`Updating tenant ${id}`)

            const response = await this.httpClient.put<any>(`/tenants/${id}`, data)

            const tenant = Tenant.fromJSON(response.data)

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
    async delete(id: number): Promise<void> {
        try {
            this.logger.info(`Deleting tenant ${id}`)

            await this.httpClient.delete(`/tenants/${id}`)

            this.logger.info('Tenant deleted successfully', { tenantId: id })
        } catch (error) {
            this.logger.error(`Failed to delete tenant ${id}`, error)
            throw error
        }
    }
}
