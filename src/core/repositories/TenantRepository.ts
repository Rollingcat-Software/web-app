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
import { Tenant, TenantJSON } from '@domain/models/Tenant'

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

            // Build flat params: backend expects 'size' not 'pageSize'
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

            type TenantListResponse =
                | TenantJSON[]
                | { content: TenantJSON[]; totalElements?: number; totalPages?: number }

            const response = await this.httpClient.get<TenantListResponse>('/tenants', {
                params: flatParams,
            })

            let tenants: Tenant[]
            let total: number

            if (Array.isArray(response.data)) {
                tenants = response.data.map((data: TenantJSON) => Tenant.fromJSON(data))
                total = tenants.length
            } else if ('content' in response.data && response.data.content) {
                tenants = response.data.content.map((data: TenantJSON) => Tenant.fromJSON(data))
                total = response.data.totalElements ?? tenants.length
            } else {
                tenants = []
                total = 0
            }

            const pageSize = params?.pageSize || 20
            const page = params?.page || 0

            return {
                items: tenants,
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
            }
        } catch (error) {
            this.logger.error('Failed to fetch tenants', error)
            throw error
        }
    }

    /**
     * Find tenant by slug
     */
    async findBySlug(slug: string): Promise<Tenant | null> {
        try {
            this.logger.debug(`Fetching tenant by slug: ${slug}`)

            const response = await this.httpClient.get<TenantJSON>(`/tenants/slug/${slug}`)

            return Tenant.fromJSON(response.data)
        } catch (error: unknown) {
            const axiosError = error as { response?: { status?: number } }
            if (axiosError.response?.status === 404) {
                return null
            }
            this.logger.error(`Failed to fetch tenant by slug: ${slug}`, error)
            throw error
        }
    }

    /**
     * Find tenant by ID
     */
    async findById(id: string): Promise<Tenant | null> {
        try {
            this.logger.debug(`Fetching tenant ${id}`)

            const response = await this.httpClient.get<TenantJSON>(`/tenants/${id}`)

            return Tenant.fromJSON(response.data)
        } catch (error: unknown) {
            const axiosError = error as { response?: { status?: number } }
            if (axiosError.response?.status === 404) {
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

            const response = await this.httpClient.post<TenantJSON>('/tenants', data)

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
    async update(id: string, data: UpdateTenantData): Promise<Tenant> {
        try {
            this.logger.info(`Updating tenant ${id}`)

            const response = await this.httpClient.put<TenantJSON>(`/tenants/${id}`, data)

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
    async delete(id: string): Promise<void> {
        try {
            this.logger.info(`Deleting tenant ${id}`)

            await this.httpClient.delete(`/tenants/${id}`)

            this.logger.info('Tenant deleted successfully', { tenantId: id })
        } catch (error) {
            this.logger.error(`Failed to delete tenant ${id}`, error)
            throw error
        }
    }

    /**
     * Activate tenant
     */
    async activate(id: string): Promise<Tenant> {
        try {
            this.logger.info(`Activating tenant ${id}`)
            const response = await this.httpClient.post<TenantJSON>(`/tenants/${id}/activate`, {})
            return Tenant.fromJSON(response.data)
        } catch (error) {
            this.logger.error(`Failed to activate tenant ${id}`, error)
            throw error
        }
    }

    /**
     * Suspend tenant
     */
    async suspend(id: string): Promise<Tenant> {
        try {
            this.logger.info(`Suspending tenant ${id}`)
            const response = await this.httpClient.post<TenantJSON>(`/tenants/${id}/suspend`, {})
            return Tenant.fromJSON(response.data)
        } catch (error) {
            this.logger.error(`Failed to suspend tenant ${id}`, error)
            throw error
        }
    }
}
