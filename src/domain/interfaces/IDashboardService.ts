import { DashboardStats } from '@domain/models/DashboardStats'

/**
 * Dashboard Service Interface
 * Business logic for dashboard operations
 */
export interface IDashboardService {
    /**
     * Get dashboard statistics
     */
    getStats(): Promise<DashboardStats>
}
