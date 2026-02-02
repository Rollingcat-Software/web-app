import type { Enrollment, EnrollmentStatus } from '@domain/models/Enrollment'
import type { PaginatedResult } from './IRepository'

/**
 * Enrollment filters for querying
 */
export interface EnrollmentFilters {
    status?: EnrollmentStatus
    userId?: string
    tenantId?: string
}

/**
 * Enrollment Service interface
 * Handles enrollment business logic
 */
export interface IEnrollmentService {
    /**
     * Get all enrollments with optional filters
     */
    getEnrollments(
        filters?: EnrollmentFilters,
        page?: number,
        pageSize?: number
    ): Promise<PaginatedResult<Enrollment>>

    /**
     * Get enrollment by ID
     * @throws NotFoundError if enrollment doesn't exist
     */
    getEnrollmentById(id: string): Promise<Enrollment>

    /**
     * Retry a failed enrollment
     * @throws NotFoundError if enrollment doesn't exist
     * @throws BusinessError if enrollment cannot be retried
     */
    retryEnrollment(id: string): Promise<Enrollment>

    /**
     * Delete enrollment
     * @throws NotFoundError if enrollment doesn't exist
     */
    deleteEnrollment(id: string): Promise<void>
}
