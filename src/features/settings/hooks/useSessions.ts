import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import { AuthSessionRepository, type UserSessionResponse } from '@core/repositories/AuthSessionRepository'
import type { ErrorHandler } from '@core/errors'
import { formatApiError } from '@utils/formatApiError'
import { jwtDecode } from 'jwt-decode'

/**
 * Sessions state
 */
interface SessionsState {
    sessions: UserSessionResponse[]
    loading: boolean
    error: string | null
    revoking: string | null // sessionId being revoked, or 'all'
}

/**
 * Return type for useSessions hook
 */
interface UseSessionsReturn extends SessionsState {
    refetch: () => Promise<void>
    revokeSession: (sessionId: string) => Promise<void>
    revokeAllOther: () => Promise<void>
}

/**
 * Extract JTI (token ID) from the current access token.
 * Returns undefined if not available.
 */
function getTokenJti(): string | undefined {
    try {
        // Access the cached token from storage
        const token = sessionStorage.getItem('access_token') || localStorage.getItem('access_token')
        if (!token) return undefined
        const decoded = jwtDecode<{ jti?: string }>(token)
        return decoded.jti
    } catch {
        return undefined
    }
}

/**
 * Custom hook for managing cross-device session awareness.
 * Fetches active sessions, allows revoking individual sessions or all other sessions.
 */
export function useSessions(): UseSessionsReturn {
    const sessionRepo = useService<AuthSessionRepository>(TYPES.AuthSessionRepository)
    const errorHandler = useService<ErrorHandler>(TYPES.ErrorHandler)
    const { t } = useTranslation()

    const [state, setState] = useState<SessionsState>({
        sessions: [],
        loading: true,
        error: null,
        revoking: null,
    })

    const currentTokenId = getTokenJti()

    const fetchSessions = useCallback(async () => {
        setState((prev) => ({ ...prev, loading: true, error: null }))
        try {
            const sessions = await sessionRepo.getActiveSessions(currentTokenId)
            setState({
                sessions,
                loading: false,
                error: null,
                revoking: null,
            })
        } catch (error) {
            setState((prev) => ({
                ...prev,
                loading: false,
                error: formatApiError(error, t) || t('errors.failedToLoadSessions'),
            }))
            errorHandler.handle(error)
        }
    }, [sessionRepo, errorHandler, currentTokenId, t])

    useEffect(() => {
        fetchSessions()
    }, [fetchSessions])

    const revokeSession = useCallback(
        async (sessionId: string) => {
            setState((prev) => ({ ...prev, revoking: sessionId }))
            try {
                await sessionRepo.revokeSession(sessionId)
                await fetchSessions()
            } catch (error) {
                setState((prev) => ({ ...prev, revoking: null }))
                errorHandler.handle(error)
                throw error
            }
        },
        [sessionRepo, errorHandler, fetchSessions]
    )

    const revokeAllOther = useCallback(async () => {
        if (!currentTokenId) return
        setState((prev) => ({ ...prev, revoking: 'all' }))
        try {
            await sessionRepo.revokeAllOtherSessions(currentTokenId)
            await fetchSessions()
        } catch (error) {
            setState((prev) => ({ ...prev, revoking: null }))
            errorHandler.handle(error)
            throw error
        }
    }, [sessionRepo, errorHandler, fetchSessions, currentTokenId])

    return {
        ...state,
        refetch: fetchSessions,
        revokeSession,
        revokeAllOther,
    }
}
