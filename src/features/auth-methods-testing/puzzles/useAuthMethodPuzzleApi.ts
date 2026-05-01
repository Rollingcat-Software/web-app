/**
 * useAuthMethodPuzzleApi
 *
 * Shared backend wiring for the Auth Methods Testing playground. Each puzzle
 * uses this hook to talk to the *real* identity-core-api endpoints with the
 * signed-in admin's JWT — there is no longer any silent "stub success".
 *
 * Endpoints exercised:
 *   - Face   : POST /biometric/verify/{userId}        (auto /biometric/enroll/{userId} on first attempt)
 *   - Voice  : POST /biometric/voice/verify/{userId}  (auto /biometric/voice/enroll/{userId} on first attempt)
 *   - NFC    : POST /nfc/verify                       (real card serial round-trip)
 *   - WebAuthn fingerprint / hardware key:
 *       POST /webauthn/authenticate-options  (server challenge + allowCredentials)
 *       POST /webauthn/authenticate          (assertion verify)
 *
 * Errors are mapped through `formatApiError(err, t)` per project policy. We
 * never resolve "success" without a server-confirmed verdict.
 *
 * Companion to USER-BUG-5 — "all auth login methods… always return success
 * because they are not bound, connected, or they may be mock".
 */
import { useCallback, useMemo, useRef } from 'react'
import type { TFunction } from 'i18next'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import { useAuth } from '@features/auth/hooks/useAuth'
import { getBiometricService } from '@core/services/BiometricService'
import { formatApiError } from '@utils/formatApiError'
import type { ChallengeResponse } from '@features/auth/webauthn-utils'

export interface AuthMethodPuzzleApi {
    /** Verify a captured face image. Auto-enrolls on the first attempt if no template exists. */
    submitFace: (image: string, t: TFunction) => Promise<PuzzleResult>
    /** Verify a recorded voice sample (base64 data URL). Auto-enrolls on the first attempt. */
    submitVoice: (voiceData: string, t: TFunction) => Promise<PuzzleResult>
    /** Verify an NFC card serial against /nfc/verify. */
    submitNfc: (cardSerial: string, t: TFunction) => Promise<PuzzleResult>
    /** Fetch a server-issued WebAuthn challenge bound to the signed-in admin's email. */
    requestWebAuthnChallenge: (t: TFunction) => Promise<ChallengeResponse | null>
    /** Submit a WebAuthn assertion produced from the challenge above. */
    submitWebAuthnAssertion: (data: string, t: TFunction) => Promise<PuzzleResult>
}

export type PuzzleResult =
    | { kind: 'success' }
    /** A round-trip happened, but the server returned a soft notice (e.g. first-time enroll). */
    | { kind: 'info'; message: string }
    | { kind: 'error'; message: string }

/**
 * Voice/Face verify response shapes are identical at the proxy boundary
 * (BiometricVerificationResponse).
 */
interface VerifyResponse {
    verified?: boolean
    confidence?: number
    message?: string
}

interface NfcVerifyResponse {
    verified?: boolean
    userId?: string
    cardId?: string
    message?: string
}

interface WebAuthnAuthenticateOptions {
    sessionId: string
    challenge: string
    rpId?: string
    allowCredentials?: Array<{ id: string; type: string; transports?: string[] }>
    userVerification?: string
    timeout?: number
}

interface WebAuthnAuthenticateResponse {
    success?: boolean
    message?: string
}

export function useAuthMethodPuzzleApi(): AuthMethodPuzzleApi {
    const httpClient = useService<IHttpClient>(TYPES.HttpClient)
    const { user } = useAuth()
    const biometric = useMemo(() => getBiometricService(), [])

    /** Persisted across the WebAuthn challenge → assertion handshake. */
    const webauthnSessionRef = useRef<string | null>(null)

    const ensureUser = useCallback(
        (t: TFunction): { id: string; email: string } | { error: string } => {
            if (!user?.id || !user?.email) {
                return { error: t('authMethodsTesting.errors.notAuthenticated') }
            }
            return { id: String(user.id), email: String(user.email) }
        },
        [user],
    )

    // ── Face ────────────────────────────────────────────────────────────────
    const submitFace = useCallback<AuthMethodPuzzleApi['submitFace']>(
        async (image, t) => {
            const u = ensureUser(t)
            if ('error' in u) return { kind: 'error', message: u.error }

            try {
                const result = await biometric.verifyFace(u.id, image)
                if (result.verified) {
                    return { kind: 'success' }
                }
                return {
                    kind: 'error',
                    message:
                        result.message || t('authMethodsTesting.errors.verifyRejected'),
                }
            } catch (err) {
                // 404 / no enrollment → fall through to first-time enroll.
                if (isNotEnrolledError(err)) {
                    try {
                        await biometric.enrollFace(u.id, image)
                        return {
                            kind: 'info',
                            message: t('authMethodsTesting.info.autoEnrolled'),
                        }
                    } catch (enrollErr) {
                        return { kind: 'error', message: formatApiError(enrollErr, t) }
                    }
                }
                return { kind: 'error', message: formatApiError(err, t) }
            }
        },
        [biometric, ensureUser],
    )

    // ── Voice ───────────────────────────────────────────────────────────────
    const submitVoice = useCallback<AuthMethodPuzzleApi['submitVoice']>(
        async (voiceData, t) => {
            const u = ensureUser(t)
            if ('error' in u) return { kind: 'error', message: u.error }

            try {
                const res = await httpClient.post<VerifyResponse>(
                    `/biometric/voice/verify/${encodeURIComponent(u.id)}`,
                    { voiceData },
                )
                const verified =
                    res.data.verified === true ||
                    (typeof res.data.confidence === 'number' && res.data.confidence > 0.5)
                if (verified) {
                    return { kind: 'success' }
                }
                return {
                    kind: 'error',
                    message:
                        res.data.message || t('authMethodsTesting.errors.verifyRejected'),
                }
            } catch (err) {
                if (isNotEnrolledError(err)) {
                    try {
                        await httpClient.post(
                            `/biometric/voice/enroll/${encodeURIComponent(u.id)}`,
                            { voiceData },
                        )
                        return {
                            kind: 'info',
                            message: t('authMethodsTesting.info.autoEnrolled'),
                        }
                    } catch (enrollErr) {
                        return { kind: 'error', message: formatApiError(enrollErr, t) }
                    }
                }
                return { kind: 'error', message: formatApiError(err, t) }
            }
        },
        [httpClient, ensureUser],
    )

    // ── NFC ─────────────────────────────────────────────────────────────────
    const submitNfc = useCallback<AuthMethodPuzzleApi['submitNfc']>(
        async (cardSerial, t) => {
            const u = ensureUser(t)
            if ('error' in u) return { kind: 'error', message: u.error }

            try {
                const res = await httpClient.post<NfcVerifyResponse>('/nfc/verify', {
                    cardSerial,
                })
                // /nfc/verify returns the matching userId when the card is enrolled.
                const matched =
                    res.data.verified === true ||
                    (typeof res.data.userId === 'string' && res.data.userId.length > 0)
                if (matched) {
                    return { kind: 'success' }
                }
                return {
                    kind: 'error',
                    message:
                        res.data.message || t('authMethodsTesting.errors.verifyRejected'),
                }
            } catch (err) {
                return { kind: 'error', message: formatApiError(err, t) }
            }
        },
        [httpClient, ensureUser],
    )

    // ── WebAuthn (fingerprint + hardware key) ───────────────────────────────
    const requestWebAuthnChallenge = useCallback<
        AuthMethodPuzzleApi['requestWebAuthnChallenge']
    >(
        async (t) => {
            const u = ensureUser(t)
            if ('error' in u) {
                webauthnSessionRef.current = null
                return null
            }

            try {
                const res = await httpClient.post<WebAuthnAuthenticateOptions>(
                    '/webauthn/authenticate-options',
                    { email: u.email },
                )
                webauthnSessionRef.current = res.data.sessionId ?? null
                return {
                    challenge: res.data.challenge,
                    rpId: res.data.rpId,
                    allowCredentials: (res.data.allowCredentials ?? [])
                        .map((c) => c.id)
                        .filter((id): id is string => typeof id === 'string'),
                }
            } catch {
                webauthnSessionRef.current = null
                return null
            }
        },
        [httpClient, ensureUser],
    )

    const submitWebAuthnAssertion = useCallback<
        AuthMethodPuzzleApi['submitWebAuthnAssertion']
    >(
        async (data, t) => {
            const sessionId = webauthnSessionRef.current
            if (!sessionId) {
                return {
                    kind: 'error',
                    message: t('authMethodsTesting.errors.webauthnNoCredentials'),
                }
            }

            // FingerprintStep / HardwareKeyStep encode the assertion as
            // btoa(JSON.stringify({...})). Decode standard base64 ⇒ object.
            let parsed: Record<string, string>
            try {
                parsed = JSON.parse(atob(data)) as Record<string, string>
            } catch {
                return {
                    kind: 'error',
                    message: t('authMethodsTesting.errors.verifyRejected'),
                }
            }

            try {
                const res = await httpClient.post<WebAuthnAuthenticateResponse>(
                    '/webauthn/authenticate',
                    {
                        sessionId,
                        credentialId: parsed.credentialId,
                        authenticatorData: parsed.authenticatorData,
                        clientDataJSON: parsed.clientDataJSON,
                        signature: parsed.signature,
                    },
                )
                webauthnSessionRef.current = null
                if (res.data.success) {
                    return { kind: 'success' }
                }
                return {
                    kind: 'error',
                    message:
                        res.data.message || t('authMethodsTesting.errors.verifyRejected'),
                }
            } catch (err) {
                webauthnSessionRef.current = null
                return { kind: 'error', message: formatApiError(err, t) }
            }
        },
        [httpClient],
    )

    return {
        submitFace,
        submitVoice,
        submitNfc,
        requestWebAuthnChallenge,
        submitWebAuthnAssertion,
    }
}

/**
 * Heuristic — does this error indicate "no enrollment yet for this user"?
 * The proxy commonly returns 404 plus an error_code containing "NOT_FOUND" or
 * "NOT_ENROLLED".
 */
function isNotEnrolledError(err: unknown): boolean {
    const e = err as {
        response?: { status?: number; data?: { error_code?: string; detail?: string } }
    }
    if (e?.response?.status !== 404) return false
    const code = (e.response.data?.error_code ?? '').toUpperCase()
    const detail = (e.response.data?.detail ?? '').toUpperCase()
    return (
        code.includes('NOT_FOUND') ||
        code.includes('NOT_ENROLLED') ||
        detail.includes('NOT FOUND') ||
        detail.includes('NOT ENROLLED')
    )
}
