import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogContent,
    IconButton,
    Typography,
    LinearProgress,
    Chip,
} from '@mui/material'
import { Close, CheckCircle, Face, Replay, Warning } from '@mui/icons-material'
import { motion, AnimatePresence } from 'framer-motion'
import { useFaceDetection } from '../hooks/useFaceDetection'
import { useFaceChallenge, ChallengeStage } from '../hooks/useFaceChallenge'
import FaceOvalGuide from './FaceOvalGuide'

interface FaceEnrollmentFlowProps {
    open: boolean
    onClose: () => void
    onComplete: (images: string[], clientEmbeddings?: (number[] | null)[]) => void
}

const STAGE_ICONS: Record<ChallengeStage, string> = {
    position: '🎯',
    frontal: '👤',
    turn_left: '👈',
    turn_right: '👉',
    blink: '👁️',
    capture: '📸',
    complete: '✅',
}

export default function FaceEnrollmentFlow({ open, onClose, onComplete }: FaceEnrollmentFlowProps) {
    const { t } = useTranslation()
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const animFrameRef = useRef<number>(0)

    const [cameraActive, setCameraActive] = useState(false)
    const [cameraError, setCameraError] = useState<string | null>(null)
    const [started, setStarted] = useState(false)

    const detection = useFaceDetection(videoRef, cameraActive)
    const { initialized: detectorReady, initFailed: detectorFailed } = detection
    const { challengeState, updateChallenge, resetChallenge } = useFaceChallenge()

    const startCamera = useCallback(async () => {
        try {
            setCameraError(null)
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
            })
            streamRef.current = stream
            if (videoRef.current) {
                try {
                    videoRef.current.srcObject = stream
                    await videoRef.current.play()
                } catch {
                    setCameraError('Unable to start camera preview. Please try again.')
                    stream.getTracks().forEach(t => t.stop())
                    streamRef.current = null
                    return
                }
            }
            setCameraActive(true)
        } catch {
            setCameraError('Unable to access camera. Please grant camera permissions and try again.')
        }
    }, [])

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop())
            streamRef.current = null
        }
        setCameraActive(false)
    }, [])

    // Run challenge update loop
    useEffect(() => {
        if (!cameraActive || !started || challengeState.stage === 'complete') return

        const loop = () => {
            try {
                updateChallenge(detection, detection.cropFace, canvasRef)
            } catch {
                // Silently ignore individual frame errors to keep the loop running
            }
            animFrameRef.current = requestAnimationFrame(loop)
        }
        animFrameRef.current = requestAnimationFrame(loop)

        return () => {
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
        }
    }, [cameraActive, started, detection, updateChallenge, challengeState.stage])

    // Auto-start camera when dialog opens
    useEffect(() => {
        if (open) {
            startCamera()
        }
        return () => {
            stopCamera()
            setStarted(false)
            resetChallenge()
        }
    }, [open, startCamera, stopCamera, resetChallenge])

    // When enrollment complete, notify parent
    useEffect(() => {
        if (challengeState.stage === 'complete' && challengeState.captures.length > 0) {
            stopCamera()
        }
    }, [challengeState.stage, challengeState.captures.length, stopCamera])

    const handleSubmit = () => {
        // Don't close here — the parent (EnrollmentPage) will close the dialog
        // after the biometric API call completes (success or failure)
        onComplete(challengeState.captures, challengeState.clientEmbeddings)
    }

    const handleRetry = () => {
        resetChallenge()
        setStarted(false)
        startCamera()
    }

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: '20px',
                    bgcolor: '#0f172a',
                    color: 'white',
                    overflow: 'hidden',
                },
            }}
        >
            <DialogContent sx={{ p: 0, position: 'relative' }}>
                {/* Close button */}
                <IconButton
                    onClick={onClose}
                    sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        zIndex: 10,
                        color: 'rgba(255,255,255,0.7)',
                        '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.1)' },
                    }}
                >
                    <Close />
                </IconButton>

                {/* Header */}
                <Box sx={{ textAlign: 'center', pt: 3, pb: 1, px: 3 }}>
                    <Box
                        sx={{
                            width: 48,
                            height: 48,
                            borderRadius: '14px',
                            background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mx: 'auto',
                            mb: 1.5,
                        }}
                    >
                        <Face sx={{ fontSize: 26, color: 'white' }} />
                    </Box>
                    <Typography variant="h6" fontWeight={700}>
                        Face ID Enrollment
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mt: 0.5 }}>
                        Follow the steps to register your face
                    </Typography>
                </Box>

                {/* Progress bar */}
                <Box sx={{ px: 3, py: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                            Step {Math.min(challengeState.stageIndex + 1, challengeState.totalStages)} of {challengeState.totalStages}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                            {Math.round(challengeState.progress * 100)}%
                        </Typography>
                    </Box>
                    <LinearProgress
                        variant="determinate"
                        value={challengeState.progress * 100}
                        sx={{
                            height: 6,
                            borderRadius: 3,
                            bgcolor: 'rgba(255,255,255,0.1)',
                            '& .MuiLinearProgress-bar': {
                                borderRadius: 3,
                                background: 'linear-gradient(90deg, #8b5cf6, #06b6d4)',
                                transition: 'transform 0.2s linear',
                            },
                        }}
                    />
                </Box>

                {/* Camera view */}
                <Box
                    sx={{
                        position: 'relative',
                        mx: 3,
                        my: 1,
                        borderRadius: '16px',
                        overflow: 'hidden',
                        aspectRatio: '4/3',
                        bgcolor: '#1e293b',
                    }}
                >
                    <canvas ref={canvasRef} style={{ display: 'none' }} />

                    <AnimatePresence mode="wait">
                        {challengeState.stage === 'complete' ? (
                            <motion.div
                                key="complete"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.5, ease: 'easeOut' }}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                                >
                                    <CheckCircle sx={{ fontSize: 72, color: '#22c55e' }} />
                                </motion.div>
                                <Typography variant="h6" sx={{ mt: 2, fontWeight: 600 }}>
                                    Enrollment Complete!
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mt: 0.5 }}>
                                    {challengeState.captures.length} images captured
                                </Typography>

                                {/* Thumbnails */}
                                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                                    {challengeState.captures.map((img, i) => (
                                        <Box
                                            key={i}
                                            component="img"
                                            src={img}
                                            alt={`Capture ${i + 1}`}
                                            sx={{
                                                width: 48,
                                                height: 48,
                                                borderRadius: '8px',
                                                objectFit: 'cover',
                                                border: '2px solid rgba(255,255,255,0.2)',
                                            }}
                                        />
                                    ))}
                                </Box>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="camera"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                style={{ width: '100%', height: '100%', position: 'relative' }}
                            >
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        transform: 'scaleX(-1)',
                                    }}
                                />

                                <FaceOvalGuide
                                    detected={detection.detected}
                                    centered={detection.centered}
                                    progress={challengeState.stageProgress}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Box>

                {/* Instruction */}
                <Box sx={{ textAlign: 'center', px: 3, py: 1.5 }}>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={challengeState.stage}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Chip
                                label={t(challengeState.instruction)}
                                icon={
                                    <span style={{ fontSize: '1.3rem' }}>
                                        {STAGE_ICONS[challengeState.stage]}
                                    </span>
                                }
                                sx={{
                                    bgcolor: 'rgba(255,255,255,0.15)',
                                    color: 'white',
                                    fontSize: { xs: '1rem', sm: '0.9rem' },
                                    py: 3,
                                    px: 2,
                                    fontWeight: 600,
                                    maxWidth: '90%',
                                    height: 'auto',
                                    '& .MuiChip-label': {
                                        whiteSpace: 'normal',
                                        textAlign: 'center',
                                    },
                                }}
                            />
                        </motion.div>
                    </AnimatePresence>

                    {started && challengeState.stage !== 'complete' && (
                        <Typography
                            variant="caption"
                            sx={{
                                color: 'rgba(255,255,255,0.4)',
                                mt: 1,
                                display: 'block',
                            }}
                        >
                            Follow the instruction above. It will auto-advance if needed.
                        </Typography>
                    )}

                    {/* MediaPipe loading / failure feedback */}
                    {started && !detectorReady && !detectorFailed && challengeState.stage !== 'complete' && (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 1 }}>
                            <CircularProgress size={14} sx={{ color: 'rgba(255,255,255,0.5)' }} />
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                                Loading face detection...
                            </Typography>
                        </Box>
                    )}

                    {detectorFailed && challengeState.stage !== 'complete' && (
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 1,
                                mt: 1.5,
                                mx: 'auto',
                                maxWidth: '90%',
                                p: 1.5,
                                borderRadius: '10px',
                                bgcolor: 'rgba(250, 204, 21, 0.1)',
                                border: '1px solid rgba(250, 204, 21, 0.25)',
                            }}
                        >
                            <Warning sx={{ fontSize: 18, color: '#facc15', mt: 0.2 }} />
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', textAlign: 'left' }}>
                                Face detection unavailable on this device. Timer-based capture will be used
                                — hold steady and follow the instructions.
                            </Typography>
                        </Box>
                    )}

                    {cameraError && (
                        <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                            {cameraError}
                        </Typography>
                    )}
                </Box>

                {/* Actions */}
                <Box sx={{ px: 3, pb: 3, display: 'flex', gap: 2 }}>
                    {!started && challengeState.stage !== 'complete' && (
                        <Button
                            fullWidth
                            variant="contained"
                            size="large"
                            onClick={() => setStarted(true)}
                            disabled={!cameraActive}
                            startIcon={!cameraActive ? <CircularProgress size={18} color="inherit" /> : undefined}
                            sx={{
                                py: 1.5,
                                borderRadius: '12px',
                                fontWeight: 600,
                                background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                                '&:hover': {
                                    background: 'linear-gradient(135deg, #7c3aed 0%, #0891b2 100%)',
                                },
                            }}
                        >
                            {!cameraActive ? 'Starting Camera...' : 'Begin Enrollment'}
                        </Button>
                    )}

                    {challengeState.stage === 'complete' && (
                        <>
                            <Button
                                variant="outlined"
                                size="large"
                                onClick={handleRetry}
                                startIcon={<Replay />}
                                sx={{
                                    flex: 1,
                                    py: 1.5,
                                    borderRadius: '12px',
                                    fontWeight: 600,
                                    borderColor: 'rgba(255,255,255,0.2)',
                                    color: 'white',
                                    '&:hover': { borderColor: 'rgba(255,255,255,0.4)' },
                                }}
                            >
                                Retry
                            </Button>
                            <Button
                                variant="contained"
                                size="large"
                                onClick={handleSubmit}
                                sx={{
                                    flex: 2,
                                    py: 1.5,
                                    borderRadius: '12px',
                                    fontWeight: 600,
                                    background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
                                    '&:hover': {
                                        background: 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)',
                                    },
                                }}
                            >
                                Confirm & Save
                            </Button>
                        </>
                    )}
                </Box>
            </DialogContent>
        </Dialog>
    )
}
