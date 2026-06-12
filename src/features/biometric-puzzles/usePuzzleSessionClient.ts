/**
 * usePuzzleSessionClient (CV-3, 2026-06-12)
 *
 * Client for the SERVER-ISSUED, single-use, anti-replay puzzle SESSION that
 * powers the PUZZLE auth method. This is the convergence model that SUPERSEDES
 * the interim client-attested `server_verdicts[]` flow: bio is the sole scoring
 * authority, the browser only carries an opaque `session_id`.
 *
 * The browser never talks to biometric-processor directly — it calls the
 * identity-core-api MFA proxy (authorized by the in-progress MFA session token),
 * which forwards to bio with its X-API-Key:
 *
 *   CREATE  POST /auth/mfa/puzzle/session
 *           req  { sessionToken }
 *           resp { session_id, challenges: [{ action, params: {…}|null }] }
 *           (identity supplies allowed-types/count/difficulty from the server-side
 *            flow config — the web does NOT send them.)
 *
 *   SUBMIT  POST /auth/mfa/puzzle/session/{session_id}/challenge
 *           req  { sessionToken, action, metrics:{…}, start_timestamp_ms,
 *                  end_timestamp_ms, confidence }
 *           resp { verified, action, reason_code|null }
 *
 * The VERDICT (auth gate) is NOT here — that is the step verdict the surface
 * submits via `verifyStep(PUZZLE, { puzzle_session_id })`; the handler calls
 * bio's /verdict server-side. This client only does CREATE + per-challenge
 * SUBMIT (UX feedback). Both are fail-closed: a non-2xx / malformed response is
 * an error, never a silent pass.
 */
import { useCallback, useMemo } from 'react'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'

/** One server-issued challenge: an action plus optional server params. */
export interface IssuedChallenge {
    /** Canonical lower_snake action string (bio ChallengeType value). */
    action: string
    /** Optional server params, e.g. `{ target: 3 }` for finger_count. */
    params?: Record<string, unknown> | null
}

/** CREATE response — opaque session id + the server-randomized challenges. */
export interface PuzzleSessionCreateResult {
    session_id: string
    challenges: IssuedChallenge[]
}

/** SUBMIT response — bio's per-challenge verdict (UX feedback, not the gate). */
export interface PuzzleChallengeResult {
    verified: boolean
    action: string
    reason_code?: string | null
}

/** Per-challenge SUBMIT payload (snake_case wire shape, minus sessionToken). */
export interface PuzzleChallengeSubmit {
    action: string
    metrics: Record<string, number | boolean>
    startTimestampMs: number
    endTimestampMs: number
    confidence: number
}

const CREATE_PATH = '/auth/mfa/puzzle/session'
const submitPath = (sessionId: string) =>
    `/auth/mfa/puzzle/session/${encodeURIComponent(sessionId)}/challenge`

export interface PuzzleSessionClient {
    /**
     * CREATE a server-issued puzzle session for the in-progress MFA step.
     * Resolves with `{ session_id, challenges }`; rejects (fail-closed) on a
     * non-2xx response or a body without a `session_id`.
     */
    createSession: (sessionToken: string) => Promise<PuzzleSessionCreateResult>
    /**
     * SUBMIT one challenge's traces to an in-progress session. Resolves with
     * bio's `{ verified, action, reason_code }`; rejects on a non-2xx response.
     */
    submitChallenge: (
        sessionToken: string,
        sessionId: string,
        submit: PuzzleChallengeSubmit,
    ) => Promise<PuzzleChallengeResult>
}

export function usePuzzleSessionClient(): PuzzleSessionClient {
    const httpClient = useService<IHttpClient>(TYPES.HttpClient)

    const createSession = useCallback(
        async (sessionToken: string): Promise<PuzzleSessionCreateResult> => {
            const res = await httpClient.post<PuzzleSessionCreateResult>(
                CREATE_PATH,
                { sessionToken },
            )
            const data = res.data
            // Fail-closed: a session without an opaque id (or challenges) is an
            // error — never let the step proceed with no challenges to drive.
            if (!data || !data.session_id || !Array.isArray(data.challenges)) {
                throw new Error('puzzle_session_create_malformed')
            }
            return data
        },
        [httpClient],
    )

    const submitChallenge = useCallback(
        async (
            sessionToken: string,
            sessionId: string,
            submit: PuzzleChallengeSubmit,
        ): Promise<PuzzleChallengeResult> => {
            const res = await httpClient.post<PuzzleChallengeResult>(
                submitPath(sessionId),
                {
                    sessionToken,
                    action: submit.action,
                    metrics: submit.metrics,
                    start_timestamp_ms: submit.startTimestampMs,
                    end_timestamp_ms: submit.endTimestampMs,
                    confidence: submit.confidence,
                },
            )
            const data = res.data
            if (!data || typeof data.verified !== 'boolean') {
                throw new Error('puzzle_challenge_submit_malformed')
            }
            return data
        },
        [httpClient],
    )

    return useMemo(
        () => ({ createSession, submitChallenge }),
        [createSession, submitChallenge],
    )
}
