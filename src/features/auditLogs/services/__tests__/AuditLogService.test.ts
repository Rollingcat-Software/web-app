import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuditLogService } from '../AuditLogService'
import type { IAuditLogRepository } from '@domain/interfaces/IAuditLogRepository'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { PaginatedResult } from '@domain/interfaces/IRepository'
import { AuditLog } from '@domain/models/AuditLog'
import { NotFoundError } from '@core/errors'
import type { AuditLogFilters } from '@domain/interfaces/IAuditLogService'

describe('AuditLogService', () => {
    let auditLogService: AuditLogService
    let mockAuditLogRepository: IAuditLogRepository
    let mockLogger: ILogger

    const mockAuditLog = new AuditLog(
        '1',
        'user-1',
        'tenant-1',
        'USER_LOGIN',
        'USER',
        '192.168.1.1',
        'Mozilla/5.0',
        { browser: 'Chrome' },
        new Date(),
        'entity-1',
        true,
        undefined
    )

    beforeEach(() => {
        // Create mock repository
        mockAuditLogRepository = {
            findAll: vi.fn(),
            findById: vi.fn(),
        }

        // Create mock logger
        mockLogger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        }

        // Create service instance with mocks
        auditLogService = new AuditLogService(mockAuditLogRepository, mockLogger)
    })

    describe('getAuditLogs', () => {
        it('should get audit logs with filters successfully', async () => {
            // Arrange
            const filters: AuditLogFilters = {
                userId: 'user-1',
                action: 'USER_LOGIN',
            }
            const mockResult: PaginatedResult<AuditLog> = {
                items: [mockAuditLog],
                total: 1,
                page: 0,
                pageSize: 20,
                totalPages: 1,
            }

            vi.mocked(mockAuditLogRepository.findAll).mockResolvedValue(mockResult)

            // Act
            const result = await auditLogService.getAuditLogs(filters, 0, 20)

            // Assert
            expect(mockAuditLogRepository.findAll).toHaveBeenCalledWith({
                page: 0,
                pageSize: 20,
                filters: filters as Record<string, unknown>,
            })
            expect(result).toEqual(mockResult)
            expect(mockLogger.debug).toHaveBeenCalledWith('Getting audit logs', {
                filters,
                page: 0,
                pageSize: 20,
            })
        })

        it('should get audit logs without filters', async () => {
            // Arrange
            const mockResult: PaginatedResult<AuditLog> = {
                items: [mockAuditLog],
                total: 1,
                page: 0,
                pageSize: 20,
                totalPages: 1,
            }

            vi.mocked(mockAuditLogRepository.findAll).mockResolvedValue(mockResult)

            // Act
            const result = await auditLogService.getAuditLogs()

            // Assert
            expect(mockAuditLogRepository.findAll).toHaveBeenCalledWith({
                page: 0,
                pageSize: 20,
                filters: undefined,
            })
            expect(result).toEqual(mockResult)
        })

        it('should handle repository errors', async () => {
            // Arrange
            const error = new Error('Database error')
            vi.mocked(mockAuditLogRepository.findAll).mockRejectedValue(error)

            // Act & Assert
            await expect(auditLogService.getAuditLogs()).rejects.toThrow('Database error')
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to get audit logs', error)
        })
    })

    describe('getAuditLogById', () => {
        it('should get audit log by ID when found', async () => {
            // Arrange
            vi.mocked(mockAuditLogRepository.findById).mockResolvedValue(mockAuditLog)

            // Act
            const result = await auditLogService.getAuditLogById('1')

            // Assert
            expect(mockAuditLogRepository.findById).toHaveBeenCalledWith('1')
            expect(result).toEqual(mockAuditLog)
            expect(mockLogger.debug).toHaveBeenCalledWith('Getting audit log 1')
        })

        it('should throw NotFoundError when audit log not found', async () => {
            // Arrange
            vi.mocked(mockAuditLogRepository.findById).mockResolvedValue(null)

            // Act & Assert
            await expect(auditLogService.getAuditLogById('999')).rejects.toThrow(NotFoundError)
            await expect(auditLogService.getAuditLogById('999')).rejects.toThrow(
                'Audit log with ID 999 not found'
            )
        })
    })
})
