/**
 * HandGesturePuzzle canonical-metric forwarding (SP-B CV-3, 2026-06-12)
 *
 * Proves the component PASSES the canonical bio metric the hand detector
 * surfaced (`evaluateHandPuzzle(...).metrics`) up through BOTH the server
 * `verifyChallenge` payload AND the resolved `onSuccess` verdict's `metrics`,
 * keyed by bio's `ACTION_METRIC_KEY`. The detection loop is driven with a mocked
 * HandLandmarker + a mocked `evaluateHandPuzzle` so no camera/MediaPipe is
 * needed; the detector's own metric computation is unit-tested separately in
 * handChallenges.test.ts.
 *
 * Also pins the auth-mode metric-gap guard: when the detector surfaces NO metric
 * (the free-form shape-trace case), the auth flow fails CLOSED (onError, no
 * onSuccess) rather than submitting an empty payload bio would reject.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { BiometricPuzzleId } from '../BiometricPuzzleId'
import type { PuzzleServerVerdict } from '../useBiometricPuzzleServer'

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

// ── HandLandmarker: always ready, returns one hand ───────────────────────
vi.mock('../puzzles/useHandLandmarker', () => ({
    useHandLandmarker: () => ({
        isReady: true,
        isLoading: false,
        error: null,
        detect: () => ({
            landmarks: [Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }))],
            handedness: [[{ categoryName: 'Right' }]],
        }),
    }),
}))

// ── Server hook: capture payload, resolve success ────────────────────────
const mockVerify = vi.fn()
vi.mock('../useBiometricPuzzleServer', async (orig) => {
    const actual = await (orig() as Promise<Record<string, unknown>>)
    return { ...actual, useBiometricPuzzleServer: () => ({ verifyChallenge: mockVerify }) }
})

// ── evaluateHandPuzzle: deterministically complete with a metric ─────────
const mockEval = vi.fn()
vi.mock('../puzzles/handChallenges', async (orig) => {
    const actual = await (orig() as Promise<Record<string, unknown>>)
    return { ...actual, evaluateHandPuzzle: (...args: unknown[]) => mockEval(...args) }
})

import HandGesturePuzzle from '../puzzles/HandGesturePuzzle'

// ── rAF + camera shims so the detection loop runs in jsdom ───────────────
let rafCb: FrameRequestCallback | null = null
beforeEach(() => {
    vi.clearAllMocks()
    rafCb = null
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        rafCb = cb
        return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    // getUserMedia returns a fake stream with a stoppable track.
    Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
            getUserMedia: vi.fn().mockResolvedValue({
                getTracks: () => [{ stop: vi.fn() }],
            }),
        },
    })
    // A video element that always reports "have-enough-data".
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
        configurable: true,
        get: () => 4,
    })
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
})
afterEach(() => {
    vi.unstubAllGlobals()
})

/** Start the camera, mark the video ready, then run detection-loop ticks. */
async function startAndTick(container: HTMLElement, button: HTMLElement) {
    // Click "start camera" → getUserMedia resolves → cameraActive=true.
    await act(async () => {
        button.click()
        await Promise.resolve()
        await Promise.resolve()
    })
    // jsdom never fires `loadeddata` on its own; dispatch it so videoReady=true
    // and the detection-loop effect installs the rAF loop.
    const video = container.querySelector('video')
    if (video) {
        await act(async () => {
            video.dispatchEvent(new Event('loadeddata'))
            await Promise.resolve()
        })
    }
    // Run the rAF loop a few times so the loop body evaluates + completes.
    for (let i = 0; i < 8 && rafCb; i++) {
        const cb = rafCb
        rafCb = null
        await act(async () => {
            cb(performance.now())
            await Promise.resolve()
        })
    }
}

function renderPuzzle(
    puzzleId: BiometricPuzzleId,
    serverMode: 'auth' | 'training',
    onSuccess: (v?: PuzzleServerVerdict) => void,
    onError: (m: string) => void,
) {
    const utils = render(
        <HandGesturePuzzle
            puzzleId={puzzleId}
            i18nKey={`biometricPuzzle.puzzles.${puzzleId.toLowerCase()}`}
            onSuccess={onSuccess}
            onError={onError}
            onClose={() => {}}
            serverMode={serverMode}
        />,
    )
    // The "start camera" button is the only button initially.
    const button = utils.container.querySelector('button')!
    return { ...utils, button }
}

describe('HandGesturePuzzle — forwards canonical metric (auth)', () => {
    it('finger_count: verdict + submit carry metrics.finger_count', async () => {
        // Complete exactly once (real detectors fire completion on a single frame).
        mockEval.mockReturnValueOnce({
            detected: true,
            completed: true,
            progress: 100,
            metrics: { finger_count: 3 },
        })
        mockEval.mockReturnValue({ detected: false, completed: false, progress: 0 })
        mockVerify.mockResolvedValue({
            kind: 'success',
            action: 'finger_count',
            durationSeconds: 1,
        })
        const onSuccess = vi.fn()
        const onError = vi.fn()
        const { button, container } = renderPuzzle(
            BiometricPuzzleId.HAND_FINGER_COUNT,
            'auth',
            onSuccess,
            onError,
        )
        await startAndTick(container, button)
        // Let the verifyChallenge promise resolve.
        await act(async () => {
            await Promise.resolve()
            await Promise.resolve()
        })

        expect(mockVerify).toHaveBeenCalledOnce()
        // The SUBMIT payload carries the canonical metric (not a {progress} stub).
        expect(mockVerify.mock.calls[0][0].metrics).toEqual({ finger_count: 3 })
        expect(onSuccess).toHaveBeenCalledOnce()
        const verdict = onSuccess.mock.calls[0][0]
        expect(verdict.metrics).toEqual({ finger_count: 3 })
        expect(verdict.verified).toBe(true)
        expect(onError).not.toHaveBeenCalled()
    })

    it('pinch: verdict carries metrics.pinch_dist_scaled', async () => {
        mockEval.mockReturnValueOnce({
            detected: true,
            completed: true,
            progress: 100,
            metrics: { pinch_dist_scaled: 0.04 },
        })
        mockEval.mockReturnValue({ detected: false, completed: false, progress: 0 })
        mockVerify.mockResolvedValue({
            kind: 'success',
            action: 'pinch',
            durationSeconds: 1,
        })
        const onSuccess = vi.fn()
        const { button, container } = renderPuzzle(
            BiometricPuzzleId.HAND_PINCH,
            'auth',
            onSuccess,
            vi.fn(),
        )
        await startAndTick(container, button)
        await act(async () => {
            await Promise.resolve()
            await Promise.resolve()
        })
        expect(mockVerify.mock.calls[0][0].metrics).toEqual({ pinch_dist_scaled: 0.04 })
        expect(onSuccess.mock.calls[0][0].metrics).toEqual({ pinch_dist_scaled: 0.04 })
    })

    it('fails CLOSED in auth mode when the detector surfaces no metric (shape-trace gap)', async () => {
        mockEval.mockReturnValueOnce({
            detected: true,
            completed: true,
            progress: 100,
            // No `metrics` — the free-form shape-trace dtw_cost gap.
        })
        mockEval.mockReturnValue({ detected: false, completed: false, progress: 0 })
        const onSuccess = vi.fn()
        const onError = vi.fn()
        const { button, container } = renderPuzzle(
            BiometricPuzzleId.HAND_SHAPE_TRACE,
            'auth',
            onSuccess,
            onError,
        )
        await startAndTick(container, button)
        await act(async () => {
            await Promise.resolve()
        })
        // No server call, no success — fail closed via onError.
        expect(mockVerify).not.toHaveBeenCalled()
        expect(onSuccess).not.toHaveBeenCalled()
        expect(onError).toHaveBeenCalledOnce()
    })
})
