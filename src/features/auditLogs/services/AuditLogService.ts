import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { IAuditLogService, AuditLogFilters } from '@domain/interfaces/IAuditLogService'
import type { IAuditLogRepository } from '@domain/interfaces/IAuditLogRepository'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { PaginatedResult } from '@domain/interfaces/IRepository'
import { AuditLog } from '@domain/models/AuditLog'
import { NotFoundError } from '@core/errors'

/**
 * AuditLog Service
 * Handles audit log business logic
 */
@injectable()
export class AuditLogService implements IAuditLogService {
    constructor(
        @inject(TYPES.AuditLogRepository) private readonly auditLogRepository: IAuditLogRepository,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    /**
     * Get all audit logs with optional filters
     */
    async getAuditLogs(
        filters?: AuditLogFilters,
        page: number = 0,
        pageSize: number = 20
    ): Promise<PaginatedResult<AuditLog>> {
        try {
            this.logger.debug('Getting audit logs', { filters, page, pageSize })

            const result = await this.auditLogRepository.findAll({
                page,
                pageSize,
                filters: filters as Record<string, unknown>,
            })

            return result
        } catch (error) {
            this.logger.error('Failed to get audit logs', error)
            throw error
        }
    }

    /**
     * Get audit log by ID
     */
    async getAuditLogById(id: number): Promise<AuditLog> {
        this.logger.debug(`Getting audit log ${id}`)

        const auditLog = await this.auditLogRepository.findById(id)

        if (!auditLog) {
            throw new NotFoundError(`Audit log with ID ${id} not found`)
        }

        return auditLog
    }
}
