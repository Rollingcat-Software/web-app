import { injectable } from 'inversify'
import type { IAuditLogRepository } from '@domain/interfaces/IAuditLogRepository'
import type { PaginatedResult, QueryParams } from '@domain/interfaces/IRepository'
import { AuditLog } from '@domain/models/AuditLog'

@injectable()
export class MockAuditLogRepository implements IAuditLogRepository {
    private logs = new Map<string, AuditLog>([
        [
            '1',
            new AuditLog(
                '1',
                '1',
                '1',
                'USER_AUTHENTICATED',
                'USER',
                '127.0.0.1',
                'test-agent',
                { success: true },
                new Date()
            ),
        ],
        [
            '2',
            new AuditLog(
                '2',
                '1',
                '1',
                'USER_CREATED',
                'USER',
                '127.0.0.1',
                'test-agent',
                { targetUserId: '2' },
                new Date()
            ),
        ],
    ])

    async findAll(params?: QueryParams): Promise<PaginatedResult<AuditLog>> {
        const page = params?.page ?? 0
        const pageSize = params?.pageSize ?? 20
        const filters = params?.filters ?? {}

        const filtered = Array.from(this.logs.values()).filter((log) => {
            const actionFilter = filters.action as string | undefined
            const userIdFilter = filters.userId as string | undefined

            if (actionFilter && log.action !== actionFilter) {
                return false
            }

            if (userIdFilter && log.userId !== userIdFilter) {
                return false
            }

            return true
        })

        const start = page * pageSize
        const items = filtered.slice(start, start + pageSize)

        return {
            items,
            total: filtered.length,
            page,
            pageSize,
            totalPages: filtered.length === 0 ? 0 : Math.ceil(filtered.length / pageSize),
        }
    }

    async findById(id: string): Promise<AuditLog | null> {
        return this.logs.get(id) ?? null
    }
}
