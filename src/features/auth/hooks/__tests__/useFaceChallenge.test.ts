/**
 * Tests for useFaceChallenge — the 5-step face-enrollment wizard.
 *
 * Covers:
 *   1. USER-BUG-1 ceiling-capture gate (no-face must NOT advance).
 *   2. Mandatory gestures (2026-06-03): the soft STAGE_TIMEOUT_MS auto-pass
 *      applies ONLY to `position` + `frontal`. The 3 active gestures
 *      (turn_left / turn_right / blink) must require the real condition and
 *      must NOT auto-capture on a timeout.
 *   3. Liveness-miss recovery: a passive-liveness failure RE-PROMPTS the current
 *      stage (security check unchanged) instead of snapping back to Step 1.
 *
 * Bug report for (1) (Turkish, 2026-04-30):
 *   "Tavanı göstersem bile devam ediyor yüz görmeden. Ama db kaydı başarısız
 *    dedi." — "Even aimed at the ceiling it continues without seeing a face,
 *    but said DB save failed at the end."
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFaceChallenge } from '../useFaceChallenge'
import type { FaceDetectionState } from '../useFaceDetection'

// ── BiometricEngine stub ─────────────────────────────────────────────────────
// Mutable handles let individual tests flip liveness availability / score so we
// can exercise both the "liveness passes → stage advances" and "liveness fails →
// re-prompt current stage" paths. qualityAssessor + embeddingComputer are kept
// unavailable so the quality gate is skipped and embedding extraction is a no-op.
const liveness = { available: true, score: 100 }
vi.mock('../../../../lib/biometric-engine/core/BiometricEngine', () => ({
    BiometricEngine: {
        getInstance: () => ({
            livenessDetector: {
                isAvailable: () => liveness.available,
                check: () => ({ score: liveness.score }),
            },
            qualityAssessor: { isAvailable: () => false, assess: () => null },
            embeddingComputer: { isAvailable: () => false, extract: async () => null },
        }),
    },
}))

vi.mock('../../utils/faceCropper', () => ({
    dataURLToImageData: async () => null,
}))

// ── DOM stubs: a <video> with a real frame + a 2d canvas context ─────────────
// The capture path reads `document.querySelector('video')` (for the liveness
// ROI) and draws onto an offscreen canvas. jsdom has no media stack, so we stub
// videoWidth/Height and getContext('2d') with the minimal surface used.
function installVideoAndCanvasStubs() {
    const video = document.createElement('video')
    Object.defineProperty(video, 'videoWidth', { value: 640, configurable: true })
    Object.defineProperty(video, 'videoHeight', { value: 480, configurable: true })
    document.body.appendChild(video)

    const fakeCtx = {
        drawImage: vi.fn(),
        getImageData: () => ({
            data: new Uint8ClampedArray(4),
            width: 1,
            height: 1,
            colorSpace: 'srgb',
        }),
    } as unknown as CanvasRenderingContext2D
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeCtx as never)

    return () => {
        video.remove()
        vi.restoreAllMocks()
    }
}

const NO_FACE: FaceDetectionState = {
    detected: false,
    centered: false,
    tooClose: false,
    tooFar: false,
    hint: 'faceDetection.noFace',
    confidence: 0,
    boundingBox: null,
    avgEAR: null,
}

// Face dead-centre: satisfies `position` + `frontal` (centered) but NOT the
// turn gestures (centerX ≈ 0.5, neither shifted left nor right).
const CENTERED: FaceDetectionState = {
    detected: true,
    centered: true,
    tooClose: false,
    tooFar: false,
    hint: '',
    confidence: 0.99,
    boundingBox: { x: 0.3, y: 0.3, width: 0.4, height: 0.4 }, // centerX = 0.5
    avgEAR: 0.3,
}

function makeCanvasRef(): React.RefObject<HTMLCanvasElement | null> {
    const canvas = document.createElement('canvas')
    return { current: canvas }
}

/**
 * Drive the hook through whole-stage completions by feeding a satisfying
 * detection state across the stage's hold window. Returns when `stageIndex`
 * has advanced to (at least) `targetIndex` or `maxTicks` is exhausted.
 */
function advanceToStage(
    result: { current: ReturnType<typeof useFaceChallenge> },
    state: FaceDetectionState,
    cropFace: () => string | null,
    canvasRef: React.RefObject<HTMLCanvasElement | null>,
    targetIndex: number,
    maxTicks = 60,
) {
    for (let i = 0; i < maxTicks && result.current.challengeState.stageIndex < targetIndex; i++) {
        vi.advanceTimersByTime(150)
        act(() => {
            result.current.updateChallenge(state, cropFace, canvasRef)
        })
    }
}

describe('useFaceChallenge — USER-BUG-1 ceiling-capture gate', () => {
    it('does not advance the stage when no face is detected, even after hard-timeout', () => {
        const { result } = renderHook(() => useFaceChallenge())
        const canvasRef = makeCanvasRef()
        const cropFace = vi.fn(() => null)

        expect(result.current.challengeState.stage).toBe('position')
        expect(result.current.challengeState.stageIndex).toBe(0)
        expect(result.current.challengeState.captures).toHaveLength(0)

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

        expect(result.current.challengeState.stage).toBe('position')
        expect(result.current.challengeState.stageIndex).toBe(0)
        expect(result.current.challengeState.captures).toHaveLength(0)
        expect(result.current.challengeState.instruction).toBe('faceChallenge.noFaceDetected')
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
        // Polish: progress starts at 0 (not 1/5) so % agrees with "Step 1/5".
        expect(result.current.challengeState.progress).toBe(0)
    })
})

describe('useFaceChallenge — mandatory gestures (no silent auto-skip)', () => {
    let teardown: () => void
    beforeEach(() => {
        liveness.available = true
        liveness.score = 100
        vi.useFakeTimers()
        teardown = installVideoAndCanvasStubs()
    })
    afterEach(() => {
        teardown()
        vi.useRealTimers()
    })

    it('soft-captures position via the timeout, but STOPS at turn_left', () => {
        const { result } = renderHook(() => useFaceChallenge())
        const canvasRef = makeCanvasRef()
        const cropFace = vi.fn(() => 'data:image/jpeg;base64,Zm9v')

        act(() => result.current.markStarted())

        // CENTERED satisfies position directly (centered === true), so it advances
        // on `conditionMet`; this proves the soft stage works.
        advanceToStage(result, CENTERED, cropFace, canvasRef, 1)
        expect(result.current.challengeState.stageIndex).toBe(1)
        expect(result.current.challengeState.stage).toBe('turn_left')
        expect(result.current.challengeState.captures).toHaveLength(1)

        const capturesAfterPosition = result.current.challengeState.captures.length

        // Now sit on turn_left with a CENTERED face (turn condition NEVER met)
        // for well beyond STAGE_TIMEOUT_MS (6 s). A soft timeout MUST NOT fire
        // here — the gesture is mandatory.
        for (let i = 0; i < 120; i++) {
            vi.advanceTimersByTime(150) // 18 s on turn_left
            act(() => {
                result.current.updateChallenge(CENTERED, cropFace, canvasRef)
            })
        }

        // Still on turn_left, no new capture — the gesture did not auto-pass.
        expect(result.current.challengeState.stage).toBe('turn_left')
        expect(result.current.challengeState.stageIndex).toBe(1)
        expect(result.current.challengeState.captures).toHaveLength(capturesAfterPosition)
        // After GESTURE_HINT_MS the gentle "still waiting" nudge is shown.
        expect(result.current.challengeState.instruction).toBe('faceChallenge.gestureStillWaiting')
    })

    it('advances past turn_left only when the turn gesture is actually performed', () => {
        const { result } = renderHook(() => useFaceChallenge())
        const canvasRef = makeCanvasRef()
        const cropFace = vi.fn(() => 'data:image/jpeg;base64,Zm9v')

        act(() => result.current.markStarted())
        advanceToStage(result, CENTERED, cropFace, canvasRef, 1)
        expect(result.current.challengeState.stage).toBe('turn_left')

        // Head turned left = bbox shifted right in mirrored video (centerX high).
        const TURNED_LEFT: FaceDetectionState = {
            ...CENTERED,
            centered: false,
            boundingBox: { x: 0.5, y: 0.3, width: 0.4, height: 0.4 }, // centerX = 0.7 > 0.56
        }
        advanceToStage(result, TURNED_LEFT, cropFace, canvasRef, 2)

        expect(result.current.challengeState.stageIndex).toBe(2)
        expect(result.current.challengeState.stage).toBe('turn_right')
        expect(result.current.challengeState.captures).toHaveLength(2)
    })
})

describe('useFaceChallenge — liveness miss re-prompts the current stage', () => {
    let teardown: () => void
    beforeEach(() => {
        liveness.available = true
        liveness.score = 100
        vi.useFakeTimers()
        teardown = installVideoAndCanvasStubs()
    })
    afterEach(() => {
        teardown()
        vi.useRealTimers()
    })

    it('keeps the current stage + earned captures when liveness fails (no reset to Step 1)', () => {
        const { result } = renderHook(() => useFaceChallenge())
        const canvasRef = makeCanvasRef()
        const cropFace = vi.fn(() => 'data:image/jpeg;base64,Zm9v')

        act(() => result.current.markStarted())

        // Pass position with liveness OK so we land on turn_left with 1 capture.
        advanceToStage(result, CENTERED, cropFace, canvasRef, 1)
        expect(result.current.challengeState.stageIndex).toBe(1)
        expect(result.current.challengeState.captures).toHaveLength(1)

        // Now make liveness FAIL, and perform the turn gesture so capture is attempted.
        liveness.score = 0
        const TURNED_LEFT: FaceDetectionState = {
            ...CENTERED,
            centered: false,
            boundingBox: { x: 0.5, y: 0.3, width: 0.4, height: 0.4 },
        }
        for (let i = 0; i < 40; i++) {
            vi.advanceTimersByTime(150)
            act(() => {
                result.current.updateChallenge(TURNED_LEFT, cropFace, canvasRef)
            })
            if (result.current.challengeState.instruction === 'faceChallenge.livenessCheckFailed') break
        }

        // Liveness miss must RE-PROMPT the CURRENT stage (turn_left, index 1),
        // NOT snap back to Step 1 (position, index 0). Earned captures kept.
        expect(result.current.challengeState.instruction).toBe('faceChallenge.livenessCheckFailed')
        expect(result.current.challengeState.stage).toBe('turn_left')
        expect(result.current.challengeState.stageIndex).toBe(1)
        expect(result.current.challengeState.captures).toHaveLength(1)
    })
})
