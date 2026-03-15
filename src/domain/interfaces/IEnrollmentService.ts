import type { Enrollment, EnrollmentStatus } from '@domain/models/Enrollment'
import type { PaginatedResult } from './IRepository'
import type { CreateUserEnrollmentData } from './IEnrollmentRepository'

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

    /**
     * Get all enrollments for a specific user
     */
    getUserEnrollments(userId: string): Promise<Enrollment[]>

    /**
     * Create (start) an enrollment for a specific user
     */
    createUserEnrollment(userId: string, data: CreateUserEnrollmentData): Promise<Enrollment>

    /**
     * Revoke an enrollment for a specific user by auth method type
     */
    revokeUserEnrollment(userId: string, methodType: string): Promise<void>
}
