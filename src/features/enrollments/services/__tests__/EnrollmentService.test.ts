import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EnrollmentService } from '../EnrollmentService'
import type { IEnrollmentRepository, CreateUserEnrollmentData } from '@domain/interfaces/IEnrollmentRepository'
import type { ILogger } from '@domain/interfaces/ILogger'
import type { PaginatedResult } from '@domain/interfaces/IRepository'
import { Enrollment, EnrollmentStatus } from '@domain/models/Enrollment'
import { NotFoundError, BusinessError } from '@core/errors'
import type { EnrollmentFilters } from '@domain/interfaces/IEnrollmentService'

describe('EnrollmentService', () => {
    let enrollmentService: EnrollmentService
    let mockEnrollmentRepository: IEnrollmentRepository
    let mockLogger: ILogger

    const mockEnrollment = new Enrollment(
        '1',
        'user-1',
        'tenant-1',
        EnrollmentStatus.ENROLLED,
        'https://example.com/face.jpg',
        new Date(),
        new Date(),
        'FACE',
        0.95,
        0.98
    )

    const mockFailedEnrollment = new Enrollment(
        '2',
        'user-1',
        'tenant-1',
        EnrollmentStatus.FAILED,
        'https://example.com/face.jpg',
        new Date(),
        new Date(),
        'FACE',
        0.3,
        0.2,
        'LOW_QUALITY',
        'Face quality too low'
    )

    const mockPendingEnrollment = new Enrollment(
        '3',
        'user-1',
        'tenant-1',
        EnrollmentStatus.PENDING,
        '',
        new Date(),
        new Date(),
        'FACE'
    )

    const mockProcessingEnrollment = new Enrollment(
        '4',
        'user-1',
        'tenant-1',
        EnrollmentStatus.PROCESSING,
        '',
        new Date(),
        new Date(),
        'FACE'
    )

    beforeEach(() => {
        // Create mock repository
        mockEnrollmentRepository = {
            findAll: vi.fn(),
            findById: vi.fn(),
            retry: vi.fn(),
            delete: vi.fn(),
            findByUserId: vi.fn(),
            createForUser: vi.fn(),
            deleteForUser: vi.fn(),
        }

        // Create mock logger
        mockLogger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        }

        // Create service instance with mocks
        enrollmentService = new EnrollmentService(mockEnrollmentRepository, mockLogger)
    })

    describe('getEnrollments', () => {
        it('should get enrollments with filters successfully', async () => {
            // Arrange
            const filters: EnrollmentFilters = {
                status: EnrollmentStatus.ENROLLED,
            }
            const mockResult: PaginatedResult<Enrollment> = {
                items: [mockEnrollment],
                total: 1,
                page: 0,
                pageSize: 20,
                totalPages: 1,
            }

            vi.mocked(mockEnrollmentRepository.findAll).mockResolvedValue(mockResult)

            // Act
            const result = await enrollmentService.getEnrollments(filters, 0, 20)

            // Assert
            expect(mockEnrollmentRepository.findAll).toHaveBeenCalledWith({
                page: 0,
                pageSize: 20,
                filters: filters as Record<string, unknown>,
            })
            expect(result).toEqual(mockResult)
            expect(mockLogger.debug).toHaveBeenCalledWith('Getting enrollments', {
                filters,
                page: 0,
                pageSize: 20,
            })
        })

        it('should get enrollments without filters', async () => {
            // Arrange
            const mockResult: PaginatedResult<Enrollment> = {
                items: [mockEnrollment],
                total: 1,
                page: 0,
                pageSize: 20,
                totalPages: 1,
            }

            vi.mocked(mockEnrollmentRepository.findAll).mockResolvedValue(mockResult)

            // Act
            const result = await enrollmentService.getEnrollments()

            // Assert
            expect(mockEnrollmentRepository.findAll).toHaveBeenCalledWith({
                page: 0,
                pageSize: 20,
                filters: undefined,
            })
            expect(result).toEqual(mockResult)
        })

        it('should handle repository errors', async () => {
            // Arrange
            const error = new Error('Database error')
            vi.mocked(mockEnrollmentRepository.findAll).mockRejectedValue(error)

            // Act & Assert
            await expect(enrollmentService.getEnrollments()).rejects.toThrow('Database error')
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to get enrollments', error)
        })
    })

    describe('getEnrollmentById', () => {
        it('should get enrollment by ID when found', async () => {
            // Arrange
            vi.mocked(mockEnrollmentRepository.findById).mockResolvedValue(mockEnrollment)

            // Act
            const result = await enrollmentService.getEnrollmentById('1')

            // Assert
            expect(mockEnrollmentRepository.findById).toHaveBeenCalledWith('1')
            expect(result).toEqual(mockEnrollment)
            expect(mockLogger.debug).toHaveBeenCalledWith('Getting enrollment 1')
        })

        it('should throw NotFoundError when enrollment not found', async () => {
            // Arrange
            vi.mocked(mockEnrollmentRepository.findById).mockResolvedValue(null)

            // Act & Assert
            await expect(enrollmentService.getEnrollmentById('999')).rejects.toThrow(NotFoundError)
            await expect(enrollmentService.getEnrollmentById('999')).rejects.toThrow(
                'Enrollment with ID 999 not found'
            )
        })
    })

    describe('retryEnrollment', () => {
        it('should retry a failed enrollment successfully', async () => {
            // Arrange
            const retriedEnrollment = new Enrollment(
                '2',
                'user-1',
                'tenant-1',
                EnrollmentStatus.PENDING,
                'https://example.com/face.jpg',
                new Date(),
                new Date(),
                'FACE'
            )

            vi.mocked(mockEnrollmentRepository.findById).mockResolvedValue(mockFailedEnrollment)
            vi.mocked(mockEnrollmentRepository.retry).mockResolvedValue(retriedEnrollment)

            // Act
            const result = await enrollmentService.retryEnrollment('2')

            // Assert
            expect(mockEnrollmentRepository.findById).toHaveBeenCalledWith('2')
            expect(mockEnrollmentRepository.retry).toHaveBeenCalledWith('2')
            expect(result).toEqual(retriedEnrollment)
            expect(mockLogger.info).toHaveBeenCalledWith('Retrying enrollment 2')
            expect(mockLogger.info).toHaveBeenCalledWith('Enrollment retry initiated successfully', {
                enrollmentId: retriedEnrollment.id,
            })
        })

        it('should throw NotFoundError when enrollment not found', async () => {
            // Arrange
            vi.mocked(mockEnrollmentRepository.findById).mockResolvedValue(null)

            // Act & Assert
            await expect(enrollmentService.retryEnrollment('999')).rejects.toThrow(NotFoundError)
            await expect(enrollmentService.retryEnrollment('999')).rejects.toThrow(
                'Enrollment with ID 999 not found'
            )
            expect(mockEnrollmentRepository.retry).not.toHaveBeenCalled()
        })

        it('should throw BusinessError when enrollment is not failed', async () => {
            // Arrange
            vi.mocked(mockEnrollmentRepository.findById).mockResolvedValue(mockEnrollment)

            // Act & Assert
            await expect(enrollmentService.retryEnrollment('1')).rejects.toThrow(BusinessError)
            await expect(enrollmentService.retryEnrollment('1')).rejects.toThrow(
                `Cannot retry enrollment with status ${EnrollmentStatus.ENROLLED}. Only FAILED enrollments can be retried.`
            )
            expect(mockEnrollmentRepository.retry).not.toHaveBeenCalled()
        })

        it('should throw BusinessError when enrollment is pending', async () => {
            // Arrange
            vi.mocked(mockEnrollmentRepository.findById).mockResolvedValue(mockPendingEnrollment)

            // Act & Assert
            await expect(enrollmentService.retryEnrollment('3')).rejects.toThrow(BusinessError)
            expect(mockEnrollmentRepository.retry).not.toHaveBeenCalled()
        })

        it('should handle repository errors', async () => {
            // Arrange
            const error = new Error('Database error')
            vi.mocked(mockEnrollmentRepository.findById).mockResolvedValue(mockFailedEnrollment)
            vi.mocked(mockEnrollmentRepository.retry).mockRejectedValue(error)

            // Act & Assert
            await expect(enrollmentService.retryEnrollment('2')).rejects.toThrow('Database error')
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to retry enrollment 2', error)
        })
    })

    describe('deleteEnrollment', () => {
        it('should delete enrollment successfully', async () => {
            // Arrange
            vi.mocked(mockEnrollmentRepository.findById).mockResolvedValue(mockEnrollment)
            vi.mocked(mockEnrollmentRepository.delete).mockResolvedValue(undefined)

            // Act
            await enrollmentService.deleteEnrollment('1')

            // Assert
            expect(mockEnrollmentRepository.findById).toHaveBeenCalledWith('1')
            expect(mockEnrollmentRepository.delete).toHaveBeenCalledWith('1')
            expect(mockLogger.info).toHaveBeenCalledWith('Deleting enrollment 1')
            expect(mockLogger.info).toHaveBeenCalledWith('Enrollment deleted successfully', {
                enrollmentId: '1',
            })
        })

        it('should throw NotFoundError when enrollment not found', async () => {
            // Arrange
            vi.mocked(mockEnrollmentRepository.findById).mockResolvedValue(null)

            // Act & Assert
            await expect(enrollmentService.deleteEnrollment('999')).rejects.toThrow(NotFoundError)
            await expect(enrollmentService.deleteEnrollment('999')).rejects.toThrow(
                'Enrollment with ID 999 not found'
            )
            expect(mockEnrollmentRepository.delete).not.toHaveBeenCalled()
        })

        it('should throw BusinessError when enrollment is pending', async () => {
            // Arrange
            vi.mocked(mockEnrollmentRepository.findById).mockResolvedValue(mockPendingEnrollment)

            // Act & Assert
            await expect(enrollmentService.deleteEnrollment('3')).rejects.toThrow(BusinessError)
            await expect(enrollmentService.deleteEnrollment('3')).rejects.toThrow(
                `Cannot delete enrollment with status ${EnrollmentStatus.PENDING}. Complete or cancel the enrollment first.`
            )
            expect(mockEnrollmentRepository.delete).not.toHaveBeenCalled()
        })

        it('should throw BusinessError when enrollment is processing', async () => {
            // Arrange
            vi.mocked(mockEnrollmentRepository.findById).mockResolvedValue(mockProcessingEnrollment)

            // Act & Assert
            await expect(enrollmentService.deleteEnrollment('4')).rejects.toThrow(BusinessError)
            await expect(enrollmentService.deleteEnrollment('4')).rejects.toThrow(
                `Cannot delete enrollment with status ${EnrollmentStatus.PROCESSING}. Complete or cancel the enrollment first.`
            )
            expect(mockEnrollmentRepository.delete).not.toHaveBeenCalled()
        })

        it('should allow deleting a failed enrollment', async () => {
            // Arrange
            vi.mocked(mockEnrollmentRepository.findById).mockResolvedValue(mockFailedEnrollment)
            vi.mocked(mockEnrollmentRepository.delete).mockResolvedValue(undefined)

            // Act
            await enrollmentService.deleteEnrollment('2')

            // Assert
            expect(mockEnrollmentRepository.delete).toHaveBeenCalledWith('2')
        })

        it('should handle repository errors', async () => {
            // Arrange
            const error = new Error('Database error')
            vi.mocked(mockEnrollmentRepository.findById).mockResolvedValue(mockEnrollment)
            vi.mocked(mockEnrollmentRepository.delete).mockRejectedValue(error)

            // Act & Assert
            await expect(enrollmentService.deleteEnrollment('1')).rejects.toThrow('Database error')
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to delete enrollment 1', error)
        })
    })

    describe('getUserEnrollments', () => {
        it('should get enrollments for a user successfully', async () => {
            // Arrange
            vi.mocked(mockEnrollmentRepository.findByUserId).mockResolvedValue([mockEnrollment])

            // Act
            const result = await enrollmentService.getUserEnrollments('user-1')

            // Assert
            expect(mockEnrollmentRepository.findByUserId).toHaveBeenCalledWith('user-1')
            expect(result).toEqual([mockEnrollment])
            expect(mockLogger.debug).toHaveBeenCalledWith('Getting enrollments for user user-1')
        })

        it('should return empty array when user has no enrollments', async () => {
            // Arrange
            vi.mocked(mockEnrollmentRepository.findByUserId).mockResolvedValue([])

            // Act
            const result = await enrollmentService.getUserEnrollments('user-2')

            // Assert
            expect(result).toEqual([])
        })

        it('should handle repository errors', async () => {
            // Arrange
            const error = new Error('Database error')
            vi.mocked(mockEnrollmentRepository.findByUserId).mockRejectedValue(error)

            // Act & Assert
            await expect(enrollmentService.getUserEnrollments('user-1')).rejects.toThrow('Database error')
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to get enrollments for user user-1',
                error
            )
        })
    })

    describe('createUserEnrollment', () => {
        const validData: CreateUserEnrollmentData = {
            tenantId: 'tenant-1',
            methodType: 'FACE',
        }

        it('should create user enrollment successfully', async () => {
            // Arrange
            const newEnrollment = new Enrollment(
                '5',
                'user-1',
                'tenant-1',
                EnrollmentStatus.PENDING,
                '',
                new Date(),
                new Date(),
                'FACE'
            )

            vi.mocked(mockEnrollmentRepository.createForUser).mockResolvedValue(newEnrollment)

            // Act
            const result = await enrollmentService.createUserEnrollment('user-1', validData)

            // Assert
            expect(mockEnrollmentRepository.createForUser).toHaveBeenCalledWith('user-1', validData)
            expect(result).toEqual(newEnrollment)
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Creating enrollment for user user-1',
                validData
            )
            expect(mockLogger.info).toHaveBeenCalledWith('User enrollment created successfully', {
                enrollmentId: newEnrollment.id,
                userId: 'user-1',
            })
        })

        it('should handle repository errors', async () => {
            // Arrange
            const error = new Error('Database error')
            vi.mocked(mockEnrollmentRepository.createForUser).mockRejectedValue(error)

            // Act & Assert
            await expect(
                enrollmentService.createUserEnrollment('user-1', validData)
            ).rejects.toThrow('Database error')
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to create enrollment for user user-1',
                error
            )
        })
    })

    describe('revokeUserEnrollment', () => {
        it('should revoke user enrollment successfully', async () => {
            // Arrange
            vi.mocked(mockEnrollmentRepository.deleteForUser).mockResolvedValue(undefined)

            // Act
            await enrollmentService.revokeUserEnrollment('user-1', 'FACE')

            // Assert
            expect(mockEnrollmentRepository.deleteForUser).toHaveBeenCalledWith('user-1', 'FACE')
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Revoking enrollment for user user-1, method FACE'
            )
            expect(mockLogger.info).toHaveBeenCalledWith('User enrollment revoked successfully', {
                userId: 'user-1',
                methodType: 'FACE',
            })
        })

        it('should handle repository errors', async () => {
            // Arrange
            const error = new Error('Database error')
            vi.mocked(mockEnrollmentRepository.deleteForUser).mockRejectedValue(error)

            // Act & Assert
            await expect(
                enrollmentService.revokeUserEnrollment('user-1', 'FACE')
            ).rejects.toThrow('Database error')
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to revoke enrollment for user user-1, method FACE',
                error
            )
        })
    })
})
