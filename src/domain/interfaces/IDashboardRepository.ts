import { DashboardStats } from '@domain/models/DashboardStats'

/**
 * Dashboard Repository Interface
 * Handles fetching dashboard statistics
 */
export interface IDashboardRepository {
    /**
     * Get dashboard statistics
     */
    getStats(): Promise<DashboardStats>
}
