import type { Enrollment } from '@domain/models/Enrollment'
import type { PaginatedResult, QueryParams } from './IRepository'

/**
 * Data required to create an enrollment for a specific user
 */
export interface CreateUserEnrollmentData {
    tenantId: string
    methodType: string
}

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

    /**
     * Get all enrollments for a specific user
     * Calls GET /users/{userId}/enrollments
     */
    findByUserId(userId: string): Promise<Enrollment[]>

    /**
     * Create (start) an enrollment for a specific user
     * Calls POST /users/{userId}/enrollments?tenantId=...&methodType=...
     */
    createForUser(userId: string, data: CreateUserEnrollmentData): Promise<Enrollment>

    /**
     * Revoke an enrollment for a specific user by auth method type
     * Calls DELETE /users/{userId}/enrollments/{methodType}
     */
    deleteForUser(userId: string, methodType: string): Promise<void>
}
