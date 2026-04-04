import { useState, useEffect, useCallback, useRef } from 'react'
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
    ArrowBack,
    VerifiedUser,
} from '@mui/icons-material'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import { AuthMethodType } from '@domain/models/AuthMethod'
import { EnrollmentStatus, type EnrollmentJSON } from '@domain/models/Enrollment'
import { FivucsasAuth } from '@/verify-app/sdk/FivucsasAuth'
import type { AuthSessionResponse } from '@core/repositories/AuthSessionRepository'

const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

interface SecondaryAuthFlowProps {
    userId: string
    tenantId: string
    onComplete: () => void
    onSkip: () => void
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
 * If a flow exists, it starts an auth session and uses the FIVUCSAS
 * embeddable verify widget (dogfooding — our own platform uses its own widget).
 * If no enrollments, it calls onSkip to complete login immediately.
 */
export default function SecondaryAuthFlow({
    userId,
    tenantId,
    onComplete,
    onSkip,
}: SecondaryAuthFlowProps) {
    const { t } = useTranslation()
    const httpClient = useService<IHttpClient>(TYPES.HttpClient)

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [authSession, setAuthSession] = useState<AuthSessionResponse | null>(null)
    const [widgetActive, setWidgetActive] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const authInstanceRef = useRef<FivucsasAuth | null>(null)
    const skippedRef = useRef(false)

    // If userId or tenantId is missing, skip immediately
    useEffect(() => {
        if ((!userId || !tenantId) && !skippedRef.current) {
            skippedRef.current = true
            onSkip()
        }
    }, [userId, tenantId, onSkip])

    // Check enrollments and tenant auth flows
    useEffect(() => {
        if (!userId || !tenantId) return

        let cancelled = false

        const checkSecondaryAuth = async () => {
            setLoading(true)
            setError(null)

            try {
                // Step 1: Check user enrollments
                let enrollmentData: EnrollmentJSON[] = []
                try {
                    const enrollRes = await httpClient.get<EnrollmentJSON[]>(
                        `/users/${userId}/enrollments`
                    )
                    enrollmentData = enrollRes.data ?? []
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
                    // No auth flow configured -- skip secondary auth
                }

                // No auth flow configured and no manual fallback needed -- skip
                if (!cancelled) onSkip()
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

        checkSecondaryAuth()

        return () => {
            cancelled = true
        }
    }, [userId, tenantId, httpClient, onSkip])

    // Launch the FIVUCSAS verify widget when auth session is ready and container is mounted
    useEffect(() => {
        if (!authSession || !containerRef.current || widgetActive) return

        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://auth.rollingcatsoftware.com/api/v1'
        const baseUrl = window.location.origin + '/verify'

        let auth: FivucsasAuth
        try {
            auth = new FivucsasAuth({
                clientId: 'fivucsas-web-app',
                baseUrl,
                apiBaseUrl,
                locale: (document.documentElement.lang as 'en' | 'tr') || 'en',
                theme: { primaryColor: '#6366f1', borderRadius: '12px' },
            })
        } catch (initErr) {
            setError(initErr instanceof Error ? initErr.message : 'Failed to initialize verification widget')
            return
        }

        authInstanceRef.current = auth
        setWidgetActive(true)

        const sessionId = authSession.sessionId ?? (authSession as unknown as Record<string, unknown>).id as string
        if (!sessionId) {
            setError('Invalid auth session — no session ID')
            setWidgetActive(false)
            return
        }

        auth.verify({
            flow: 'login',
            userId,
            sessionId,
            container: containerRef.current,
            onStepChange: (step) => {
                if (import.meta.env.DEV) {
                    console.log('[SecondaryAuth] Step change:', step)
                }
            },
            onError: (err) => {
                setError(err.message)
                setWidgetActive(false)
            },
            onCancel: () => {
                setWidgetActive(false)
                onSkip()
            },
        }).then(() => {
            // Verification complete
            onComplete()
        }).catch((err) => {
            // Handle cancellation gracefully
            if (err instanceof Error && err.message.includes('cancelled')) {
                onSkip()
            } else if (err instanceof Error && err.message.includes('destroyed')) {
                // Component unmounted — no action needed
            } else {
                setError(err instanceof Error ? err.message : 'Verification failed')
                setWidgetActive(false)
            }
        })

        return () => {
            try { authInstanceRef.current?.destroy() } catch { /* ignore cleanup errors */ }
            authInstanceRef.current = null
        }
    }, [authSession, userId, onComplete, onSkip, widgetActive])

    const handleRetry = useCallback(() => {
        setError(null)
        setWidgetActive(false)
        setAuthSession(null)
        setLoading(true)
    }, [])

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
                        {t('secondaryAuth.checking')}
                    </Typography>
                </Card>
            </Box>
        )
    }

    // Widget view — embeds the FIVUCSAS verify-app inline
    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
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
                            {t('secondaryAuth.title')}
                        </Typography>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 3 }}
                        >
                            {t('secondaryAuth.subtitle')}
                        </Typography>

                        {error && (
                            <Alert
                                severity="error"
                                sx={{ mb: 2, borderRadius: '12px' }}
                                action={
                                    <Button color="inherit" size="small" onClick={handleRetry}>
                                        {t('secondaryAuth.retry')}
                                    </Button>
                                }
                            >
                                {error}
                            </Alert>
                        )}

                        {/* Verify widget container */}
                        <Box
                            ref={containerRef}
                            sx={{
                                minHeight: 300,
                                borderRadius: '12px',
                                overflow: 'hidden',
                                border: '1px solid',
                                borderColor: 'divider',
                            }}
                        />

                        {/* "Secured by FIVUCSAS" badge */}
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 0.5,
                                mt: 2,
                                opacity: 0.5,
                            }}
                        >
                            <VerifiedUser sx={{ fontSize: 14, color: 'text.disabled' }} />
                            <Typography variant="caption" color="text.disabled">
                                {t('secondaryAuth.securedBy')}
                            </Typography>
                        </Box>

                        {/* Skip button */}
                        <Box sx={{ textAlign: 'center', mt: 2 }}>
                            <Button
                                variant="text"
                                size="small"
                                onClick={onSkip}
                                startIcon={<ArrowBack />}
                                sx={{
                                    color: 'text.secondary',
                                    fontWeight: 500,
                                    '&:hover': {
                                        color: 'primary.main',
                                        backgroundColor: 'rgba(99, 102, 241, 0.06)',
                                    },
                                }}
                            >
                                {t('secondaryAuth.skipForNow')}
                            </Button>
                        </Box>
                    </CardContent>
                </Card>
            </motion.div>
        </Box>
    )
}
