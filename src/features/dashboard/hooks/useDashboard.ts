import { useState, useEffect, useCallback, useRef } from 'react'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IDashboardService } from '@domain/interfaces/IDashboardService'
import { DashboardStats } from '@domain/models/DashboardStats'
import type { ErrorHandler } from '@core/errors'

/**
 * Dashboard state
 */
interface DashboardState {
    stats: DashboardStats | null
    loading: boolean
    error: Error | null
}

/**
 * Dashboard hook return type
 */
interface UseDashboardReturn extends DashboardState {
    refetch: () => Promise<void>
}

/**
 * Custom hook for dashboard statistics
 * Provides access to dashboard stats and operations
 *
 * @example
 * const { stats, loading, error, refetch } = useDashboard()
 */
export function useDashboard(): UseDashboardReturn {
    const dashboardService = useService<IDashboardService>(TYPES.DashboardService)
    const errorHandler = useService<ErrorHandler>(TYPES.ErrorHandler)
    const mountedRef = useRef(true)

    const [state, setState] = useState<DashboardState>({
        stats: null,
        loading: true,
        error: null,
    })

    /**
     * Fetch dashboard statistics
     */
    const fetchStats = useCallback(async () => {
        setState((prev) => ({ ...prev, loading: true, error: null }))

        try {
            const stats = await dashboardService.getStats()

            if (mountedRef.current) {
                setState({
                    stats,
                    loading: false,
                    error: null,
                })
            }
        } catch (error) {
            if (mountedRef.current) {
                setState({
                    stats: null,
                    loading: false,
                    error: error instanceof Error ? error : new Error(String(error)),
                })

                errorHandler.handle(error)
            }
        }
    }, [dashboardService, errorHandler])

    /**
     * Load dashboard stats on mount with cleanup
     */
    useEffect(() => {
        mountedRef.current = true
        fetchStats()

        return () => {
            mountedRef.current = false
        }
    }, [fetchStats])

    return {
        ...state,
        refetch: fetchStats,
    }
}
