/**
 * Tenant domain model
 * Represents a tenant entity in the system
 */

export enum TenantStatus {
    ACTIVE = 'ACTIVE',
    TRIAL = 'TRIAL',
    SUSPENDED = 'SUSPENDED',
    INACTIVE = 'INACTIVE',
    PENDING = 'PENDING',
}

export interface TenantJSON {
    id: string
    name: string
    slug?: string    // backend field name
    domain?: string  // legacy/alias
    description?: string
    contactEmail?: string
    contactPhone?: string
    status: TenantStatus
    maxUsers: number
    currentUsers?: number  // may not be present
    biometricEnabled?: boolean
    sessionTimeoutMinutes?: number
    refreshTokenValidityDays?: number
    mfaRequired?: boolean
    createdAt: string
    updatedAt: string
}

/**
 * Tenant entity
 */
export class Tenant {
    constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly slug: string,
        public readonly description: string,
        public readonly contactEmail: string,
        public readonly contactPhone: string,
        public readonly status: TenantStatus,
        public readonly maxUsers: number,
        public readonly currentUsers: number,
        public readonly biometricEnabled: boolean,
        public readonly sessionTimeoutMinutes: number,
        public readonly refreshTokenValidityDays: number,
        public readonly mfaRequired: boolean,
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
            slug: this.slug,
            description: this.description,
            contactEmail: this.contactEmail,
            contactPhone: this.contactPhone,
            status: this.status,
            maxUsers: this.maxUsers,
            currentUsers: this.currentUsers,
            biometricEnabled: this.biometricEnabled,
            sessionTimeoutMinutes: this.sessionTimeoutMinutes,
            refreshTokenValidityDays: this.refreshTokenValidityDays,
            mfaRequired: this.mfaRequired,
            createdAt: this.createdAt.toISOString(),
            updatedAt: this.updatedAt.toISOString(),
        }
    }

    /**
     * Create Tenant from plain object (deserialization)
     */
    static fromJSON(data: TenantJSON): Tenant {
        return new Tenant(
            data.id,
            data.name,
            data.slug ?? data.domain ?? '',
            data.description ?? '',
            data.contactEmail ?? '',
            data.contactPhone ?? '',
            data.status ?? TenantStatus.ACTIVE,
            data.maxUsers ?? 0,
            data.currentUsers ?? 0,
            data.biometricEnabled ?? true,
            data.sessionTimeoutMinutes ?? 30,
            data.refreshTokenValidityDays ?? 7,
            data.mfaRequired ?? false,
            new Date(data.createdAt),
            new Date(data.updatedAt)
        )
    }
}
