import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { IDashboardRepository } from '@domain/interfaces/IDashboardRepository'
import { DashboardStats } from '@domain/models/DashboardStats'

/**
 * Mock Dashboard Repository
 * Provides fake dashboard statistics for development/testing
 */
@injectable()
export class MockDashboardRepository implements IDashboardRepository {
    private readonly mockStats: DashboardStats

    constructor(@inject(TYPES.Logger) private readonly logger: ILogger) {
        // Initialize with mock statistics
        this.mockStats = new DashboardStats(
            1247, // totalUsers
            1089, // activeUsers
            23, // pendingEnrollments
            1156, // successfulEnrollments
            68, // failedEnrollments
            98.5, // authSuccessRate
            94.4 // verificationSuccessRate
        )
    }

    async getStats(): Promise<DashboardStats> {
        this.logger.debug('Mock: Fetching dashboard statistics')
        await this.delay(300)

        return this.mockStats
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }
}
