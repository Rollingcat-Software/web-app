import { useState, useEffect, useCallback } from 'react'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IEnrollmentService, EnrollmentFilters } from '@domain/interfaces/IEnrollmentService'
import type { CreateUserEnrollmentData } from '@domain/interfaces/IEnrollmentRepository'
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
    const filtersKey = JSON.stringify(initialFilters)
    useEffect(() => {
        fetchEnrollments(initialFilters)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchEnrollments, filtersKey])

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [enrollmentService, errorHandler, fetchEnrollments, filtersKey]
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [enrollmentService, errorHandler, fetchEnrollments, filtersKey]
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

/**
 * Per-user enrollments state
 */
interface UserEnrollmentsState {
    enrollments: Enrollment[]
    loading: boolean
    error: Error | null
}

/**
 * Use user enrollments hook return type
 */
interface UseUserEnrollmentsReturn extends UserEnrollmentsState {
    refetch: () => Promise<void>
    createEnrollment: (data: CreateUserEnrollmentData) => Promise<Enrollment>
    revokeEnrollment: (methodType: string) => Promise<void>
}

/**
 * Custom hook for per-user enrollment management
 * Uses the /users/{userId}/enrollments endpoints
 *
 * @example
 * const { enrollments, loading, createEnrollment, revokeEnrollment } = useUserEnrollments(userId)
 */
export function useUserEnrollments(userId: string): UseUserEnrollmentsReturn {
    const enrollmentService = useService<IEnrollmentService>(TYPES.EnrollmentService)
    const errorHandler = useService<ErrorHandler>(TYPES.ErrorHandler)

    const [state, setState] = useState<UserEnrollmentsState>({
        enrollments: [],
        loading: true,
        error: null,
    })

    const fetchEnrollments = useCallback(async () => {
        if (!userId) return
        setState((prev) => ({ ...prev, loading: true, error: null }))
        try {
            const enrollments = await enrollmentService.getUserEnrollments(userId)
            setState({ enrollments, loading: false, error: null })
        } catch (error) {
            setState((prev) => ({ ...prev, loading: false, error: error as Error }))
            errorHandler.handle(error)
        }
    }, [userId, enrollmentService, errorHandler])

    useEffect(() => {
        fetchEnrollments()
    }, [fetchEnrollments])

    const createEnrollment = useCallback(
        async (data: CreateUserEnrollmentData): Promise<Enrollment> => {
            try {
                const enrollment = await enrollmentService.createUserEnrollment(userId, data)
                await fetchEnrollments()
                return enrollment
            } catch (error) {
                errorHandler.handle(error)
                throw error
            }
        },
        [userId, enrollmentService, errorHandler, fetchEnrollments]
    )

    const revokeEnrollment = useCallback(
        async (methodType: string): Promise<void> => {
            try {
                await enrollmentService.revokeUserEnrollment(userId, methodType)
                await fetchEnrollments()
            } catch (error) {
                errorHandler.handle(error)
                throw error
            }
        },
        [userId, enrollmentService, errorHandler, fetchEnrollments]
    )

    return {
        ...state,
        refetch: fetchEnrollments,
        createEnrollment,
        revokeEnrollment,
    }
}
