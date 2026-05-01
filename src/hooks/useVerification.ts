import { useState, useCallback } from 'react'
import { useService } from '@app/providers'
import { useAuth } from '@features/auth/hooks/useAuth'
import { TYPES } from '@core/di/types'
import type {
    VerificationRepository,
    VerificationTemplate,
    VerificationFlow,
    VerificationSessionResponse,
    VerificationStats,
    CreateVerificationFlowCommand,
} from '@core/repositories/VerificationRepository'
import type { ILogger } from '@domain/interfaces/ILogger'

/**
 * useVerification
 *
 * Hook for verification pipeline operations: templates, flows, sessions, and stats.
 */
export function useVerification() {
    const verificationRepo = useService<VerificationRepository>(TYPES.VerificationRepository)
    const logger = useService<ILogger>(TYPES.Logger)
    const { user } = useAuth()
    // SUPER_ADMIN sends '' + crossTenant so the backend lists/aggregates
    // platform-wide; tenant-scoped admins always pin to their own tenant.
    // Without this, the SUPER_ADMIN saw only the (empty) system-tenant slice.
    // Copilot post-merge round 5: derive a dedicated isSuperAdmin so
    // listFlows() can request platform-wide mode explicitly instead of
    // relying on a falsy tenantId (which used to be ambiguous with "auth
    // hasn't finished loading").
    const isSuperAdmin = !!user?.isSuperAdmin?.()
    const tenantId = isSuperAdmin ? '' : (user?.tenantId ?? '')

    const [templates, setTemplates] = useState<VerificationTemplate[]>([])
    const [flows, setFlows] = useState<VerificationFlow[]>([])
    const [sessions, setSessions] = useState<VerificationSessionResponse[]>([])
    const [currentSession, setCurrentSession] = useState<VerificationSessionResponse | null>(null)
    const [stats, setStats] = useState<VerificationStats | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // ── Templates ───────────────────────────────────────────────────────────

    const loadTemplates = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const data = await verificationRepo.getTemplates()
            setTemplates(data)
        } catch (err) {
            logger.error('Failed to load verification templates', err)
            setError('Failed to load verification templates')
        } finally {
            setLoading(false)
        }
    }, [verificationRepo, logger])

    // ── Flows ───────────────────────────────────────────────────────────────

    const loadFlows = useCallback(async () => {
        // Copilot post-merge round 5: only request flows once we know who
        // the caller is. Tenant-scoped users without a tenantId yet (auth
        // still loading) get an empty flow list rather than accidentally
        // triggering a SUPER_ADMIN cross-tenant request.
        if (!tenantId && !isSuperAdmin) {
            setFlows([])
            setError(null)
            setLoading(false)
            return
        }
        setLoading(true)
        setError(null)
        try {
            const data = await verificationRepo.listFlows(
                tenantId,
                isSuperAdmin ? { crossTenant: true } : undefined
            )
            setFlows(data)
        } catch (err) {
            logger.error('Failed to load verification flows', err)
            setError('Failed to load verification flows')
        } finally {
            setLoading(false)
        }
    }, [verificationRepo, logger, tenantId, isSuperAdmin])

    const createFlow = useCallback(async (command: CreateVerificationFlowCommand): Promise<VerificationFlow | null> => {
        setLoading(true)
        setError(null)
        try {
            const created = await verificationRepo.createFlow(command)
            logger.info('Verification flow created', { flowId: created.id })
            const updated = await verificationRepo.listFlows(
                tenantId,
                isSuperAdmin ? { crossTenant: true } : undefined
            )
            setFlows(updated)
            return created
        } catch (err) {
            logger.error('Failed to create verification flow', err)
            setError('Failed to create verification flow')
            return null
        } finally {
            setLoading(false)
        }
    }, [verificationRepo, logger, tenantId, isSuperAdmin])

    const deleteFlow = useCallback(async (flowId: string): Promise<boolean> => {
        setError(null)
        try {
            await verificationRepo.deleteFlow(flowId)
            logger.info('Verification flow deleted', { flowId })
            setFlows(prev => prev.filter(f => f.id !== flowId))
            return true
        } catch (err) {
            logger.error('Failed to delete verification flow', err)
            setError('Failed to delete verification flow')
            return false
        }
    }, [verificationRepo, logger])

    // ── Sessions ────────────────────────────────────────────────────────────

    const loadSessions = useCallback(async (filters?: {
        status?: string
        dateFrom?: string
        dateTo?: string
        templateId?: string
    }) => {
        setLoading(true)
        setError(null)
        try {
            const data = await verificationRepo.listSessions(filters)
            setSessions(data)
        } catch (err) {
            logger.error('Failed to load verification sessions', err)
            setError('Failed to load verification sessions')
        } finally {
            setLoading(false)
        }
    }, [verificationRepo, logger])

    const loadSession = useCallback(async (sessionId: string) => {
        setLoading(true)
        setError(null)
        try {
            const data = await verificationRepo.getSession(sessionId)
            setCurrentSession(data)
        } catch (err) {
            logger.error('Failed to load verification session', err)
            setError('Failed to load verification session')
        } finally {
            setLoading(false)
        }
    }, [verificationRepo, logger])

    // ── Stats ───────────────────────────────────────────────────────────────

    const loadStats = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const data = await verificationRepo.getStats()
            setStats(data)
        } catch (err) {
            logger.error('Failed to load verification stats', err)
            setError('Failed to load verification stats')
        } finally {
            setLoading(false)
        }
    }, [verificationRepo, logger])

    const clearError = useCallback(() => {
        setError(null)
    }, [])

    return {
        // State
        templates,
        flows,
        sessions,
        currentSession,
        stats,
        loading,
        error,

        // Actions
        loadTemplates,
        loadFlows,
        createFlow,
        deleteFlow,
        loadSessions,
        loadSession,
        loadStats,
        clearError,
    }
}
