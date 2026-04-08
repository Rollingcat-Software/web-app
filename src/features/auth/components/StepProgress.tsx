import { Box, Stepper, Step, StepLabel, StepConnector, Typography } from '@mui/material'
import { styled } from '@mui/material/styles'
import type { StepIconProps } from '@mui/material/StepIcon'
import {
    Lock,
    Email,
    Sms,
    PhonelinkLock,
    QrCode2,
    Face,
    Fingerprint,
    RecordVoiceOver,
    Nfc,
    Key,
    Check,
    Close,
    SkipNext,
} from '@mui/icons-material'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'

/**
 * Custom connector line between steps
 */
const StyledConnector = styled(StepConnector)(({ theme }) => ({
    '& .MuiStepConnector-line': {
        borderColor: theme.palette.divider,
        borderTopWidth: 2,
        borderRadius: 1,
    },
    '&.Mui-active .MuiStepConnector-line': {
        borderColor: theme.palette.primary.main,
    },
    '&.Mui-completed .MuiStepConnector-line': {
        borderColor: theme.palette.success.main,
    },
}))

/**
 * Map method type strings to their corresponding MUI icons
 */
const METHOD_ICONS: Record<string, React.ReactNode> = {
    password: <Lock fontSize="small" />,
    email_otp: <Email fontSize="small" />,
    sms_otp: <Sms fontSize="small" />,
    totp: <PhonelinkLock fontSize="small" />,
    qr_code: <QrCode2 fontSize="small" />,
    face: <Face fontSize="small" />,
    fingerprint: <Fingerprint fontSize="small" />,
    voice: <RecordVoiceOver fontSize="small" />,
    nfc_document: <Nfc fontSize="small" />,
    hardware_key: <Key fontSize="small" />,
}

/**
 * Method label keys for i18n lookup
 */
const METHOD_LABEL_KEYS: string[] = [
    'password', 'email_otp', 'sms_otp', 'totp', 'qr_code',
    'face', 'fingerprint', 'voice', 'nfc_document', 'hardware_key',
]

/**
 * Get translated method labels using i18n
 */
function getMethodLabels(t: TFunction): Record<string, string> {
    const labels: Record<string, string> = {}
    for (const key of METHOD_LABEL_KEYS) {
        labels[key] = t(`auth.methodLabels.${key}`)
    }
    return labels
}

/**
 * Static fallback for external consumers that don't have access to t()
 */
const METHOD_LABELS: Record<string, string> = {
    password: 'Password',
    email_otp: 'Email OTP',
    sms_otp: 'SMS OTP',
    totp: 'Authenticator',
    qr_code: 'QR Code',
    face: 'Face ID',
    fingerprint: 'Fingerprint',
    voice: 'Voice',
    nfc_document: 'NFC',
    hardware_key: 'Security Key',
}

type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'

interface StepProgressStep {
    label: string
    status: StepStatus
    methodType?: string
}

interface StepProgressProps {
    steps: StepProgressStep[]
    activeStep: number
}

/**
 * Custom Step Icon component
 * Shows method-specific icons with status-based styling
 */
function StepProgressIcon(props: StepIconProps & { stepData?: StepProgressStep }) {
    const { active, completed, stepData } = props
    const status = stepData?.status
    const methodType = stepData?.methodType

    const getBackgroundColor = () => {
        if (status === 'completed') return 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
        if (status === 'failed') return 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
        if (status === 'skipped') return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
        if (active) return 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
        return 'transparent'
    }

    const getBorderColor = () => {
        if (status === 'completed') return '#10b981'
        if (status === 'failed') return '#ef4444'
        if (status === 'skipped') return '#f59e0b'
        if (active) return '#6366f1'
        return '#e2e8f0'
    }

    const getIconContent = () => {
        if (status === 'completed') return <Check fontSize="small" sx={{ color: 'white' }} />
        if (status === 'failed') return <Close fontSize="small" sx={{ color: 'white' }} />
        if (status === 'skipped') return <SkipNext fontSize="small" sx={{ color: 'white' }} />
        if (methodType && METHOD_ICONS[methodType]) {
            return (
                <Box sx={{ color: active || completed ? 'white' : 'text.secondary', display: 'flex' }}>
                    {METHOD_ICONS[methodType]}
                </Box>
            )
        }
        return null
    }

    return (
        <motion.div
            initial={false}
            animate={{
                scale: active ? 1.1 : 1,
            }}
            transition={{ duration: 0.3 }}
        >
            <Box
                sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: getBackgroundColor(),
                    border: '2px solid',
                    borderColor: getBorderColor(),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.3s ease',
                    boxShadow: active ? '0 4px 14px rgba(99, 102, 241, 0.4)' : 'none',
                }}
            >
                {getIconContent()}
            </Box>
        </motion.div>
    )
}

export default function StepProgress({ steps, activeStep }: StepProgressProps) {
    const { t } = useTranslation()
    const translatedLabels = getMethodLabels(t)

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
            <Stepper
                activeStep={activeStep}
                alternativeLabel
                connector={<StyledConnector />}
                sx={{ mb: 4 }}
            >
                {steps.map((step, index) => (
                    <Step
                        key={index}
                        completed={step.status === 'completed' || step.status === 'skipped'}
                    >
                        <StepLabel
                            StepIconComponent={(iconProps) => (
                                <StepProgressIcon {...iconProps} stepData={step} />
                            )}
                        >
                            <Typography
                                variant="caption"
                                fontWeight={index === activeStep ? 600 : 400}
                                color={
                                    step.status === 'completed'
                                        ? 'success.main'
                                        : step.status === 'failed'
                                          ? 'error.main'
                                          : step.status === 'skipped'
                                            ? 'warning.main'
                                            : index === activeStep
                                              ? 'primary.main'
                                              : 'text.secondary'
                                }
                                sx={{
                                    display: 'block',
                                    fontSize: { xs: '0.6rem', sm: '0.75rem' },
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    maxWidth: { xs: 60, sm: 'none' },
                                }}
                            >
                                {step.methodType
                                    ? translatedLabels[step.methodType] || step.label
                                    : step.label}
                            </Typography>
                        </StepLabel>
                    </Step>
                ))}
            </Stepper>
        </motion.div>
    )
}

export { METHOD_ICONS, METHOD_LABELS, getMethodLabels }
export type { StepProgressStep, StepProgressProps, StepStatus }
