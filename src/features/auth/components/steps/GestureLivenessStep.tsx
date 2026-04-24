import { useCallback, useEffect, useRef, useState } from 'react'
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    LinearProgress,
    Typography,
} from '@mui/material'
import {
    PanTool,
    Replay,
    ArrowForward,
    VideocamOff,
    CameraAlt,
} from '@mui/icons-material'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import { formatApiError } from '@utils/formatApiError'
import { useHandGestureDetection } from '../../../../lib/biometric-engine/hooks/useHandGestureDetection'
import type {
    GestureChallengeType,
    HandLandmark,
} from '../../../../lib/biometric-engine/core/HandGestureDetector'
import StepLayout from './StepLayout'
import { stepItemVariants as itemVariants } from './stepMotion'

/**
 * GestureLivenessStep — Active liveness via hand-gesture challenges.
 *
 * Contract (mirrors biometric-processor PR #50):
 *   - `POST /api/v1/liveness/active/gesture/start` opens a session and
 *     returns one or more challenges. `SHAPE_TRACE` / `TRACE_TEMPLATE`
 *     challenges include an SVG path that the user is asked to follow.
 *   - `POST /api/v1/liveness/active/gesture/frame` is called per detected
 *     frame with 21 MediaPipe landmarks (x, y, z) and anti-spoof telemetry.
 *     The server re-verifies geometry; client verdicts are advisory.
 *   - On success the server returns `{ status: 'PASSED', proof }`. The
 *     proof is forwarded to `/auth/mfa/step` via `onSubmit({ sessionId,
 *     proof })`.
 *
 * No raw frames leave the device.
 */

interface GestureChallenge {
    challengeId: string
    type: GestureChallengeType
    promptKey?: string
    /** SVG path (d attribute) used for SHAPE_TRACE / TRACE_TEMPLATE challenges. */
    tracePath?: string
    /** Optional prompt parameter, e.g. "show 3 fingers" → { count: 3 } */
    params?: Record<string, unknown>
}

interface GestureStartResponse {
    sessionId: string
    challenge: GestureChallenge
    totalChallenges?: number
    currentIndex?: number
    timeoutMs?: number
}

interface GestureFrameResponse {
    status: 'IN_PROGRESS' | 'CHALLENGE_PASSED' | 'PASSED' | 'FAILED'
    progress?: number
    nextChallenge?: GestureChallenge
    currentIndex?: number
    totalChallenges?: number
    proof?: string
    reason?: string
}

interface GestureLivenessStepProps {
    onSubmit: (data: { sessionId: string; proof: string }) => void
    loading: boolean
    error?: string
}

/**
 * i18n key for the prompt shown for each challenge type. Each key resolves
 * to `{ title, hint, success, failure }` in the liveness.gesture subtree.
 */
const CHALLENGE_KEY: Record<GestureChallengeType, string> = {
    FINGER_COUNT: 'liveness.gesture.fingerCount',
    SHAPE_TRACE: 'liveness.gesture.shapeTrace',
    WAVE: 'liveness.gesture.wave',
    HAND_FLIP: 'liveness.gesture.handFlip',
    FINGER_TAP: 'liveness.gesture.fingerTap',
    PINCH: 'liveness.gesture.pinch',
    PEEK_A_BOO: 'liveness.gesture.peekABoo',
    MATH: 'liveness.gesture.math',
    TRACE_TEMPLATE: 'liveness.gesture.traceTemplate',
}

const ACTIVE_LIVENESS_BASE = '/liveness/active/gesture'
const MIN_FRAME_INTERVAL_MS = 120 // ≈ 8 fps of network traffic

export default function GestureLivenessStep({
    onSubmit,
    loading,
    error,
}: GestureLivenessStepProps) {
    const { t } = useTranslation()
    const httpClient = useService<IHttpClient>(TYPES.HttpClient)
    const videoRef = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)

    const [cameraActive, setCameraActive] = useState(false)
    const [videoReady, setVideoReady] = useState(false)
    const [cameraError, setCameraError] = useState<string | null>(null)

    const [sessionId, setSessionId] = useState<string | null>(null)
    const [challenge, setChallenge] = useState<GestureChallenge | null>(null)
    const [challengeIndex, setChallengeIndex] = useState(0)
    const [totalChallenges, setTotalChallenges] = useState(1)
    const [progress, setProgress] = useState(0)
    const [starting, setStarting] = useState(false)
    const [startError, setStartError] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [finished, setFinished] = useState(false)

    const detectionActive = cameraActive && !!challenge && !finished
    const detection = useHandGestureDetection(
        videoRef,
        detectionActive,
        challenge?.type ?? null,
    )

    // ─── Camera lifecycle ─────────────────────────────────────────
    const startCamera = useCallback(async () => {
        try {
            setCameraError(null)
            setVideoReady(false)
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                },
            })
            streamRef.current = stream
            setCameraActive(true)
        } catch {
            setCameraError(t('liveness.gesture.cameraError'))
        }
    }, [t])

    const stopCamera = useCallback(() => {
        if (videoRef.current) videoRef.current.srcObject = null
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((tr) => tr.stop())
            streamRef.current = null
        }
        setCameraActive(false)
        setVideoReady(false)
    }, [])

    const videoCallbackRef = useCallback((node: HTMLVideoElement | null) => {
        (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = node
        if (node && streamRef.current) {
            node.srcObject = streamRef.current
            node.onloadeddata = () => setVideoReady(true)
            node.play().catch(() => {
                // autoplay blocked; retry on user gesture
            })
        }
    }, [])

    // Auto-start camera on mount.
    useEffect(() => {
        startCamera()
        return () => {
            stopCamera()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ─── Start gesture session when camera is ready ──────────────
    const startSession = useCallback(async () => {
        setStartError(null)
        setStarting(true)
        try {
            const res = await httpClient.post<GestureStartResponse>(
                `${ACTIVE_LIVENESS_BASE}/start`,
                {},
            )
            setSessionId(res.data.sessionId)
            setChallenge(res.data.challenge)
            setTotalChallenges(res.data.totalChallenges ?? 1)
            setChallengeIndex(res.data.currentIndex ?? 0)
            setProgress(0)
        } catch (err) {
            setStartError(formatApiError(err, t))
        } finally {
            setStarting(false)
        }
    }, [httpClient, t])

    useEffect(() => {
        if (!videoReady || sessionId || starting || finished) return
        startSession()
    }, [videoReady, sessionId, starting, finished, startSession])

    // ─── Per-frame POST of landmarks (not raw frames) ────────────
    const inFlightRef = useRef(false)
    const lastFrameSentRef = useRef(0)

    useEffect(() => {
        if (!sessionId || !challenge || finished) return
        if (!detection.detected || !detection.landmarks) return

        const now = performance.now()
        if (now - lastFrameSentRef.current < MIN_FRAME_INTERVAL_MS) return
        if (inFlightRef.current) return

        inFlightRef.current = true
        lastFrameSentRef.current = now

        const payload = {
            sessionId,
            challengeId: challenge.challengeId,
            landmarks: detection.landmarks,
            antiSpoof: detection.antiSpoof,
            clientTimestamp: Date.now(),
        }

        httpClient
            .post<GestureFrameResponse>(`${ACTIVE_LIVENESS_BASE}/frame`, payload)
            .then((res) => {
                const data = res.data
                if (typeof data.progress === 'number') {
                    setProgress(Math.max(0, Math.min(1, data.progress)))
                }
                if (data.status === 'CHALLENGE_PASSED' && data.nextChallenge) {
                    setChallenge(data.nextChallenge)
                    if (typeof data.currentIndex === 'number') {
                        setChallengeIndex(data.currentIndex)
                    }
                    if (typeof data.totalChallenges === 'number') {
                        setTotalChallenges(data.totalChallenges)
                    }
                    setProgress(0)
                } else if (data.status === 'PASSED' && data.proof) {
                    setFinished(true)
                    stopCamera()
                    setSubmitting(true)
                    onSubmit({ sessionId, proof: data.proof })
                } else if (data.status === 'FAILED') {
                    setFinished(true)
                    stopCamera()
                    setStartError(
                        data.reason
                            ? t('liveness.gesture.failureReason', { reason: data.reason })
                            : t('liveness.gesture.failure'),
                    )
                }
            })
            .catch((err) => {
                // A single-frame network failure is not fatal; keep streaming.
                console.warn('[GestureLivenessStep] frame post failed', err)
                if ((err as { response?: { status?: number } })?.response?.status === 429) {
                    setStartError(t('errors.rateLimitExceeded'))
                }
            })
            .finally(() => {
                inFlightRef.current = false
            })
    }, [
        sessionId,
        challenge,
        finished,
        detection.detected,
        detection.landmarks,
        detection.antiSpoof,
        httpClient,
        onSubmit,
        stopCamera,
        t,
    ])

    // ─── Retry flow ──────────────────────────────────────────────
    const handleRetry = useCallback(() => {
        setSessionId(null)
        setChallenge(null)
        setProgress(0)
        setChallengeIndex(0)
        setTotalChallenges(1)
        setStartError(null)
        setFinished(false)
        setSubmitting(false)
        if (!cameraActive) startCamera()
    }, [cameraActive, startCamera])

    // ─── Derived prompt strings ──────────────────────────────────
    const challengeKey = challenge ? CHALLENGE_KEY[challenge.type] : null
    const challengeTitle = challengeKey
        ? t(`${challengeKey}.title`, challenge?.params as Record<string, unknown>)
        : ''
    const challengeHint = challengeKey
        ? t(`${challengeKey}.hint`, challenge?.params as Record<string, unknown>)
        : ''

    const aggregatedError = error || startError || cameraError
    const showTrace =
        challenge?.tracePath &&
        (challenge.type === 'SHAPE_TRACE' || challenge.type === 'TRACE_TEMPLATE')

    return (
        <StepLayout
            title={t('liveness.gesture.title')}
            subtitle={t('liveness.gesture.subtitle')}
            icon={<PanTool sx={{ fontSize: 28, color: 'white' }} />}
            iconGradient="linear-gradient(135deg, #0ea5e9 0%, #22d3ee 100%)"
            iconShadow="0 8px 32px rgba(14, 165, 233, 0.3)"
        >
            {aggregatedError && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    <Alert
                        severity="error"
                        role="alert"
                        aria-live="polite"
                        sx={{ mb: 2, borderRadius: '12px' }}
                    >
                        <Typography variant="body2" fontWeight={600}>
                            {aggregatedError}
                        </Typography>
                    </Alert>
                </motion.div>
            )}

            {/* Camera preview + landmark / trace overlay */}
            <motion.div variants={itemVariants} style={{ overflowX: 'hidden' }}>
                <Box
                    sx={{
                        maxWidth: '100%',
                        width: 360,
                        mx: 'auto',
                        mb: 1,
                        borderRadius: '16px',
                        overflow: 'hidden',
                        border: '2px solid',
                        borderColor: cameraActive
                            ? detection.detected
                                ? 'success.main'
                                : 'primary.main'
                            : 'divider',
                        position: 'relative',
                        aspectRatio: '4/3',
                        bgcolor: '#0f172a',
                    }}
                >
                    {cameraActive ? (
                        <>
                            <video
                                ref={videoCallbackRef}
                                autoPlay
                                playsInline
                                muted
                                aria-label={t('liveness.gesture.videoAriaLabel')}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    transform: 'scaleX(-1)',
                                }}
                            />

                            {/* Shape-trace overlay — drawn in normalized coords via viewBox */}
                            {showTrace && (
                                <Box
                                    component="svg"
                                    viewBox="0 0 1 1"
                                    preserveAspectRatio="none"
                                    aria-hidden="true"
                                    sx={{
                                        position: 'absolute',
                                        inset: 0,
                                        width: '100%',
                                        height: '100%',
                                        pointerEvents: 'none',
                                    }}
                                >
                                    <path
                                        d={challenge?.tracePath}
                                        fill="none"
                                        stroke="rgba(34, 211, 238, 0.9)"
                                        strokeWidth={0.01}
                                        strokeLinecap="round"
                                        strokeDasharray="0.02 0.015"
                                    />
                                </Box>
                            )}

                            {/* Landmark overlay */}
                            {detection.landmarks && (
                                <Box
                                    component="svg"
                                    viewBox="0 0 1 1"
                                    preserveAspectRatio="none"
                                    aria-hidden="true"
                                    sx={{
                                        position: 'absolute',
                                        inset: 0,
                                        width: '100%',
                                        height: '100%',
                                        pointerEvents: 'none',
                                        transform: 'scaleX(-1)',
                                    }}
                                >
                                    {detection.landmarks.map((lm: HandLandmark, idx: number) => (
                                        <circle
                                            key={idx}
                                            cx={lm.x}
                                            cy={lm.y}
                                            r={0.008}
                                            fill={
                                                detection.confidence >= 0.75
                                                    ? 'rgba(34, 197, 94, 0.9)'
                                                    : 'rgba(250, 204, 21, 0.9)'
                                            }
                                        />
                                    ))}
                                </Box>
                            )}
                        </>
                    ) : (
                        <Box
                            sx={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexDirection: 'column',
                                color: 'rgba(255,255,255,0.6)',
                            }}
                        >
                            <VideocamOff sx={{ fontSize: 48, mb: 1 }} />
                            <Typography variant="body2" sx={{ color: 'inherit' }}>
                                {t('liveness.gesture.cameraOff')}
                            </Typography>
                        </Box>
                    )}
                </Box>
            </motion.div>

            {/* Challenge prompt + progress */}
            {challenge && !finished && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    <Box sx={{ textAlign: 'center', mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight={600}>
                            {challengeTitle}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {t(detection.hint)}
                        </Typography>
                        <Box sx={{ mt: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                                {challengeHint}
                            </Typography>
                        </Box>
                        <Box sx={{ mt: 1.5 }}>
                            <LinearProgress
                                variant="determinate"
                                value={Math.round(progress * 100)}
                                sx={{ height: 6, borderRadius: 3 }}
                                aria-label={t('liveness.gesture.progressAria')}
                            />
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: 'block', mt: 0.5 }}
                            >
                                {t('liveness.gesture.step', {
                                    current: challengeIndex + 1,
                                    total: totalChallenges,
                                })}
                            </Typography>
                        </Box>
                    </Box>
                </motion.div>
            )}

            {/* Detector status chips */}
            {cameraActive && !finished && (
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mb: 2, flexWrap: 'wrap' }}>
                    <Chip
                        size="small"
                        label={
                            detection.detected
                                ? t('liveness.gesture.status.handDetected')
                                : t('liveness.gesture.status.noHand')
                        }
                        color={detection.detected ? 'success' : 'default'}
                        variant="outlined"
                    />
                    {detection.initialized && (
                        <Chip
                            size="small"
                            label={t('liveness.gesture.status.fps', {
                                fps: Math.round(detection.fps),
                            })}
                            variant="outlined"
                        />
                    )}
                    {detection.initFailed && (
                        <Chip
                            size="small"
                            color="warning"
                            label={t('liveness.gesture.status.detectorUnavailable')}
                            variant="outlined"
                        />
                    )}
                </Box>
            )}

            {/* Actions */}
            <motion.div variants={itemVariants}>
                {!cameraActive && !finished && (
                    <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        onClick={startCamera}
                        disabled={loading || starting}
                        startIcon={<CameraAlt />}
                        sx={{
                            py: 1.5,
                            borderRadius: '12px',
                            fontWeight: 600,
                            background: 'linear-gradient(135deg, #0ea5e9 0%, #22d3ee 100%)',
                        }}
                    >
                        {t('liveness.gesture.startCamera')}
                    </Button>
                )}

                {(aggregatedError || finished) && (
                    <Box sx={{ display: 'flex', gap: 2, mt: aggregatedError ? 1 : 0 }}>
                        <Button
                            variant="outlined"
                            size="large"
                            onClick={handleRetry}
                            disabled={loading || submitting}
                            startIcon={<Replay />}
                            sx={{ flex: 1, py: 1.5, borderRadius: '12px', fontWeight: 600 }}
                        >
                            {t('liveness.gesture.retry')}
                        </Button>
                        {finished && !aggregatedError && (
                            <Button
                                variant="contained"
                                size="large"
                                disabled
                                endIcon={!loading && !submitting && <ArrowForward />}
                                sx={{ flex: 1, py: 1.5, borderRadius: '12px', fontWeight: 600 }}
                            >
                                {loading || submitting ? (
                                    <CircularProgress size={24} sx={{ color: 'white' }} />
                                ) : (
                                    t('liveness.gesture.success')
                                )}
                            </Button>
                        )}
                    </Box>
                )}

                {starting && !aggregatedError && (
                    <Box sx={{ textAlign: 'center', mt: 1 }}>
                        <CircularProgress size={20} />
                        <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                            {t('liveness.gesture.starting')}
                        </Typography>
                    </Box>
                )}
            </motion.div>
        </StepLayout>
    )
}
