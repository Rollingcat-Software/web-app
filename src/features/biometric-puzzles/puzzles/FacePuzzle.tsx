/**
 * FacePuzzle (biometric-puzzles)
 *
 * Per-challenge active liveness puzzle. Pinned to a single
 * `ChallengeType` and reports `onSuccess` only when the engine's
 * `BiometricPuzzle.checkChallenge()` confirms the gesture has been
 * held for `HOLD_DURATION` seconds.
 *
 * Bug history (2026-04-25): the previous implementation wrapped
 * `FaceCaptureStep` and called `onSuccess` after a fixed 500ms
 * timeout — every challenge "always succeeded" because no detection
 * was actually pinned to a challenge type. This rewrite drives the
 * real `BiometricPuzzle` engine with `challengeTypes=[challengeType]`
 * and a single-challenge session, so the user must perform the
 * specific gesture (blink, smile, look up, ...) for the puzzle to
 * pass.
 *
 * Detection runs entirely client-side via the shared MediaPipe
 * FaceLandmarker (CDN, ~5MB WASM) — no server round-trips. This
 * matches the D1-D4 ML split rule.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    Alert,
    Box,
    Button,
    LinearProgress,
    Stack,
    Typography,
} from '@mui/material'
import { CameraAlt } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import { useBiometricEngine } from '@/lib/biometric-engine/hooks/useBiometricEngine'
import {
    BiometricPuzzle as BiometricPuzzleEngine,
} from '@/lib/biometric-engine/core/BiometricPuzzle'
import { ChallengeType } from '@/lib/biometric-engine/types'
import type { BiometricPuzzleProps } from '../biometricPuzzleRegistry'

interface Props extends BiometricPuzzleProps {
    challengeType: ChallengeType
    /** i18n key root (e.g. `biometricPuzzle.puzzles.face_blink`). */
    i18nKey: string
}

/**
 * Hard timeout for any single puzzle attempt. The engine itself has no
 * deadline; we add one so users don't get stuck forever if the gesture
 * is impossible (e.g. asymmetric brow raises).
 */
const ATTEMPT_TIMEOUT_MS = 30_000

function FacePuzzle({ onSuccess, onError, challengeType, i18nKey }: Props) {
    const { t } = useTranslation()
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const animFrameRef = useRef<number>(0)
    const startTsRef = useRef<number>(0)
    const completedRef = useRef<boolean>(false)

    // Independent puzzle instance pinned to this challenge type. Sharing the
    // engine's metricsCalculator keeps internal state (eyebrow baseline) in
    // sync with the global biometric pipeline.
    const { engine, isReady, isLoading, error: engineError } = useBiometricEngine()
    const puzzleEngineRef = useRef<BiometricPuzzleEngine | null>(null)

    const [cameraActive, setCameraActive] = useState(false)
    const [videoReady, setVideoReady] = useState(false)
    const [cameraError, setCameraError] = useState<string | null>(null)
    const [progress, setProgress] = useState(0)
    const [detected, setDetected] = useState(false)
    const [running, setRunning] = useState(false)

    // Build the per-challenge puzzle instance once the engine is ready.
    useEffect(() => {
        if (!engine) return
        const p = new BiometricPuzzleEngine(engine.metricsCalculator, 1)
        p.registerAllDefaults()
        puzzleEngineRef.current = p
        return () => {
            puzzleEngineRef.current = null
        }
    }, [engine])

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
            setCameraError(t('mfa.face.cameraError'))
        }
    }, [t])

    const stopCamera = useCallback(() => {
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current)
            animFrameRef.current = 0
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop())
            streamRef.current = null
        }
        setCameraActive(false)
        setVideoReady(false)
        setRunning(false)
    }, [])

    // Stop camera on unmount.
    useEffect(() => () => stopCamera(), [stopCamera])

    const videoCallbackRef = useCallback((node: HTMLVideoElement | null) => {
        videoRef.current = node
        if (node && streamRef.current) {
            node.srcObject = streamRef.current
            node.onloadeddata = () => setVideoReady(true)
            node.play().catch(() => {
                /* autoplay may be deferred; user gesture already happened */
            })
        }
    }, [])

    // Detection loop: drive engine.frameProcessor.processFrame(video) and
    // feed the resulting landmarks + headPose into our pinned puzzle.
    useEffect(() => {
        if (!engine || !isReady) return
        if (!cameraActive || !videoReady) return
        const puzzle = puzzleEngineRef.current
        if (!puzzle) return

        // Start a fresh single-challenge session.
        puzzle.start([challengeType], 1)
        startTsRef.current = performance.now()
        completedRef.current = false
        setRunning(true)
        setProgress(0)
        setDetected(false)

        const loop = () => {
            const video = videoRef.current
            if (!video || video.readyState < 2) {
                animFrameRef.current = requestAnimationFrame(loop)
                return
            }

            // Hard timeout safeguard.
            if (performance.now() - startTsRef.current > ATTEMPT_TIMEOUT_MS) {
                if (!completedRef.current) {
                    completedRef.current = true
                    setRunning(false)
                    onError(t('biometricPuzzle.timeoutMessage'))
                }
                return
            }

            try {
                const frame = engine.frameProcessor.processFrame(video)
                const face = frame.faces[0]
                if (face?.detection.landmarks478?.length && face.headPose) {
                    const result = puzzle.checkChallenge(
                        face.detection.landmarks478,
                        face.headPose.yaw,
                        face.headPose.pitch,
                    )
                    setDetected(result.detected)
                    setProgress(result.progress)
                    if (result.completed && !completedRef.current) {
                        completedRef.current = true
                        setRunning(false)
                        setProgress(100)
                        onSuccess()
                        return
                    }
                }
            } catch {
                // Skip frame on detection error.
            }

            animFrameRef.current = requestAnimationFrame(loop)
        }

        animFrameRef.current = requestAnimationFrame(loop)
        return () => {
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current)
                animFrameRef.current = 0
            }
        }
    }, [engine, isReady, cameraActive, videoReady, challengeType, onSuccess, onError, t])

    const challengeLabel = useMemo(() => t(`${i18nKey}.title`), [t, i18nKey])
    const challengeDescription = useMemo(() => t(`${i18nKey}.description`), [t, i18nKey])

    return (
        <Box sx={{ p: 3 }}>
            <Stack spacing={2} alignItems="center">
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {challengeLabel}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                    {challengeDescription}
                </Typography>

                {engineError && (
                    <Alert severity="error" sx={{ width: '100%' }}>
                        {engineError}
                    </Alert>
                )}
                {cameraError && (
                    <Alert severity="error" sx={{ width: '100%' }}>
                        {cameraError}
                    </Alert>
                )}

                {!cameraActive && (
                    <Button
                        variant="contained"
                        startIcon={<CameraAlt />}
                        onClick={startCamera}
                        disabled={isLoading || !isReady}
                    >
                        {isLoading
                            ? t('biometricPuzzle.engineLoading')
                            : t('biometricPuzzle.startCamera')}
                    </Button>
                )}

                {cameraActive && (
                    <Box
                        sx={{
                            position: 'relative',
                            width: '100%',
                            maxWidth: 480,
                            aspectRatio: '4 / 3',
                            backgroundColor: 'black',
                            borderRadius: 1,
                            overflow: 'hidden',
                        }}
                    >
                        <video
                            ref={videoCallbackRef}
                            autoPlay
                            playsInline
                            muted
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                transform: 'scaleX(-1)',
                            }}
                            aria-label={t('faceCapture.videoAriaLabel')}
                        />
                    </Box>
                )}

                {running && (
                    <Stack spacing={1} sx={{ width: '100%' }}>
                        <Typography variant="caption" color="text.secondary">
                            {detected
                                ? t('biometricPuzzle.holding')
                                : t('biometricPuzzle.waitingForGesture')}
                        </Typography>
                        <LinearProgress
                            variant="determinate"
                            value={progress}
                            sx={{ height: 8, borderRadius: 4 }}
                        />
                    </Stack>
                )}
            </Stack>
        </Box>
    )
}

/**
 * Build a `ComponentType<BiometricPuzzleProps>` with `challengeType` +
 * `i18nKey` pre-bound so the registry can hold one component per face
 * entry without leaking extra props through the runner modal.
 */
export function makeFacePuzzle(challengeType: ChallengeType, i18nKey: string) {
    const Bound: React.FC<BiometricPuzzleProps> = (p) => (
        <FacePuzzle {...p} challengeType={challengeType} i18nKey={i18nKey} />
    )
    Bound.displayName = `FacePuzzle(${challengeType})`
    return Bound
}

export default FacePuzzle
