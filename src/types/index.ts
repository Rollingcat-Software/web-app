// ============================================================================
// Type Definitions for FIVUCSAS Admin Dashboard
// ============================================================================

export interface User {
    id: string
    email: string
    firstName: string
    lastName: string
    role: UserRole
    status: UserStatus
    tenantId: string
    createdAt: string
    updatedAt: string
    lastLoginAt?: string
    lastLoginIp?: string
}

export enum UserRole {
    USER = 'USER',
    ADMIN = 'ADMIN',
    TENANT_ADMIN = 'TENANT_ADMIN',
    SUPER_ADMIN = 'SUPER_ADMIN',
}

export enum UserStatus {
    PENDING_ENROLLMENT = 'PENDING_ENROLLMENT',
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    SUSPENDED = 'SUSPENDED',
    DELETED = 'DELETED',
    LOCKED = 'LOCKED',
}

export interface Tenant {
    id: string
    name: string
    domain: string
    status: TenantStatus
    maxUsers: number
    currentUsers: number
    createdAt: string
    updatedAt: string
}

export enum TenantStatus {
    ACTIVE = 'ACTIVE',
    SUSPENDED = 'SUSPENDED',
    TRIAL = 'TRIAL',
    INACTIVE = 'INACTIVE',
    PENDING = 'PENDING',
}

export interface EnrollmentJob {
    id: string
    userId: string
    tenantId: string
    status: EnrollmentStatus
    faceImageUrl: string
    qualityScore?: number
    livenessScore?: number
    errorCode?: string
    errorMessage?: string
    createdAt: string
    updatedAt: string
    completedAt?: string
}

export enum EnrollmentStatus {
    NOT_ENROLLED = 'NOT_ENROLLED',
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    ENROLLED = 'ENROLLED',
    SUCCESS = 'SUCCESS',
    FAILED = 'FAILED',
    REVOKED = 'REVOKED',
    EXPIRED = 'EXPIRED',
}

export interface AuditLog {
    id: string
    userId: string
    tenantId: string
    action: string
    entityType: string
    entityId?: string
    ipAddress: string
    userAgent: string
    details?: Record<string, unknown>
    createdAt: string
}

export interface LoginRequest {
    email: string
    password: string
    mfaCode?: string
}

export interface LoginResponse {
    accessToken: string
    refreshToken: string
    user: User
}

export interface AuthState {
    isAuthenticated: boolean
    user: User | null
    accessToken: string | null
    refreshToken: string | null
    loading: boolean
    error: string | null
}

export interface DashboardStats {
    totalUsers: number
    activeUsers: number
    pendingEnrollments: number
    successfulEnrollments: number
    failedEnrollments: number
    authSuccessRate: number
    verificationSuccessRate: number
}

export interface PaginatedResponse<T> {
    content: T[]
    totalElements: number
    totalPages: number
    page: number
    size: number
}

export interface ApiError {
    message: string
    code?: string
    details?: Record<string, unknown>
}
