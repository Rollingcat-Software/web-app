/**
 * Regression test for USER-BUG-1 (face enrollment "ceiling capture").
 *
 * Bug report (Turkish, 2026-04-30):
 *   "Tavanı göstersem bile devam ediyor yüz görmeden. Ama db kaydı başarısız
 *    dedi. O noktada kontrol ediyor sanki."
 *
 * Translation: "Even when I aim the camera at the ceiling, [enrollment]
 * continues without seeing a face. But it said DB save failed at the end.
 * It's like it's only checking at THAT point."
 *
 * Cause: useFaceChallenge had a "hard timeout" branch that auto-advanced the
 * stage even when `detection.detected === false`, plus a center-crop fallback
 * that synthesized an image when no bounding box was available. The fix gates
 * BOTH on a real `detection.detected === true` signal.
 */

import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFaceChallenge } from '../useFaceChallenge'
import type { FaceDetectionState } from '../useFaceDetection'

// BiometricEngine is touched only inside the capture branch (passive liveness
// + landmark embedding). The no-face path never reaches it, so a minimal stub
// is sufficient.
vi.mock('../../../../lib/biometric-engine/core/BiometricEngine', () => ({
    BiometricEngine: {
        getInstance: () => ({
            livenessDetector: { isAvailable: () => false, check: () => ({ score: 100 }) },
            embeddingComputer: { isAvailable: () => false, extract: async () => null },
        }),
    },
}))

vi.mock('../../utils/faceCropper', () => ({
    dataURLToImageData: async () => null,
}))

const NO_FACE: FaceDetectionState = {
    detected: false,
    centered: false,
    tooClose: false,
    tooFar: false,
    hint: 'faceDetection.noFace',
    confidence: 0,
    boundingBox: null,
}

function makeCanvasRef(): React.RefObject<HTMLCanvasElement | null> {
    const canvas = document.createElement('canvas')
    return { current: canvas }
}

describe('useFaceChallenge — USER-BUG-1 ceiling-capture gate', () => {
    it('does not advance the stage when no face is detected, even after hard-timeout', () => {
        const { result } = renderHook(() => useFaceChallenge())
        const canvasRef = makeCanvasRef()
        const cropFace = vi.fn(() => null) // mirrors no-face: cropFaceToDataURL returns null

        // Initial state: stage 'position', stageIndex 0
        expect(result.current.challengeState.stage).toBe('position')
        expect(result.current.challengeState.stageIndex).toBe(0)
        expect(result.current.challengeState.captures).toHaveLength(0)

        // Simulate 60 update ticks across what would have been > 2 * STAGE_TIMEOUT_MS
        // (the old code's "hard timeout" was 12s; we fast-forward Date.now via fake timers).
        vi.useFakeTimers()
        try {
            for (let i = 0; i < 60; i++) {
                vi.advanceTimersByTime(500) // 30 s of "no face"
                act(() => {
                    result.current.updateChallenge(NO_FACE, cropFace, canvasRef)
                })
            }
        } finally {
            vi.useRealTimers()
        }

        // The flow MUST still be stuck on stage 'position' with 0 captures.
        // Before the fix, the hard-timeout branch would have auto-advanced the
        // stage and the center-crop fallback would have produced a "capture".
        expect(result.current.challengeState.stage).toBe('position')
        expect(result.current.challengeState.stageIndex).toBe(0)
        expect(result.current.challengeState.captures).toHaveLength(0)
        expect(result.current.challengeState.instruction).toBe('faceChallenge.noFaceDetected')
        // cropFace must never have been invoked — we never even attempt a capture.
        expect(cropFace).not.toHaveBeenCalled()
    })

    it('resets to initial state on resetChallenge()', () => {
        const { result } = renderHook(() => useFaceChallenge())
        act(() => {
            result.current.resetChallenge()
        })
        expect(result.current.challengeState.stage).toBe('position')
        expect(result.current.challengeState.stageIndex).toBe(0)
        expect(result.current.challengeState.captures).toEqual([])
    })
})
