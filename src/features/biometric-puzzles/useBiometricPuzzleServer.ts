/**
 * useBiometricPuzzleServer (Bug 4, 2026-05-12)
 *
 * Server-validation client for the biometric-puzzles training surface.
 *
 * Before this hook, ``FacePuzzle.tsx`` and ``HandGesturePuzzle.tsx`` ran
 * local MediaPipe detection and called ``onSuccess()`` purely client-side.
 * That meant anyone could mock the component and "pass" any puzzle
 * regardless of what was on camera — there was no audit trail and no way
 * for the server to enforce structural sanity (timestamp monotonicity,
 * duration floors, confidence floors).
 *
 * This hook posts a single completed challenge to the biometric-processor
 * ``/liveness/verify-challenge`` endpoint via the identity-core-api proxy.
 * Only a server-200 + ``verified=true`` resolves the puzzle. Server
 * rejection or network error surfaces as a translated error message via
 * the existing toast/error pattern (``formatApiError`` + ``t()``).
 *
 * Graceful degradation: if the proxy endpoint returns 404 (operator hasn't
 * deployed the new bio + identity-core-api versions yet), the hook logs a
 * warning and treats the verification as a soft-pass so the training UI
 * continues to function during the rollout window. Once the proxy lands,
 * this fallback path stops being exercised.
 */
import { useCallback, useMemo, useRef } from 'react'
import type { TFunction } from 'i18next'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import { formatApiError } from '@utils/formatApiError'

/** Server-side challenge actions accepted by the biometric-processor enum. */
export type PuzzleServerAction =
    | 'blink'
    | 'smile'
    | 'light'
    | 'turn_left'
    | 'turn_right'
    | 'open_mouth'
    | 'raise_eyebrows'
    | 'finger_count'
    | 'shape_trace'
    | 'wave'
    | 'hand_flip'
    | 'finger_tap'
    | 'pinch'
    | 'peek_a_boo'
    | 'math'
    | 'hold_position'

export interface PuzzleVerifyRequestPayload {
    action: PuzzleServerAction
    startTimestampMs: number
    endTimestampMs: number
    confidence: number
    tenantId?: string
    userId?: string
    metrics?: Record<string, unknown>
}

export interface PuzzleVerifyResult {
    kind: 'success'
    durationSeconds: number
}
export interface PuzzleVerifyError {
    kind: 'error'
    message: string
    /** Server reason code (e.g. DURATION_TOO_SHORT) when available. */
    reasonCode?: string
}
export interface PuzzleVerifySoftPass {
    /**
     * Server endpoint isn't deployed yet (404). The hook treats this as a
     * soft-pass so the training UI continues to work during rollout.
     */
    kind: 'soft_pass'
    reason: 'endpoint_not_deployed'
}

export type PuzzleVerifyOutcome =
    | PuzzleVerifyResult
    | PuzzleVerifyError
    | PuzzleVerifySoftPass

/** identity-core-api proxy path for the bio `/liveness/verify-challenge` route. */
const VERIFY_CHALLENGE_PATH = '/biometric/puzzles/verify-challenge'

interface ServerResponse {
    verified?: boolean
    action?: string
    duration_seconds?: number
    reason_code?: string | null
    message?: string
}

export function useBiometricPuzzleServer() {
    const httpClient = useService<IHttpClient>(TYPES.HttpClient)
    /** Throttle 404 warnings — log once per session, not per puzzle attempt. */
    const not_deployed_warned_ref = useRef(false)

    const verifyChallenge = useCallback(
        async (
            payload: PuzzleVerifyRequestPayload,
            t: TFunction,
        ): Promise<PuzzleVerifyOutcome> => {
            const body = {
                action: payload.action,
                start_timestamp_ms: payload.startTimestampMs,
                end_timestamp_ms: payload.endTimestampMs,
                confidence: payload.confidence,
                tenant_id: payload.tenantId,
                user_id: payload.userId,
                metrics: payload.metrics ?? {},
            }

            try {
                const res = await httpClient.post<ServerResponse>(
                    VERIFY_CHALLENGE_PATH,
                    body,
                )
                if (res.data?.verified === true) {
                    return {
                        kind: 'success',
                        durationSeconds: res.data.duration_seconds ?? 0,
                    }
                }
                return {
                    kind: 'error',
                    message:
                        res.data?.message ||
                        t('biometricPuzzle.serverRejected', {
                            defaultValue: 'Server rejected the challenge.',
                        }),
                    reasonCode: res.data?.reason_code ?? undefined,
                }
            } catch (err) {
                // Endpoint not deployed yet (404) → soft pass, log once.
                const status = (err as { response?: { status?: number } })
                    ?.response?.status
                if (status === 404) {
                    if (!not_deployed_warned_ref.current) {
                        not_deployed_warned_ref.current = true
                        console.warn(
                            '[biometric-puzzles] /biometric/puzzles/verify-challenge ' +
                                'proxy not deployed yet — running in soft-pass mode. ' +
                                'Operator: merge bio fix/2026-05-12-liveness-and-puzzles ' +
                                'and the matching identity-core-api proxy to enable ' +
                                'server validation.',
                        )
                    }
                    return { kind: 'soft_pass', reason: 'endpoint_not_deployed' }
                }
                return {
                    kind: 'error',
                    message: formatApiError(err, t),
                }
            }
        },
        [httpClient],
    )

    return useMemo(() => ({ verifyChallenge }), [verifyChallenge])
}
