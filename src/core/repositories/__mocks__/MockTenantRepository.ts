import { injectable } from 'inversify'
import type { CreateTenantData, ITenantRepository, UpdateTenantData } from '@domain/interfaces/ITenantRepository'
import type { PaginatedResult, QueryParams } from '@domain/interfaces/IRepository'
import { Tenant, TenantStatus } from '@domain/models/Tenant'

function toTenantStatus(value: string | undefined): TenantStatus {
    if (!value) {
        return TenantStatus.ACTIVE
    }

    return Object.values(TenantStatus).includes(value as TenantStatus)
        ? (value as TenantStatus)
        : TenantStatus.ACTIVE
}

@injectable()
export class MockTenantRepository implements ITenantRepository {
    private tenants = new Map<string, Tenant>([
        [
            '1',
            new Tenant(
                '1',
                'FIVUCSAS Tenant',
                'fivucsas',
                'Default tenant',
                'admin@fivucsas.com',
                '',
                TenantStatus.ACTIVE,
                1000,
                10,
                true,
                30,
                7,
                false,
                new Date(),
                new Date()
            ),
        ],
    ])

    async findAll(params?: QueryParams): Promise<PaginatedResult<Tenant>> {
        const page = params?.page ?? 0
        const pageSize = params?.pageSize ?? 20
        const filters = params?.filters ?? {}

        const filtered = Array.from(this.tenants.values()).filter((tenant) => {
            const statusFilter = filters.status as string | undefined
            const nameFilter = filters.name as string | undefined

            if (statusFilter && tenant.status !== statusFilter) {
                return false
            }

            if (nameFilter && !tenant.name.toLowerCase().includes(nameFilter.toLowerCase())) {
                return false
            }

            return true
        })

        const start = page * pageSize
        const items = filtered.slice(start, start + pageSize)

        return {
            items,
            total: filtered.length,
            page,
            pageSize,
            totalPages: filtered.length === 0 ? 0 : Math.ceil(filtered.length / pageSize),
        }
    }

    async findBySlug(slug: string): Promise<Tenant | null> {
        for (const tenant of this.tenants.values()) {
            if (tenant.slug === slug) {
                return tenant
            }
        }
        return null
    }

    async findById(id: string): Promise<Tenant | null> {
        return this.tenants.get(id) ?? null
    }

    async create(data: CreateTenantData): Promise<Tenant> {
        const id = String(this.tenants.size + 1)
        const tenant = new Tenant(
            id,
            data.name,
            data.slug,
            data.description ?? '',
            data.contactEmail ?? '',
            data.contactPhone ?? '',
            TenantStatus.ACTIVE,
            data.maxUsers,
            0,
            true,
            30,
            7,
            false,
            new Date(),
            new Date()
        )
        this.tenants.set(id, tenant)
        return tenant
    }

    async update(id: string, data: UpdateTenantData): Promise<Tenant> {
        const current = this.tenants.get(id)
        if (!current) {
            throw new Error(`Tenant not found: ${id}`)
        }

        const updated = new Tenant(
            current.id,
            data.name ?? current.name,
            data.slug ?? current.slug,
            data.description ?? current.description,
            data.contactEmail ?? current.contactEmail,
            data.contactPhone ?? current.contactPhone,
            current.status,
            data.maxUsers ?? current.maxUsers,
            current.currentUsers,
            current.biometricEnabled,
            current.sessionTimeoutMinutes,
            current.refreshTokenValidityDays,
            current.mfaRequired,
            current.createdAt,
            new Date()
        )

        this.tenants.set(id, updated)
        return updated
    }

    async delete(id: string): Promise<void> {
        this.tenants.delete(id)
    }

    async activate(id: string): Promise<Tenant> {
        return this.updateStatus(id, TenantStatus.ACTIVE)
    }

    async suspend(id: string): Promise<Tenant> {
        return this.updateStatus(id, TenantStatus.SUSPENDED)
    }

    private async updateStatus(id: string, status: TenantStatus): Promise<Tenant> {
        const current = this.tenants.get(id)
        if (!current) {
            throw new Error(`Tenant not found: ${id}`)
        }

        const updated = new Tenant(
            current.id,
            current.name,
            current.slug,
            current.description,
            current.contactEmail,
            current.contactPhone,
            toTenantStatus(status),
            current.maxUsers,
            current.currentUsers,
            current.biometricEnabled,
            current.sessionTimeoutMinutes,
            current.refreshTokenValidityDays,
            current.mfaRequired,
            current.createdAt,
            new Date()
        )

        this.tenants.set(id, updated)
        return updated
    }
}
