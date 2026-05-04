/**
 * Static catalog of all auth methods rendered in the enrollment grid.
 * Extracted from EnrollmentPage.tsx during P1-Q7 decomposition.
 *
 * Order is the on-screen order. Adding a method here automatically wires
 * it into the grid; behavior wiring still lives in EnrollmentPage.
 */
import {
    Email,
    Face,
    Fingerprint,
    Key,
    Mic,
    Nfc,
    PhonelinkLock,
    QrCode2,
    SmsOutlined,
} from '@mui/icons-material'
import { AuthMethodType } from '@domain/models/AuthMethod'
import type { MethodCardConfig } from './types'

export const METHOD_CONFIGS: MethodCardConfig[] = [
    {
        type: AuthMethodType.FACE,
        label: 'enrollmentPage.methods.FACE.label',
        description: 'enrollmentPage.methods.FACE.description',
        icon: <Face sx={{ fontSize: 32, color: 'white' }} />,
        capabilityKey: 'camera',
        alwaysAvailable: false,
        gradient: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
        bgColor: 'rgba(139, 92, 246, 0.08)',
    },
    {
        type: AuthMethodType.FINGERPRINT,
        label: 'enrollmentPage.methods.FINGERPRINT.label',
        description: 'enrollmentPage.methods.FINGERPRINT.description',
        icon: <Fingerprint sx={{ fontSize: 32, color: 'white' }} />,
        capabilityKey: 'webauthnPlatform',
        alwaysAvailable: false,
        gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        bgColor: 'rgba(99, 102, 241, 0.08)',
    },
    {
        type: AuthMethodType.VOICE,
        label: 'enrollmentPage.methods.VOICE.label',
        description: 'enrollmentPage.methods.VOICE.description',
        icon: <Mic sx={{ fontSize: 32, color: 'white' }} />,
        capabilityKey: 'microphone',
        alwaysAvailable: false,
        gradient: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
        bgColor: 'rgba(236, 72, 153, 0.08)',
    },
    {
        type: AuthMethodType.TOTP,
        label: 'enrollmentPage.methods.TOTP.label',
        description: 'enrollmentPage.methods.TOTP.description',
        icon: <PhonelinkLock sx={{ fontSize: 32, color: 'white' }} />,
        capabilityKey: null,
        alwaysAvailable: true,
        gradient: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
        bgColor: 'rgba(245, 158, 11, 0.08)',
    },
    {
        type: AuthMethodType.EMAIL_OTP,
        label: 'enrollmentPage.methods.EMAIL_OTP.label',
        description: 'enrollmentPage.methods.EMAIL_OTP.description',
        icon: <Email sx={{ fontSize: 32, color: 'white' }} />,
        capabilityKey: null,
        alwaysAvailable: true,
        gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
        bgColor: 'rgba(59, 130, 246, 0.08)',
    },
    {
        type: AuthMethodType.SMS_OTP,
        label: 'enrollmentPage.methods.SMS_OTP.label',
        description: 'enrollmentPage.methods.SMS_OTP.description',
        icon: <SmsOutlined sx={{ fontSize: 32, color: 'white' }} />,
        capabilityKey: null,
        alwaysAvailable: true,
        gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        bgColor: 'rgba(16, 185, 129, 0.08)',
    },
    {
        type: AuthMethodType.QR_CODE,
        label: 'enrollmentPage.methods.QR_CODE.label',
        description: 'enrollmentPage.methods.QR_CODE.description',
        icon: <QrCode2 sx={{ fontSize: 32, color: 'white' }} />,
        capabilityKey: 'camera',
        alwaysAvailable: false,
        gradient: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
        bgColor: 'rgba(100, 116, 139, 0.08)',
    },
    {
        type: AuthMethodType.HARDWARE_KEY,
        label: 'enrollmentPage.methods.HARDWARE_KEY.label',
        description: 'enrollmentPage.methods.HARDWARE_KEY.description',
        icon: <Key sx={{ fontSize: 32, color: 'white' }} />,
        capabilityKey: 'webauthn',
        alwaysAvailable: false,
        gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        bgColor: 'rgba(245, 158, 11, 0.08)',
    },
    {
        type: AuthMethodType.NFC_DOCUMENT,
        label: 'enrollmentPage.methods.NFC_DOCUMENT.label',
        description: 'enrollmentPage.methods.NFC_DOCUMENT.description',
        icon: <Nfc sx={{ fontSize: 32, color: 'white' }} />,
        capabilityKey: 'nfc',
        alwaysAvailable: false,
        gradient: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
        bgColor: 'rgba(124, 58, 237, 0.08)',
    },
]
