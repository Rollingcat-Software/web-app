import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { Container } from 'inversify'
import { DependencyProvider } from '@app/providers'
import { TYPES } from '@core/di/types'
import { useEnrollments, useEnrollment, useUserEnrollments } from '../useEnrollments'
import { createTestContainer } from '@test/testUtils'
import type { IEnrollmentService } from '@domain/interfaces/IEnrollmentService'
import type { ErrorHandler } from '@core/errors'
import { Enrollment, EnrollmentStatus } from '@domain/models/Enrollment'

describe('useEnrollments', () => {
    let container: Container
    let mockEnrollmentService: jest.Mocked<IEnrollmentService>
    let mockErrorHandler: jest.Mocked<ErrorHandler>

    // Test data
    const testEnrollments = [
        new Enrollment(
            '1',
            'user-1',
            'tenant-1',
            EnrollmentStatus.SUCCESS,
            'http://img1.jpg',
            new Date('2024-01-01'),
            new Date('2024-01-01'),
            'FACE',
            0.95,
            0.98
        ),
        new Enrollment(
            '2',
            'user-2',
            'tenant-1',
            EnrollmentStatus.FAILED,
            'http://img2.jpg',
            new Date('2024-01-02'),
            new Date('2024-01-02'),
            'FACE',
            0.3,
            0.2
        ),
    ]

    beforeEach(() => {
        container = createTestContainer()
        mockEnrollmentService = container.get<IEnrollmentService>(
            TYPES.EnrollmentService
        ) as jest.Mocked<IEnrollmentService>
        mockErrorHandler = container.get<ErrorHandler>(TYPES.ErrorHandler) as jest.Mocked<ErrorHandler>

        vi.clearAllMocks()
    })

    const wrapper = ({ children }: { children: ReactNode }) => (
        <DependencyProvider container={container}>{children}</DependencyProvider>
    )

    describe('initial loading state', () => {
        it('should start with loading state', () => {
            mockEnrollmentService.getEnrollments = vi.fn().mockImplementation(
                () => new Promise(() => {}) // Never resolves
            )

            const { result } = renderHook(() => useEnrollments(), { wrapper })

            expect(result.current.loading).toBe(true)
            expect(result.current.enrollments).toEqual([])
            expect(result.current.total).toBe(0)
            expect(result.current.error).toBeNull()
        })
    })

    describe('successful fetch on mount', () => {
        it('should fetch enrollments successfully on mount', async () => {
            mockEnrollmentService.getEnrollments = vi.fn().mockResolvedValue({
                items: testEnrollments,
                total: 2,
            })

            const { result } = renderHook(() => useEnrollments(), { wrapper })

            // Initially loading
            expect(result.current.loading).toBe(true)

            // Wait for enrollments to load
            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            expect(result.current.enrollments).toEqual(testEnrollments)
            expect(result.current.total).toBe(2)
            expect(result.current.error).toBeNull()
            expect(mockEnrollmentService.getEnrollments).toHaveBeenCalledTimes(1)
        })
    })

    describe('error handling', () => {
        it('should handle initial fetch error', async () => {
            const error = new Error('Failed to fetch enrollments')
            mockEnrollmentService.getEnrollments = vi.fn().mockRejectedValue(error)
            mockErrorHandler.handle = vi.fn()

            const { result } = renderHook(() => useEnrollments(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            expect(result.current.enrollments).toEqual([])
            expect(result.current.total).toBe(0)
            expect(result.current.error).toEqual(error)
            expect(mockErrorHandler.handle).toHaveBeenCalledWith(error)
        })
    })

    describe('retryEnrollment', () => {
        it('should retry enrollment and auto-refresh the list', async () => {
            mockEnrollmentService.getEnrollments = vi.fn().mockResolvedValue({
                items: testEnrollments,
                total: 2,
            })

            const { result } = renderHook(() => useEnrollments(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            // Setup retry and refresh
            const retriedEnrollment = new Enrollment(
                '2',
                'user-2',
                'tenant-1',
                EnrollmentStatus.PROCESSING,
                'http://img2.jpg',
                new Date('2024-01-02'),
                new Date('2024-01-05'),
                'FACE',
                0.3,
                0.2
            )
            mockEnrollmentService.retryEnrollment = vi.fn().mockResolvedValue(retriedEnrollment)
            mockEnrollmentService.getEnrollments = vi.fn().mockResolvedValue({
                items: [testEnrollments[0], retriedEnrollment],
                total: 2,
            })

            await result.current.retryEnrollment('2')

            expect(mockEnrollmentService.retryEnrollment).toHaveBeenCalledWith('2')

            // Wait for auto-refresh
            await waitFor(() => {
                expect(mockEnrollmentService.getEnrollments).toHaveBeenCalled()
            })
        })
    })

    describe('deleteEnrollment', () => {
        it('should delete enrollment and auto-refresh the list', async () => {
            mockEnrollmentService.getEnrollments = vi.fn().mockResolvedValue({
                items: testEnrollments,
                total: 2,
            })

            const { result } = renderHook(() => useEnrollments(), { wrapper })

            await waitFor(() => {
                expect(result.current.loading).toBe(false)
            })

            mockEnrollmentService.deleteEnrollment = vi.fn().mockResolvedValue(undefined)
            mockEnrollmentService.getEnrollments = vi.fn().mockResolvedValue({
                items: [testEnrollments[0]],
                total: 1,
            })

            await result.current.deleteEnrollment('2')

            expect(mockEnrollmentService.deleteEnrollment).toHaveBeenCalledWith('2')

            // Wait for auto-refresh
            await waitFor(() => {
                expect(result.current.enrollments).toEqual([testEnrollments[0]])
            })

            expect(result.current.total).toBe(1)
        })
    })
})

describe('useEnrollment', () => {
    let container: Container
    let mockEnrollmentService: jest.Mocked<IEnrollmentService>

    const testEnrollment = new Enrollment(
        '1',
        'user-1',
        'tenant-1',
        EnrollmentStatus.SUCCESS,
        'http://img1.jpg',
        new Date('2024-01-01'),
        new Date('2024-01-01'),
        'FACE',
        0.95,
        0.98
    )

    beforeEach(() => {
        container = createTestContainer()
        mockEnrollmentService = container.get<IEnrollmentService>(
            TYPES.EnrollmentService
        ) as jest.Mocked<IEnrollmentService>

        vi.clearAllMocks()
    })

    const wrapper = ({ children }: { children: ReactNode }) => (
        <DependencyProvider container={container}>{children}</DependencyProvider>
    )

    it('should fetch a single enrollment by ID', async () => {
        mockEnrollmentService.getEnrollmentById = vi.fn().mockResolvedValue(testEnrollment)

        const { result } = renderHook(() => useEnrollment('1'), { wrapper })

        // Initially loading
        expect(result.current.loading).toBe(true)
        expect(result.current.enrollment).toBeNull()

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.enrollment).toEqual(testEnrollment)
        expect(result.current.error).toBeNull()
        expect(mockEnrollmentService.getEnrollmentById).toHaveBeenCalledWith('1')
    })
})

describe('useUserEnrollments', () => {
    let container: Container
    let mockEnrollmentService: jest.Mocked<IEnrollmentService>

    const userEnrollments = [
        new Enrollment(
            '10',
            'user-42',
            'tenant-1',
            EnrollmentStatus.SUCCESS,
            'http://face.jpg',
            new Date('2024-02-01'),
            new Date('2024-02-01'),
            'FACE',
            0.9,
            0.95
        ),
        new Enrollment(
            '11',
            'user-42',
            'tenant-1',
            EnrollmentStatus.ENROLLED,
            '',
            new Date('2024-02-02'),
            new Date('2024-02-02'),
            'TOTP'
        ),
    ]

    beforeEach(() => {
        container = createTestContainer()
        mockEnrollmentService = container.get<IEnrollmentService>(
            TYPES.EnrollmentService
        ) as jest.Mocked<IEnrollmentService>

        vi.clearAllMocks()
    })

    const wrapper = ({ children }: { children: ReactNode }) => (
        <DependencyProvider container={container}>{children}</DependencyProvider>
    )

    it('should fetch user enrollments on mount', async () => {
        mockEnrollmentService.getUserEnrollments = vi.fn().mockResolvedValue(userEnrollments)

        const { result } = renderHook(() => useUserEnrollments('user-42'), { wrapper })

        expect(result.current.loading).toBe(true)

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.enrollments).toEqual(userEnrollments)
        expect(result.current.error).toBeNull()
        expect(mockEnrollmentService.getUserEnrollments).toHaveBeenCalledWith('user-42')
    })

    it('should create enrollment and auto-refresh', async () => {
        mockEnrollmentService.getUserEnrollments = vi.fn().mockResolvedValue(userEnrollments)

        const { result } = renderHook(() => useUserEnrollments('user-42'), { wrapper })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        const newEnrollment = new Enrollment(
            '12',
            'user-42',
            'tenant-1',
            EnrollmentStatus.PENDING,
            '',
            new Date('2024-03-01'),
            new Date('2024-03-01'),
            'FINGERPRINT'
        )

        mockEnrollmentService.createUserEnrollment = vi.fn().mockResolvedValue(newEnrollment)
        mockEnrollmentService.getUserEnrollments = vi.fn().mockResolvedValue([
            ...userEnrollments,
            newEnrollment,
        ])

        const createData = { authMethodType: 'FINGERPRINT' }
        const created = await result.current.createEnrollment(createData)

        expect(created).toEqual(newEnrollment)
        expect(mockEnrollmentService.createUserEnrollment).toHaveBeenCalledWith('user-42', createData)

        // Wait for auto-refresh
        await waitFor(() => {
            expect(result.current.enrollments).toEqual([...userEnrollments, newEnrollment])
        })
    })

    it('should revoke enrollment and auto-refresh', async () => {
        mockEnrollmentService.getUserEnrollments = vi.fn().mockResolvedValue(userEnrollments)

        const { result } = renderHook(() => useUserEnrollments('user-42'), { wrapper })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        mockEnrollmentService.revokeUserEnrollment = vi.fn().mockResolvedValue(undefined)
        mockEnrollmentService.getUserEnrollments = vi.fn().mockResolvedValue([userEnrollments[1]])

        await result.current.revokeEnrollment('FACE')

        expect(mockEnrollmentService.revokeUserEnrollment).toHaveBeenCalledWith('user-42', 'FACE')

        // Wait for auto-refresh
        await waitFor(() => {
            expect(result.current.enrollments).toEqual([userEnrollments[1]])
        })
    })
})
