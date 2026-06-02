import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { formatApiError } from '@utils/formatApiError'
import { isLikelyValidEmail } from '@domain/validators/emailValidator'
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
import Layer1Shortcuts from './Layer1Shortcuts'
import ApproveLoginPanel, { type ApproveLoginResult } from './ApproveLoginPanel'
import type { AvailableMfaMethod, MfaStepResponse, IAuthRepository } from '@domain/interfaces/IAuthRepository'
import type { ITokenService } from '@domain/interfaces/ITokenService'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import { config as envConfig } from '@config/env'
import { fetchLoginConfig } from '../login-config'
import { hasPasswordLayer1, type LoginConfig } from '@domain/models/LoginConfig'
import StepProgress from '../../../verify-app/StepProgress'

/**
 * Login form validation schema
 */
const loginSchema = z.object({
    // `.refine(isLikelyValidEmail)` is stricter than Zod's `.email()` (which
    // accepts a 1-char TLD like `user@gmail.x`) — see emailValidator.ts.
    email: z.string().min(1, 'Email is required').refine(isLikelyValidEmail, 'Invalid email address'),
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
    const httpClient = useService<IHttpClient>(TYPES.HttpClient)
    const authRepository = useService<IAuthRepository>(TYPES.AuthRepository)
    const [showPassword, setShowPassword] = useState(false)
    // Identifier-first: false until the user passes the email step (engine ON).
    const [passwordRevealed, setPasswordRevealed] = useState(false)
    // Tenant Layer-1 login config (D). null while loading / on failure → the UI
    // falls back to the legacy email+password form + all shortcuts.
    const [loginConfig, setLoginConfig] = useState<LoginConfig | null>(null)
    // Backend-authoritative total step count for the resolved login flow. Set
    // from the identifier-step preflight (the caller's ACTUAL tenant flow) and
    // from each /auth/mfa/step response, so the step indicator shows the real
    // "1/N, 2/N, 3/N" instead of deriving the total from live progress (which
    // made it read 2/2, 3/3) or the platform login-config (totalSteps=1).
    const [flowTotalSteps, setFlowTotalSteps] = useState<number | null>(null)
    // The identifier typed when Layer 1 has no PASSWORD method (config-driven).
    const [identifier, setIdentifier] = useState('')
    const [identifierSubmitting, setIdentifierSubmitting] = useState(false)
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
    // Approve-login (number-matching) panel toggle for the dashboard login.
    const [showApproveLogin, setShowApproveLogin] = useState(false)

    // Fetch the platform Layer-1 login config, and only reveal the form (drop the
    // skeleton) once that fetch has SETTLED. Previously the page flipped to ready
    // on a fixed 300ms timer, so when the config took longer the form rendered in
    // its default password shape and then visibly swapped to identifier-first —
    // the "password ghost/skeleton" flash. Gating pageReady on the fetch removes
    // it; a safety fallback prevents a hung fetch from pinning the skeleton.
    // On failure `loginConfig` stays null and the legacy email+password form is
    // shown (no clientId — the dashboard is the platform tenant).
    useEffect(() => {
        let cancelled = false
        const reveal = () => { if (!cancelled) setPageReady(true) }
        const fallback = setTimeout(reveal, 2000)
        void fetchLoginConfig(httpClient)
            .then((cfg) => { if (!cancelled) setLoginConfig(cfg) })
            .finally(() => { clearTimeout(fallback); reveal() })
        return () => { cancelled = true; clearTimeout(fallback) }
    }, [httpClient])

    // Perf (USER-BUG-7 → audit CC-3): warm BiometricEngine / MediaPipe ONLY
    // once FACE is actually a possible next step, never on the bare
    // email/password screen. The heavy MediaPipe FaceLandmarker WASM/WebGL
    // graph used to spin up on every login-page mount, contributing to a
    // near-blank first paint and wasting CPU/battery for users who only type
    // a password (VISUAL_AUDIT_ALLSITES_2026-06-01 CC-3). `availableMethods`
    // is empty until the first factor resolves, so gating on a FACE method
    // there defers the graph past the password step while preserving the
    // warm-up's intent (FaceCaptureStep finds the engine ready on mount).
    // Removing the gate entirely would still be correct — useFaceDetection
    // calls BiometricEngine.initialize() on its own mount (single-flight, so
    // no race) — this just keeps the head-start for genuine face flows.
    const faceIsAvailable = availableMethods.some((m) => m.methodType === 'FACE')
    useEffect(() => {
        if (!faceIsAvailable) return
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
    }, [faceIsAvailable])

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
            const baseUrl = envConfig.apiBaseUrl
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
            const baseUrl = envConfig.apiBaseUrl
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
        trigger,
        setFocus,
        getValues,
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

    // Identifier-first login (config-driven, Layer 1 has no PASSWORD method).
    // Opens an MFA session for the typed identifier, then routes into the same
    // method-picker / TwoFactorDispatcher machinery as the password path.
    const handleIdentifierSubmit = async () => {
        if (!identifier.trim()) {
            setLoginError(t('auth.validation.emailRequired'))
            return
        }
        // Reject obvious typos (e.g. `user@gmail.x`) before opening an MFA
        // session. Format-only check — preserves enumeration resistance.
        if (!isLikelyValidEmail(identifier)) {
            setLoginError(t('auth.validation.invalidEmail'))
            return
        }
        setLoginError(null)
        setIdentifierSubmitting(true)
        try {
            const result = await authRepository.beginIdentifierLogin(identifier.trim())
            if (result.mfaSessionToken) setMfaSessionToken(result.mfaSessionToken)
            setCompletedMfaMethods(result.completedMethods ?? [])
            const methods = result.availableMethods ?? []
            const enrolledMethods = methods.filter((m) => m.enrolled)
            if (enrolledMethods.length > 1) {
                setAvailableMethods(methods)
                setShowMethodPicker(true)
            } else {
                setTwoFactorMethod(result.twoFactorMethod || enrolledMethods[0]?.methodType || 'EMAIL_OTP')
                setShowSecondaryAuth(true)
            }
        } catch (err) {
            setLoginError(formatApiError(err, t))
        } finally {
            setIdentifierSubmitting(false)
        }
    }

    const handleMethodSelected = (methodType: string) => {
        setShowMethodPicker(false)
        if (methodType === 'PASSWORD' && completedMfaMethods.length === 0) {
            // PASSWORD as the FIRST factor → the dedicated, lockout-protected
            // /auth/login password form (email + password).
            setSelectedMethod(null)
            setShowSecondaryAuth(false)
            setPasswordRevealed(true)
            setTimeout(() => setFocus('password'), 0)
            return
        }
        // Any later factor — INCLUDING password chosen at layer 2+ — completes the
        // current step of the existing MFA session via /auth/mfa/step (the dispatcher
        // renders a password-only step for PASSWORD). This is what fixes "picking
        // password at the 2nd step showed the email-change form / restarted login".
        setSelectedMethod(methodType)
        setTwoFactorMethod(methodType)
        setShowSecondaryAuth(true)
    }

    const handleMfaResult = useCallback(async (response: MfaStepResponse) => {
        // Keep the step indicator anchored to the backend's authoritative total.
        if (response.totalSteps) setFlowTotalSteps(response.totalSteps)
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
            // More steps remain — show the picker for the next layer.
            //
            // Keep the FULL method list from the backend and pass the
            // authoritative `completedMethods` to the picker as `usedMethods`, so
            // already-used factors render DISABLED ("Already used") rather than
            // vanishing. The server enforces no-reuse (METHOD_ALREADY_USED); this
            // is only the display. (Previously we filtered them out client-side.)
            const completed = response.completedMethods ?? completedMfaMethods
            setCompletedMfaMethods(completed)
            setAvailableMethods(response.availableMethods ?? [])
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

    // Passkey + approve-login both complete a full sign-in (the principal is
    // already authenticated server-side and we receive access/refresh tokens).
    // Store them and route to the dashboard, mirroring the AUTHENTICATED branch
    // of handleMfaResult. Tokens are required; a missing access token surfaces
    // a generic error rather than navigating into a half-authenticated state.
    const completeTokenLogin = useCallback(
        async (tokens: { accessToken?: string | null; refreshToken?: string | null }) => {
            if (!tokens.accessToken) {
                setLoginError(t('passkeyLogin.failed'))
                return
            }
            await tokenService.storeTokens({
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken ?? '',
            })
            setShowApproveLogin(false)
            await refreshUser()
            navigate('/')
        },
        [tokenService, refreshUser, navigate, t],
    )

    const handlePasskeySuccess = useCallback(
        (login: { accessToken?: string | null; refreshToken?: string | null }) => {
            setLoginError(null)
            void completeTokenLogin(login)
        },
        [completeTokenLogin],
    )

    const handleApproveLoginApproved = useCallback(
        (result: ApproveLoginResult) => {
            setLoginError(null)
            void completeTokenLogin({
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
            })
        },
        [completeTokenLogin],
    )

    // Step/layer progress (parity with verify.fivucsas LoginMfaFlow). The DASHBOARD
    // login uses the PLATFORM login-config, which reports totalSteps=1 — MFA here is
    // dynamic per-user (not a configured layer), so we can't know upfront. We treat
    // password/identifier as step 1 and each MFA factor as a following step. Once
    // MFA is active we KNOW there are >=2 steps, so derive the total from the live
    // flow (password + the MFA factor in progress) — otherwise the indicator would
    // never appear on the dashboard (StepProgress hides when total<=1).
    //
    // `completedMfaMethods` already counts the satisfied first factor: the password
    // path seeds it with ['PASSWORD'] (length 1) and the identifier-first path seeds
    // it with the server's completedMethods (length 0 — the identifier is not a
    // verification step). So the step we are CURRENTLY on is `length + 1` for both
    // paths (password done → showing MFA factor 2; identifier typed → showing factor 1).
    const mfaInProgress = showMethodPicker || showSecondaryAuth
    const loginCurrentStep = mfaInProgress ? completedMfaMethods.length + 1 : 1
    // Total prefers the backend-authoritative flow size: `flowTotalSteps` is set
    // from the identifier-step preflight (resolves the caller's real tenant flow)
    // and from each /auth/mfa/step response. Falls back to the (platform)
    // login-config, then to the live progress so the bar can never read fewer
    // steps than we have already taken.
    const loginTotalSteps = Math.max(
        flowTotalSteps ?? loginConfig?.totalSteps ?? 1,
        mfaInProgress ? completedMfaMethods.length + 1 : 1,
    )

    // Approve-login (number-matching) panel — full-screen, same glass card shell
    // as the other interstitials so the surface reads consistently.
    if (showApproveLogin) {
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
                    }}
                >
                    <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                        <ApproveLoginPanel
                            onApproved={handleApproveLoginApproved}
                            onCancel={() => setShowApproveLogin(false)}
                        />
                    </CardContent>
                </Card>
            </Box>
        )
    }

    // Show method picker when multiple MFA methods are available
    // `user` is set by the password path; the identifier-first (no-password)
    // path has only an mfaSessionToken. Either is sufficient to show the
    // interstitials.
    const hasActiveMfaSession = Boolean(user) || Boolean(_mfaSessionToken)
    if (showMethodPicker && hasActiveMfaSession) {
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
                        <StepProgress current={loginCurrentStep} total={loginTotalSteps} />
                        {/* Show ALL configured Layer methods; not-yet-enrolled ones
                            (Hardware Key / Passkey / Approve) render disabled with a
                            "set up" hint (operator choice — every configured method is
                            visible). NO hideNonEnrolled. */}
                        <MethodPickerStep
                            availableMethods={availableMethods}
                            onMethodSelected={handleMethodSelected}
                            usedMethods={completedMfaMethods}
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
    if (showSecondaryAuth && hasActiveMfaSession) {
        return (
            <TwoFactorDispatcher
                method={twoFactorMethod}
                mfaSessionToken={_mfaSessionToken ?? ''}
                onAuthenticated={handleMfaResult}
                onBackToMethodSelection={handleBackToMethodSelection}
                onCancel={handleTwoFactorCancel}
                stepCurrent={loginCurrentStep}
                stepTotal={loginTotalSteps}
                email={getValues('email')}
            />
        )
    }

    // Layer-1 gating (D): show the password form ONLY when the config includes
    // PASSWORD as a Layer-1 method. When the config failed to load
    // (loginConfig === null) we show the password form as the safe default so an
    // admin is never locked out by a config-endpoint outage.
    const showPasswordForm = loginConfig ? hasPasswordLayer1(loginConfig) : true
    const formBusy = loading || identifierSubmitting
    // IDENTIFIER-FIRST (engine ON, platform login-config engineActive): the
    // password form opens email-only; the password field + Sign in are revealed
    // after the email step. Engine OFF ⇒ passwordRevealed irrelevant, the combined
    // legacy form renders exactly as before (reverts with the global flag).
    const engineActive = Boolean(loginConfig?.engineActive)
    const identifierFirst = showPasswordForm && engineActive
    const passwordHidden = identifierFirst && !passwordRevealed
    // Step 2 of identifier-first: the email was already collected on step 1, so
    // (like verify.fivucsas) render it read-only with a "Change" affordance and
    // show the password ALONE — NOT a second editable email field above it.
    const showEmailAsChip = identifierFirst && passwordRevealed
    // Usernameless shortcuts (passkey / approve-on-another-device) are
    // ALTERNATIVES to typing an identifier, so they belong ONLY on the initial
    // identity-entry screen: the email-first step (engine ON, before the email is
    // submitted) or the legacy single email+password form (engine OFF). Once the
    // user commits to the identifier path (email submitted → passwordRevealed),
    // they're redundant and confusing, so we hide them. "Change email" resets
    // passwordRevealed=false, so they correctly reappear on the email screen.
    const onInitialIdentityEntry = !passwordRevealed
    const showUsernamelessShortcuts = onInitialIdentityEntry
    // The IDENTIFIER-only screen (email-first step before the password is
    // revealed, OR a non-password Layer-1 that just collects the email) is NOT
    // a verification step, so it is UNNUMBERED — counting it double-counted the
    // flow (identifier "1/N" AND the first real factor "1/N"). The combined
    // legacy email+password form and the revealed-password screen DO show a
    // password factor, so they keep the counter (step 1/N). Parity with
    // verify.fivucsas's unnumbered FlowPhase.Identifier.
    const onIdentifierOnlyScreen = passwordHidden || !showPasswordForm
    // Email step → resolve the tenant's Layer-1 and let the user pick ANY allowed
    // first factor (not just password). Calls /auth/login/begin: when Layer-1 is a
    // CHOICE with >1 method we open a step-1 session and show the method picker;
    // when it's a single non-password method we run it directly; otherwise (single
    // PASSWORD, decoy, or any failure) we fall through to the classic password
    // screen — begin is best-effort and must NEVER block login. Password keeps its
    // own lockout-protected /auth/login path (chosen from the picker → password
    // form), so we don't route it through the begin session.
    const handleEmailContinue = async () => {
        const emailOk = await trigger('email')
        if (!emailOk) return
        const email = getValues('email')
        setLoginError(null)
        try {
            const begin = await authRepository.beginIdentifierLogin(email)
            if (begin.totalSteps) setFlowTotalSteps(begin.totalSteps)
            const methods = begin.availableMethods ?? []
            if (methods.length > 1) {
                // CHOICE Layer-1 → pick any first factor (incl. password).
                if (begin.mfaSessionToken) setMfaSessionToken(begin.mfaSessionToken)
                setCompletedMfaMethods(begin.completedMethods ?? [])
                setAvailableMethods(methods)
                setShowMethodPicker(true)
                return
            }
            const only = methods[0]
            if (only && only.methodType !== 'PASSWORD') {
                // Single non-password Layer-1 → run that factor straight away.
                if (begin.mfaSessionToken) setMfaSessionToken(begin.mfaSessionToken)
                setCompletedMfaMethods(begin.completedMethods ?? [])
                setTwoFactorMethod(only.methodType)
                setShowSecondaryAuth(true)
                return
            }
        } catch {
            /* engine off / decoy / network — fall through to the password screen */
        }
        // PASSWORD-only Layer-1 (or any fallback): classic password field.
        setPasswordRevealed(true)
        setTimeout(() => setFocus('password'), 0)
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

                        {/* Error Alert — shown in both password and identifier-first modes */}
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

                        {/* Step/layer progress — parity with verify.fivucsas so
                            the user sees which layer they're on. Renders nothing
                            for single-factor flows (total <= 1) and is HIDDEN on the
                            identifier-only screen (which is unnumbered — see
                            `onIdentifierOnlyScreen`) so the first real factor reads
                            1/N instead of double-counting the identity step. */}
                        {!onIdentifierOnlyScreen && (
                            <StepProgress current={loginCurrentStep} total={loginTotalSteps} />
                        )}

                        {/* Identifier-first entry (D): rendered when the tenant
                            login-config has NO password Layer-1 method. Collects
                            the identifier and opens an MFA session via
                            beginIdentifierLogin. */}
                        {!showPasswordForm && (
                            <motion.div variants={itemVariants}>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    {t('login.identifierFirstSubtitle')}
                                </Typography>
                                <TextField
                                    fullWidth
                                    type="email"
                                    label={t('auth.emailLabel')}
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !formBusy) {
                                            e.preventDefault()
                                            void handleIdentifierSubmit()
                                        }
                                    }}
                                    autoFocus
                                    disabled={formBusy}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <EmailOutlined sx={{ color: 'rgba(0,0,0,0.54)' }} />
                                            </InputAdornment>
                                        ),
                                    }}
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                                />
                                <Button
                                    fullWidth
                                    variant="contained"
                                    size="large"
                                    onClick={() => void handleIdentifierSubmit()}
                                    disabled={formBusy || !identifier.trim()}
                                    endIcon={!formBusy && <ArrowForward />}
                                    sx={{
                                        mt: 3,
                                        mb: 2,
                                        py: 1.5,
                                        borderRadius: '12px',
                                        fontWeight: 600,
                                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                    }}
                                >
                                    {identifierSubmitting ? (
                                        <CircularProgress size={24} sx={{ color: 'white' }} />
                                    ) : (
                                        t('auth.continue')
                                    )}
                                </Button>
                            </motion.div>
                        )}

                        {/* Login Form (password Layer-1) */}
                        {showPasswordForm && (
                        <form
                            onSubmit={
                                passwordHidden
                                    ? (e) => { e.preventDefault(); void handleEmailContinue() }
                                    : handleSubmit(onSubmit)
                            }
                            aria-label={t('auth.loginFormLabel')}
                        >
                            {/* Step 2 (identifier-first): read-only identity display + a hidden
                                username input (a11y / password managers). NO per-step "change
                                email" affordance — the uniform shell-level "Not you? Start over"
                                is the single identity control across ALL factors (matches
                                verify.fivucsas). PR #145 had re-added a password-only "Change"
                                button here, which made the password step inconsistent with every
                                other first factor — removed 2026-06-02. */}
                            {showEmailAsChip && (
                                <motion.div variants={itemVariants}>
                                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, overflow: 'hidden', mt: 1, mb: 0.5 }}>
                                        <EmailOutlined sx={{ fontSize: 18, color: 'rgba(0,0,0,0.54)' }} />
                                        <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1a1a2e' }}>
                                            {getValues('email')}
                                        </strong>
                                    </Box>
                                    {/* paired username field so the password field has an
                                        associated identifier for a11y + password managers */}
                                    <input
                                        type="text"
                                        name="username"
                                        autoComplete="username"
                                        value={getValues('email')}
                                        readOnly
                                        aria-hidden="true"
                                        tabIndex={-1}
                                        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                                    />
                                </motion.div>
                            )}

                            {/* Email Field — editable on the email step / legacy mode */}
                            {!showEmailAsChip && (
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
                                                '& input:-webkit-autofill, & input:-webkit-autofill:hover, & input:-webkit-autofill:focus, & input:-webkit-autofill:active': {
                                                    WebkitBoxShadow: '0 0 0 100px #ffffff inset',
                                                    WebkitTextFillColor: '#1a1a2e',
                                                    caretColor: '#1a1a2e',
                                                    // The long transition is the standard trick that stops Chrome
                                                    // from REPAINTING its light-blue autofill background back over
                                                    // our override (the missing piece that left it "still blue").
                                                    transition: 'background-color 9999s ease-in-out 0s',
                                                },
                                            }}
                                        />
                                    )}
                                />
                            </motion.div>

                            )}

                            {/* Password Field — hidden on the email-first step (engine ON) */}
                            {!passwordHidden && (
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
                                                '& input:-webkit-autofill, & input:-webkit-autofill:hover, & input:-webkit-autofill:focus, & input:-webkit-autofill:active': {
                                                    WebkitBoxShadow: '0 0 0 100px #ffffff inset',
                                                    WebkitTextFillColor: '#1a1a2e',
                                                    caretColor: '#1a1a2e',
                                                    // The long transition is the standard trick that stops Chrome
                                                    // from REPAINTING its light-blue autofill background back over
                                                    // our override (the missing piece that left it "still blue").
                                                    transition: 'background-color 9999s ease-in-out 0s',
                                                },
                                            }}
                                        />
                                    )}
                                />
                            </motion.div>
                            )}

                            {/* Forgot Password Link — only meaningful once the password field is shown */}
                            {!passwordHidden && (
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
                            )}

                            {/* Submit Button — "Continue" on the email-first step (reveals
                                password), "Sign in" once the password field is shown. */}
                            <motion.div variants={itemVariants}>
                                <Button
                                    type={passwordHidden ? 'button' : 'submit'}
                                    onClick={passwordHidden ? handleEmailContinue : undefined}
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
                                    ) : passwordHidden ? (
                                        t('auth.continue')
                                    ) : (
                                        t('auth.signIn')
                                    )}
                                </Button>
                            </motion.div>
                        </form>
                        )}

                        {/* Config-driven usernameless shortcuts (G-web). Shown
                            strictly per the tenant login-config; on a config
                            failure (loginConfig === null) `fallbackAll` keeps the
                            legacy passkey + approve buttons. */}
                        {/* Usernameless shortcuts only on the initial identity-entry
                            screen — rationale in `showUsernamelessShortcuts` above. */}
                        {showUsernamelessShortcuts && (
                        <motion.div variants={itemVariants}>
                            <Layer1Shortcuts<{ accessToken?: string | null; refreshToken?: string | null }>
                                config={loginConfig}
                                fallbackAll
                                onPasskeySuccess={handlePasskeySuccess}
                                onPasskeyError={(msg) => setLoginError(msg)}
                                onApproveClick={() => {
                                    setLoginError(null)
                                    setShowApproveLogin(true)
                                }}
                                disabled={formBusy}
                                hideDivider={!showPasswordForm}
                            />
                        </motion.div>
                        )}

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
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                    {t('auth.createOrgQuestion')}{' '}
                                    <Link
                                        href="/onboarding"
                                        onClick={(e: React.MouseEvent) => {
                                            e.preventDefault()
                                            navigate('/onboarding')
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
                                        {t('auth.createOrgLink')}
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
