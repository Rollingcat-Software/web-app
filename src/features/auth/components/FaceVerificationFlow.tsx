import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Box,
    Button,
    Dialog,
    DialogContent,
    IconButton,
    Typography,
    CircularProgress,
} from '@mui/material'
import { Close, CheckCircle, ErrorOutline, Face, Replay } from '@mui/icons-material'
import { motion, AnimatePresence } from 'framer-motion'
import { useFaceDetection } from '../hooks/useFaceDetection'
import { useFaceVerification as useFaceVerificationHook } from '../hooks/useFaceChallenge'
import FaceOvalGuide from './FaceOvalGuide'

interface FaceVerificationFlowProps {
    open: boolean
    onClose: () => void
    onVerify: (image: string) => Promise<boolean>
}

export default function FaceVerificationFlow({ open, onClose, onVerify }: FaceVerificationFlowProps) {
    const { t } = useTranslation()
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const animFrameRef = useRef<number>(0)
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const [cameraActive, setCameraActive] = useState(false)
    const [verifying, setVerifying] = useState(false)

    const detection = useFaceDetection(videoRef, cameraActive)
    const { verificationState, updateVerification, resetVerification, setResult } = useFaceVerificationHook()

    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
            })
            streamRef.current = stream
            if (videoRef.current) {
                videoRef.current.srcObject = stream
                await videoRef.current.play()
            }
            setCameraActive(true)
        } catch {
            // Camera error handled silently
        }
    }, [])

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop())
            streamRef.current = null
        }
        setCameraActive(false)
    }, [])

    // Run verification update loop
    useEffect(() => {
        if (!cameraActive || verificationState.stage !== 'position') return

        const loop = () => {
            updateVerification(detection, detection.cropFace, canvasRef)
            animFrameRef.current = requestAnimationFrame(loop)
        }
        animFrameRef.current = requestAnimationFrame(loop)

        return () => {
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
        }
    }, [cameraActive, detection, updateVerification, verificationState.stage])

    // When image captured, send to backend
    useEffect(() => {
        if (verificationState.stage === 'hold' && verificationState.capturedImage && !verifying) {
            setVerifying(true)
            stopCamera()

            onVerify(verificationState.capturedImage)
                .then(success => {
                    setResult(success)
                    if (success) {
                        if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
                        closeTimerRef.current = setTimeout(onClose, 1500)
                    }
                })
                .catch(() => {
                    setResult(false)
                })
                .finally(() => {
                    setVerifying(false)
                })
        }
    }, [verificationState.stage, verificationState.capturedImage, verifying, onVerify, setResult, stopCamera, onClose])

    // Start camera when opened
    useEffect(() => {
        if (open) {
            startCamera()
        }
        return () => {
            stopCamera()
            resetVerification()
        }
    }, [open, startCamera, stopCamera, resetVerification])

    // Clear pending close timer when the dialog closes — without this, a
    // pending timeout can still call onClose after the dialog is already
    // closed (double-close) because <Dialog open=false> may keep the
    // component mounted (Copilot review on PR #67).
    useEffect(() => {
        if (!open && closeTimerRef.current) {
            clearTimeout(closeTimerRef.current)
            closeTimerRef.current = null
        }
    }, [open])

    useEffect(() => {
        return () => {
            if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
        }
    }, [])

    const handleRetry = () => {
        resetVerification()
        startCamera()
    }

    const resultStage = verificationState.stage === 'success' || verificationState.stage === 'failure'
    const isSuccess = verificationState.stage === 'success'

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xs"
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
                <IconButton
                    onClick={onClose}
                    aria-label={t('common.aria.close')}
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
                    <Typography variant="h6" fontWeight={700}>
                        <Face sx={{ fontSize: 22, mr: 1, verticalAlign: 'text-bottom' }} />
                        Face Verification
                    </Typography>
                </Box>

                {/* Camera / Result */}
                <Box
                    sx={{
                        position: 'relative',
                        mx: 3,
                        my: 1,
                        borderRadius: '16px',
                        overflow: 'hidden',
                        aspectRatio: '1/1',
                        bgcolor: '#1e293b',
                    }}
                >
                    <canvas ref={canvasRef} style={{ display: 'none' }} />

                    <AnimatePresence mode="wait">
                        {resultStage ? (
                            <motion.div
                                key="result"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.4, ease: 'easeOut' }}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: isSuccess
                                        ? 'radial-gradient(circle, rgba(34,197,94,0.15) 0%, transparent 70%)'
                                        : 'radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 70%)',
                                }}
                            >
                                <motion.div
                                    initial={{ scale: 0, rotate: -180 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
                                >
                                    {isSuccess ? (
                                        <CheckCircle sx={{ fontSize: 80, color: '#22c55e' }} />
                                    ) : (
                                        <ErrorOutline sx={{ fontSize: 80, color: '#ef4444' }} />
                                    )}
                                </motion.div>
                                <Typography variant="h6" sx={{ mt: 2, fontWeight: 600 }}>
                                    {isSuccess ? 'Identity Verified' : 'Verification Failed'}
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                                    {isSuccess
                                        ? 'Redirecting...'
                                        : 'Face not recognized. Please try again.'}
                                </Typography>
                            </motion.div>
                        ) : verifying ? (
                            <motion.div
                                key="verifying"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <CircularProgress size={56} sx={{ color: '#8b5cf6' }} />
                                <Typography variant="body1" sx={{ mt: 2, fontWeight: 500 }}>
                                    Verifying identity...
                                </Typography>
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
                                    progress={verificationState.progress}
                                    size={180}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Box>

                {/* Instruction / Actions */}
                <Box sx={{ textAlign: 'center', px: 3, pb: 3, pt: 1 }}>
                    {!resultStage && !verifying && (
                        <Typography
                            variant="body2"
                            sx={{
                                color: detection.centered
                                    ? '#22c55e'
                                    : 'rgba(255,255,255,0.6)',
                                fontWeight: detection.centered ? 600 : 400,
                                transition: 'color 0.2s ease',
                                mb: 1,
                            }}
                        >
                            {t(verificationState.instruction)}
                        </Typography>
                    )}

                    {verificationState.stage === 'failure' && (
                        <Button
                            variant="contained"
                            size="large"
                            onClick={handleRetry}
                            startIcon={<Replay />}
                            sx={{
                                mt: 1,
                                py: 1.2,
                                px: 4,
                                borderRadius: '12px',
                                fontWeight: 600,
                                background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                                '&:hover': {
                                    background: 'linear-gradient(135deg, #7c3aed 0%, #0891b2 100%)',
                                },
                            }}
                        >
                            Try Again
                        </Button>
                    )}
                </Box>
            </DialogContent>
        </Dialog>
    )
}
