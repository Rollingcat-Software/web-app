import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ILogger } from '@domain/interfaces/ILogger'
import type {
    IUserRepository,
    CreateUserData,
    UpdateUserData,
} from '@domain/interfaces/IUserRepository'
import type { PaginatedResult, QueryParams } from '@domain/interfaces/IRepository'
import { User, UserJSON } from '@domain/models/User'

/**
 * User Repository
 * Handles user API calls
 */
@injectable()
export class UserRepository implements IUserRepository {
    constructor(
        @inject(TYPES.HttpClient) private readonly httpClient: IHttpClient,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    /**
     * Find all users
     */
    async findAll(params?: QueryParams): Promise<PaginatedResult<User>> {
        try {
            this.logger.debug('Fetching all users', { params })

            // Build flat params: backend expects 'size' not 'pageSize'
            const flatParams: Record<string, unknown> = {}
            if (params?.page !== undefined) flatParams.page = params.page
            if (params?.pageSize !== undefined) flatParams.size = params.pageSize
            if (params?.sort) flatParams.sort = params.sort
            if (params?.order) flatParams.order = params.order
            if (params?.filters) {
                Object.entries(params.filters).forEach(([key, value]) => {
                    if (value !== undefined && value !== null) {
                        flatParams[key] = value
                    }
                })
            }

            type UserListResponse =
                | UserJSON[]
                | { content: UserJSON[]; totalElements?: number; totalPages?: number }

            const response = await this.httpClient.get<UserListResponse>('/users', {
                params: flatParams,
            })

            let users: User[]
            let total: number

            if (Array.isArray(response.data)) {
                users = response.data.map((data: UserJSON) => User.fromJSON(data))
                total = users.length
            } else if ('content' in response.data && response.data.content) {
                users = response.data.content.map((data: UserJSON) => User.fromJSON(data))
                total = response.data.totalElements ?? users.length
            } else {
                users = []
                total = 0
            }

            const pageSize = params?.pageSize || 20
            const page = params?.page || 0

            return {
                items: users,
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
            }
        } catch (error) {
            this.logger.error('Failed to fetch users', error)
            throw error
        }
    }

    /**
     * Find user by ID
     */
    async findById(id: string): Promise<User | null> {
        try {
            this.logger.debug(`Fetching user ${id}`)

            const response = await this.httpClient.get<UserJSON>(`/users/${id}`)

            return User.fromJSON(response.data)
        } catch (error: unknown) {
            const axiosError = error as { response?: { status?: number } }
            if (axiosError.response?.status === 404) {
                return null
            }
            this.logger.error(`Failed to fetch user ${id}`, error)
            throw error
        }
    }

    /**
     * Find user by email
     */
    async findByEmail(email: string): Promise<User | null> {
        try {
            this.logger.debug(`Fetching user by email: ${email}`)

            const response = await this.httpClient.get<UserJSON[]>('/users', {
                params: { email },
            })

            if (response.data.length === 0) {
                return null
            }

            return User.fromJSON(response.data[0])
        } catch (error) {
            this.logger.error('Failed to fetch user by email', error)
            throw error
        }
    }

    /**
     * Create new user
     */
    async create(data: CreateUserData): Promise<User> {
        try {
            this.logger.info('Creating new user', { email: data.email })

            const response = await this.httpClient.post<UserJSON>('/users', data)

            const user = User.fromJSON(response.data)

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
    async update(id: string, data: UpdateUserData): Promise<User> {
        try {
            this.logger.info(`Updating user ${id}`)

            const response = await this.httpClient.put<UserJSON>(`/users/${id}`, data)

            const user = User.fromJSON(response.data)

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
    async delete(id: string): Promise<void> {
        try {
            this.logger.info(`Deleting user ${id}`)

            await this.httpClient.delete(`/users/${id}`)

            this.logger.info('User deleted successfully', { userId: id })
        } catch (error) {
            this.logger.error(`Failed to delete user ${id}`, error)
            throw error
        }
    }
}
