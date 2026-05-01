import { useCallback, useEffect, useState } from 'react'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import {
    AuthSessionRepository,
    type AuthSessionListItem,
    type AuthSessionStatusValue,
} from '@core/repositories/AuthSessionRepository'
import type { ErrorHandler } from '@core/errors'

interface AuthSessionsListState {
    sessions: AuthSessionListItem[]
    totalElements: number
    totalPages: number
    page: number
    size: number
    loading: boolean
    error: Error | null
}

interface UseAuthSessionsListReturn extends AuthSessionsListState {
    refetch: () => Promise<void>
    setPage: (page: number) => void
    setSize: (size: number) => void
    cancelSession: (sessionId: string) => Promise<void>
}

const emptyState = (size: number): AuthSessionsListState => ({
    sessions: [],
    totalElements: 0,
    totalPages: 0,
    page: 0,
    size,
    loading: false,
    error: null,
})

/**
 * Admin hook backing AuthSessionsPage. Fetches the paginated list of
 * auth sessions for the given tenant, optionally filtered by status and
 * user, plus a `cancelSession` mutator that cancels an in-flight session
 * and re-fetches the page.
 *
 * 403 responses are silently coerced to an empty page (caller is not
 * tenant-admin / lacks audit:read) — same policy as `useAuditLogs`.
 *
 * @param tenantId      tenant whose sessions to list. Empty string with
 *                      `crossTenant=true` requests platform-wide listing
 *                      (SUPER_ADMIN only); empty string without the flag
 *                      skips the fetch entirely.
 * @param statusFilter  optional list of session statuses.
 * @param userIdFilter  optional userId to drill into.
 * @param initialSize   default 20.
 * @param crossTenant   when true, omit tenantId from the request so the
 *                      backend lists every tenant. Backend enforces this
 *                      is only honored for SUPER_ADMIN.
 */
export function useAuthSessionsList(
    tenantId: string,
    statusFilter?: AuthSessionStatusValue[],
    userIdFilter?: string,
    initialSize: number = 20,
    crossTenant: boolean = false
): UseAuthSessionsListReturn {
    const repo = useService<AuthSessionRepository>(TYPES.AuthSessionRepository)
    const errorHandler = useService<ErrorHandler>(TYPES.ErrorHandler)

    const shouldFetch = !!tenantId || crossTenant

    const [state, setState] = useState<AuthSessionsListState>({
        sessions: [],
        totalElements: 0,
        totalPages: 0,
        page: 0,
        size: initialSize,
        loading: shouldFetch,
        error: null,
    })

    // Stable key so the effect re-runs only on real filter changes.
    const filterKey = JSON.stringify(statusFilter ?? [])

    const fetchPage = useCallback(
        async (page: number, size: number) => {
            if (!shouldFetch) {
                setState(emptyState(size))
                return
            }

            setState((prev) => ({ ...prev, loading: true, error: null }))

            try {
                const result = await repo.listSessions(
                    tenantId,
                    statusFilter && statusFilter.length > 0 ? statusFilter : undefined,
                    userIdFilter || undefined,
                    page,
                    size
                )
                setState({
                    sessions: result.content,
                    totalElements: result.totalElements,
                    totalPages: result.totalPages,
                    page: result.page,
                    size: result.size,
                    loading: false,
                    error: null,
                })
            } catch (error) {
                const axiosError = error as { response?: { status?: number } }
                if (axiosError.response?.status === 403) {
                    // Non-admin: return empty quietly (same UX as useAuditLogs).
                    setState(emptyState(size))
                    return
                }
                setState((prev) => ({
                    ...prev,
                    loading: false,
                    error: error as Error,
                }))
                errorHandler.handle(error)
            }
        },
        // filterKey intentionally — encapsulates statusFilter array identity.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [repo, errorHandler, tenantId, userIdFilter, filterKey, shouldFetch]
    )

    // Initial + filter-change fetch.
    useEffect(() => {
        fetchPage(0, initialSize)
    }, [fetchPage, initialSize])

    const refetch = useCallback(
        () => fetchPage(state.page, state.size),
        [fetchPage, state.page, state.size]
    )

    const setPage = useCallback(
        (page: number) => {
            fetchPage(page, state.size)
        },
        [fetchPage, state.size]
    )

    const setSize = useCallback(
        (size: number) => {
            fetchPage(0, size)
        },
        [fetchPage]
    )

    const cancelSession = useCallback(
        async (sessionId: string) => {
            try {
                await repo.cancelSession(sessionId)
                // Refresh the current page to reflect the new CANCELLED status.
                await fetchPage(state.page, state.size)
            } catch (error) {
                errorHandler.handle(error)
                throw error
            }
        },
        [repo, errorHandler, fetchPage, state.page, state.size]
    )

    return {
        ...state,
        refetch,
        setPage,
        setSize,
        cancelSession,
    }
}
