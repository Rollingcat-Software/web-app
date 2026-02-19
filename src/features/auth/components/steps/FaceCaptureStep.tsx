import { useState, useRef, useCallback, useEffect } from 'react'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Typography,
} from '@mui/material'
import {
    Face,
    CameraAlt,
    Replay,
    ArrowForward,
    VideocamOff,
} from '@mui/icons-material'
import { motion, Variants } from 'framer-motion'

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
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const streamRef = useRef<MediaStream | null>(null)

    const [cameraActive, setCameraActive] = useState(false)
    const [capturedImage, setCapturedImage] = useState<string | null>(null)
    const [cameraError, setCameraError] = useState<string | null>(null)

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
                'Unable to access camera. Please ensure camera permissions are granted.'
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

        const video = videoRef.current
        const canvas = canvasRef.current
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Mirror the image for selfie-style capture
        ctx.translate(canvas.width, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(video, 0, 0)

        const base64 = canvas.toDataURL('image/jpeg', 0.8)
        setCapturedImage(base64)
        stopCamera()
    }, [stopCamera])

    const retakePhoto = useCallback(() => {
        setCapturedImage(null)
        startCamera()
    }, [startCamera])

    const handleSubmit = useCallback(() => {
        if (capturedImage) {
            onSubmit(capturedImage)
        }
    }, [capturedImage, onSubmit])

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
                    Face Verification
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Position your face in the frame and capture a photo
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
                        mb: 3,
                        borderRadius: '16px',
                        overflow: 'hidden',
                        border: '2px solid',
                        borderColor: cameraActive ? 'primary.main' : 'divider',
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
                            {/* Face guide overlay */}
                            <Box
                                sx={{
                                    position: 'absolute',
                                    inset: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    pointerEvents: 'none',
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
                                color: 'rgba(255, 255, 255, 0.5)',
                            }}
                        >
                            <VideocamOff sx={{ fontSize: 48, mb: 1 }} />
                            <Typography variant="body2">Camera off</Typography>
                        </Box>
                    )}
                </Box>
            </motion.div>

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
                        Start Camera
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
                            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                            boxShadow: '0 10px 40px rgba(99, 102, 241, 0.4)',
                            '&:hover': {
                                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                            },
                            transition: 'all 0.3s ease',
                        }}
                    >
                        Capture Photo
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
                            Retake
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
                                'Submit'
                            )}
                        </Button>
                    </Box>
                )}
            </motion.div>
        </motion.div>
    )
}
