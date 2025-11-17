import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { IDashboardRepository } from '@domain/interfaces/IDashboardRepository'
import { DashboardStats } from '@domain/models/DashboardStats'

/**
 * Dashboard Repository
 * Fetches dashboard statistics from the API
 */
@injectable()
export class DashboardRepository implements IDashboardRepository {
    constructor(
        @inject(TYPES.HttpClient) private readonly httpClient: IHttpClient,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    async getStats(): Promise<DashboardStats> {
        this.logger.debug('Fetching dashboard statistics from API')

        const response = await this.httpClient.get<any>('/statistics')

        return DashboardStats.fromJSON(response.data)
    }
}
