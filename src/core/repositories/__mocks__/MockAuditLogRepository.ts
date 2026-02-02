import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { IAuditLogRepository } from '@domain/interfaces/IAuditLogRepository'
import type { PaginatedResult, QueryParams } from '@domain/interfaces/IRepository'
import { AuditLog } from '@domain/models/AuditLog'

/**
 * Mock AuditLog Repository
 * Provides fake audit log data for development/testing
 */
@injectable()
export class MockAuditLogRepository implements IAuditLogRepository {
    private auditLogs: AuditLog[]

    constructor(@inject(TYPES.Logger) private readonly logger: ILogger) {
        // Initialize with mock audit logs (sorted by most recent first)
        this.auditLogs = [
            new AuditLog(
                '1',
                '1',
                '1',
                'USER_LOGIN',
                'User',
                '192.168.1.1',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                { loginMethod: 'email', success: true },
                new Date('2025-11-17T10:30:00Z'),
                '1'
            ),
            new AuditLog(
                '2',
                '2',
                '1',
                'USER_CREATED',
                'User',
                '192.168.1.50',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                { role: 'USER', createdBy: 'admin@fivucsas.com' },
                new Date('2025-11-17T09:15:00Z'),
                '5'
            ),
            new AuditLog(
                '3',
                '1',
                '1',
                'USER_UPDATED',
                'User',
                '192.168.1.1',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                { field: 'status', oldValue: 'PENDING_ENROLLMENT', newValue: 'ACTIVE' },
                new Date('2025-11-17T08:45:00Z'),
                '3'
            ),
            new AuditLog(
                '4',
                '5',
                '1',
                'BIOMETRIC_VERIFICATION',
                'EnrollmentJob',
                '192.168.1.100',
                'FIVUCSAS Mobile App/1.0',
                { userId: 5, result: 'success', confidence: 0.98 },
                new Date('2025-11-16T18:20:00Z'),
                undefined
            ),
            new AuditLog(
                '5',
                '1',
                '1',
                'USER_DELETED',
                'User',
                '192.168.1.1',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                { deletedBy: 'admin@fivucsas.com', reason: 'Account closure requested' },
                new Date('2025-11-16T16:00:00Z'),
                '7'
            ),
            new AuditLog(
                '6',
                '3',
                '1',
                'FAILED_LOGIN_ATTEMPT',
                'User',
                '203.0.113.42',
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
                { reason: 'Invalid password', attemptCount: 3 },
                new Date('2025-11-16T14:30:00Z'),
                '3'
            ),
            new AuditLog(
                '7',
                '2',
                '1',
                'SETTINGS_UPDATED',
                'Tenant',
                '192.168.1.50',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                { setting: 'maxUsers', oldValue: 50, newValue: 100 },
                new Date('2025-11-16T12:00:00Z'),
                '1'
            ),
            new AuditLog(
                '8',
                '1',
                '1',
                'PASSWORD_RESET',
                'User',
                '192.168.1.1',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                { resetBy: 'admin@fivucsas.com', method: 'admin_reset' },
                new Date('2025-11-16T10:15:00Z'),
                '4'
            ),
        ]
    }

    async findAll(params?: QueryParams): Promise<PaginatedResult<AuditLog>> {
        this.logger.debug('Mock: Fetching all audit logs', { params })
        await this.delay(400)

        let filteredLogs = [...this.auditLogs]

        // Apply filters if provided
        if (params?.filters) {
            const { action, userId, entityType } = params.filters as any

            if (action && action !== 'ALL') {
                filteredLogs = filteredLogs.filter((log) => log.action === action)
            }

            if (userId) {
                filteredLogs = filteredLogs.filter((log) => log.userId === userId)
            }

            if (entityType) {
                filteredLogs = filteredLogs.filter((log) => log.entityType === entityType)
            }
        }

        // Sort by most recent first (already sorted in the initial data)
        filteredLogs = filteredLogs.sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        )

        const pageSize = params?.pageSize || 20
        const page = params?.page || 0
        const startIndex = page * pageSize
        const endIndex = startIndex + pageSize

        return {
            items: filteredLogs.slice(startIndex, endIndex),
            total: filteredLogs.length,
            page,
            pageSize,
            totalPages: Math.ceil(filteredLogs.length / pageSize),
        }
    }

    async findById(id: string): Promise<AuditLog | null> {
        this.logger.debug(`Mock: Fetching audit log ${id}`)
        await this.delay(300)

        const log = this.auditLogs.find((l) => l.id === id)
        return log || null
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }
}
