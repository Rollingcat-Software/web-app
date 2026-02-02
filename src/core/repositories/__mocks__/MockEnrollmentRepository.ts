import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { IEnrollmentRepository } from '@domain/interfaces/IEnrollmentRepository'
import type { PaginatedResult, QueryParams } from '@domain/interfaces/IRepository'
import { Enrollment, EnrollmentStatus } from '@domain/models/Enrollment'

/**
 * Mock Enrollment Repository
 * Provides fake enrollment data for development/testing
 */
@injectable()
export class MockEnrollmentRepository implements IEnrollmentRepository {
    private enrollments: Enrollment[]

    constructor(@inject(TYPES.Logger) private readonly logger: ILogger) {
        // Initialize with mock enrollments
        this.enrollments = [
            new Enrollment(
                'enr_1234567890',
                '1',
                '1',
                EnrollmentStatus.SUCCESS,
                'https://example.com/faces/user1.jpg',
                new Date('2025-11-17T10:00:00Z'),
                new Date('2025-11-17T10:00:15Z'),
                0.95,
                0.98,
                undefined,
                undefined,
                new Date('2025-11-17T10:00:15Z')
            ),
            new Enrollment(
                'enr_0987654321',
                '2',
                '1',
                EnrollmentStatus.SUCCESS,
                'https://example.com/faces/user2.jpg',
                new Date('2025-11-16T14:30:00Z'),
                new Date('2025-11-16T14:30:12Z'),
                0.88,
                0.92,
                undefined,
                undefined,
                new Date('2025-11-16T14:30:12Z')
            ),
            new Enrollment(
                'enr_1122334455',
                '3',
                '1',
                EnrollmentStatus.PENDING,
                'https://example.com/faces/user3.jpg',
                new Date('2025-11-17T09:00:00Z'),
                new Date('2025-11-17T09:00:00Z')
            ),
            new Enrollment(
                'enr_5544332211',
                '4',
                '1',
                EnrollmentStatus.FAILED,
                'https://example.com/faces/user4.jpg',
                new Date('2025-11-15T11:00:00Z'),
                new Date('2025-11-15T11:00:08Z'),
                0.42,
                undefined,
                'LOW_QUALITY',
                'Face image quality below threshold',
                new Date('2025-11-15T11:00:08Z')
            ),
            new Enrollment(
                'enr_6677889900',
                '5',
                '1',
                EnrollmentStatus.PROCESSING,
                'https://example.com/faces/user5.jpg',
                new Date('2025-11-17T08:45:00Z'),
                new Date('2025-11-17T08:45:05Z')
            ),
        ]
    }

    async findAll(params?: QueryParams): Promise<PaginatedResult<Enrollment>> {
        this.logger.debug('Mock: Fetching all enrollments', { params })
        await this.delay(400)

        let filteredEnrollments = [...this.enrollments]

        // Apply filters if provided
        if (params?.filters) {
            const { status, userId, tenantId } = params.filters as any

            if (status) {
                filteredEnrollments = filteredEnrollments.filter((e) => e.status === status)
            }

            if (userId) {
                filteredEnrollments = filteredEnrollments.filter((e) => e.userId === userId)
            }

            if (tenantId) {
                filteredEnrollments = filteredEnrollments.filter((e) => e.tenantId === tenantId)
            }
        }

        const pageSize = params?.pageSize || 20
        const page = params?.page || 0
        const startIndex = page * pageSize
        const endIndex = startIndex + pageSize

        return {
            items: filteredEnrollments.slice(startIndex, endIndex),
            total: filteredEnrollments.length,
            page,
            pageSize,
            totalPages: Math.ceil(filteredEnrollments.length / pageSize),
        }
    }

    async findById(id: string): Promise<Enrollment | null> {
        this.logger.debug(`Mock: Fetching enrollment ${id}`)
        await this.delay(300)

        const enrollment = this.enrollments.find((e) => e.id === id)
        return enrollment || null
    }

    async retry(id: string): Promise<Enrollment> {
        this.logger.info(`Mock: Retrying enrollment ${id}`)
        await this.delay(500)

        const index = this.enrollments.findIndex((e) => e.id === id)
        if (index === -1) {
            throw new Error('Enrollment not found')
        }

        const existingEnrollment = this.enrollments[index]

        // Create updated enrollment (immutable) with status reset to PENDING
        const updatedEnrollment = new Enrollment(
            existingEnrollment.id,
            existingEnrollment.userId,
            existingEnrollment.tenantId,
            EnrollmentStatus.PENDING,
            existingEnrollment.faceImageUrl,
            existingEnrollment.createdAt,
            new Date(), // Update timestamp
            existingEnrollment.qualityScore,
            existingEnrollment.livenessScore,
            undefined, // Clear error code
            undefined, // Clear error message
            undefined // Clear completed at
        )

        this.enrollments[index] = updatedEnrollment

        return updatedEnrollment
    }

    async delete(id: string): Promise<void> {
        this.logger.info(`Mock: Deleting enrollment ${id}`)
        await this.delay(300)

        const index = this.enrollments.findIndex((e) => e.id === id)
        if (index !== -1) {
            this.enrollments.splice(index, 1)
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }
}
