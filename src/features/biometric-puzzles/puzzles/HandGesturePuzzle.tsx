/**
 * HandGesturePuzzle
 *
 * Real per-challenge hand-gesture detector for the 9 hand puzzles on
 * `app.fivucsas.com/biometric-puzzles`. Bug history: the previous
 * placeholder `HandGesturePlaceholderPuzzle` always succeeded after a
 * 2-second timer, regardless of what the user did. This component
 * uses the MediaPipe HandLandmarker (`@mediapipe/tasks-vision`) plus
 * per-puzzle detectors in `handChallenges.ts` to require the actual
 * gesture before reporting `onSuccess`.
 *
 * Detection runs entirely client-side — no server calls — to satisfy
 * the D1-D4 ML-split rule.
 *
 * 2026-04-28 polish: gradient ring camera frame, scanning LED chip,
 * monospace prompt panel for math / finger-count puzzles, refined
 * progress bar. Detection logic untouched.
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
import { CameraAlt, FiberManualRecord, Quiz } from '@mui/icons-material'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { BiometricPuzzleId } from '../BiometricPuzzleId'
import type { BiometricPuzzleProps } from '../biometricPuzzleRegistry'
import { useHandLandmarker } from './useHandLandmarker'
import {
    evaluateHandPuzzle,
    initialHandState,
    type HandFrame,
    type HandPuzzleState,
} from './handChallenges'

// Lazily import DrawingUtils + HandLandmarker statics so we can render the
// 21-point hand skeleton (HAND_CONNECTIONS) over the camera feed.
type DrawingUtilsModule = typeof import('@mediapipe/tasks-vision')
let _vision: DrawingUtilsModule | null = null
async function loadVision(): Promise<DrawingUtilsModule> {
    if (_vision) return _vision
    _vision = await import('@mediapipe/tasks-vision')
    return _vision
}

interface Props extends BiometricPuzzleProps {
    puzzleId: BiometricPuzzleId
    /** i18n key root (e.g. `biometricPuzzle.puzzles.hand_pinch`). */
    i18nKey: string
}

const ATTEMPT_TIMEOUT_MS = 45_000

const HAND_GRADIENT = 'linear-gradient(135deg, #ec4899 0%, #f97316 100%)'
const HAND_GLOW = '0 8px 24px rgba(236, 72, 153, 0.25)'

function HandGesturePuzzle({ onSuccess, onError, puzzleId, i18nKey }: Props) {
    const { t } = useTranslation()
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const drawingRef = useRef<{
        utils: InstanceType<DrawingUtilsModule['DrawingUtils']> | null
        HandLandmarker: DrawingUtilsModule['HandLandmarker'] | null
    }>({ utils: null, HandLandmarker: null })
    const streamRef = useRef<MediaStream | null>(null)
    const animFrameRef = useRef<number>(0)
    const startTsRef = useRef<number>(0)
    const completedRef = useRef<boolean>(false)
    const stateRef = useRef<HandPuzzleState>({})
    const holdRef = useRef<{ detectedSince: number | null }>({ detectedSince: null })

    const [cameraActive, setCameraActive] = useState(false)
    const [videoReady, setVideoReady] = useState(false)
    const [cameraError, setCameraError] = useState<string | null>(null)
    const [progress, setProgress] = useState(0)
    const [detected, setDetected] = useState(false)
    const [running, setRunning] = useState(false)
    const [promptText, setPromptText] = useState<string | null>(null)
    const [promptCode, setPromptCode] = useState<string | null>(null)

    const handLandmarker = useHandLandmarker(cameraActive)

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

    useEffect(() => () => stopCamera(), [stopCamera])

    // Lazy-load DrawingUtils once the canvas is mounted (camera active).
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
                HandLandmarker: vision.HandLandmarker,
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
     * Draw the 21-point hand skeleton on the overlay canvas. Connections
     * (HAND_CONNECTIONS) form the wireframe; landmarks are rendered as
     * dots with tip-of-finger keypoints emphasized. Hold-state flashes
     * the skeleton green so the user sees the gesture register.
     */
    const drawHandLandmarks = useCallback((
        rawLandmarks: { x: number; y: number; z?: number }[],
        isHolding: boolean,
    ) => {
        // DrawingUtils.drawConnectors / drawLandmarks only read x/y/z; cast
        // through unknown to satisfy MediaPipe's NormalizedLandmark type
        // which also requires a `visibility` field our HandFrame doesn't.
        const landmarks = rawLandmarks as unknown as
            import('@mediapipe/tasks-vision').NormalizedLandmark[]
        const canvas = canvasRef.current
        const video = videoRef.current
        const { utils, HandLandmarker } = drawingRef.current
        if (!canvas || !video || !utils || !HandLandmarker) return
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth || 640
            canvas.height = video.videoHeight || 480
        }
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        const skelColor = isHolding ? '#10b981' : '#ec4899'
        utils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
            color: skelColor,
            lineWidth: 4,
        })
        utils.drawLandmarks(landmarks, {
            color: '#fef3c7',
            fillColor: skelColor,
            radius: 4,
            lineWidth: 1,
        })
    }, [])

    const videoCallbackRef = useCallback((node: HTMLVideoElement | null) => {
        videoRef.current = node
        if (node && streamRef.current) {
            node.srcObject = streamRef.current
            node.onloadeddata = () => setVideoReady(true)
            node.play().catch(() => {
                /* autoplay deferred */
            })
        }
    }, [])

    // Detection loop: poll HandLandmarker, evaluate the puzzle.
    useEffect(() => {
        if (!handLandmarker.isReady) return
        if (!cameraActive || !videoReady) return

        // Reset puzzle state for a fresh attempt.
        stateRef.current = initialHandState(puzzleId)
        holdRef.current = { detectedSince: null }
        startTsRef.current = performance.now()
        completedRef.current = false
        setRunning(true)
        setProgress(0)
        setDetected(false)

        // Compute the human-readable prompt for puzzles that have a random
        // target (finger count, math expression).
        const s = stateRef.current
        if (puzzleId === BiometricPuzzleId.HAND_FINGER_COUNT && s.targetFingerCount) {
            setPromptText(t('biometricPuzzle.handFingerCountPrompt', {
                count: s.targetFingerCount,
            }))
            setPromptCode(String(s.targetFingerCount))
        } else if (puzzleId === BiometricPuzzleId.HAND_MATH && s.mathPrompt) {
            setPromptText(t('biometricPuzzle.handMathPrompt', { expr: s.mathPrompt }))
            setPromptCode(s.mathPrompt)
        } else {
            setPromptText(null)
            setPromptCode(null)
        }

        const loop = () => {
            const video = videoRef.current
            if (!video || video.readyState < 2) {
                animFrameRef.current = requestAnimationFrame(loop)
                return
            }

            if (performance.now() - startTsRef.current > ATTEMPT_TIMEOUT_MS) {
                if (!completedRef.current) {
                    completedRef.current = true
                    setRunning(false)
                    onError(t('biometricPuzzle.timeoutMessage'))
                }
                return
            }

            const ts = performance.now()
            const result = handLandmarker.detect(video, ts)
            const handFrame: HandFrame | null =
                result && result.landmarks && result.landmarks.length > 0
                    ? {
                        landmarks: result.landmarks[0],
                        handedness: (result.handedness?.[0]?.[0]?.categoryName as 'Left' | 'Right' | undefined),
                        timestamp: ts,
                    }
                    : null

            const evalResult = evaluateHandPuzzle(
                puzzleId,
                { frame: handFrame, state: stateRef.current },
                holdRef.current,
            )

            if (handFrame) {
                drawHandLandmarks(handFrame.landmarks, evalResult.detected)
            } else {
                clearOverlay()
            }

            setDetected(evalResult.detected)
            if (evalResult.progress != null) setProgress(evalResult.progress)

            if (evalResult.completed && !completedRef.current) {
                completedRef.current = true
                setRunning(false)
                setProgress(100)
                onSuccess()
                return
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
    }, [handLandmarker, cameraActive, videoReady, puzzleId, onSuccess, onError, t, drawHandLandmarks, clearOverlay])

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

                {promptText && (
                    <Box
                        sx={{
                            width: '100%',
                            p: 2,
                            borderRadius: '14px',
                            background:
                                'linear-gradient(135deg, rgba(236, 72, 153, 0.08) 0%, rgba(249, 115, 22, 0.06) 100%)',
                            border: '1px solid',
                            borderColor: 'rgba(236, 72, 153, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                        }}
                    >
                        <Box
                            sx={{
                                width: 36,
                                height: 36,
                                borderRadius: '50%',
                                background: HAND_GRADIENT,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}
                        >
                            <Quiz sx={{ color: 'white', fontSize: 20 }} />
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                                variant="caption"
                                sx={{
                                    color: 'text.secondary',
                                    textTransform: 'uppercase',
                                    letterSpacing: 1,
                                    fontWeight: 700,
                                    display: 'block',
                                }}
                            >
                                {t('biometricPuzzle.promptLabel')}
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="baseline" flexWrap="wrap">
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {promptText}
                                </Typography>
                                {promptCode && (
                                    <Typography
                                        sx={{
                                            fontFamily:
                                                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                            fontWeight: 800,
                                            fontSize: '1.1rem',
                                            color: '#ec4899',
                                        }}
                                    >
                                        {promptCode}
                                    </Typography>
                                )}
                            </Stack>
                        </Box>
                    </Box>
                )}

                {handLandmarker.error && (
                    <Alert severity="error" sx={{ width: '100%', borderRadius: '12px' }}>
                        {handLandmarker.error}
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
                        sx={{
                            textTransform: 'none',
                            borderRadius: '12px',
                            fontWeight: 600,
                            px: 4,
                            py: 1.25,
                            background: HAND_GRADIENT,
                            boxShadow: HAND_GLOW,
                            '&:hover': {
                                background: HAND_GRADIENT,
                                filter: 'brightness(1.1)',
                            },
                        }}
                    >
                        {t('biometricPuzzle.startCamera')}
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
                                : HAND_GRADIENT,
                            p: '3px',
                            transition: 'background 0.3s ease',
                            boxShadow: detected
                                ? '0 8px 32px rgba(16, 185, 129, 0.4)'
                                : HAND_GLOW,
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

                {handLandmarker.isLoading && (
                    <Typography variant="caption" color="text.secondary">
                        {t('biometricPuzzle.engineLoading')}
                    </Typography>
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
                                        : HAND_GRADIENT,
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
 * Build a `ComponentType<BiometricPuzzleProps>` with `puzzleId` and
 * `i18nKey` pre-bound for the registry.
 *
 * `react-refresh/only-export-components` can't see that this returns a
 * component; HMR is irrelevant for these dynamic factories.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function makeHandPuzzle(puzzleId: BiometricPuzzleId, i18nKey: string) {
    const Bound: React.FC<BiometricPuzzleProps> = (p) => (
        <HandGesturePuzzle {...p} puzzleId={puzzleId} i18nKey={i18nKey} />
    )
    Bound.displayName = `HandGesturePuzzle(${puzzleId})`
    return Bound
}

export default HandGesturePuzzle
