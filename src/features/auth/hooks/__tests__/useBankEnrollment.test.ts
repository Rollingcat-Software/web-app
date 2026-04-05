import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBankEnrollment } from '../useBankEnrollment'

// Mock useLivenessPuzzle's detectHeadTurn
vi.mock('../useLivenessPuzzle', () => ({
    detectHeadTurn: vi.fn().mockReturnValue({ direction: 'center', offset: 0 }),
}))

describe('useBankEnrollment', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should have correct initial state', () => {
        const { result } = renderHook(() => useBankEnrollment())

        expect(result.current.state.status).toBe('idle')
        expect(result.current.state.currentAngle).toBe(-1)
        expect(result.current.state.totalAngles).toBe(3)
        expect(result.current.state.angles).toHaveLength(3)
        expect(result.current.state.angles[0].label).toBe('Look straight at camera')
        expect(result.current.state.angles[0].captured).toBe(false)
        expect(result.current.state.angles[0].imageUrl).toBeNull()
        expect(result.current.state.message).toBe('')
    })

    it('should fail enrollment when landmarker is not set', async () => {
        const { result } = renderHook(() => useBankEnrollment())

        const videoRef = { current: null }

        await act(async () => {
            await result.current.startEnrollment('user-1', '/api/v1', 'token', videoRef)
        })

        expect(result.current.state.status).toBe('error')
        expect(result.current.state.message).toBe('FaceLandmarker not ready.')
    })

    it('should cancel enrollment', () => {
        const { result } = renderHook(() => useBankEnrollment())

        act(() => {
            result.current.cancelEnrollment()
        })

        expect(result.current.state.status).toBe('idle')
        expect(result.current.state.message).toBe('Cancelled')
    })

    it('should reset enrollment to initial state', () => {
        const { result } = renderHook(() => useBankEnrollment())

        act(() => {
            result.current.resetEnrollment()
        })

        expect(result.current.state.status).toBe('idle')
        expect(result.current.state.currentAngle).toBe(-1)
        expect(result.current.state.totalAngles).toBe(3)
        expect(result.current.state.message).toBe('')
        expect(result.current.state.angles.every(a => !a.captured)).toBe(true)
        expect(result.current.state.angles.every(a => a.imageUrl === null)).toBe(true)
    })

    it('should accept a landmarker via setLandmarker', () => {
        const { result } = renderHook(() => useBankEnrollment())

        const mockLandmarker = {
            detectForVideo: vi.fn().mockReturnValue({ faceLandmarks: [] }),
        }

        act(() => {
            result.current.setLandmarker(mockLandmarker)
        })

        // No error — landmarker is set, verifiable via startEnrollment not throwing "not ready"
        expect(result.current.state.status).toBe('idle')
    })

    it('should have all three expected angle directions', () => {
        const { result } = renderHook(() => useBankEnrollment())

        const directions = result.current.state.angles.map(a => a.direction)
        expect(directions).toEqual(['center', 'left', 'right'])
    })
})
