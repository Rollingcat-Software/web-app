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
    onSubmit: (image: string) => void
    loading: boolean
    error?: string
}

export default function FaceCaptureStep({ onSubmit, loading, error }: FaceCaptureStepProps) {
    const { t } = useTranslation()
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const streamRef = useRef<MediaStream | null>(null)

    const [cameraActive, setCameraActive] = useState(false)
    const [capturedImage, setCapturedImage] = useState<string | null>(null)
    const [cameraError, setCameraError] = useState<string | null>(null)

    const {
        detected,
        centered,
        hint,
        boundingBox,
        cropFace,
        backend,
    } = useFaceDetection(videoRef, cameraActive && !capturedImage)

    const { quality, updateQuality, resetQuality, getScoreColor, getQualityLabel } = useQualityAssessment()

    // Run quality assessment in animation loop
    useEffect(() => {
        if (!cameraActive || capturedImage) return
        let animFrame = 0
        function loop() {
            if (videoRef.current && videoRef.current.readyState >= 2) {
                updateQuality(videoRef.current)
            }
            animFrame = requestAnimationFrame(loop)
        }
        animFrame = requestAnimationFrame(loop)
        return () => {
            cancelAnimationFrame(animFrame)
            resetQuality()
        }
    }, [cameraActive, capturedImage, updateQuality, resetQuality])

    const startCamera = useCallback(async () => {
        try {
            setCameraError(null)
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                },
            })
            streamRef.current = stream
            if (videoRef.current) {
                videoRef.current.srcObject = stream
                await videoRef.current.play()
            }
            setCameraActive(true)
        } catch (_err) {
            setCameraError(
                t('mfa.face.cameraError')
            )
        }
    }, [])

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop())
            streamRef.current = null
        }
        setCameraActive(false)
    }, [])

    useEffect(() => {
        return () => {
            stopCamera()
        }
    }, [stopCamera])

    const captureImage = useCallback(() => {
        if (!videoRef.current || !canvasRef.current) return

        // Quality gate: block if quality is too poor
        if (quality.overall > 0 && quality.overall < 40) {
            // Allow capture but warn — don't block entirely
        }

        // Try cropped face capture first (MediaPipe detected)
        if (detected && boundingBox) {
            const cropped = cropFace(canvasRef.current)
            if (cropped) {
                setCapturedImage(cropped)
                stopCamera()
                return
            }
        }

        // Fallback: full frame capture with 640px resize
        const video = videoRef.current
        const canvas = canvasRef.current
        const w = video.videoWidth
        const h = video.videoHeight
        const maxDim = 640
        const scale = Math.min(1, maxDim / Math.max(w, h))
        canvas.width = Math.round(w * scale)
        canvas.height = Math.round(h * scale)

        const ctx = canvas.getContext('2d')
        if (!ctx) {
            setCameraError(t('mfa.face.cameraError'))
            return
        }

        ctx.translate(canvas.width, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(video, 0, 0, w, h, 0, 0, canvas.width, canvas.height)

        const base64 = canvas.toDataURL('image/jpeg', 0.85)
        setCapturedImage(base64)
        stopCamera()
    }, [stopCamera, detected, boundingBox, cropFace, quality.overall])

    const retakePhoto = useCallback(() => {
        setCapturedImage(null)
        startCamera()
    }, [startCamera])

    const handleSubmit = useCallback(() => {
        if (capturedImage) {
            onSubmit(capturedImage)
        }
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
            <motion.div variants={itemVariants}>
                <Box
                    sx={{
                        width: '100%',
                        maxWidth: 360,
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
                        {hint}
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
                                label={backend === 'blazeface' ? 'BlazeFace (on-device)' : 'MediaPipe (CDN)'}
                                size="small"
                                color={backend === 'blazeface' ? 'success' : 'default'}
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
                        disabled={loading}
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
