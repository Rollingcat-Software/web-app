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
import { CameraAlt, CreditCard, Refresh } from '@mui/icons-material'
import { useCamera } from '@features/userEnrollment/hooks/useCamera'
import { useCardDetection } from '@hooks/useCardDetection'

/**
 * Card Detection Page
 *
 * Uses the server-side YOLO API to detect card types from camera images.
 * Provides camera preview, capture, and detection result display.
 */
export default function CardDetectionPage() {
    const { videoRef, stream, error: cameraError, requestAccess, captureFrame, stopCamera } = useCamera()
    const { detecting, result, error: detectError, detectCard, reset } = useCardDetection()
    const [capturedImage, setCapturedImage] = useState<string | null>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)

    const handleStartCamera = async () => {
        reset()
        setCapturedImage(null)
        await requestAccess()
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
        <Box sx={{ maxWidth: 800, mx: 'auto', py: 3 }}>
            <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CreditCard /> Card Detection
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Capture an image of an ID card, passport, or driver's license. The server-side YOLO model
                will detect and classify the card type.
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
                                    Click "Start Camera" to begin
                                </Typography>
                            </Box>
                        )}

                        {/* Captured image preview */}
                        {capturedImage && (
                            <Box sx={{ position: 'relative' }}>
                                <img
                                    src={capturedImage}
                                    alt="Captured card"
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
                                        <CircularProgress sx={{ color: 'white' }} />
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
                                Start Camera
                            </Button>
                        ) : (
                            <>
                                <Button
                                    variant="contained"
                                    onClick={handleCapture}
                                    disabled={detecting}
                                >
                                    Capture & Detect
                                </Button>
                                <Button
                                    variant="outlined"
                                    onClick={() => { stopCamera(); handleReset() }}
                                >
                                    Stop Camera
                                </Button>
                            </>
                        )}
                        {capturedImage && (
                            <Button
                                startIcon={<Refresh />}
                                onClick={handleReset}
                            >
                                Reset
                            </Button>
                        )}
                    </Box>
                </CardContent>
            </Card>

            {/* Detection result */}
            {result && (
                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>Detection Result</Typography>
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                            <Chip
                                label={result.detected ? 'Card Detected' : 'No Card Found'}
                                color={result.detected ? 'success' : 'default'}
                                size="medium"
                            />
                            {result.cardType && (
                                <Chip
                                    label={`Type: ${result.cardType}`}
                                    color="primary"
                                    variant="outlined"
                                />
                            )}
                            {result.confidence > 0 && (
                                <Chip
                                    label={`Confidence: ${(result.confidence * 100).toFixed(1)}%`}
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
