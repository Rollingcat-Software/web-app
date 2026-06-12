/**
 * MfaStepRenderer — VOICE submit path: client-side embedding vs legacy audio.
 *
 * Audit H3 (GPU-less voice). Behind the `client-side-voice-embedding` flag
 * (mirrors the server flag `app.auth.client-side-voice-embedding`), the VOICE
 * submit uploads the 256-d speaker embedding vector instead of the recorded
 * audio — the raw audio then never leaves the device.
 *
 * Contract verified here (deterministic — embedder + flag are mocked, no ONNX):
 *   - Flag OFF → verifyStep(VOICE, { voiceData }) exactly as the legacy path did.
 *   - Flag ON  → verifyStep(VOICE, { embedding: number[256] }) and NOT { voiceData }.
 *   - Flag ON + embedding fails → FALLS BACK to { voiceData } (the preprocessing
 *     is scaffold + the server accepts either when ON, so a model/preproc gap must
 *     never block the login — unlike FACE which hard-fails).
 *
 * The VoiceStep internals (mic, recorder) are mocked to a single button that
 * hands a fixed captured WAV data-URL up to onSubmit, so this suite asserts ONLY
 * the renderer's submit-path routing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '../../../../i18n'
import { AuthMethodType } from '@features/auth/constants'

// Inert biometric engine (the VOICE VAD path reads it; keep the VAD absent so the
// gate is skipped and we test ONLY the embedding routing).
vi.mock('@/lib/biometric-engine/core/BiometricEngine', () => ({
    BiometricEngine: {
        getInstance: () => ({
            initialize: () => Promise.resolve(),
            voiceVAD: null,
        }),
    },
}))

const CAPTURED_VOICE = 'data:audio/wav;base64,AAAA'

// Mock VoiceStep down to a single Submit button so we drive ONLY the renderer's
// onSubmit routing — no mic / MediaRecorder in jsdom.
vi.mock('@features/auth/components/steps/VoiceStep', () => ({
    __esModule: true,
    default: ({ onSubmit }: { onSubmit: (voiceData: string) => void }) => (
        <button type="button" onClick={() => onSubmit(CAPTURED_VOICE)}>
            voice-submit
        </button>
    ),
}))

// Mock the client-side voice embedding flag + embed function so the test is
// deterministic and the flag value is injectable.
const flagState = { enabled: false }
const fakeEmbedding = Array.from({ length: 256 }, (_, i) => (i % 7) / 7)
const embedCapturedVoiceMock = vi.fn(async () => fakeEmbedding as number[] | null)

vi.mock('@features/biometrics/voice-embedding/clientVoiceEmbeddingFlag', () => ({
    isClientSideVoiceEmbeddingEnabled: () => flagState.enabled,
}))
vi.mock('@features/biometrics/voice-embedding/embedCapturedVoice', () => ({
    embedCapturedVoice: (...args: unknown[]) => embedCapturedVoiceMock(...(args as [])),
}))

import MfaStepRenderer from '../MfaStepRenderer'

function renderVoiceStep() {
    const verifyStep = vi.fn()
    const onError = vi.fn()
    render(
        <MfaStepRenderer
            method={AuthMethodType.VOICE}
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
            onError={onError}
        />,
    )
    return { verifyStep, onError }
}

describe('MfaStepRenderer — VOICE submit: client embedding vs legacy audio', () => {
    beforeEach(() => {
        flagState.enabled = false
        embedCapturedVoiceMock.mockClear()
        embedCapturedVoiceMock.mockResolvedValue(fakeEmbedding)
    })

    it('flag OFF (default): uploads the captured { voiceData } unchanged, never embeds', async () => {
        flagState.enabled = false
        const { verifyStep } = renderVoiceStep()

        await userEvent.click(screen.getByRole('button', { name: 'voice-submit' }))

        await waitFor(() => expect(verifyStep).toHaveBeenCalledTimes(1))
        expect(verifyStep).toHaveBeenCalledWith(AuthMethodType.VOICE, { voiceData: CAPTURED_VOICE })
        expect(embedCapturedVoiceMock).not.toHaveBeenCalled()
    })

    it('flag ON: uploads { embedding: number[256] } and NOT { voiceData }', async () => {
        flagState.enabled = true
        const { verifyStep } = renderVoiceStep()

        await userEvent.click(screen.getByRole('button', { name: 'voice-submit' }))

        await waitFor(() => expect(verifyStep).toHaveBeenCalledTimes(1))
        expect(embedCapturedVoiceMock).toHaveBeenCalledWith(CAPTURED_VOICE)

        const [method, payload] = verifyStep.mock.calls[0]
        expect(method).toBe(AuthMethodType.VOICE)
        expect(payload).toHaveProperty('embedding')
        expect(payload).not.toHaveProperty('voiceData')
        expect(Array.isArray((payload as { embedding: number[] }).embedding)).toBe(true)
        expect((payload as { embedding: number[] }).embedding).toHaveLength(256)
    })

    it('flag ON but embedding fails: falls back to { voiceData } (never blocks the login)', async () => {
        flagState.enabled = true
        embedCapturedVoiceMock.mockResolvedValue(null)
        const { verifyStep, onError } = renderVoiceStep()

        await userEvent.click(screen.getByRole('button', { name: 'voice-submit' }))

        await waitFor(() => expect(verifyStep).toHaveBeenCalledTimes(1))
        // Unlike FACE, VOICE falls back to uploading the audio (scaffold preproc +
        // the server accepts either when ON), so the login is never blocked.
        expect(verifyStep).toHaveBeenCalledWith(AuthMethodType.VOICE, { voiceData: CAPTURED_VOICE })
        expect(onError).not.toHaveBeenCalled()
    })
})
