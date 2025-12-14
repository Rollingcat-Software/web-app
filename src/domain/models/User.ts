/**
 * User domain model
 * Represents a user entity in the system
 */

export enum UserRole {
    USER = 'USER',
    ADMIN = 'ADMIN',
    SUPER_ADMIN = 'SUPER_ADMIN',
}

export enum UserStatus {
    PENDING_ENROLLMENT = 'PENDING_ENROLLMENT',
    ACTIVE = 'ACTIVE',
    SUSPENDED = 'SUSPENDED',
    DELETED = 'DELETED',
    LOCKED = 'LOCKED',
}

/**
 * User entity
 */
export class User {
    constructor(
        public readonly id: number,
        public readonly email: string,
        public readonly firstName: string,
        public readonly lastName: string,
        public readonly role: UserRole,
        public readonly status: UserStatus,
        public readonly tenantId: number,
        public readonly createdAt: Date,
        public readonly updatedAt: Date,
        public readonly lastLoginAt?: Date,
        public readonly lastLoginIp?: string
    ) {}

    /**
     * Get user's full name
     */
    get fullName(): string {
        return `${this.firstName} ${this.lastName}`
    }

    /**
     * Check if user is active
     */
    isActive(): boolean {
        return this.status === UserStatus.ACTIVE
    }

    /**
     * Check if user is admin (ADMIN or SUPER_ADMIN)
     */
    isAdmin(): boolean {
        return this.role === UserRole.ADMIN || this.role === UserRole.SUPER_ADMIN
    }

    /**
     * Check if user is super admin
     */
    isSuperAdmin(): boolean {
        return this.role === UserRole.SUPER_ADMIN
    }

    /**
     * Check if user is suspended or locked
     */
    isRestricted(): boolean {
        return this.status === UserStatus.SUSPENDED || this.status === UserStatus.LOCKED
    }

    /**
     * Check if user needs enrollment
     */
    needsEnrollment(): boolean {
        return this.status === UserStatus.PENDING_ENROLLMENT
    }

    /**
     * Convert to plain object (for serialization)
     */
    toJSON() {
        return {
            id: this.id,
            email: this.email,
            firstName: this.firstName,
            lastName: this.lastName,
            role: this.role,
            status: this.status,
            tenantId: this.tenantId,
            createdAt: this.createdAt.toISOString(),
            updatedAt: this.updatedAt.toISOString(),
            lastLoginAt: this.lastLoginAt?.toISOString(),
            lastLoginIp: this.lastLoginIp,
        }
    }

    /**
     * Create User from plain object (deserialization)
     * SECURITY: Properly typed to prevent type confusion attacks
     */
    static fromJSON(data: UserJSON): User {
        return new User(
            data.id,
            data.email,
            data.firstName,
            data.lastName,
            data.role,
            data.status,
            data.tenantId,
            new Date(data.createdAt),
            new Date(data.updatedAt),
            data.lastLoginAt ? new Date(data.lastLoginAt) : undefined,
            data.lastLoginIp
        )
    }
}

/**
 * User JSON representation (for API responses)
 * SECURITY: Explicit typing prevents type confusion vulnerabilities
 */
export interface UserJSON {
    id: number
    email: string
    firstName: string
    lastName: string
    role: UserRole
    status: UserStatus
    tenantId: number
    createdAt: string | Date
    updatedAt: string | Date
    lastLoginAt?: string | Date
    lastLoginIp?: string
}
