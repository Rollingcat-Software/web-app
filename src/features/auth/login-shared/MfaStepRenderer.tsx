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
import { AuthMethodType, AUTH_API, MfaStepAction } from '../constants'
import { pollQrLoginSession } from '../qr-login'
import { pollApproveLoginSession } from '../approve-login'
import type { ChallengeResponse } from '../webauthn-utils'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { MfaStepResponse } from '@domain/interfaces/IAuthRepository'
import { BiometricEngine } from '@/lib/biometric-engine/core/BiometricEngine'
import TotpStep from '../components/steps/TotpStep'
import SmsOtpStep from '../components/steps/SmsOtpStep'
import FaceCaptureStep from '../components/steps/FaceCaptureStep'
import VoiceStep from '../components/steps/VoiceStep'
import FingerprintStep from '../components/steps/FingerprintStep'
import QrSessionMfaStep from '../components/steps/QrSessionMfaStep'
import ApproveLoginMfaStep from '../components/steps/ApproveLoginMfaStep'
import HardwareKeyStep from '../components/steps/HardwareKeyStep'
import NfcStep from '../components/steps/NfcStep'
import EmailOtpMfaStep from '../components/steps/EmailOtpMfaStep'
import GestureLivenessStep from '../components/steps/GestureLivenessStep'
import PasswordStep from '../components/steps/PasswordStep'

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
                    onSubmit={(image) => verifyStep(AuthMethodType.FACE, { image })}
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
                <QrSessionMfaStep
                    onRequestSession={async () => {
                        // Phase 1 — ask the QR_CODE step (two-phase, action:challenge)
                        // for a STEP-BOUND session. The web renders + polls it; the
                        // user's phone scans + approves. No token to type → no cheat.
                        const res = await httpClient.post<MfaStepResponse>(AUTH_API.MFA_STEP, {
                            sessionToken: mfaSessionToken,
                            method: AuthMethodType.QR_CODE,
                            data: { action: MfaStepAction.CHALLENGE },
                        })
                        const body = (res.data?.data ?? {}) as {
                            qrSessionId?: string
                            expiresAtEpochSeconds?: number
                        }
                        return body.qrSessionId
                            ? { qrSessionId: body.qrSessionId, expiresAtEpochSeconds: body.expiresAtEpochSeconds }
                            : null
                    }}
                    pollSession={(id) => pollQrLoginSession(httpClient, id)}
                    onSubmit={(qrSessionId) => verifyStep(AuthMethodType.QR_CODE, { qrSessionId })}
                    loading={loading}
                    error={error}
                />
            )

        case AuthMethodType.APPROVE_LOGIN:
            return (
                <ApproveLoginMfaStep
                    onRequestApproval={async () => {
                        // Phase 1 — challenge the APPROVE_LOGIN step → step-bound
                        // approve session (match number) for this user.
                        const res = await httpClient.post<MfaStepResponse>(AUTH_API.MFA_STEP, {
                            sessionToken: mfaSessionToken,
                            method: AuthMethodType.APPROVE_LOGIN,
                            data: { action: MfaStepAction.CHALLENGE },
                        })
                        const body = (res.data?.data ?? {}) as {
                            approveSessionId?: string
                            matchNumber?: string
                            expiresAtEpochSeconds?: number
                        }
                        return body.approveSessionId
                            ? {
                                approveSessionId: body.approveSessionId,
                                matchNumber: body.matchNumber ?? '',
                                expiresAtEpochSeconds: body.expiresAtEpochSeconds,
                            }
                            : null
                    }}
                    pollApproval={(id) => pollApproveLoginSession(httpClient, id)}
                    onSubmit={(approveSessionId) => verifyStep(AuthMethodType.APPROVE_LOGIN, { approveSessionId })}
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

        default:
            return (
                <Alert severity="warning" sx={{ borderRadius: '12px' }}>
                    {t('widget.unknownMethod', { method })}
                </Alert>
            )
    }
}
