/**
 * WidgetAuthPage — Minimal login page rendered inside the SDK iframe.
 *
 * After a successful login it sends the JWT token and user info back to the
 * parent window via postMessage instead of navigating to the dashboard.
 *
 * URL parameters (set by FivucsasAuth SDK):
 *   client_id, flow, user_id, locale, api_base_url, theme
 */

import { useState, useEffect, useCallback } from 'react'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    createTheme,
    IconButton,
    InputAdornment,
    TextField,
    ThemeProvider,
    Typography,
} from '@mui/material'
import {
    ArrowForward,
    EmailOutlined,
    Fingerprint,
    LockOutlined,
    Visibility,
    VisibilityOff,
    VerifiedUser,
    CheckCircle,
} from '@mui/icons-material'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'

import TotpStep from '@/features/auth/components/steps/TotpStep'
import SmsOtpStep from '@/features/auth/components/steps/SmsOtpStep'
import FaceCaptureStep from '@/features/auth/components/steps/FaceCaptureStep'
import VoiceStep from '@/features/auth/components/steps/VoiceStep'
import FingerprintStep from '@/features/auth/components/steps/FingerprintStep'
import QrCodeStep from '@/features/auth/components/steps/QrCodeStep'
import HardwareKeyStep from '@/features/auth/components/steps/HardwareKeyStep'
import NfcStep from '@/features/auth/components/steps/NfcStep'

// ─── Types ──────────────────────────────────────────────────────

interface WidgetParams {
    clientId: string
    flow: string
    userId: string
    locale: string
    apiBaseUrl: string
    theme: string
}

const loginSchema = z.object({
    email: z.string().min(1, 'Email is required').email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
})

type LoginFormData = z.infer<typeof loginSchema>

// ─── Helpers ────────────────────────────────────────────────────

function parseWidgetParams(): WidgetParams {
    const params = new URLSearchParams(window.location.search)
    return {
        clientId: params.get('client_id') || '',
        flow: params.get('flow') || 'login',
        userId: params.get('user_id') || '',
        locale: params.get('locale') || 'en',
        apiBaseUrl:
            params.get('api_base_url') ||
            import.meta.env.VITE_API_BASE_URL ||
            'https://api.fivucsas.com/api/v1',
        theme: params.get('theme') || 'light',
    }
}

/** Cached parent origin, set from URL referrer or config message */
let cachedParentOrigin: string | null = null

function sendToParent(msg: { type: string; payload: Record<string, unknown> }): void {
    if (window.parent !== window) {
        // Use cached origin if available; otherwise derive from document.referrer
        // Never use '*' to prevent leaking tokens to malicious parents
        const targetOrigin = cachedParentOrigin || (document.referrer ? new URL(document.referrer).origin : null)
        if (targetOrigin) {
            window.parent.postMessage(msg, targetOrigin)
        }
    }
}

// ─── Component ──────────────────────────────────────────────────

type WidgetStep = 'login' | '2fa' | 'success'

// Force light theme inside widget iframe regardless of user's dark mode preference
const widgetLightTheme = createTheme({ palette: { mode: 'light' } })

function WidgetAuthPageInner() {
    const { t } = useTranslation()
    const isInIframe = typeof window !== 'undefined' && window !== window.parent
    const [config] = useState(() => parseWidgetParams())
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    // 2FA state
    const [step, setStep] = useState<WidgetStep>('login')
    const [twoFactorCode, setTwoFactorCode] = useState('')
    const [maskedEmail, setMaskedEmail] = useState('')
    const [pendingAuthData, setPendingAuthData] = useState<Record<string, unknown> | null>(null)
    const [pendingEmail, setPendingEmail] = useState('')
    const [twoFactorMethod, setTwoFactorMethod] = useState<string>('EMAIL_OTP')
    const [stepLoading, setStepLoading] = useState(false)
    const [stepError, setStepError] = useState<string | undefined>(undefined)

    // Send resize messages to parent when in iframe
    useEffect(() => {
        if (!isInIframe) return
        const sendResize = () => {
            const height = document.documentElement.scrollHeight
            window.parent.postMessage({
                type: 'fivucsas:resize',
                payload: { height: Math.min(height, 700) }
            }, '*')
        }
        sendResize()
        const observer = new ResizeObserver(sendResize)
        observer.observe(document.documentElement)
        return () => observer.disconnect()
    }, [isInIframe, step, loading, error])

    // Notify parent that the widget iframe is ready
    useEffect(() => {
        sendToParent({
            type: 'fivucsas:ready',
            payload: { version: '1.0.0', timestamp: Date.now() },
        })

        // Listen for config messages from parent and cache the origin
        const handler = (event: MessageEvent) => {
            const data = event.data
            if (
                data &&
                typeof data === 'object' &&
                data.type === 'fivucsas:config'
            ) {
                // Cache the verified parent origin for secure postMessage targeting
                if (event.origin && event.origin !== 'null') {
                    cachedParentOrigin = event.origin
                }
                // Could apply theme/locale overrides here
            }
        }
        window.addEventListener('message', handler)
        return () => window.removeEventListener('message', handler)
    }, [])

    const {
        control,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: '', password: '' },
    })

    /** Send success result to parent after all auth steps complete */
    const completeAuth = useCallback(
        (authData: Record<string, unknown>, email: string) => {
            setSuccess(true)
            setStep('success')

            sendToParent({
                type: 'fivucsas:complete',
                payload: {
                    success: true,
                    accessToken: authData.accessToken as string,
                    userId: (authData.user as Record<string, unknown>)?.id || config.userId,
                    email: (authData.user as Record<string, unknown>)?.email || email,
                    displayName:
                        (authData.user as Record<string, unknown>)?.firstName && (authData.user as Record<string, unknown>)?.lastName
                            ? `${(authData.user as Record<string, unknown>)?.firstName} ${(authData.user as Record<string, unknown>)?.lastName}`
                            : (authData.user as Record<string, unknown>)?.email || email,
                    sessionId: (authData.sessionId as string) || `widget-${Date.now()}`,
                    completedMethods: authData.twoFactorRequired ? ['PASSWORD', 'EMAIL_OTP'] : ['PASSWORD'],
                    authCode: authData.accessToken as string,
                    timestamp: Date.now(),
                },
            })
        },
        [config]
    )

    const onSubmit = useCallback(
        async (data: LoginFormData) => {
            setLoading(true)
            setError(null)

            try {
                const response = await fetch(`${config.apiBaseUrl}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: data.email,
                        password: data.password,
                        clientId: config.clientId || undefined,
                    }),
                })

                if (!response.ok) {
                    await response.json().catch(() => ({}))
                    throw new Error(t('widgetAuth.authFailed'))
                }

                const body = await response.json()
                // The API wraps response in { data: { accessToken, refreshToken, user, ... } }
                const authData = body.data || body

                if (authData.twoFactorRequired) {
                    // Store auth data and switch to 2FA step
                    setPendingAuthData(authData)
                    setPendingEmail(data.email)
                    const method = (authData.twoFactorMethod as string) || 'EMAIL_OTP'
                    setTwoFactorMethod(method)

                    // For email OTP, send the code immediately
                    if (method === 'EMAIL_OTP') {
                        try {
                            const sendResp = await fetch(`${config.apiBaseUrl}/auth/2fa/send`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${authData.accessToken}`,
                                },
                            })
                            if (sendResp.ok) {
                                const sendBody = await sendResp.json()
                                setMaskedEmail(sendBody.email || '')
                            }
                        } catch {
                            // If sending fails, still show the 2FA input
                        }
                    }

                    setStep('2fa')
                } else {
                    // No 2FA required — complete immediately
                    completeAuth(authData, data.email)
                }
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : t('widgetAuth.authFailed')
                setError(message)
                sendToParent({
                    type: 'fivucsas:error',
                    payload: {
                        error: message,
                        code: 'AUTH_FAILED',
                        timestamp: Date.now(),
                    },
                })
            } finally {
                setLoading(false)
            }
        },
        [config, completeAuth, t]
    )

    /** Handle 2FA code verification */
    const onVerify2FA = useCallback(async () => {
        if (!pendingAuthData || !twoFactorCode.trim()) return

        setLoading(true)
        setError(null)

        try {
            const response = await fetch(`${config.apiBaseUrl}/auth/2fa/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${pendingAuthData.accessToken}`,
                },
                body: JSON.stringify({ code: twoFactorCode.trim() }),
            })

            if (!response.ok) {
                throw new Error(t('widgetAuth.verificationFailed'))
            }

            const body = await response.json()
            if (body.success === false) {
                throw new Error(t('widgetAuth.invalidCode'))
            }

            // 2FA verified — complete auth
            completeAuth(pendingAuthData, pendingEmail)
        } catch (err) {
            const message =
                err instanceof Error ? err.message : t('widgetAuth.verificationFailed')
            setError(message)
        } finally {
            setLoading(false)
        }
    }, [config, pendingAuthData, pendingEmail, twoFactorCode, completeAuth, t])

    // ─── Generic 2FA verify helper for non-email methods ─────
    const verifyMethodStep = useCallback(
        async (methodType: string, data: Record<string, unknown>) => {
            if (!pendingAuthData) return
            setStepLoading(true)
            setStepError(undefined)
            try {
                const response = await fetch(`${config.apiBaseUrl}/auth/2fa/verify-method`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${pendingAuthData.accessToken}`,
                    },
                    body: JSON.stringify({ method: methodType, data }),
                })
                if (!response.ok) {
                    throw new Error(t('widgetAuth.verificationFailed'))
                }
                const body = await response.json()
                if (body.success === false) {
                    throw new Error(t('widgetAuth.verificationFailed'))
                }
                completeAuth(pendingAuthData, pendingEmail)
            } catch (err) {
                setStepError(err instanceof Error ? err.message : t('widgetAuth.verificationFailed'))
            } finally {
                setStepLoading(false)
            }
        },
        [config, pendingAuthData, pendingEmail, completeAuth, t]
    )

    // ─── Render the appropriate 2FA step component ──────────
    const renderWidget2FAStep = useCallback(() => {
        switch (twoFactorMethod) {
            case 'TOTP':
                return (
                    <TotpStep
                        onSubmit={(code: string) => verifyMethodStep('TOTP', { code })}
                        loading={stepLoading}
                        error={stepError}
                    />
                )
            case 'SMS_OTP':
                return (
                    <SmsOtpStep
                        onSubmit={(code: string) => verifyMethodStep('SMS_OTP', { code })}
                        onSendOtp={async () => {
                            if (!pendingAuthData) return
                            try {
                                await fetch(`${config.apiBaseUrl}/auth/2fa/send-sms`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${pendingAuthData.accessToken}`,
                                    },
                                })
                            } catch {
                                setStepError(t('widgetAuth.smsSendFailed'))
                            }
                        }}
                        loading={stepLoading}
                        error={stepError}
                    />
                )
            case 'FACE':
                return (
                    <FaceCaptureStep
                        onSubmit={(image: string) => verifyMethodStep('FACE', { image })}
                        loading={stepLoading}
                        error={stepError}
                    />
                )
            case 'VOICE':
                return (
                    <VoiceStep
                        onSubmit={(voiceData: string) => verifyMethodStep('VOICE', { voiceData })}
                        loading={stepLoading}
                        error={stepError}
                    />
                )
            case 'FINGERPRINT':
                return (
                    <FingerprintStep
                        onSubmit={(data: string) => verifyMethodStep('FINGERPRINT', { assertion: data })}
                        loading={stepLoading}
                        error={stepError}
                    />
                )
            case 'QR_CODE':
                return (
                    <QrCodeStep
                        onGenerateToken={async () => {
                            if (!pendingAuthData) throw new Error('No auth data')
                            const resp = await fetch(`${config.apiBaseUrl}/auth/2fa/qr-generate`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${pendingAuthData.accessToken}`,
                                },
                            })
                            if (!resp.ok) throw new Error('Failed to generate QR')
                            return resp.json()
                        }}
                        onSubmit={(token: string) => verifyMethodStep('QR_CODE', { token })}
                        loading={stepLoading}
                        error={stepError}
                    />
                )
            case 'HARDWARE_KEY':
                return (
                    <HardwareKeyStep
                        onRequestChallenge={async () => {
                            if (!pendingAuthData) return null
                            const resp = await fetch(`${config.apiBaseUrl}/auth/2fa/hardware-challenge`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${pendingAuthData.accessToken}`,
                                },
                            })
                            if (!resp.ok) return null
                            return resp.json()
                        }}
                        onSubmit={(data) => verifyMethodStep('HARDWARE_KEY', { assertion: data })}
                        loading={stepLoading}
                        error={stepError}
                    />
                )
            case 'NFC_DOCUMENT':
                return <NfcStep loading={stepLoading} error={stepError} />
            default:
                return null
        }
    }, [twoFactorMethod, stepLoading, stepError, verifyMethodStep, config, pendingAuthData])

    // ─── Success state ──────────────────────────────────────────

    if (success) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100%',
                    p: 4,
                    textAlign: 'center',
                }}
            >
                <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
                    {t('widgetAuth.authSuccessful')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {t('widgetAuth.returningResult')}
                </Typography>
            </Box>
        )
    }

    // ─── 2FA verification step ────────────────────────────────

    if (step === '2fa') {
        // For non-email methods, render the step component directly
        if (twoFactorMethod !== 'EMAIL_OTP') {
            const stepComponent = renderWidget2FAStep()
            if (stepComponent) {
                return (
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '100%',
                            p: { xs: 2, sm: 3 },
                        }}
                    >
                        <Box sx={{ width: '100%', maxWidth: 400 }}>
                            {stepComponent}
                        </Box>
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                mt: 3,
                                opacity: 0.5,
                            }}
                        >
                            <VerifiedUser sx={{ fontSize: 12 }} />
                            <Typography variant="caption" color="text.secondary">
                                {t('widgetAuth.securedBy')}
                            </Typography>
                        </Box>
                    </Box>
                )
            }
        }

        // EMAIL_OTP: original inline code input
        return (
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100%',
                    p: { xs: 2, sm: 3 },
                }}
            >
                <Box
                    sx={{
                        width: 56,
                        height: 56,
                        borderRadius: '16px',
                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 8px 24px rgba(99, 102, 241, 0.35)',
                        mb: 2,
                    }}
                >
                    <EmailOutlined sx={{ fontSize: 32, color: 'white' }} />
                </Box>

                <Typography
                    variant="h6"
                    fontWeight={700}
                    sx={{
                        mb: 0.5,
                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}
                >
                    {t('widgetAuth.twoFactorTitle')}
                </Typography>
                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 3, textAlign: 'center' }}
                >
                    {maskedEmail
                        ? t('widgetAuth.codeSentTo', { email: maskedEmail })
                        : t('widgetAuth.codeSentGeneric')}
                </Typography>

                <Box sx={{ width: '100%', maxWidth: 400 }}>
                    {error && (
                        <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>
                            {error}
                        </Alert>
                    )}

                    <TextField
                        fullWidth
                        label={t('widgetAuth.verificationCode')}
                        value={twoFactorCode}
                        onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 6)
                            setTwoFactorCode(val)
                        }}
                        placeholder="000000"
                        disabled={loading}
                        size="small"
                        autoFocus
                        inputProps={{ maxLength: 6, inputMode: 'numeric', pattern: '[0-9]*' }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <LockOutlined sx={{ color: 'rgba(0,0,0,0.54)', fontSize: 20 }} />
                                </InputAdornment>
                            ),
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && twoFactorCode.length === 6) {
                                onVerify2FA()
                            }
                        }}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: '10px',
                                backgroundColor: '#f8fafc',
                            },
                            '& input': {
                                textAlign: 'center',
                                letterSpacing: '0.5em',
                                fontSize: '1.2rem',
                                fontWeight: 600,
                            },
                        }}
                    />

                    <Button
                        fullWidth
                        variant="contained"
                        disabled={loading || twoFactorCode.length !== 6}
                        onClick={onVerify2FA}
                        endIcon={!loading && <ArrowForward />}
                        sx={{
                            mt: 2,
                            py: 1.25,
                            borderRadius: '10px',
                            fontWeight: 600,
                            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                            '&:hover': {
                                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                            },
                        }}
                    >
                        {loading ? (
                            <CircularProgress size={22} sx={{ color: 'white' }} />
                        ) : (
                            t('widgetAuth.verifyCode')
                        )}
                    </Button>
                </Box>

                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        mt: 3,
                        opacity: 0.5,
                    }}
                >
                    <VerifiedUser sx={{ fontSize: 12 }} />
                    <Typography variant="caption" color="text.secondary">
                        {t('widgetAuth.securedBy')}
                    </Typography>
                </Box>
            </Box>
        )
    }

    // ─── Login form ─────────────────────────────────────────────

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100%',
                p: { xs: 2, sm: 3 },
            }}
        >
            {/* Header */}
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    mb: 2,
                }}
            >
                <Box
                    sx={{
                        width: 56,
                        height: 56,
                        borderRadius: '16px',
                        background:
                            'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 8px 24px rgba(99, 102, 241, 0.35)',
                    }}
                >
                    <Fingerprint sx={{ fontSize: 32, color: 'white' }} />
                </Box>
            </Box>

            <Typography
                variant="h6"
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
                {t('widgetAuth.verifyIdentity')}
            </Typography>
            <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 3, textAlign: 'center' }}
            >
                {t('widgetAuth.signInToVerify')}
            </Typography>

            {/* Form */}
            <Box
                component="form"
                onSubmit={handleSubmit(onSubmit)}
                sx={{ width: '100%', maxWidth: 400 }}
            >
                {error && (
                    <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>
                        {error}
                    </Alert>
                )}

                <Controller
                    name="email"
                    control={control}
                    render={({ field }) => (
                        <TextField
                            {...field}
                            fullWidth
                            label={t('widgetAuth.emailLabel')}
                            type="email"
                            error={!!errors.email}
                            helperText={errors.email?.message}
                            margin="normal"
                            autoFocus
                            required
                            autoComplete="email"
                            disabled={loading}
                            size="small"
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <EmailOutlined
                                            sx={{
                                                color: 'rgba(0,0,0,0.54)',
                                                fontSize: 20,
                                            }}
                                        />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: '10px',
                                    backgroundColor: '#f8fafc',
                                },
                            }}
                        />
                    )}
                />

                <Controller
                    name="password"
                    control={control}
                    render={({ field }) => (
                        <TextField
                            {...field}
                            fullWidth
                            label={t('widgetAuth.passwordLabel')}
                            type={showPassword ? 'text' : 'password'}
                            error={!!errors.password}
                            helperText={
                                errors.password?.message === 'Password is required'
                                    ? t('auth.error.passwordRequired')
                                    : errors.password?.message
                            }
                            margin="normal"
                            required
                            autoComplete="current-password"
                            disabled={loading}
                            size="small"
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <LockOutlined
                                            sx={{
                                                color: 'rgba(0,0,0,0.54)',
                                                fontSize: 20,
                                            }}
                                        />
                                    </InputAdornment>
                                ),
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            onClick={() =>
                                                setShowPassword(!showPassword)
                                            }
                                            edge="end"
                                            size="small"
                                            disabled={loading}
                                        >
                                            {showPassword ? (
                                                <VisibilityOff
                                                    sx={{ fontSize: 20 }}
                                                />
                                            ) : (
                                                <Visibility
                                                    sx={{ fontSize: 20 }}
                                                />
                                            )}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: '10px',
                                    backgroundColor: '#f8fafc',
                                },
                            }}
                        />
                    )}
                />

                <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    disabled={loading}
                    endIcon={!loading && <ArrowForward />}
                    sx={{
                        mt: 2,
                        py: 1.25,
                        borderRadius: '10px',
                        fontWeight: 600,
                        background:
                            'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                        '&:hover': {
                            background:
                                'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                        },
                    }}
                >
                    {loading ? (
                        <CircularProgress size={22} sx={{ color: 'white' }} />
                    ) : (
                        t('widgetAuth.verify')
                    )}
                </Button>
            </Box>

            {/* Footer */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    mt: 3,
                    opacity: 0.5,
                }}
            >
                <VerifiedUser sx={{ fontSize: 12 }} />
                <Typography variant="caption" color="text.secondary">
                    Secured by FIVUCSAS
                </Typography>
            </Box>
        </Box>
    )
}

// Wrap in light theme so widget always has dark text on light background
export default function WidgetAuthPage() {
    const isInIframe = typeof window !== 'undefined' && window !== window.parent
    return (
        <ThemeProvider theme={widgetLightTheme}>
            <Box sx={{
                bgcolor: 'background.default',
                minHeight: isInIframe ? 'auto' : '100vh',
                height: isInIframe ? '100%' : 'auto',
                overflowY: 'auto',
            }}>
                <WidgetAuthPageInner />
            </Box>
        </ThemeProvider>
    )
}
