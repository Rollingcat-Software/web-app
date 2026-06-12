/**
 * MfaStepRenderer — FACE submit path: ADVISORY client PAD score threading (SP-D).
 *
 * SP-D (defense-in-depth) computes a passive client-side PAD / liveness score on
 * the captured FACE frame and forwards it to the server as an ADVISORY field
 * (`client_pad_score`) alongside the existing payload. UNTRUSTED-CLIENT CAVEAT:
 * it is advisory ONLY — the client never blocks/allows a login based on it.
 *
 * Contract verified here (deterministic — FaceCaptureStep + embedding flag mocked):
 *   - PAD score present → verifyStep(FACE, { image, client_pad_score }).
 *   - PAD score absent (analyzer off/failed) → verifyStep(FACE, { image }) only —
 *     identical to the legacy path, so a failed PAD score NEVER blocks the login.
 *   - The advisory score rides ALONGSIDE the client-side embedding when that path
 *     is on: verifyStep(FACE, { embedding, client_pad_score }).
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

const CAPTURED_IMAGE = 'data:image/jpeg;base64,AAAA'
const CAPTURED_LANDMARKS = [
    { x: 0.38, y: 0.42, z: 0 },
    { x: 0.62, y: 0.42, z: 0 },
    { x: 0.5, y: 0.6, z: 0 },
]

// Injectable PAD score the mocked FaceCaptureStep hands up as the 4th onSubmit arg.
const captureState: { padScore: number | undefined } = { padScore: undefined }

// Mock FaceCaptureStep to a single Submit button so we drive ONLY the renderer's
// onSubmit routing. It hands up image + landmarks + (optionally) the advisory PAD.
vi.mock('@features/auth/components/steps/FaceCaptureStep', () => ({
    __esModule: true,
    default: ({
        onSubmit,
    }: {
        onSubmit: (
            image: string,
            clientEmbedding?: number[],
            faceLandmarks?: unknown,
            clientPadScore?: number,
        ) => void
    }) => (
        <button
            type="button"
            onClick={() =>
                onSubmit(CAPTURED_IMAGE, undefined, CAPTURED_LANDMARKS, captureState.padScore)
            }
        >
            face-submit
        </button>
    ),
}))

// Embedding flag + embed function mocked so the test is deterministic (no ONNX).
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

describe('MfaStepRenderer — FACE submit: advisory client PAD score (SP-D)', () => {
    beforeEach(() => {
        flagState.enabled = false
        captureState.padScore = undefined
        embedCapturedFaceMock.mockClear()
        embedCapturedFaceMock.mockResolvedValue(fakeEmbedding)
    })

    it('threads the advisory PAD score into the legacy { image } payload', async () => {
        captureState.padScore = 0.83
        const { verifyStep } = renderFaceStep()

        await userEvent.click(screen.getByRole('button', { name: 'face-submit' }))

        await waitFor(() => expect(verifyStep).toHaveBeenCalledTimes(1))
        expect(verifyStep).toHaveBeenCalledWith(AuthMethodType.FACE, {
            image: CAPTURED_IMAGE,
            client_pad_score: 0.83,
        })
    })

    it('omits the field entirely when no PAD score is available (failed/off does NOT block, payload unchanged)', async () => {
        captureState.padScore = undefined
        const { verifyStep } = renderFaceStep()

        await userEvent.click(screen.getByRole('button', { name: 'face-submit' }))

        await waitFor(() => expect(verifyStep).toHaveBeenCalledTimes(1))
        // Byte-identical to the legacy path — login proceeds with no advisory field.
        expect(verifyStep).toHaveBeenCalledWith(AuthMethodType.FACE, { image: CAPTURED_IMAGE })
        const [, payload] = verifyStep.mock.calls[0]
        expect(payload).not.toHaveProperty('client_pad_score')
    })

    it('rides alongside the client-side embedding payload when that path is on', async () => {
        flagState.enabled = true
        captureState.padScore = 0.91
        const { verifyStep } = renderFaceStep()

        await userEvent.click(screen.getByRole('button', { name: 'face-submit' }))

        await waitFor(() => expect(verifyStep).toHaveBeenCalledTimes(1))
        const [method, payload] = verifyStep.mock.calls[0]
        expect(method).toBe(AuthMethodType.FACE)
        expect(payload).toHaveProperty('embedding')
        expect((payload as { embedding: number[] }).embedding).toHaveLength(512)
        expect((payload as { client_pad_score: number }).client_pad_score).toBe(0.91)
        expect(payload).not.toHaveProperty('image')
    })
})
