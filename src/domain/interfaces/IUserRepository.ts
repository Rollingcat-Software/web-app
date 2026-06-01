import type { User, UserType } from '@domain/models/User'
import type { PaginatedResult, QueryParams } from './IRepository'

/**
 * Create user data (without generated fields)
 */
export interface CreateUserData {
    email: string
    firstName: string
    lastName: string
    password: string
    /**
     * Legacy single-role name kept for back-compat with the create payload
     * (`CreateUserRequest.role`). The dashboard form no longer sets this —
     * within-tenant roles travel in {@link roleIds} — but the field remains so
     * older callers/tests keep working.
     */
    role?: string
    tenantId: string
    /**
     * Platform-level tier ({@link UserType}). Independent of the within-tenant
     * RBAC {@link roleIds}. Setting ROOT / TENANT_ADMIN is rejected by the
     * backend (403) unless the caller is ROOT.
     */
    userType?: UserType
    /** Within-tenant RBAC role ids to assign to the new user. */
    roleIds?: string[]
}

/**
 * Update user data (all fields optional)
 */
export interface UpdateUserData {
    email?: string
    firstName?: string
    lastName?: string
    role?: string
    status?: string
    /**
     * Platform-level tier. Only a ROOT caller may change it (backend
     * fail-closed → 403 otherwise). Omit to leave unchanged.
     */
    userType?: UserType
    /**
     * Complete desired set of within-tenant RBAC role ids (replace semantics:
     * the backend revokes ids not in the list and assigns new ones). Omit to
     * leave assignments untouched; an empty array revokes all.
     */
    roleIds?: string[]
}

/**
 * User Repository interface
 * Handles user data access operations
 */
export interface IUserRepository {
    /**
     * Find all users with optional filters and pagination
     */
    findAll(params?: QueryParams): Promise<PaginatedResult<User>>

    /**
     * Find user by ID
     * @returns User if found, null otherwise
     */
    findById(id: string): Promise<User | null>

    /**
     * Find user by email
     * @returns User if found, null otherwise
     */
    findByEmail(email: string): Promise<User | null>

    /**
     * Create new user
     */
    create(data: CreateUserData): Promise<User>

    /**
     * Update existing user
     */
    update(id: string, data: UpdateUserData): Promise<User>

    /**
     * Delete user
     */
    delete(id: string): Promise<void>

    /**
     * Search users by query string (name, email, etc.)
     */
    search(query: string): Promise<PaginatedResult<User>>

    /**
     * Export a user's personal data (GDPR Art. 20 / KVKK data portability).
     * Returns the blob plus the filename the server suggested via
     * Content-Disposition (or null if the header was unavailable).
     *
     * Backend enforces self/tenant-admin/ROOT authorization and a
     * 1-per-hour rate limit; callers should handle HTTP 429 (Retry-After)
     * for a user-friendly message.
     */
    exportData(id: string): Promise<UserDataExport>
}

/**
 * Result of a GDPR data-export call.
 */
export interface UserDataExport {
    blob: Blob
    filename: string | null
}
