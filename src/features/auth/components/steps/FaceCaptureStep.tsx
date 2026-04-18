import { useState, useRef, useCallback, useEffect } from 'react'
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Typography,
} from '@mui/material'
import {
    Face,
    CameraAlt,
    Replay,
    ArrowForward,
    VideocamOff,
    Visibility,
    WbSunny,
    BlurOn,
} from '@mui/icons-material'
import { motion, Variants } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useFaceDetection } from '../../hooks/useFaceDetection'
import { useQualityAssessment } from '../../hooks/useQualityAssessment'
import { usePerf } from '../../../../contexts/PerfContext'
import { BiometricEngine } from '../../../../lib/biometric-engine/core/BiometricEngine'
import { dataURLToImageData } from '../../utils/faceCropper'

const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.4, ease: easeOut },
    },
}

interface FaceCaptureStepProps {
    onSubmit: (image: string, clientEmbedding?: number[]) => void
    loading: boolean
    error?: string
}

export default function FaceCaptureStep({ onSubmit, loading, error }: FaceCaptureStepProps) {
    const { t } = useTranslation()
    const { recordFrame, recordOperation } = usePerf()
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const streamRef = useRef<MediaStream | null>(null)

    const [cameraActive, setCameraActive] = useState(false)
    const [videoReady, setVideoReady] = useState(false)
    const [capturedImage, setCapturedImage] = useState<string | null>(null)
    const [cameraError, setCameraError] = useState<string | null>(null)

    const {
        detected,
        centered,
        hint,
        boundingBox,
        cropFace,
        backend,
    } = useFaceDetection(videoRef, cameraActive && !capturedImage, recordOperation)

    const { quality, updateQuality, resetQuality, getScoreColor, getQualityLabel } = useQualityAssessment()

    // Run quality assessment in animation loop
    useEffect(() => {
        if (!cameraActive || capturedImage) return
        let animFrame = 0
        function loop() {
            recordFrame()
            if (videoRef.current && videoRef.current.readyState >= 2) {
                const t0 = performance.now()
                updateQuality(videoRef.current)
                recordOperation('quality-assess', performance.now() - t0)
            }
            animFrame = requestAnimationFrame(loop)
        }
        animFrame = requestAnimationFrame(loop)
        return () => {
            cancelAnimationFrame(animFrame)
            resetQuality()
        }
    }, [cameraActive, capturedImage, updateQuality, resetQuality, recordFrame, recordOperation])

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
        if (videoRef.current) {
            videoRef.current.srcObject = null
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop())
            streamRef.current = null
        }
        setCameraActive(false)
        setVideoReady(false)
    }, [])

    // Callback ref for the video element — attaches the stream as soon as
    // the element is mounted into the DOM. This is more reliable than
    // useEffect + useRef because it fires exactly when the node appears.
    const videoCallbackRef = useCallback((node: HTMLVideoElement | null) => {
        // Also keep videoRef in sync for other hooks (useFaceDetection, captureImage)
        (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = node
        if (node && streamRef.current) {
            node.srcObject = streamRef.current
            node.onloadeddata = () => {
                setVideoReady(true)
            }
            node.play().catch(() => {
                // Autoplay blocked — user will tap capture which acts as gesture
            })
        }
    }, [])

    // Auto-start camera on mount
    useEffect(() => {
        startCamera()
        return () => {
            stopCamera()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const captureImage = useCallback(() => {
        if (!videoRef.current || !canvasRef.current) return

        // Guard: video must have actual dimensions (is actually playing)
        const vw = videoRef.current.videoWidth
        const vh = videoRef.current.videoHeight
        if (!vw || !vh) {
            setCameraError(t('mfa.face.cameraError'))
            return
        }

        // Face gate: always crop to 224×224 — never send a full-resolution frame.
        // This eliminates the 200-730ms server-side face detection step.
        // If no face is detected, block the capture and ask the user to re-position.
        if (!detected || !boundingBox) {
            setCameraError(t('mfa.face.noFaceDetected'))
            return
        }

        // Client pre-crops to 224×224 JPEG (<20KB) — server detection only as fallback
        const cropped = cropFace(canvasRef.current)
        if (!cropped) {
            setCameraError(t('mfa.face.cameraError'))
            return
        }

        setCapturedImage(cropped)
        stopCamera()
    }, [stopCamera, detected, boundingBox, cropFace])

    const retakePhoto = useCallback(() => {
        setCapturedImage(null)
        startCamera()
    }, [startCamera])

    const handleSubmit = useCallback(async () => {
        if (!capturedImage) return

        // Attempt client-side landmark-geometry embedding extraction (non-blocking).
        // Produces a 512-dim vector from MediaPipe landmarks (log-only per D2).
        // Returns null when landmarks are unavailable; server computes its own
        // trusted embedding regardless. The field is passed as clientEmbedding
        // to onSubmit — server stores it for offline analysis only.
        let clientEmbedding: number[] | undefined
        try {
            const engine = BiometricEngine.getInstance()
            const computer = engine.embeddingComputer
            if (computer && computer.isAvailable()) {
                const imageData = await dataURLToImageData(capturedImage)
                if (imageData) {
                    const vec = await computer.extract(imageData)
                    if (vec) clientEmbedding = Array.from(vec)
                }
            }
        } catch {
            // Non-critical: embedding extraction failure is silently ignored.
        }

        onSubmit(capturedImage, clientEmbedding)
    }, [capturedImage, onSubmit])

    // Determine bounding box overlay color
    const boxColor = detected
        ? centered
            ? 'rgba(34, 197, 94, 0.8)'   // green - ready
            : 'rgba(250, 204, 21, 0.8)'   // yellow - adjust
        : 'rgba(255, 255, 255, 0.3)'       // white dashed - no face

    const captureReady = detected && centered

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={{
                hidden: { opacity: 0 },
                visible: {
                    opacity: 1,
                    transition: { staggerChildren: 0.1 },
                },
            }}
        >
            <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Box
                    sx={{
                        width: 56,
                        height: 56,
                        borderRadius: '14px',
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                        boxShadow: '0 8px 32px rgba(139, 92, 246, 0.3)',
                    }}
                >
                    <Face sx={{ fontSize: 28, color: 'white' }} />
                </Box>
                <Typography variant="h6" fontWeight={600}>
                    {t('mfa.face.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {t('mfa.face.description')}
                </Typography>
            </Box>

            {(error || cameraError) && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
                        {error || cameraError}
                    </Alert>
                </motion.div>
            )}

            {/* Camera / Captured Image Area */}
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
                            ? captureReady
                                ? 'success.main'
                                : 'primary.main'
                            : 'divider',
                        position: 'relative',
                        aspectRatio: '4/3',
                        bgcolor: '#1e293b',
                    }}
                >
                    {/* Hidden canvas for capture */}
                    <canvas ref={canvasRef} style={{ display: 'none' }} />

                    {capturedImage ? (
                        <Box
                            component="img"
                            src={capturedImage}
                            alt="Captured face"
                            sx={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                            }}
                        />
                    ) : cameraActive ? (
                        <>
                            <video
                                ref={videoCallbackRef}
                                autoPlay
                                playsInline
                                muted
                                aria-label={t('faceCapture.videoAriaLabel')}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    transform: 'scaleX(-1)',
                                }}
                            />
                            {/* Face bounding box overlay */}
                            <Box
                                sx={{
                                    position: 'absolute',
                                    inset: 0,
                                    pointerEvents: 'none',
                                }}
                            >
                                {detected && boundingBox ? (
                                    <Box
                                        sx={{
                                            position: 'absolute',
                                            // Mirror x-coordinate (video is flipped)
                                            right: `${boundingBox.x * 100}%`,
                                            top: `${boundingBox.y * 100}%`,
                                            width: `${boundingBox.width * 100}%`,
                                            height: `${boundingBox.height * 100}%`,
                                            border: `2px solid ${boxColor}`,
                                            borderRadius: '8px',
                                            transition: 'all 0.15s ease',
                                        }}
                                    />
                                ) : (
                                    // Fallback: dashed oval guide when no face detected
                                    <Box
                                        sx={{
                                            position: 'absolute',
                                            inset: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                width: '60%',
                                                aspectRatio: '3/4',
                                                borderRadius: '50%',
                                                border: '2px dashed rgba(255, 255, 255, 0.5)',
                                            }}
                                        />
                                    </Box>
                                )}
                            </Box>
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
                                color: 'rgba(0, 0, 0, 0.4)',
                            }}
                        >
                            <VideocamOff sx={{ fontSize: 48, mb: 1 }} />
                            <Typography variant="body2" sx={{ color: 'inherit' }}>{t('mfa.face.cameraOff')}</Typography>
                        </Box>
                    )}
                </Box>
            </motion.div>

            {/* Quality hint */}
            {cameraActive && !capturedImage && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    <Typography
                        variant="caption"
                        sx={{
                            display: 'block',
                            textAlign: 'center',
                            mb: 1,
                            color: captureReady ? 'success.main' : 'text.secondary',
                            fontWeight: captureReady ? 600 : 400,
                            transition: 'color 0.2s ease',
                        }}
                    >
                        {t(hint)}
                    </Typography>
                </motion.div>
            )}

            {/* Quality assessment overlay */}
            {cameraActive && !capturedImage && quality.overall > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <Box
                        sx={{
                            display: 'flex',
                            gap: 0.75,
                            justifyContent: 'center',
                            flexWrap: 'wrap',
                            mb: 2,
                        }}
                    >
                        <Chip
                            icon={<Visibility sx={{ fontSize: 14 }} />}
                            label={t('mfa.face.quality', { label: getQualityLabel(quality.overall), score: quality.overall })}
                            size="small"
                            color={getScoreColor(quality.overall)}
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 24 }}
                        />
                        <Chip
                            icon={<BlurOn sx={{ fontSize: 14 }} />}
                            label={t('mfa.face.blur', { score: quality.blur })}
                            size="small"
                            color={getScoreColor(quality.blur)}
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 24 }}
                        />
                        <Chip
                            icon={<WbSunny sx={{ fontSize: 14 }} />}
                            label={t('mfa.face.light', { score: quality.lighting })}
                            size="small"
                            color={getScoreColor(quality.lighting)}
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 24 }}
                        />
                        {quality.faceSizeScore > 0 && (
                            <Chip
                                icon={<Face sx={{ fontSize: 14 }} />}
                                label={t('mfa.face.size', { score: quality.faceSizeScore })}
                                size="small"
                                color={getScoreColor(quality.faceSizeScore)}
                                variant="outlined"
                                sx={{ fontSize: '0.7rem', height: 24 }}
                            />
                        )}
                        {backend !== 'none' && (
                            <Chip
                                label={
                                    backend === 'blazeface'
                                        ? t('faceCapture.backend.blazeface')
                                        : t('faceCapture.backend.mediapipe')
                                }
                                size="small"
                                color={backend === 'blazeface' ? 'success' : 'info'}
                                variant="outlined"
                                sx={{ fontSize: '0.65rem', height: 24 }}
                            />
                        )}
                    </Box>
                </motion.div>
            )}

            {/* Actions */}
            <motion.div variants={itemVariants}>
                {!cameraActive && !capturedImage && (
                    <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        onClick={startCamera}
                        disabled={loading}
                        startIcon={<CameraAlt />}
                        sx={{
                            py: 1.5,
                            borderRadius: '12px',
                            fontSize: '1rem',
                            fontWeight: 600,
                            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                            boxShadow: '0 10px 40px rgba(99, 102, 241, 0.4)',
                            '&:hover': {
                                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                            },
                            transition: 'all 0.3s ease',
                        }}
                    >
                        {t('mfa.face.startCamera')}
                    </Button>
                )}

                {cameraActive && !capturedImage && (
                    <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        onClick={captureImage}
                        disabled={loading || !videoReady}
                        startIcon={<CameraAlt />}
                        sx={{
                            py: 1.5,
                            borderRadius: '12px',
                            fontSize: '1rem',
                            fontWeight: 600,
                            background: captureReady
                                ? 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)'
                                : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                            boxShadow: captureReady
                                ? '0 10px 40px rgba(34, 197, 94, 0.4)'
                                : '0 10px 40px rgba(99, 102, 241, 0.4)',
                            '&:hover': {
                                background: captureReady
                                    ? 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)'
                                    : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                            },
                            transition: 'all 0.3s ease',
                        }}
                    >
                        {t('mfa.face.capturePhoto')}
                    </Button>
                )}

                {capturedImage && (
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            variant="outlined"
                            size="large"
                            onClick={retakePhoto}
                            disabled={loading}
                            startIcon={<Replay />}
                            sx={{
                                flex: 1,
                                py: 1.5,
                                borderRadius: '12px',
                                fontWeight: 600,
                            }}
                        >
                            {t('mfa.face.retake')}
                        </Button>
                        <Button
                            variant="contained"
                            size="large"
                            onClick={handleSubmit}
                            disabled={loading}
                            endIcon={!loading && <ArrowForward />}
                            sx={{
                                flex: 1,
                                py: 1.5,
                                borderRadius: '12px',
                                fontWeight: 600,
                                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                boxShadow: '0 10px 40px rgba(99, 102, 241, 0.4)',
                                '&:hover': {
                                    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                                },
                                transition: 'all 0.3s ease',
                            }}
                        >
                            {loading ? (
                                <CircularProgress size={24} sx={{ color: 'white' }} />
                            ) : (
                                t('mfa.face.submit')
                            )}
                        </Button>
                    </Box>
                )}
            </motion.div>
        </motion.div>
    )
}
