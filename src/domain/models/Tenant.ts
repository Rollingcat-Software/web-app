/**
 * Tenant domain model
 * Represents a tenant entity in the system
 */

export enum TenantStatus {
    ACTIVE = 'ACTIVE',
    TRIAL = 'TRIAL',
    SUSPENDED = 'SUSPENDED',
}

/**
 * Tenant entity
 */
export class Tenant {
    constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly domain: string,
        public readonly status: TenantStatus,
        public readonly maxUsers: number,
        public readonly currentUsers: number,
        public readonly createdAt: Date,
        public readonly updatedAt: Date
    ) {}

    /**
     * Check if tenant is active
     */
    isActive(): boolean {
        return this.status === TenantStatus.ACTIVE
    }

    /**
     * Check if tenant is on trial
     */
    isTrial(): boolean {
        return this.status === TenantStatus.TRIAL
    }

    /**
     * Check if tenant is suspended
     */
    isSuspended(): boolean {
        return this.status === TenantStatus.SUSPENDED
    }

    /**
     * Get usage percentage
     */
    getUsagePercentage(): number {
        if (this.maxUsers === 0) {
            return 0
        }
        return Math.round((this.currentUsers / this.maxUsers) * 100)
    }

    /**
     * Check if tenant is at or over capacity
     */
    isAtCapacity(): boolean {
        return this.currentUsers >= this.maxUsers
    }

    /**
     * Get remaining user slots
     */
    getRemainingSlots(): number {
        return Math.max(0, this.maxUsers - this.currentUsers)
    }

    /**
     * Convert to plain object (for serialization)
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            domain: this.domain,
            status: this.status,
            maxUsers: this.maxUsers,
            currentUsers: this.currentUsers,
            createdAt: this.createdAt.toISOString(),
            updatedAt: this.updatedAt.toISOString(),
        }
    }

    /**
     * Create Tenant from plain object (deserialization)
     */
    static fromJSON(data: any): Tenant {
        return new Tenant(
            data.id,
            data.name,
            data.domain,
            data.status,
            data.maxUsers,
            data.currentUsers,
            new Date(data.createdAt),
            new Date(data.updatedAt)
        )
    }
}
