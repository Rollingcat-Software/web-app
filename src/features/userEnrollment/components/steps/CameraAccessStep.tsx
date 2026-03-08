import { Box, Button, Typography, Alert } from '@mui/material'
import { CameraAlt, NavigateBefore, NavigateNext } from '@mui/icons-material'
import { useCamera } from '../../hooks/useCamera'

interface CameraAccessStepProps {
    onNext: () => void
    onBack: () => void
}

export default function CameraAccessStep({ onNext, onBack }: CameraAccessStepProps) {
    const { videoRef, hasPermission, error, requestAccess } = useCamera()

    const handleRequestAccess = async () => {
        const granted = await requestAccess()
        if (granted) {
            onNext()
        }
    }

    return (
        <Box>
            <Typography variant="h6" gutterBottom>
                Camera Access
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                We need access to your camera to perform liveness detection. Please allow camera
                access when prompted.
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            {hasPermission === true && (
                <Alert severity="success" sx={{ mb: 3 }}>
                    Camera access granted successfully.
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
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    {hasPermission ? (
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    ) : (
                        <CameraAlt sx={{ fontSize: 64, color: 'grey.600' }} />
                    )}
                </Box>

                {!hasPermission && (
                    <Button
                        variant="contained"
                        startIcon={<CameraAlt />}
                        onClick={handleRequestAccess}
                        size="large"
                        sx={{ minWidth: 200, py: 1.5 }}
                    >
                        Allow Camera Access
                    </Button>
                )}
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                <Button
                    variant="outlined"
                    startIcon={<NavigateBefore />}
                    onClick={onBack}
                    size="large"
                >
                    Back
                </Button>
                {hasPermission && (
                    <Button
                        variant="contained"
                        endIcon={<NavigateNext />}
                        onClick={onNext}
                        size="large"
                    >
                        Next
                    </Button>
                )}
            </Box>
        </Box>
    )
}
