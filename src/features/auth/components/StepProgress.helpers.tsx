/**
 * Shared icon/label tables and types for the StepProgress component
 * (split out so the .tsx component file is component-only).
 */
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
} from '@mui/icons-material'
import type { TFunction } from 'i18next'

/**
 * Map method type strings to their corresponding MUI icons
 */
export const METHOD_ICONS: Record<string, React.ReactNode> = {
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
export function getMethodLabels(t: TFunction): Record<string, string> {
    const labels: Record<string, string> = {}
    for (const key of METHOD_LABEL_KEYS) {
        labels[key] = t(`auth.methodLabels.${key}`)
    }
    return labels
}

/**
 * Static fallback for external consumers that don't have access to t()
 */
export const METHOD_LABELS: Record<string, string> = {
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

export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'

export interface StepProgressStep {
    label: string
    status: StepStatus
    methodType?: string
}

export interface StepProgressProps {
    steps: StepProgressStep[]
    activeStep: number
}
