import { useState, useEffect, useCallback } from 'react'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Typography,
} from '@mui/material'
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
    ArrowBack,
} from '@mui/icons-material'
import { motion, AnimatePresence } from 'framer-motion'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import { AuthMethodType } from '@domain/models/AuthMethod'
import { EnrollmentStatus, type EnrollmentJSON } from '@domain/models/Enrollment'
import MultiStepAuthFlow from './MultiStepAuthFlow'
import type { AuthSessionResponse } from '@core/repositories/AuthSessionRepository'

const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

interface SecondaryAuthFlowProps {
    userId: string
    tenantId: string
    onComplete: () => void
    onSkip: () => void
}

interface EnrolledMethod {
    type: string
    label: string
    icon: React.ReactNode
    gradient: string
}

const METHOD_META: Record<string, { label: string; icon: React.ReactNode; gradient: string }> = {
    [AuthMethodType.FACE]: {
        label: 'Face Recognition',
        icon: <Face sx={{ fontSize: 28, color: 'white' }} />,
        gradient: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
    },
    [AuthMethodType.FINGERPRINT]: {
        label: 'Fingerprint',
        icon: <Fingerprint sx={{ fontSize: 28, color: 'white' }} />,
        gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    },
    [AuthMethodType.VOICE]: {
        label: 'Voice Recognition',
        icon: <Mic sx={{ fontSize: 28, color: 'white' }} />,
        gradient: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
    },
    [AuthMethodType.TOTP]: {
        label: 'Authenticator App',
        icon: <PhonelinkLock sx={{ fontSize: 28, color: 'white' }} />,
        gradient: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
    },
    [AuthMethodType.EMAIL_OTP]: {
        label: 'Email OTP',
        icon: <Email sx={{ fontSize: 28, color: 'white' }} />,
        gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    },
    [AuthMethodType.SMS_OTP]: {
        label: 'SMS OTP',
        icon: <SmsOutlined sx={{ fontSize: 28, color: 'white' }} />,
        gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    },
    [AuthMethodType.QR_CODE]: {
        label: 'QR Code',
        icon: <QrCode2 sx={{ fontSize: 28, color: 'white' }} />,
        gradient: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
    },
    [AuthMethodType.HARDWARE_KEY]: {
        label: 'Hardware Key',
        icon: <Key sx={{ fontSize: 28, color: 'white' }} />,
        gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    },
    [AuthMethodType.NFC_DOCUMENT]: {
        label: 'NFC Document',
        icon: <Nfc sx={{ fontSize: 28, color: 'white' }} />,
        gradient: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
    },
}

interface AuthFlowListResponse {
    id: string
    operationType: string
    steps: Array<{
        stepOrder: number
        authMethodType: string
        isRequired: boolean
        status?: string
    }>
}

/**
 * SecondaryAuthFlow
 *
 * After primary login (password), this component checks:
 * 1. If the user has enrolled biometric methods
 * 2. If the tenant has a configured auth flow for LOGIN
 *
 * If a flow exists, it starts an auth session and uses MultiStepAuthFlow.
 * If no flow but enrollments exist, it shows a method selector.
 * If no enrollments, it calls onSkip to complete login immediately.
 */
export default function SecondaryAuthFlow({
    userId,
    tenantId,
    onComplete,
    onSkip,
}: SecondaryAuthFlowProps) {
    const httpClient = useService<IHttpClient>(TYPES.HttpClient)

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [enrolledMethods, setEnrolledMethods] = useState<EnrolledMethod[]>([])
    const [authSession, setAuthSession] = useState<AuthSessionResponse | null>(null)
    const [verifying, setVerifying] = useState(false)

    // Check enrollments and tenant auth flows
    useEffect(() => {
        let cancelled = false

        const checkSecondaryAuth = async () => {
            setLoading(true)
            setError(null)

            try {
                // Step 1: Check user enrollments
                let enrollmentData: EnrollmentJSON[] = []
                try {
                    const enrollRes = await httpClient.get<EnrollmentJSON[]>(
                        `/enrollments/users/${userId}/enrollments`
                    )
                    enrollmentData = enrollRes.data
                } catch {
                    // No enrollments endpoint or error - skip secondary auth
                    if (!cancelled) onSkip()
                    return
                }

                // Filter to successfully enrolled methods (not PASSWORD)
                const enrolled = enrollmentData.filter(
                    (e) =>
                        (e.status === EnrollmentStatus.ENROLLED ||
                            e.status === EnrollmentStatus.SUCCESS) &&
                        e.authMethodType &&
                        e.authMethodType !== AuthMethodType.PASSWORD
                )

                if (enrolled.length === 0) {
                    // No biometric enrollments -- skip secondary auth
                    if (!cancelled) onSkip()
                    return
                }

                // Map to display format
                const methods: EnrolledMethod[] = enrolled
                    .map((e) => {
                        const meta = METHOD_META[e.authMethodType ?? '']
                        if (!meta) return null
                        return {
                            type: e.authMethodType!,
                            ...meta,
                        }
                    })
                    .filter(Boolean) as EnrolledMethod[]

                // Step 2: Check if tenant has a configured auth flow for LOGIN
                try {
                    const flowRes = await httpClient.get<AuthFlowListResponse[]>(
                        `/tenants/${tenantId}/auth-flows`,
                        { params: { operationType: 'APP_LOGIN' } }
                    )

                    const flows = flowRes.data
                    const loginFlow = flows.find(
                        (f) => f.operationType === 'APP_LOGIN' && f.steps?.length > 0
                    )

                    if (loginFlow) {
                        // Start an auth session with this flow
                        const sessionRes = await httpClient.post<AuthSessionResponse>(
                            '/auth/sessions',
                            {
                                tenantId,
                                userId,
                                operationType: 'APP_LOGIN',
                            }
                        )

                        if (!cancelled) {
                            setAuthSession(sessionRes.data)
                            setLoading(false)
                        }
                        return
                    }
                } catch {
                    // No auth flow configured -- fall through to manual method selection
                }

                if (!cancelled) {
                    setEnrolledMethods(methods)
                    setLoading(false)
                }
            } catch (err) {
                if (!cancelled) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : 'Failed to check secondary authentication'
                    )
                    setLoading(false)
                }
            }
        }

        if (userId && tenantId) {
            checkSecondaryAuth()
        }

        return () => {
            cancelled = true
        }
    }, [userId, tenantId, httpClient, onSkip])

    // Handle auth session completion
    const handleSessionComplete = useCallback(() => {
        onComplete()
    }, [onComplete])

    // Handle manual method selection and verification
    const handleMethodSelect = useCallback(
        async (_method: string) => {
            setVerifying(true)
            setError(null)

            try {
                // Start a single-step auth session for the selected method
                const sessionRes = await httpClient.post<AuthSessionResponse>(
                    '/auth/sessions',
                    {
                        tenantId,
                        userId,
                        operationType: 'APP_LOGIN',
                    }
                )
                setAuthSession(sessionRes.data)
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : 'Failed to start verification session'
                )
                setVerifying(false)
            }
        },
        [httpClient, tenantId, userId]
    )

    // If we have an active auth session, use MultiStepAuthFlow
    if (authSession) {
        return (
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background:
                        'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f64f59 100%)',
                    backgroundSize: '400% 400%',
                    animation: 'gradientShift 15s ease infinite',
                    '@keyframes gradientShift': {
                        '0%': { backgroundPosition: '0% 50%' },
                        '50%': { backgroundPosition: '100% 50%' },
                        '100%': { backgroundPosition: '0% 50%' },
                    },
                    p: 2,
                }}
            >
                <MultiStepAuthFlow
                    sessionId={authSession.sessionId}
                    steps={authSession.steps.map((s) => ({
                        stepOrder: s.stepOrder,
                        methodType: s.authMethodType,
                        status: s.status,
                        isRequired: s.isRequired,
                    }))}
                    onComplete={handleSessionComplete}
                    onCancel={onSkip}
                />
            </Box>
        )
    }

    // Loading state
    if (loading) {
        return (
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background:
                        'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f64f59 100%)',
                }}
            >
                <Card
                    sx={{
                        borderRadius: '24px',
                        p: 4,
                        background: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(20px)',
                        textAlign: 'center',
                    }}
                >
                    <CircularProgress sx={{ mb: 2 }} />
                    <Typography variant="body1" color="text.secondary">
                        Checking security requirements...
                    </Typography>
                </Card>
            </Box>
        )
    }

    // Method selector (no auth flow configured, but user has enrollments)
    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background:
                    'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f64f59 100%)',
                backgroundSize: '400% 400%',
                animation: 'gradientShift 15s ease infinite',
                '@keyframes gradientShift': {
                    '0%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' },
                    '100%': { backgroundPosition: '0% 50%' },
                },
                p: 2,
            }}
        >
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: easeOut }}
                style={{ width: '100%', maxWidth: 480 }}
            >
                <Card
                    sx={{
                        borderRadius: '24px',
                        background: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(20px)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    }}
                >
                    <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                        {/* Header */}
                        <Typography
                            variant="h5"
                            fontWeight={700}
                            sx={{
                                mb: 0.5,
                                background:
                                    'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                backgroundClip: 'text',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            Additional Verification
                        </Typography>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 3 }}
                        >
                            Choose a verification method to complete your login
                        </Typography>

                        {error && (
                            <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
                                {error}
                            </Alert>
                        )}

                        {/* Method list */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            <AnimatePresence>
                                {enrolledMethods.map((method, index) => (
                                    <motion.div
                                        key={method.type}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{
                                            delay: index * 0.1,
                                            duration: 0.3,
                                            ease: easeOut,
                                        }}
                                    >
                                        <Button
                                            fullWidth
                                            variant="outlined"
                                            onClick={() =>
                                                handleMethodSelect(method.type)
                                            }
                                            disabled={verifying}
                                            sx={{
                                                py: 1.5,
                                                px: 2,
                                                borderRadius: '14px',
                                                justifyContent: 'flex-start',
                                                gap: 2,
                                                borderColor: 'divider',
                                                textTransform: 'none',
                                                '&:hover': {
                                                    borderColor: 'primary.main',
                                                    backgroundColor:
                                                        'rgba(99, 102, 241, 0.04)',
                                                },
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    width: 44,
                                                    height: 44,
                                                    borderRadius: '12px',
                                                    background: method.gradient,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0,
                                                }}
                                            >
                                                {method.icon}
                                            </Box>
                                            <Typography
                                                variant="body1"
                                                fontWeight={600}
                                                color="text.primary"
                                            >
                                                {method.label}
                                            </Typography>
                                        </Button>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </Box>

                        {/* Skip button */}
                        <Box sx={{ textAlign: 'center', mt: 3 }}>
                            <Button
                                variant="text"
                                size="small"
                                onClick={onSkip}
                                startIcon={<ArrowBack />}
                                disabled={verifying}
                                sx={{
                                    color: 'text.secondary',
                                    fontWeight: 500,
                                    '&:hover': {
                                        color: 'primary.main',
                                        backgroundColor: 'rgba(99, 102, 241, 0.06)',
                                    },
                                }}
                            >
                                Skip for now
                            </Button>
                        </Box>
                    </CardContent>
                </Card>
            </motion.div>
        </Box>
    )
}
