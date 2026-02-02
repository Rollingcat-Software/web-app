import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { ILogger } from '@domain/interfaces/ILogger'
import type {
    IUserRepository,
    CreateUserData,
    UpdateUserData,
} from '@domain/interfaces/IUserRepository'
import type { PaginatedResult, QueryParams } from '@domain/interfaces/IRepository'
import { User, UserRole, UserStatus } from '@domain/models/User'

/**
 * Mock User Repository
 * Provides fake user data for development/testing
 */
@injectable()
export class MockUserRepository implements IUserRepository {
    private users: User[]
    private nextId: number

    constructor(@inject(TYPES.Logger) private readonly logger: ILogger) {
        // Initialize with mock users
        this.users = [
            new User(
                '1',
                'admin@fivucsas.com',
                'Admin',
                'User',
                UserRole.ADMIN,
                UserStatus.ACTIVE,
                '1',
                new Date('2025-01-15T10:00:00Z'),
                new Date('2025-01-15T10:00:00Z'),
                new Date('2025-11-17T06:00:00Z'),
                '192.168.1.1'
            ),
            new User(
                '2',
                'john.doe@example.com',
                'John',
                'Doe',
                UserRole.USER,
                UserStatus.ACTIVE,
                '1',
                new Date('2025-02-01T10:00:00Z'),
                new Date('2025-02-01T10:00:00Z'),
                new Date('2025-11-16T14:30:00Z'),
                '192.168.1.50'
            ),
            new User(
                '3',
                'jane.smith@example.com',
                'Jane',
                'Smith',
                UserRole.USER,
                UserStatus.PENDING_ENROLLMENT,
                '1',
                new Date('2025-03-10T10:00:00Z'),
                new Date('2025-03-10T10:00:00Z')
            ),
            new User(
                '4',
                'bob.wilson@example.com',
                'Bob',
                'Wilson',
                UserRole.USER,
                UserStatus.SUSPENDED,
                '1',
                new Date('2025-01-20T10:00:00Z'),
                new Date('2025-11-15T10:00:00Z'),
                new Date('2025-11-10T10:00:00Z'),
                '192.168.1.75'
            ),
            new User(
                '5',
                'alice.johnson@example.com',
                'Alice',
                'Johnson',
                UserRole.ADMIN,
                UserStatus.ACTIVE,
                '1',
                new Date('2025-01-25T10:00:00Z'),
                new Date('2025-01-25T10:00:00Z'),
                new Date('2025-11-16T18:00:00Z'),
                '192.168.1.100'
            ),
        ]
        this.nextId = 6
    }

    async findAll(params?: QueryParams): Promise<PaginatedResult<User>> {
        this.logger.debug('Mock: Fetching all users', { params })
        await this.delay(400)

        let filteredUsers = [...this.users]

        // Apply filters if provided
        if (params?.filters) {
            const { search, status, role } = params.filters as any

            if (search) {
                const searchLower = search.toLowerCase()
                filteredUsers = filteredUsers.filter(
                    (u) =>
                        u.email.toLowerCase().includes(searchLower) ||
                        u.firstName.toLowerCase().includes(searchLower) ||
                        u.lastName.toLowerCase().includes(searchLower)
                )
            }

            if (status) {
                filteredUsers = filteredUsers.filter((u) => u.status === status)
            }

            if (role) {
                filteredUsers = filteredUsers.filter((u) => u.role === role)
            }
        }

        const pageSize = params?.pageSize || 20
        const page = params?.page || 0
        const startIndex = page * pageSize
        const endIndex = startIndex + pageSize

        return {
            items: filteredUsers.slice(startIndex, endIndex),
            total: filteredUsers.length,
            page,
            pageSize,
            totalPages: Math.ceil(filteredUsers.length / pageSize),
        }
    }

    async findById(id: string): Promise<User | null> {
        this.logger.debug(`Mock: Fetching user ${id}`)
        await this.delay(300)

        const user = this.users.find((u) => u.id === id)
        return user || null
    }

    async findByEmail(email: string): Promise<User | null> {
        this.logger.debug(`Mock: Fetching user by email: ${email}`)
        await this.delay(300)

        const user = this.users.find((u) => u.email === email)
        return user || null
    }

    async create(data: CreateUserData): Promise<User> {
        this.logger.info('Mock: Creating new user', { email: data.email })
        await this.delay(500)

        const user = new User(
            String(this.nextId++),
            data.email,
            data.firstName,
            data.lastName,
            data.role as UserRole,
            UserStatus.PENDING_ENROLLMENT,
            data.tenantId,
            new Date(),
            new Date()
        )

        this.users.push(user)

        return user
    }

    async update(id: string, data: UpdateUserData): Promise<User> {
        this.logger.info(`Mock: Updating user ${id}`)
        await this.delay(400)

        const index = this.users.findIndex((u) => u.id === id)
        if (index === -1) {
            throw new Error('User not found')
        }

        const existingUser = this.users[index]

        // Create updated user (immutable)
        const updatedUser = new User(
            existingUser.id,
            data.email || existingUser.email,
            data.firstName || existingUser.firstName,
            data.lastName || existingUser.lastName,
            (data.role as UserRole) || existingUser.role,
            (data.status as UserStatus) || existingUser.status,
            existingUser.tenantId,
            existingUser.createdAt,
            new Date(), // Update timestamp
            existingUser.lastLoginAt,
            existingUser.lastLoginIp
        )

        this.users[index] = updatedUser

        return updatedUser
    }

    async delete(id: string): Promise<void> {
        this.logger.info(`Mock: Deleting user ${id}`)
        await this.delay(300)

        const index = this.users.findIndex((u) => u.id === id)
        if (index !== -1) {
            this.users.splice(index, 1)
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }
}
