import { injectable, inject } from 'inversify'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { IEnrollmentRepository } from '@domain/interfaces/IEnrollmentRepository'
import type { PaginatedResult, QueryParams } from '@domain/interfaces/IRepository'
import { Enrollment, EnrollmentJSON } from '@domain/models/Enrollment'

/**
 * Enrollment Repository
 * Handles enrollment API calls
 */
@injectable()
export class EnrollmentRepository implements IEnrollmentRepository {
    constructor(
        @inject(TYPES.HttpClient) private readonly httpClient: IHttpClient,
        @inject(TYPES.Logger) private readonly logger: ILogger
    ) {}

    /**
     * Find all enrollments
     */
    async findAll(params?: QueryParams): Promise<PaginatedResult<Enrollment>> {
        try {
            this.logger.debug('Fetching all enrollments', { params })

            const flatParams: Record<string, unknown> = {}
            if (params?.page !== undefined) flatParams.page = params.page
            if (params?.pageSize !== undefined) flatParams.size = params.pageSize
            if (params?.sort) flatParams.sort = params.sort
            if (params?.order) flatParams.order = params.order
            if (params?.filters) {
                Object.entries(params.filters).forEach(([key, value]) => {
                    if (value !== undefined && value !== null) {
                        flatParams[key] = value
                    }
                })
            }

            type EnrollmentListResponse =
                | EnrollmentJSON[]
                | { content: EnrollmentJSON[]; totalElements?: number }

            const response = await this.httpClient.get<EnrollmentListResponse>('/enrollments', {
                params: flatParams,
            })

            let enrollments: Enrollment[]
            let total: number

            if (Array.isArray(response.data)) {
                enrollments = response.data.map((data: EnrollmentJSON) => Enrollment.fromJSON(data))
                total = enrollments.length
            } else if ('content' in response.data && response.data.content) {
                enrollments = response.data.content.map((data: EnrollmentJSON) => Enrollment.fromJSON(data))
                total = response.data.totalElements ?? enrollments.length
            } else {
                enrollments = []
                total = 0
            }

            const pageSize = params?.pageSize || 20
            const page = params?.page || 0

            return {
                items: enrollments,
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
            }
        } catch (error) {
            this.logger.error('Failed to fetch enrollments', error)
            throw error
        }
    }

    /**
     * Find enrollment by ID
     */
    async findById(id: string): Promise<Enrollment | null> {
        try {
            this.logger.debug(`Fetching enrollment ${id}`)

            const response = await this.httpClient.get<EnrollmentJSON>(`/enrollments/${id}`)

            return Enrollment.fromJSON(response.data)
        } catch (error: unknown) {
            const axiosError = error as { response?: { status?: number } }
            if (axiosError.response?.status === 404) {
                return null
            }
            this.logger.error(`Failed to fetch enrollment ${id}`, error)
            throw error
        }
    }

    /**
     * Retry a failed enrollment
     */
    async retry(id: string): Promise<Enrollment> {
        try {
            this.logger.info(`Retrying enrollment ${id}`)

            const response = await this.httpClient.post<EnrollmentJSON>(`/enrollments/${id}/retry`, {})

            const enrollment = Enrollment.fromJSON(response.data)

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
    async delete(id: string): Promise<void> {
        try {
            this.logger.info(`Deleting enrollment ${id}`)

            await this.httpClient.delete(`/enrollments/${id}`)

            this.logger.info('Enrollment deleted successfully', { enrollmentId: id })
        } catch (error) {
            this.logger.error(`Failed to delete enrollment ${id}`, error)
            throw error
        }
    }
}
