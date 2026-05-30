/**
 * User domain model
 * Represents a user entity in the system
 */

export enum UserRole {
    USER = 'USER',
    ADMIN = 'ADMIN',
    TENANT_ADMIN = 'TENANT_ADMIN',
    ROOT = 'ROOT',
}

/**
 * Platform-level (FIVUCSAS) tier — the SINGLE authority for cross-tenant /
 * can-manage-tenant capability. Comes from the backend `userType` field on
 * `/auth/me`; it is independent of the within-tenant RBAC `role`.
 * See docs/IDENTITY_ROLE_UNIFICATION.md.
 */
export type UserType = 'ROOT' | 'TENANT_ADMIN' | 'TENANT_MEMBER' | 'GUEST'

export enum UserStatus {
    PENDING_ENROLLMENT = 'PENDING_ENROLLMENT',
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    SUSPENDED = 'SUSPENDED',
    DELETED = 'DELETED',
    LOCKED = 'LOCKED',
}

/**
 * User entity
 */
export class User {
    constructor(
        public readonly id: string,
        public readonly email: string,
        public readonly firstName: string,
        public readonly lastName: string,
        public readonly role: UserRole,
        public readonly status: UserStatus,
        public readonly tenantId: string,
        public readonly createdAt: Date,
        public readonly updatedAt: Date,
        public readonly lastLoginAt?: Date,
        public readonly lastLoginIp?: string,
        public readonly phoneNumber?: string,
        public readonly address?: string,
        public readonly idNumber?: string,
        public readonly roles?: string[],
        public readonly isBiometricEnrolled?: boolean,
        public readonly enrolledAt?: Date,
        public readonly lastVerifiedAt?: Date,
        public readonly verificationCount?: number,
        public readonly emailVerified: boolean = false,
        public readonly phoneVerified: boolean = false,
        public readonly tenantName?: string,
        /**
         * Platform-level tier from the backend `/auth/me` `userType` field.
         * Authoritative source for {@link isRoot}. May be undefined for older
         * tokens issued before the backend exposed it — callers fall back to
         * the RBAC `role`.
         */
        public readonly userType?: UserType
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
     * Check if user is admin (ADMIN, TENANT_ADMIN, or ROOT)
     */
    isAdmin(): boolean {
        return this.role === UserRole.ADMIN || this.role === UserRole.TENANT_ADMIN || this.role === UserRole.ROOT
    }

    /**
     * Check if user is the platform-level Root tier.
     *
     * Authoritative: the backend `userType` (matches the backend `isRoot`
     * gate). Falls back to the RBAC `role` ONLY when `userType` is absent
     * (older tokens issued before `/auth/me` exposed `userType`).
     */
    isRoot(): boolean {
        if (this.userType !== undefined) {
            return this.userType === 'ROOT'
        }
        return this.role === UserRole.ROOT
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
            phoneNumber: this.phoneNumber,
            address: this.address,
            idNumber: this.idNumber,
            roles: this.roles,
            isBiometricEnrolled: this.isBiometricEnrolled,
            enrolledAt: this.enrolledAt?.toISOString(),
            lastVerifiedAt: this.lastVerifiedAt?.toISOString(),
            verificationCount: this.verificationCount,
            emailVerified: this.emailVerified,
            phoneVerified: this.phoneVerified,
            tenantName: this.tenantName,
            userType: this.userType,
        }
    }

    /**
     * Create User from plain object (deserialization)
     * SECURITY: Properly typed to prevent type confusion attacks
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static fromJSON(data: Record<string, any>): User {
        // Backend sends role as string, map to enum
        const roleStr = (data.role ?? 'USER').toUpperCase()
        const roleMap: Record<string, UserRole> = {
            'ROOT': UserRole.ROOT,
            // Back-compat: tokens minted before the V69 role rename still send
            // SUPER_ADMIN — it maps to the same top tier (ROOT).
            'SUPER_ADMIN': UserRole.ROOT,
            'TENANT_ADMIN': UserRole.TENANT_ADMIN,
            'ADMIN': UserRole.ADMIN,
            'USER': UserRole.USER,
        }
        const role = roleMap[roleStr] ?? UserRole.USER

        // Platform tier from the backend `userType` (authoritative for isRoot).
        // Tolerate absence (older tokens) — undefined makes isRoot() fall back
        // to the role. Also tolerate the legacy SUPER_ADMIN spelling.
        const userTypeRaw = data.userType
            ? String(data.userType).toUpperCase()
            : undefined
        const userType: UserType | undefined =
            userTypeRaw === 'SUPER_ADMIN'
                ? 'ROOT'
                : (userTypeRaw === 'ROOT' ||
                   userTypeRaw === 'TENANT_ADMIN' ||
                   userTypeRaw === 'TENANT_MEMBER' ||
                   userTypeRaw === 'GUEST')
                    ? (userTypeRaw as UserType)
                    : undefined

        // Map status, with fallback
        const statusStr = (data.status ?? 'ACTIVE').toUpperCase()
        const status = Object.values(UserStatus).includes(statusStr as UserStatus)
            ? (statusStr as UserStatus)
            : UserStatus.ACTIVE

        return new User(
            data.id,
            data.email,
            data.firstName,
            data.lastName,
            role,
            status,
            data.tenantId,
            new Date(data.createdAt),
            new Date(data.updatedAt),
            data.lastLoginAt ? new Date(data.lastLoginAt) : undefined,
            data.lastLoginIp,
            data.phoneNumber,
            data.address,
            data.idNumber,
            data.roles,
            data.isBiometricEnrolled ?? false,
            data.enrolledAt ? new Date(data.enrolledAt) : undefined,
            data.lastVerifiedAt ? new Date(data.lastVerifiedAt) : undefined,
            data.verificationCount ?? 0,
            data.emailVerified ?? false,
            data.phoneVerified ?? false,
            data.tenantName,
            userType
        )
    }
}

/**
 * User JSON representation (for API responses)
 * SECURITY: Explicit typing prevents type confusion vulnerabilities
 */
export interface UserJSON {
    id: string
    email: string
    firstName: string
    lastName: string
    role: UserRole
    status: UserStatus
    tenantId: string
    createdAt: string | Date
    updatedAt: string | Date
    lastLoginAt?: string | Date
    lastLoginIp?: string
    phoneNumber?: string
    address?: string
    idNumber?: string
    roles?: string[]
    isBiometricEnrolled?: boolean
    enrolledAt?: string | Date
    lastVerifiedAt?: string | Date
    verificationCount?: number
    emailVerified?: boolean
    phoneVerified?: boolean
    tenantName?: string
    userType?: UserType
}
