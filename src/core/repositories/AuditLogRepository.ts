import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { IAuditLogRepository } from '@domain/interfaces/IAuditLogRepository'
import type { PaginatedResult, QueryParams } from '@domain/interfaces/IRepository'
import { AuditLog, AuditLogJSON } from '@domain/models/AuditLog'

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

            // Flatten params: backend expects top-level 'page', 'size', 'action', 'userId'
            const flatParams: Record<string, unknown> = {}
            if (params?.page !== undefined) flatParams.page = params.page
            if (params?.pageSize !== undefined) flatParams.size = params.pageSize
            if (params?.sort) flatParams.sort = params.sort
            if (params?.order) flatParams.order = params.order
            // Extract filters to top-level params
            if (params?.filters) {
                Object.entries(params.filters).forEach(([key, value]) => {
                    if (value !== undefined && value !== null) {
                        flatParams[key] = value
                    }
                })
            }

            type AuditLogListResponse =
                | AuditLogJSON[]
                | { content: AuditLogJSON[]; totalElements?: number }
                | { items: AuditLogJSON[]; total?: number }
                | AuditLogJSON

            const response = await this.httpClient.get<AuditLogListResponse>('/audit-logs', {
                params: flatParams,
            })

            // Handle both array and paginated response formats
            let auditLogs: AuditLog[]
            let total: number

            if (Array.isArray(response.data)) {
                // Backend returns array
                auditLogs = response.data.map((data: AuditLogJSON) => AuditLog.fromJSON(data))
                total = auditLogs.length
            } else if ('content' in response.data && response.data.content) {
                // Backend returns paginated response with 'content' field
                auditLogs = response.data.content.map((data: AuditLogJSON) => AuditLog.fromJSON(data))
                total = response.data.totalElements || auditLogs.length
            } else if ('items' in response.data && response.data.items) {
                // Backend returns paginated response with 'items' field
                auditLogs = response.data.items.map((data: AuditLogJSON) => AuditLog.fromJSON(data))
                total = response.data.total || auditLogs.length
            } else {
                // Fallback: treat response.data as single entry
                auditLogs = [AuditLog.fromJSON(response.data as AuditLogJSON)]
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
    async findById(id: string): Promise<AuditLog | null> {
        try {
            this.logger.debug(`Fetching audit log ${id}`)

            const response = await this.httpClient.get<AuditLogJSON>(`/audit-logs/${id}`)

            return AuditLog.fromJSON(response.data)
        } catch (error: unknown) {
            const axiosError = error as { response?: { status?: number } }
            if (axiosError.response?.status === 404) {
                return null
            }
            this.logger.error(`Failed to fetch audit log ${id}`, error)
            throw error
        }
    }
}
