import { useState, useEffect, useCallback, useMemo } from 'react'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Collapse,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    IconButton,
    Snackbar,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material'
import {
    CheckCircle,
    Delete,
    Email,
    ExpandLess,
    ExpandMore,
    Face,
    Fingerprint,
    Key,
    Mic,
    Nfc,
    PhonelinkLock,
    QrCode2,
    Refresh,
    SmsOutlined,
    VerifiedUser,
    WarningAmber,
} from '@mui/icons-material'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { useUserEnrollments } from '@features/enrollments/hooks/useEnrollments'
import { AuthMethodType } from '@domain/models/AuthMethod'
import { EnrollmentStatus } from '@domain/models/Enrollment'
import FaceEnrollmentFlow from './FaceEnrollmentFlow'
import TotpEnrollment from './TotpEnrollment'
import WebAuthnEnrollment from './WebAuthnEnrollment'
import VoiceEnrollmentFlow from './VoiceEnrollmentFlow'
import NfcEnrollment from './NfcEnrollment'
import { getBiometricService } from '@core/services/BiometricService'
import { container } from '@core/di/container'
import { TYPES } from '@core/di/types'
import type { ITokenService } from '@domain/interfaces/ITokenService'
import type { ISettingsService } from '@domain/interfaces/ISettingsService'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import { formatApiError } from '@utils/formatApiError'

/**
 * Device capability detection results
 */
interface DeviceCapabilities {
    camera: boolean | null
    microphone: boolean | null
    webauthnPlatform: boolean | null
    webauthn: boolean | null
    nfc: boolean | null
}

/**
 * Method card configuration
 */
interface MethodCardConfig {
    type: AuthMethodType
    label: string
    description: string
    icon: React.ReactNode
    capabilityKey: keyof DeviceCapabilities | null
    alwaysAvailable: boolean
    gradient: string
    bgColor: string
}

const METHOD_CONFIGS: MethodCardConfig[] = [
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

/**
 * NFC card data from the backend
 */
interface NfcCard {
    cardId: string
    cardSerial: string
    cardType: string
    label: string
    isActive: boolean
    enrolledAt: string
    lastUsedAt: string | null
}

interface NfcCardsResponse {
    userId: string
    count: number
    activeCount: number
    cards: NfcCard[]
}

const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

/**
 * Detect device capabilities for biometric methods
 */
async function detectCapabilities(): Promise<DeviceCapabilities> {
    const caps: DeviceCapabilities = {
        camera: null,
        microphone: null,
        webauthnPlatform: null,
        webauthn: null,
        nfc: null,
    }

    // Camera check
    try {
        if (navigator.mediaDevices) {
            const devices = await navigator.mediaDevices.enumerateDevices()
            caps.camera = devices.some((d) => d.kind === 'videoinput')
        } else {
            caps.camera = false
        }
    } catch {
        caps.camera = false
    }

    // Microphone check
    try {
        if (navigator.mediaDevices) {
            const devices = await navigator.mediaDevices.enumerateDevices()
            caps.microphone = devices.some((d) => d.kind === 'audioinput')
        } else {
            caps.microphone = false
        }
    } catch {
        caps.microphone = false
    }

    // WebAuthn check
    caps.webauthn = !!window.PublicKeyCredential

    // WebAuthn platform authenticator check
    // Brave throws on isUserVerifyingPlatformAuthenticatorAvailable() — treat as available
    // so users can still attempt enrollment (WebAuthn will prompt for permission)
    try {
        if (window.PublicKeyCredential) {
            caps.webauthnPlatform =
                await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        } else {
            caps.webauthnPlatform = false
        }
    } catch {
        caps.webauthnPlatform = !!window.PublicKeyCredential
    }

    // NFC check
    caps.nfc = 'NDEFReader' in window

    return caps
}

/**
 * EnrollmentPage
 * Allows users to manage their biometric and MFA enrollments.
 * Shows a grid of available auth methods with enrollment status,
 * device capability detection, and enroll/test actions.
 */
export default function EnrollmentPage() {
    const { t } = useTranslation()
    const { user } = useAuth()
    const userId = user?.id ?? ''
    const {
        enrollments,
        loading: enrollmentsLoading,
        refetch: refetchEnrollments,
        createEnrollment,
        revokeEnrollment,
    } = useUserEnrollments(userId)

    const [capabilities, setCapabilities] = useState<DeviceCapabilities>({
        camera: null,
        microphone: null,
        webauthnPlatform: null,
        webauthn: null,
        nfc: null,
    })
    const [capsLoading, setCapsLoading] = useState(true)

    // Enrollment dialog states
    const [faceEnrollOpen, setFaceEnrollOpen] = useState(false)
    const [totpEnrollOpen, setTotpEnrollOpen] = useState(false)
    const [webauthnEnrollOpen, setWebauthnEnrollOpen] = useState(false)
    const [webauthnMode, setWebauthnMode] = useState<'hardware-key' | 'platform'>('hardware-key')
    const [voiceEnrollOpen, setVoiceEnrollOpen] = useState(false)
    const [nfcEnrollOpen, setNfcEnrollOpen] = useState(false)

    const [accessToken, setAccessToken] = useState<string | null>(null)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [, setActionError] = useState<string | null>(null)
    const [, setActionSuccess] = useState<string | null>(null)
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning' }>({ open: false, message: '', severity: 'info' })

    // NFC cards list state
    const [nfcCards, setNfcCards] = useState<NfcCard[]>([])
    const [nfcCardsLoading, setNfcCardsLoading] = useState(false)
    const [nfcCardsExpanded, setNfcCardsExpanded] = useState(true)
    const [deletingCardId, setDeletingCardId] = useState<string | null>(null)

    // Phone number dialog for SMS OTP enrollment
    const [phoneDialogOpen, setPhoneDialogOpen] = useState(false)
    const [phoneInput, setPhoneInput] = useState('')
    const [phoneSaving, setPhoneSaving] = useState(false)

    // SMS OTP verification dialog (step 2 of SMS enrollment after phone is on file)
    const [smsOtpDialogOpen, setSmsOtpDialogOpen] = useState(false)
    const [smsOtpCode, setSmsOtpCode] = useState('')
    const [smsOtpSending, setSmsOtpSending] = useState(false)
    const [smsOtpVerifying, setSmsOtpVerifying] = useState(false)
    const [smsOtpError, setSmsOtpError] = useState<string | null>(null)

    // Detect device capabilities on mount
    useEffect(() => {
        detectCapabilities().then((caps) => {
            setCapabilities(caps)
            setCapsLoading(false)
        })
    }, [])

    // Fetch NFC cards when NFC_DOCUMENT is enrolled
    const fetchNfcCards = useCallback(async () => {
        if (!userId) return
        setNfcCardsLoading(true)
        try {
            const httpClient = container.get<IHttpClient>(TYPES.HttpClient)
            const response = await httpClient.get<NfcCardsResponse>(`/nfc/user/${userId}`)
            setNfcCards(response.data?.cards ?? [])
        } catch {
            // Silently fail — cards list is supplementary
            setNfcCards([])
        } finally {
            setNfcCardsLoading(false)
        }
    }, [userId])

    const handleDeleteNfcCard = useCallback(async (cardId: string) => {
        setDeletingCardId(cardId)
        try {
            const httpClient = container.get<IHttpClient>(TYPES.HttpClient)
            await httpClient.delete(`/nfc/cards/${cardId}`)
            setSnackbar({ open: true, message: t('enrollmentPage.nfcCards.deleteSuccess'), severity: 'success' })
            fetchNfcCards()
        } catch (err) {
            setSnackbar({
                open: true,
                message: formatApiError(err, t),
                severity: 'error',
            })
        } finally {
            setDeletingCardId(null)
        }
    }, [fetchNfcCards, t])

    // Fetch access token for voice endpoints
    useEffect(() => {
        const tokenService = container.get<ITokenService>(TYPES.TokenService)
        tokenService.getAccessToken().then(setAccessToken).catch((e) => {
            // Voice endpoints will fall back to unauthenticated mode; log so we can diagnose later.
            console.error('EnrollmentPage: failed to fetch access token for voice endpoints', e)
        })
    }, [])

    // Build enrollment status map
    const enrollmentMap = useMemo(() => {
        const map = new Map<string, { status: EnrollmentStatus; id: string }>()
        for (const enrollment of enrollments) {
            if (enrollment.authMethodType) {
                map.set(enrollment.authMethodType, {
                    status: enrollment.status,
                    id: enrollment.id,
                })
            }
        }
        return map
    }, [enrollments])

    const isMethodEnrolled = useCallback(
        (type: AuthMethodType) => {
            const entry = enrollmentMap.get(type)
            return entry?.status === EnrollmentStatus.ENROLLED || entry?.status === EnrollmentStatus.SUCCESS
        },
        [enrollmentMap]
    )

    const isMethodAvailable = useCallback(
        (config: MethodCardConfig) => {
            if (config.alwaysAvailable) return true
            if (config.capabilityKey === null) return true
            return capabilities[config.capabilityKey] === true
        },
        [capabilities]
    )

    // Re-fetch NFC cards whenever enrollments change and NFC is enrolled
    useEffect(() => {
        const nfcEntry = enrollmentMap.get(AuthMethodType.NFC_DOCUMENT)
        const nfcEnrolled = nfcEntry?.status === EnrollmentStatus.ENROLLED || nfcEntry?.status === EnrollmentStatus.SUCCESS
        if (nfcEnrolled && userId) {
            fetchNfcCards()
        } else {
            setNfcCards([])
        }
    }, [enrollmentMap, userId, fetchNfcCards])

    // Handle enrollment for specific method types
    const handleEnroll = useCallback(
        async (type: AuthMethodType) => {
            setActionError(null)
            setActionSuccess(null)

            switch (type) {
                case AuthMethodType.FACE:
                    setFaceEnrollOpen(true)
                    break
                case AuthMethodType.FINGERPRINT:
                    setWebauthnMode('platform')
                    setWebauthnEnrollOpen(true)
                    break
                case AuthMethodType.HARDWARE_KEY:
                    setWebauthnMode('hardware-key')
                    setWebauthnEnrollOpen(true)
                    break
                case AuthMethodType.TOTP:
                    setTotpEnrollOpen(true)
                    break
                case AuthMethodType.VOICE:
                    setVoiceEnrollOpen(true)
                    break
                case AuthMethodType.SMS_OTP:
                    // SMS OTP requires a phone number — prompt if missing
                    if (!user?.phoneNumber) {
                        setPhoneDialogOpen(true)
                        return
                    }
                    // Real verify-before-enroll: ask the API to send an OTP, then open
                    // the verification dialog. Only after /otp/sms/verify succeeds do
                    // we mark the enrollment complete. Backend no longer auto-completes
                    // SMS_OTP on startEnrollment (was the source of the silent-success bug).
                    setActionLoading(type)
                    setSmsOtpError(null)
                    setSmsOtpCode('')
                    try {
                        const httpClient = container.get<IHttpClient>(TYPES.HttpClient)
                        await createEnrollment({
                            tenantId: user?.tenantId ?? 'system',
                            methodType: type,
                        })
                        setSmsOtpSending(true)
                        await httpClient.post(`/otp/sms/send/${userId}`, {})
                        setSmsOtpDialogOpen(true)
                    } catch (err) {
                        setSnackbar({ open: true, message: formatApiError(err, t), severity: 'error' })
                    } finally {
                        setActionLoading(null)
                        setSmsOtpSending(false)
                    }
                    break
                case AuthMethodType.EMAIL_OTP:
                    // EMAIL_OTP is not a real "enrollment": every user has an email
                    // bound at registration. The auth-methods page should already
                    // be showing this method as enrolled (the API auto-creates a
                    // status=ENROLLED row in getUserEnrollments). If the user
                    // somehow lands here, just refetch to surface the auto-row.
                    refetchEnrollments()
                    setSnackbar({
                        open: true,
                        message: t('enrollmentPage.enrolledSuccess', {
                            method: t('enrollmentPage.methods.EMAIL_OTP.label'),
                        }),
                        severity: 'success',
                    })
                    break
                case AuthMethodType.QR_CODE:
                    setActionLoading(type)
                    try {
                        await createEnrollment({
                            tenantId: user?.tenantId ?? 'system',
                            methodType: type,
                        })
                        setSnackbar({ open: true, message: t('enrollmentPage.enrolledSuccess', { method: t(`enrollmentPage.methods.${type}.label`) }), severity: 'success' })
                    } catch (err) {
                        setSnackbar({ open: true, message: formatApiError(err, t), severity: 'error' })
                    } finally {
                        setActionLoading(null)
                    }
                    break
                case AuthMethodType.NFC_DOCUMENT:
                    if ('NDEFReader' in window) {
                        setNfcEnrollOpen(true)
                    } else {
                        setSnackbar({ open: true, message: t('mfa.nfc.notSupported'), severity: 'warning' })
                    }
                    break
                default:
                    setSnackbar({ open: true, message: t('enrollmentPage.notSupported', { method: t(`enrollmentPage.methods.${type}.label`) }), severity: 'info' })
            }
        },
        [createEnrollment, user?.tenantId, user?.phoneNumber, t]
    )

    // Handle test for already-enrolled methods
    const handleTest = useCallback(
        (type: AuthMethodType) => {
            switch (type) {
                case AuthMethodType.FACE:
                    setFaceEnrollOpen(true)
                    break
                case AuthMethodType.FINGERPRINT:
                    setWebauthnMode('platform')
                    setWebauthnEnrollOpen(true)
                    break
                case AuthMethodType.HARDWARE_KEY:
                    setWebauthnMode('hardware-key')
                    setWebauthnEnrollOpen(true)
                    break
                case AuthMethodType.TOTP:
                    setTotpEnrollOpen(true)
                    break
                case AuthMethodType.VOICE:
                    setVoiceEnrollOpen(true)
                    break
                case AuthMethodType.NFC_DOCUMENT:
                    if ('NDEFReader' in window) {
                        setNfcEnrollOpen(true)
                    } else {
                        setSnackbar({ open: true, message: t('mfa.nfc.notSupported'), severity: 'warning' })
                    }
                    break
                case AuthMethodType.EMAIL_OTP:
                case AuthMethodType.SMS_OTP:
                case AuthMethodType.QR_CODE:
                    setSnackbar({
                        open: true,
                        message: t('enrollmentPage.testHint', { method: t(`enrollmentPage.methods.${type}.label`) }),
                        severity: 'info',
                    })
                    break
            }
        },
        [t]
    )

    // Handle face enrollment completion
    const handleFaceEnrollComplete = useCallback(
        async (images: string[], clientEmbeddings?: (number[] | null)[]) => {
            if (!userId || images.length === 0) return
            setActionLoading(AuthMethodType.FACE)
            setActionError(null)
            try {
                const biometric = getBiometricService()
                // Send all captured images — enrollFace will use /enroll/multi
                // for 2+ images (quality-weighted template fusion).
                // clientEmbeddings are 512-dim landmark-geometry vectors computed in-browser
                // via EmbeddingComputer (MediaPipe, log-only per D2). Server stores them for
                // offline analysis only — never used for auth decisions.
                await biometric.enrollFace(userId, images, user?.tenantId, clientEmbeddings)

                // Create enrollment record and explicitly complete it (FACE is ASYNC_ENROLLMENT_TYPE)
                await createEnrollment({
                    tenantId: user?.tenantId ?? 'system',
                    methodType: AuthMethodType.FACE,
                })
                const httpClient = container.get<IHttpClient>(TYPES.HttpClient)
                await httpClient.put(`/users/${userId}/enrollments/FACE/complete`, {})

                setFaceEnrollOpen(false)
                refetchEnrollments()
                setSnackbar({ open: true, message: t('enrollmentPage.faceEnrolled'), severity: 'success' })
            } catch (err) {
                setFaceEnrollOpen(false)
                setSnackbar({
                    open: true,
                    message: formatApiError(err, t),
                    severity: 'error',
                })
            } finally {
                setActionLoading(null)
            }
        },
        [userId, user?.tenantId, createEnrollment, refetchEnrollments, t]
    )

    // Handle revoke
    const handleRevoke = useCallback(
        async (type: AuthMethodType) => {
            setActionLoading(type)
            setActionError(null)
            setActionSuccess(null)
            try {
                await revokeEnrollment(type)
                setSnackbar({ open: true, message: t('enrollmentPage.revokeSuccess', { method: t(`enrollmentPage.methods.${type}.label`) }), severity: 'success' })
            } catch (err) {
                setSnackbar({ open: true, message: formatApiError(err, t), severity: 'error' })
            } finally {
                setActionLoading(null)
            }
        },
        [revokeEnrollment, t]
    )

    const loading = enrollmentsLoading || capsLoading

    if (!user) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="warning">{t('enrollmentPage.loginRequired')}</Alert>
            </Box>
        )
    }

    return (
        <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 2, sm: 3 } }}>
            {/* Header */}
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 1,
                }}
            >
                <Box>
                    <Typography variant="h4" fontWeight={700}>
                        {t('enrollmentPage.title')}
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
                        {t('enrollmentPage.subtitle')}
                    </Typography>
                </Box>
                <Tooltip title={t('enrollmentPage.refreshTooltip')}>
                    <IconButton
                        onClick={() => refetchEnrollments()}
                        disabled={loading}
                        aria-label={t('common.aria.refresh')}
                        sx={{
                            bgcolor: 'action.hover',
                            '&:hover': { bgcolor: 'action.selected' },
                        }}
                    >
                        <Refresh />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Status summary */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                <Chip
                    icon={<VerifiedUser />}
                    label={t('enrollmentPage.enrolledCount', { count: enrollments.filter((e) => e.isSuccessful()).length })}
                    color="success"
                    variant="outlined"
                />
                <Chip
                    icon={<WarningAmber />}
                    label={t('enrollmentPage.unavailableCount', { count: METHOD_CONFIGS.filter((c) => !isMethodAvailable(c)).length })}
                    color="warning"
                    variant="outlined"
                />
            </Box>

            {/* Alerts removed — using Snackbar instead */}

            {/* Loading state */}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <Grid container spacing={3}>
                    {METHOD_CONFIGS.map((config, index) => {
                        const enrolled = isMethodEnrolled(config.type)
                        const available = isMethodAvailable(config)
                        const isLoading = actionLoading === config.type

                        return (
                            <Grid item xs={12} sm={6} md={4} key={config.type}>
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{
                                        duration: 0.4,
                                        delay: index * 0.05,
                                        ease: easeOut,
                                    }}
                                >
                                    <Card
                                        sx={{
                                            height: '100%',
                                            borderRadius: '16px',
                                            border: '1px solid',
                                            borderColor: enrolled
                                                ? 'success.light'
                                                : 'divider',
                                            opacity: available ? 1 : 0.6,
                                            transition: 'all 0.3s ease',
                                            '&:hover': available
                                                ? {
                                                      transform: 'translateY(-4px)',
                                                      boxShadow:
                                                          '0 12px 40px rgba(0, 0, 0, 0.1)',
                                                  }
                                                : {},
                                        }}
                                    >
                                        <CardContent sx={{ p: 3 }}>
                                            {/* Icon + status */}
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'flex-start',
                                                    mb: 2,
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        width: 56,
                                                        height: 56,
                                                        borderRadius: '14px',
                                                        background: config.gradient,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        boxShadow: `0 8px 24px ${config.bgColor}`,
                                                    }}
                                                >
                                                    {config.icon}
                                                </Box>
                                                {enrolled ? (
                                                    <Chip
                                                        icon={<CheckCircle />}
                                                        label={t('enrollmentPage.statusEnrolled')}
                                                        size="small"
                                                        color="success"
                                                        sx={{ fontWeight: 600 }}
                                                    />
                                                ) : !available ? (
                                                    <Chip
                                                        label={t('enrollmentPage.statusUnavailable')}
                                                        size="small"
                                                        color="default"
                                                        sx={{ fontWeight: 500 }}
                                                    />
                                                ) : (
                                                    <Chip
                                                        label={t('enrollmentPage.statusNotEnrolled')}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{ fontWeight: 500 }}
                                                    />
                                                )}
                                            </Box>

                                            {/* Label + description */}
                                            <Typography
                                                variant="subtitle1"
                                                fontWeight={700}
                                                sx={{ mb: 0.5 }}
                                            >
                                                {t(config.label)}
                                            </Typography>
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                                sx={{ mb: 2, minHeight: 40 }}
                                            >
                                                {t(config.description)}
                                            </Typography>

                                            {/* Actions */}
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    gap: 1,
                                                    flexWrap: 'wrap',
                                                }}
                                            >
                                                {!enrolled && available && (
                                                    <Button
                                                        variant="contained"
                                                        size="small"
                                                        onClick={() =>
                                                            handleEnroll(config.type)
                                                        }
                                                        disabled={isLoading}
                                                        sx={{
                                                            borderRadius: '8px',
                                                            fontWeight: 600,
                                                            textTransform: 'none',
                                                            background: config.gradient,
                                                            '&:hover': {
                                                                opacity: 0.9,
                                                            },
                                                        }}
                                                    >
                                                        {isLoading ? (
                                                            <CircularProgress
                                                                size={16}
                                                                sx={{
                                                                    color: 'white',
                                                                    mr: 1,
                                                                }}
                                                            />
                                                        ) : null}
                                                        {t('enrollmentPage.enroll')}
                                                    </Button>
                                                )}
                                                {enrolled && (
                                                    <>
                                                        <Button
                                                            variant="outlined"
                                                            size="small"
                                                            color="primary"
                                                            onClick={() =>
                                                                handleTest(config.type)
                                                            }
                                                            disabled={isLoading}
                                                            sx={{
                                                                borderRadius: '8px',
                                                                fontWeight: 600,
                                                                textTransform: 'none',
                                                            }}
                                                        >
                                                            {t('enrollmentPage.test')}
                                                        </Button>
                                                        {/* EMAIL_OTP is bound to the user's account email at
                                                            registration and is auto-enrolled by the API. Do
                                                            not let the user revoke it from this page — that
                                                            would create a stuck "not enrolled" state since
                                                            revoking just flips the row back without removing
                                                            the underlying email. */}
                                                        {config.type !== AuthMethodType.EMAIL_OTP && (
                                                        <Button
                                                            variant="outlined"
                                                            size="small"
                                                            color="error"
                                                            onClick={() =>
                                                                handleRevoke(config.type)
                                                            }
                                                            disabled={isLoading}
                                                            sx={{
                                                                borderRadius: '8px',
                                                                fontWeight: 600,
                                                                textTransform: 'none',
                                                            }}
                                                        >
                                                            {t('enrollmentPage.revoke')}
                                                        </Button>
                                                        )}
                                                    </>
                                                )}
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            </Grid>
                        )
                    })}
                </Grid>
            )}

            {/* NFC Cards List — visible when NFC_DOCUMENT is enrolled */}
            {isMethodEnrolled(AuthMethodType.NFC_DOCUMENT) && (
                <Card
                    sx={{
                        mt: 3,
                        borderRadius: '16px',
                        border: '1px solid',
                        borderColor: 'divider',
                    }}
                >
                    <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                cursor: 'pointer',
                            }}
                            onClick={() => setNfcCardsExpanded(!nfcCardsExpanded)}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Box
                                    sx={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: '10px',
                                        background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Nfc sx={{ fontSize: 22, color: 'white' }} />
                                </Box>
                                <Box>
                                    <Typography variant="subtitle1" fontWeight={700}>
                                        {t('enrollmentPage.nfcCards.title')}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {t('enrollmentPage.nfcCards.subtitle', { count: nfcCards.length })}
                                    </Typography>
                                </Box>
                            </Box>
                            <IconButton size="small" aria-label={nfcCardsExpanded ? t('common.aria.collapse') : t('common.aria.expand')}>
                                {nfcCardsExpanded ? <ExpandLess /> : <ExpandMore />}
                            </IconButton>
                        </Box>

                        <Collapse in={nfcCardsExpanded}>
                            <Box sx={{ mt: 2 }}>
                                {nfcCardsLoading ? (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                                        <CircularProgress size={28} />
                                    </Box>
                                ) : nfcCards.length === 0 ? (
                                    <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                                        {t('enrollmentPage.nfcCards.noCards')}
                                    </Typography>
                                ) : (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                        {nfcCards.map((card) => (
                                            <Box
                                                key={card.cardId}
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    p: 2,
                                                    borderRadius: '12px',
                                                    bgcolor: card.isActive ? 'action.hover' : 'action.disabledBackground',
                                                    border: '1px solid',
                                                    borderColor: card.isActive ? 'divider' : 'action.disabled',
                                                    opacity: card.isActive ? 1 : 0.7,
                                                }}
                                            >
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                                        <Typography
                                                            variant="body2"
                                                            fontWeight={700}
                                                            sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                                                        >
                                                            {card.cardSerial}
                                                        </Typography>
                                                        <Chip
                                                            label={card.isActive ? t('enrollmentPage.nfcCards.active') : t('enrollmentPage.nfcCards.inactive')}
                                                            size="small"
                                                            color={card.isActive ? 'success' : 'default'}
                                                            sx={{ fontWeight: 600, height: 22, fontSize: '0.7rem' }}
                                                        />
                                                    </Box>
                                                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {t('enrollmentPage.nfcCards.type')}: {card.cardType}
                                                        </Typography>
                                                        {card.label && (
                                                            <Typography variant="caption" color="text.secondary">
                                                                {t('enrollmentPage.nfcCards.label')}: {card.label}
                                                            </Typography>
                                                        )}
                                                        <Typography variant="caption" color="text.secondary">
                                                            {t('enrollmentPage.nfcCards.enrolledAt')}: {new Date(card.enrolledAt).toLocaleDateString()}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                                {card.isActive && (
                                                    <Tooltip title={t('enrollmentPage.nfcCards.deactivate')}>
                                                        <IconButton
                                                            size="small"
                                                            color="error"
                                                            onClick={() => handleDeleteNfcCard(card.cardId)}
                                                            disabled={deletingCardId === card.cardId}
                                                            aria-label={t('common.aria.delete')}
                                                            sx={{ ml: 1 }}
                                                        >
                                                            {deletingCardId === card.cardId ? (
                                                                <CircularProgress size={18} color="error" />
                                                            ) : (
                                                                <Delete fontSize="small" />
                                                            )}
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </Box>
                                        ))}
                                    </Box>
                                )}
                            </Box>
                        </Collapse>
                    </CardContent>
                </Card>
            )}

            {/* Face Enrollment Dialog */}
            <FaceEnrollmentFlow
                open={faceEnrollOpen}
                onClose={() => setFaceEnrollOpen(false)}
                onComplete={handleFaceEnrollComplete}
            />

            {/* TOTP Enrollment Dialog */}
            <TotpEnrollment
                open={totpEnrollOpen}
                userId={userId}
                onClose={() => setTotpEnrollOpen(false)}
                onSuccess={async () => {
                    setTotpEnrollOpen(false)
                    // TOTP is NOT in AUTO_COMPLETE_TYPES on the server, so startEnrollment
                    // returns PENDING. The dialog has already verified the code and
                    // persisted the encrypted secret on /totp/verify-setup, so we
                    // must explicitly mark the user_enrollments row ENROLLED here —
                    // otherwise the page keeps showing "not enrolled" even though
                    // the secret is good and EnrollmentHealthService.hasTotpSecret
                    // would return true.
                    try {
                        await createEnrollment({
                            tenantId: user?.tenantId ?? 'system',
                            methodType: AuthMethodType.TOTP,
                        })
                        const httpClient = container.get<IHttpClient>(TYPES.HttpClient)
                        await httpClient.put(`/users/${userId}/enrollments/TOTP/complete`, {})
                    } catch {
                        // secret is already persisted server-side; bookkeeping retry will fix it
                    }
                    refetchEnrollments()
                    setSnackbar({ open: true, message: t('enrollmentPage.enrolledSuccess', { method: t('enrollmentPage.methods.TOTP.label') }), severity: 'success' })
                }}
            />

            {/* WebAuthn Enrollment Dialog (Fingerprint / Hardware Key) */}
            <WebAuthnEnrollment
                open={webauthnEnrollOpen}
                userId={userId}
                mode={webauthnMode}
                onClose={() => setWebauthnEnrollOpen(false)}
                onSuccess={async () => {
                    const methodType = webauthnMode === 'platform' ? AuthMethodType.FINGERPRINT : AuthMethodType.HARDWARE_KEY
                    setWebauthnEnrollOpen(false)
                    try {
                        await createEnrollment({
                            tenantId: user?.tenantId ?? 'system',
                            methodType,
                        })
                        // Mark enrollment as ENROLLED (wait before refetch)
                        const httpClient = container.get<IHttpClient>(TYPES.HttpClient)
                        await httpClient.put(`/users/${userId}/enrollments/${methodType}/complete`, {})
                    } catch {
                        // ignore — credential is saved in WebAuthn store regardless
                    }
                    refetchEnrollments()
                    setSnackbar({
                        open: true,
                        message: t('enrollmentPage.enrolledSuccess', {
                            method: methodType === AuthMethodType.FINGERPRINT
                                ? t('enrollmentPage.methods.FINGERPRINT.label')
                                : t('enrollmentPage.methods.HARDWARE_KEY.label'),
                        }),
                        severity: 'success',
                    })
                }}
            />

            {/* Voice Enrollment Dialog (with WAV conversion, enroll/verify/search) */}
            <VoiceEnrollmentFlow
                open={voiceEnrollOpen}
                userId={userId}
                apiBaseUrl={import.meta.env.VITE_API_BASE_URL || 'https://api.fivucsas.com/api/v1'}
                token={accessToken}
                onClose={() => setVoiceEnrollOpen(false)}
                onSuccess={async (action) => {
                    if (action === 'enroll') {
                        try {
                            await createEnrollment({
                                tenantId: user?.tenantId ?? 'system',
                                methodType: AuthMethodType.VOICE,
                            })
                            const httpClient = container.get<IHttpClient>(TYPES.HttpClient)
                            await httpClient.put(`/users/${userId}/enrollments/VOICE/complete`, {})
                        } catch { /* bio enrollment succeeded even if record creation fails */ }
                        refetchEnrollments()
                        setSnackbar({ open: true, message: t('enrollmentPage.voiceEnrolled'), severity: 'success' })
                    }
                }}
            />

            {/* NFC Enrollment Dialog */}
            <NfcEnrollment
                open={nfcEnrollOpen}
                userId={userId}
                onClose={() => setNfcEnrollOpen(false)}
                onSuccess={async () => {
                    // The backend NfcController.enrollCard() now auto-creates the enrollment
                    // record (NFC_DOCUMENT is in AUTO_COMPLETE_TYPES), but we also call
                    // createEnrollment as a safety net in case the backend auto-create failed.
                    try {
                        await createEnrollment({
                            tenantId: user?.tenantId ?? 'system',
                            methodType: AuthMethodType.NFC_DOCUMENT,
                        })
                    } catch { /* ignore — backend already created it */ }
                    setNfcEnrollOpen(false)
                    refetchEnrollments()
                    setSnackbar({
                        open: true,
                        message: t('enrollmentPage.enrolledSuccess', { method: t('enrollmentPage.methods.NFC_DOCUMENT.label') }),
                        severity: 'success',
                    })
                }}
            />

            {/* Phone Number Dialog for SMS OTP */}
            <Dialog
                open={phoneDialogOpen}
                onClose={() => setPhoneDialogOpen(false)}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>{t('enrollmentPage.phoneDialog.title')}</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {t('enrollmentPage.phoneDialog.description')}
                    </Typography>
                    <TextField
                        fullWidth
                        label={t('enrollmentPage.phoneDialog.label')}
                        type="tel"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        placeholder={t('enrollmentPage.phoneDialog.placeholder')}
                        helperText={t('enrollmentPage.phoneDialog.helper')}
                        disabled={phoneSaving}
                        autoFocus
                    />
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => {
                            setPhoneDialogOpen(false)
                            setPhoneInput('')
                        }}
                        disabled={phoneSaving}
                    >
                        {t('enrollmentPage.cancel')}
                    </Button>
                    <Button
                        variant="contained"
                        disabled={phoneSaving || !phoneInput.trim() || phoneInput.trim().length < 10}
                        startIcon={phoneSaving ? <CircularProgress size={16} /> : null}
                        onClick={async () => {
                            setPhoneSaving(true)
                            try {
                                // Save phone number to profile
                                const settingsService = container.get<ISettingsService>(TYPES.SettingsService)
                                await settingsService.updateProfile({
                                    firstName: user?.firstName ?? '',
                                    lastName: user?.lastName ?? '',
                                    phoneNumber: phoneInput.trim(),
                                })
                                // Phone is saved — now start the real SMS OTP enrollment
                                // flow: create the PENDING row, request an OTP, and open
                                // the verification dialog. The row stays PENDING until
                                // the user enters a valid code (handleVerifySmsOtp).
                                const httpClient = container.get<IHttpClient>(TYPES.HttpClient)
                                await createEnrollment({
                                    tenantId: user?.tenantId ?? 'system',
                                    methodType: AuthMethodType.SMS_OTP,
                                })
                                setSmsOtpError(null)
                                setSmsOtpCode('')
                                setSmsOtpSending(true)
                                await httpClient.post(`/otp/sms/send/${userId}`, {})
                                setPhoneDialogOpen(false)
                                setPhoneInput('')
                                setSmsOtpDialogOpen(true)
                            } catch (err) {
                                setSnackbar({
                                    open: true,
                                    message: formatApiError(err, t),
                                    severity: 'error',
                                })
                            } finally {
                                setPhoneSaving(false)
                                setSmsOtpSending(false)
                            }
                        }}
                    >
                        {phoneSaving ? t('enrollmentPage.phoneDialog.saving') : t('enrollmentPage.phoneDialog.saveAndEnroll')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* SMS OTP verification dialog — required step before flipping the
                user_enrollments row to ENROLLED. Until this code is verified by
                /otp/sms/verify, the row stays PENDING and the auth-methods page
                keeps showing "not enrolled". */}
            <Dialog
                open={smsOtpDialogOpen}
                onClose={() => {
                    if (smsOtpVerifying) return
                    setSmsOtpDialogOpen(false)
                    setSmsOtpCode('')
                    setSmsOtpError(null)
                }}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>{t('enrollmentPage.smsOtpDialog.title')}</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {t('enrollmentPage.smsOtpDialog.description', { phone: user?.phoneNumber ?? '' })}
                    </Typography>
                    {smsOtpError && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {smsOtpError}
                        </Alert>
                    )}
                    <TextField
                        fullWidth
                        autoFocus
                        label={t('enrollmentPage.smsOtpDialog.codeLabel')}
                        value={smsOtpCode}
                        onChange={(e) => setSmsOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        disabled={smsOtpVerifying}
                        inputProps={{
                            maxLength: 6,
                            inputMode: 'numeric',
                            style: {
                                textAlign: 'center',
                                fontSize: '1.4rem',
                                letterSpacing: '0.4em',
                                fontWeight: 700,
                            },
                        }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={async () => {
                            // Resend OTP
                            setSmsOtpError(null)
                            setSmsOtpSending(true)
                            try {
                                const httpClient = container.get<IHttpClient>(TYPES.HttpClient)
                                await httpClient.post(`/otp/sms/send/${userId}`, {})
                                setSnackbar({
                                    open: true,
                                    message: t('enrollmentPage.smsOtpDialog.resentSuccess'),
                                    severity: 'info',
                                })
                            } catch (err) {
                                setSmsOtpError(formatApiError(err, t))
                            } finally {
                                setSmsOtpSending(false)
                            }
                        }}
                        disabled={smsOtpVerifying || smsOtpSending}
                    >
                        {smsOtpSending ? <CircularProgress size={16} /> : t('enrollmentPage.smsOtpDialog.resend')}
                    </Button>
                    <Box sx={{ flex: 1 }} />
                    <Button
                        onClick={() => {
                            setSmsOtpDialogOpen(false)
                            setSmsOtpCode('')
                            setSmsOtpError(null)
                        }}
                        disabled={smsOtpVerifying}
                    >
                        {t('enrollmentPage.cancel')}
                    </Button>
                    <Button
                        variant="contained"
                        disabled={smsOtpVerifying || smsOtpCode.length !== 6}
                        startIcon={smsOtpVerifying ? <CircularProgress size={16} /> : null}
                        onClick={async () => {
                            setSmsOtpVerifying(true)
                            setSmsOtpError(null)
                            try {
                                const httpClient = container.get<IHttpClient>(TYPES.HttpClient)
                                const verifyResp = await httpClient.post<{ success: boolean; message?: string }>(
                                    `/otp/sms/verify/${userId}`,
                                    { code: smsOtpCode },
                                )
                                if (!verifyResp.data?.success) {
                                    setSmsOtpError(verifyResp.data?.message || t('enrollmentPage.smsOtpDialog.invalidCode'))
                                    return
                                }
                                // Code verified — flip the user_enrollments row to ENROLLED
                                await httpClient.put(`/users/${userId}/enrollments/SMS_OTP/complete`, {})
                                setSmsOtpDialogOpen(false)
                                setSmsOtpCode('')
                                refetchEnrollments()
                                setSnackbar({
                                    open: true,
                                    message: t('enrollmentPage.enrolledSuccess', {
                                        method: t('enrollmentPage.methods.SMS_OTP.label'),
                                    }),
                                    severity: 'success',
                                })
                            } catch (err) {
                                setSmsOtpError(formatApiError(err, t))
                            } finally {
                                setSmsOtpVerifying(false)
                            }
                        }}
                    >
                        {t('enrollmentPage.smsOtpDialog.verify')}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                    severity={snackbar.severity}
                    variant="filled"
                    sx={{ width: '100%', borderRadius: '12px' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    )
}
