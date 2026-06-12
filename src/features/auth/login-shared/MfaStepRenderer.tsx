/**
 * MfaStepRenderer — the single, shared MFA-step → step-component router.
 *
 * BOTH login surfaces previously hand-maintained their own `switch (method)`
 * mapping each {@link AuthMethodType} to its step component:
 *   - dashboard:  `TwoFactorDispatcher.renderStep()`
 *   - hosted:     `LoginMfaFlow.renderMfaStep()`
 * They drifted (voice VAD gate + GESTURE_LIVENESS only existed on the
 * dashboard; PASSWORD `presetEmail` plumbing differed). This component is the
 * one place that knows how to render a verification step, so the two surfaces
 * stay pixel/behaviour-identical for the step body.
 *
 * It is intentionally PRESENTATIONAL + thin: it owns no flow state. Each
 * surface passes the same primitives it already has — `verifyStep` (POST
 * /auth/mfa/step), `requestWebAuthnChallenge`, and an `httpClient` for the
 * SMS-send / QR-generate side calls — plus the active session token, the
 * loading/error for the in-flight step, and (for EMAIL_OTP) the
 * `onAuthenticated`/`onBack` session callbacks the EmailOtpMfaStep needs.
 *
 * The legitimately-different SHELL (full-screen glass card on the dashboard vs
 * the in-card hosted flow) stays with each surface — this renders ONLY the step
 * body, exactly as both call sites did before.
 */

import { Alert } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { AuthMethodType, AUTH_API } from '../constants'
import type { ChallengeResponse } from '../webauthn-utils'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { MfaStepResponse } from '@domain/interfaces/IAuthRepository'
import { BiometricEngine } from '@/lib/biometric-engine/core/BiometricEngine'
import TotpStep from '../components/steps/TotpStep'
import SmsOtpStep from '../components/steps/SmsOtpStep'
import FaceCaptureStep from '../components/steps/FaceCaptureStep'
import VoiceStep from '../components/steps/VoiceStep'
import FingerprintStep from '../components/steps/FingerprintStep'
import QrCodeStep from '../components/steps/QrCodeStep'
import HardwareKeyStep from '../components/steps/HardwareKeyStep'
import NfcStep from '../components/steps/NfcStep'
import EmailOtpMfaStep from '../components/steps/EmailOtpMfaStep'
import GestureLivenessStep from '../components/steps/GestureLivenessStep'
import PasswordStep from '../components/steps/PasswordStep'
import PuzzleStep from './steps/PuzzleStep'
import { isClientSideEmbeddingEnabled } from '@features/biometrics/embedding/clientEmbeddingFlag'
import { embedCapturedFace } from '@features/biometrics/embedding/embedCapturedFace'
import { isClientSideVoiceEmbeddingEnabled } from '@features/biometrics/voice-embedding/clientVoiceEmbeddingFlag'
import { embedCapturedVoice } from '@features/biometrics/voice-embedding/embedCapturedVoice'
import type { PuzzleConfig } from '@domain/models/AuthMethod'

/**
 * Decode a `data:...;base64,...` URL into an ArrayBuffer.
 * Returns null for non-data-URL / non-base64 strings so the VAD check can
 * gracefully skip unsupported inputs instead of throwing.
 */
function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer | null {
    try {
        const commaIdx = dataUrl.indexOf(',')
        if (commaIdx < 0 || !dataUrl.startsWith('data:')) return null
        const base64 = dataUrl.slice(commaIdx + 1)
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        return bytes.buffer
    } catch {
        return null
    }
}

export interface MfaStepRendererProps {
    /** The active MFA method to render a verification step for. */
    method: string
    /** Active MFA session token (passed to EMAIL_OTP + the WebAuthn challenge). */
    mfaSessionToken: string
    /** POST /auth/mfa/step — verify the current factor. */
    verifyStep: (methodType: string, data: Record<string, unknown>) => void
    /** Request a WebAuthn challenge for FINGERPRINT / HARDWARE_KEY. */
    requestWebAuthnChallenge: (method: AuthMethodType) => Promise<ChallengeResponse | null>
    /** HTTP client for the SMS-send + QR-generate side calls. */
    httpClient: IHttpClient
    /** EMAIL_OTP completes itself (auto-send + poll) and reports up through these. */
    onAuthenticated: (response: MfaStepResponse) => void
    onBack: () => void
    /** In-flight state for the CURRENT step (owned by the surface's flow). */
    loading: boolean
    error?: string
    /** Surface-controlled error setter, so the shared VAD/SMS paths surface inline. */
    onError: (message: string) => void
    /** Read-only identifier shown on a PASSWORD MFA step ("Signing in as <email>"). */
    presetEmail?: string
    /** Translate a step-local error (VAD no-speech) — defaults to i18n `t`. */
    /**
     * PUZZLE step configuration (present only when method === PUZZLE).
     *
     * CV-3 (2026-06-12): the PUZZLE step is now SERVER-DRIVEN — bio randomly
     * issues the challenges from the server-side flow config, so this is no
     * longer consumed at render time. Kept on the props for caller compatibility
     * (both surfaces still pass it) and as the tenant-authored source the backend
     * reads. Do NOT drive the client challenge list from it.
     */
    puzzleConfig?: PuzzleConfig
}

/**
 * Render the verification step body for `method`. Pure routing — no flow state.
 * Mirrors the exact wiring both surfaces used before extraction.
 */
export default function MfaStepRenderer({
    method,
    mfaSessionToken,
    verifyStep,
    requestWebAuthnChallenge,
    httpClient,
    onAuthenticated,
    onBack,
    loading,
    error,
    onError,
    presetEmail,
    puzzleConfig,
}: MfaStepRendererProps) {
    const { t } = useTranslation()

    // EMAIL_OTP (and the empty/unknown default) own their own session flow.
    if (!method || method === AuthMethodType.EMAIL_OTP) {
        return (
            <EmailOtpMfaStep
                mfaSessionToken={mfaSessionToken}
                onAuthenticated={onAuthenticated}
                onBack={onBack}
            />
        )
    }

    switch (method) {
        case AuthMethodType.PASSWORD:
            // PASSWORD as a (non-first) flow factor: identity is fixed by the
            // session, so collect ONLY the password and complete the step via
            // /auth/mfa/step. No "change identity" — we're mid-flow.
            return (
                <PasswordStep
                    presetEmail={presetEmail || undefined}
                    onSubmit={(data) => verifyStep(AuthMethodType.PASSWORD, { password: data.password })}
                    loading={loading}
                    error={error}
                />
            )

        case AuthMethodType.TOTP:
            return (
                <TotpStep
                    onSubmit={(code) => verifyStep(AuthMethodType.TOTP, { code })}
                    loading={loading}
                    error={error}
                />
            )

        case AuthMethodType.SMS_OTP:
            return (
                <SmsOtpStep
                    onSubmit={(code) => verifyStep(AuthMethodType.SMS_OTP, { code })}
                    onSendOtp={async () => {
                        try {
                            await httpClient.post(AUTH_API.MFA_SEND_OTP, {
                                sessionToken: mfaSessionToken,
                                method: AuthMethodType.SMS_OTP,
                            })
                        } catch {
                            // fire-and-forget — the user can re-request
                        }
                    }}
                    loading={loading}
                    error={error}
                />
            )

        case AuthMethodType.FACE:
            return (
                <FaceCaptureStep
                    onSubmit={async (image, _clientEmbedding, faceLandmarks, clientPadScore) => {
                        // ADVISORY client-side PAD score (SP-D, defense-in-depth).
                        // When the capture step computed a passive-liveness
                        // confidence, forward it to the server as `client_pad_score`
                        // — an OPTIONAL, ignored-safe sibling field. UNTRUSTED-CLIENT
                        // CAVEAT: it is advisory ONLY; the client never gates on it
                        // and the server treats it as a defense-in-depth signal, not
                        // a verdict. undefined when the flag is off / analyzer failed,
                        // in which case the payload is byte-identical to before.
                        const advisory =
                            clientPadScore !== undefined
                                ? { client_pad_score: clientPadScore }
                                : {}

                        // Client-side-embedding path (flag-gated, mirrors the
                        // server flag `app.auth.client-side-embedding`). When ON,
                        // compute the 512-d Facenet512 embedding in the browser
                        // from the SAME captured frame and upload ONLY the vector
                        // — the raw image never leaves the device. The captured
                        // 478-pt mesh is passed through so the embedder ALIGNS the
                        // face (eyes → canonical positions) first — this is what
                        // makes the client embedding self-consistent capture-to-
                        // capture; without it the embedding is an unaligned crop.
                        //
                        // GPU-LESS ENFORCEMENT (SP-A go-live): the CPU-only server
                        // EXPECTS the embedding and 400s the legacy image path when
                        // the identity flag `app.auth.client-side-embedding` is ON.
                        // So a null embedding (no model / ORT load fail / inference
                        // error) must NOT silently fall back to uploading the image
                        // — that upload would just be rejected by the server. Surface
                        // a clear, RETRYABLE error instead and let the user try again
                        // (the model cache self-heals on the next attempt + the
                        // prefetch re-warms it). NEVER send `{ image }` while ON.
                        if (isClientSideEmbeddingEnabled()) {
                            const embedding = await embedCapturedFace(image, faceLandmarks)
                            if (embedding) {
                                verifyStep(AuthMethodType.FACE, { embedding, ...advisory })
                                return
                            }
                            // On-device prep failed — show a retryable message; the
                            // captured frame stays so the user can simply re-submit.
                            onError(t('mfa.face.clientPrepFailed'))
                            return
                        }
                        // Flag OFF: legacy image upload, byte-identical to before.
                        verifyStep(AuthMethodType.FACE, { image, ...advisory })
                    }}
                    loading={loading}
                    error={error}
                />
            )

        case AuthMethodType.VOICE:
            return (
                <VoiceStep
                    onSubmit={async (voiceData) => {
                        // Client-side VAD: reject silent captures before server upload.
                        // Graceful fallback: when the Silero model is missing or the
                        // recording is not a 16kHz PCM WAV, the check is skipped and
                        // the upload proceeds exactly as before.
                        try {
                            const vad = BiometricEngine.getInstance().voiceVAD
                            if (vad && vad.isAvailable()) {
                                const wavBuffer = dataUrlToArrayBuffer(voiceData)
                                if (wavBuffer) {
                                    const result = await vad.classify(wavBuffer)
                                    // eslint-disable-next-line no-console
                                    console.debug('[VoiceVAD] decision', {
                                        speechRatio: result.speechRatio,
                                        confidence: result.confidence,
                                        isSpeech: result.isSpeech,
                                        wavBytes: wavBuffer.byteLength,
                                    })
                                    // Only block when classification actually ran
                                    // (confidence > 0 implies frames were evaluated).
                                    if (result.confidence > 0 && result.speechRatio < 0.2) {
                                        onError(t('mfa.voice.noSpeechDetected'))
                                        return
                                    }
                                }
                            }
                        } catch (vadErr) {
                            console.warn('[MfaStepRenderer] VAD check failed, proceeding:', vadErr)
                        }

                        // GPU-less VOICE (audit H3): when the client-side-voice-
                        // embedding flag is ON, compute the 256-d speaker vector
                        // in-browser and submit ONLY the vector (the raw audio
                        // never leaves the device). On ANY failure we fall back to
                        // uploading the audio so a scaffold/model-hosting gap never
                        // blocks the login (the server with the voice flag OFF
                        // would reject an embedding anyway; with it ON it accepts
                        // either). Flag OFF ⇒ byte-identical legacy audio upload.
                        if (isClientSideVoiceEmbeddingEnabled()) {
                            const embedding = await embedCapturedVoice(voiceData)
                            if (embedding) {
                                verifyStep(AuthMethodType.VOICE, { embedding })
                                return
                            }
                            console.warn(
                                '[MfaStepRenderer] client voice embedding unavailable; falling back to audio upload',
                            )
                        }
                        verifyStep(AuthMethodType.VOICE, { voiceData })
                    }}
                    loading={loading}
                    error={error}
                />
            )

        case AuthMethodType.FINGERPRINT:
            return (
                <FingerprintStep
                    onRequestChallenge={() => requestWebAuthnChallenge(AuthMethodType.FINGERPRINT)}
                    onSubmit={(data) => verifyStep(AuthMethodType.FINGERPRINT, { assertion: data })}
                    loading={loading}
                    error={error}
                />
            )

        case AuthMethodType.QR_CODE:
            return (
                <QrCodeStep
                    userId="mfa-session"
                    onGenerateToken={async () => {
                        const res = await httpClient.post<{ token: string; expiresInSeconds: number }>(
                            AUTH_API.MFA_QR_GENERATE,
                            { sessionToken: mfaSessionToken }
                        )
                        return res.data
                    }}
                    onSubmit={(token) => verifyStep(AuthMethodType.QR_CODE, { token })}
                    loading={loading}
                    error={error}
                />
            )

        case AuthMethodType.HARDWARE_KEY:
            return (
                <HardwareKeyStep
                    onRequestChallenge={() => requestWebAuthnChallenge(AuthMethodType.HARDWARE_KEY)}
                    onSubmit={(data) => verifyStep(AuthMethodType.HARDWARE_KEY, { assertion: data })}
                    loading={loading}
                    error={error}
                />
            )

        case AuthMethodType.NFC_DOCUMENT:
            return (
                <NfcStep
                    onSubmit={(data) => verifyStep(AuthMethodType.NFC_DOCUMENT, { nfcData: data })}
                    loading={loading}
                    error={error}
                    onBack={onBack}
                />
            )

        case AuthMethodType.GESTURE_LIVENESS:
            return (
                <GestureLivenessStep
                    onSubmit={(data) => verifyStep(AuthMethodType.GESTURE_LIVENESS, data)}
                    loading={loading}
                    error={error}
                />
            )

        case AuthMethodType.PUZZLE:
            // CV-3: PuzzleStep drives the SERVER-ISSUED puzzle session. It needs
            // the in-progress MFA session token to authorize the CREATE/SUBMIT
            // proxy calls; the challenge LIST comes from the server (flow config),
            // not the client `puzzleConfig`. The config IS still threaded through
            // for ONE thing — `alsoMatchFaceIdentity` (SP-B Phase 5): when the
            // tenant turned identity-binding ON (and the client-embedding flag is
            // on), PuzzleStep grabs a frontal best frame from the live session and
            // submits its 512-d embedding alongside the session id.
            return (
                <PuzzleStep
                    mfaSessionToken={mfaSessionToken}
                    verifyStep={verifyStep}
                    loading={loading}
                    error={error}
                    puzzleConfig={puzzleConfig}
                />
            )

        default:
            return (
                <Alert severity="warning" sx={{ borderRadius: '12px' }}>
                    {t('widget.unknownMethod', { method })}
                </Alert>
            )
    }
}
