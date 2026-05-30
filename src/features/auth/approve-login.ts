/**
 * Approve-login (number-matching) initiator client
 *
 * Phase 3 of the no-Firebase, number-matching approve-login. The PC/web side
 * starts a session for an email, shows a 2-digit match number, and polls until
 * the user taps the matching number on a device where they are already signed
 * in (the "initiator" half — the approver lives in the mobile/desktop apps).
 *
 * Endpoints (see API contract, agent-api-auth):
 *   POST /auth/approve-login/session  { email }
 *     → { sessionId, matchNumber, status: "PENDING", expiresAtEpochSeconds }
 *   GET  /auth/approve-login/session/{sessionId}
 *     → { status, accessToken?, refreshToken?, expiresIn?, role? }
 *
 * Tokens are present only when `status === "APPROVED"`.
 */

import type { IHttpClient } from '@domain/interfaces/IHttpClient'

export const APPROVE_LOGIN_API = {
    SESSION: '/auth/approve-login/session',
    SESSION_BY_ID: (sessionId: string) =>
        `/auth/approve-login/session/${encodeURIComponent(sessionId)}`,
} as const

export type ApproveLoginStatus = 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED'

/** Response from starting an approve-login session. */
export interface ApproveLoginSession {
    sessionId: string
    matchNumber: number
    status: ApproveLoginStatus
    expiresAtEpochSeconds: number
}

/** Poll response for an approve-login session. Tokens only on APPROVED. */
export interface ApproveLoginPoll {
    status: ApproveLoginStatus
    accessToken?: string
    refreshToken?: string
    expiresIn?: number
    role?: string
}

/** How often to poll the session status, in milliseconds. */
export const APPROVE_LOGIN_POLL_INTERVAL_MS = 2000

/** Start an approve-login session for the given email. */
export async function startApproveLoginSession(
    httpClient: IHttpClient,
    email: string,
): Promise<ApproveLoginSession> {
    const res = await httpClient.post<ApproveLoginSession>(
        APPROVE_LOGIN_API.SESSION,
        { email },
    )
    return res.data
}

/**
 * Poll an approve-login session once. A 404/410 (session gone) is normalized to
 * an `EXPIRED` status so callers don't have to special-case the disappearance
 * of a session that timed out server-side.
 */
export async function pollApproveLoginSession(
    httpClient: IHttpClient,
    sessionId: string,
): Promise<ApproveLoginPoll> {
    try {
        const res = await httpClient.get<ApproveLoginPoll>(
            APPROVE_LOGIN_API.SESSION_BY_ID(sessionId),
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
