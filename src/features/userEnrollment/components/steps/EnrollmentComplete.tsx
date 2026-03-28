import { useEffect } from 'react'
import { Box, Typography, CircularProgress, Alert, Button, Chip } from '@mui/material'
import { CheckCircle, Error as ErrorIcon, HourglassTop, Refresh } from '@mui/icons-material'
import { UserEnrollmentStatus } from '@domain/models/UserEnrollment'
import type { UserEnrollmentStatusResponse } from '@domain/models/UserEnrollment'
import type { SubmittingPhase } from '../../hooks/useUserEnrollment'

interface EnrollmentCompleteProps {
    status: UserEnrollmentStatusResponse | null
    submitting: boolean
    submittingPhase: SubmittingPhase
    error: string | null
    onRefresh: () => void
}

const phaseMessages: Record<string, { title: string; subtitle: string }> = {
    processing_biometrics: {
        title: 'Processing Biometrics...',
        subtitle: 'Extracting biometric data from your face capture.',
    },
    syncing: {
        title: 'Syncing with Server...',
        subtitle: 'Uploading your enrollment data securely.',
    },
}

export default function EnrollmentComplete({
    status,
    submitting,
    submittingPhase,
    error,
    onRefresh,
}: EnrollmentCompleteProps) {
    // Poll for status updates when processing
    useEffect(() => {
        if (status?.status !== UserEnrollmentStatus.PROCESSING) return

        const interval = setInterval(onRefresh, 3000)
        return () => clearInterval(interval)
    }, [status?.status, onRefresh])

    if (submitting) {
        const phase = submittingPhase && phaseMessages[submittingPhase]
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6 }}>
                <CircularProgress size={48} sx={{ mb: 3 }} />
                <Typography variant="h6">
                    {phase?.title ?? 'Submitting Enrollment...'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center', maxWidth: 400 }}>
                    {phase?.subtitle ?? 'Please wait while we process your enrollment.'}
                </Typography>
            </Box>
        )
    }

    if (error) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6 }}>
                <ErrorIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
                <Typography variant="h6" color="error.main" gutterBottom>
                    Enrollment Failed
                </Typography>
                <Alert severity="error" sx={{ mb: 3, maxWidth: 480 }}>
                    {error}
                </Alert>
            </Box>
        )
    }

    if (!status) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
            </Box>
        )
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6 }}>
            {status.status === UserEnrollmentStatus.COMPLETED && (
                <>
                    <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                    <Typography variant="h5" fontWeight={600} gutterBottom>
                        Enrollment Complete
                    </Typography>
                    <Typography
                        variant="body1"
                        color="text.secondary"
                        sx={{ mb: 4, textAlign: 'center', maxWidth: 480 }}
                    >
                        Your biometric enrollment has been processed successfully. Your account
                        will be activated shortly.
                    </Typography>
                </>
            )}

            {status.status === UserEnrollmentStatus.PROCESSING && (
                <>
                    <HourglassTop sx={{ fontSize: 64, color: 'warning.main', mb: 2 }} />
                    <Typography variant="h5" fontWeight={600} gutterBottom>
                        Processing Enrollment
                    </Typography>
                    <Typography
                        variant="body1"
                        color="text.secondary"
                        sx={{ mb: 4, textAlign: 'center', maxWidth: 480 }}
                    >
                        Your enrollment is being processed. This may take a few moments.
                    </Typography>
                    <CircularProgress size={24} sx={{ mb: 2 }} />
                </>
            )}

            {status.status === UserEnrollmentStatus.FAILED && (
                <>
                    <ErrorIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
                    <Typography variant="h5" fontWeight={600} gutterBottom>
                        Enrollment Failed
                    </Typography>
                    <Typography
                        variant="body1"
                        color="text.secondary"
                        sx={{ mb: 4, textAlign: 'center', maxWidth: 480 }}
                    >
                        {status.errorMessage ||
                            'Your enrollment could not be processed. Please contact support.'}
                    </Typography>
                </>
            )}

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                {status.qualityScore !== undefined && (
                    <Chip
                        label={`Quality: ${Math.round(status.qualityScore > 1 ? status.qualityScore : status.qualityScore * 100)}%`}
                        color={(status.qualityScore > 1 ? status.qualityScore : status.qualityScore * 100) >= 70 ? 'success' : 'warning'}
                        variant="outlined"
                    />
                )}
                {status.livenessScore !== undefined && (
                    <Chip
                        label={`Liveness: ${Math.round(status.livenessScore > 1 ? status.livenessScore : status.livenessScore * 100)}%`}
                        color={(status.livenessScore > 1 ? status.livenessScore : status.livenessScore * 100) >= 70 ? 'success' : 'warning'}
                        variant="outlined"
                    />
                )}
            </Box>

            {status.status === UserEnrollmentStatus.PROCESSING && (
                <Button
                    startIcon={<Refresh />}
                    onClick={onRefresh}
                    sx={{ mt: 3 }}
                >
                    Refresh Status
                </Button>
            )}
        </Box>
    )
}
