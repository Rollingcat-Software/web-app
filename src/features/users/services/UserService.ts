import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { IUserService, UserFilters } from '@domain/interfaces/IUserService'
import type { IUserRepository, CreateUserData, UpdateUserData } from '@domain/interfaces/IUserRepository'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { PaginatedResult } from '@domain/interfaces/IRepository'
import { User, UserStatus } from '@domain/models/User'
import { ValidationError, NotFoundError, ConflictError, BusinessError } from '@core/errors'
import { validateCreateUser, validateUpdateUser } from '@domain/validators/userValidator'

/**
 * User Service
 * Handles user business logic
 */
@injectable()
export class UserService implements IUserService {
    constructor(
        @inject(TYPES.UserRepository) private readonly userRepository: IUserRepository,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    /**
     * Get all users with optional filters
     */
    async getUsers(
        filters?: UserFilters,
        page: number = 0,
        pageSize: number = 20
    ): Promise<PaginatedResult<User>> {
        try {
            this.logger.debug('Getting users', { filters, page, pageSize })

            // Use dedicated search endpoint when search query is provided
            if (filters?.search) {
                return await this.userRepository.search(filters.search)
            }

            const result = await this.userRepository.findAll({
                page,
                pageSize,
                filters: filters as Record<string, unknown>,
            })

            return result
        } catch (error) {
            this.logger.error('Failed to get users', error)
            throw error
        }
    }

    /**
     * Get user by ID
     */
    async getUserById(id: string): Promise<User> {
        this.logger.debug(`Getting user ${id}`)

        const user = await this.userRepository.findById(id)

        if (!user) {
            throw new NotFoundError(`User with ID ${id} not found`)
        }

        return user
    }

    /**
     * Create new user
     */
    async createUser(data: CreateUserData): Promise<User> {
        // Validate input
        const validation = validateCreateUser(data)
        if (!validation.success) {
            const validationErrors = validation.error.errors.map((err) => ({
                field: err.path.join('.'),
                message: err.message,
            }))
            throw new ValidationError('Invalid user data', validationErrors)
        }

        // Check if email already exists
        const existingUser = await this.userRepository.findByEmail(data.email)
        if (existingUser) {
            throw new ConflictError(`User with email ${data.email} already exists`)
        }

        // Create user
        try {
            this.logger.info('Creating new user', { email: data.email })

            const user = await this.userRepository.create(data)

            this.logger.info('User created successfully', { userId: user.id })

            return user
        } catch (error) {
            this.logger.error('Failed to create user', error)
            throw error
        }
    }

    /**
     * Update user
     */
    async updateUser(id: string, data: UpdateUserData): Promise<User> {
        // Validate input
        const validation = validateUpdateUser(data)
        if (!validation.success) {
            const validationErrors = validation.error.errors.map((err) => ({
                field: err.path.join('.'),
                message: err.message,
            }))
            throw new ValidationError('Invalid user data', validationErrors)
        }

        // Check if user exists
        const existingUser = await this.userRepository.findById(id)
        if (!existingUser) {
            throw new NotFoundError(`User with ID ${id} not found`)
        }

        // If email is being changed, check for conflicts
        if (data.email && data.email !== existingUser.email) {
            const emailConflict = await this.userRepository.findByEmail(data.email)
            if (emailConflict) {
                throw new ConflictError(`User with email ${data.email} already exists`)
            }
        }

        try {
            this.logger.info(`Updating user ${id}`)

            const user = await this.userRepository.update(id, data)

            this.logger.info('User updated successfully', { userId: user.id })

            return user
        } catch (error) {
            this.logger.error(`Failed to update user ${id}`, error)
            throw error
        }
    }

    /**
     * Delete user
     */
    async deleteUser(id: string): Promise<void> {
        // Check if user exists
        const existingUser = await this.userRepository.findById(id)
        if (!existingUser) {
            throw new NotFoundError(`User with ID ${id} not found`)
        }

        // Business rule: Cannot delete super admin users
        if (existingUser.isSuperAdmin()) {
            throw new BusinessError('Cannot delete super admin users')
        }

        try {
            this.logger.info(`Deleting user ${id}`)

            await this.userRepository.delete(id)

            this.logger.info('User deleted successfully', { userId: id })
        } catch (error) {
            this.logger.error(`Failed to delete user ${id}`, error)
            throw error
        }
    }

    /**
     * Activate user
     */
    async activateUser(id: string): Promise<User> {
        const user = await this.getUserById(id)

        if (user.status === UserStatus.ACTIVE) {
            throw new BusinessError('User is already active')
        }

        this.logger.info(`Activating user ${id}`)

        return this.userRepository.update(id, {
            status: UserStatus.ACTIVE,
        })
    }

    /**
     * Suspend user
     */
    async suspendUser(id: string, reason?: string): Promise<User> {
        const user = await this.getUserById(id)

        if (user.status === UserStatus.SUSPENDED) {
            throw new BusinessError('User is already suspended')
        }

        // Business rule: Cannot suspend super admin
        if (user.isSuperAdmin()) {
            throw new BusinessError('Cannot suspend super admin users')
        }

        this.logger.info(`Suspending user ${id}`, { reason })

        return this.userRepository.update(id, {
            status: UserStatus.SUSPENDED,
        })
    }
}
