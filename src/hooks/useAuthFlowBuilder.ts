import { useState, useCallback } from 'react'
import { useService } from '@app/providers/DependencyProvider'
import { useAuth } from '@features/auth/hooks/useAuth'
import { TYPES } from '@core/di/types'
import type { AuthFlowRepository, AuthFlowResponse, CreateAuthFlowCommand, UpdateAuthFlowCommand } from '@core/repositories/AuthFlowRepository'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { OperationType } from '@domain/models/AuthMethod'
import { AuthMethodType, type AuthFlowStep } from '@domain/models/AuthMethod'

const PASSWORD_MANDATORY_OPS = new Set<string>(['APP_LOGIN', 'API_ACCESS'])

/**
 * useAuthFlowBuilder
 *
 * Provides CRUD operations for auth flows and step management (add, remove, reorder).
 * Used by the Auth Flows page for creating, editing, and deleting flows.
 */
export function useAuthFlowBuilder() {
    const authFlowRepo = useService<AuthFlowRepository>(TYPES.AuthFlowRepository)
    const logger = useService<ILogger>(TYPES.Logger)
    const { user } = useAuth()
    const tenantId = user?.tenantId ?? ''

    const [flows, setFlows] = useState<AuthFlowResponse[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    // Step management state for the builder dialog
    const [steps, setSteps] = useState<AuthFlowStep[]>([])

    // ── Flow CRUD ───────────────────────────────────────────────────────────

    const loadFlows = useCallback(async (operationType?: string) => {
        setLoading(true)
        setError(null)
        try {
            const data = await authFlowRepo.listFlows(tenantId, operationType || undefined)
            setFlows(data)
        } catch (err) {
            logger.error('Failed to load auth flows', err)
            setError('Failed to load authentication flows')
        } finally {
            setLoading(false)
        }
    }, [authFlowRepo, logger, tenantId])

    const createFlow = useCallback(async (command: CreateAuthFlowCommand): Promise<AuthFlowResponse | null> => {
        setSaving(true)
        setError(null)
        try {
            const created = await authFlowRepo.createFlow(tenantId, command)
            logger.info('Auth flow created', { flowId: created.id })
            // Reload flows list
            const updated = await authFlowRepo.listFlows(tenantId)
            setFlows(updated)
            return created
        } catch (err) {
            logger.error('Failed to create auth flow', err)
            setError('Failed to create authentication flow')
            return null
        } finally {
            setSaving(false)
        }
    }, [authFlowRepo, logger, tenantId])

    const updateFlow = useCallback(async (flowId: string, command: UpdateAuthFlowCommand): Promise<AuthFlowResponse | null> => {
        setSaving(true)
        setError(null)
        try {
            const updated = await authFlowRepo.updateFlow(tenantId, flowId, command)
            logger.info('Auth flow updated', { flowId })
            // Reload flows list
            const list = await authFlowRepo.listFlows(tenantId)
            setFlows(list)
            return updated
        } catch (err) {
            logger.error('Failed to update auth flow', err)
            setError('Failed to update authentication flow')
            return null
        } finally {
            setSaving(false)
        }
    }, [authFlowRepo, logger, tenantId])

    const deleteFlow = useCallback(async (flowId: string): Promise<boolean> => {
        setError(null)
        try {
            await authFlowRepo.deleteFlow(tenantId, flowId)
            logger.info('Auth flow deleted', { flowId })
            setFlows(prev => prev.filter(f => f.id !== flowId))
            return true
        } catch (err) {
            logger.error('Failed to delete auth flow', err)
            setError('Failed to delete authentication flow')
            return false
        }
    }, [authFlowRepo, logger, tenantId])

    const getFlow = useCallback(async (flowId: string): Promise<AuthFlowResponse | null> => {
        setError(null)
        try {
            return await authFlowRepo.getFlow(tenantId, flowId)
        } catch (err) {
            logger.error('Failed to get auth flow', err)
            setError('Failed to load authentication flow')
            return null
        }
    }, [authFlowRepo, logger, tenantId])

    // ── Step Management ─────────────────────────────────────────────────────

    const initSteps = useCallback((initialSteps: AuthFlowStep[]) => {
        setSteps(initialSteps)
    }, [])

    const addStep = useCallback((methodType: AuthMethodType, methodId?: string) => {
        setSteps(prev => {
            const newStep: AuthFlowStep = {
                id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                order: prev.length + 1,
                methodId: methodId ?? methodType,
                methodType,
                isRequired: true,
                timeout: 120,
                maxAttempts: 3,
            }
            return [...prev, newStep]
        })
    }, [])

    const removeStep = useCallback((stepId: string, operationType?: OperationType) => {
        setSteps(prev => {
            const step = prev.find(s => s.id === stepId)
            // Prevent removing password step when it's mandatory
            if (step?.methodType === AuthMethodType.PASSWORD && step.order === 1 && operationType && PASSWORD_MANDATORY_OPS.has(operationType)) {
                return prev
            }
            const filtered = prev.filter(s => s.id !== stepId)
            return filtered.map((s, i) => ({ ...s, order: i + 1 }))
        })
    }, [])

    const reorderSteps = useCallback((reordered: AuthFlowStep[], operationType?: OperationType) => {
        // Prevent password from leaving position 1 when mandatory
        if (operationType && PASSWORD_MANDATORY_OPS.has(operationType)) {
            const passwordIdx = reordered.findIndex(s => s.methodType === AuthMethodType.PASSWORD)
            if (passwordIdx !== 0) return
        }
        setSteps(reordered.map((s, i) => ({ ...s, order: i + 1 })))
    }, [])

    const toggleStepRequired = useCallback((stepId: string) => {
        setSteps(prev =>
            prev.map(s => s.id === stepId ? { ...s, isRequired: !s.isRequired } : s)
        )
    }, [])

    const clearSteps = useCallback(() => {
        setSteps([])
    }, [])

    const clearError = useCallback(() => {
        setError(null)
    }, [])

    return {
        // State
        flows,
        loading,
        saving,
        error,
        steps,
        tenantId,

        // Flow CRUD
        loadFlows,
        createFlow,
        updateFlow,
        deleteFlow,
        getFlow,

        // Step management
        initSteps,
        addStep,
        removeStep,
        reorderSteps,
        toggleStepRequired,
        clearSteps,

        // Utility
        clearError,
    }
}
