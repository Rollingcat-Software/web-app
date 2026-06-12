/**
 * PuzzleStep — PUZZLE auth-method MFA step (CV-3, 2026-06-12)
 *
 * SERVER-AUTHORITATIVE, anti-replay puzzle SESSION. This rewrite CONVERGES the
 * SP-B Phase-3 interim (client-attested `server_verdicts[]`) onto the
 * server-issued session model (CV-1 bio + CV-2 identity). The interim model is
 * REMOVED: the step no longer forwards any per-challenge verdicts the server has
 * to trust — bio is the sole scoring authority and the browser carries only an
 * opaque `session_id`.
 *
 * Flow:
 *   1. On mount, CREATE a session via the identity MFA proxy
 *      (`POST /auth/mfa/puzzle/session`, authorized by the in-progress MFA
 *      `sessionToken` this step receives). bio randomly selects the challenges
 *      from the server-side flow config — the web drives EXACTLY those issued
 *      challenges in order, NOT the client `puzzleConfig`.
 *   2. For each issued challenge, render the matching web puzzle component
 *      (action → BiometricPuzzleId via the registry reverse map). When the user
 *      completes it, SUBMIT the canonical metric to
 *      `POST /auth/mfa/puzzle/session/{id}/challenge`. The SUBMIT `{verified}`
 *      drives per-challenge UX — fail-CLOSED: a false/non-2xx surfaces an error
 *      and does NOT advance (no soft-pass in this server-authoritative model).
 *   3. On all challenges complete, submit the auth gate:
 *      `verifyStep(PUZZLE, { puzzle_session_id })`. The handler asks bio for the
 *      authoritative verdict (owner-bound, single-use). The client sends ONLY
 *      the session id — no metrics, no verdicts.
 *
 * Flag-gated + additive: the PUZZLE method only renders when the tenant's flow
 * includes it. The standalone `/biometric-puzzles` training surface is untouched
 * (it uses `serverMode='training'`; this step uses the session proxy directly).
 *
 * alsoMatchFaceIdentity (Phase 5) is intentionally not wired in this phase —
 * liveness-only for now.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material'
import { Replay } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import { AuthMethodType } from '@features/auth/constants'
import { getBiometricPuzzle } from '@features/biometric-puzzles/biometricPuzzleRegistry'
import { BiometricPuzzleId } from '@features/biometric-puzzles/BiometricPuzzleId'
import {
    serverActionToPuzzleId,
    metricKeyForAction,
} from '@features/biometric-puzzles/puzzleServerAction'
import type { PuzzleServerVerdict } from '@features/biometric-puzzles/useBiometricPuzzleServer'
import {
    usePuzzleSessionClient,
    type IssuedChallenge,
} from '@features/biometric-puzzles/usePuzzleSessionClient'
import StepLayout from '../../components/steps/StepLayout'

export interface PuzzleStepProps {
    /** In-progress MFA session token — authorizes the puzzle-session proxy. */
    mfaSessionToken: string
    verifyStep: (methodType: string, data: Record<string, unknown>) => void
    loading: boolean
    error?: string
}

/** Lifecycle of the server-issued session as the step drives it. */
type SessionPhase = 'creating' | 'running' | 'completing' | 'error'

export default function PuzzleStep({
    mfaSessionToken,
    verifyStep,
    loading,
    error,
}: PuzzleStepProps) {
    const { t } = useTranslation()
    const { createSession, submitChallenge } = usePuzzleSessionClient()

    const [phase, setPhase] = useState<SessionPhase>('creating')
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [challenges, setChallenges] = useState<IssuedChallenge[]>([])
    const [currentIndex, setCurrentIndex] = useState(0)
    const [challengeError, setChallengeError] = useState<string | null>(null)
    /** Guards a double CREATE under React 18 StrictMode double-invoke. */
    const createdRef = useRef(false)
    /** Guards a double verdict submit once all challenges complete. */
    const submittedRef = useRef(false)

    // ── 1. CREATE the server-issued session on mount ──────────────────────
    useEffect(() => {
        if (createdRef.current) return
        createdRef.current = true
        let cancelled = false
        ;(async () => {
            try {
                const result = await createSession(mfaSessionToken)
                if (cancelled) return
                if (!result.challenges.length) {
                    setPhase('error')
                    setChallengeError(t('mfa.puzzle.noChallenges'))
                    return
                }
                setSessionId(result.session_id)
                setChallenges(result.challenges)
                setPhase('running')
            } catch {
                if (cancelled) return
                setPhase('error')
                setChallengeError(t('mfa.puzzle.sessionError'))
            }
        })()
        return () => {
            cancelled = true
        }
    }, [createSession, mfaSessionToken, t])

    const total = challenges.length
    const issued = challenges[currentIndex] ?? null
    const puzzleId: BiometricPuzzleId | null = issued
        ? serverActionToPuzzleId(issued.action)
        : null
    const entry = puzzleId ? getBiometricPuzzle(puzzleId) : null
    const ChallengeComponent = entry?.component ?? null

    // ── 3. Submit the auth gate once every challenge is server-validated ───
    const submitVerdict = useCallback(() => {
        if (submittedRef.current || !sessionId) return
        submittedRef.current = true
        setPhase('completing')
        // The ONLY thing submitted as the step verdict: the opaque session id.
        // No metrics, no verdicts — bio is the authority (owner-bound, single-use).
        verifyStep(AuthMethodType.PUZZLE, { puzzle_session_id: sessionId })
    }, [sessionId, verifyStep])

    // ── 2. Per-challenge completion → SUBMIT canonical metric to the session ─
    const handleSuccess = useCallback(
        (verdict?: PuzzleServerVerdict) => {
            setChallengeError(null)
            if (!sessionId || !issued) return

            const action = issued.action
            const metricKey = metricKeyForAction(action)
            const metricValue =
                metricKey != null ? verdict?.metrics?.[metricKey] : undefined

            // The web component could not produce bio's canonical metric for this
            // action (vocabulary/metric gap) — fail closed rather than submit an
            // empty payload bio would reject as METRIC_REQUIRED.
            if (metricKey == null || metricValue == null) {
                setPhase('error')
                setChallengeError(t('mfa.puzzle.challengeFailed'))
                return
            }

            const now = performance.now()
            submitChallenge(mfaSessionToken, sessionId, {
                action,
                metrics: { [metricKey]: metricValue },
                startTimestampMs: verdict?.startTimestampMs ?? now - 1,
                endTimestampMs: verdict?.endTimestampMs ?? now,
                confidence: verdict?.confidence ?? 0.9,
            })
                .then((res) => {
                    // Server-authoritative: only advance on a true per-challenge
                    // verdict. A false verdict is fail-closed (no soft-pass).
                    if (!res.verified) {
                        setPhase('error')
                        setChallengeError(t('mfa.puzzle.challengeFailed'))
                        return
                    }
                    const nextIndex = currentIndex + 1
                    if (nextIndex >= total) {
                        submitVerdict()
                    } else {
                        setCurrentIndex(nextIndex)
                    }
                })
                .catch(() => {
                    setPhase('error')
                    setChallengeError(t('mfa.puzzle.challengeFailed'))
                })
        },
        [
            sessionId,
            issued,
            mfaSessionToken,
            submitChallenge,
            currentIndex,
            total,
            submitVerdict,
            t,
        ],
    )

    const handleError = useCallback((message: string) => {
        setChallengeError(message)
    }, [])

    const handleClose = useCallback(() => {
        // No-op: cannot close mid-auth.
    }, [])

    const handleRetry = useCallback(() => {
        setChallengeError(null)
    }, [])

    const aggregatedError = error ?? challengeError

    // ── Render ────────────────────────────────────────────────────────────

    // CREATE in flight.
    if (phase === 'creating') {
        return (
            <StepLayout
                title={t('mfa.puzzle.title')}
                subtitle={t('mfa.puzzle.subtitle')}
            >
                <Box sx={{ textAlign: 'center', py: 3 }}>
                    <CircularProgress size={28} />
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 1.5 }}
                    >
                        {t('mfa.puzzle.preparing')}
                    </Typography>
                </Box>
            </StepLayout>
        )
    }

    // Hard error (session create failed, unrenderable/un-metric'd action, or a
    // failed per-challenge submit) — fail-closed, offer a retry that re-mounts.
    if (phase === 'error' || (phase === 'running' && !ChallengeComponent)) {
        const message =
            phase === 'running' && !ChallengeComponent
                ? t('mfa.puzzle.unsupportedChallenge')
                : (aggregatedError ?? t('mfa.puzzle.sessionError'))
        return (
            <StepLayout
                title={t('mfa.puzzle.title')}
                subtitle={t('mfa.puzzle.subtitle')}
            >
                <Alert severity="error" sx={{ borderRadius: '12px', mt: 1 }}>
                    {message}
                </Alert>
            </StepLayout>
        )
    }

    return (
        <StepLayout
            title={t('mfa.puzzle.title')}
            subtitle={t('mfa.puzzle.subtitle')}
            error={aggregatedError ?? undefined}
        >
            {/* Progress indicator */}
            <Box sx={{ textAlign: 'center', mb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                    {t('mfa.puzzle.challengeProgress', {
                        current: currentIndex + 1,
                        total,
                    })}
                </Typography>
            </Box>

            {/* Active server-issued challenge. serverMode='auth' keeps the
                per-challenge UX fail-closed semantics. */}
            {ChallengeComponent && phase === 'running' && (
                <ChallengeComponent
                    key={currentIndex}
                    onSuccess={handleSuccess}
                    onError={handleError}
                    onClose={handleClose}
                    serverMode="auth"
                />
            )}

            {/* Submitting the auth gate. */}
            {phase === 'completing' && (
                <Box sx={{ textAlign: 'center', py: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                        {t('mfa.puzzle.completing')}
                    </Typography>
                </Box>
            )}

            {/* Retry on a recoverable challenge error. */}
            {challengeError && phase === 'running' && (
                <Box sx={{ mt: 2 }}>
                    <Button
                        variant="outlined"
                        fullWidth
                        size="large"
                        startIcon={<Replay />}
                        onClick={handleRetry}
                        disabled={loading}
                        sx={{ py: 1.5, borderRadius: '12px', fontWeight: 600 }}
                    >
                        {t('mfa.puzzle.retry')}
                    </Button>
                </Box>
            )}
        </StepLayout>
    )
}
