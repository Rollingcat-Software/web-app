import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Container } from 'inversify'
import 'reflect-metadata'
import { TYPES } from '@core/di/types'
import { MockDashboardRepository } from '../MockDashboardRepository'
import { LoggerService } from '@core/services/LoggerService'
import type { IDashboardRepository } from '@domain/interfaces/IDashboardRepository'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { IConfig } from '@domain/interfaces/IConfig'
import { DashboardStats } from '@domain/models/DashboardStats'

describe('MockDashboardRepository Integration Tests', () => {
    let container: Container
    let dashboardRepository: IDashboardRepository
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

        // Bind dashboard repository
        container.bind<IDashboardRepository>(TYPES.DashboardRepository).to(MockDashboardRepository).inSingletonScope()

        // Get instances
        logger = container.get<ILogger>(TYPES.Logger)
        dashboardRepository = container.get<IDashboardRepository>(TYPES.DashboardRepository)

        // Spy on logger methods to reduce noise in tests
        vi.spyOn(logger, 'debug').mockImplementation(() => {})
        vi.spyOn(logger, 'info').mockImplementation(() => {})
        vi.spyOn(logger, 'warn').mockImplementation(() => {})
        vi.spyOn(logger, 'error').mockImplementation(() => {})
    })

    describe('getStats', () => {
        it('should return dashboard statistics', async () => {
            // Act
            const stats = await dashboardRepository.getStats()

            // Assert
            expect(stats).toBeDefined()
            expect(stats).toBeInstanceOf(DashboardStats)
        })

        it('should return correct totalUsers', async () => {
            // Act
            const stats = await dashboardRepository.getStats()

            // Assert
            expect(stats.totalUsers).toBe(1247)
        })

        it('should return correct activeUsers', async () => {
            // Act
            const stats = await dashboardRepository.getStats()

            // Assert
            expect(stats.activeUsers).toBe(1089)
        })

        it('should return correct pendingEnrollments', async () => {
            // Act
            const stats = await dashboardRepository.getStats()

            // Assert
            expect(stats.pendingEnrollments).toBe(23)
        })

        it('should return correct successfulEnrollments', async () => {
            // Act
            const stats = await dashboardRepository.getStats()

            // Assert
            expect(stats.successfulEnrollments).toBe(1156)
        })

        it('should return correct failedEnrollments', async () => {
            // Act
            const stats = await dashboardRepository.getStats()

            // Assert
            expect(stats.failedEnrollments).toBe(68)
        })

        it('should return correct authSuccessRate', async () => {
            // Act
            const stats = await dashboardRepository.getStats()

            // Assert
            expect(stats.authSuccessRate).toBe(98.5)
        })

        it('should return correct verificationSuccessRate', async () => {
            // Act
            const stats = await dashboardRepository.getStats()

            // Assert
            expect(stats.verificationSuccessRate).toBe(94.4)
        })

        it('should simulate delay', async () => {
            // Arrange
            const startTime = Date.now()

            // Act
            await dashboardRepository.getStats()

            // Assert - should take at least 300ms
            const elapsed = Date.now() - startTime
            expect(elapsed).toBeGreaterThanOrEqual(280)
        })

        it('should call logger with correct message', async () => {
            // Act
            await dashboardRepository.getStats()

            // Assert
            expect(logger.debug).toHaveBeenCalledWith('Mock: Fetching dashboard statistics')
        })
    })

    describe('Stats Structure', () => {
        it('should have all required properties', async () => {
            // Act
            const stats = await dashboardRepository.getStats()

            // Assert
            expect(stats).toHaveProperty('totalUsers')
            expect(stats).toHaveProperty('activeUsers')
            expect(stats).toHaveProperty('pendingEnrollments')
            expect(stats).toHaveProperty('successfulEnrollments')
            expect(stats).toHaveProperty('failedEnrollments')
            expect(stats).toHaveProperty('authSuccessRate')
            expect(stats).toHaveProperty('verificationSuccessRate')
        })

        it('should have numeric values for all properties', async () => {
            // Act
            const stats = await dashboardRepository.getStats()

            // Assert
            expect(typeof stats.totalUsers).toBe('number')
            expect(typeof stats.activeUsers).toBe('number')
            expect(typeof stats.pendingEnrollments).toBe('number')
            expect(typeof stats.successfulEnrollments).toBe('number')
            expect(typeof stats.failedEnrollments).toBe('number')
            expect(typeof stats.authSuccessRate).toBe('number')
            expect(typeof stats.verificationSuccessRate).toBe('number')
        })

        it('should have non-negative values', async () => {
            // Act
            const stats = await dashboardRepository.getStats()

            // Assert
            expect(stats.totalUsers).toBeGreaterThanOrEqual(0)
            expect(stats.activeUsers).toBeGreaterThanOrEqual(0)
            expect(stats.pendingEnrollments).toBeGreaterThanOrEqual(0)
            expect(stats.successfulEnrollments).toBeGreaterThanOrEqual(0)
            expect(stats.failedEnrollments).toBeGreaterThanOrEqual(0)
            expect(stats.authSuccessRate).toBeGreaterThanOrEqual(0)
            expect(stats.verificationSuccessRate).toBeGreaterThanOrEqual(0)
        })

        it('should have activeUsers less than or equal to totalUsers', async () => {
            // Act
            const stats = await dashboardRepository.getStats()

            // Assert
            expect(stats.activeUsers).toBeLessThanOrEqual(stats.totalUsers)
        })

        it('should have success rates as percentages (0-100)', async () => {
            // Act
            const stats = await dashboardRepository.getStats()

            // Assert
            expect(stats.authSuccessRate).toBeGreaterThanOrEqual(0)
            expect(stats.authSuccessRate).toBeLessThanOrEqual(100)
            expect(stats.verificationSuccessRate).toBeGreaterThanOrEqual(0)
            expect(stats.verificationSuccessRate).toBeLessThanOrEqual(100)
        })
    })

    describe('Computed Properties', () => {
        it('should calculate totalEnrollments correctly', async () => {
            // Act
            const stats = await dashboardRepository.getStats()

            // Assert
            expect(stats.totalEnrollments).toBe(stats.successfulEnrollments + stats.failedEnrollments)
            expect(stats.totalEnrollments).toBe(1224) // 1156 + 68
        })

        it('should calculate enrollmentSuccessRate correctly', async () => {
            // Act
            const stats = await dashboardRepository.getStats()

            // Assert
            const expectedRate = (stats.successfulEnrollments / stats.totalEnrollments) * 100
            expect(stats.enrollmentSuccessRate).toBeCloseTo(expectedRate, 2)
            expect(stats.enrollmentSuccessRate).toBeCloseTo(94.44, 2) // 1156 / 1224 * 100
        })

        it('should calculate activeUserPercentage correctly', async () => {
            // Act
            const stats = await dashboardRepository.getStats()

            // Assert
            const expectedPercentage = (stats.activeUsers / stats.totalUsers) * 100
            expect(stats.activeUserPercentage).toBeCloseTo(expectedPercentage, 2)
            expect(stats.activeUserPercentage).toBeCloseTo(87.33, 2) // 1089 / 1247 * 100
        })
    })

    describe('Data Consistency', () => {
        it('should return same stats on multiple calls', async () => {
            // Act
            const stats1 = await dashboardRepository.getStats()
            const stats2 = await dashboardRepository.getStats()

            // Assert
            expect(stats1.totalUsers).toBe(stats2.totalUsers)
            expect(stats1.activeUsers).toBe(stats2.activeUsers)
            expect(stats1.pendingEnrollments).toBe(stats2.pendingEnrollments)
            expect(stats1.successfulEnrollments).toBe(stats2.successfulEnrollments)
            expect(stats1.failedEnrollments).toBe(stats2.failedEnrollments)
            expect(stats1.authSuccessRate).toBe(stats2.authSuccessRate)
            expect(stats1.verificationSuccessRate).toBe(stats2.verificationSuccessRate)
        })

        it('should return consistent DashboardStats instances', async () => {
            // Act
            const stats1 = await dashboardRepository.getStats()
            const stats2 = await dashboardRepository.getStats()

            // Assert
            expect(stats1).toBeInstanceOf(DashboardStats)
            expect(stats2).toBeInstanceOf(DashboardStats)
            expect(stats1.totalEnrollments).toBe(stats2.totalEnrollments)
            expect(stats1.enrollmentSuccessRate).toBe(stats2.enrollmentSuccessRate)
            expect(stats1.activeUserPercentage).toBe(stats2.activeUserPercentage)
        })
    })

    describe('Realistic Mock Data', () => {
        it('should have realistic user counts', async () => {
            // Act
            const stats = await dashboardRepository.getStats()

            // Assert
            expect(stats.totalUsers).toBeGreaterThan(1000)
            expect(stats.activeUsers).toBeGreaterThan(1000)
            expect(stats.totalUsers).toBeLessThan(2000)
        })

        it('should have realistic enrollment counts', async () => {
            // Act
            const stats = await dashboardRepository.getStats()

            // Assert
            expect(stats.successfulEnrollments).toBeGreaterThan(1000)
            expect(stats.failedEnrollments).toBeGreaterThan(0)
            expect(stats.pendingEnrollments).toBeGreaterThan(0)
        })

        it('should have high auth success rate', async () => {
            // Act
            const stats = await dashboardRepository.getStats()

            // Assert
            expect(stats.authSuccessRate).toBeGreaterThan(90)
        })

        it('should have high verification success rate', async () => {
            // Act
            const stats = await dashboardRepository.getStats()

            // Assert
            expect(stats.verificationSuccessRate).toBeGreaterThan(90)
        })

        it('should have high enrollment success rate', async () => {
            // Act
            const stats = await dashboardRepository.getStats()

            // Assert
            expect(stats.enrollmentSuccessRate).toBeGreaterThan(90)
        })
    })

    describe('Performance', () => {
        it('should complete request within reasonable time', async () => {
            // Arrange
            const startTime = Date.now()

            // Act
            await dashboardRepository.getStats()

            // Assert - should complete within 500ms
            const elapsed = Date.now() - startTime
            expect(elapsed).toBeLessThan(500)
        })

        it('should handle multiple concurrent requests', async () => {
            // Act
            const results = await Promise.all([
                dashboardRepository.getStats(),
                dashboardRepository.getStats(),
                dashboardRepository.getStats(),
            ])

            // Assert
            expect(results).toHaveLength(3)
            expect(results[0].totalUsers).toBe(1247)
            expect(results[1].totalUsers).toBe(1247)
            expect(results[2].totalUsers).toBe(1247)
        })
    })

    describe('DashboardStats Model Integration', () => {
        it('should work with DashboardStats.fromJSON', async () => {
            // Act
            const stats = await dashboardRepository.getStats()
            const json = {
                totalUsers: stats.totalUsers,
                activeUsers: stats.activeUsers,
                pendingEnrollments: stats.pendingEnrollments,
                successfulEnrollments: stats.successfulEnrollments,
                failedEnrollments: stats.failedEnrollments,
                authSuccessRate: stats.authSuccessRate,
                verificationSuccessRate: stats.verificationSuccessRate,
            }
            const recreated = DashboardStats.fromJSON(json)

            // Assert
            expect(recreated).toBeInstanceOf(DashboardStats)
            expect(recreated.totalUsers).toBe(stats.totalUsers)
            expect(recreated.activeUsers).toBe(stats.activeUsers)
            expect(recreated.totalEnrollments).toBe(stats.totalEnrollments)
        })

        it('should support getter methods', async () => {
            // Act
            const stats = await dashboardRepository.getStats()

            // Assert - Verify getters work correctly
            expect(stats.totalEnrollments).toBeDefined()
            expect(stats.enrollmentSuccessRate).toBeDefined()
            expect(stats.activeUserPercentage).toBeDefined()
            expect(typeof stats.totalEnrollments).toBe('number')
            expect(typeof stats.enrollmentSuccessRate).toBe('number')
            expect(typeof stats.activeUserPercentage).toBe('number')
        })
    })

    describe('Repository Contract Compliance', () => {
        it('should implement IDashboardRepository interface', async () => {
            // Assert
            expect(dashboardRepository.getStats).toBeDefined()
            expect(typeof dashboardRepository.getStats).toBe('function')
        })

        it('should return Promise from getStats', async () => {
            // Act
            const result = dashboardRepository.getStats()

            // Assert
            expect(result).toBeInstanceOf(Promise)
            await result // Ensure promise resolves
        })

        it('should be injectable via dependency injection', () => {
            // Act
            const repo1 = container.get<IDashboardRepository>(TYPES.DashboardRepository)
            const repo2 = container.get<IDashboardRepository>(TYPES.DashboardRepository)

            // Assert - Should be singleton
            expect(repo1).toBe(repo2)
        })
    })

    describe('Edge Cases', () => {
        it('should handle rapid successive calls', async () => {
            // Act
            const promises = []
            for (let i = 0; i < 10; i++) {
                promises.push(dashboardRepository.getStats())
            }
            const results = await Promise.all(promises)

            // Assert
            expect(results).toHaveLength(10)
            results.forEach((stats) => {
                expect(stats.totalUsers).toBe(1247)
                expect(stats.activeUsers).toBe(1089)
            })
        })

        it('should maintain data integrity across container lifecycle', async () => {
            // Act
            const stats1 = await dashboardRepository.getStats()

            // Create new repository instance from same container
            const repo2 = container.get<IDashboardRepository>(TYPES.DashboardRepository)
            const stats2 = await repo2.getStats()

            // Assert - Should be same instance (singleton)
            expect(dashboardRepository).toBe(repo2)
            expect(stats1.totalUsers).toBe(stats2.totalUsers)
        })
    })
})
