import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { Container } from 'inversify'
import { DependencyProvider } from '@app/providers'
import { TYPES } from '@core/di/types'
import { useAuditLogs, useAuditLog } from '../useAuditLogs'
import { createTestContainer } from '@test/testUtils'
import type { IAuditLogService } from '@domain/interfaces/IAuditLogService'
import type { ErrorHandler } from '@core/errors'
import { AuditLog } from '@domain/models/AuditLog'

describe('useAuditLogs', () => {
    let container: Container
    let mockAuditLogService: jest.Mocked<IAuditLogService>
    let mockErrorHandler: jest.Mocked<ErrorHandler>

    // Test data
    const testLogs = [
        new AuditLog('1', 'user-1', 'tenant-1', 'USER_LOGIN', 'User', '192.168.1.1', 'Chrome', {}, new Date()),
        new AuditLog('2', 'user-2', 'tenant-1', 'USER_CREATED', 'User', '192.168.1.2', 'Firefox', {}, new Date()),
    ]

    beforeEach(() => {
        container = createTestContainer()
        mockAuditLogService = container.get<IAuditLogService>(TYPES.AuditLogService) as jest.Mocked<IAuditLogService>
        mockErrorHandler = container.get<ErrorHandler>(TYPES.ErrorHandler) as jest.Mocked<ErrorHandler>

        vi.clearAllMocks()
    })

    const wrapper = ({ children }: { children: ReactNode }) => (
        <DependencyProvider container={container}>{children}</DependencyProvider>
    )

    describe('initial loading state', () => {
        it('should start with loading state', () => {
            mockAuditLogService.getAuditLogs = vi.fn().mockImplementation(
                () => new Promise(() => {}) // Never resolves
            )

            const { result } = renderHook(() => useAuditLogs(), { wrapper })

            expect(result.current.loading).toBe(true)
            expect(result.current.auditLogs).toEqual([])
            expect(result.current.total).toBe(0)
            expect(result.current.error).toBeNull()
        })
    })

    describe('successful audit logs fetch on mount', () => {
        it('should fetch audit logs successfully on mount', async () => {
            mockAuditLogService.getAuditLogs = vi.fn().mockResolvedValue({
                items: testLogs,
                total: 2,
            })

            const { result } = renderHook(() => useAuditLogs(), { wrapper })

            // Initially loading
            expect(result.current.loading).toBe(true)

            // Wait for audit logs to load
            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            expect(result.current.auditLogs).toEqual(testLogs)
            expect(result.current.total).toBe(2)
            expect(result.current.error).toBeNull()
            expect(mockAuditLogService.getAuditLogs).toHaveBeenCalledTimes(1)
            expect(mockAuditLogService.getAuditLogs).toHaveBeenCalledWith(undefined)
        })

        it('should fetch empty list successfully', async () => {
            mockAuditLogService.getAuditLogs = vi.fn().mockResolvedValue({
                items: [],
                total: 0,
            })

            const { result } = renderHook(() => useAuditLogs(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            expect(result.current.auditLogs).toEqual([])
            expect(result.current.total).toBe(0)
            expect(result.current.error).toBeNull()
        })
    })

    describe('error handling', () => {
        it('should handle initial fetch error', async () => {
            const error = new Error('Failed to fetch audit logs')
            mockAuditLogService.getAuditLogs = vi.fn().mockRejectedValue(error)
            mockErrorHandler.handle = vi.fn()

            const { result } = renderHook(() => useAuditLogs(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            expect(result.current.auditLogs).toEqual([])
            expect(result.current.total).toBe(0)
            expect(result.current.error).toEqual(error)
            expect(mockErrorHandler.handle).toHaveBeenCalledWith(error)
        })

        it('should set loading to false after error', async () => {
            const error = new Error('Fetch error')
            mockAuditLogService.getAuditLogs = vi.fn().mockRejectedValue(error)
            mockErrorHandler.handle = vi.fn()

            const { result } = renderHook(() => useAuditLogs(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            expect(result.current.error).toEqual(error)
        })

        it('should clear previous error on successful refetch', async () => {
            // First fetch fails
            const error = new Error('Network error')
            mockAuditLogService.getAuditLogs = vi.fn().mockRejectedValue(error)
            mockErrorHandler.handle = vi.fn()

            const { result } = renderHook(() => useAuditLogs(), { wrapper })

            await waitFor(() => {
                expect(result.current.error).toEqual(error)
            })

            // Retry succeeds
            mockAuditLogService.getAuditLogs = vi.fn().mockResolvedValue({
                items: testLogs,
                total: 2,
            })

            await result.current.refetch()

            await waitFor(() => {
                expect(result.current.error).toBeNull()
            })

            expect(result.current.auditLogs).toEqual(testLogs)
        })
    })

    describe('refetch', () => {
        it('should refetch with new filters', async () => {
            mockAuditLogService.getAuditLogs = vi.fn().mockResolvedValue({
                items: testLogs,
                total: 2,
            })

            const { result } = renderHook(() => useAuditLogs(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            // Refetch with filters
            const newFilters = { action: 'USER_LOGIN' }
            mockAuditLogService.getAuditLogs = vi.fn().mockResolvedValue({
                items: [testLogs[0]],
                total: 1,
            })

            await result.current.refetch(newFilters)

            await waitFor(() => {
                expect(result.current.auditLogs).toEqual([testLogs[0]])
            })

            expect(result.current.total).toBe(1)
            expect(mockAuditLogService.getAuditLogs).toHaveBeenCalledWith(newFilters)
        })
    })
})

describe('useAuditLog', () => {
    let container: Container
    let mockAuditLogService: jest.Mocked<IAuditLogService>
    let mockErrorHandler: jest.Mocked<ErrorHandler>

    const testLog = new AuditLog('1', 'user-1', 'tenant-1', 'USER_LOGIN', 'User', '192.168.1.1', 'Chrome', {}, new Date())

    beforeEach(() => {
        container = createTestContainer()
        mockAuditLogService = container.get<IAuditLogService>(TYPES.AuditLogService) as jest.Mocked<IAuditLogService>
        mockErrorHandler = container.get<ErrorHandler>(TYPES.ErrorHandler) as jest.Mocked<ErrorHandler>

        vi.clearAllMocks()
    })

    const wrapper = ({ children }: { children: ReactNode }) => (
        <DependencyProvider container={container}>{children}</DependencyProvider>
    )

    it('should fetch single audit log by id', async () => {
        mockAuditLogService.getAuditLogById = vi.fn().mockResolvedValue(testLog)

        const { result } = renderHook(() => useAuditLog('1'), { wrapper })

        // Initially loading
        expect(result.current.loading).toBe(true)

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.auditLog).toEqual(testLog)
        expect(result.current.error).toBeNull()
        expect(mockAuditLogService.getAuditLogById).toHaveBeenCalledWith('1')
    })

    it('should handle fetch error', async () => {
        const error = new Error('Audit log not found')
        mockAuditLogService.getAuditLogById = vi.fn().mockRejectedValue(error)
        mockErrorHandler.handle = vi.fn()

        const { result } = renderHook(() => useAuditLog('999'), { wrapper })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.auditLog).toBeNull()
        expect(result.current.error).toEqual(error)
        expect(mockErrorHandler.handle).toHaveBeenCalledWith(error)
    })
})
