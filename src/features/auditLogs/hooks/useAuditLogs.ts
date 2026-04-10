import { useState, useEffect, useCallback } from 'react'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IAuditLogService, AuditLogFilters } from '@domain/interfaces/IAuditLogService'
import { AuditLog } from '@domain/models/AuditLog'
import type { ErrorHandler } from '@core/errors'

/**
 * AuditLogs state
 */
interface AuditLogsState {
    auditLogs: AuditLog[]
    total: number
    loading: boolean
    error: Error | null
}

/**
 * Use audit logs hook return type
 */
interface UseAuditLogsReturn extends AuditLogsState {
    refetch: (filters?: AuditLogFilters) => Promise<void>
}

/**
 * Custom hook for audit logs management
 * Provides access to audit log list and read operations
 * Note: Read-only - no create/update/delete mutations
 *
 * @example
 * const { auditLogs, loading, total, refetch } = useAuditLogs()
 */
export function useAuditLogs(initialFilters?: AuditLogFilters): UseAuditLogsReturn {
    const auditLogService = useService<IAuditLogService>(TYPES.AuditLogService)
    const errorHandler = useService<ErrorHandler>(TYPES.ErrorHandler)

    const [state, setState] = useState<AuditLogsState>({
        auditLogs: [],
        total: 0,
        loading: true,
        error: null,
    })

    /**
     * Fetch audit logs
     */
    const fetchAuditLogs = useCallback(
        async (filters?: AuditLogFilters) => {
            setState((prev) => ({ ...prev, loading: true, error: null }))

            try {
                const result = await auditLogService.getAuditLogs(filters)

                setState({
                    auditLogs: result.items,
                    total: result.total,
                    loading: false,
                    error: null,
                })
            } catch (error) {
                const axiosError = error as { response?: { status?: number } }
                if (axiosError.response?.status === 403) {
                    // Non-admin: return empty data silently
                    setState({ auditLogs: [], total: 0, loading: false, error: null })
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
        [auditLogService, errorHandler]
    )

    /**
     * Load audit logs on mount and when filters change
     */
    const filtersKey = JSON.stringify(initialFilters)
    useEffect(() => {
        fetchAuditLogs(initialFilters)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchAuditLogs, filtersKey])

    return {
        ...state,
        refetch: fetchAuditLogs,
    }
}

/**
 * Hook to get a single audit log by ID
 */
export function useAuditLog(id: string) {
    const auditLogService = useService<IAuditLogService>(TYPES.AuditLogService)
    const errorHandler = useService<ErrorHandler>(TYPES.ErrorHandler)

    const [state, setState] = useState<{
        auditLog: AuditLog | null
        loading: boolean
        error: Error | null
    }>({
        auditLog: null,
        loading: true,
        error: null,
    })

    useEffect(() => {
        let mounted = true

        const fetchAuditLog = async () => {
            try {
                const auditLog = await auditLogService.getAuditLogById(id)
                if (mounted) {
                    setState({ auditLog, loading: false, error: null })
                }
            } catch (error) {
                if (mounted) {
                    setState({ auditLog: null, loading: false, error: error as Error })
                    errorHandler.handle(error)
                }
            }
        }

        fetchAuditLog()

        return () => {
            mounted = false
        }
    }, [id, auditLogService, errorHandler])

    return state
}
