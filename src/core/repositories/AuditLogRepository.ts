import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { IAuditLogRepository } from '@domain/interfaces/IAuditLogRepository'
import type { PaginatedResult, QueryParams } from '@domain/interfaces/IRepository'
import { AuditLog } from '@domain/models/AuditLog'

/**
 * AuditLog Repository
 * Handles audit log API calls
 */
@injectable()
export class AuditLogRepository implements IAuditLogRepository {
    constructor(
        @inject(TYPES.HttpClient) private readonly httpClient: IHttpClient,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    /**
     * Find all audit logs
     */
    async findAll(params?: QueryParams): Promise<PaginatedResult<AuditLog>> {
        try {
            this.logger.debug('Fetching all audit logs', { params })

            const response = await this.httpClient.get<any>('/audit-logs', {
                params: params as Record<string, unknown>,
            })

            // Handle both array and paginated response formats
            let auditLogs: AuditLog[]
            let total: number

            if (Array.isArray(response.data)) {
                // Backend returns array
                auditLogs = response.data.map((data) => AuditLog.fromJSON(data))
                total = auditLogs.length
            } else if (response.data.content) {
                // Backend returns paginated response with 'content' field
                auditLogs = response.data.content.map((data: any) => AuditLog.fromJSON(data))
                total = response.data.totalElements || auditLogs.length
            } else if (response.data.items) {
                // Backend returns paginated response with 'items' field
                auditLogs = response.data.items.map((data: any) => AuditLog.fromJSON(data))
                total = response.data.total || auditLogs.length
            } else {
                // Fallback: treat response.data as array
                auditLogs = [AuditLog.fromJSON(response.data)]
                total = 1
            }

            const pageSize = params?.pageSize || 20
            const page = params?.page || 0

            return {
                items: auditLogs,
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
            }
        } catch (error) {
            this.logger.error('Failed to fetch audit logs', error)
            throw error
        }
    }

    /**
     * Find audit log by ID
     */
    async findById(id: number): Promise<AuditLog | null> {
        try {
            this.logger.debug(`Fetching audit log ${id}`)

            const response = await this.httpClient.get<any>(`/audit-logs/${id}`)

            return AuditLog.fromJSON(response.data)
        } catch (error: any) {
            if (error.response?.status === 404) {
                return null
            }
            this.logger.error(`Failed to fetch audit log ${id}`, error)
            throw error
        }
    }
}
