/**
 * Cross-device QR login (initiator) client.
 *
 * The desktop/web "initiator" half of scan-to-login. The browser creates a QR
 * session, renders a QR code, and polls until an already-signed-in phone scans
 * it and approves. On APPROVED the server returns either real tokens (single
 * Layer-1 / engine-off) or — for a multi-step tenant flow — an `mfaSessionToken`
 * the caller must continue via /auth/mfa/step. The approver (scan + approve)
 * lives in the mobile/desktop apps.
 *
 * Endpoints (verified against identity-core-api QrController / QrSessionService):
 *   POST /auth/qr/session            { platform }
 *     → { sessionId, qrContent, status: "PENDING_SCAN", expiresAtEpochSeconds }
 *   GET  /auth/qr/session/{sessionId}
 *     → { status, qrContent, expiresAtEpochSeconds, role?, accessToken?,
 *         refreshToken?, expiresIn?, mfaRequired?, mfaSessionToken?,
 *         currentStep?, totalSteps? }
 *
 * IMPORTANT — what the QR encodes: the session is keyed in Redis by `sessionId`,
 * and the mobile approver looks the session up by the value it scans (its
 * `extractSessionId` reads a `session=<id>` param, else treats the whole payload
 * as the id). The random `qrContent` field is NOT a lookup key, so the QR must
 * encode the **sessionId** — `qrPayloadForSession()` does this. Encoding
 * `qrContent` would make the phone POST .../{qrContent}/approve and 404.
 */

import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { AvailableMfaMethod } from '@domain/interfaces/IAuthRepository'

export const QR_LOGIN_API = {
    SESSION: '/auth/qr/session',
    SESSION_BY_ID: (sessionId: string) =>
        `/auth/qr/session/${encodeURIComponent(sessionId)}`,
} as const

export type QrLoginStatus =
    | 'PENDING_SCAN'
    | 'PENDING_APPROVAL'
    | 'APPROVED'
    | 'EXPIRED'
    | 'REJECTED'
    | 'FAILED'

/** Response from creating a QR login session. */
export interface QrLoginSession {
    sessionId: string
    qrContent: string
    status: QrLoginStatus
    expiresAtEpochSeconds: number
}

/** Poll response. Tokens (or an mfaSessionToken) appear only on APPROVED. */
export interface QrLoginPoll {
    status: QrLoginStatus
    role?: string
    accessToken?: string
    refreshToken?: string
    /** SECONDS (server divides the millis TTL by 1000 before stashing). */
    expiresIn?: number
    /** True when the approved Layer-1 needs further tenant MFA steps. */
    mfaRequired?: boolean
    mfaSessionToken?: string
    currentStep?: number
    totalSteps?: number
    /**
     * Methods offered for the NEXT MFA step, when the approved Layer-1 needs
     * further steps. Lets the web continue into the existing MethodPicker /
     * MfaStepRenderer flow instead of dead-ending. May be absent/empty.
     */
    availableMethods?: AvailableMfaMethod[]
    /** Factors already satisfied (so the next picker can mark them used). */
    completedMethods?: string[]
}

/** How often to poll the session status, in milliseconds. */
export const QR_LOGIN_POLL_INTERVAL_MS = 2500

/**
 * The string the QR code must encode so the mobile approver resolves it back to
 * this session. Uses the documented `session=<id>` form the scanner parses, and
 * a `fivucsas://qr-login` scheme so a future Android deep-link can auto-open the
 * in-app scanner. See the module header for why this is the sessionId, not
 * `qrContent`.
 */
export function qrPayloadForSession(sessionId: string): string {
    return `fivucsas://qr-login?session=${encodeURIComponent(sessionId)}`
}

/** Create a QR login session for the given platform (defaults to "WEB"). */
export async function startQrLoginSession(
    httpClient: IHttpClient,
    platform = 'WEB',
): Promise<QrLoginSession> {
    const res = await httpClient.post<QrLoginSession>(QR_LOGIN_API.SESSION, {
        platform,
    })
    return res.data
}

/**
 * Poll a QR login session once. A 404/410 (session gone) is normalized to an
 * `EXPIRED` status so callers don't have to special-case its disappearance.
 */
export async function pollQrLoginSession(
    httpClient: IHttpClient,
    sessionId: string,
): Promise<QrLoginPoll> {
    try {
        const res = await httpClient.get<QrLoginPoll>(
            QR_LOGIN_API.SESSION_BY_ID(sessionId),
        )
        return res.data
    } catch (err) {
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status === 404 || status === 410) {
            return { status: 'EXPIRED' }
        }
        throw err
    }
}
