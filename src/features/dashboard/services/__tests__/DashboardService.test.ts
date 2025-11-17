import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DashboardService } from '../DashboardService'
import type { IDashboardRepository } from '@domain/interfaces/IDashboardRepository'
import type { ILogger } from '@domain/interfaces/ILogger'
import { DashboardStats } from '@domain/models/DashboardStats'

describe('DashboardService', () => {
    let dashboardService: DashboardService
    let mockDashboardRepository: IDashboardRepository
    let mockLogger: ILogger

    const mockStats = new DashboardStats(
        1247, // totalUsers
        1089, // activeUsers
        23, // pendingEnrollments
        1156, // successfulEnrollments
        68, // failedEnrollments
        98.5, // authSuccessRate
        94.4 // verificationSuccessRate
    )

    beforeEach(() => {
        // Create mock repository
        mockDashboardRepository = {
            getStats: vi.fn(),
        }

        // Create mock logger
        mockLogger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        }

        // Create service instance with mocks
        dashboardService = new DashboardService(mockDashboardRepository, mockLogger)
    })

    describe('getStats', () => {
        it('should get dashboard stats successfully', async () => {
            // Arrange
            vi.mocked(mockDashboardRepository.getStats).mockResolvedValue(mockStats)

            // Act
            const result = await dashboardService.getStats()

            // Assert
            expect(mockDashboardRepository.getStats).toHaveBeenCalled()
            expect(result).toEqual(mockStats)
            expect(mockLogger.info).toHaveBeenCalledWith('Fetching dashboard statistics')
            expect(mockLogger.debug).toHaveBeenCalledWith('Dashboard statistics retrieved successfully', {
                totalUsers: mockStats.totalUsers,
                activeUsers: mockStats.activeUsers,
            })
        })

        it('should handle repository errors and re-throw', async () => {
            // Arrange
            const error = new Error('Database connection failed')
            vi.mocked(mockDashboardRepository.getStats).mockRejectedValue(error)

            // Act & Assert
            await expect(dashboardService.getStats()).rejects.toThrow('Database connection failed')
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to fetch dashboard statistics', error)
        })

        it('should handle network errors', async () => {
            // Arrange
            const error = new Error('Network timeout')
            vi.mocked(mockDashboardRepository.getStats).mockRejectedValue(error)

            // Act & Assert
            await expect(dashboardService.getStats()).rejects.toThrow('Network timeout')
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to fetch dashboard statistics', error)
        })

        it('should return valid stats with all properties', async () => {
            // Arrange
            vi.mocked(mockDashboardRepository.getStats).mockResolvedValue(mockStats)

            // Act
            const result = await dashboardService.getStats()

            // Assert
            expect(result.totalUsers).toBe(1247)
            expect(result.activeUsers).toBe(1089)
            expect(result.pendingEnrollments).toBe(23)
            expect(result.successfulEnrollments).toBe(1156)
            expect(result.failedEnrollments).toBe(68)
            expect(result.authSuccessRate).toBe(98.5)
            expect(result.verificationSuccessRate).toBe(94.4)
        })

        it('should verify computed properties from DashboardStats', async () => {
            // Arrange
            vi.mocked(mockDashboardRepository.getStats).mockResolvedValue(mockStats)

            // Act
            const result = await dashboardService.getStats()

            // Assert - test computed properties
            expect(result.totalEnrollments).toBe(1156 + 68) // successfulEnrollments + failedEnrollments
            expect(result.enrollmentSuccessRate).toBeCloseTo((1156 / 1224) * 100, 1)
            expect(result.activeUserPercentage).toBeCloseTo((1089 / 1247) * 100, 1)
        })
    })
})
