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
import { BiometricPuzzleId } from '../BiometricPuzzleId'
import type { BiometricPuzzleProps } from '../biometricPuzzleRegistry'
import { useHandLandmarker } from './useHandLandmarker'
import {
    evaluateHandPuzzle,
    initialHandState,
    type HandFrame,
    type HandPuzzleState,
} from './handChallenges'

interface Props extends BiometricPuzzleProps {
    puzzleId: BiometricPuzzleId
    /** i18n key root (e.g. `biometricPuzzle.puzzles.hand_pinch`). */
    i18nKey: string
}

const ATTEMPT_TIMEOUT_MS = 45_000

function HandGesturePuzzle({ onSuccess, onError, puzzleId, i18nKey }: Props) {
    const { t } = useTranslation()
    const videoRef = useRef<HTMLVideoElement | null>(null)
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
        } else if (puzzleId === BiometricPuzzleId.HAND_MATH && s.mathPrompt) {
            setPromptText(t('biometricPuzzle.handMathPrompt', { expr: s.mathPrompt }))
        } else {
            setPromptText(null)
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
    }, [handLandmarker, cameraActive, videoReady, puzzleId, onSuccess, onError, t])

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
                {promptText && (
                    <Alert severity="info" sx={{ width: '100%' }}>
                        {promptText}
                    </Alert>
                )}

                {handLandmarker.error && (
                    <Alert severity="error" sx={{ width: '100%' }}>
                        {handLandmarker.error}
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

                {handLandmarker.isLoading && (
                    <Typography variant="caption" color="text.secondary">
                        {t('biometricPuzzle.engineLoading')}
                    </Typography>
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
 * Build a `ComponentType<BiometricPuzzleProps>` with `puzzleId` and
 * `i18nKey` pre-bound for the registry.
 */
export function makeHandPuzzle(puzzleId: BiometricPuzzleId, i18nKey: string) {
    const Bound: React.FC<BiometricPuzzleProps> = (p) => (
        <HandGesturePuzzle {...p} puzzleId={puzzleId} i18nKey={i18nKey} />
    )
    Bound.displayName = `HandGesturePuzzle(${puzzleId})`
    return Bound
}

export default HandGesturePuzzle
