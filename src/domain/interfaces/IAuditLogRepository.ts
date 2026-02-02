import type { AuditLog } from '@domain/models/AuditLog'
import type { PaginatedResult, QueryParams } from './IRepository'

/**
 * AuditLog Repository interface
 * Handles audit log data access operations
 * Note: Read-only repository - no create/update/delete methods
 */
export interface IAuditLogRepository {
    /**
     * Find all audit logs with optional filters and pagination
     */
    findAll(params?: QueryParams): Promise<PaginatedResult<AuditLog>>

    /**
     * Find audit log by ID
     * @returns AuditLog if found, null otherwise
     */
    findById(id: string): Promise<AuditLog | null>
}
