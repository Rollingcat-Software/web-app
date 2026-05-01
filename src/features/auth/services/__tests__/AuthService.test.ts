import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthService } from '../AuthService'
import type { IAuthRepository, LoginCredentials, AuthResponse } from '@domain/interfaces/IAuthRepository'
import type { ITokenService } from '@domain/interfaces/ITokenService'
import type { ILogger } from '@domain/interfaces/ILogger'
import { User, UserRole, UserStatus } from '@domain/models/User'
import { UnauthorizedError } from '@core/errors'
import { ZodError } from 'zod'

describe('AuthService', () => {
    let authService: AuthService
    let mockAuthRepository: IAuthRepository
    let mockTokenService: ITokenService
    let mockLogger: ILogger

    const mockUser = new User(
        1,
        'test@example.com',
        'Test',
        'User',
        UserRole.USER,
        UserStatus.ACTIVE,
        1,
        new Date(),
        new Date()
    )

    const mockAuthResponse: AuthResponse = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: mockUser,
        expiresIn: 3600,
    }

    beforeEach(() => {
        // Create mock repository
        mockAuthRepository = {
            login: vi.fn(),
            logout: vi.fn(),
            refresh: vi.fn(),
            getCurrentUser: vi.fn(),
        }

        // Create mock token service
        mockTokenService = {
            storeTokens: vi.fn(),
            getAccessToken: vi.fn(),
            getRefreshToken: vi.fn(),
            clearTokens: vi.fn(),
            isAuthenticated: vi.fn(),
            getExpirationTime: vi.fn(),
            isTokenExpired: vi.fn(),
            shouldRefresh: vi.fn(),
        }

        // Create mock logger
        mockLogger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        }

        // Create service instance with mocks
        authService = new AuthService(mockAuthRepository, mockTokenService, mockLogger)
    })

    describe('login', () => {
        const validCredentials: LoginCredentials = {
            email: 'test@example.com',
            password: 'password123',
        }

        it('should login successfully with valid credentials', async () => {
            // Arrange
            vi.mocked(mockAuthRepository.login).mockResolvedValue(mockAuthResponse)
            vi.mocked(mockTokenService.storeTokens).mockResolvedValue(undefined)

            // Act
            const result = await authService.login(validCredentials)

            // Assert
            expect(mockAuthRepository.login).toHaveBeenCalledWith(validCredentials)
            expect(mockTokenService.storeTokens).toHaveBeenCalledWith({
                accessToken: 'mock-access-token',
                refreshToken: 'mock-refresh-token',
            })
            expect(result.user).toEqual(mockUser)
            expect(result.expiresAt).toBeInstanceOf(Date)
            expect(mockLogger.info).toHaveBeenCalledWith('User logged in successfully', {
                userId: mockUser.id,
                email: mockUser.email,
            })
        })

        it('should throw ValidationError for invalid email', async () => {
            // Arrange
            const invalidCredentials: LoginCredentials = {
                email: 'invalid-email',
                password: 'password123',
            }

            // Act & Assert
            await expect(authService.login(invalidCredentials)).rejects.toThrow(ZodError)
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Login validation failed',
                expect.objectContaining({ errors: expect.any(Object) })
            )
            expect(mockAuthRepository.login).not.toHaveBeenCalled()
        })

        it('should throw ValidationError for missing email', async () => {
            // Arrange
            const invalidCredentials: LoginCredentials = {
                email: '',
                password: 'password123',
            }

            // Act & Assert
            await expect(authService.login(invalidCredentials)).rejects.toThrow(ZodError)
            expect(mockAuthRepository.login).not.toHaveBeenCalled()
        })

        it('should throw ValidationError for missing password', async () => {
            // Arrange
            const invalidCredentials: LoginCredentials = {
                email: 'test@example.com',
                password: '',
            }

            // Act & Assert
            await expect(authService.login(invalidCredentials)).rejects.toThrow(ZodError)
            expect(mockAuthRepository.login).not.toHaveBeenCalled()
        })

        it('should throw ValidationError for short password', async () => {
            // Arrange
            const invalidCredentials: LoginCredentials = {
                email: 'test@example.com',
                password: '12345', // Less than 6 characters
            }

            // Act & Assert
            await expect(authService.login(invalidCredentials)).rejects.toThrow(ZodError)
            expect(mockAuthRepository.login).not.toHaveBeenCalled()
        })

        it('should re-throw the original axios 401 error untouched (USER-BUG-6)', async () => {
            // The earlier wrapper that converted any Error whose message
            // contained "401" into a fresh `UnauthorizedError('Invalid email
            // or password')` stripped the axios `response` property, which
            // `formatApiError(err, t)` needs to localize the message. The
            // result was `errors.unknown` ("Beklenmeyen bir hata oluştu") on
            // every wrong-password attempt. We now re-throw the original.
            // Arrange
            const axios401 = Object.assign(new Error('Request failed with status code 401'), {
                response: {
                    status: 401,
                    data: { error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
                },
                config: { url: '/auth/login' },
            })
            vi.mocked(mockAuthRepository.login).mockRejectedValue(axios401)

            // Act & Assert — the SAME object instance must propagate, so the
            // response/config payload survives for downstream formatters.
            await expect(authService.login(validCredentials)).rejects.toBe(axios401)
            expect(mockLogger.error).toHaveBeenCalledWith('Login failed', axios401)
        })

        it('should re-throw other errors from repository', async () => {
            // Arrange
            const error = new Error('Network error')
            vi.mocked(mockAuthRepository.login).mockRejectedValue(error)

            // Act & Assert
            await expect(authService.login(validCredentials)).rejects.toThrow('Network error')
            expect(mockLogger.error).toHaveBeenCalledWith('Login failed', error)
        })
    })

    describe('logout', () => {
        it('should logout successfully and clear tokens', async () => {
            // Arrange
            vi.mocked(mockAuthRepository.logout).mockResolvedValue(undefined)
            vi.mocked(mockTokenService.clearTokens).mockResolvedValue(undefined)

            // Act
            await authService.logout()

            // Assert
            expect(mockAuthRepository.logout).toHaveBeenCalled()
            expect(mockTokenService.clearTokens).toHaveBeenCalled()
            expect(mockLogger.info).toHaveBeenCalledWith('User logged out')
        })

        it('should clear tokens even when repository logout fails', async () => {
            // Arrange
            const error = new Error('Network error')
            vi.mocked(mockAuthRepository.logout).mockRejectedValue(error)
            vi.mocked(mockTokenService.clearTokens).mockResolvedValue(undefined)

            // Act
            await authService.logout()

            // Assert
            expect(mockLogger.warn).toHaveBeenCalledWith('Logout API call failed', error)
            expect(mockTokenService.clearTokens).toHaveBeenCalled()
            expect(mockLogger.info).toHaveBeenCalledWith('User logged out')
        })
    })

    describe('refreshToken', () => {
        it('should refresh token successfully', async () => {
            // Arrange
            const refreshToken = 'old-refresh-token'
            const newAuthResponse: AuthResponse = {
                ...mockAuthResponse,
                accessToken: 'new-access-token',
                refreshToken: 'new-refresh-token',
            }

            vi.mocked(mockTokenService.getRefreshToken).mockResolvedValue(refreshToken)
            vi.mocked(mockAuthRepository.refresh).mockResolvedValue(newAuthResponse)
            vi.mocked(mockTokenService.storeTokens).mockResolvedValue(undefined)

            // Act
            await authService.refreshToken()

            // Assert
            expect(mockTokenService.getRefreshToken).toHaveBeenCalled()
            expect(mockAuthRepository.refresh).toHaveBeenCalledWith(refreshToken)
            expect(mockTokenService.storeTokens).toHaveBeenCalledWith({
                accessToken: 'new-access-token',
                refreshToken: 'new-refresh-token',
            })
            expect(mockLogger.info).toHaveBeenCalledWith('Token refreshed successfully')
        })

        it('should throw UnauthorizedError when no refresh token available', async () => {
            // Arrange
            vi.mocked(mockTokenService.getRefreshToken).mockResolvedValue(null)

            // Act & Assert
            await expect(authService.refreshToken()).rejects.toThrow(UnauthorizedError)
            await expect(authService.refreshToken()).rejects.toThrow('No refresh token available')
            expect(mockAuthRepository.refresh).not.toHaveBeenCalled()
        })

        it('should clear tokens and throw UnauthorizedError when refresh fails', async () => {
            // Arrange
            const refreshToken = 'expired-refresh-token'
            const error = new Error('Refresh failed')

            vi.mocked(mockTokenService.getRefreshToken).mockResolvedValue(refreshToken)
            vi.mocked(mockAuthRepository.refresh).mockRejectedValue(error)
            vi.mocked(mockTokenService.clearTokens).mockResolvedValue(undefined)

            // Act & Assert
            await expect(authService.refreshToken()).rejects.toThrow(UnauthorizedError)
            await expect(authService.refreshToken()).rejects.toThrow('Session expired. Please login again.')
            expect(mockLogger.error).toHaveBeenCalledWith('Token refresh failed', error)
            expect(mockTokenService.clearTokens).toHaveBeenCalled()
        })
    })

    describe('getCurrentUser', () => {
        it('should return user when authenticated', async () => {
            // Arrange
            vi.mocked(mockTokenService.isAuthenticated).mockResolvedValue(true)
            vi.mocked(mockAuthRepository.getCurrentUser).mockResolvedValue(mockUser)

            // Act
            const result = await authService.getCurrentUser()

            // Assert
            expect(result).toEqual(mockUser)
            expect(mockTokenService.isAuthenticated).toHaveBeenCalled()
            expect(mockAuthRepository.getCurrentUser).toHaveBeenCalled()
        })

        it('should return null when not authenticated', async () => {
            // Arrange
            vi.mocked(mockTokenService.isAuthenticated).mockResolvedValue(false)

            // Act
            const result = await authService.getCurrentUser()

            // Assert
            expect(result).toBeNull()
            expect(mockAuthRepository.getCurrentUser).not.toHaveBeenCalled()
        })

        it('should return null and clear tokens when getCurrentUser fails', async () => {
            // Arrange
            const error = new Error('Failed to get user')
            vi.mocked(mockTokenService.isAuthenticated).mockResolvedValue(true)
            vi.mocked(mockAuthRepository.getCurrentUser).mockRejectedValue(error)
            vi.mocked(mockTokenService.clearTokens).mockResolvedValue(undefined)

            // Act
            const result = await authService.getCurrentUser()

            // Assert
            expect(result).toBeNull()
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to get current user', error)
            expect(mockTokenService.clearTokens).toHaveBeenCalled()
        })
    })

    describe('isAuthenticated', () => {
        it('should return true when token service reports authenticated', async () => {
            // Arrange
            vi.mocked(mockTokenService.isAuthenticated).mockResolvedValue(true)

            // Act
            const result = await authService.isAuthenticated()

            // Assert
            expect(result).toBe(true)
            expect(mockTokenService.isAuthenticated).toHaveBeenCalled()
        })

        it('should return false when token service reports not authenticated', async () => {
            // Arrange
            vi.mocked(mockTokenService.isAuthenticated).mockResolvedValue(false)

            // Act
            const result = await authService.isAuthenticated()

            // Assert
            expect(result).toBe(false)
            expect(mockTokenService.isAuthenticated).toHaveBeenCalled()
        })
    })
})
