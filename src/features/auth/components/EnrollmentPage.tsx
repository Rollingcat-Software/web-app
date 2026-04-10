import { useState, useEffect, useCallback, useMemo } from 'react'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
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
    Email,
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
        label: 'Face Recognition',
        description: 'Enroll your face for biometric authentication',
        icon: <Face sx={{ fontSize: 32, color: 'white' }} />,
        capabilityKey: 'camera',
        alwaysAvailable: false,
        gradient: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
        bgColor: 'rgba(139, 92, 246, 0.08)',
    },
    {
        type: AuthMethodType.FINGERPRINT,
        label: 'Fingerprint',
        description: 'Use your device fingerprint sensor for authentication',
        icon: <Fingerprint sx={{ fontSize: 32, color: 'white' }} />,
        capabilityKey: 'webauthnPlatform',
        alwaysAvailable: false,
        gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        bgColor: 'rgba(99, 102, 241, 0.08)',
    },
    {
        type: AuthMethodType.VOICE,
        label: 'Voice Recognition',
        description: 'Enroll your voice for audio-based authentication',
        icon: <Mic sx={{ fontSize: 32, color: 'white' }} />,
        capabilityKey: 'microphone',
        alwaysAvailable: false,
        gradient: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
        bgColor: 'rgba(236, 72, 153, 0.08)',
    },
    {
        type: AuthMethodType.TOTP,
        label: 'Authenticator App',
        description: 'Set up TOTP with Google Authenticator or similar',
        icon: <PhonelinkLock sx={{ fontSize: 32, color: 'white' }} />,
        capabilityKey: null,
        alwaysAvailable: true,
        gradient: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
        bgColor: 'rgba(245, 158, 11, 0.08)',
    },
    {
        type: AuthMethodType.EMAIL_OTP,
        label: 'Email OTP',
        description: 'Receive one-time codes via email',
        icon: <Email sx={{ fontSize: 32, color: 'white' }} />,
        capabilityKey: null,
        alwaysAvailable: true,
        gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
        bgColor: 'rgba(59, 130, 246, 0.08)',
    },
    {
        type: AuthMethodType.SMS_OTP,
        label: 'SMS OTP',
        description: 'Receive one-time codes via SMS',
        icon: <SmsOutlined sx={{ fontSize: 32, color: 'white' }} />,
        capabilityKey: null,
        alwaysAvailable: true,
        gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        bgColor: 'rgba(16, 185, 129, 0.08)',
    },
    {
        type: AuthMethodType.QR_CODE,
        label: 'QR Code',
        description: 'Scan QR codes for authentication',
        icon: <QrCode2 sx={{ fontSize: 32, color: 'white' }} />,
        capabilityKey: 'camera',
        alwaysAvailable: false,
        gradient: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
        bgColor: 'rgba(100, 116, 139, 0.08)',
    },
    {
        type: AuthMethodType.HARDWARE_KEY,
        label: 'Hardware Security Key / External Fingerprint',
        description: 'Register a FIDO2 security key or USB fingerprint scanner',
        icon: <Key sx={{ fontSize: 32, color: 'white' }} />,
        capabilityKey: 'webauthn',
        alwaysAvailable: false,
        gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        bgColor: 'rgba(245, 158, 11, 0.08)',
    },
    {
        type: AuthMethodType.NFC_DOCUMENT,
        label: 'NFC Document',
        description: 'Verify identity via NFC-enabled ID document',
        icon: <Nfc sx={{ fontSize: 32, color: 'white' }} />,
        capabilityKey: 'nfc',
        alwaysAvailable: false,
        gradient: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
        bgColor: 'rgba(124, 58, 237, 0.08)',
    },
]

const METHOD_LABELS: Record<string, string> = {
    FACE: 'Face Recognition',
    FINGERPRINT: 'Fingerprint',
    VOICE: 'Voice Recognition',
    TOTP: 'Authenticator App (TOTP)',
    EMAIL_OTP: 'Email OTP',
    SMS_OTP: 'SMS OTP',
    QR_CODE: 'QR Code',
    HARDWARE_KEY: 'Hardware Security Key / External Fingerprint',
    NFC_DOCUMENT: 'NFC Document',
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

    // Phone number dialog for SMS OTP enrollment
    const [phoneDialogOpen, setPhoneDialogOpen] = useState(false)
    const [phoneInput, setPhoneInput] = useState('')
    const [phoneSaving, setPhoneSaving] = useState(false)

    // Detect device capabilities on mount
    useEffect(() => {
        detectCapabilities().then((caps) => {
            setCapabilities(caps)
            setCapsLoading(false)
        })
    }, [])

    // Fetch access token for voice endpoints
    useEffect(() => {
        const tokenService = container.get<ITokenService>(TYPES.TokenService)
        tokenService.getAccessToken().then(setAccessToken).catch(() => {})
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
                    setActionLoading(type)
                    try {
                        await createEnrollment({
                            tenantId: user?.tenantId ?? 'system',
                            methodType: type,
                        })
                        setSnackbar({ open: true, message: t('enrollmentPage.enrolledSuccess', { method: METHOD_LABELS[type] ?? type }), severity: 'success' })
                    } catch (err) {
                        setSnackbar({ open: true, message: err instanceof Error ? err.message : t('enrollmentPage.enrollError', { method: METHOD_LABELS[type] ?? type }), severity: 'error' })
                    } finally {
                        setActionLoading(null)
                    }
                    break
                case AuthMethodType.EMAIL_OTP:
                case AuthMethodType.QR_CODE:
                    setActionLoading(type)
                    try {
                        await createEnrollment({
                            tenantId: user?.tenantId ?? 'system',
                            methodType: type,
                        })
                        setSnackbar({ open: true, message: t('enrollmentPage.enrolledSuccess', { method: METHOD_LABELS[type] ?? type }), severity: 'success' })
                    } catch (err) {
                        setSnackbar({ open: true, message: err instanceof Error ? err.message : t('enrollmentPage.enrollError', { method: METHOD_LABELS[type] ?? type }), severity: 'error' })
                    } finally {
                        setActionLoading(null)
                    }
                    break
                case AuthMethodType.NFC_DOCUMENT:
                    if ('NDEFReader' in window) {
                        setNfcEnrollOpen(true)
                    } else {
                        setSnackbar({ open: true, message: 'NFC enrollment requires Chrome on Android. Your browser does not support Web NFC.', severity: 'warning' })
                    }
                    break
                default:
                    setSnackbar({ open: true, message: `${METHOD_LABELS[type] ?? type} enrollment is not yet supported in the browser.`, severity: 'info' })
            }
        },
        [createEnrollment, user?.tenantId]
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
                        setSnackbar({ open: true, message: 'NFC requires Chrome on Android.', severity: 'warning' })
                    }
                    break
                case AuthMethodType.EMAIL_OTP:
                case AuthMethodType.SMS_OTP:
                case AuthMethodType.QR_CODE:
                    setSnackbar({
                        open: true,
                        message: `To test ${METHOD_LABELS[type] ?? type}, use it as your auth method during login.`,
                        severity: 'info',
                    })
                    break
            }
        },
        []
    )

    // Handle face enrollment completion
    const handleFaceEnrollComplete = useCallback(
        async (images: string[]) => {
            if (!userId || images.length === 0) return
            setActionLoading(AuthMethodType.FACE)
            setActionError(null)
            try {
                const biometric = getBiometricService()
                // Send all captured images — enrollFace will use /enroll/multi
                // for 2+ images (quality-weighted template fusion)
                await biometric.enrollFace(userId, images, user?.tenantId)

                // Create enrollment record — backend auto-completes to ENROLLED
                await createEnrollment({
                    tenantId: user?.tenantId ?? 'system',
                    methodType: AuthMethodType.FACE,
                })

                setFaceEnrollOpen(false)
                refetchEnrollments()
                setSnackbar({ open: true, message: 'Face Recognition enrolled successfully', severity: 'success' })
            } catch (err) {
                setFaceEnrollOpen(false)
                setSnackbar({
                    open: true,
                    message: err instanceof Error ? err.message : 'Face enrollment failed. Please try again.',
                    severity: 'error',
                })
            } finally {
                setActionLoading(null)
            }
        },
        [userId, user?.tenantId, createEnrollment]
    )

    // Handle revoke
    const handleRevoke = useCallback(
        async (type: AuthMethodType) => {
            setActionLoading(type)
            setActionError(null)
            setActionSuccess(null)
            try {
                await revokeEnrollment(type)
                setSnackbar({ open: true, message: `${METHOD_LABELS[type] ?? type} enrollment revoked`, severity: 'success' })
            } catch (err) {
                setSnackbar({ open: true, message: err instanceof Error ? err.message : `Failed to revoke ${METHOD_LABELS[type] ?? type}`, severity: 'error' })
            } finally {
                setActionLoading(null)
            }
        },
        [revokeEnrollment]
    )

    const loading = enrollmentsLoading || capsLoading

    if (!user) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="warning">Please log in to manage your enrollments.</Alert>
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
                        Biometric Enrollment
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
                        Manage your authentication methods and biometric enrollments
                    </Typography>
                </Box>
                <Tooltip title="Refresh enrollment status">
                    <IconButton
                        onClick={() => refetchEnrollments()}
                        disabled={loading}
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
                    label={`${enrollments.filter((e) => e.isSuccessful()).length} enrolled`}
                    color="success"
                    variant="outlined"
                />
                <Chip
                    icon={<WarningAmber />}
                    label={`${METHOD_CONFIGS.filter((c) => !isMethodAvailable(c)).length} unavailable on this device`}
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
                                                        label="Enrolled"
                                                        size="small"
                                                        color="success"
                                                        sx={{ fontWeight: 600 }}
                                                    />
                                                ) : !available ? (
                                                    <Chip
                                                        label="Unavailable"
                                                        size="small"
                                                        color="default"
                                                        sx={{ fontWeight: 500 }}
                                                    />
                                                ) : (
                                                    <Chip
                                                        label="Not enrolled"
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
                                                {config.label}
                                            </Typography>
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                                sx={{ mb: 2, minHeight: 40 }}
                                            >
                                                {config.description}
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
                                                        Enroll
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
                                                            Test
                                                        </Button>
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
                                                            Revoke
                                                        </Button>
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
                onSuccess={() => {
                    createEnrollment({
                        tenantId: user?.tenantId ?? 'system',
                        methodType: AuthMethodType.TOTP,
                    }).catch(() => {})
                    setTotpEnrollOpen(false)
                    refetchEnrollments()
                    setSnackbar({ open: true, message: 'Authenticator App (TOTP) enrolled successfully', severity: 'success' })
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
                                ? METHOD_LABELS[AuthMethodType.FINGERPRINT]
                                : METHOD_LABELS[AuthMethodType.HARDWARE_KEY],
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
                onSuccess={(action) => {
                    if (action === 'enroll') {
                        createEnrollment({
                            tenantId: user?.tenantId ?? 'system',
                            methodType: AuthMethodType.VOICE,
                        }).catch(() => {})
                        refetchEnrollments()
                        setSnackbar({ open: true, message: 'Voice Recognition enrolled successfully', severity: 'success' })
                    }
                }}
            />

            {/* NFC Enrollment Dialog */}
            <NfcEnrollment
                open={nfcEnrollOpen}
                userId={userId}
                onClose={() => setNfcEnrollOpen(false)}
                onSuccess={() => {
                    createEnrollment({
                        tenantId: user?.tenantId ?? 'system',
                        methodType: AuthMethodType.NFC_DOCUMENT,
                    }).catch(() => {})
                    setNfcEnrollOpen(false)
                    refetchEnrollments()
                    setSnackbar({ open: true, message: 'NFC Document enrolled successfully', severity: 'success' })
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
                        Cancel
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
                                // Now create the SMS OTP enrollment
                                await createEnrollment({
                                    tenantId: user?.tenantId ?? 'system',
                                    methodType: AuthMethodType.SMS_OTP,
                                })
                                setPhoneDialogOpen(false)
                                setPhoneInput('')
                                setSnackbar({ open: true, message: t('enrollmentPage.phoneDialog.successMessage'), severity: 'success' })
                            } catch (err) {
                                setSnackbar({
                                    open: true,
                                    message: err instanceof Error ? err.message : 'Failed to save phone number',
                                    severity: 'error',
                                })
                            } finally {
                                setPhoneSaving(false)
                            }
                        }}
                    >
                        {phoneSaving ? t('enrollmentPage.phoneDialog.saving') : t('enrollmentPage.phoneDialog.saveAndEnroll')}
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
