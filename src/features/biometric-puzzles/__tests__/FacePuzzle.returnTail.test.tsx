/**
 * FacePuzzle contract-v2 return tail (security review S7).
 *
 * After a TURN/LOOK completes, bio requires rest → excursion → RETURN. The
 * completion must NOT be submitted until the head has returned: a trace without
 * the return is rejected server-side and burns one of the session's 3 attempts.
 * If the head never returns, the attempt fails LOCALLY (no server call).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ChallengeType } from '@/lib/biometric-engine/types'
import type { NormalizedLandmark } from '@/lib/biometric-engine/types'

// ── i18n / framer-motion inert mocks ─────────────────────────────────────
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    Trans: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('framer-motion', () => ({
    motion: new Proxy(
        {},
        { get: () => ({ children }: { children?: ReactNode }) => <div>{children}</div> },
    ),
    AnimatePresence: ({ children }: { children: ReactNode }) => children,
}))

// ── A frontal completion frame with a full 478-pt mesh ───────────────────
const LANDMARKS_478: NormalizedLandmark[] = Array.from({ length: 478 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
}))

/** Tunable per test: pose + completion + liveness + quality of every frame. */
let frameYaw = 0
let framePitch = 0
let frameCompleted = true
let frameIsLive = true

// ── Biometric engine mock: frameProcessor + pinned puzzle ────────────────
const mockCheckChallenge = vi.fn(() => ({
    detected: true,
    progress: 100,
    completed: frameCompleted,
}))
vi.mock('@/lib/biometric-engine/core/BiometricPuzzle', () => ({
    BiometricPuzzle: class {
        constructor() {}
        registerAllDefaults() {}
        start() {}
        checkChallenge(...args: unknown[]) {
            return mockCheckChallenge(...(args as []))
        }
    },
}))

vi.mock('@/lib/biometric-engine/hooks/useBiometricEngine', () => ({
    useBiometricEngine: () => ({
        isReady: true,
        isLoading: false,
        error: null,
        engine: {
            metricsCalculator: {},
            frameProcessor: {
                processFrame: () => ({
                    faces: [
                        {
                            detection: {
                                boundingBox: { x: 160, y: 120, width: 320, height: 320 },
                                landmarks478: LANDMARKS_478,
                            },
                            headPose: { yaw: frameYaw, pitch: framePitch },
                            metrics: {
                                eyes: { avgEAR: 0.3, leftEAR: 0.3, rightEAR: 0.3, userLeftEAR: 0.3, userRightEAR: 0.3 },
                                mouth: { mar: 0.1, smileCornerRaise: 0, smileWidthRatio: 0 },
                                eyebrows: { bothRatio: 0, leftRatio: 0, rightRatio: 0 },
                            },
                            liveness: { isLive: frameIsLive },
                        },
                    ],
                }),
            },
        },
    }),
}))

// ── Server re-score hook: always succeed (training surface ignores it) ───
const mockVerify = vi.fn().mockResolvedValue({
    kind: 'success',
    action: 'blink',
    durationSeconds: 1,
})
vi.mock('../useBiometricPuzzleServer', async (orig) => {
    const actual = await (orig() as Promise<Record<string, unknown>>)
    return { ...actual, useBiometricPuzzleServer: () => ({ verifyChallenge: mockVerify }) }
})

// ── Quality assessment: tunable per test ─────────────────────────────────
let qualityAcceptable = true
vi.mock('../../auth/hooks/useQualityAssessment', () => ({
    assessQuality: () => ({
        blur: 80,
        blurVariance: 120,
        lighting: 90,
        brightness: 130,
        faceSize: 200,
        faceSizeScore: 80,
        overall: qualityAcceptable ? 85 : 20,
        acceptable: qualityAcceptable,
    }),
}))

// ── Face cropper: jsdom has no real 2D canvas, so the cropper would return
//    null. Mock it to return a deterministic data-URL still and let us assert
//    the no-callback (training) path never invokes it. ────────────────────────
const mockCropFace = vi.fn(() => 'data:image/jpeg;base64,/9j/TEST')
vi.mock('../../auth/utils/faceCropper', () => ({
    cropFaceToDataURL: (...args: unknown[]) => mockCropFace(...(args as [])),
}))

import FacePuzzle from '../puzzles/FacePuzzle'

// ── rAF + camera shims so the detection loop runs in jsdom ───────────────
let rafCb: FrameRequestCallback | null = null
let clock = 10_000
beforeEach(() => {
    clock = 10_000
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
    vi.clearAllMocks()
    rafCb = null
    frameYaw = 0
    framePitch = 0
    frameCompleted = true
    frameIsLive = true
    qualityAcceptable = true
    mockCropFace.mockClear()
    mockCropFace.mockReturnValue('data:image/jpeg;base64,/9j/TEST')
    mockVerify.mockResolvedValue({ kind: 'success', action: 'blink', durationSeconds: 1 })
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        rafCb = cb
        return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
            getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }),
        },
    })
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
        configurable: true,
        get: () => 4,
    })
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
        configurable: true,
        get: () => 640,
    })
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
        configurable: true,
        get: () => 480,
    })
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
})
afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})


async function tick(ms: number) {
    clock += ms
    const cb = rafCb
    rafCb = null
    if (!cb) return
    await act(async () => {
        cb(clock)
        await Promise.resolve()
    })
}

async function startTurnLeft(onError: (m: string) => void) {
    const utils = render(
        <FacePuzzle
            challengeType={ChallengeType.TURN_LEFT}
            i18nKey="biometricPuzzle.puzzles.face_turn_left"
            onSuccess={() => {}}
            onError={onError}
            onClose={() => {}}
            serverMode="auth"
            collectTrace
        />,
    )
    const button = utils.container.querySelector('button')!
    await act(async () => {
        button.click()
        await Promise.resolve()
        await Promise.resolve()
    })
    const video = utils.container.querySelector('video')
    if (video) {
        await act(async () => {
            video.dispatchEvent(new Event('loadeddata'))
            await Promise.resolve()
        })
    }
    // Rest phase: frontal, gesture not yet complete.
    frameCompleted = false
    frameYaw = 0
    for (let i = 0; i < 4; i++) await tick(40)
    // Excursion completes the gesture → the return tail starts.
    frameYaw = -25
    frameCompleted = true
    await tick(40)
    return utils
}

describe('FacePuzzle — v2 return tail (S7)', () => {
    it('never submits while the head has not returned; fails locally after the give-up bound', async () => {
        const onError = vi.fn()
        const { queryByText } = await startTurnLeft(onError)
        expect(queryByText('biometricPuzzle.returnToCenter')).not.toBeNull()
        // Head stays turned: 2.5 s in, the prompt becomes insistent, no submit.
        for (let i = 0; i < 25; i++) await tick(100)
        expect(mockVerify).not.toHaveBeenCalled()
        expect(queryByText('biometricPuzzle.returnToCenterRequired')).not.toBeNull()
        expect(onError).not.toHaveBeenCalled()
        // Past the give-up bound: local failure, still no server call.
        for (let i = 0; i < 15; i++) await tick(100)
        expect(mockVerify).not.toHaveBeenCalled()
        expect(onError).toHaveBeenCalledWith('biometricPuzzle.returnTimeout')
    })

    it('submits once the head has returned and settled', async () => {
        const onError = vi.fn()
        await startTurnLeft(onError)
        for (let i = 0; i < 5; i++) await tick(100)
        expect(mockVerify).not.toHaveBeenCalled()
        frameYaw = 1 // back near the starting pose
        for (let i = 0; i < 4; i++) await tick(100)
        expect(mockVerify).toHaveBeenCalledOnce()
        expect(onError).not.toHaveBeenCalled()
    })
})
