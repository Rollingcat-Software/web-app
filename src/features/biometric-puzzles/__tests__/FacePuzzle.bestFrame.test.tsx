/**
 * FacePuzzle best-frontal-frame capture (SP-B Phase 4, 2026-06-12)
 *
 * Task 4.1: at `result.completed`, when an OPTIONAL `onBestFrame(image, landmarks)`
 * prop is provided AND the completion frame is FRONTAL (yaw≈0, pitch≈0) AND
 * quality-gated, the puzzle grabs ONE best frame (the cropped still + its 478-pt
 * landmarks) and fires `onBestFrame` exactly once. This feeds the Phase-5 identity
 * embedding from the SAME live puzzle session.
 *
 * Additive + non-regressive:
 *   - NO `onBestFrame` prop → no capture (the `/biometric-puzzles` training surface
 *     is byte-identical; this is the byte-identical-training assertion).
 *   - non-frontal completion (a head-turn gesture) → no capture.
 *   - low-quality completion → no capture.
 *
 * The detection loop is driven with a mocked biometric engine (frameProcessor +
 * a pinned BiometricPuzzle) so no camera / MediaPipe is needed — same harness the
 * HandGesturePuzzle metric test uses.
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
beforeEach(() => {
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
})

async function startAndTick(container: HTMLElement, button: HTMLElement) {
    await act(async () => {
        button.click()
        await Promise.resolve()
        await Promise.resolve()
    })
    const video = container.querySelector('video')
    if (video) {
        await act(async () => {
            video.dispatchEvent(new Event('loadeddata'))
            await Promise.resolve()
        })
    }
    for (let i = 0; i < 8 && rafCb; i++) {
        const cb = rafCb
        rafCb = null
        await act(async () => {
            cb(performance.now())
            await Promise.resolve()
        })
    }
}

function renderPuzzle(props: {
    onBestFrame?: (image: string, landmarks: NormalizedLandmark[]) => void
    onSuccess?: () => void
    onError?: (m: string) => void
}) {
    const utils = render(
        <FacePuzzle
            challengeType={ChallengeType.BLINK}
            i18nKey="biometricPuzzle.puzzles.face_blink"
            onSuccess={props.onSuccess ?? (() => {})}
            onError={props.onError ?? (() => {})}
            onClose={() => {}}
            serverMode="training"
            onBestFrame={props.onBestFrame}
        />,
    )
    const button = utils.container.querySelector('button')!
    return { ...utils, button }
}

describe('FacePuzzle — best-frontal-frame capture (Phase 4)', () => {
    it('fires onBestFrame once on a frontal, quality-gated completion', async () => {
        const onBestFrame = vi.fn()
        const { button, container } = renderPuzzle({ onBestFrame })
        await startAndTick(container, button)

        expect(onBestFrame).toHaveBeenCalledOnce()
        const [image, landmarks] = onBestFrame.mock.calls[0]
        // A captured still data-URL (cropped JPEG) + the 478-pt mesh.
        expect(typeof image).toBe('string')
        expect(image).toMatch(/^data:image\//)
        expect(Array.isArray(landmarks)).toBe(true)
        expect(landmarks).toHaveLength(478)
    })

    it('does NOT fire when no onBestFrame prop is given (training surface byte-identical)', async () => {
        // No callback → the completion still resolves onSuccess, but no capture
        // path runs at all. We assert the cropper is never invoked.
        const onSuccess = vi.fn()
        const { button, container } = renderPuzzle({ onSuccess })
        await startAndTick(container, button)
        await act(async () => {
            await Promise.resolve()
            await Promise.resolve()
        })
        // Completion still happened (training surface unaffected) …
        expect(onSuccess).toHaveBeenCalled()
        // … but NO best-frame crop was ever encoded.
        expect(mockCropFace).not.toHaveBeenCalled()
    })

    it('does NOT fire on a non-frontal completion (head-turn gesture)', async () => {
        frameYaw = 30 // clearly non-frontal
        const onBestFrame = vi.fn()
        const { button, container } = renderPuzzle({ onBestFrame })
        await startAndTick(container, button)
        expect(onBestFrame).not.toHaveBeenCalled()
    })

    it('does NOT fire on a low-quality completion', async () => {
        qualityAcceptable = false
        const onBestFrame = vi.fn()
        const { button, container } = renderPuzzle({ onBestFrame })
        await startAndTick(container, button)
        expect(onBestFrame).not.toHaveBeenCalled()
    })

    it('does NOT fire while the gesture has not completed yet', async () => {
        frameCompleted = false
        const onBestFrame = vi.fn()
        const { button, container } = renderPuzzle({ onBestFrame })
        await startAndTick(container, button)
        expect(onBestFrame).not.toHaveBeenCalled()
    })
})
