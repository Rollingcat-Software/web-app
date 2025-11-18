import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { Container } from 'inversify'
import { DependencyProvider } from '@app/providers'
import { TYPES } from '@core/di/types'
import { useUsers } from '../useUsers'
import { createTestContainer } from '@test/testUtils'
import type { IUserService } from '@domain/interfaces/IUserService'
import type { ErrorHandler } from '@core/errors'
import { User, UserRole, UserStatus } from '@domain/models/User'

describe('useUsers', () => {
    let container: Container
    let mockUserService: jest.Mocked<IUserService>
    let mockErrorHandler: jest.Mocked<ErrorHandler>

    // Test data
    const testUsers = [
        new User(
            1,
            'user1@example.com',
            'John',
            'Doe',
            UserRole.USER,
            UserStatus.ACTIVE,
            1,
            new Date('2024-01-01'),
            new Date('2024-01-01')
        ),
        new User(
            2,
            'user2@example.com',
            'Jane',
            'Smith',
            UserRole.ADMIN,
            UserStatus.ACTIVE,
            1,
            new Date('2024-01-02'),
            new Date('2024-01-02')
        ),
    ]

    const newUser = new User(
        3,
        'user3@example.com',
        'Bob',
        'Johnson',
        UserRole.USER,
        UserStatus.PENDING_ENROLLMENT,
        1,
        new Date('2024-01-03'),
        new Date('2024-01-03')
    )

    beforeEach(() => {
        container = createTestContainer()
        mockUserService = container.get<IUserService>(TYPES.UserService) as jest.Mocked<IUserService>
        mockErrorHandler = container.get<ErrorHandler>(TYPES.ErrorHandler) as jest.Mocked<ErrorHandler>

        vi.clearAllMocks()
    })

    const wrapper = ({ children }: { children: ReactNode }) => (
        <DependencyProvider container={container}>{children}</DependencyProvider>
    )

    describe('initial loading state', () => {
        it('should start with loading state', () => {
            mockUserService.getUsers = vi.fn().mockImplementation(
                () => new Promise(() => {}) // Never resolves
            )

            const { result } = renderHook(() => useUsers(), { wrapper })

            expect(result.current.loading).toBe(true)
            expect(result.current.users).toEqual([])
            expect(result.current.total).toBe(0)
            expect(result.current.error).toBeNull()
        })
    })

    describe('successful users fetch on mount', () => {
        it('should fetch users successfully on mount', async () => {
            mockUserService.getUsers = vi.fn().mockResolvedValue({
                items: testUsers,
                total: 2,
            })

            const { result } = renderHook(() => useUsers(), { wrapper })

            // Initially loading
            expect(result.current.loading).toBe(true)

            // Wait for users to load
            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            expect(result.current.users).toEqual(testUsers)
            expect(result.current.total).toBe(2)
            expect(result.current.error).toBeNull()
            expect(mockUserService.getUsers).toHaveBeenCalledTimes(1)
            expect(mockUserService.getUsers).toHaveBeenCalledWith(undefined)
        })

        it('should fetch empty list successfully', async () => {
            mockUserService.getUsers = vi.fn().mockResolvedValue({
                items: [],
                total: 0,
            })

            const { result } = renderHook(() => useUsers(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            expect(result.current.users).toEqual([])
            expect(result.current.total).toBe(0)
            expect(result.current.error).toBeNull()
        })
    })

    describe('fetch with filters', () => {
        it('should fetch users with initial filters', async () => {
            const filters = { status: UserStatus.ACTIVE, role: UserRole.ADMIN }
            mockUserService.getUsers = vi.fn().mockResolvedValue({
                items: [testUsers[1]],
                total: 1,
            })

            const { result } = renderHook(() => useUsers(filters), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            expect(result.current.users).toEqual([testUsers[1]])
            expect(result.current.total).toBe(1)
            expect(mockUserService.getUsers).toHaveBeenCalledWith(filters)
        })

        it('should refetch with different filters', async () => {
            mockUserService.getUsers = vi.fn().mockResolvedValue({
                items: testUsers,
                total: 2,
            })

            const { result } = renderHook(() => useUsers(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            // Refetch with new filters
            const newFilters = { status: UserStatus.PENDING_ENROLLMENT }
            mockUserService.getUsers = vi.fn().mockResolvedValue({
                items: [newUser],
                total: 1,
            })

            await result.current.refetch(newFilters)

            await waitFor(() => {
                expect(result.current.users).toEqual([newUser])
            })

            expect(result.current.total).toBe(1)
            expect(mockUserService.getUsers).toHaveBeenCalledWith(newFilters)
        })
    })

    describe('createUser success and auto-refresh', () => {
        it('should create user and auto-refresh the list', async () => {
            // Initial fetch
            mockUserService.getUsers = vi.fn().mockResolvedValue({
                items: testUsers,
                total: 2,
            })

            const { result } = renderHook(() => useUsers(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            // Setup create and refresh
            mockUserService.createUser = vi.fn().mockResolvedValue(newUser)
            mockUserService.getUsers = vi.fn().mockResolvedValue({
                items: [...testUsers, newUser],
                total: 3,
            })

            // Create user
            const createData = {
                email: 'user3@example.com',
                firstName: 'Bob',
                lastName: 'Johnson',
                role: UserRole.USER,
                tenantId: 1,
            }

            const createdUser = await result.current.createUser(createData)

            expect(createdUser).toEqual(newUser)
            expect(mockUserService.createUser).toHaveBeenCalledWith(createData)

            // Wait for auto-refresh
            await waitFor(() => {
                expect(result.current.users).toEqual([...testUsers, newUser])
            })

            expect(result.current.total).toBe(3)
            expect(mockUserService.getUsers).toHaveBeenCalled()
        })

        it('should preserve filters when auto-refreshing after create', async () => {
            const filters = { status: UserStatus.ACTIVE }
            mockUserService.getUsers = vi.fn().mockResolvedValue({
                items: testUsers,
                total: 2,
            })

            const { result } = renderHook(() => useUsers(filters), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            // Create user
            mockUserService.createUser = vi.fn().mockResolvedValue(newUser)

            await result.current.createUser({
                email: 'user3@example.com',
                firstName: 'Bob',
                lastName: 'Johnson',
                role: UserRole.USER,
                tenantId: 1,
            })

            // Verify refresh was called with original filters
            await waitFor(() => {
                expect(mockUserService.getUsers).toHaveBeenLastCalledWith(filters)
            })
        })
    })

    describe('createUser failure', () => {
        it('should handle create user failure and call error handler', async () => {
            mockUserService.getUsers = vi.fn().mockResolvedValue({
                items: testUsers,
                total: 2,
            })

            const { result } = renderHook(() => useUsers(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            const error = new Error('Failed to create user')
            mockUserService.createUser = vi.fn().mockRejectedValue(error)
            mockErrorHandler.handle = vi.fn()

            const createData = {
                email: 'invalid',
                firstName: 'Test',
                lastName: 'User',
                role: UserRole.USER,
                tenantId: 1,
            }

            await expect(result.current.createUser(createData)).rejects.toThrow('Failed to create user')

            expect(mockErrorHandler.handle).toHaveBeenCalledWith(error)
            // List should not change on error
            expect(result.current.users).toEqual(testUsers)
        })

        it('should not refresh list if create fails', async () => {
            mockUserService.getUsers = vi.fn().mockResolvedValue({
                items: testUsers,
                total: 2,
            })

            const { result } = renderHook(() => useUsers(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            const getUsersCallCount = mockUserService.getUsers.mock.calls.length

            const error = new Error('Create failed')
            mockUserService.createUser = vi.fn().mockRejectedValue(error)
            mockErrorHandler.handle = vi.fn()

            try {
                await result.current.createUser({
                    email: 'test@example.com',
                    firstName: 'Test',
                    lastName: 'User',
                    role: UserRole.USER,
                    tenantId: 1,
                })
            } catch {
                // Expected to throw
            }

            // getUsers should not have been called again
            expect(mockUserService.getUsers).toHaveBeenCalledTimes(getUsersCallCount)
        })
    })

    describe('updateUser success', () => {
        it('should update user and auto-refresh the list', async () => {
            mockUserService.getUsers = vi.fn().mockResolvedValue({
                items: testUsers,
                total: 2,
            })

            const { result } = renderHook(() => useUsers(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            const updatedUser = new User(
                1,
                'user1@example.com',
                'John',
                'Updated', // Changed last name
                UserRole.USER,
                UserStatus.ACTIVE,
                1,
                new Date('2024-01-01'),
                new Date('2024-01-05')
            )

            mockUserService.updateUser = vi.fn().mockResolvedValue(updatedUser)
            mockUserService.getUsers = vi.fn().mockResolvedValue({
                items: [updatedUser, testUsers[1]],
                total: 2,
            })

            const updateData = { lastName: 'Updated' }
            const result_user = await result.current.updateUser(1, updateData)

            expect(result_user).toEqual(updatedUser)
            expect(mockUserService.updateUser).toHaveBeenCalledWith(1, updateData)

            // Wait for auto-refresh
            await waitFor(() => {
                expect(result.current.users[0]).toEqual(updatedUser)
            })
        })

        it('should handle update failure and call error handler', async () => {
            mockUserService.getUsers = vi.fn().mockResolvedValue({
                items: testUsers,
                total: 2,
            })

            const { result } = renderHook(() => useUsers(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            const error = new Error('Update failed')
            mockUserService.updateUser = vi.fn().mockRejectedValue(error)
            mockErrorHandler.handle = vi.fn()

            await expect(result.current.updateUser(1, { lastName: 'NewName' })).rejects.toThrow('Update failed')

            expect(mockErrorHandler.handle).toHaveBeenCalledWith(error)
        })
    })

    describe('deleteUser success', () => {
        it('should delete user and auto-refresh the list', async () => {
            mockUserService.getUsers = vi.fn().mockResolvedValue({
                items: testUsers,
                total: 2,
            })

            const { result } = renderHook(() => useUsers(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            mockUserService.deleteUser = vi.fn().mockResolvedValue(undefined)
            mockUserService.getUsers = vi.fn().mockResolvedValue({
                items: [testUsers[1]],
                total: 1,
            })

            await result.current.deleteUser(1)

            expect(mockUserService.deleteUser).toHaveBeenCalledWith(1)

            // Wait for auto-refresh
            await waitFor(() => {
                expect(result.current.users).toEqual([testUsers[1]])
            })

            expect(result.current.total).toBe(1)
        })

        it('should handle delete failure and call error handler', async () => {
            mockUserService.getUsers = vi.fn().mockResolvedValue({
                items: testUsers,
                total: 2,
            })

            const { result } = renderHook(() => useUsers(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            const error = new Error('Delete failed')
            mockUserService.deleteUser = vi.fn().mockRejectedValue(error)
            mockErrorHandler.handle = vi.fn()

            await expect(result.current.deleteUser(1)).rejects.toThrow('Delete failed')

            expect(mockErrorHandler.handle).toHaveBeenCalledWith(error)
        })
    })

    describe('error handling', () => {
        it('should handle initial fetch error', async () => {
            const error = new Error('Failed to fetch users')
            mockUserService.getUsers = vi.fn().mockRejectedValue(error)
            mockErrorHandler.handle = vi.fn()

            const { result } = renderHook(() => useUsers(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            expect(result.current.users).toEqual([])
            expect(result.current.total).toBe(0)
            expect(result.current.error).toEqual(error)
            expect(mockErrorHandler.handle).toHaveBeenCalledWith(error)
        })

        it('should clear previous error on successful refetch', async () => {
            // First fetch fails
            const error = new Error('Network error')
            mockUserService.getUsers = vi.fn().mockRejectedValue(error)
            mockErrorHandler.handle = vi.fn()

            const { result } = renderHook(() => useUsers(), { wrapper })

            await waitFor(() => {
                expect(result.current.error).toEqual(error)
            })

            // Retry succeeds
            mockUserService.getUsers = vi.fn().mockResolvedValue({
                items: testUsers,
                total: 2,
            })

            await result.current.refetch()

            await waitFor(() => {
                expect(result.current.error).toBeNull()
            })

            expect(result.current.users).toEqual(testUsers)
        })

        it('should set loading to false after error', async () => {
            const error = new Error('Fetch error')
            mockUserService.getUsers = vi.fn().mockRejectedValue(error)
            mockErrorHandler.handle = vi.fn()

            const { result } = renderHook(() => useUsers(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            expect(result.current.error).toEqual(error)
        })
    })

    describe('activateUser', () => {
        it('should activate user and auto-refresh', async () => {
            mockUserService.getUsers = vi.fn().mockResolvedValue({
                items: testUsers,
                total: 2,
            })

            const { result } = renderHook(() => useUsers(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            mockUserService.activateUser = vi.fn().mockResolvedValue(undefined)

            await result.current.activateUser(1)

            expect(mockUserService.activateUser).toHaveBeenCalledWith(1)
            expect(mockUserService.getUsers).toHaveBeenCalled()
        })

        it('should handle activate failure', async () => {
            mockUserService.getUsers = vi.fn().mockResolvedValue({
                items: testUsers,
                total: 2,
            })

            const { result } = renderHook(() => useUsers(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            const error = new Error('Activation failed')
            mockUserService.activateUser = vi.fn().mockRejectedValue(error)
            mockErrorHandler.handle = vi.fn()

            await expect(result.current.activateUser(1)).rejects.toThrow('Activation failed')

            expect(mockErrorHandler.handle).toHaveBeenCalledWith(error)
        })
    })

    describe('suspendUser', () => {
        it('should suspend user with reason and auto-refresh', async () => {
            mockUserService.getUsers = vi.fn().mockResolvedValue({
                items: testUsers,
                total: 2,
            })

            const { result } = renderHook(() => useUsers(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            mockUserService.suspendUser = vi.fn().mockResolvedValue(undefined)

            await result.current.suspendUser(1, 'Policy violation')

            expect(mockUserService.suspendUser).toHaveBeenCalledWith(1, 'Policy violation')
            expect(mockUserService.getUsers).toHaveBeenCalled()
        })

        it('should suspend user without reason', async () => {
            mockUserService.getUsers = vi.fn().mockResolvedValue({
                items: testUsers,
                total: 2,
            })

            const { result } = renderHook(() => useUsers(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            mockUserService.suspendUser = vi.fn().mockResolvedValue(undefined)

            await result.current.suspendUser(1)

            expect(mockUserService.suspendUser).toHaveBeenCalledWith(1, undefined)
        })

        it('should handle suspend failure', async () => {
            mockUserService.getUsers = vi.fn().mockResolvedValue({
                items: testUsers,
                total: 2,
            })

            const { result } = renderHook(() => useUsers(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            const error = new Error('Suspension failed')
            mockUserService.suspendUser = vi.fn().mockRejectedValue(error)
            mockErrorHandler.handle = vi.fn()

            await expect(result.current.suspendUser(1, 'reason')).rejects.toThrow('Suspension failed')

            expect(mockErrorHandler.handle).toHaveBeenCalledWith(error)
        })
    })

    describe('edge cases', () => {
        it('should handle multiple concurrent operations', async () => {
            mockUserService.getUsers = vi.fn().mockResolvedValue({
                items: testUsers,
                total: 2,
            })

            const { result } = renderHook(() => useUsers(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            mockUserService.createUser = vi.fn().mockResolvedValue(newUser)
            mockUserService.deleteUser = vi.fn().mockResolvedValue(undefined)

            // Run multiple operations concurrently
            await Promise.all([
                result.current.createUser({
                    email: 'new@example.com',
                    firstName: 'New',
                    lastName: 'User',
                    role: UserRole.USER,
                    tenantId: 1,
                }),
                result.current.deleteUser(2),
            ])

            // Should have called services
            expect(mockUserService.createUser).toHaveBeenCalled()
            expect(mockUserService.deleteUser).toHaveBeenCalled()
        })

        it('should maintain stable function references', async () => {
            mockUserService.getUsers = vi.fn().mockResolvedValue({
                items: testUsers,
                total: 2,
            })

            const { result, rerender } = renderHook(() => useUsers(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            const { refetch, createUser, updateUser, deleteUser, activateUser, suspendUser } = result.current

            rerender()

            // Function references should be stable
            expect(result.current.refetch).toBe(refetch)
            expect(result.current.createUser).toBe(createUser)
            expect(result.current.updateUser).toBe(updateUser)
            expect(result.current.deleteUser).toBe(deleteUser)
            expect(result.current.activateUser).toBe(activateUser)
            expect(result.current.suspendUser).toBe(suspendUser)
        })
    })
})
