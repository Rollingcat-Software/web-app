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
    IconButton,
    InputAdornment,
    TextField,
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
            'https://auth.rollingcatsoftware.com/api/v1',
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

export default function WidgetAuthPage() {
    const [config] = useState(() => parseWidgetParams())
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

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
                    }),
                })

                if (!response.ok) {
                    const body = await response.json().catch(() => ({}))
                    throw new Error(
                        body.message || body.error || `Authentication failed (${response.status})`
                    )
                }

                const body = await response.json()
                // The API wraps response in { data: { accessToken, refreshToken, user, ... } }
                const authData = body.data || body

                setSuccess(true)

                // Send the result back to the parent via postMessage
                sendToParent({
                    type: 'fivucsas:complete',
                    payload: {
                        success: true,
                        accessToken: authData.accessToken,
                        userId: authData.user?.id || config.userId,
                        email: authData.user?.email || data.email,
                        displayName:
                            authData.user?.firstName && authData.user?.lastName
                                ? `${authData.user.firstName} ${authData.user.lastName}`
                                : authData.user?.email || data.email,
                        sessionId: authData.sessionId || `widget-${Date.now()}`,
                        completedMethods: ['PASSWORD'],
                        authCode: authData.accessToken,
                        timestamp: Date.now(),
                    },
                })
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : 'Authentication failed'
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
        [config]
    )

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
                    Authentication Successful
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Returning result to the application...
                </Typography>
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
                Verify Identity
            </Typography>
            <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 3, textAlign: 'center' }}
            >
                Sign in to complete verification
            </Typography>

            {/* Form */}
            <Box
                component="form"
                onSubmit={handleSubmit(onSubmit)}
                sx={{ width: '100%', maxWidth: 360 }}
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
                            label="Email Address"
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
                            label="Password"
                            type={showPassword ? 'text' : 'password'}
                            error={!!errors.password}
                            helperText={errors.password?.message}
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
                        'Verify'
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
