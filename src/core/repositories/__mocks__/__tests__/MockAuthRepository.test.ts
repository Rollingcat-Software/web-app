import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Container } from 'inversify'
import 'reflect-metadata'
import { TYPES } from '@core/di/types'
import { MockAuthRepository } from '../MockAuthRepository'
import { LoggerService } from '@core/services/LoggerService'
import type { IAuthRepository, LoginCredentials } from '@domain/interfaces/IAuthRepository'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { IConfig } from '@domain/interfaces/IConfig'
import { UserRole, UserStatus } from '@domain/models/User'

describe('MockAuthRepository Integration Tests', () => {
    let container: Container
    let authRepository: IAuthRepository
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

        // Bind auth repository
        container.bind<IAuthRepository>(TYPES.AuthRepository).to(MockAuthRepository).inSingletonScope()

        // Get instances
        logger = container.get<ILogger>(TYPES.Logger)
        authRepository = container.get<IAuthRepository>(TYPES.AuthRepository)

        // Spy on logger methods to reduce noise in tests
        vi.spyOn(logger, 'debug').mockImplementation(() => {})
        vi.spyOn(logger, 'info').mockImplementation(() => {})
        vi.spyOn(logger, 'warn').mockImplementation(() => {})
        vi.spyOn(logger, 'error').mockImplementation(() => {})
    })

    describe('login', () => {
        it('should login successfully with valid credentials', async () => {
            // Arrange
            const credentials: LoginCredentials = {
                email: 'admin@fivucsas.com',
                password: 'password123',
            }

            // Act
            const result = await authRepository.login(credentials)

            // Assert
            expect(result).toBeDefined()
            expect(result.accessToken).toBeDefined()
            expect(result.refreshToken).toBeDefined()
            expect(result.expiresIn).toBe(3600)
            expect(result.user).toBeDefined()
            expect(result.user.email).toBe(credentials.email)
        })

        it('should return user with correct properties', async () => {
            // Arrange
            const credentials: LoginCredentials = {
                email: 'user@example.com',
                password: 'password123',
            }

            // Act
            const result = await authRepository.login(credentials)

            // Assert
            expect(result.user.id).toBe(1)
            expect(result.user.email).toBe(credentials.email)
            expect(result.user.firstName).toBe('Admin')
            expect(result.user.lastName).toBe('User')
            expect(result.user.role).toBe(UserRole.ADMIN)
            expect(result.user.status).toBe(UserStatus.ACTIVE)
            expect(result.user.tenantId).toBe(1)
        })

        it('should update lastLoginAt on successful login', async () => {
            // Arrange
            const credentials: LoginCredentials = {
                email: 'test@example.com',
                password: 'password123',
            }

            // Act
            const result = await authRepository.login(credentials)

            // Assert
            expect(result.user.lastLoginAt).toBeInstanceOf(Date)
            expect(result.user.lastLoginAt!.getTime()).toBeLessThanOrEqual(Date.now())
            expect(result.user.lastLoginAt!.getTime()).toBeGreaterThan(Date.now() - 10000) // Within last 10 seconds
        })

        it('should set lastLoginIp to 127.0.0.1', async () => {
            // Arrange
            const credentials: LoginCredentials = {
                email: 'test@example.com',
                password: 'password123',
            }

            // Act
            const result = await authRepository.login(credentials)

            // Assert
            expect(result.user.lastLoginIp).toBe('127.0.0.1')
        })

        it('should throw error with invalid credentials (empty email)', async () => {
            // Arrange
            const credentials: LoginCredentials = {
                email: '',
                password: 'password123',
            }

            // Act & Assert
            await expect(authRepository.login(credentials)).rejects.toThrow('Invalid credentials')
        })

        it('should throw error with invalid credentials (short password)', async () => {
            // Arrange
            const credentials: LoginCredentials = {
                email: 'test@example.com',
                password: '12345', // Less than 6 characters
            }

            // Act & Assert
            await expect(authRepository.login(credentials)).rejects.toThrow('Invalid credentials')
        })

        it('should throw error with password exactly 5 characters', async () => {
            // Arrange
            const credentials: LoginCredentials = {
                email: 'test@example.com',
                password: '12345',
            }

            // Act & Assert
            await expect(authRepository.login(credentials)).rejects.toThrow('Invalid credentials')
        })

        it('should succeed with password exactly 6 characters', async () => {
            // Arrange
            const credentials: LoginCredentials = {
                email: 'test@example.com',
                password: '123456',
            }

            // Act
            const result = await authRepository.login(credentials)

            // Assert
            expect(result).toBeDefined()
            expect(result.accessToken).toBeDefined()
        })

        it('should accept any valid email format', async () => {
            // Arrange
            const credentials: LoginCredentials = {
                email: 'different.user+tag@example.co.uk',
                password: 'password123',
            }

            // Act
            const result = await authRepository.login(credentials)

            // Assert
            expect(result).toBeDefined()
            expect(result.user.email).toBe(credentials.email)
        })

        it('should simulate delay', async () => {
            // Arrange
            const credentials: LoginCredentials = {
                email: 'test@example.com',
                password: 'password123',
            }
            const startTime = Date.now()

            // Act
            await authRepository.login(credentials)

            // Assert - should take at least 500ms
            const elapsed = Date.now() - startTime
            expect(elapsed).toBeGreaterThanOrEqual(480)
        })

        it('should call logger with correct message', async () => {
            // Arrange
            const credentials: LoginCredentials = {
                email: 'test@example.com',
                password: 'password123',
            }

            // Act
            await authRepository.login(credentials)

            // Assert
            expect(logger.info).toHaveBeenCalledWith('Mock login', { email: credentials.email })
        })
    })

    describe('logout', () => {
        it('should logout successfully', async () => {
            // Act & Assert
            await expect(authRepository.logout()).resolves.not.toThrow()
        })

        it('should simulate delay', async () => {
            // Arrange
            const startTime = Date.now()

            // Act
            await authRepository.logout()

            // Assert - should take at least 200ms
            const elapsed = Date.now() - startTime
            expect(elapsed).toBeGreaterThanOrEqual(180)
        })

        it('should call logger with correct message', async () => {
            // Act
            await authRepository.logout()

            // Assert
            expect(logger.info).toHaveBeenCalledWith('Mock logout')
        })
    })

    describe('refresh', () => {
        it('should refresh token successfully', async () => {
            // Arrange
            const refreshToken = 'valid-refresh-token'

            // Act
            const result = await authRepository.refresh(refreshToken)

            // Assert
            expect(result).toBeDefined()
            expect(result.accessToken).toBeDefined()
            expect(result.refreshToken).toBe(refreshToken)
            expect(result.expiresIn).toBe(3600)
            expect(result.user).toBeDefined()
        })

        it('should return same refresh token', async () => {
            // Arrange
            const originalRefreshToken = 'my-refresh-token-12345'

            // Act
            const result = await authRepository.refresh(originalRefreshToken)

            // Assert
            expect(result.refreshToken).toBe(originalRefreshToken)
        })

        it('should generate new access token', async () => {
            // Arrange
            const refreshToken = 'refresh-token'

            // Act
            const result1 = await authRepository.refresh(refreshToken)
            // Wait a bit to ensure different timestamp
            await new Promise((resolve) => setTimeout(resolve, 10))
            const result2 = await authRepository.refresh(refreshToken)

            // Assert - Tokens should be different due to timestamp
            expect(result1.accessToken).not.toBe(result2.accessToken)
        })

        it('should return mock user', async () => {
            // Arrange
            const refreshToken = 'valid-refresh-token'

            // Act
            const result = await authRepository.refresh(refreshToken)

            // Assert
            expect(result.user.id).toBe(1)
            expect(result.user.email).toBe('admin@fivucsas.com')
            expect(result.user.firstName).toBe('Admin')
            expect(result.user.lastName).toBe('User')
            expect(result.user.role).toBe(UserRole.ADMIN)
            expect(result.user.status).toBe(UserStatus.ACTIVE)
        })

        it('should simulate delay', async () => {
            // Arrange
            const refreshToken = 'valid-refresh-token'
            const startTime = Date.now()

            // Act
            await authRepository.refresh(refreshToken)

            // Assert - should take at least 300ms
            const elapsed = Date.now() - startTime
            expect(elapsed).toBeGreaterThanOrEqual(280)
        })

        it('should call logger with correct message', async () => {
            // Arrange
            const refreshToken = 'valid-refresh-token'

            // Act
            await authRepository.refresh(refreshToken)

            // Assert
            expect(logger.info).toHaveBeenCalledWith('Mock token refresh')
        })
    })

    describe('getCurrentUser', () => {
        it('should return current user', async () => {
            // Act
            const user = await authRepository.getCurrentUser()

            // Assert
            expect(user).toBeDefined()
            expect(user.id).toBe(1)
            expect(user.email).toBe('admin@fivucsas.com')
            expect(user.firstName).toBe('Admin')
            expect(user.lastName).toBe('User')
            expect(user.role).toBe(UserRole.ADMIN)
            expect(user.status).toBe(UserStatus.ACTIVE)
            expect(user.tenantId).toBe(1)
        })

        it('should return same user on multiple calls', async () => {
            // Act
            const user1 = await authRepository.getCurrentUser()
            const user2 = await authRepository.getCurrentUser()

            // Assert
            expect(user1.id).toBe(user2.id)
            expect(user1.email).toBe(user2.email)
        })

        it('should simulate delay', async () => {
            // Arrange
            const startTime = Date.now()

            // Act
            await authRepository.getCurrentUser()

            // Assert - should take at least 200ms
            const elapsed = Date.now() - startTime
            expect(elapsed).toBeGreaterThanOrEqual(180)
        })

        it('should call logger with correct message', async () => {
            // Act
            await authRepository.getCurrentUser()

            // Assert
            expect(logger.debug).toHaveBeenCalledWith('Mock get current user')
        })
    })

    describe('Token Generation', () => {
        it('should generate valid JWT-like access token', async () => {
            // Arrange
            const credentials: LoginCredentials = {
                email: 'test@example.com',
                password: 'password123',
            }

            // Act
            const result = await authRepository.login(credentials)

            // Assert
            const tokenParts = result.accessToken.split('.')
            expect(tokenParts).toHaveLength(3) // header.payload.signature
        })

        it('should generate valid JWT-like refresh token', async () => {
            // Arrange
            const credentials: LoginCredentials = {
                email: 'test@example.com',
                password: 'password123',
            }

            // Act
            const result = await authRepository.login(credentials)

            // Assert
            const tokenParts = result.refreshToken.split('.')
            expect(tokenParts).toHaveLength(3) // header.payload.signature
        })

        it('should include JWT header in access token', async () => {
            // Arrange
            const credentials: LoginCredentials = {
                email: 'test@example.com',
                password: 'password123',
            }

            // Act
            const result = await authRepository.login(credentials)

            // Assert
            const header = JSON.parse(atob(result.accessToken.split('.')[0]))
            expect(header.alg).toBe('HS256')
            expect(header.typ).toBe('JWT')
        })

        it('should include user info in access token payload', async () => {
            // Arrange
            const credentials: LoginCredentials = {
                email: 'test@example.com',
                password: 'password123',
            }

            // Act
            const result = await authRepository.login(credentials)

            // Assert
            const payload = JSON.parse(atob(result.accessToken.split('.')[1]))
            expect(payload.sub).toBe('1')
            expect(payload.email).toBe('admin@fivucsas.com')
            expect(payload.role).toBe(UserRole.ADMIN)
            expect(payload.type).toBe('access')
            expect(payload.exp).toBeDefined()
            expect(payload.iat).toBeDefined()
        })

        it('should mark refresh token correctly in payload', async () => {
            // Arrange
            const credentials: LoginCredentials = {
                email: 'test@example.com',
                password: 'password123',
            }

            // Act
            const result = await authRepository.login(credentials)

            // Assert
            const payload = JSON.parse(atob(result.refreshToken.split('.')[1]))
            expect(payload.type).toBe('refresh')
        })

        it('should set token expiration time', async () => {
            // Arrange
            const credentials: LoginCredentials = {
                email: 'test@example.com',
                password: 'password123',
            }

            // Act
            const result = await authRepository.login(credentials)

            // Assert
            const payload = JSON.parse(atob(result.accessToken.split('.')[1]))
            const now = Math.floor(Date.now() / 1000)
            expect(payload.exp).toBeGreaterThan(now)
            expect(payload.exp).toBeLessThanOrEqual(now + 3600)
        })

        it('should set issued at time', async () => {
            // Arrange
            const credentials: LoginCredentials = {
                email: 'test@example.com',
                password: 'password123',
            }

            // Act
            const result = await authRepository.login(credentials)

            // Assert
            const payload = JSON.parse(atob(result.accessToken.split('.')[1]))
            const now = Math.floor(Date.now() / 1000)
            expect(payload.iat).toBeLessThanOrEqual(now)
            expect(payload.iat).toBeGreaterThan(now - 10) // Within last 10 seconds
        })

        it('should generate different tokens on different login calls', async () => {
            // Arrange
            const credentials: LoginCredentials = {
                email: 'test@example.com',
                password: 'password123',
            }

            // Act
            const result1 = await authRepository.login(credentials)
            await new Promise((resolve) => setTimeout(resolve, 10)) // Small delay
            const result2 = await authRepository.login(credentials)

            // Assert
            expect(result1.accessToken).not.toBe(result2.accessToken)
            expect(result1.refreshToken).not.toBe(result2.refreshToken)
        })

        it('should include signature in token', async () => {
            // Arrange
            const credentials: LoginCredentials = {
                email: 'test@example.com',
                password: 'password123',
            }

            // Act
            const result = await authRepository.login(credentials)

            // Assert
            const signature = result.accessToken.split('.')[2]
            expect(signature).toBeDefined()
            expect(signature.length).toBeGreaterThan(0)
            expect(atob(signature)).toContain('mock-signature')
        })
    })

    describe('Integration Flow', () => {
        it('should support complete login-logout flow', async () => {
            // Arrange
            const credentials: LoginCredentials = {
                email: 'test@example.com',
                password: 'password123',
            }

            // Act & Assert
            const loginResult = await authRepository.login(credentials)
            expect(loginResult.accessToken).toBeDefined()

            await expect(authRepository.logout()).resolves.not.toThrow()
        })

        it('should support login-refresh-logout flow', async () => {
            // Arrange
            const credentials: LoginCredentials = {
                email: 'test@example.com',
                password: 'password123',
            }

            // Act & Assert
            const loginResult = await authRepository.login(credentials)
            expect(loginResult.refreshToken).toBeDefined()

            const refreshResult = await authRepository.refresh(loginResult.refreshToken)
            expect(refreshResult.accessToken).toBeDefined()
            expect(refreshResult.refreshToken).toBe(loginResult.refreshToken)

            await expect(authRepository.logout()).resolves.not.toThrow()
        })

        it('should support login-getCurrentUser flow', async () => {
            // Arrange
            const credentials: LoginCredentials = {
                email: 'test@example.com',
                password: 'password123',
            }

            // Act
            const loginResult = await authRepository.login(credentials)
            const currentUser = await authRepository.getCurrentUser()

            // Assert
            expect(currentUser.id).toBe(loginResult.user.id)
            expect(currentUser.email).toBe('admin@fivucsas.com')
        })
    })
})
