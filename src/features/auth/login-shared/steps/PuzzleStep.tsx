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
 * Identity-binding (alsoMatchFaceIdentity, SP-B Phase 5) — DOUBLE-gated by the
 * tenant config `puzzleConfig.alsoMatchFaceIdentity` AND SP-A's build flag
 * `isClientSideEmbeddingEnabled()` (`app.auth.client-side-embedding`). When BOTH
 * are on, the step threads an `onBestFrame` into the live FacePuzzle; on the
 * captured (image, landmarks) it reuses SP-A's `embedCapturedFace` to derive a
 * 512-float vector from the SAME live-session frame (identity + liveness from one
 * capture — spec §3.1) and submits `verifyStep(PUZZLE, { puzzle_session_id,
 * embedding })`. The RAW image never enters the payload — only the vector. If
 * binding is required but no embedding could be produced, the step FAILS CLOSED
 * (no submit); the server also fail-closes. Binding OFF / flag OFF = liveness-only
 * (`{ puzzle_session_id }`), byte-identical to CV-3.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import type { PuzzleConfig } from '@domain/models/AuthMethod'
import type { NormalizedLandmark } from '@/lib/biometric-engine/types'
import { isClientSideEmbeddingEnabled } from '@features/biometrics/embedding/clientEmbeddingFlag'
import { embedCapturedFace } from '@features/biometrics/embedding/embedCapturedFace'
import { isClientPadAdvisoryEnabled } from '@features/biometrics/pad/clientPadFlag'
import { computeClientPadScore } from '@features/biometrics/pad/computeClientPadScore'
import StepLayout from '../../components/steps/StepLayout'

export interface PuzzleStepProps {
    /** In-progress MFA session token — authorizes the puzzle-session proxy. */
    mfaSessionToken: string
    verifyStep: (methodType: string, data: Record<string, unknown>) => void
    loading: boolean
    error?: string
    /**
     * Tenant-authored PUZZLE layer config. The challenge LIST is server-issued
     * (CV-3), so only `alsoMatchFaceIdentity` is read here — to decide whether to
     * bind identity (embedding) to the liveness session. Absent → liveness-only.
     */
    puzzleConfig?: PuzzleConfig
}

/** Lifecycle of the server-issued session as the step drives it. */
type SessionPhase = 'creating' | 'running' | 'completing' | 'error'

export default function PuzzleStep({
    mfaSessionToken,
    verifyStep,
    loading,
    error,
    puzzleConfig,
}: PuzzleStepProps) {
    const { t } = useTranslation()
    const { createSession, submitChallenge } = usePuzzleSessionClient()

    // ── Identity-binding double-gate ──────────────────────────────────────
    // Bind identity only when the tenant turned it ON AND SP-A's client-side
    // embedding build flag is ON. Either off → liveness-only (CV-3 unchanged).
    const bindingEnabled = useMemo(
        () =>
            puzzleConfig?.alsoMatchFaceIdentity === true &&
            isClientSideEmbeddingEnabled(),
        [puzzleConfig],
    )

    const [phase, setPhase] = useState<SessionPhase>('creating')
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [challenges, setChallenges] = useState<IssuedChallenge[]>([])
    const [currentIndex, setCurrentIndex] = useState(0)
    const [challengeError, setChallengeError] = useState<string | null>(null)
    /** Guards a double CREATE under React 18 StrictMode double-invoke. */
    const createdRef = useRef(false)
    /** Guards a double verdict submit once all challenges complete. */
    const submittedRef = useRef(false)
    /**
     * Latest identity embedding (number[512]) derived from the live FacePuzzle's
     * best frontal frame, when binding is on. Held in a ref so it survives across
     * challenges (a frontal capture in ANY challenge feeds the final verdict) and
     * is read synchronously at verdict time. The RAW image is intentionally NOT
     * retained — only the computed vector.
     */
    const embeddingRef = useRef<number[] | null>(null)
    /**
     * Latest ADVISORY client-side PAD / passive-liveness confidence (0..1) from
     * the live best frame (SP-D, flag-gated, defense-in-depth). UNTRUSTED-CLIENT
     * CAVEAT: advisory ONLY — never gates the verdict; forwarded to the
     * authoritative server as `client_pad_score`. null when off / unavailable.
     */
    const padScoreRef = useRef<number | null>(null)

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

    // ── Phase 5: derive the identity embedding from the live best frame ───
    // Reuses SP-A's `embedCapturedFace` (align → preprocess → embed → number[512]
    // | null). Only wired when binding is on. The raw image is consumed here and
    // never stored — only the resulting vector is kept.
    const handleBestFrame = useCallback(
        (image: string, landmarks: NormalizedLandmark[]) => {
            // ADVISORY PAD score (SP-D, flag-gated, defense-in-depth). Computed
            // from the best frame independently of binding so the server gets a
            // passive-liveness signal even on the liveness-only path. Resilient +
            // advisory ONLY: a failure just leaves padScoreRef null; it NEVER
            // blocks or changes the verdict.
            if (isClientPadAdvisoryEnabled()) {
                computeClientPadScore(image)
                    .then((pad) => {
                        if (pad) padScoreRef.current = pad.score
                    })
                    .catch(() => {
                        // Non-critical: no advisory score forwarded.
                    })
            }
            if (!bindingEnabled) return
            embedCapturedFace(image, landmarks)
                .then((vec) => {
                    if (vec) embeddingRef.current = vec
                })
                .catch(() => {
                    // Resilient: a failed embed leaves embeddingRef null → the
                    // verdict path fails closed rather than submitting without it.
                })
        },
        [bindingEnabled],
    )

    // ── 3. Submit the auth gate once every challenge is server-validated ───
    const submitVerdict = useCallback(() => {
        if (submittedRef.current || !sessionId) return

        // ADVISORY ONLY (SP-D): include the client PAD score when one was
        // computed. Optional, ignored-safe sibling field — the client never gates
        // on it; the server treats it as a defense-in-depth signal, not a verdict.
        const advisory =
            padScoreRef.current !== null
                ? { client_pad_score: padScoreRef.current }
                : {}

        if (bindingEnabled) {
            // Identity-binding REQUIRED: a binding step must carry the live-frame
            // embedding. No vector (never frontal / capture or embed failed) →
            // FAIL CLOSED: do NOT submit a binding step without identity evidence
            // (the server also fail-closes). Surface an error, no verdict.
            const embedding = embeddingRef.current
            if (!embedding) {
                setPhase('error')
                setChallengeError(t('mfa.puzzle.identityCaptureFailed'))
                return
            }
            submittedRef.current = true
            setPhase('completing')
            // Opaque session id (liveness authority) + the 512-d identity vector.
            // NEVER the raw image — only the derived embedding leaves the device.
            verifyStep(AuthMethodType.PUZZLE, {
                puzzle_session_id: sessionId,
                embedding,
                ...advisory,
            })
            return
        }

        submittedRef.current = true
        setPhase('completing')
        // Liveness-only: the ONLY thing submitted is the opaque session id (plus
        // the optional advisory PAD score). No metrics, no verdicts — bio is the
        // authority (owner-bound, single-use).
        verifyStep(AuthMethodType.PUZZLE, { puzzle_session_id: sessionId, ...advisory })
    }, [sessionId, verifyStep, bindingEnabled, t])

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
                    // Identity-binding: thread the best-frame hook ONLY when the
                    // double-gate is on. Off → undefined → no capture (FacePuzzle
                    // is byte-identical, hand puzzles ignore it).
                    onBestFrame={bindingEnabled ? handleBestFrame : undefined}
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
