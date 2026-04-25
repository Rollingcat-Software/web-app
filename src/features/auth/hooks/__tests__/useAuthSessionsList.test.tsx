import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import React from 'react'
import { Container } from 'inversify'
import { DependencyProvider } from '@app/providers'
import { TYPES } from '@core/di/types'
import { useAuthSessionsList } from '../useAuthSessionsList'
import type {
    AuthSessionListItem,
    PageResult,
    AuthSessionStatusValue,
} from '@core/repositories/AuthSessionRepository'

/**
 * Tests for useAuthSessionsList — admin-list hook for AuthSessionsPage.
 *
 * Mocks the AuthSessionRepository directly via the DI container so we can
 * assert which arguments the hook passes to the repo on initial fetch,
 * pagination, status changes, and after cancel.
 */
describe('useAuthSessionsList', () => {
    let container: Container
    let mockRepo: {
        listSessions: ReturnType<typeof vi.fn>
        cancelSession: ReturnType<typeof vi.fn>
    }
    let mockErrorHandler: { handle: ReturnType<typeof vi.fn> }

    const mockSession = (overrides: Partial<AuthSessionListItem> = {}): AuthSessionListItem => ({
        id: 'sess-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        operationType: 'APP_LOGIN',
        status: 'IN_PROGRESS' as AuthSessionStatusValue,
        currentStep: 1,
        totalSteps: 2,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        completedAt: null,
        ipAddress: '203.0.113.7',
        userAgent: 'Mozilla/5.0',
        ...overrides,
    })

    const onePage = (items: AuthSessionListItem[]): PageResult<AuthSessionListItem> => ({
        content: items,
        totalElements: items.length,
        totalPages: 1,
        page: 0,
        size: 20,
    })

    const Wrapper = ({ children }: { children: React.ReactNode }) => (
        <DependencyProvider container={container}>{children}</DependencyProvider>
    )

    beforeEach(() => {
        mockRepo = {
            listSessions: vi.fn().mockResolvedValue(onePage([mockSession()])),
            cancelSession: vi.fn().mockResolvedValue(undefined),
        }
        mockErrorHandler = { handle: vi.fn() }

        container = new Container()
        container.bind(TYPES.AuthSessionRepository).toConstantValue(mockRepo)
        container.bind(TYPES.ErrorHandler).toConstantValue(mockErrorHandler)
    })

    it('fetches on mount with tenantId only (no filters)', async () => {
        const { result } = renderHook(() => useAuthSessionsList('tenant-1'), {
            wrapper: Wrapper,
        })

        expect(result.current.loading).toBe(true)
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(mockRepo.listSessions).toHaveBeenCalledTimes(1)
        expect(mockRepo.listSessions).toHaveBeenCalledWith(
            'tenant-1',
            undefined, // no status filter
            undefined, // no userId filter
            0,
            20
        )
        expect(result.current.sessions).toHaveLength(1)
        expect(result.current.totalElements).toBe(1)
        expect(result.current.error).toBeNull()
    })

    it('passes status filter as array to repo', async () => {
        const { result } = renderHook(
            () => useAuthSessionsList('tenant-1', ['IN_PROGRESS', 'CREATED']),
            { wrapper: Wrapper }
        )

        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(mockRepo.listSessions).toHaveBeenCalledWith(
            'tenant-1',
            ['IN_PROGRESS', 'CREATED'],
            undefined,
            0,
            20
        )
    })

    it('skips fetch when tenantId is empty', async () => {
        const { result } = renderHook(() => useAuthSessionsList(''), {
            wrapper: Wrapper,
        })

        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(mockRepo.listSessions).not.toHaveBeenCalled()
        expect(result.current.sessions).toEqual([])
        expect(result.current.totalElements).toBe(0)
    })

    it('setPage triggers refetch with new page', async () => {
        const { result } = renderHook(() => useAuthSessionsList('tenant-1'), {
            wrapper: Wrapper,
        })

        await waitFor(() => expect(result.current.loading).toBe(false))
        mockRepo.listSessions.mockClear()

        act(() => {
            result.current.setPage(2)
        })

        await waitFor(() => {
            expect(mockRepo.listSessions).toHaveBeenCalledWith(
                'tenant-1',
                undefined,
                undefined,
                2,
                20
            )
        })
    })

    it('setSize resets to page 0 with new size', async () => {
        const { result } = renderHook(() => useAuthSessionsList('tenant-1'), {
            wrapper: Wrapper,
        })

        await waitFor(() => expect(result.current.loading).toBe(false))
        mockRepo.listSessions.mockClear()

        act(() => {
            result.current.setSize(50)
        })

        await waitFor(() => {
            expect(mockRepo.listSessions).toHaveBeenCalledWith(
                'tenant-1',
                undefined,
                undefined,
                0,
                50
            )
        })
    })

    it('cancelSession calls repo and refetches the current page', async () => {
        const { result } = renderHook(() => useAuthSessionsList('tenant-1'), {
            wrapper: Wrapper,
        })

        await waitFor(() => expect(result.current.loading).toBe(false))
        mockRepo.listSessions.mockClear()

        await act(async () => {
            await result.current.cancelSession('sess-1')
        })

        expect(mockRepo.cancelSession).toHaveBeenCalledWith('sess-1')
        // After cancel, the page is refetched.
        expect(mockRepo.listSessions).toHaveBeenCalledTimes(1)
    })

    it('cancelSession failure surfaces via errorHandler', async () => {
        const cancelErr = new Error('boom')
        mockRepo.cancelSession.mockRejectedValueOnce(cancelErr)

        const { result } = renderHook(() => useAuthSessionsList('tenant-1'), {
            wrapper: Wrapper,
        })
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await expect(result.current.cancelSession('sess-1')).rejects.toBe(cancelErr)
        })

        expect(mockErrorHandler.handle).toHaveBeenCalledWith(cancelErr)
    })

    it('403 from list silently returns empty page (admin gating UX)', async () => {
        mockRepo.listSessions.mockRejectedValueOnce({ response: { status: 403 } })

        const { result } = renderHook(() => useAuthSessionsList('tenant-1'), {
            wrapper: Wrapper,
        })

        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.sessions).toEqual([])
        expect(result.current.totalElements).toBe(0)
        expect(result.current.error).toBeNull()
        // 403 must NOT trigger a global error toast.
        expect(mockErrorHandler.handle).not.toHaveBeenCalled()
    })

    it('non-403 errors set error state and call errorHandler', async () => {
        const networkErr = new Error('Network down')
        mockRepo.listSessions.mockRejectedValueOnce(networkErr)

        const { result } = renderHook(() => useAuthSessionsList('tenant-1'), {
            wrapper: Wrapper,
        })

        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.error).toBe(networkErr)
        expect(mockErrorHandler.handle).toHaveBeenCalledWith(networkErr)
    })

    it('refetch re-invokes listSessions with current page+size', async () => {
        const { result } = renderHook(() => useAuthSessionsList('tenant-1'), {
            wrapper: Wrapper,
        })
        await waitFor(() => expect(result.current.loading).toBe(false))
        mockRepo.listSessions.mockClear()

        await act(async () => {
            await result.current.refetch()
        })

        expect(mockRepo.listSessions).toHaveBeenCalledWith(
            'tenant-1',
            undefined,
            undefined,
            0,
            20
        )
    })
})
