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
 *
 * 2026-04-28 polish: camera frame gets a gradient ring + status
 * overlay + LED-style detection indicator; progress shows percentage
 * and a hold pulse. Detection logic untouched.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
    Alert,
    Box,
    Button,
    LinearProgress,
    Stack,
    Typography,
} from '@mui/material'
import { CameraAlt, FiberManualRecord } from '@mui/icons-material'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useBiometricEngine } from '@/lib/biometric-engine/hooks/useBiometricEngine'
import {
    BiometricPuzzle as BiometricPuzzleEngine,
} from '@/lib/biometric-engine/core/BiometricPuzzle'
import { ChallengeType } from '@/lib/biometric-engine/types'
import type { BiometricPuzzleProps } from '../biometricPuzzleRegistry'

// Lazily import DrawingUtils + FaceLandmarker statics from MediaPipe so the
// puzzle bundle can render the 468-point mesh + named contours over the
// camera feed (face oval, eye outlines, eyebrows, lips, iris).
type DrawingUtilsModule = typeof import('@mediapipe/tasks-vision')
let _vision: DrawingUtilsModule | null = null
async function loadVision(): Promise<DrawingUtilsModule> {
    if (_vision) return _vision
    _vision = await import('@mediapipe/tasks-vision')
    return _vision
}

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
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    // Lazy-loaded DrawingUtils instance + FaceLandmarker statics (connection groups).
    const drawingRef = useRef<{
        utils: InstanceType<DrawingUtilsModule['DrawingUtils']> | null
        FaceLandmarker: DrawingUtilsModule['FaceLandmarker'] | null
    }>({ utils: null, FaceLandmarker: null })
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

    // Lazy-load MediaPipe DrawingUtils + FaceLandmarker statics so we can
    // render the 468-pt mesh + named contours over the video feed.
    useEffect(() => {
        let cancelled = false
        loadVision().then((vision) => {
            if (cancelled) return
            const canvas = canvasRef.current
            if (!canvas) return
            const ctx = canvas.getContext('2d')
            if (!ctx) return
            drawingRef.current = {
                utils: new vision.DrawingUtils(ctx),
                FaceLandmarker: vision.FaceLandmarker,
            }
        }).catch(() => {
            /* DrawingUtils is decorative — silently degrade if it fails to load */
        })
        return () => { cancelled = true }
    }, [cameraActive])

    const clearOverlay = useCallback(() => {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    }, [])

    /**
     * Draw the 468-point face mesh on the overlay canvas using MediaPipe's
     * DrawingUtils. Mirrors the reference Python `draw_landmarks` palette:
     * tessellation in faint gray, face oval in cyan, eyes in green,
     * eyebrows in yellow, lips in orange, iris in pink. Hold-state flips
     * the oval to bright green so the user gets immediate feedback that
     * the gesture is registering.
     */
    const drawFaceLandmarks = useCallback((
        rawLandmarks: { x: number; y: number; z: number }[],
        isHolding: boolean,
    ) => {
        // DrawingUtils.drawConnectors only reads x/y/z; cast through unknown
        // to satisfy MediaPipe's NormalizedLandmark type which also wants
        // a `visibility` field our internal pipeline doesn't track.
        const landmarks = rawLandmarks as unknown as
            import('@mediapipe/tasks-vision').NormalizedLandmark[]
        const canvas = canvasRef.current
        const video = videoRef.current
        const { utils, FaceLandmarker } = drawingRef.current
        if (!canvas || !video || !utils || !FaceLandmarker) return
        // Match canvas internal pixel buffer to video natural size so DrawingUtils
        // (which scales by canvas.width/height) renders at the right resolution.
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth || 640
            canvas.height = video.videoHeight || 480
        }
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        const ovalColor = isHolding ? '#10b981' : '#67e8f9'

        utils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {
            color: 'rgba(255, 255, 255, 0.18)',
            lineWidth: 1,
        })
        utils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, {
            color: ovalColor,
            lineWidth: 2,
        })
        utils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, {
            color: '#34d399',
            lineWidth: 2,
        })
        utils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, {
            color: '#34d399',
            lineWidth: 2,
        })
        utils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, {
            color: '#facc15',
            lineWidth: 2,
        })
        utils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, {
            color: '#facc15',
            lineWidth: 2,
        })
        utils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS, {
            color: '#fb923c',
            lineWidth: 2,
        })
        utils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS, {
            color: '#f472b6',
            lineWidth: 2,
        })
        utils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS, {
            color: '#f472b6',
            lineWidth: 2,
        })
    }, [])

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
                    drawFaceLandmarks(face.detection.landmarks478, detected)
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
                } else {
                    clearOverlay()
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
    }, [engine, isReady, cameraActive, videoReady, challengeType, onSuccess, onError, t, drawFaceLandmarks, clearOverlay, detected])

    const hint = t(`${i18nKey}.hint`, { defaultValue: '' })

    return (
        <Box sx={{ p: 3 }}>
            <Stack spacing={2} alignItems="center">
                {hint && (
                    <Alert
                        severity="info"
                        variant="outlined"
                        sx={{ width: '100%', borderRadius: '12px', fontWeight: 500 }}
                    >
                        {hint}
                    </Alert>
                )}

                {engineError && (
                    <Alert severity="error" sx={{ width: '100%', borderRadius: '12px' }}>
                        {engineError}
                    </Alert>
                )}
                {cameraError && (
                    <Alert severity="error" sx={{ width: '100%', borderRadius: '12px' }}>
                        {cameraError}
                    </Alert>
                )}

                {!cameraActive && (
                    <Button
                        variant="contained"
                        size="large"
                        startIcon={<CameraAlt />}
                        onClick={startCamera}
                        disabled={isLoading || !isReady}
                        sx={{
                            textTransform: 'none',
                            borderRadius: '12px',
                            fontWeight: 600,
                            px: 4,
                            py: 1.25,
                            background:
                                'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.25)',
                            '&:hover': {
                                background:
                                    'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                filter: 'brightness(1.1)',
                            },
                        }}
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
                            borderRadius: '16px',
                            overflow: 'hidden',
                            background: detected
                                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                            p: '3px',
                            transition: 'background 0.3s ease',
                            boxShadow: detected
                                ? '0 8px 32px rgba(16, 185, 129, 0.4)'
                                : '0 8px 32px rgba(99, 102, 241, 0.25)',
                        }}
                    >
                        <Box
                            sx={{
                                position: 'relative',
                                width: '100%',
                                height: '100%',
                                borderRadius: '13px',
                                overflow: 'hidden',
                                backgroundColor: 'black',
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
                            <canvas
                                ref={canvasRef}
                                aria-hidden
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    width: '100%',
                                    height: '100%',
                                    pointerEvents: 'none',
                                    transform: 'scaleX(-1)',
                                }}
                            />
                            <Box
                                sx={{
                                    position: 'absolute',
                                    top: 12,
                                    left: 12,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.75,
                                    px: 1.25,
                                    py: 0.5,
                                    borderRadius: '999px',
                                    background: 'rgba(0, 0, 0, 0.55)',
                                    color: 'white',
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    letterSpacing: 0.5,
                                }}
                            >
                                <motion.div
                                    animate={{ opacity: [0.4, 1, 0.4] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                    style={{ display: 'flex' }}
                                >
                                    <FiberManualRecord
                                        sx={{
                                            fontSize: 10,
                                            color: detected ? '#10b981' : '#ef4444',
                                        }}
                                    />
                                </motion.div>
                                {detected
                                    ? t('biometricPuzzle.statusDetected')
                                    : t('biometricPuzzle.statusScanning')}
                            </Box>
                        </Box>
                    </Box>
                )}

                {running && (
                    <Stack spacing={1} sx={{ width: '100%' }}>
                        <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                        >
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {detected
                                    ? t('biometricPuzzle.holding')
                                    : t('biometricPuzzle.waitingForGesture')}
                            </Typography>
                            <Typography
                                variant="caption"
                                sx={{
                                    fontFamily:
                                        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                    fontWeight: 700,
                                    color: detected ? 'success.main' : 'text.secondary',
                                }}
                            >
                                {Math.round(progress)}%
                            </Typography>
                        </Stack>
                        <LinearProgress
                            variant="determinate"
                            value={progress}
                            aria-label={t('biometricPuzzle.progressAriaLabel')}
                            sx={{
                                height: 10,
                                borderRadius: 5,
                                backgroundColor: 'action.hover',
                                '& .MuiLinearProgress-bar': {
                                    borderRadius: 5,
                                    background: detected
                                        ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                                        : 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)',
                                },
                            }}
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
 *
 * `react-refresh/only-export-components` can't see that this returns a
 * component; the registry still works fine without HMR for these
 * dynamic factories.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function makeFacePuzzle(challengeType: ChallengeType, i18nKey: string) {
    const Bound: React.FC<BiometricPuzzleProps> = (p) => (
        <FacePuzzle {...p} challengeType={challengeType} i18nKey={i18nKey} />
    )
    Bound.displayName = `FacePuzzle(${challengeType})`
    return Bound
}

export default FacePuzzle
