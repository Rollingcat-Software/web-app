import { useState, useEffect, useCallback } from 'react'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IEnrollmentService, EnrollmentFilters } from '@domain/interfaces/IEnrollmentService'
import { Enrollment } from '@domain/models/Enrollment'
import type { ErrorHandler } from '@core/errors'

/**
 * Enrollments state
 */
interface EnrollmentsState {
    enrollments: Enrollment[]
    total: number
    loading: boolean
    error: Error | null
}

/**
 * Use enrollments hook return type
 */
interface UseEnrollmentsReturn extends EnrollmentsState {
    refetch: (filters?: EnrollmentFilters) => Promise<void>
    retryEnrollment: (id: string) => Promise<void>
    deleteEnrollment: (id: string) => Promise<void>
}

/**
 * Custom hook for enrollments management
 * Provides access to enrollment list and operations
 *
 * @example
 * const { enrollments, loading, retryEnrollment, deleteEnrollment } = useEnrollments()
 */
export function useEnrollments(initialFilters?: EnrollmentFilters): UseEnrollmentsReturn {
    const enrollmentService = useService<IEnrollmentService>(TYPES.EnrollmentService)
    const errorHandler = useService<ErrorHandler>(TYPES.ErrorHandler)

    const [state, setState] = useState<EnrollmentsState>({
        enrollments: [],
        total: 0,
        loading: true,
        error: null,
    })

    /**
     * Fetch enrollments
     */
    const fetchEnrollments = useCallback(
        async (filters?: EnrollmentFilters) => {
            setState((prev) => ({ ...prev, loading: true, error: null }))

            try {
                const result = await enrollmentService.getEnrollments(filters)

                setState({
                    enrollments: result.items,
                    total: result.total,
                    loading: false,
                    error: null,
                })
            } catch (error) {
                setState((prev) => ({
                    ...prev,
                    loading: false,
                    error: error as Error,
                }))
                errorHandler.handle(error)
            }
        },
        [enrollmentService, errorHandler]
    )

    /**
     * Load enrollments on mount and when filters change
     */
    useEffect(() => {
        fetchEnrollments(initialFilters)
    }, [fetchEnrollments, initialFilters])

    /**
     * Retry enrollment
     */
    const retryEnrollment = useCallback(
        async (id: string): Promise<void> => {
            try {
                await enrollmentService.retryEnrollment(id)

                // Refresh list after retry
                await fetchEnrollments(initialFilters)
            } catch (error) {
                errorHandler.handle(error)
                throw error
            }
        },
        [enrollmentService, errorHandler, fetchEnrollments, initialFilters]
    )

    /**
     * Delete enrollment
     */
    const deleteEnrollment = useCallback(
        async (id: string): Promise<void> => {
            try {
                await enrollmentService.deleteEnrollment(id)

                // Refresh list after deletion
                await fetchEnrollments(initialFilters)
            } catch (error) {
                errorHandler.handle(error)
                throw error
            }
        },
        [enrollmentService, errorHandler, fetchEnrollments, initialFilters]
    )

    return {
        ...state,
        refetch: fetchEnrollments,
        retryEnrollment,
        deleteEnrollment,
    }
}

/**
 * Hook to get a single enrollment by ID
 */
export function useEnrollment(id: string) {
    const enrollmentService = useService<IEnrollmentService>(TYPES.EnrollmentService)
    const errorHandler = useService<ErrorHandler>(TYPES.ErrorHandler)

    const [state, setState] = useState<{
        enrollment: Enrollment | null
        loading: boolean
        error: Error | null
    }>({
        enrollment: null,
        loading: true,
        error: null,
    })

    useEffect(() => {
        let mounted = true

        const fetchEnrollment = async () => {
            try {
                const enrollment = await enrollmentService.getEnrollmentById(id)
                if (mounted) {
                    setState({ enrollment, loading: false, error: null })
                }
            } catch (error) {
                if (mounted) {
                    setState({ enrollment: null, loading: false, error: error as Error })
                    errorHandler.handle(error)
                }
            }
        }

        fetchEnrollment()

        return () => {
            mounted = false
        }
    }, [id, enrollmentService, errorHandler])

    return state
}
