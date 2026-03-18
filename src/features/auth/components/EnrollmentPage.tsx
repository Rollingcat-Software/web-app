import { useState, useEffect, useCallback, useMemo } from 'react'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Grid,
    IconButton,
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
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../hooks/useAuth'
import { useUserEnrollments } from '@features/enrollments/hooks/useEnrollments'
import { AuthMethodType } from '@domain/models/AuthMethod'
import { EnrollmentStatus } from '@domain/models/Enrollment'
import FaceEnrollmentFlow from './FaceEnrollmentFlow'
import TotpEnrollment from './TotpEnrollment'
import WebAuthnEnrollment from './WebAuthnEnrollment'
import VoiceEnrollmentFlow from './VoiceEnrollmentFlow'
import { getBiometricService } from '@core/services/BiometricService'

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
        label: 'Fingerprint / Biometric',
        description: 'Use your device biometric (Touch ID, Windows Hello)',
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
        label: 'Hardware Security Key',
        description: 'Register a FIDO2/WebAuthn hardware key',
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
    try {
        if (window.PublicKeyCredential) {
            caps.webauthnPlatform =
                await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        } else {
            caps.webauthnPlatform = false
        }
    } catch {
        caps.webauthnPlatform = false
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

    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [actionError, setActionError] = useState<string | null>(null)
    const [actionSuccess, setActionSuccess] = useState<string | null>(null)

    // Detect device capabilities on mount
    useEffect(() => {
        detectCapabilities().then((caps) => {
            setCapabilities(caps)
            setCapsLoading(false)
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
                case AuthMethodType.EMAIL_OTP:
                case AuthMethodType.SMS_OTP:
                case AuthMethodType.QR_CODE:
                    // For these methods, just create the enrollment record
                    setActionLoading(type)
                    try {
                        await createEnrollment({
                            tenantId: user?.tenantId ?? 'system',
                            methodType: type,
                        })
                        setActionSuccess(`${type} enrollment created successfully`)
                    } catch (err) {
                        setActionError(
                            err instanceof Error ? err.message : `Failed to enroll ${type}`
                        )
                    } finally {
                        setActionLoading(null)
                    }
                    break
                default:
                    setActionError(`Enrollment for ${type} is not yet supported in the browser.`)
            }
        },
        [createEnrollment, user?.tenantId]
    )

    // Handle face enrollment completion
    const handleFaceEnrollComplete = useCallback(
        async (images: string[]) => {
            if (!userId || images.length === 0) return
            setActionLoading(AuthMethodType.FACE)
            setActionError(null)
            try {
                const biometric = getBiometricService()
                await biometric.enrollFace(userId, images[0], user?.tenantId)

                // Also create the enrollment record in the backend
                await createEnrollment({
                    tenantId: user?.tenantId ?? 'system',
                    methodType: AuthMethodType.FACE,
                })

                setActionSuccess('Face enrollment completed successfully')
            } catch (err) {
                setActionError(
                    err instanceof Error ? err.message : 'Face enrollment failed'
                )
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
                setActionSuccess(`${type} enrollment revoked`)
            } catch (err) {
                setActionError(
                    err instanceof Error ? err.message : `Failed to revoke ${type}`
                )
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

            {/* Alerts */}
            <AnimatePresence>
                {actionError && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                    >
                        <Alert
                            severity="error"
                            onClose={() => setActionError(null)}
                            sx={{ mb: 2, borderRadius: '12px' }}
                        >
                            {actionError}
                        </Alert>
                    </motion.div>
                )}
                {actionSuccess && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                    >
                        <Alert
                            severity="success"
                            onClose={() => setActionSuccess(null)}
                            sx={{ mb: 2, borderRadius: '12px' }}
                        >
                            {actionSuccess}
                        </Alert>
                    </motion.div>
                )}
            </AnimatePresence>

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
                                                        <Button
                                                            variant="outlined"
                                                            size="small"
                                                            onClick={() =>
                                                                handleEnroll(config.type)
                                                            }
                                                            disabled={isLoading}
                                                            sx={{
                                                                borderRadius: '8px',
                                                                fontWeight: 600,
                                                                textTransform: 'none',
                                                            }}
                                                        >
                                                            Re-enroll
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
                    setTotpEnrollOpen(false)
                    refetchEnrollments()
                    setActionSuccess('TOTP setup completed successfully')
                }}
            />

            {/* WebAuthn Enrollment Dialog (Fingerprint / Hardware Key) */}
            <WebAuthnEnrollment
                open={webauthnEnrollOpen}
                userId={userId}
                mode={webauthnMode}
                onClose={() => setWebauthnEnrollOpen(false)}
                onSuccess={() => {
                    setWebauthnEnrollOpen(false)
                    refetchEnrollments()
                    setActionSuccess(
                        webauthnMode === 'platform'
                            ? 'Fingerprint enrollment completed'
                            : 'Hardware key registration completed'
                    )
                }}
            />

            {/* Voice Enrollment Dialog (with WAV conversion, enroll/verify/search) */}
            <VoiceEnrollmentFlow
                open={voiceEnrollOpen}
                userId={userId}
                apiBaseUrl={import.meta.env.VITE_API_BASE_URL || 'https://auth.rollingcatsoftware.com/api/v1'}
                token={null}
                onClose={() => setVoiceEnrollOpen(false)}
                onSuccess={(action) => {
                    if (action === 'enroll') {
                        createEnrollment({
                            tenantId: user?.tenantId ?? 'system',
                            methodType: AuthMethodType.VOICE,
                        }).catch(() => {})
                        refetchEnrollments()
                        setActionSuccess('Voice enrollment completed successfully')
                    }
                }}
            />
        </Box>
    )
}
