import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Step,
    StepLabel,
    Stepper,
    Typography,
} from '@mui/material'
import {
    ArrowBack,
    CheckCircle,
    Cancel,
    HourglassEmpty,
    SkipNext,
    VerifiedUser,
} from '@mui/icons-material'
import { motion, Variants } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useVerification } from '@hooks/useVerification'

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1, delayChildren: 0.1 },
    },
}

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

const statusChipColor = (status: string): 'success' | 'warning' | 'info' | 'error' | 'default' => {
    if (status === 'completed') return 'success'
    if (status === 'failed') return 'error'
    if (status === 'in_progress') return 'info'
    if (status === 'pending') return 'warning'
    if (status === 'skipped') return 'default'
    return 'default'
}

const stepStatusIcon = (status: string) => {
    if (status === 'completed') return <CheckCircle color="success" />
    if (status === 'failed') return <Cancel color="error" />
    if (status === 'skipped') return <SkipNext color="disabled" />
    return <HourglassEmpty color="warning" />
}

const verificationLevelColor = (level?: string): 'success' | 'warning' | 'info' | 'default' => {
    if (level === 'full') return 'success'
    if (level === 'enhanced') return 'info'
    if (level === 'basic') return 'warning'
    return 'default'
}

export default function VerificationSessionDetailPage() {
    const { t } = useTranslation()
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { currentSession, loading, error, loadSession, clearError } = useVerification()

    useEffect(() => {
        if (id) {
            loadSession(id)
        }
    }, [id, loadSession])

    if (loading && !currentSession) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                <CircularProgress />
            </Box>
        )
    }

    if (!currentSession && !loading) {
        return (
            <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">
                    {t('verification.sessionNotFound')}
                </Typography>
                <Button
                    startIcon={<ArrowBack />}
                    onClick={() => navigate('/verification-dashboard')}
                    sx={{ mt: 2 }}
                >
                    {t('common.back')}
                </Button>
            </Box>
        )
    }

    const activeStepIndex = currentSession
        ? currentSession.steps.findIndex(s => s.status === 'pending' || s.status === 'failed')
        : 0
    const effectiveActiveStep = activeStepIndex === -1
        ? (currentSession?.steps.length ?? 0)
        : activeStepIndex

    return (
        <motion.div initial="hidden" animate="visible" variants={containerVariants}>
            <Box>
                <motion.div variants={itemVariants}>
                    <Box sx={{ mb: 4 }}>
                        <Button
                            startIcon={<ArrowBack />}
                            onClick={() => navigate('/verification-dashboard')}
                            sx={{ mb: 2 }}
                        >
                            {t('verification.backToDashboard')}
                        </Button>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <VerifiedUser sx={{ color: 'primary.main', fontSize: 32 }} />
                            <Typography
                                variant="h4"
                                sx={{
                                    fontWeight: 700,
                                    background: 'linear-gradient(135deg, #1e293b 0%, #475569 100%)',
                                    backgroundClip: 'text',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                }}
                            >
                                {t('verification.sessionDetailTitle')}
                            </Typography>
                        </Box>
                        <Typography variant="body1" color="text.secondary">
                            {t('verification.sessionDetailSubtitle')}
                        </Typography>
                    </Box>
                </motion.div>

                {error && (
                    <Alert severity="error" onClose={clearError} sx={{ mb: 3 }}>
                        {error}
                    </Alert>
                )}

                {currentSession && (
                    <>
                        {/* Session overview card */}
                        <motion.div variants={itemVariants}>
                            <Card sx={{ mb: 3 }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">
                                                {t('verification.sessionId')}
                                            </Typography>
                                            <Typography variant="body2" fontFamily="monospace">
                                                {currentSession.id}
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">
                                                {t('verification.flow')}
                                            </Typography>
                                            <Typography variant="body2" fontWeight={500}>
                                                {currentSession.flowName}
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">
                                                {t('common.status')}
                                            </Typography>
                                            <Box sx={{ mt: 0.5 }}>
                                                <Chip
                                                    label={currentSession.status.replace(/_/g, ' ')}
                                                    size="small"
                                                    color={statusChipColor(currentSession.status)}
                                                />
                                            </Box>
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">
                                                {t('verification.progress')}
                                            </Typography>
                                            <Typography variant="body2">
                                                {currentSession.currentStep}/{currentSession.totalSteps}
                                            </Typography>
                                        </Box>
                                        {currentSession.verificationLevel && (
                                            <Box>
                                                <Typography variant="caption" color="text.secondary">
                                                    {t('verification.verificationLevel')}
                                                </Typography>
                                                <Box sx={{ mt: 0.5 }}>
                                                    <Chip
                                                        label={currentSession.verificationLevel.toUpperCase()}
                                                        size="small"
                                                        color={verificationLevelColor(currentSession.verificationLevel)}
                                                        variant="outlined"
                                                    />
                                                </Box>
                                            </Box>
                                        )}
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">
                                                {t('verification.startedAt')}
                                            </Typography>
                                            <Typography variant="body2">
                                                {new Date(currentSession.startedAt).toLocaleString()}
                                            </Typography>
                                        </Box>
                                        {currentSession.completedAt && (
                                            <Box>
                                                <Typography variant="caption" color="text.secondary">
                                                    {t('verification.completedAt')}
                                                </Typography>
                                                <Typography variant="body2">
                                                    {new Date(currentSession.completedAt).toLocaleString()}
                                                </Typography>
                                            </Box>
                                        )}
                                    </Box>
                                </CardContent>
                            </Card>
                        </motion.div>

                        {/* Step-by-step progress */}
                        <motion.div variants={itemVariants}>
                            <Card sx={{ mb: 3 }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Typography variant="h6" fontWeight={600} sx={{ mb: 3 }}>
                                        {t('verification.stepProgress')}
                                    </Typography>

                                    <Stepper
                                        activeStep={effectiveActiveStep}
                                        orientation="vertical"
                                    >
                                        {currentSession.steps.map((step) => (
                                            <Step key={step.stepOrder} completed={step.status === 'completed'}>
                                                <StepLabel
                                                    icon={stepStatusIcon(step.status)}
                                                    optional={
                                                        <Typography variant="caption" color="text.secondary">
                                                            {step.stepType.replace(/_/g, ' ')}
                                                        </Typography>
                                                    }
                                                >
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                                        <Typography fontWeight={500}>
                                                            {t('verification.step')} {step.stepOrder}
                                                        </Typography>
                                                        <Chip
                                                            label={step.status}
                                                            size="small"
                                                            color={statusChipColor(step.status)}
                                                        />
                                                        {step.confidenceScore != null && (
                                                            <Chip
                                                                label={`${t('common.confidence')}: ${step.confidenceScore.toFixed(1)}%`}
                                                                size="small"
                                                                variant="outlined"
                                                            />
                                                        )}
                                                    </Box>
                                                    {step.completedAt && (
                                                        <Typography variant="caption" color="text.secondary">
                                                            {new Date(step.completedAt).toLocaleString()}
                                                        </Typography>
                                                    )}
                                                    {step.failureReason && (
                                                        <Typography variant="caption" color="error">
                                                            {step.failureReason}
                                                        </Typography>
                                                    )}
                                                </StepLabel>
                                            </Step>
                                        ))}
                                    </Stepper>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </>
                )}
            </Box>
        </motion.div>
    )
}
