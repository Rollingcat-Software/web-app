import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { ILogger } from '@domain/interfaces/ILogger'
import type {
    ITenantRepository,
    CreateTenantData,
    UpdateTenantData,
} from '@domain/interfaces/ITenantRepository'
import type { PaginatedResult, QueryParams } from '@domain/interfaces/IRepository'
import { Tenant, TenantStatus } from '@domain/models/Tenant'

/**
 * Mock Tenant Repository
 * Provides fake tenant data for development/testing
 */
@injectable()
export class MockTenantRepository implements ITenantRepository {
    private tenants: Tenant[]
    private nextId: number

    constructor(@inject(TYPES.Logger) private readonly logger: ILogger) {
        // Initialize with mock tenants
        this.tenants = [
            new Tenant(
                1,
                'Acme Corporation',
                'acme.com',
                TenantStatus.ACTIVE,
                100,
                45,
                new Date('2025-01-10T10:00:00Z'),
                new Date('2025-01-10T10:00:00Z')
            ),
            new Tenant(
                2,
                'TechStart Inc',
                'techstart.io',
                TenantStatus.TRIAL,
                50,
                12,
                new Date('2025-02-15T10:00:00Z'),
                new Date('2025-02-15T10:00:00Z')
            ),
            new Tenant(
                3,
                'Global Enterprises',
                'globalent.com',
                TenantStatus.ACTIVE,
                500,
                287,
                new Date('2024-12-01T10:00:00Z'),
                new Date('2024-12-01T10:00:00Z')
            ),
            new Tenant(
                4,
                'Startup XYZ',
                'startupxyz.com',
                TenantStatus.SUSPENDED,
                25,
                8,
                new Date('2025-03-01T10:00:00Z'),
                new Date('2025-11-15T10:00:00Z')
            ),
        ]
        this.nextId = 5
    }

    async findAll(params?: QueryParams): Promise<PaginatedResult<Tenant>> {
        this.logger.debug('Mock: Fetching all tenants', { params })
        await this.delay(400)

        let filteredTenants = [...this.tenants]

        // Apply filters if provided
        if (params?.filters) {
            const { search, status } = params.filters as any

            if (search) {
                const searchLower = search.toLowerCase()
                filteredTenants = filteredTenants.filter(
                    (t) =>
                        t.name.toLowerCase().includes(searchLower) ||
                        t.domain.toLowerCase().includes(searchLower)
                )
            }

            if (status) {
                filteredTenants = filteredTenants.filter((t) => t.status === status)
            }
        }

        const pageSize = params?.pageSize || 20
        const page = params?.page || 0
        const startIndex = page * pageSize
        const endIndex = startIndex + pageSize

        return {
            items: filteredTenants.slice(startIndex, endIndex),
            total: filteredTenants.length,
            page,
            pageSize,
            totalPages: Math.ceil(filteredTenants.length / pageSize),
        }
    }

    async findById(id: number): Promise<Tenant | null> {
        this.logger.debug(`Mock: Fetching tenant ${id}`)
        await this.delay(300)

        const tenant = this.tenants.find((t) => t.id === id)
        return tenant || null
    }

    async create(data: CreateTenantData): Promise<Tenant> {
        this.logger.info('Mock: Creating new tenant', { name: data.name })
        await this.delay(500)

        const tenant = new Tenant(
            this.nextId++,
            data.name,
            data.domain,
            data.status as TenantStatus,
            data.maxUsers,
            data.currentUsers || 0,
            new Date(),
            new Date()
        )

        this.tenants.push(tenant)

        return tenant
    }

    async update(id: number, data: UpdateTenantData): Promise<Tenant> {
        this.logger.info(`Mock: Updating tenant ${id}`)
        await this.delay(400)

        const index = this.tenants.findIndex((t) => t.id === id)
        if (index === -1) {
            throw new Error('Tenant not found')
        }

        const existingTenant = this.tenants[index]

        // Create updated tenant (immutable)
        const updatedTenant = new Tenant(
            existingTenant.id,
            data.name || existingTenant.name,
            data.domain || existingTenant.domain,
            (data.status as TenantStatus) || existingTenant.status,
            data.maxUsers !== undefined ? data.maxUsers : existingTenant.maxUsers,
            data.currentUsers !== undefined ? data.currentUsers : existingTenant.currentUsers,
            existingTenant.createdAt,
            new Date() // Update timestamp
        )

        this.tenants[index] = updatedTenant

        return updatedTenant
    }

    async delete(id: number): Promise<void> {
        this.logger.info(`Mock: Deleting tenant ${id}`)
        await this.delay(300)

        const index = this.tenants.findIndex((t) => t.id === id)
        if (index !== -1) {
            this.tenants.splice(index, 1)
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }
}
