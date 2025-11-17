import type { Enrollment } from '@domain/models/Enrollment'
import type { PaginatedResult, QueryParams } from './IRepository'

/**
 * Enrollment Repository interface
 * Handles enrollment data access operations
 */
export interface IEnrollmentRepository {
    /**
     * Find all enrollments with optional filters and pagination
     */
    findAll(params?: QueryParams): Promise<PaginatedResult<Enrollment>>

    /**
     * Find enrollment by ID
     * @returns Enrollment if found, null otherwise
     */
    findById(id: string): Promise<Enrollment | null>

    /**
     * Retry a failed enrollment
     */
    retry(id: string): Promise<Enrollment>

    /**
     * Delete enrollment
     */
    delete(id: string): Promise<void>
}
