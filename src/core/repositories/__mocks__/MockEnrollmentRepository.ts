import { injectable } from 'inversify'
import type { IEnrollmentRepository } from '@domain/interfaces/IEnrollmentRepository'
import type { PaginatedResult, QueryParams } from '@domain/interfaces/IRepository'
import { Enrollment, EnrollmentStatus } from '@domain/models/Enrollment'

@injectable()
export class MockEnrollmentRepository implements IEnrollmentRepository {
    private enrollments = new Map<string, Enrollment>([
        [
            '1',
            new Enrollment(
                '1',
                '1',
                '1',
                EnrollmentStatus.ENROLLED,
                '',
                new Date(),
                new Date(),
                'FACE'
            ),
        ],
        [
            '2',
            new Enrollment(
                '2',
                '2',
                '1',
                EnrollmentStatus.FAILED,
                '',
                new Date(),
                new Date(),
                'FACE',
                0.45,
                0.5,
                'QUALITY_LOW',
                'Image quality is low'
            ),
        ],
    ])

    async findAll(params?: QueryParams): Promise<PaginatedResult<Enrollment>> {
        const page = params?.page ?? 0
        const pageSize = params?.pageSize ?? 20
        const filters = params?.filters ?? {}

        const filtered = Array.from(this.enrollments.values()).filter((enrollment) => {
            const statusFilter = filters.status as string | undefined
            const userIdFilter = filters.userId as string | undefined

            if (statusFilter && enrollment.status !== statusFilter) {
                return false
            }

            if (userIdFilter && enrollment.userId !== userIdFilter) {
                return false
            }

            return true
        })

        const start = page * pageSize
        const items = filtered.slice(start, start + pageSize)

        return {
            items,
            total: filtered.length,
            page,
            pageSize,
            totalPages: filtered.length === 0 ? 0 : Math.ceil(filtered.length / pageSize),
        }
    }

    async findById(id: string): Promise<Enrollment | null> {
        return this.enrollments.get(id) ?? null
    }

    async retry(id: string): Promise<Enrollment> {
        const current = this.enrollments.get(id)
        if (!current) {
            throw new Error(`Enrollment not found: ${id}`)
        }

        const updated = new Enrollment(
            current.id,
            current.userId,
            current.tenantId,
            EnrollmentStatus.PENDING,
            current.faceImageUrl,
            current.createdAt,
            new Date(),
            current.authMethodType
        )

        this.enrollments.set(id, updated)
        return updated
    }

    async delete(id: string): Promise<void> {
        this.enrollments.delete(id)
    }
}
