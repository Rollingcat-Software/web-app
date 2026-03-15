import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { IEnrollmentService, EnrollmentFilters } from '@domain/interfaces/IEnrollmentService'
import type { IEnrollmentRepository, CreateUserEnrollmentData } from '@domain/interfaces/IEnrollmentRepository'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { PaginatedResult } from '@domain/interfaces/IRepository'
import { Enrollment } from '@domain/models/Enrollment'
import { NotFoundError, BusinessError } from '@core/errors'

/**
 * Enrollment Service
 * Handles enrollment business logic
 */
@injectable()
export class EnrollmentService implements IEnrollmentService {
    constructor(
        @inject(TYPES.EnrollmentRepository) private readonly enrollmentRepository: IEnrollmentRepository,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    /**
     * Get all enrollments with optional filters
     */
    async getEnrollments(
        filters?: EnrollmentFilters,
        page: number = 0,
        pageSize: number = 20
    ): Promise<PaginatedResult<Enrollment>> {
        try {
            this.logger.debug('Getting enrollments', { filters, page, pageSize })

            const result = await this.enrollmentRepository.findAll({
                page,
                pageSize,
                filters: filters as Record<string, unknown>,
            })

            return result
        } catch (error) {
            this.logger.error('Failed to get enrollments', error)
            throw error
        }
    }

    /**
     * Get enrollment by ID
     */
    async getEnrollmentById(id: string): Promise<Enrollment> {
        this.logger.debug(`Getting enrollment ${id}`)

        const enrollment = await this.enrollmentRepository.findById(id)

        if (!enrollment) {
            throw new NotFoundError(`Enrollment with ID ${id} not found`)
        }

        return enrollment
    }

    /**
     * Retry a failed enrollment
     */
    async retryEnrollment(id: string): Promise<Enrollment> {
        // Check if enrollment exists
        const existingEnrollment = await this.enrollmentRepository.findById(id)
        if (!existingEnrollment) {
            throw new NotFoundError(`Enrollment with ID ${id} not found`)
        }

        // Business rule: Can only retry failed enrollments
        if (!existingEnrollment.canRetry()) {
            throw new BusinessError(
                `Cannot retry enrollment with status ${existingEnrollment.status}. Only FAILED enrollments can be retried.`
            )
        }

        try {
            this.logger.info(`Retrying enrollment ${id}`)

            const enrollment = await this.enrollmentRepository.retry(id)

            this.logger.info('Enrollment retry initiated successfully', { enrollmentId: enrollment.id })

            return enrollment
        } catch (error) {
            this.logger.error(`Failed to retry enrollment ${id}`, error)
            throw error
        }
    }

    /**
     * Delete enrollment
     */
    async deleteEnrollment(id: string): Promise<void> {
        // Check if enrollment exists
        const existingEnrollment = await this.enrollmentRepository.findById(id)
        if (!existingEnrollment) {
            throw new NotFoundError(`Enrollment with ID ${id} not found`)
        }

        // Business rule: Cannot delete enrollments that are in progress
        if (existingEnrollment.isInProgress()) {
            throw new BusinessError(
                `Cannot delete enrollment with status ${existingEnrollment.status}. Complete or cancel the enrollment first.`
            )
        }

        try {
            this.logger.info(`Deleting enrollment ${id}`)

            await this.enrollmentRepository.delete(id)

            this.logger.info('Enrollment deleted successfully', { enrollmentId: id })
        } catch (error) {
            this.logger.error(`Failed to delete enrollment ${id}`, error)
            throw error
        }
    }

    /**
     * Get all enrollments for a specific user
     */
    async getUserEnrollments(userId: string): Promise<Enrollment[]> {
        try {
            this.logger.debug(`Getting enrollments for user ${userId}`)
            return await this.enrollmentRepository.findByUserId(userId)
        } catch (error) {
            this.logger.error(`Failed to get enrollments for user ${userId}`, error)
            throw error
        }
    }

    /**
     * Create (start) an enrollment for a specific user
     */
    async createUserEnrollment(
        userId: string,
        data: CreateUserEnrollmentData
    ): Promise<Enrollment> {
        try {
            this.logger.info(`Creating enrollment for user ${userId}`, data)
            const enrollment = await this.enrollmentRepository.createForUser(userId, data)
            this.logger.info('User enrollment created successfully', {
                enrollmentId: enrollment.id,
                userId,
            })
            return enrollment
        } catch (error) {
            this.logger.error(`Failed to create enrollment for user ${userId}`, error)
            throw error
        }
    }

    /**
     * Revoke an enrollment for a specific user by auth method type
     */
    async revokeUserEnrollment(userId: string, methodType: string): Promise<void> {
        try {
            this.logger.info(`Revoking enrollment for user ${userId}, method ${methodType}`)
            await this.enrollmentRepository.deleteForUser(userId, methodType)
            this.logger.info('User enrollment revoked successfully', { userId, methodType })
        } catch (error) {
            this.logger.error(
                `Failed to revoke enrollment for user ${userId}, method ${methodType}`,
                error
            )
            throw error
        }
    }
}
