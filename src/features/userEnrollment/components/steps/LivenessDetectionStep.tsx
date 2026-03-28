import { useEffect } from 'react'
import { Box, Button, Typography, Alert, CircularProgress } from '@mui/material'
import { NavigateBefore, Videocam } from '@mui/icons-material'
import { useCamera } from '../../hooks/useCamera'
import { useLiveness } from '../../hooks/useLiveness'

interface LivenessDetectionStepProps {
    onComplete: (token: string, score: number, faceImage: Blob) => void
    onBack: () => void
}

export default function LivenessDetectionStep({ onComplete, onBack }: LivenessDetectionStepProps) {
    const { videoRef, hasPermission, requestAccess, captureFrame } = useCamera()
    const { challenge, result, loading, capturing, error, requestChallenge, performLiveness } =
        useLiveness()

    // Request camera and challenge on mount
    useEffect(() => {
        requestAccess()
        requestChallenge()
    }, [requestAccess, requestChallenge])

    const handleStartLiveness = async () => {
        // Verify camera is producing frames before starting
        const testFrame = captureFrame()
        if (!testFrame) {
            // Camera not ready — re-request access
            await requestAccess()
            // Small delay for video to initialize
            await new Promise((r) => setTimeout(r, 500))
        }

        const livenessResult = await performLiveness(captureFrame)
        if (livenessResult?.passed) {
            // Capture a high-quality face frame immediately after liveness success
            const face = captureFrame()
            if (face) {
                onComplete(livenessResult.token, livenessResult.score, face)
            } else {
                // Retry capture after short delay (mobile cameras may need time)
                await new Promise((r) => setTimeout(r, 300))
                const retryFace = captureFrame()
                if (retryFace) {
                    onComplete(livenessResult.token, livenessResult.score, retryFace)
                }
            }
        }
    }

    const isReady = hasPermission && challenge && !loading && !capturing

    return (
        <Box>
            <Typography variant="h6" gutterBottom>
                Liveness Detection
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Follow the instructions below while looking at the camera. This verifies that you
                are a real person.
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            {result && !result.passed && (
                <Alert severity="warning" sx={{ mb: 3 }}>
                    Liveness check did not pass. Please try again.
                </Alert>
            )}

            {result?.passed && (
                <Alert severity="success" sx={{ mb: 3 }}>
                    Liveness verification passed!
                </Alert>
            )}

            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 3,
                    my: 4,
                }}
            >
                <Box
                    sx={{
                        width: '100%',
                        maxWidth: 480,
                        aspectRatio: '4/3',
                        backgroundColor: 'grey.900',
                        borderRadius: 2,
                        overflow: 'hidden',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {capturing && (
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'rgba(0,0,0,0.3)',
                            }}
                        >
                            <CircularProgress sx={{ color: 'white', mb: 1 }} />
                            <Typography variant="body2" sx={{ color: 'white' }}>
                                Capturing...
                            </Typography>
                        </Box>
                    )}
                </Box>

                {challenge && (
                    <Alert severity="info" sx={{ width: '100%', maxWidth: 480 }}>
                        <Typography variant="body1" fontWeight={500}>
                            {challenge.instruction}
                        </Typography>
                    </Alert>
                )}

                {isReady && !result?.passed && (
                    <Button
                        variant="contained"
                        startIcon={<Videocam />}
                        onClick={handleStartLiveness}
                        size="large"
                        sx={{ minWidth: 200, py: 1.5 }}
                    >
                        Start Liveness Check
                    </Button>
                )}

                {(loading || capturing) && !result && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CircularProgress size={20} />
                        <Typography variant="body2" color="text.secondary">
                            {capturing ? 'Capturing frames...' : 'Verifying liveness...'}
                        </Typography>
                    </Box>
                )}
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                <Button
                    variant="outlined"
                    startIcon={<NavigateBefore />}
                    onClick={onBack}
                    size="large"
                    disabled={capturing || loading}
                >
                    Back
                </Button>
            </Box>
        </Box>
    )
}
