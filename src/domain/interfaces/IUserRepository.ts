import type { User } from '@domain/models/User'
import type { PaginatedResult, QueryParams } from './IRepository'

/**
 * Create user data (without generated fields)
 */
export interface CreateUserData {
    email: string
    firstName: string
    lastName: string
    password: string
    role: string
    tenantId: string
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
