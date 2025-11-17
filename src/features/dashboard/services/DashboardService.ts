import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { IDashboardService } from '@domain/interfaces/IDashboardService'
import type { IDashboardRepository } from '@domain/interfaces/IDashboardRepository'
import type { ILogger } from '@domain/interfaces/ILogger'
import { DashboardStats } from '@domain/models/DashboardStats'

/**
 * Dashboard Service
 * Handles dashboard business logic
 */
@injectable()
export class DashboardService implements IDashboardService {
    constructor(
        @inject(TYPES.DashboardRepository)
        private readonly dashboardRepository: IDashboardRepository,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    /**
     * Get dashboard statistics
     */
    async getStats(): Promise<DashboardStats> {
        this.logger.info('Fetching dashboard statistics')

        try {
            const stats = await this.dashboardRepository.getStats()

            this.logger.debug('Dashboard statistics retrieved successfully', {
                totalUsers: stats.totalUsers,
                activeUsers: stats.activeUsers,
            })

            return stats
        } catch (error) {
            this.logger.error('Failed to fetch dashboard statistics', error)
            throw error
        }
    }
}
