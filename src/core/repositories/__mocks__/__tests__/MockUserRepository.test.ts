import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Container } from 'inversify'
import 'reflect-metadata'
import { TYPES } from '@core/di/types'
import { MockUserRepository } from '../MockUserRepository'
import { LoggerService } from '@core/services/LoggerService'
import type { IUserRepository, CreateUserData, UpdateUserData } from '@domain/interfaces/IUserRepository'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { IConfig } from '@domain/interfaces/IConfig'
import { UserRole, UserStatus } from '@domain/models/User'

describe('MockUserRepository Integration Tests', () => {
    let container: Container
    let userRepository: IUserRepository
    let logger: ILogger

    beforeEach(() => {
        // Create a new container for each test
        container = new Container()

        // Mock config for logger
        const mockConfig: IConfig = {
            apiBaseUrl: 'http://localhost:8080/api/v1',
            apiTimeout: 30000,
            useMockAPI: true,
            environment: 'test',
            logLevel: 'error',
            features: {
                enableAnalytics: false,
                enableNotifications: false,
                enableWebSocket: false,
            },
        }

        // Bind config
        container.bind<IConfig>(TYPES.Config).toConstantValue(mockConfig)

        // Bind logger
        container.bind<ILogger>(TYPES.Logger).to(LoggerService).inSingletonScope()

        // Bind user repository
        container.bind<IUserRepository>(TYPES.UserRepository).to(MockUserRepository).inSingletonScope()

        // Get instances
        logger = container.get<ILogger>(TYPES.Logger)
        userRepository = container.get<IUserRepository>(TYPES.UserRepository)

        // Spy on logger methods to reduce noise in tests
        vi.spyOn(logger, 'debug').mockImplementation(() => {})
        vi.spyOn(logger, 'info').mockImplementation(() => {})
        vi.spyOn(logger, 'warn').mockImplementation(() => {})
        vi.spyOn(logger, 'error').mockImplementation(() => {})
    })

    describe('Initial Mock Data', () => {
        it('should have 5 mock users pre-loaded', async () => {
            // Act
            const result = await userRepository.findAll()

            // Assert
            expect(result.items).toHaveLength(5)
            expect(result.total).toBe(5)
        })

        it('should include admin user', async () => {
            // Act
            const admin = await userRepository.findByEmail('admin@fivucsas.com')

            // Assert
            expect(admin).not.toBeNull()
            expect(admin?.firstName).toBe('Admin')
            expect(admin?.role).toBe(UserRole.ADMIN)
            expect(admin?.status).toBe(UserStatus.ACTIVE)
        })

        it('should include john.doe user', async () => {
            // Act
            const user = await userRepository.findByEmail('john.doe@example.com')

            // Assert
            expect(user).not.toBeNull()
            expect(user?.firstName).toBe('John')
            expect(user?.lastName).toBe('Doe')
            expect(user?.role).toBe(UserRole.USER)
            expect(user?.status).toBe(UserStatus.ACTIVE)
        })

        it('should include jane.smith with pending enrollment status', async () => {
            // Act
            const user = await userRepository.findByEmail('jane.smith@example.com')

            // Assert
            expect(user).not.toBeNull()
            expect(user?.firstName).toBe('Jane')
            expect(user?.status).toBe(UserStatus.PENDING_ENROLLMENT)
        })

        it('should include bob.wilson with suspended status', async () => {
            // Act
            const user = await userRepository.findByEmail('bob.wilson@example.com')

            // Assert
            expect(user).not.toBeNull()
            expect(user?.firstName).toBe('Bob')
            expect(user?.status).toBe(UserStatus.SUSPENDED)
        })

        it('should include alice.johnson admin user', async () => {
            // Act
            const user = await userRepository.findByEmail('alice.johnson@example.com')

            // Assert
            expect(user).not.toBeNull()
            expect(user?.firstName).toBe('Alice')
            expect(user?.role).toBe(UserRole.ADMIN)
            expect(user?.status).toBe(UserStatus.ACTIVE)
        })
    })

    describe('findAll - Pagination', () => {
        it('should return all users with default pagination', async () => {
            // Act
            const result = await userRepository.findAll()

            // Assert
            expect(result.items).toHaveLength(5)
            expect(result.total).toBe(5)
            expect(result.page).toBe(0)
            expect(result.pageSize).toBe(20)
            expect(result.totalPages).toBe(1)
        })

        it('should paginate users correctly - page 0, size 2', async () => {
            // Act
            const result = await userRepository.findAll({ page: 0, pageSize: 2 })

            // Assert
            expect(result.items).toHaveLength(2)
            expect(result.total).toBe(5)
            expect(result.page).toBe(0)
            expect(result.pageSize).toBe(2)
            expect(result.totalPages).toBe(3)
            expect(result.items[0].email).toBe('admin@fivucsas.com')
            expect(result.items[1].email).toBe('john.doe@example.com')
        })

        it('should paginate users correctly - page 1, size 2', async () => {
            // Act
            const result = await userRepository.findAll({ page: 1, pageSize: 2 })

            // Assert
            expect(result.items).toHaveLength(2)
            expect(result.total).toBe(5)
            expect(result.page).toBe(1)
            expect(result.pageSize).toBe(2)
            expect(result.totalPages).toBe(3)
            expect(result.items[0].email).toBe('jane.smith@example.com')
            expect(result.items[1].email).toBe('bob.wilson@example.com')
        })

        it('should paginate users correctly - page 2, size 2', async () => {
            // Act
            const result = await userRepository.findAll({ page: 2, pageSize: 2 })

            // Assert
            expect(result.items).toHaveLength(1)
            expect(result.total).toBe(5)
            expect(result.page).toBe(2)
            expect(result.pageSize).toBe(2)
            expect(result.totalPages).toBe(3)
            expect(result.items[0].email).toBe('alice.johnson@example.com')
        })

        it('should return empty array for page beyond total pages', async () => {
            // Act
            const result = await userRepository.findAll({ page: 10, pageSize: 2 })

            // Assert
            expect(result.items).toHaveLength(0)
            expect(result.total).toBe(5)
            expect(result.page).toBe(10)
        })

        it('should simulate delay', async () => {
            // Arrange
            const startTime = Date.now()

            // Act
            await userRepository.findAll()

            // Assert - should take at least 400ms (with some margin for test execution)
            const elapsed = Date.now() - startTime
            expect(elapsed).toBeGreaterThanOrEqual(380)
        })
    })

    describe('findAll - Filters', () => {
        it('should filter users by search term (email)', async () => {
            // Act
            const result = await userRepository.findAll({
                filters: { search: 'john.doe' },
            })

            // Assert
            expect(result.items).toHaveLength(1)
            expect(result.items[0].email).toBe('john.doe@example.com')
            expect(result.total).toBe(1)
        })

        it('should filter users by search term (first name)', async () => {
            // Act
            const result = await userRepository.findAll({
                filters: { search: 'Jane' },
            })

            // Assert
            expect(result.items).toHaveLength(1)
            expect(result.items[0].firstName).toBe('Jane')
            expect(result.total).toBe(1)
        })

        it('should filter users by search term (last name)', async () => {
            // Act
            const result = await userRepository.findAll({
                filters: { search: 'wilson' },
            })

            // Assert
            expect(result.items).toHaveLength(1)
            expect(result.items[0].lastName).toBe('Wilson')
            expect(result.total).toBe(1)
        })

        it('should filter users by search term (case insensitive)', async () => {
            // Act
            const result = await userRepository.findAll({
                filters: { search: 'ADMIN' },
            })

            // Assert
            expect(result.total).toBeGreaterThanOrEqual(1)
            expect(result.items.some((u) => u.email.includes('admin'))).toBe(true)
        })

        it('should filter users by status ACTIVE', async () => {
            // Act
            const result = await userRepository.findAll({
                filters: { status: UserStatus.ACTIVE },
            })

            // Assert
            expect(result.items).toHaveLength(3)
            expect(result.total).toBe(3)
            expect(result.items.every((u) => u.status === UserStatus.ACTIVE)).toBe(true)
        })

        it('should filter users by status PENDING_ENROLLMENT', async () => {
            // Act
            const result = await userRepository.findAll({
                filters: { status: UserStatus.PENDING_ENROLLMENT },
            })

            // Assert
            expect(result.items).toHaveLength(1)
            expect(result.total).toBe(1)
            expect(result.items[0].email).toBe('jane.smith@example.com')
        })

        it('should filter users by status SUSPENDED', async () => {
            // Act
            const result = await userRepository.findAll({
                filters: { status: UserStatus.SUSPENDED },
            })

            // Assert
            expect(result.items).toHaveLength(1)
            expect(result.total).toBe(1)
            expect(result.items[0].email).toBe('bob.wilson@example.com')
        })

        it('should filter users by role USER', async () => {
            // Act
            const result = await userRepository.findAll({
                filters: { role: UserRole.USER },
            })

            // Assert
            expect(result.items).toHaveLength(3)
            expect(result.total).toBe(3)
            expect(result.items.every((u) => u.role === UserRole.USER)).toBe(true)
        })

        it('should filter users by role ADMIN', async () => {
            // Act
            const result = await userRepository.findAll({
                filters: { role: UserRole.ADMIN },
            })

            // Assert
            expect(result.items).toHaveLength(2)
            expect(result.total).toBe(2)
            expect(result.items.every((u) => u.role === UserRole.ADMIN)).toBe(true)
        })

        it('should combine multiple filters (status + role)', async () => {
            // Act
            const result = await userRepository.findAll({
                filters: { status: UserStatus.ACTIVE, role: UserRole.ADMIN },
            })

            // Assert
            expect(result.items).toHaveLength(2)
            expect(result.total).toBe(2)
            expect(result.items.every((u) => u.status === UserStatus.ACTIVE && u.role === UserRole.ADMIN)).toBe(true)
        })

        it('should combine all filters (search + status + role)', async () => {
            // Act
            const result = await userRepository.findAll({
                filters: {
                    search: 'admin',
                    status: UserStatus.ACTIVE,
                    role: UserRole.ADMIN,
                },
            })

            // Assert
            expect(result.items).toHaveLength(1)
            expect(result.total).toBe(1)
            expect(result.items[0].email).toBe('admin@fivucsas.com')
        })

        it('should return empty result when filters match no users', async () => {
            // Act
            const result = await userRepository.findAll({
                filters: { search: 'nonexistent@user.com' },
            })

            // Assert
            expect(result.items).toHaveLength(0)
            expect(result.total).toBe(0)
        })

        it('should combine filters with pagination', async () => {
            // Act
            const result = await userRepository.findAll({
                page: 0,
                pageSize: 2,
                filters: { status: UserStatus.ACTIVE },
            })

            // Assert
            expect(result.items).toHaveLength(2)
            expect(result.total).toBe(3)
            expect(result.pageSize).toBe(2)
            expect(result.totalPages).toBe(2)
        })
    })

    describe('findById', () => {
        it('should find user by ID when user exists', async () => {
            // Act
            const user = await userRepository.findById(1)

            // Assert
            expect(user).not.toBeNull()
            expect(user?.id).toBe(1)
            expect(user?.email).toBe('admin@fivucsas.com')
        })

        it('should find user by ID - user 2', async () => {
            // Act
            const user = await userRepository.findById(2)

            // Assert
            expect(user).not.toBeNull()
            expect(user?.id).toBe(2)
            expect(user?.email).toBe('john.doe@example.com')
        })

        it('should return null when user does not exist', async () => {
            // Act
            const user = await userRepository.findById(999)

            // Assert
            expect(user).toBeNull()
        })

        it('should return null for negative ID', async () => {
            // Act
            const user = await userRepository.findById(-1)

            // Assert
            expect(user).toBeNull()
        })

        it('should simulate delay', async () => {
            // Arrange
            const startTime = Date.now()

            // Act
            await userRepository.findById(1)

            // Assert - should take at least 300ms
            const elapsed = Date.now() - startTime
            expect(elapsed).toBeGreaterThanOrEqual(280)
        })
    })

    describe('findByEmail', () => {
        it('should find user by email when user exists', async () => {
            // Act
            const user = await userRepository.findByEmail('admin@fivucsas.com')

            // Assert
            expect(user).not.toBeNull()
            expect(user?.email).toBe('admin@fivucsas.com')
            expect(user?.id).toBe(1)
        })

        it('should find user by email - john.doe', async () => {
            // Act
            const user = await userRepository.findByEmail('john.doe@example.com')

            // Assert
            expect(user).not.toBeNull()
            expect(user?.email).toBe('john.doe@example.com')
            expect(user?.id).toBe(2)
        })

        it('should return null when email does not exist', async () => {
            // Act
            const user = await userRepository.findByEmail('nonexistent@example.com')

            // Assert
            expect(user).toBeNull()
        })

        it('should be case sensitive for email', async () => {
            // Act
            const user = await userRepository.findByEmail('ADMIN@fivucsas.com')

            // Assert
            expect(user).toBeNull()
        })

        it('should simulate delay', async () => {
            // Arrange
            const startTime = Date.now()

            // Act
            await userRepository.findByEmail('admin@fivucsas.com')

            // Assert - should take at least 300ms
            const elapsed = Date.now() - startTime
            expect(elapsed).toBeGreaterThanOrEqual(280)
        })
    })

    describe('create', () => {
        it('should create a new user', async () => {
            // Arrange
            const createData: CreateUserData = {
                email: 'newuser@example.com',
                firstName: 'New',
                lastName: 'User',
                password: 'password123',
                role: UserRole.USER,
                tenantId: 1,
            }

            // Act
            const newUser = await userRepository.create(createData)

            // Assert
            expect(newUser).not.toBeNull()
            expect(newUser.id).toBe(6) // Next ID after initial 5
            expect(newUser.email).toBe(createData.email)
            expect(newUser.firstName).toBe(createData.firstName)
            expect(newUser.lastName).toBe(createData.lastName)
            expect(newUser.role).toBe(createData.role)
            expect(newUser.status).toBe(UserStatus.PENDING_ENROLLMENT)
            expect(newUser.tenantId).toBe(createData.tenantId)
            expect(newUser.createdAt).toBeInstanceOf(Date)
            expect(newUser.updatedAt).toBeInstanceOf(Date)
        })

        it('should increment ID for multiple created users', async () => {
            // Arrange
            const createData1: CreateUserData = {
                email: 'user1@example.com',
                firstName: 'User',
                lastName: 'One',
                password: 'password123',
                role: UserRole.USER,
                tenantId: 1,
            }
            const createData2: CreateUserData = {
                email: 'user2@example.com',
                firstName: 'User',
                lastName: 'Two',
                password: 'password123',
                role: UserRole.USER,
                tenantId: 1,
            }

            // Act
            const user1 = await userRepository.create(createData1)
            const user2 = await userRepository.create(createData2)

            // Assert
            expect(user1.id).toBe(6)
            expect(user2.id).toBe(7)
        })

        it('should add created user to the users list', async () => {
            // Arrange
            const createData: CreateUserData = {
                email: 'findme@example.com',
                firstName: 'Find',
                lastName: 'Me',
                password: 'password123',
                role: UserRole.USER,
                tenantId: 1,
            }

            // Act
            await userRepository.create(createData)
            const foundUser = await userRepository.findByEmail('findme@example.com')

            // Assert
            expect(foundUser).not.toBeNull()
            expect(foundUser?.email).toBe('findme@example.com')
        })

        it('should set status to PENDING_ENROLLMENT by default', async () => {
            // Arrange
            const createData: CreateUserData = {
                email: 'pending@example.com',
                firstName: 'Pending',
                lastName: 'User',
                password: 'password123',
                role: UserRole.USER,
                tenantId: 1,
            }

            // Act
            const newUser = await userRepository.create(createData)

            // Assert
            expect(newUser.status).toBe(UserStatus.PENDING_ENROLLMENT)
        })

        it('should simulate delay', async () => {
            // Arrange
            const createData: CreateUserData = {
                email: 'delay@example.com',
                firstName: 'Delay',
                lastName: 'Test',
                password: 'password123',
                role: UserRole.USER,
                tenantId: 1,
            }
            const startTime = Date.now()

            // Act
            await userRepository.create(createData)

            // Assert - should take at least 500ms
            const elapsed = Date.now() - startTime
            expect(elapsed).toBeGreaterThanOrEqual(480)
        })
    })

    describe('update', () => {
        it('should update user successfully', async () => {
            // Arrange
            const updateData: UpdateUserData = {
                firstName: 'Updated',
                lastName: 'Name',
            }

            // Act
            const updatedUser = await userRepository.update(1, updateData)

            // Assert
            expect(updatedUser).not.toBeNull()
            expect(updatedUser.id).toBe(1)
            expect(updatedUser.firstName).toBe('Updated')
            expect(updatedUser.lastName).toBe('Name')
            expect(updatedUser.email).toBe('admin@fivucsas.com') // Unchanged
        })

        it('should update user email', async () => {
            // Arrange
            const updateData: UpdateUserData = {
                email: 'newemail@example.com',
            }

            // Act
            const updatedUser = await userRepository.update(2, updateData)

            // Assert
            expect(updatedUser.email).toBe('newemail@example.com')
            expect(updatedUser.firstName).toBe('John') // Unchanged
        })

        it('should update user role', async () => {
            // Arrange
            const updateData: UpdateUserData = {
                role: UserRole.ADMIN,
            }

            // Act
            const updatedUser = await userRepository.update(2, updateData)

            // Assert
            expect(updatedUser.role).toBe(UserRole.ADMIN)
        })

        it('should update user status', async () => {
            // Arrange
            const updateData: UpdateUserData = {
                status: UserStatus.ACTIVE,
            }

            // Act
            const updatedUser = await userRepository.update(3, updateData)

            // Assert
            expect(updatedUser.status).toBe(UserStatus.ACTIVE)
        })

        it('should update multiple fields', async () => {
            // Arrange
            const updateData: UpdateUserData = {
                firstName: 'MultiUpdate',
                lastName: 'Test',
                status: UserStatus.ACTIVE,
            }

            // Act
            const updatedUser = await userRepository.update(3, updateData)

            // Assert
            expect(updatedUser.firstName).toBe('MultiUpdate')
            expect(updatedUser.lastName).toBe('Test')
            expect(updatedUser.status).toBe(UserStatus.ACTIVE)
        })

        it('should update the updatedAt timestamp', async () => {
            // Arrange
            const originalUser = await userRepository.findById(1)
            const updateData: UpdateUserData = {
                firstName: 'Updated',
            }

            // Wait a bit to ensure timestamp difference
            await new Promise((resolve) => setTimeout(resolve, 100))

            // Act
            const updatedUser = await userRepository.update(1, updateData)

            // Assert
            expect(updatedUser.updatedAt.getTime()).toBeGreaterThan(originalUser!.updatedAt.getTime())
        })

        it('should persist updated data', async () => {
            // Arrange
            const updateData: UpdateUserData = {
                firstName: 'Persisted',
            }

            // Act
            await userRepository.update(1, updateData)
            const foundUser = await userRepository.findById(1)

            // Assert
            expect(foundUser?.firstName).toBe('Persisted')
        })

        it('should throw error when user not found', async () => {
            // Arrange
            const updateData: UpdateUserData = {
                firstName: 'NotFound',
            }

            // Act & Assert
            await expect(userRepository.update(999, updateData)).rejects.toThrow('User not found')
        })

        it('should simulate delay', async () => {
            // Arrange
            const updateData: UpdateUserData = {
                firstName: 'Delay',
            }
            const startTime = Date.now()

            // Act
            await userRepository.update(1, updateData)

            // Assert - should take at least 400ms
            const elapsed = Date.now() - startTime
            expect(elapsed).toBeGreaterThanOrEqual(380)
        })
    })

    describe('delete', () => {
        it('should delete user successfully', async () => {
            // Act
            await userRepository.delete(1)
            const deletedUser = await userRepository.findById(1)

            // Assert
            expect(deletedUser).toBeNull()
        })

        it('should remove user from users list', async () => {
            // Arrange
            const beforeDelete = await userRepository.findAll()

            // Act
            await userRepository.delete(1)
            const afterDelete = await userRepository.findAll()

            // Assert
            expect(beforeDelete.total).toBe(5)
            expect(afterDelete.total).toBe(4)
        })

        it('should not throw error when deleting non-existent user', async () => {
            // Act & Assert
            await expect(userRepository.delete(999)).resolves.not.toThrow()
        })

        it('should delete user and verify by email', async () => {
            // Act
            await userRepository.delete(1)
            const deletedUser = await userRepository.findByEmail('admin@fivucsas.com')

            // Assert
            expect(deletedUser).toBeNull()
        })

        it('should simulate delay', async () => {
            // Arrange
            const startTime = Date.now()

            // Act
            await userRepository.delete(1)

            // Assert - should take at least 300ms
            const elapsed = Date.now() - startTime
            expect(elapsed).toBeGreaterThanOrEqual(280)
        })
    })

    describe('Data Integrity', () => {
        it('should maintain data integrity after multiple operations', async () => {
            // Arrange
            const createData: CreateUserData = {
                email: 'integrity@example.com',
                firstName: 'Integrity',
                lastName: 'Test',
                password: 'password123',
                role: UserRole.USER,
                tenantId: 1,
            }

            // Act - Create, Update, Find
            const created = await userRepository.create(createData)
            const updated = await userRepository.update(created.id, { firstName: 'Updated' })
            const found = await userRepository.findById(created.id)

            // Assert
            expect(found).not.toBeNull()
            expect(found?.id).toBe(created.id)
            expect(found?.firstName).toBe('Updated')
            expect(found?.email).toBe('integrity@example.com')
        })

        it('should maintain correct count after create and delete', async () => {
            // Arrange
            const initialCount = (await userRepository.findAll()).total
            const createData: CreateUserData = {
                email: 'temp@example.com',
                firstName: 'Temp',
                lastName: 'User',
                password: 'password123',
                role: UserRole.USER,
                tenantId: 1,
            }

            // Act
            const created = await userRepository.create(createData)
            const afterCreate = (await userRepository.findAll()).total
            await userRepository.delete(created.id)
            const afterDelete = (await userRepository.findAll()).total

            // Assert
            expect(afterCreate).toBe(initialCount + 1)
            expect(afterDelete).toBe(initialCount)
        })
    })
})
