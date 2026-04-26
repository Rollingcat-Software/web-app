import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import React from 'react'
import { useUserEnrollment, EnrollmentStep } from '../useUserEnrollment'
import { DependencyProvider } from '@app/providers'
import { Container } from 'inversify'
import { TYPES } from '@core/di/types'
import { UserEnrollmentStatus } from '@domain/models/UserEnrollment'
import type { UserEnrollmentStatusResponse } from '@domain/models/UserEnrollment'

describe('useUserEnrollment', () => {
    let container: Container
    let mockService: {
        getEnrollmentStatus: ReturnType<typeof vi.fn>
        submitEnrollment: ReturnType<typeof vi.fn>
        requestLivenessChallenge: ReturnType<typeof vi.fn>
        verifyLiveness: ReturnType<typeof vi.fn>
    }
    let mockErrorHandler: {
        handle: ReturnType<typeof vi.fn>
    }

    const _mockStatusNotStarted: UserEnrollmentStatusResponse = {
        status: UserEnrollmentStatus.NOT_STARTED,
    }

    const mockStatusCompleted: UserEnrollmentStatusResponse = {
        status: UserEnrollmentStatus.COMPLETED,
        qualityScore: 0.95,
        livenessScore: 0.98,
        completedAt: '2026-04-05T10:00:00Z',
    }

    const createWrapper = () => {
        return function Wrapper({ children }: { children: React.ReactNode }) {
            return React.createElement(
                DependencyProvider,
                { container },
                children,
            )
        }
    }

    beforeEach(() => {
        mockService = {
            getEnrollmentStatus: vi.fn().mockRejectedValue(new Error('No enrollment')),
            submitEnrollment: vi.fn().mockResolvedValue(mockStatusCompleted),
            requestLivenessChallenge: vi.fn().mockResolvedValue({
                challengeId: 'ch-1',
                instruction: 'Turn left',
            }),
            verifyLiveness: vi.fn().mockResolvedValue({
                passed: true,
                score: 0.95,
                token: 'liveness-token',
            }),
        }

        mockErrorHandler = {
            handle: vi.fn(),
        }

        container = new Container()
        container.bind(TYPES.UserEnrollmentService).toConstantValue(mockService)
        container.bind(TYPES.ErrorHandler).toConstantValue(mockErrorHandler)
    })

    it('should have correct initial state', async () => {
        const { result } = renderHook(() => useUserEnrollment(), {
            wrapper: createWrapper(),
        })

        expect(result.current.loading).toBe(true)
        expect(result.current.currentStep).toBe(EnrollmentStep.ID_INFO)
        expect(result.current.idInfo).toBeNull()
        expect(result.current.submitting).toBe(false)
        expect(result.current.submittingPhase).toBeNull()
        expect(result.current.error).toBeNull()

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })
    })

    it('should check enrollment status on mount and start fresh when none exists', async () => {
        const { result } = renderHook(() => useUserEnrollment(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.currentStep).toBe(EnrollmentStep.ID_INFO)
        expect(result.current.enrollmentStatus).toBeNull()
    })

    it('should skip to COMPLETE step when enrollment already completed', async () => {
        mockService.getEnrollmentStatus.mockResolvedValue(mockStatusCompleted)

        const { result } = renderHook(() => useUserEnrollment(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.currentStep).toBe(EnrollmentStep.COMPLETE)
        expect(result.current.enrollmentStatus).toEqual(mockStatusCompleted)
    })

    it('should skip to COMPLETE step when enrollment is PROCESSING', async () => {
        const processingStatus: UserEnrollmentStatusResponse = {
            status: UserEnrollmentStatus.PROCESSING,
        }
        mockService.getEnrollmentStatus.mockResolvedValue(processingStatus)

        const { result } = renderHook(() => useUserEnrollment(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.currentStep).toBe(EnrollmentStep.COMPLETE)
    })

    it('should navigate forward with nextStep', async () => {
        const { result } = renderHook(() => useUserEnrollment(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.currentStep).toBe(EnrollmentStep.ID_INFO)

        act(() => {
            result.current.nextStep()
        })

        expect(result.current.currentStep).toBe(EnrollmentStep.CAMERA_ACCESS)

        act(() => {
            result.current.nextStep()
        })

        expect(result.current.currentStep).toBe(EnrollmentStep.LIVENESS)
    })

    it('should not go past COMPLETE step', async () => {
        const { result } = renderHook(() => useUserEnrollment(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        // Go to COMPLETE
        act(() => {
            result.current.nextStep()
            result.current.nextStep()
            result.current.nextStep()
        })

        expect(result.current.currentStep).toBe(EnrollmentStep.COMPLETE)

        // Trying to go further should stay at COMPLETE
        act(() => {
            result.current.nextStep()
        })

        expect(result.current.currentStep).toBe(EnrollmentStep.COMPLETE)
    })

    it('should navigate backward with prevStep', async () => {
        const { result } = renderHook(() => useUserEnrollment(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        act(() => {
            result.current.nextStep() // → CAMERA_ACCESS
            result.current.nextStep() // → LIVENESS
        })

        expect(result.current.currentStep).toBe(EnrollmentStep.LIVENESS)

        act(() => {
            result.current.prevStep()
        })

        expect(result.current.currentStep).toBe(EnrollmentStep.CAMERA_ACCESS)
    })

    it('should not go before ID_INFO step', async () => {
        const { result } = renderHook(() => useUserEnrollment(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        act(() => {
            result.current.prevStep()
        })

        expect(result.current.currentStep).toBe(EnrollmentStep.ID_INFO)
    })

    it('should set idInfo', async () => {
        const { result } = renderHook(() => useUserEnrollment(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        const idData = {
            nationalId: '12345678901',
            dateOfBirth: '1990-01-15',
            fullName: 'Test User',
        }

        act(() => {
            result.current.setIdInfo(idData)
        })

        expect(result.current.idInfo).toEqual(idData)
    })

    it('should submit enrollment successfully', async () => {
        const { result } = renderHook(() => useUserEnrollment(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        // Set idInfo first
        act(() => {
            result.current.setIdInfo({
                nationalId: '12345678901',
                dateOfBirth: '1990-01-15',
                fullName: 'Test User',
            })
        })

        const biometrics = {
            livenessToken: 'token-123',
            livenessScore: 0.98,
            faceImage: new Blob(['face'], { type: 'image/jpeg' }),
        }

        await act(async () => {
            await result.current.submitEnrollment(biometrics)
        })

        expect(result.current.enrollmentStatus).toEqual(mockStatusCompleted)
        expect(result.current.currentStep).toBe(EnrollmentStep.COMPLETE)
        expect(result.current.submitting).toBe(false)
        expect(result.current.error).toBeNull()
    })

    it('should not submit when idInfo is null', async () => {
        const { result } = renderHook(() => useUserEnrollment(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        const biometrics = {
            livenessToken: 'token-123',
            livenessScore: 0.98,
            faceImage: new Blob(['face'], { type: 'image/jpeg' }),
        }

        await act(async () => {
            await result.current.submitEnrollment(biometrics)
        })

        expect(mockService.submitEnrollment).not.toHaveBeenCalled()
    })

    it('should handle submit enrollment error', async () => {
        mockService.submitEnrollment.mockRejectedValue(new Error('Server error'))

        const { result } = renderHook(() => useUserEnrollment(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        act(() => {
            result.current.setIdInfo({
                nationalId: '12345678901',
                dateOfBirth: '1990-01-15',
                fullName: 'Test User',
            })
        })

        await act(async () => {
            await result.current.submitEnrollment({
                livenessToken: 'token-123',
                livenessScore: 0.98,
                faceImage: new Blob(['face'], { type: 'image/jpeg' }),
            })
        })

        expect(result.current.error).toContain('sync failed')
        expect(result.current.submitting).toBe(false)
        expect(mockErrorHandler.handle).toHaveBeenCalled()
    })

    it('should refresh enrollment status', async () => {
        const { result } = renderHook(() => useUserEnrollment(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        mockService.getEnrollmentStatus.mockResolvedValue(mockStatusCompleted)

        await act(async () => {
            await result.current.refreshStatus()
        })

        expect(result.current.enrollmentStatus).toEqual(mockStatusCompleted)
    })

    it('should handle refreshStatus error', async () => {
        const { result } = renderHook(() => useUserEnrollment(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        mockService.getEnrollmentStatus.mockRejectedValue(new Error('Network error'))

        await act(async () => {
            await result.current.refreshStatus()
        })

        expect(mockErrorHandler.handle).toHaveBeenCalled()
    })
})
