import { useState, useCallback, useMemo, useEffect } from 'react'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Typography,
} from '@mui/material'
import { Close, SkipNext } from '@mui/icons-material'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useService } from '@app/providers/DependencyProvider'
import { TYPES } from '@core/di/types'
import { AuthSessionRepository, type StepResultResponse } from '@core/repositories/AuthSessionRepository'
import StepProgress from './StepProgress'
import type { StepStatus } from './StepProgress'
import PasswordStep from './steps/PasswordStep'
import EmailOtpStep from './steps/EmailOtpStep'
import SmsOtpStep from './steps/SmsOtpStep'
import TotpStep from './steps/TotpStep'
import QrCodeStep from './steps/QrCodeStep'
import FaceCaptureStep from './steps/FaceCaptureStep'
import FingerprintStep from './steps/FingerprintStep'
import VoiceStep from './steps/VoiceStep'
import HardwareKeyStep from './steps/HardwareKeyStep'
import NfcStep from './steps/NfcStep'

const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

interface AuthFlowStep {
    stepOrder: number
    methodType: string
    status: string
    isRequired?: boolean
}

interface MultiStepAuthFlowProps {
    sessionId: string
    steps: AuthFlowStep[]
    onComplete: (result: { accessToken: string; userId: string }) => void
    onCancel: () => void
    onStepChange?: (stepIndex: number, methodType: string, totalSteps: number) => void
}

/**
 * Map backend step statuses to StepProgress display statuses
 */
function mapStepStatus(status: string): StepStatus {
    switch (status) {
        case 'COMPLETED':
            return 'completed'
        case 'IN_PROGRESS':
            return 'in_progress'
        case 'FAILED':
            return 'failed'
        case 'SKIPPED':
            return 'skipped'
        default:
            return 'pending'
    }
}

/**
 * MultiStepAuthFlow
 * Main controller component that orchestrates multi-step authentication.
 * Renders a stepper at the top, shows the current step component based on methodType,
 * and handles step progression via AuthSessionRepository.
 */
export default function MultiStepAuthFlow({
    sessionId,
    steps: initialSteps,
    onComplete,
    onCancel,
    onStepChange,
}: MultiStepAuthFlowProps) {
    const authSessionRepo = useService<AuthSessionRepository>(TYPES.AuthSessionRepository)
    const { t } = useTranslation()

    const [steps, setSteps] = useState<AuthFlowStep[]>(initialSteps)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | undefined>(undefined)
    const [flowComplete, setFlowComplete] = useState(false)
    const [sessionUserId, setSessionUserId] = useState<string>('')

    useEffect(() => {
        let isMounted = true

        authSessionRepo
            .getSession(sessionId)
            .then((session) => {
                if (!isMounted) {
                    return
                }
                setSessionUserId(session.userId)
            })
            .catch((e) => {
                // Session may have expired; QR step can still use manual token entry.
                // Log so a real failure (network, server 5xx) doesn't silently disappear.
                console.error('MultiStepAuthFlow: failed to fetch session', e)
            })

        return () => {
            isMounted = false
        }
    }, [authSessionRepo, sessionId])

    /**
     * Determine the active step index based on step statuses.
     * The active step is the first one that is not completed, skipped, or failed.
     */
    const activeStepIndex = useMemo(() => {
        const idx = steps.findIndex(
            (s) => s.status !== 'COMPLETED' && s.status !== 'SKIPPED' && s.status !== 'FAILED'
        )
        return idx === -1 ? steps.length : idx
    }, [steps])

    const currentStep = steps[activeStepIndex] ?? null

    // Notify parent (postMessage bridge) when the active step changes
    useEffect(() => {
        if (onStepChange && currentStep && !flowComplete) {
            onStepChange(activeStepIndex, currentStep.methodType, steps.length)
        }
    }, [activeStepIndex, currentStep, flowComplete, steps.length, onStepChange])

    /**
     * Process the result of completing or skipping a step.
     * Updates local step statuses and handles session completion.
     */
    const processStepResult = useCallback(
        (result: StepResultResponse) => {
            setSteps((prev) =>
                prev.map((s) => {
                    if (s.stepOrder === result.stepOrder) {
                        return { ...s, status: result.status }
                    }
                    return s
                })
            )

            if (result.sessionCompleted) {
                setFlowComplete(true)
                // Fetch final session to get tokens
                authSessionRepo
                    .getSession(sessionId)
                    .then((session) => {
                        onComplete({
                            accessToken: session.sessionId, // The backend returns tokens via a separate endpoint
                            userId: session.userId,
                        })
                    })
                    .catch(() => {
                        onComplete({
                            accessToken: sessionId,
                            userId: '',
                        })
                    })
            }
        },
        [authSessionRepo, sessionId, onComplete]
    )

    /**
     * Complete the current step with the given data
     */
    const handleStepSubmit = useCallback(
        async (data: Record<string, unknown>) => {
            if (!currentStep) return

            setLoading(true)
            setError(undefined)

            try {
                const result = await authSessionRepo.completeStep(
                    sessionId,
                    currentStep.stepOrder,
                    data
                )

                if (result.status === 'FAILED') {
                    setError(t('widget.verificationFailed'))
                } else {
                    processStepResult(result)
                }
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : t('widget.unexpectedError')
                setError(message)
            } finally {
                setLoading(false)
            }
        },
        [currentStep, authSessionRepo, sessionId, processStepResult, t]
    )

    /**
     * Skip the current step (only for optional steps)
     */
    const handleSkipStep = useCallback(async () => {
        if (!currentStep) return

        setLoading(true)
        setError(undefined)

        try {
            const result = await authSessionRepo.skipStep(sessionId, currentStep.stepOrder)
            processStepResult(result)
        } catch (err) {
            const message =
                err instanceof Error ? err.message : t('widget.skipFailed')
            setError(message)
        } finally {
            setLoading(false)
        }
    }, [currentStep, authSessionRepo, sessionId, processStepResult, t])

    const handleGenerateQrToken = useCallback(
        async (userId: string) => authSessionRepo.generateQrToken(userId),
        [authSessionRepo]
    )

    const handleInvalidateQrToken = useCallback(
        async (token: string) => authSessionRepo.invalidateQrToken(token),
        [authSessionRepo]
    )

    /**
     * Cancel the entire auth flow
     */
    const handleCancel = useCallback(async () => {
        try {
            await authSessionRepo.cancelSession(sessionId)
        } catch {
            // Best-effort cancellation
        }
        onCancel()
    }, [authSessionRepo, sessionId, onCancel])

    /**
     * Build stepper display data from steps
     */
    const progressSteps = useMemo(
        () =>
            steps.map((s) => ({
                label: s.methodType,
                status: mapStepStatus(s.status),
                methodType: s.methodType,
            })),
        [steps]
    )

    /**
     * Render the correct step component based on the current method type
     */
    const renderCurrentStep = () => {
        if (flowComplete) {
            return (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, ease: easeOut }}
                >
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Box
                            sx={{
                                width: 80,
                                height: 80,
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                mx: 'auto',
                                mb: 3,
                                boxShadow: '0 12px 40px rgba(16, 185, 129, 0.4)',
                            }}
                        >
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                            >
                                <Typography sx={{ color: 'white', fontSize: 40 }}>
                                    &#10003;
                                </Typography>
                            </motion.div>
                        </Box>
                        <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
                            {t('widget.authComplete')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {t('widget.allStepsCompleted')}
                        </Typography>
                    </Box>
                </motion.div>
            )
        }

        if (!currentStep) {
            return (
                <Alert severity="info" sx={{ borderRadius: '12px' }}>
                    {t('widget.noStepsRemaining')}
                </Alert>
            )
        }

        const methodType = currentStep.methodType

        switch (methodType) {
            case 'PASSWORD':
                return (
                    <PasswordStep
                        onSubmit={(data) =>
                            handleStepSubmit({ email: data.email, password: data.password })
                        }
                        loading={loading}
                        error={error}
                    />
                )

            case 'EMAIL_OTP':
                return (
                    <EmailOtpStep
                        onSubmit={(code) => handleStepSubmit({ code })}
                        onSendOtp={() =>
                            handleStepSubmit({ action: 'send_otp' }).catch(() => {
                                /* send OTP is fire-and-forget */
                            })
                        }
                        loading={loading}
                        error={error}
                    />
                )

            case 'SMS_OTP':
                return (
                    <SmsOtpStep
                        onSubmit={(code) => handleStepSubmit({ code })}
                        onSendOtp={() =>
                            handleStepSubmit({ action: 'send_otp' }).catch(() => {
                                /* send OTP is fire-and-forget */
                            })
                        }
                        loading={loading}
                        error={error}
                    />
                )

            case 'TOTP':
                return (
                    <TotpStep
                        onSubmit={(code) => handleStepSubmit({ code })}
                        loading={loading}
                        error={error}
                    />
                )

            case 'QR_CODE':
                return (
                    <QrCodeStep
                        userId={sessionUserId || undefined}
                        onGenerateToken={handleGenerateQrToken}
                        onInvalidateToken={handleInvalidateQrToken}
                        onSubmit={(token) => handleStepSubmit({ token })}
                        loading={loading}
                        error={error}
                    />
                )

            case 'FACE':
                return (
                    <FaceCaptureStep
                        onSubmit={(image, clientEmbedding) => handleStepSubmit({ image, ...(clientEmbedding ? { clientEmbedding } : {}) })}
                        loading={loading}
                        error={error}
                    />
                )

            case 'FINGERPRINT':
                return (
                    <FingerprintStep
                        onRequestChallenge={async () => {
                            const result = await authSessionRepo.completeStep(
                                sessionId,
                                currentStep.stepOrder,
                                { action: 'challenge' }
                            )
                            const data = result.data
                            if (data && typeof data.challenge === 'string') {
                                return {
                                    challenge: data.challenge,
                                    rpId: typeof data.rpId === 'string' ? data.rpId : undefined,
                                    timeout: typeof data.timeout === 'string' ? data.timeout : undefined,
                                    allowCredentials: Array.isArray(data.allowCredentials) ? data.allowCredentials as string[] : undefined,
                                }
                            }
                            return null
                        }}
                        onSubmit={(data) => handleStepSubmit({ assertion: data })}
                        loading={loading}
                        error={error}
                    />
                )

            case 'VOICE':
                return (
                    <VoiceStep
                        onSubmit={(voiceData) => handleStepSubmit({ voiceData })}
                        loading={loading}
                        error={error}
                    />
                )

            case 'HARDWARE_KEY':
                return (
                    <HardwareKeyStep
                        onRequestChallenge={async () => {
                            const result = await authSessionRepo.completeStep(
                                sessionId,
                                currentStep.stepOrder,
                                { action: 'challenge' }
                            )
                            const data = result.data
                            if (data && typeof data.challenge === 'string') {
                                return {
                                    challenge: data.challenge,
                                    rpId: typeof data.rpId === 'string' ? data.rpId : undefined,
                                    timeout: typeof data.timeout === 'string' ? data.timeout : undefined,
                                }
                            }
                            return null
                        }}
                        onSubmit={(data) => handleStepSubmit({ assertion: data })}
                        loading={loading}
                        error={error}
                    />
                )

            case 'NFC_DOCUMENT':
                return (
                    <NfcStep
                        onSubmit={(data) => handleStepSubmit({ nfcData: data })}
                        loading={loading}
                        error={error}
                    />
                )

            default:
                return (
                    <Alert severity="warning" sx={{ borderRadius: '12px' }}>
                        {t('widget.unknownMethod', { method: methodType })}
                    </Alert>
                )
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeOut }}
        >
            <Card
                sx={{
                    maxWidth: 520,
                    mx: 'auto',
                    borderRadius: '24px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
                    border: '1px solid',
                    borderColor: 'divider',
                    overflow: 'visible',
                }}
            >
                <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                    {/* Header */}
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb: 3,
                        }}
                    >
                        <Typography
                            variant="h5"
                            sx={{
                                fontWeight: 700,
                                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                backgroundClip: 'text',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            {t('widget.verifyIdentity')}
                        </Typography>
                        <Button
                            variant="text"
                            size="small"
                            onClick={handleCancel}
                            disabled={loading || flowComplete}
                            startIcon={<Close />}
                            sx={{ color: 'text.secondary', minWidth: 'auto' }}
                        >
                            {t('widget.cancel')}
                        </Button>
                    </Box>

                    {/* Step Progress Stepper */}
                    <StepProgress steps={progressSteps} activeStep={activeStepIndex} />

                    {/* Current Step Content */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeStepIndex}
                            initial={{ opacity: 0, x: 30 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -30 }}
                            transition={{ duration: 0.3, ease: easeOut }}
                        >
                            {renderCurrentStep()}
                        </motion.div>
                    </AnimatePresence>

                    {/* Skip Button (for optional steps) */}
                    {currentStep && !currentStep.isRequired && !flowComplete && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                        >
                            <Box sx={{ textAlign: 'center', mt: 3 }}>
                                <Button
                                    variant="text"
                                    size="small"
                                    onClick={handleSkipStep}
                                    disabled={loading}
                                    startIcon={<SkipNext />}
                                    sx={{
                                        color: 'text.secondary',
                                        fontWeight: 500,
                                        '&:hover': {
                                            color: 'primary.main',
                                            backgroundColor: 'rgba(99, 102, 241, 0.06)',
                                        },
                                    }}
                                >
                                    {t('widget.skipStep')}
                                </Button>
                            </Box>
                        </motion.div>
                    )}

                    {/* Step counter */}
                    {!flowComplete && currentStep && (
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                                display: 'block',
                                textAlign: 'center',
                                mt: 3,
                            }}
                        >
                            {t('widget.stepOfTotal', { current: activeStepIndex + 1, total: steps.length })}
                        </Typography>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    )
}
