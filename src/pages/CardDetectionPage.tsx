import { useRef, useState } from 'react'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Typography,
} from '@mui/material'
import { CameraAlt, CameraswitchOutlined, CreditCard, Refresh } from '@mui/icons-material'
import { useCamera } from '@features/userEnrollment/hooks/useCamera'
import { useCardDetection } from '@hooks/useCardDetection'
import { useTranslation } from 'react-i18next'

/**
 * Card Detection Page
 *
 * Uses the server-side YOLO API to detect card types from camera images.
 * Provides camera preview, capture, and detection result display.
 */
export default function CardDetectionPage() {
    const { videoRef, stream, error: cameraError, requestAccess, captureFrame, stopCamera, flipCamera } = useCamera()
    const { detecting, result, error: detectError, detectCard, reset } = useCardDetection()
    const [capturedImage, setCapturedImage] = useState<string | null>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const { t } = useTranslation()

    const handleStartCamera = async () => {
        reset()
        setCapturedImage(null)
        await requestAccess('environment') // rear camera for card scanning
    }

    const handleCapture = async () => {
        const blob = captureFrame()
        if (!blob) return

        // Show preview
        const url = URL.createObjectURL(blob)
        setCapturedImage(url)

        // Send to detection API
        await detectCard(blob)
    }

    const handleReset = () => {
        reset()
        setCapturedImage(null)
    }

    return (
        <Box sx={{ maxWidth: { xs: '100%', sm: 800 }, mx: 'auto', py: { xs: 1, sm: 3 }, px: { xs: 1, sm: 0 }, overflowX: 'hidden', boxSizing: 'border-box' }}>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', wordBreak: 'break-word' }}>
                <CreditCard /> {t('cardDetection.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                {t('cardDetection.subtitle')}
            </Typography>

            {cameraError && (
                <Alert severity="error" sx={{ mb: 2 }}>{cameraError}</Alert>
            )}
            {detectError && (
                <Alert severity="error" sx={{ mb: 2 }}>{detectError}</Alert>
            )}

            <Card sx={{ mb: 3 }}>
                <CardContent>
                    {/* Camera preview */}
                    <Box sx={{ position: 'relative', mb: 2 }}>
                        <video
                            ref={videoRef as React.RefObject<HTMLVideoElement>}
                            autoPlay
                            playsInline
                            muted
                            aria-label={t('cardDetection.title')}
                            style={{
                                width: '100%',
                                maxHeight: 400,
                                borderRadius: 8,
                                background: '#000',
                                display: stream ? 'block' : 'none',
                            }}
                        />
                        {!stream && !capturedImage && (
                            <Box sx={{
                                height: 300,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: 'grey.100',
                                borderRadius: 2,
                            }}>
                                <Typography color="text.secondary">
                                    {t('common.startCameraPrompt')}
                                </Typography>
                            </Box>
                        )}

                        {/* Captured image preview */}
                        {capturedImage && (
                            <Box sx={{ position: 'relative' }}>
                                <img
                                    src={capturedImage}
                                    alt={t('cardDetection.title')}
                                    style={{
                                        width: '100%',
                                        maxHeight: 400,
                                        objectFit: 'contain',
                                        borderRadius: 8,
                                    }}
                                />
                                {detecting && (
                                    <Box sx={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        bgcolor: 'rgba(0,0,0,0.4)',
                                        borderRadius: 2,
                                    }}>
                                        <CircularProgress sx={{ color: 'white' }} aria-label={t('common.loading')} />
                                    </Box>
                                )}
                            </Box>
                        )}
                    </Box>
                    <canvas ref={canvasRef} style={{ display: 'none' }} />

                    {/* Controls */}
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {!stream ? (
                            <Button
                                variant="contained"
                                startIcon={<CameraAlt />}
                                onClick={handleStartCamera}
                            >
                                {t('common.startCamera')}
                            </Button>
                        ) : (
                            <>
                                <Button
                                    variant="contained"
                                    onClick={handleCapture}
                                    disabled={detecting}
                                >
                                    {t('common.captureAndDetect')}
                                </Button>
                                <Button
                                    variant="outlined"
                                    startIcon={<CameraswitchOutlined />}
                                    onClick={flipCamera}
                                >
                                    {t('common.flip')}
                                </Button>
                                <Button
                                    variant="outlined"
                                    onClick={() => { stopCamera(); handleReset() }}
                                >
                                    {t('common.stopCamera')}
                                </Button>
                            </>
                        )}
                        {capturedImage && (
                            <Button
                                startIcon={<Refresh />}
                                onClick={handleReset}
                            >
                                {t('common.reset')}
                            </Button>
                        )}
                    </Box>
                </CardContent>
            </Card>

            {/* Detection result */}
            {result && (
                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>{t('cardDetection.detectionResult')}</Typography>
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                            <Chip
                                label={result.detected ? t('cardDetection.cardDetected') : t('cardDetection.noCardFound')}
                                color={result.detected ? 'success' : 'default'}
                                size="medium"
                            />
                            {result.cardType && (
                                <Chip
                                    label={t('cardDetection.type', { type: result.cardType })}
                                    color="primary"
                                    variant="outlined"
                                />
                            )}
                            {result.confidence > 0 && (
                                <Chip
                                    label={t('cardDetection.confidenceValue', { value: (result.confidence * 100).toFixed(1) })}
                                    variant="outlined"
                                />
                            )}
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {result.message}
                        </Typography>
                    </CardContent>
                </Card>
            )}
        </Box>
    )
}
