import { injectable } from 'inversify'
import type { IDashboardRepository } from '@domain/interfaces/IDashboardRepository'
import { DashboardStats } from '@domain/models/DashboardStats'

@injectable()
export class MockDashboardRepository implements IDashboardRepository {
    async getStats(): Promise<DashboardStats> {
        return new DashboardStats(
            100,
            85,
            10,
            5,
            70,
            500,
            3,
            8,
            72,
            4,
            95.5,
            92.3
        )
    }
}
