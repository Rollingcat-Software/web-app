import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFaceEnrollment } from '../useFaceEnrollment'
import { EnrollmentState, ENROLLMENT_POSES } from '../../types'
import type { BiometricEngine } from '../../core/BiometricEngine'

// Mock requestAnimationFrame/cancelAnimationFrame
let rafCallbacks: Array<() => void> = []
vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
    rafCallbacks.push(cb)
    return rafCallbacks.length
})
vi.stubGlobal('cancelAnimationFrame', vi.fn())
vi.stubGlobal('performance', { now: () => Date.now() })

describe('useFaceEnrollment', () => {
    let mockController: {
        start: ReturnType<typeof vi.fn>
        cancel: ReturnType<typeof vi.fn>
        isStable: ReturnType<typeof vi.fn>
        getHoldProgress: ReturnType<typeof vi.fn>
        getCurrentPose: ReturnType<typeof vi.fn>
        getCaptures: ReturnType<typeof vi.fn>
        onStateChange: ((state: EnrollmentState) => void) | null
        onCapture: (() => void) | null
        onComplete: (() => void) | null
        onFailed: (() => void) | null
    }

    let mockEngine: BiometricEngine

    beforeEach(() => {
        rafCallbacks = []

        mockController = {
            start: vi.fn(),
            cancel: vi.fn(),
            isStable: vi.fn().mockReturnValue(false),
            getHoldProgress: vi.fn().mockReturnValue(0),
            getCurrentPose: vi.fn().mockReturnValue(null),
            getCaptures: vi.fn().mockReturnValue([]),
            onStateChange: null,
            onCapture: null,
            onComplete: null,
            onFailed: null,
        }

        mockEngine = {
            enrollmentController: mockController,
        } as unknown as BiometricEngine
    })

    it('should have correct initial state when engine is null', () => {
        const { result } = renderHook(() => useFaceEnrollment(null))

        expect(result.current.state).toBe(EnrollmentState.IDLE)
        expect(result.current.currentPose).toBeNull()
        expect(result.current.step).toBe(0)
        expect(result.current.totalSteps).toBe(ENROLLMENT_POSES.length)
        expect(result.current.isStable).toBe(false)
        expect(result.current.holdProgress).toBe(0)
        expect(result.current.captures).toEqual([])
    })

    it('should wire up controller callbacks when engine is provided', () => {
        renderHook(() => useFaceEnrollment(mockEngine))

        expect(mockController.onStateChange).toBeInstanceOf(Function)
        expect(mockController.onCapture).toBeInstanceOf(Function)
        expect(mockController.onComplete).toBeInstanceOf(Function)
        expect(mockController.onFailed).toBeInstanceOf(Function)
    })

    it('should start enrollment via engine controller', () => {
        const { result } = renderHook(() => useFaceEnrollment(mockEngine))

        act(() => {
            result.current.start()
        })

        expect(mockController.start).toHaveBeenCalled()
    })

    it('should cancel enrollment and reset state', () => {
        const { result } = renderHook(() => useFaceEnrollment(mockEngine))

        act(() => {
            result.current.cancel()
        })

        expect(mockController.cancel).toHaveBeenCalled()
        expect(result.current.state).toBe(EnrollmentState.IDLE)
        expect(result.current.captures).toEqual([])
        expect(result.current.holdProgress).toBe(0)
        expect(result.current.isStable).toBe(false)
        expect(result.current.currentPose).toBeNull()
    })

    it('should update state when onStateChange fires', () => {
        const { result } = renderHook(() => useFaceEnrollment(mockEngine))

        const mockPose = { name: 'STRAIGHT', targetYaw: 0, targetPitch: 0, tolerance: 12 }
        mockController.getCurrentPose.mockReturnValue(mockPose)

        act(() => {
            mockController.onStateChange!(EnrollmentState.CAPTURE_STRAIGHT)
        })

        expect(result.current.state).toBe(EnrollmentState.CAPTURE_STRAIGHT)
    })

    it('should update captures when onCapture fires', () => {
        const mockCaptures = [
            { pose: 'STRAIGHT', embedding: [], qualityScore: 0.9, imageData: 'base64...' },
        ]
        mockController.getCaptures.mockReturnValue(mockCaptures)

        const { result } = renderHook(() => useFaceEnrollment(mockEngine))

        act(() => {
            mockController.onCapture!()
        })

        expect(result.current.captures).toEqual(mockCaptures)
        expect(result.current.step).toBe(1)
    })

    it('should transition to SUBMITTING when onComplete fires', () => {
        const mockCaptures = [
            { pose: 'STRAIGHT', embedding: [], qualityScore: 0.9, imageData: '' },
            { pose: 'LEFT', embedding: [], qualityScore: 0.85, imageData: '' },
        ]
        mockController.getCaptures.mockReturnValue(mockCaptures)

        const { result } = renderHook(() => useFaceEnrollment(mockEngine))

        act(() => {
            mockController.onComplete!()
        })

        expect(result.current.state).toBe(EnrollmentState.SUBMITTING)
        expect(result.current.captures).toEqual(mockCaptures)
    })

    it('should transition to FAILED when onFailed fires', () => {
        const { result } = renderHook(() => useFaceEnrollment(mockEngine))

        act(() => {
            mockController.onFailed!()
        })

        expect(result.current.state).toBe(EnrollmentState.FAILED)
    })

    it('should not start when engine is null', () => {
        const { result } = renderHook(() => useFaceEnrollment(null))

        act(() => {
            result.current.start()
        })

        // No error thrown, state stays IDLE
        expect(result.current.state).toBe(EnrollmentState.IDLE)
    })

    it('should not cancel when engine is null', () => {
        const { result } = renderHook(() => useFaceEnrollment(null))

        act(() => {
            result.current.cancel()
        })

        expect(result.current.state).toBe(EnrollmentState.IDLE)
    })

    it('should clean up callbacks on unmount', () => {
        const { unmount } = renderHook(() => useFaceEnrollment(mockEngine))

        unmount()

        expect(mockController.onStateChange).toBeNull()
        expect(mockController.onCapture).toBeNull()
        expect(mockController.onComplete).toBeNull()
        expect(mockController.onFailed).toBeNull()
    })
})
