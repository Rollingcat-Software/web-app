import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { DevbenchExportFormat, IDevbenchRepository } from '@domain/interfaces/IDevbenchRepository'

@injectable()
export class DevbenchRepository implements IDevbenchRepository {
    constructor(@inject(TYPES.HttpClient) private readonly httpClient: IHttpClient) {}

    async submitRun(run: object): Promise<string> {
        const response = await this.httpClient.post<{ id: string }>('/devbench/runs', run)
        return response.data.id
    }

    async exportRuns(format: DevbenchExportFormat): Promise<string> {
        const response = await this.httpClient.get<string>('/admin/devbench/runs', {
            params: { format },
            responseType: 'text',
        })
        return response.data
    }
}
