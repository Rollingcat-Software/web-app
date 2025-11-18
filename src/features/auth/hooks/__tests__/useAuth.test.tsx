import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { Container } from 'inversify'
import { DependencyProvider } from '@app/providers'
import { TYPES } from '@core/di/types'
import { useAuth } from '../useAuth'
import { createTestContainer } from '@test/testUtils'
import type { IAuthService } from '@domain/interfaces/IAuthService'
import type { ErrorHandler } from '@core/errors'
import { User, UserRole, UserStatus } from '@domain/models/User'

describe('useAuth', () => {
    let container: Container
    let mockAuthService: jest.Mocked<IAuthService>
    let mockErrorHandler: jest.Mocked<ErrorHandler>

    // Test user data
    const testUser = new User(
        1,
        'test@example.com',
        'John',
        'Doe',
        UserRole.ADMIN,
        UserStatus.ACTIVE,
        1,
        new Date('2024-01-01'),
        new Date('2024-01-01')
    )

    beforeEach(() => {
        // Create fresh container for each test
        container = createTestContainer()

        // Get services from container
        mockAuthService = container.get<IAuthService>(TYPES.AuthService) as jest.Mocked<IAuthService>
        mockErrorHandler = container.get<ErrorHandler>(TYPES.ErrorHandler) as jest.Mocked<ErrorHandler>

        // Reset mocks
        vi.clearAllMocks()
    })

    // Wrapper component that provides DI context
    const wrapper = ({ children }: { children: ReactNode }) => (
        <DependencyProvider container={container}>{children}</DependencyProvider>
    )

    describe('initial loading state', () => {
        it('should start with loading state', () => {
            mockAuthService.getCurrentUser = vi.fn().mockImplementation(
                () => new Promise(() => {}) // Never resolves
            )

            const { result } = renderHook(() => useAuth(), { wrapper })

            expect(result.current.loading).toBe(true)
            expect(result.current.user).toBeNull()
            expect(result.current.error).toBeNull()
            expect(result.current.isAuthenticated).toBe(false)
        })
    })

    describe('successful user load on mount', () => {
        it('should load user successfully on mount', async () => {
            mockAuthService.getCurrentUser = vi.fn().mockResolvedValue(testUser)

            const { result } = renderHook(() => useAuth(), { wrapper })

            // Initially loading
            expect(result.current.loading).toBe(true)

            // Wait for user to load
            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            expect(result.current.user).toEqual(testUser)
            expect(result.current.error).toBeNull()
            expect(result.current.isAuthenticated).toBe(true)
            expect(mockAuthService.getCurrentUser).toHaveBeenCalledTimes(1)
        })
    })

    describe('failed user load on mount', () => {
        it('should handle error when loading user fails', async () => {
            const error = new Error('Failed to load user')
            mockAuthService.getCurrentUser = vi.fn().mockRejectedValue(error)

            const { result } = renderHook(() => useAuth(), { wrapper })

            // Wait for error state
            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            expect(result.current.user).toBeNull()
            expect(result.current.error).toEqual(error)
            expect(result.current.isAuthenticated).toBe(false)
        })

        it('should set isAuthenticated to false when user load returns null', async () => {
            mockAuthService.getCurrentUser = vi.fn().mockResolvedValue(null)

            const { result } = renderHook(() => useAuth(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            expect(result.current.user).toBeNull()
            expect(result.current.isAuthenticated).toBe(false)
        })
    })

    describe('login success', () => {
        it('should login successfully and update state', async () => {
            mockAuthService.getCurrentUser = vi.fn().mockResolvedValue(null)
            mockAuthService.login = vi.fn().mockResolvedValue({
                user: testUser,
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
            })

            const { result } = renderHook(() => useAuth(), { wrapper })

            // Wait for initial load
            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            // Login
            await result.current.login({
                email: 'test@example.com',
                password: 'password123',
            })

            // Wait for state to update
            await waitFor(() => {
                expect(result.current.user).toEqual(testUser)
            })

            expect(result.current.loading).toBe(false)
            expect(result.current.error).toBeNull()
            expect(result.current.isAuthenticated).toBe(true)
            expect(mockAuthService.login).toHaveBeenCalledWith({
                email: 'test@example.com',
                password: 'password123',
            })
        })

        it('should set loading state during login', async () => {
            mockAuthService.getCurrentUser = vi.fn().mockResolvedValue(null)
            let loginResolver: (value: any) => void
            mockAuthService.login = vi.fn().mockImplementation(
                () =>
                    new Promise((resolve) => {
                        loginResolver = resolve
                    })
            )

            const { result } = renderHook(() => useAuth(), { wrapper })

            // Wait for initial load
            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            // Start login
            const loginPromise = result.current.login({
                email: 'test@example.com',
                password: 'password123',
            })

            // Should be loading
            await waitFor(() => {
                expect(result.current.loading).toBe(true)
            })

            // Resolve login
            loginResolver!({
                user: testUser,
                accessToken: 'token',
                refreshToken: 'refresh',
            })
            await loginPromise

            // Should be done loading
            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })
        })
    })

    describe('login failure', () => {
        it('should handle login failure and call error handler', async () => {
            mockAuthService.getCurrentUser = vi.fn().mockResolvedValue(null)
            const error = new Error('Invalid credentials')
            mockAuthService.login = vi.fn().mockRejectedValue(error)
            mockErrorHandler.handle = vi.fn()

            const { result } = renderHook(() => useAuth(), { wrapper })

            // Wait for initial load
            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            // Login should throw
            await expect(
                result.current.login({
                    email: 'test@example.com',
                    password: 'wrong',
                })
            ).rejects.toThrow('Invalid credentials')

            // Wait for error state to update
            await waitFor(() => {
                expect(result.current.error).toEqual(error)
            })

            expect(result.current.user).toBeNull()
            expect(result.current.loading).toBe(false)
            expect(result.current.isAuthenticated).toBe(false)
            expect(mockErrorHandler.handle).toHaveBeenCalledWith(error)
        })
    })

    describe('logout', () => {
        it('should logout successfully and clear state', async () => {
            mockAuthService.getCurrentUser = vi.fn().mockResolvedValue(testUser)
            mockAuthService.logout = vi.fn().mockResolvedValue(undefined)

            const { result } = renderHook(() => useAuth(), { wrapper })

            // Wait for user to load
            await waitFor(() => {
                expect(result.current.isAuthenticated).toBe(true)
            })

            // Logout
            await result.current.logout()

            // Wait for state to clear
            await waitFor(() => {
                expect(result.current.user).toBeNull()
            })

            expect(result.current.loading).toBe(false)
            expect(result.current.error).toBeNull()
            expect(result.current.isAuthenticated).toBe(false)
            expect(mockAuthService.logout).toHaveBeenCalledTimes(1)
        })

        it('should clear state even if logout fails', async () => {
            mockAuthService.getCurrentUser = vi.fn().mockResolvedValue(testUser)
            const error = new Error('Logout failed')
            mockAuthService.logout = vi.fn().mockRejectedValue(error)
            mockErrorHandler.handle = vi.fn()

            const { result } = renderHook(() => useAuth(), { wrapper })

            // Wait for user to load
            await waitFor(() => {
                expect(result.current.isAuthenticated).toBe(true)
            })

            // Logout
            await result.current.logout()

            // Wait for state to clear (even on error)
            await waitFor(() => {
                expect(result.current.user).toBeNull()
            })

            expect(result.current.isAuthenticated).toBe(false)
            expect(result.current.error).toEqual(error)
            expect(mockErrorHandler.handle).toHaveBeenCalledWith(error)
        })
    })

    describe('refreshUser', () => {
        it('should refresh user data successfully', async () => {
            mockAuthService.getCurrentUser = vi.fn().mockResolvedValue(testUser)

            const { result } = renderHook(() => useAuth(), { wrapper })

            // Wait for initial load
            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            // Update mock to return updated user
            const updatedUser = new User(
                1,
                'test@example.com',
                'John',
                'Smith', // Changed last name
                UserRole.ADMIN,
                UserStatus.ACTIVE,
                1,
                new Date('2024-01-01'),
                new Date('2024-01-02')
            )
            mockAuthService.getCurrentUser = vi.fn().mockResolvedValue(updatedUser)

            // Refresh
            await result.current.refreshUser()

            await waitFor(() => {
                expect(result.current.user).toEqual(updatedUser)
            })

            expect(result.current.loading).toBe(false)
            expect(result.current.error).toBeNull()
            expect(result.current.isAuthenticated).toBe(true)
        })

        it('should handle refresh failure and call error handler', async () => {
            mockAuthService.getCurrentUser = vi.fn().mockResolvedValue(testUser)

            const { result } = renderHook(() => useAuth(), { wrapper })

            // Wait for initial load
            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            // Mock refresh failure
            const error = new Error('Failed to refresh')
            mockAuthService.getCurrentUser = vi.fn().mockRejectedValue(error)
            mockErrorHandler.handle = vi.fn()

            // Refresh
            await result.current.refreshUser()

            await waitFor(() => {
                expect(result.current.error).toEqual(error)
            })

            expect(result.current.user).toBeNull()
            expect(result.current.isAuthenticated).toBe(false)
            expect(mockErrorHandler.handle).toHaveBeenCalledWith(error)
        })
    })

    describe('cleanup on unmount', () => {
        it('should not update state after unmount', async () => {
            let resolveGetUser: (value: any) => void
            mockAuthService.getCurrentUser = vi.fn().mockImplementation(
                () =>
                    new Promise((resolve) => {
                        resolveGetUser = resolve
                    })
            )

            const { result, unmount } = renderHook(() => useAuth(), { wrapper })

            // Verify initial state
            expect(result.current.loading).toBe(true)

            // Unmount before resolving
            unmount()

            // Resolve after unmount
            resolveGetUser!(testUser)

            // Wait a bit to ensure no state updates occur
            await new Promise((resolve) => setTimeout(resolve, 50))

            // State should still be initial state (loading) because component unmounted
            expect(result.current.loading).toBe(true)
            expect(result.current.user).toBeNull()
        })

        it('should cleanup on unmount during login', async () => {
            mockAuthService.getCurrentUser = vi.fn().mockResolvedValue(null)

            let resolveLogin: (value: any) => void
            mockAuthService.login = vi.fn().mockImplementation(
                () =>
                    new Promise((resolve) => {
                        resolveLogin = resolve
                    })
            )

            const { result, unmount } = renderHook(() => useAuth(), { wrapper })

            // Wait for initial load
            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            // Start login (don't await)
            const loginPromise = result.current.login({
                email: 'test@example.com',
                password: 'password',
            })

            // Unmount before login resolves
            unmount()

            // Resolve login after unmount
            resolveLogin!({
                user: testUser,
                accessToken: 'token',
                refreshToken: 'refresh',
            })

            // Wait for login to complete
            await loginPromise

            // Verify no state updates occurred after unmount
            // (We can't really test this directly since the component is unmounted,
            // but the test ensures no errors are thrown)
        })
    })

    describe('edge cases', () => {
        it('should handle multiple rapid login calls', async () => {
            mockAuthService.getCurrentUser = vi.fn().mockResolvedValue(null)
            mockAuthService.login = vi.fn().mockResolvedValue({
                user: testUser,
                accessToken: 'token',
                refreshToken: 'refresh',
            })

            const { result } = renderHook(() => useAuth(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            // Multiple rapid login calls
            const credentials = { email: 'test@example.com', password: 'password' }
            await Promise.all([
                result.current.login(credentials),
                result.current.login(credentials),
                result.current.login(credentials),
            ])

            // Wait for final state to settle
            await waitFor(() => {
                expect(result.current.user).toEqual(testUser)
            })

            expect(result.current.isAuthenticated).toBe(true)
            expect(mockAuthService.login).toHaveBeenCalledTimes(3)
        })

        it('should maintain stable function references', async () => {
            mockAuthService.getCurrentUser = vi.fn().mockResolvedValue(null)

            const { result, rerender } = renderHook(() => useAuth(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            const { login, logout, refreshUser } = result.current

            // Force re-render
            rerender()

            // Function references should be stable
            expect(result.current.login).toBe(login)
            expect(result.current.logout).toBe(logout)
            expect(result.current.refreshUser).toBe(refreshUser)
        })
    })
})
