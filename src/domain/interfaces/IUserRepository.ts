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
}
