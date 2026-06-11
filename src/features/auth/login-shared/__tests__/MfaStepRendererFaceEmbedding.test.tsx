/**
 * MfaStepRenderer — FACE submit path: client-side embedding vs legacy image.
 *
 * Phase 3 (Task 3.1) of the client-side Facenet512 sub-project. Behind the
 * `client-side-embedding` flag (mirrors the server flag `app.auth.client-side-embedding`),
 * the FACE capture submit uploads the 512-d embedding vector instead of the
 * cropped face image — the raw image then never leaves the device.
 *
 * Contract verified here (deterministic — embedder + flag are mocked, no ONNX):
 *   - Flag ON  → verifyStep(FACE, { embedding: number[512] }) and NOT { image }.
 *   - Flag OFF → verifyStep(FACE, { image }) exactly as the legacy path did.
 *
 * The FaceCaptureStep internals (camera, detection, capture) are mocked to a
 * single "Submit" button that hands a fixed captured data-URL up to onSubmit,
 * so this suite asserts ONLY the renderer's submit-path routing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '../../../../i18n'
import { AuthMethodType } from '@features/auth/constants'

// Inert biometric engine (the VOICE VAD path imports it at module load).
vi.mock('@/lib/biometric-engine/core/BiometricEngine', () => ({
    BiometricEngine: {
        getInstance: () => ({
            initialize: () => Promise.resolve(),
            voiceVAD: null,
        }),
    },
}))

// The captured frame the (mocked) FaceCaptureStep hands up on submit.
const CAPTURED_IMAGE = 'data:image/jpeg;base64,AAAA'
// The 478-pt mesh the real FaceCaptureStep surfaces alongside the frame, for the
// aligner. A 3-point stub is enough to assert it is threaded through unchanged.
const CAPTURED_LANDMARKS = [
    { x: 0.38, y: 0.42, z: 0 },
    { x: 0.62, y: 0.42, z: 0 },
    { x: 0.5, y: 0.6, z: 0 },
]

// Mock FaceCaptureStep down to a single Submit button so we drive ONLY the
// renderer's onSubmit routing — no camera / canvas / detection in jsdom. It hands
// up BOTH the captured image and the captured landmarks, mirroring the real step.
vi.mock('@features/auth/components/steps/FaceCaptureStep', () => ({
    __esModule: true,
    default: ({
        onSubmit,
    }: {
        onSubmit: (image: string, clientEmbedding?: number[], faceLandmarks?: unknown) => void
    }) => (
        <button type="button" onClick={() => onSubmit(CAPTURED_IMAGE, undefined, CAPTURED_LANDMARKS)}>
            face-submit
        </button>
    ),
}))

// Mock the client-side embedding flag + embed function so the test is
// deterministic and the flag value is injectable.
const flagState = { enabled: false }
const fakeEmbedding = Array.from({ length: 512 }, (_, i) => (i % 7) / 7)
const embedCapturedFaceMock = vi.fn(async () => fakeEmbedding)

vi.mock('@features/biometrics/embedding/clientEmbeddingFlag', () => ({
    isClientSideEmbeddingEnabled: () => flagState.enabled,
}))
vi.mock('@features/biometrics/embedding/embedCapturedFace', () => ({
    embedCapturedFace: (...args: unknown[]) => embedCapturedFaceMock(...(args as [])),
}))

import MfaStepRenderer from '../MfaStepRenderer'

function renderFaceStep() {
    const verifyStep = vi.fn()
    render(
        <MfaStepRenderer
            method={AuthMethodType.FACE}
            mfaSessionToken="sess-123"
            verifyStep={verifyStep}
            requestWebAuthnChallenge={vi.fn().mockResolvedValue(null)}
            httpClient={{
                get: vi.fn(),
                post: vi.fn().mockResolvedValue({ data: {} }),
                put: vi.fn(),
                patch: vi.fn(),
                delete: vi.fn(),
            } as unknown as Parameters<typeof MfaStepRenderer>[0]['httpClient']}
            onAuthenticated={vi.fn()}
            onBack={vi.fn()}
            loading={false}
            onError={vi.fn()}
        />,
    )
    return { verifyStep }
}

describe('MfaStepRenderer — FACE submit: client embedding vs legacy image', () => {
    beforeEach(() => {
        flagState.enabled = false
        embedCapturedFaceMock.mockClear()
        embedCapturedFaceMock.mockResolvedValue(fakeEmbedding)
    })

    it('flag OFF (default): uploads the captured { image } unchanged, never embeds', async () => {
        flagState.enabled = false
        const { verifyStep } = renderFaceStep()

        await userEvent.click(screen.getByRole('button', { name: 'face-submit' }))

        await waitFor(() => expect(verifyStep).toHaveBeenCalledTimes(1))
        expect(verifyStep).toHaveBeenCalledWith(AuthMethodType.FACE, { image: CAPTURED_IMAGE })
        expect(embedCapturedFaceMock).not.toHaveBeenCalled()
    })

    it('flag ON: uploads { embedding: number[512] } and NOT { image }', async () => {
        flagState.enabled = true
        const { verifyStep } = renderFaceStep()

        await userEvent.click(screen.getByRole('button', { name: 'face-submit' }))

        await waitFor(() => expect(verifyStep).toHaveBeenCalledTimes(1))
        // The renderer threads the captured face landmarks (for the aligner) as the
        // 2nd arg of embedCapturedFace, so the aligner maps eyes → canonical before
        // the local embedding (the self-consistency-critical step).
        expect(embedCapturedFaceMock).toHaveBeenCalledWith(CAPTURED_IMAGE, CAPTURED_LANDMARKS)

        const [method, payload] = verifyStep.mock.calls[0]
        expect(method).toBe(AuthMethodType.FACE)
        expect(payload).toHaveProperty('embedding')
        expect(payload).not.toHaveProperty('image')
        expect(Array.isArray((payload as { embedding: number[] }).embedding)).toBe(true)
        expect((payload as { embedding: number[] }).embedding).toHaveLength(512)
    })

    it('flag ON but embedding fails: falls back to the legacy { image } upload (never blocks auth)', async () => {
        flagState.enabled = true
        embedCapturedFaceMock.mockResolvedValue(null)
        const { verifyStep } = renderFaceStep()

        await userEvent.click(screen.getByRole('button', { name: 'face-submit' }))

        await waitFor(() => expect(verifyStep).toHaveBeenCalledTimes(1))
        expect(verifyStep).toHaveBeenCalledWith(AuthMethodType.FACE, { image: CAPTURED_IMAGE })
    })
})
