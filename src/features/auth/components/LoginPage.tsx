import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { formatApiError } from '@utils/formatApiError'
import { useNavigate } from 'react-router-dom'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    InputAdornment,
    Skeleton,
    TextField,
    Typography,
    Link,
} from '@mui/material'
import {
    Fingerprint,
    Visibility,
    VisibilityOff,
    LockOutlined,
    EmailOutlined,
    ArrowForward,
    VerifiedUser,
} from '@mui/icons-material'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, Variants } from 'framer-motion'
import { AxiosError } from 'axios'
import { useAuth } from '../hooks/useAuth'
// face login removed 2026-04-29 — see /opt/projects/fivucsas/MULTI_EMAIL_TENANT_DESIGN_2026-04-28.md follow-up; needs public /auth/face-login endpoint
import TwoFactorDispatcher from './TwoFactorDispatcher'
import MethodPickerStep from './steps/MethodPickerStep'
import type { AvailableMfaMethod, MfaStepResponse } from '@domain/interfaces/IAuthRepository'
import type { ITokenService } from '@domain/interfaces/ITokenService'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'

/**
 * Login form validation schema
 */
const loginSchema = z.object({
    email: z.string().min(1, 'Email is required').email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
})

type LoginFormData = z.infer<typeof loginSchema>

// Bezier easing
const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

// Animation variants
const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.2,
        },
    },
}

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.5,
            ease: easeOut,
        },
    },
}

const logoVariants: Variants = {
    hidden: { scale: 0.8, opacity: 0, rotateY: -90 },
    visible: {
        scale: 1,
        opacity: 1,
        rotateY: 0,
        transition: {
            duration: 0.8,
            ease: easeOut,
        },
    },
}

// Floating shapes for background
const FloatingShape = ({ delay, size, left, top }: {
    delay: number
    size: number
    left: string
    top: string
}) => (
    <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{
            opacity: [0.1, 0.3, 0.1],
            scale: [1, 1.2, 1],
            y: [0, -20, 0],
        }}
        transition={{
            duration: 6,
            delay,
            repeat: Infinity,
            ease: 'easeInOut',
        }}
        style={{
            position: 'absolute',
            left,
            top,
            width: size,
            height: size,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
        }}
    />
)

/**
 * Login Page Component
 * Beautiful animated login with glassmorphism design
 */
export default function LoginPage() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { login, loading, error, user, logout, refreshUser } = useAuth()
    const tokenService = useService<ITokenService>(TYPES.TokenService)
    const [showPassword, setShowPassword] = useState(false)
    const [loginError, setLoginError] = useState<string | null>(null)
    const [pageReady, setPageReady] = useState(false)
    const [showSecondaryAuth, setShowSecondaryAuth] = useState(false)
    const [twoFactorMethod, setTwoFactorMethod] = useState<string>('EMAIL_OTP')
    const [availableMethods, setAvailableMethods] = useState<AvailableMfaMethod[]>([])
    const [_selectedMethod, setSelectedMethod] = useState<string | null>(null)
    const [_mfaSessionToken, setMfaSessionToken] = useState<string | null>(null)
    const [showMethodPicker, setShowMethodPicker] = useState(false)
    // Track methods already completed in this MFA session so they cannot be
    // chosen again at a later step. The server is authoritative (it returns
    // `completedMethods` in every step response), but we mirror it locally so
    // the picker can hide them and the dispatcher can refuse a redundant
    // dispatch even before the round-trip.
    const [completedMfaMethods, setCompletedMfaMethods] = useState<string[]>([])

    // Mark page ready after initial render
    useEffect(() => {
        const timer = setTimeout(() => setPageReady(true), 300)
        return () => clearTimeout(timer)
    }, [])

    // Perf (USER-BUG-7): warm BiometricEngine / MediaPipe initialization in
    // the background while the user is typing email + password. By the time
    // MFA dispatches FaceCaptureStep, the WASM + .task model may already be
    // loaded, so the "MediaPipe (CDN)" badge appears immediately and
    // detection can start on the first frame. This optimizes warm-up timing,
    // not necessarily login-bundle composition: TwoFactorDispatcher (which
    // is statically imported by LoginPage) statically pulls in
    // BiometricEngine, so the engine code is already in the login chunk —
    // the `import(...)` below is just a deferred warm-up trigger, not a
    // chunk-split. Failures are non-fatal because face-detect hooks
    // re-attempt on FaceCaptureStep mount. BiometricEngine.initialize() is
    // single-flight (shared in-flight promise) so this warm-up never races
    // with the first FaceCaptureStep mount.
    useEffect(() => {
        let cancelled = false
        const idle =
            (window as Window & { requestIdleCallback?: (cb: () => void) => void })
                .requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1))
        idle(() => {
            if (cancelled) return
            import('../../../lib/biometric-engine/core/BiometricEngine')
                .then(({ BiometricEngine }) => {
                    if (cancelled) return
                    return BiometricEngine.getInstance().initialize()
                })
                .catch(() => {
                    // Non-fatal — useFaceDetection will retry on demand
                })
        })
        return () => {
            cancelled = true
        }
    }, [])

    // Forgot password state
    const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false)
    const [forgotEmail, setForgotEmail] = useState('')
    const [forgotLoading, setForgotLoading] = useState(false)
    const [forgotError, setForgotError] = useState<string | null>(null)
    const [forgotSuccess, setForgotSuccess] = useState(false)

    // Reset password state
    const [resetPasswordOpen, setResetPasswordOpen] = useState(false)
    const [resetCode, setResetCode] = useState('')
    const [resetNewPassword, setResetNewPassword] = useState('')
    const [resetConfirmPassword, setResetConfirmPassword] = useState('')
    const [resetLoading, setResetLoading] = useState(false)
    const [resetError, setResetError] = useState<string | null>(null)
    const [resetSuccess, setResetSuccess] = useState(false)

    const handleForgotPassword = async () => {
        setForgotLoading(true)
        setForgotError(null)
        try {
            const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1'
            const response = await fetch(`${baseUrl}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: forgotEmail }),
            })
            if (!response.ok) {
                throw new Error(t('auth.failedToSendReset'))
            }
            setForgotSuccess(true)
        } catch (err) {
            setForgotError(formatApiError(err, t))
        } finally {
            setForgotLoading(false)
        }
    }

    const handleResetPassword = async () => {
        if (resetNewPassword !== resetConfirmPassword) {
            setResetError(t('auth.passwordsDoNotMatch'))
            return
        }
        setResetLoading(true)
        setResetError(null)
        try {
            const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1'
            const response = await fetch(`${baseUrl}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: forgotEmail, code: resetCode, newPassword: resetNewPassword }),
            })
            if (!response.ok) {
                throw new Error(t('auth.failedToResetPassword'))
            }
            setResetSuccess(true)
        } catch (err) {
            setResetError(formatApiError(err, t))
        } finally {
            setResetLoading(false)
        }
    }

    const handleCloseForgotPassword = () => {
        setForgotPasswordOpen(false)
        setForgotEmail('')
        setForgotError(null)
        setForgotSuccess(false)
    }

    const handleOpenResetDialog = () => {
        setForgotPasswordOpen(false)
        setResetPasswordOpen(true)
    }

    const handleCloseResetPassword = () => {
        setResetPasswordOpen(false)
        setResetCode('')
        setResetNewPassword('')
        setResetConfirmPassword('')
        setResetError(null)
        setResetSuccess(false)
    }

    const {
        control,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: '',
            password: '',
        },
    })

    const onSubmit = async (data: LoginFormData) => {
        setLoginError(null)
        try {
            const result = await login({
                email: data.email,
                password: data.password,
            })
            // After successful password login, check if backend requires 2FA
            if (result.twoFactorRequired) {
                // Store MFA session token if provided
                if (result.mfaSessionToken) {
                    setMfaSessionToken(result.mfaSessionToken)
                }

                // Seed completed-method set with the server's authoritative list
                // (PASSWORD is always present after a successful initial login).
                if (result.completedMethods?.length) {
                    setCompletedMfaMethods(result.completedMethods)
                } else {
                    setCompletedMfaMethods(['PASSWORD'])
                }

                // Check if multiple enrolled methods are available
                const methods = result.availableMethods ?? []
                const enrolledMethods = methods.filter((m) => m.enrolled)

                if (enrolledMethods.length > 1) {
                    // Multiple enrolled methods: show the picker
                    setAvailableMethods(methods)
                    setShowMethodPicker(true)
                    return
                }

                // Single method or no availableMethods: go directly to that method
                setTwoFactorMethod(result.twoFactorMethod || 'EMAIL_OTP')
                setShowSecondaryAuth(true)
                return
            }
            navigate('/')
        } catch (err) {
            if (import.meta.env.DEV) {
                console.error('Login failed:', err)
            }
            const axiosErr = err as { response?: { status?: number } }
            if (axiosErr?.response?.status === 401) {
                setLoginError(t('auth.invalidCredentials'))
            } else {
                setLoginError(formatApiError(err, t))
            }
        }
    }

    const handleMethodSelected = (methodType: string) => {
        setSelectedMethod(methodType)
        setTwoFactorMethod(methodType)
        setShowMethodPicker(false)
        setShowSecondaryAuth(true)
    }

    const handleMfaResult = useCallback(async (response: MfaStepResponse) => {
        if (response.status === 'AUTHENTICATED' && response.accessToken) {
            // ALL steps complete — store tokens and navigate to dashboard
            await tokenService.storeTokens({
                accessToken: response.accessToken,
                refreshToken: response.refreshToken!,
            })
            setShowSecondaryAuth(false)
            setShowMethodPicker(false)
            await refreshUser()
            navigate('/')
        } else if (response.status === 'STEP_COMPLETED') {
            // More steps remain — update available methods and show picker.
            //
            // Trust the server's `completedMethods` (authoritative) for the
            // exclusion list: it is what gates the picker so the user cannot
            // pick a factor already cleared at an earlier step. The server
            // also pre-filters `availableMethods` for CHOICE steps, but we
            // double-check on the client to defend against a stale render.
            const completed = response.completedMethods ?? completedMfaMethods
            setCompletedMfaMethods(completed)
            const completedSet = new Set(completed)
            const filtered = (response.availableMethods ?? []).filter(
                (m) => !completedSet.has(m.methodType),
            )
            setAvailableMethods(filtered)
            setMfaSessionToken(response.mfaSessionToken ?? _mfaSessionToken)
            setSelectedMethod(null)
            setShowSecondaryAuth(false)
            setShowMethodPicker(true)
        }
    }, [tokenService, refreshUser, navigate, _mfaSessionToken, completedMfaMethods])

    const handleBackToMethodSelection = useCallback(() => {
        setShowSecondaryAuth(false)
        setShowMethodPicker(true)
    }, [])

    const handleTwoFactorCancel = useCallback(async () => {
        setShowSecondaryAuth(false)
        setShowMethodPicker(false)
        setAvailableMethods([])
        setSelectedMethod(null)
        setMfaSessionToken(null)
        setCompletedMfaMethods([])
        await logout()
    }, [logout])

    // Show method picker when multiple MFA methods are available
    if (showMethodPicker && user) {
        return (
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflowY: 'auto',
                    py: 4,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f64f59 100%)',
                    backgroundSize: '400% 400%',
                    animation: 'gradientShift 15s ease infinite',
                    '@keyframes gradientShift': {
                        '0%': { backgroundPosition: '0% 50%' },
                        '50%': { backgroundPosition: '100% 50%' },
                        '100%': { backgroundPosition: '0% 50%' },
                    },
                }}
            >
                <Card
                    sx={{
                        maxWidth: 480,
                        width: '100%',
                        mx: 2,
                        borderRadius: '24px',
                        background: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(20px)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        color: '#1a1a2e',
                        '& .MuiTypography-root': { color: '#1a1a2e' },
                        '& .MuiTypography-colorTextSecondary': { color: 'rgba(0,0,0,0.6)' },
                        '& .MuiCard-root': {
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            borderColor: 'rgba(0, 0, 0, 0.12)',
                        },
                        '& .MuiChip-root': { color: '#1a1a2e' },
                        '& .MuiChip-colorSuccess': { color: '#fff' },
                    }}
                >
                    <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                        <MethodPickerStep
                            availableMethods={availableMethods}
                            onMethodSelected={handleMethodSelected}
                            excludeMethods={completedMfaMethods}
                        />
                        <Box sx={{ textAlign: 'center', mt: 2 }}>
                            <Button
                                variant="text"
                                onClick={handleTwoFactorCancel}
                                sx={{ color: 'rgba(0,0,0,0.6)' }}
                            >
                                {t('common.cancel')}
                            </Button>
                        </Box>
                    </CardContent>
                </Card>
            </Box>
        )
    }

    // Show 2FA verification after successful password login
    if (showSecondaryAuth && user) {
        return (
            <TwoFactorDispatcher
                method={twoFactorMethod}
                mfaSessionToken={_mfaSessionToken ?? ''}
                onAuthenticated={handleMfaResult}
                onBackToMethodSelection={handleBackToMethodSelection}
                onCancel={handleTwoFactorCancel}
            />
        )
    }

    return (
        <Box
            component="main"
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f64f59 100%)',
                backgroundSize: '400% 400%',
                animation: 'gradientShift 15s ease infinite',
                '@keyframes gradientShift': {
                    '0%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' },
                    '100%': { backgroundPosition: '0% 50%' },
                },
            }}
        >
            {/* Animated background shapes */}
            <FloatingShape delay={0} size={300} left="10%" top="20%" />
            <FloatingShape delay={1} size={200} left="70%" top="10%" />
            <FloatingShape delay={2} size={150} left="80%" top="60%" />
            <FloatingShape delay={0.5} size={100} left="5%" top="70%" />
            <FloatingShape delay={1.5} size={250} left="50%" top="80%" />

            <motion.div
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                style={{ width: '100%', maxWidth: 440, margin: '0 16px', zIndex: 1 }}
            >
                <Card
                    sx={{
                        background: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(20px)',
                        borderRadius: '24px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        overflow: 'visible',
                        color: '#1a1a2e',
                        '& .MuiTypography-root:not([class*="gradient"])': { color: '#1a1a2e' },
                        '& .MuiTypography-colorTextSecondary': { color: 'rgba(0,0,0,0.6)' },
                        '& .MuiSvgIcon-root:not([class*="white"])': { color: 'rgba(0,0,0,0.54)' },
                        '& .MuiIconButton-root .MuiSvgIcon-root': { color: 'rgba(0,0,0,0.54)' },
                        '& .MuiLink-root': { color: '#6366f1' },
                        '& .MuiFormHelperText-root': { color: 'rgba(0,0,0,0.6)' },
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' },
                    }}
                >
                    <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
                        {!pageReady ? (
                            /* Loading skeleton while page initialises */
                            <Box>
                                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
                                    <Skeleton variant="rounded" width={80} height={80} sx={{ borderRadius: '20px' }} />
                                </Box>
                                <Skeleton variant="text" width="60%" sx={{ mx: 'auto', mb: 1, fontSize: '2rem' }} />
                                <Skeleton variant="text" width="80%" sx={{ mx: 'auto', mb: 4 }} />
                                <Skeleton variant="rounded" height={56} sx={{ mb: 2, borderRadius: '12px' }} />
                                <Skeleton variant="rounded" height={56} sx={{ mb: 2, borderRadius: '12px' }} />
                                <Skeleton variant="rounded" height={48} sx={{ mt: 3, borderRadius: '12px' }} />
                            </Box>
                        ) : (
                        <>
                        {/* Logo */}
                        <motion.div variants={logoVariants}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    mb: 4,
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 80,
                                        height: 80,
                                        borderRadius: '20px',
                                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 10px 40px rgba(99, 102, 241, 0.4)',
                                    }}
                                >
                                    <Fingerprint sx={{ fontSize: 48, color: 'white' }} />
                                </Box>
                            </Box>
                        </motion.div>

                        {/* Header */}
                        <motion.div variants={itemVariants}>
                            <Box sx={{ textAlign: 'center', mb: 4 }}>
                                <Typography
                                    variant="h4"
                                    component="h1"
                                    sx={{
                                        fontWeight: 700,
                                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                        backgroundClip: 'text',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        mb: 1,
                                    }}
                                >
                                    {t('auth.welcomeBack')}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {t('auth.signInSubtitle')}
                                </Typography>
                            </Box>
                        </motion.div>

                        {/* Login Form */}
                        <form onSubmit={handleSubmit(onSubmit)} aria-label={t('auth.loginFormLabel')}>
                            {/* Error Alert */}
                            {(error || loginError) && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <Alert
                                        severity={
                                            error instanceof AxiosError && error.response?.status === 429
                                                ? 'warning'
                                                : 'error'
                                        }
                                        role="alert"
                                        sx={{
                                            mb: 3,
                                            borderRadius: '12px',
                                        }}
                                    >
                                        {loginError || (error ? formatApiError(error, t) : t('auth.invalidCredentials'))}
                                    </Alert>
                                </motion.div>
                            )}

                            {/* Email Field */}
                            <motion.div variants={itemVariants}>
                                <Controller
                                    name="email"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            label={t('auth.emailLabel')}
                                            type="email"
                                            error={!!errors.email}
                                            helperText={errors.email?.message}
                                            margin="normal"
                                            autoFocus
                                            required
                                            autoComplete="email"
                                            inputProps={{ 'aria-required': 'true' }}
                                            disabled={loading}
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <EmailOutlined sx={{ color: 'rgba(0, 0, 0, 0.54)' }} />
                                                    </InputAdornment>
                                                ),
                                            }}
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: '12px',
                                                    backgroundColor: '#f8fafc',
                                                    '&:hover': {
                                                        backgroundColor: '#f1f5f9',
                                                    },
                                                    '&.Mui-focused': {
                                                        backgroundColor: '#fff',
                                                    },
                                                },
                                                '& .MuiInputBase-input': {
                                                    color: '#1a1a2e',
                                                },
                                                '& .MuiInputLabel-root': {
                                                    color: 'rgba(0, 0, 0, 0.6)',
                                                },
                                                '& .MuiInputLabel-root.Mui-focused': {
                                                    color: '#6366f1',
                                                },
                                                '& input:-webkit-autofill': {
                                                    WebkitBoxShadow: '0 0 0 100px #f8fafc inset',
                                                    WebkitTextFillColor: '#1a1a2e',
                                                    caretColor: '#1a1a2e',
                                                },
                                            }}
                                        />
                                    )}
                                />
                            </motion.div>

                            {/* Password Field */}
                            <motion.div variants={itemVariants}>
                                <Controller
                                    name="password"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            label={t('auth.passwordLabel')}
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
                                            inputProps={{ 'aria-required': 'true' }}
                                            disabled={loading}
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <LockOutlined sx={{ color: 'rgba(0, 0, 0, 0.54)' }} />
                                                    </InputAdornment>
                                                ),
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            onClick={() => setShowPassword(!showPassword)}
                                                            edge="end"
                                                            disabled={loading}
                                                            aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                                                            sx={{
                                                                color: 'action.active',
                                                                '&:hover': {
                                                                    backgroundColor: 'action.hover',
                                                                    color: 'primary.main',
                                                                },
                                                            }}
                                                        >
                                                            {showPassword ? <VisibilityOff /> : <Visibility />}
                                                        </IconButton>
                                                    </InputAdornment>
                                                ),
                                            }}
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: '12px',
                                                    backgroundColor: '#f8fafc',
                                                    '&:hover': {
                                                        backgroundColor: '#f1f5f9',
                                                    },
                                                    '&.Mui-focused': {
                                                        backgroundColor: '#fff',
                                                    },
                                                },
                                                '& .MuiInputBase-input': {
                                                    color: '#1a1a2e',
                                                },
                                                '& .MuiInputLabel-root': {
                                                    color: 'rgba(0, 0, 0, 0.6)',
                                                },
                                                '& .MuiInputLabel-root.Mui-focused': {
                                                    color: '#6366f1',
                                                },
                                                '& input:-webkit-autofill': {
                                                    WebkitBoxShadow: '0 0 0 100px #f8fafc inset',
                                                    WebkitTextFillColor: '#1a1a2e',
                                                    caretColor: '#1a1a2e',
                                                },
                                            }}
                                        />
                                    )}
                                />
                            </motion.div>

                            {/* Forgot Password Link */}
                            <motion.div variants={itemVariants}>
                                <Box sx={{ textAlign: 'right', mt: 1 }}>
                                    <Link
                                        href="/forgot-password"
                                        onClick={(e: React.MouseEvent) => {
                                            e.preventDefault()
                                            navigate('/forgot-password')
                                        }}
                                        underline="hover"
                                        sx={{
                                            fontSize: '0.875rem',
                                            color: 'primary.main',
                                            cursor: 'pointer',
                                            fontWeight: 500,
                                            '&:hover': {
                                                color: 'primary.dark',
                                            },
                                        }}
                                    >
                                        {t('auth.forgotPasswordQuestion')}
                                    </Link>
                                </Box>
                            </motion.div>

                            {/* Submit Button */}
                            <motion.div variants={itemVariants}>
                                <Button
                                    type="submit"
                                    fullWidth
                                    variant="contained"
                                    size="large"
                                    disabled={loading}
                                    endIcon={!loading && <ArrowForward />}
                                    sx={{
                                        mt: 3,
                                        mb: 2,
                                        py: 1.5,
                                        borderRadius: '12px',
                                        fontSize: '1rem',
                                        fontWeight: 600,
                                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                        boxShadow: '0 10px 40px rgba(99, 102, 241, 0.4)',
                                        '&:hover': {
                                            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                                            boxShadow: '0 15px 50px rgba(99, 102, 241, 0.5)',
                                            transform: 'translateY(-2px)',
                                        },
                                        '&:active': {
                                            transform: 'translateY(0)',
                                        },
                                        transition: 'all 0.3s ease',
                                    }}
                                >
                                    {loading ? (
                                        <CircularProgress size={24} sx={{ color: 'white' }} />
                                    ) : (
                                        t('auth.signIn')
                                    )}
                                </Button>
                            </motion.div>
                        </form>

                        {/* Multi-factor auth info */}
                        <motion.div variants={itemVariants}>
                            <Box
                                sx={{
                                    mt: 2,
                                    p: 2,
                                    borderRadius: '12px',
                                    bgcolor: 'rgba(99, 102, 241, 0.06)',
                                    border: '1px solid',
                                    borderColor: 'rgba(99, 102, 241, 0.15)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.5,
                                }}
                            >
                                <VerifiedUser sx={{ fontSize: 20, color: 'primary.main', flexShrink: 0 }} />
                                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                                    {t('auth.mfaInfo')}
                                </Typography>
                            </Box>
                        </motion.div>

                        {/* Register Link */}
                        <motion.div variants={itemVariants}>
                            <Box sx={{ textAlign: 'center', mt: 2 }}>
                                <Typography variant="body2" color="text.secondary">
                                    {t('auth.noAccountQuestion')}{' '}
                                    <Link
                                        href="/register"
                                        onClick={(e: React.MouseEvent) => {
                                            e.preventDefault()
                                            navigate('/register')
                                        }}
                                        underline="hover"
                                        sx={{
                                            fontWeight: 600,
                                            color: 'primary.main',
                                            cursor: 'pointer',
                                            '&:hover': {
                                                color: 'primary.dark',
                                            },
                                        }}
                                    >
                                        {t('auth.register')}
                                    </Link>
                                </Typography>
                            </Box>
                        </motion.div>

                        {/* Demo credentials - only visible in development */}
                        {import.meta.env.DEV && (
                        <motion.div
                            variants={itemVariants}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            transition={{ delay: 1 }}
                        >
                            <Box
                                sx={{
                                    mt: 3,
                                    p: 2,
                                    bgcolor: 'rgba(99, 102, 241, 0.08)',
                                    borderRadius: '12px',
                                    border: '1px dashed',
                                    borderColor: 'primary.light',
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    color="primary.main"
                                    display="block"
                                    fontWeight="bold"
                                    sx={{ mb: 0.5 }}
                                >
                                    {t('auth.demoCredentials')}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" display="block">
                                    admin@fivucsas.local / Test@123
                                </Typography>
                            </Box>
                        </motion.div>
                        )}
                        </>
                        )}
                    </CardContent>
                </Card>

                {/* Footer — "Secured by FIVUCSAS" badge */}
                <motion.div variants={itemVariants}>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 0.5,
                            mt: 3,
                        }}
                    >
                        <VerifiedUser sx={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.7)' }} />
                        <Typography
                            variant="caption"
                            sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                        >
                            {t('secondaryAuth.securedBy')}
                        </Typography>
                    </Box>
                </motion.div>
            </motion.div>

            {/* Forgot Password Dialog */}
            <Dialog open={forgotPasswordOpen} onClose={handleCloseForgotPassword} maxWidth="sm" fullWidth>
                <DialogTitle>{t('auth.forgotPasswordTitle')}</DialogTitle>
                <DialogContent>
                    {forgotError && (
                        <Alert severity="error" role="alert" sx={{ mb: 2 }}>{forgotError}</Alert>
                    )}
                    {forgotSuccess ? (
                        <>
                            <Alert severity="success" sx={{ mb: 2 }}>
                                {t('auth.resetCodeSentSuccess')}
                            </Alert>
                            <Button variant="contained" fullWidth onClick={handleOpenResetDialog}>
                                {t('auth.enterResetCode')}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                {t('auth.enterEmailForReset')}
                            </Typography>
                            <TextField
                                fullWidth
                                label={t('auth.emailLabel')}
                                type="email"
                                value={forgotEmail}
                                onChange={(e) => setForgotEmail(e.target.value)}
                                disabled={forgotLoading}
                                autoFocus
                            />
                        </>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseForgotPassword} disabled={forgotLoading}>{t('common.cancel')}</Button>
                    {!forgotSuccess && (
                        <Button
                            variant="contained"
                            onClick={handleForgotPassword}
                            disabled={forgotLoading || !forgotEmail}
                        >
                            {forgotLoading ? <CircularProgress size={20} /> : t('auth.sendResetCode')}
                        </Button>
                    )}
                </DialogActions>
            </Dialog>

            {/* Reset Password Dialog */}
            <Dialog open={resetPasswordOpen} onClose={handleCloseResetPassword} maxWidth="sm" fullWidth>
                <DialogTitle>{t('auth.resetPasswordTitle')}</DialogTitle>
                <DialogContent>
                    {resetError && (
                        <Alert severity="error" role="alert" sx={{ mb: 2 }}>{resetError}</Alert>
                    )}
                    {resetSuccess ? (
                        <Alert severity="success">
                            {t('auth.resetPasswordSuccess')}
                        </Alert>
                    ) : (
                        <>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                {t('auth.enterResetCodeAndPassword', { email: forgotEmail })}
                            </Typography>
                            <TextField
                                fullWidth
                                label={t('auth.resetCodeInputLabel')}
                                value={resetCode}
                                onChange={(e) => setResetCode(e.target.value)}
                                margin="normal"
                                disabled={resetLoading}
                                autoFocus
                            />
                            <TextField
                                fullWidth
                                label={t('auth.newPasswordLabel')}
                                type="password"
                                value={resetNewPassword}
                                onChange={(e) => setResetNewPassword(e.target.value)}
                                margin="normal"
                                disabled={resetLoading}
                            />
                            <TextField
                                fullWidth
                                label={t('auth.confirmNewPasswordLabel')}
                                type="password"
                                value={resetConfirmPassword}
                                onChange={(e) => setResetConfirmPassword(e.target.value)}
                                margin="normal"
                                disabled={resetLoading}
                            />
                        </>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseResetPassword} disabled={resetLoading}>
                        {resetSuccess ? t('auth.close') : t('common.cancel')}
                    </Button>
                    {!resetSuccess && (
                        <Button
                            variant="contained"
                            onClick={handleResetPassword}
                            disabled={resetLoading || !resetCode || !resetNewPassword || !resetConfirmPassword}
                        >
                            {resetLoading ? <CircularProgress size={20} /> : t('auth.resetPasswordButton')}
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
        </Box>
    )
}
