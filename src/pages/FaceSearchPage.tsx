import { useState } from 'react'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    List,
    ListItem,
    ListItemText,
    Typography,
} from '@mui/material'
import { CameraAlt, Face, PersonSearch, Refresh } from '@mui/icons-material'
import { useCamera } from '@features/userEnrollment/hooks/useCamera'
import { useFaceSearch } from '@hooks/useFaceSearch'

/**
 * Face Search Page ("Who Is This?")
 *
 * Captures a face from camera and searches the enrolled face database
 * for matching users (1:N identification).
 */
export default function FaceSearchPage() {
    const { videoRef, stream, error: cameraError, requestAccess, captureFrame, stopCamera } = useCamera()
    const { searching, result, error: searchError, searchFace, reset } = useFaceSearch()
    const [capturedImage, setCapturedImage] = useState<string | null>(null)

    const handleStartCamera = async () => {
        reset()
        setCapturedImage(null)
        await requestAccess()
    }

    const handleCaptureAndSearch = async () => {
        const blob = captureFrame()
        if (!blob) return

        // Show preview
        const url = URL.createObjectURL(blob)
        setCapturedImage(url)

        // Convert blob to base64
        const reader = new FileReader()
        reader.onloadend = async () => {
            const base64 = reader.result as string
            await searchFace(base64)
        }
        reader.readAsDataURL(blob)
    }

    const handleReset = () => {
        reset()
        setCapturedImage(null)
    }

    return (
        <Box sx={{ maxWidth: 800, mx: 'auto', py: 3 }}>
            <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonSearch /> Face Search
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Capture a face to search the enrolled database. The system will identify
                matching users using 1:N face recognition.
            </Typography>

            {cameraError && (
                <Alert severity="error" sx={{ mb: 2 }}>{cameraError}</Alert>
            )}
            {searchError && (
                <Alert severity="error" sx={{ mb: 2 }}>{searchError}</Alert>
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

                        {capturedImage && (
                            <Box sx={{ position: 'relative' }}>
                                <img
                                    src={capturedImage}
                                    alt="Captured face"
                                    style={{
                                        width: '100%',
                                        maxHeight: 400,
                                        objectFit: 'contain',
                                        borderRadius: 8,
                                    }}
                                />
                                {searching && (
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
                                    startIcon={<Face />}
                                    onClick={handleCaptureAndSearch}
                                    disabled={searching}
                                >
                                    Who Is This?
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

            {/* Search results */}
            {result && (
                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>Search Results</Typography>
                        <Box sx={{ mb: 2 }}>
                            <Chip
                                label={result.found ? 'Match Found' : 'No Match'}
                                color={result.found ? 'success' : 'warning'}
                                size="medium"
                            />
                        </Box>

                        {result.found && result.results.length > 0 ? (
                            <List disablePadding>
                                {result.results.map((match, idx) => (
                                    <ListItem key={idx} divider sx={{ px: 0 }}>
                                        <ListItemText
                                            primary={
                                                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                                    <Typography variant="body1">
                                                        User ID: {match.userId}
                                                    </Typography>
                                                    {idx === 0 && (
                                                        <Chip label="Best Match" size="small" color="primary" />
                                                    )}
                                                </Box>
                                            }
                                            secondary={
                                                `Confidence: ${(match.confidence * 100).toFixed(1)}% | Distance: ${match.distance.toFixed(4)}`
                                            }
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        ) : (
                            <Typography variant="body2" color="text.secondary">
                                No matching faces found in the enrolled database.
                            </Typography>
                        )}
                    </CardContent>
                </Card>
            )}
        </Box>
    )
}
