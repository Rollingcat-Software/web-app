import { Box, CircularProgress, Paper, Step, StepLabel, Stepper, Typography, useMediaQuery, useTheme } from '@mui/material'
import { useUserEnrollment, EnrollmentStep } from '../hooks/useUserEnrollment'
import IdInfoStep from './steps/IdInfoStep'
import CameraAccessStep from './steps/CameraAccessStep'
import LivenessDetectionStep from './steps/LivenessDetectionStep'
import EnrollmentComplete from './steps/EnrollmentComplete'

const stepLabels = ['Identity Information', 'Camera Access', 'Liveness Detection']

export default function UserEnrollmentPage() {
    const theme = useTheme()
    const isMobile = useMediaQuery(theme.breakpoints.down('md'))

    const {
        currentStep,
        idInfo,
        enrollmentStatus,
        submitting,
        submittingPhase,
        error,
        loading,
        nextStep,
        prevStep,
        setIdInfo,
        submitEnrollment,
        refreshStatus,
    } = useUserEnrollment()

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
            </Box>
        )
    }

    const handleIdInfoNext = (data: NonNullable<typeof idInfo>) => {
        setIdInfo(data)
        nextStep()
    }

    const handleLivenessComplete = async (token: string, score: number, faceImage: Blob) => {
        await submitEnrollment({
            livenessToken: token,
            livenessScore: score,
            faceImage,
        })
    }

    // Show completion view if already enrolled or currently submitting
    if (currentStep === EnrollmentStep.COMPLETE || submitting) {
        return (
            <Box sx={{ maxWidth: 800, mx: 'auto', px: { xs: 2, sm: 3 } }}>
                <Typography variant="h4" gutterBottom fontWeight={600}>
                    Enrollment
                </Typography>
                <Paper sx={{ p: { xs: 3, sm: 4 }, mt: 3 }}>
                    <EnrollmentComplete
                        status={enrollmentStatus}
                        submitting={submitting}
                        submittingPhase={submittingPhase}
                        error={error}
                        onRefresh={refreshStatus}
                    />
                </Paper>
            </Box>
        )
    }

    return (
        <Box sx={{ maxWidth: 800, mx: 'auto', px: { xs: 2, sm: 3 } }}>
            <Typography variant="h4" gutterBottom fontWeight={600}>
                Enrollment
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                Complete the following steps to verify your identity and activate your account.
            </Typography>

            <Stepper
                activeStep={currentStep}
                orientation={isMobile ? 'vertical' : 'horizontal'}
                sx={{ mb: 4 }}
            >
                {stepLabels.map((label) => (
                    <Step key={label}>
                        <StepLabel>{label}</StepLabel>
                    </Step>
                ))}
            </Stepper>

            <Paper sx={{ p: { xs: 3, sm: 4 } }}>
                {currentStep === EnrollmentStep.ID_INFO && (
                    <IdInfoStep defaultValues={idInfo} onNext={handleIdInfoNext} />
                )}
                {currentStep === EnrollmentStep.CAMERA_ACCESS && (
                    <CameraAccessStep onNext={nextStep} onBack={prevStep} />
                )}
                {currentStep === EnrollmentStep.LIVENESS && (
                    <LivenessDetectionStep onComplete={handleLivenessComplete} onBack={prevStep} />
                )}
            </Paper>
        </Box>
    )
}
