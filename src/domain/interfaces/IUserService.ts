import type { User } from '@domain/models/User'
import type { PaginatedResult } from './IRepository'
import type { CreateUserData, UpdateUserData } from './IUserRepository'

/**
 * User filters for querying
 */
export interface UserFilters {
    search?: string
    status?: string
    role?: string
    tenantId?: number
}

/**
 * User Service interface
 * Handles user business logic
 */
export interface IUserService {
    /**
     * Get all users with optional filters
     */
    getUsers(filters?: UserFilters, page?: number, pageSize?: number): Promise<PaginatedResult<User>>

    /**
     * Get user by ID
     * @throws NotFoundError if user doesn't exist
     */
    getUserById(id: number): Promise<User>

    /**
     * Create new user
     * @throws ValidationError if data is invalid
     * @throws ConflictError if email already exists
     */
    createUser(data: CreateUserData): Promise<User>

    /**
     * Update user
     * @throws NotFoundError if user doesn't exist
     * @throws ValidationError if data is invalid
     */
    updateUser(id: number, data: UpdateUserData): Promise<User>

    /**
     * Delete user
     * @throws NotFoundError if user doesn't exist
     */
    deleteUser(id: number): Promise<void>

    /**
     * Activate user (change status to ACTIVE)
     */
    activateUser(id: number): Promise<User>

    /**
     * Suspend user (change status to SUSPENDED)
     */
    suspendUser(id: number, reason?: string): Promise<User>
}
