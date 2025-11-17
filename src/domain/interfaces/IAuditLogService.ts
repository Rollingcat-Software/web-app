import type { AuditLog } from '@domain/models/AuditLog'
import type { PaginatedResult } from './IRepository'

/**
 * Audit log filters for querying
 */
export interface AuditLogFilters {
    action?: string
    userId?: number
    entityType?: string
    startDate?: Date
    endDate?: Date
}

/**
 * AuditLog Service interface
 * Handles audit log business logic
 */
export interface IAuditLogService {
    /**
     * Get all audit logs with optional filters
     */
    getAuditLogs(
        filters?: AuditLogFilters,
        page?: number,
        pageSize?: number
    ): Promise<PaginatedResult<AuditLog>>

    /**
     * Get audit log by ID
     * @throws NotFoundError if audit log doesn't exist
     */
    getAuditLogById(id: number): Promise<AuditLog>
}
