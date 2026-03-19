import { describe, it, expect, beforeEach, vi } from 'vitest'
import { UserService } from '../UserService'
import type { IUserRepository, CreateUserData, UpdateUserData } from '@domain/interfaces/IUserRepository'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { PaginatedResult } from '@domain/interfaces/IRepository'
import { User, UserRole, UserStatus } from '@domain/models/User'
import { ValidationError, NotFoundError, ConflictError, BusinessError } from '@core/errors'
import type { UserFilters } from '@domain/interfaces/IUserService'

describe('UserService', () => {
    let userService: UserService
    let mockUserRepository: IUserRepository
    let mockLogger: ILogger

    const mockUser = new User(
        '1',
        'test@example.com',
        'Test',
        'User',
        UserRole.USER,
        UserStatus.ACTIVE,
        '1',
        new Date(),
        new Date()
    )

    const mockSuperAdmin = new User(
        '99',
        'admin@example.com',
        'Super',
        'Admin',
        UserRole.SUPER_ADMIN,
        UserStatus.ACTIVE,
        '1',
        new Date(),
        new Date()
    )

    beforeEach(() => {
        // Create mock repository
        mockUserRepository = {
            findAll: vi.fn(),
            findById: vi.fn(),
            findByEmail: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            search: vi.fn(),
        }

        // Create mock logger
        mockLogger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        }

        // Create service instance with mocks
        userService = new UserService(mockUserRepository, mockLogger)
    })

    describe('getUsers', () => {
        it('should get users with filters successfully', async () => {
            // Arrange
            const filters: UserFilters = {
                search: 'test',
                status: UserStatus.ACTIVE,
                role: UserRole.USER,
            }
            const mockResult: PaginatedResult<User> = {
                items: [mockUser],
                total: 1,
                page: 0,
                pageSize: 20,
                totalPages: 1,
            }

            // When search is provided, the service uses the search endpoint
            vi.mocked(mockUserRepository.search).mockResolvedValue(mockResult)

            // Act
            const result = await userService.getUsers(filters, 0, 20)

            // Assert - search endpoint is used when filters.search is provided
            expect(mockUserRepository.search).toHaveBeenCalledWith('test')
            expect(result).toEqual(mockResult)
            expect(mockLogger.debug).toHaveBeenCalledWith('Getting users', {
                filters,
                page: 0,
                pageSize: 20,
            })
        })

        it('should get users without filters', async () => {
            // Arrange
            const mockResult: PaginatedResult<User> = {
                items: [mockUser],
                total: 1,
                page: 0,
                pageSize: 20,
                totalPages: 1,
            }

            vi.mocked(mockUserRepository.findAll).mockResolvedValue(mockResult)

            // Act
            const result = await userService.getUsers()

            // Assert
            expect(mockUserRepository.findAll).toHaveBeenCalledWith({
                page: 0,
                pageSize: 20,
                filters: undefined,
            })
            expect(result).toEqual(mockResult)
        })

        it('should handle repository errors', async () => {
            // Arrange
            const error = new Error('Database error')
            vi.mocked(mockUserRepository.findAll).mockRejectedValue(error)

            // Act & Assert
            await expect(userService.getUsers()).rejects.toThrow('Database error')
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to get users', error)
        })
    })

    describe('getUserById', () => {
        it('should get user by ID when found', async () => {
            // Arrange
            vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser)

            // Act
            const result = await userService.getUserById('1')

            // Assert
            expect(mockUserRepository.findById).toHaveBeenCalledWith('1')
            expect(result).toEqual(mockUser)
            expect(mockLogger.debug).toHaveBeenCalledWith('Getting user 1')
        })

        it('should throw NotFoundError when user not found', async () => {
            // Arrange
            vi.mocked(mockUserRepository.findById).mockResolvedValue(null)

            // Act & Assert
            await expect(userService.getUserById('999')).rejects.toThrow(NotFoundError)
            await expect(userService.getUserById('999')).rejects.toThrow('User with ID 999 not found')
        })
    })

    describe('createUser', () => {
        const validCreateData: CreateUserData = {
            email: 'newuser@example.com',
            firstName: 'New',
            lastName: 'User',
            password: 'SecurePass123!@#',
            role: UserRole.USER,
            tenantId: '1',
        }

        it('should create user with valid data', async () => {
            // Arrange
            const newUser = new User(
                '2',
                validCreateData.email,
                validCreateData.firstName,
                validCreateData.lastName,
                validCreateData.role as UserRole,
                UserStatus.PENDING_ENROLLMENT,
                validCreateData.tenantId,
                new Date(),
                new Date()
            )

            vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(null)
            vi.mocked(mockUserRepository.create).mockResolvedValue(newUser)

            // Act
            const result = await userService.createUser(validCreateData)

            // Assert
            expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(validCreateData.email)
            expect(mockUserRepository.create).toHaveBeenCalledWith(validCreateData)
            expect(result).toEqual(newUser)
            expect(mockLogger.info).toHaveBeenCalledWith('Creating new user', { email: validCreateData.email })
            expect(mockLogger.info).toHaveBeenCalledWith('User created successfully', { userId: newUser.id })
        })

        it('should throw ValidationError for invalid email', async () => {
            // Arrange
            const invalidData: CreateUserData = {
                ...validCreateData,
                email: 'invalid-email',
            }

            // Act & Assert
            await expect(userService.createUser(invalidData)).rejects.toThrow(ValidationError)
            expect(mockUserRepository.findByEmail).not.toHaveBeenCalled()
            expect(mockUserRepository.create).not.toHaveBeenCalled()
        })

        it('should throw ValidationError for missing required fields', async () => {
            // Arrange
            const invalidData = {
                email: 'test@example.com',
                firstName: 'Test',
                // Missing lastName, password, role, tenantId
            } as CreateUserData

            // Act & Assert
            await expect(userService.createUser(invalidData)).rejects.toThrow(ValidationError)
            expect(mockUserRepository.create).not.toHaveBeenCalled()
        })

        it('should throw ValidationError for short password', async () => {
            // Arrange
            const invalidData: CreateUserData = {
                ...validCreateData,
                password: 'Short1!', // Less than 12 characters
            }

            // Act & Assert
            await expect(userService.createUser(invalidData)).rejects.toThrow(ValidationError)
            expect(mockUserRepository.create).not.toHaveBeenCalled()
        })

        it('should throw ConflictError when email already exists', async () => {
            // Arrange
            vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(mockUser)

            // Act & Assert
            await expect(userService.createUser(validCreateData)).rejects.toThrow(ConflictError)
            await expect(userService.createUser(validCreateData)).rejects.toThrow(
                `User with email ${validCreateData.email} already exists`
            )
            expect(mockUserRepository.create).not.toHaveBeenCalled()
        })

        it('should handle repository errors', async () => {
            // Arrange
            const error = new Error('Database error')
            vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(null)
            vi.mocked(mockUserRepository.create).mockRejectedValue(error)

            // Act & Assert
            await expect(userService.createUser(validCreateData)).rejects.toThrow('Database error')
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to create user', error)
        })
    })

    describe('updateUser', () => {
        const validUpdateData: UpdateUserData = {
            firstName: 'Updated',
            lastName: 'Name',
        }

        it('should update user successfully', async () => {
            // Arrange
            const updatedUser = new User(
                mockUser.id,
                mockUser.email,
                'Updated',
                'Name',
                mockUser.role,
                mockUser.status,
                mockUser.tenantId,
                mockUser.createdAt,
                new Date()
            )

            vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser)
            vi.mocked(mockUserRepository.update).mockResolvedValue(updatedUser)

            // Act
            const result = await userService.updateUser('1', validUpdateData)

            // Assert
            expect(mockUserRepository.findById).toHaveBeenCalledWith('1')
            expect(mockUserRepository.update).toHaveBeenCalledWith('1', validUpdateData)
            expect(result).toEqual(updatedUser)
            expect(mockLogger.info).toHaveBeenCalledWith('Updating user 1')
            expect(mockLogger.info).toHaveBeenCalledWith('User updated successfully', { userId: updatedUser.id })
        })

        it('should throw ValidationError for invalid data', async () => {
            // Arrange
            const invalidData: UpdateUserData = {
                email: 'invalid-email',
            }

            // Act & Assert
            await expect(userService.updateUser('1', invalidData)).rejects.toThrow(ValidationError)
            expect(mockUserRepository.findById).not.toHaveBeenCalled()
        })

        it('should throw NotFoundError when user not found', async () => {
            // Arrange
            vi.mocked(mockUserRepository.findById).mockResolvedValue(null)

            // Act & Assert
            await expect(userService.updateUser('999', validUpdateData)).rejects.toThrow(NotFoundError)
            await expect(userService.updateUser('999', validUpdateData)).rejects.toThrow('User with ID 999 not found')
            expect(mockUserRepository.update).not.toHaveBeenCalled()
        })

        it('should check for email conflicts when updating email', async () => {
            // Arrange
            const updateData: UpdateUserData = {
                email: 'newemail@example.com',
            }
            const conflictingUser = new User(
                '2',
                'newemail@example.com',
                'Other',
                'User',
                UserRole.USER,
                UserStatus.ACTIVE,
                '1',
                new Date(),
                new Date()
            )

            vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser)
            vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(conflictingUser)

            // Act & Assert
            await expect(userService.updateUser('1', updateData)).rejects.toThrow(ConflictError)
            await expect(userService.updateUser('1', updateData)).rejects.toThrow(
                'User with email newemail@example.com already exists'
            )
            expect(mockUserRepository.update).not.toHaveBeenCalled()
        })

        it('should allow updating email to same value', async () => {
            // Arrange
            const updateData: UpdateUserData = {
                email: mockUser.email, // Same email
                firstName: 'Updated',
            }
            const updatedUser = new User(
                mockUser.id,
                mockUser.email,
                'Updated',
                mockUser.lastName,
                mockUser.role,
                mockUser.status,
                mockUser.tenantId,
                mockUser.createdAt,
                new Date()
            )

            vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser)
            vi.mocked(mockUserRepository.update).mockResolvedValue(updatedUser)

            // Act
            const result = await userService.updateUser('1', updateData)

            // Assert
            expect(mockUserRepository.findByEmail).not.toHaveBeenCalled()
            expect(mockUserRepository.update).toHaveBeenCalledWith('1', updateData)
            expect(result).toEqual(updatedUser)
        })

        it('should handle repository errors', async () => {
            // Arrange
            const error = new Error('Database error')
            vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser)
            vi.mocked(mockUserRepository.update).mockRejectedValue(error)

            // Act & Assert
            await expect(userService.updateUser('1', validUpdateData)).rejects.toThrow('Database error')
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to update user 1', error)
        })
    })

    describe('deleteUser', () => {
        it('should delete user successfully', async () => {
            // Arrange
            vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser)
            vi.mocked(mockUserRepository.delete).mockResolvedValue(undefined)

            // Act
            await userService.deleteUser('1')

            // Assert
            expect(mockUserRepository.findById).toHaveBeenCalledWith('1')
            expect(mockUserRepository.delete).toHaveBeenCalledWith('1')
            expect(mockLogger.info).toHaveBeenCalledWith('Deleting user 1')
            expect(mockLogger.info).toHaveBeenCalledWith('User deleted successfully', { userId: '1' })
        })

        it('should throw NotFoundError when user not found', async () => {
            // Arrange
            vi.mocked(mockUserRepository.findById).mockResolvedValue(null)

            // Act & Assert
            await expect(userService.deleteUser('999')).rejects.toThrow(NotFoundError)
            await expect(userService.deleteUser('999')).rejects.toThrow('User with ID 999 not found')
            expect(mockUserRepository.delete).not.toHaveBeenCalled()
        })

        it('should throw BusinessError when attempting to delete super admin', async () => {
            // Arrange
            vi.mocked(mockUserRepository.findById).mockResolvedValue(mockSuperAdmin)

            // Act & Assert
            await expect(userService.deleteUser('99')).rejects.toThrow(BusinessError)
            await expect(userService.deleteUser('99')).rejects.toThrow('Cannot delete super admin users')
            expect(mockUserRepository.delete).not.toHaveBeenCalled()
        })

        it('should handle repository errors', async () => {
            // Arrange
            const error = new Error('Database error')
            vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser)
            vi.mocked(mockUserRepository.delete).mockRejectedValue(error)

            // Act & Assert
            await expect(userService.deleteUser('1')).rejects.toThrow('Database error')
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to delete user 1', error)
        })
    })
})
