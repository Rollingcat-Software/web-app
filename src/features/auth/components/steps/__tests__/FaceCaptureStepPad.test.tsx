/**
 * FaceCaptureStep — ADVISORY client PAD score: DISPLAY + non-blocking (SP-D).
 *
 * Verifies that when the advisory PAD flag is on:
 *   1. the captured frame's passive-liveness score is computed and DISPLAYED to
 *      the user as an i18n'd indicator, and
 *   2. the score is handed to onSubmit as the 4th (advisory) argument.
 * And that when the analyzer FAILS (returns null), the capture/submit still
 * completes normally with NO score — a PAD failure never blocks the capture.
 *
 * The camera + face-detection + quality hooks are mocked so the heavy
 * MediaPipe/canvas pipeline doesn't run in jsdom; we drive the component to the
 * "captured" state and then click Submit.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '../../../../../i18n'

const CAPTURED_CROP = 'data:image/jpeg;base64,CROP'

// --- Mock the perf context (no provider in the test tree). ---
vi.mock('@/contexts/PerfContextHook', () => ({
    usePerf: () => ({ recordFrame: vi.fn(), recordOperation: vi.fn() }),
}))

// --- Mock face detection: a centered, detected face that crops to a fixed URL. ---
vi.mock('@features/auth/hooks/useFaceDetection', () => ({
    useFaceDetection: () => ({
        detected: true,
        centered: true,
        hint: 'faceDetection.perfect',
        boundingBox: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
        cropFace: () => CAPTURED_CROP,
        captureLandmarks: () => null,
        backend: 'mediapipe',
        initialized: true,
        initFailed: false,
    }),
}))

// --- Mock quality assessment (chips suppressed via overall=0; color helper real-ish). ---
vi.mock('@features/auth/hooks/useQualityAssessment', () => ({
    useQualityAssessment: () => ({
        quality: { overall: 0, blur: 0, lighting: 0, faceSizeScore: 0 },
        updateQuality: vi.fn(),
        resetQuality: vi.fn(),
        getScoreColor: () => 'success',
        getQualityLabel: () => 'good',
    }),
}))

// --- Inert biometric engine (faceCropper embedding path on submit reads it). ---
vi.mock('@/lib/biometric-engine/core/BiometricEngine', () => ({
    BiometricEngine: { getInstance: () => ({ embeddingComputer: null }) },
}))
vi.mock('@features/auth/utils/faceCropper', () => ({
    dataURLToImageData: vi.fn(async () => null),
}))

// --- Injectable PAD flag + helper. ---
const padState = { enabled: true, score: 0.77 as number | null }
vi.mock('@features/biometrics/pad/clientPadFlag', () => ({
    isClientPadAdvisoryEnabled: () => padState.enabled,
}))
vi.mock('@features/biometrics/pad/computeClientPadScore', () => ({
    computeClientPadScore: vi.fn(async () =>
        padState.score === null ? null : { score: padState.score, breakdown: {} },
    ),
}))

import FaceCaptureStep from '../FaceCaptureStep'

// jsdom has no real camera/video; stub the bits captureImage() touches.
beforeEach(() => {
    padState.enabled = true
    padState.score = 0.77
    Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }) },
    })
    // Give the mocked <video> real dimensions so captureImage()'s guard passes.
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
        configurable: true,
        get: () => 640,
    })
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
        configurable: true,
        get: () => 480,
    })
    HTMLVideoElement.prototype.play = vi.fn().mockResolvedValue(undefined)
})

async function captureAndGetSubmit() {
    const onSubmit = vi.fn()
    const { container } = render(<FaceCaptureStep onSubmit={onSubmit} loading={false} />)
    // Camera auto-starts on mount → "Capture Photo" button appears (disabled until
    // the <video> reports loadeddata). jsdom never fires that natively, so dispatch
    // it to set `videoReady` and enable the capture button.
    const video = await waitFor(() => {
        const v = container.querySelector('video')
        if (!v) throw new Error('video not mounted yet')
        return v
    })
    fireEvent.loadedData(video)
    const captureBtn = await screen.findByRole('button', { name: /capture photo/i })
    await waitFor(() => expect(captureBtn).not.toBeDisabled())
    await userEvent.click(captureBtn)
    return onSubmit
}

describe('FaceCaptureStep — advisory PAD score (SP-D)', () => {
    it('displays the computed advisory liveness score on the captured preview', async () => {
        await captureAndGetSubmit()
        // 0.77 → "Liveness 77%" (en.json mfa.face.padScore).
        await waitFor(() =>
            expect(screen.getByText(/liveness 77%/i)).toBeInTheDocument(),
        )
    })

    it('passes the advisory score to onSubmit as the 4th argument', async () => {
        const onSubmit = await captureAndGetSubmit()
        await waitFor(() => expect(screen.getByText(/liveness 77%/i)).toBeInTheDocument())
        const submitBtn = await screen.findByRole('button', { name: /^submit$/i })
        await userEvent.click(submitBtn)
        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
        const args = onSubmit.mock.calls[0]
        expect(args[0]).toBe(CAPTURED_CROP) // image
        expect(args[3]).toBe(0.77) // advisory PAD score
    })

    it('a failed analyzer (null score) does NOT block capture — no chip, submit still fires with no score', async () => {
        padState.score = null
        const onSubmit = await captureAndGetSubmit()

        // Capture still succeeded — the Submit button is present.
        const submitBtn = await screen.findByRole('button', { name: /^submit$/i })
        // No advisory chip is shown.
        expect(screen.queryByText(/liveness/i)).not.toBeInTheDocument()

        await userEvent.click(submitBtn)
        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
        // 4th arg (advisory score) is undefined — login proceeds without it.
        expect(onSubmit.mock.calls[0][3]).toBeUndefined()
    })

    it('flag OFF: no PAD computed/displayed, submit unaffected', async () => {
        padState.enabled = false
        const onSubmit = await captureAndGetSubmit()

        const submitBtn = await screen.findByRole('button', { name: /^submit$/i })
        expect(screen.queryByText(/liveness/i)).not.toBeInTheDocument()
        await userEvent.click(submitBtn)
        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
        expect(onSubmit.mock.calls[0][3]).toBeUndefined()
    })
})
