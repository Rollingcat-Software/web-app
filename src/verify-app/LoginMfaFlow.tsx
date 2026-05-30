/**
 * LoginMfaFlow — Widget-specific login + N-step MFA flow
 *
 * Used when the widget is opened in "login" mode (no session_id, has client_id).
 * Shows PasswordStep first, then handles MFA steps if required.
 *
 * Communicates completion via onComplete callback (which sends postMessage to parent).
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    InputAdornment,
    TextField,
    Typography,
} from '@mui/material'
import { Close, ArrowBack, EmailOutlined } from '@mui/icons-material'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { formatApiError } from '@utils/formatApiError'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IAuthRepository, AvailableMfaMethod, MfaStepResponse } from '@domain/interfaces/IAuthRepository'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import { AuthMethodType, MfaStepStatus, MfaStepAction, AUTH_API, EASE_OUT } from '@features/auth/constants'
import type { ChallengeResponse } from '@features/auth/webauthn-utils'
import PasswordStep from '@features/auth/components/steps/PasswordStep'
import MethodPickerStep from '@features/auth/components/steps/MethodPickerStep'
import TotpStep from '@features/auth/components/steps/TotpStep'
import SmsOtpStep from '@features/auth/components/steps/SmsOtpStep'
import EmailOtpMfaStep from '@features/auth/components/steps/EmailOtpMfaStep'
import FaceCaptureStep from '@features/auth/components/steps/FaceCaptureStep'
import VoiceStep from '@features/auth/components/steps/VoiceStep'
import FingerprintStep from '@features/auth/components/steps/FingerprintStep'
import QrCodeStep from '@features/auth/components/steps/QrCodeStep'
import HardwareKeyStep from '@features/auth/components/steps/HardwareKeyStep'
import NfcStep from '@features/auth/components/steps/NfcStep'
import StepProgress from './StepProgress'
import { hasPasswordLayer1, needsIdentifier, type LoginConfig } from '@domain/models/LoginConfig'

/**
 * The discrete screens of the login flow. Named constants (not bare string
 * literals) so call sites read intentionally and a typo is a compile error.
 */
const FlowPhase = {
    /** Legacy single screen: email + password together (engine OFF). */
    Password: 'password',
    /** Identifier-first screen 1: collect email only (engine ON). */
    Identifier: 'identifier',
    /** Choose which configured factor to use for the current step. */
    MethodPicker: 'method-picker',
    /** Verify the selected MFA factor. */
    MfaStep: 'mfa-step',
    /** Flow finished. */
    Complete: 'complete',
} as const
type FlowPhase = (typeof FlowPhase)[keyof typeof FlowPhase]

interface LoginMfaFlowProps {
    clientId: string
    onComplete: (result: { accessToken: string; refreshToken?: string; userId: string; email?: string; completedMethods?: string[]; mfaSessionToken?: string; timestamp?: number }) => void
    onCancel: () => void
    onStepChange?: (stepIndex: number, methodType: string, totalSteps: number) => void
    /**
     * Tenant Layer-1 config (D). When present, the first phase is rendered
     * STRICTLY from it: the password field appears ONLY if PASSWORD is a
     * Layer-1 method; otherwise an identifier-first entry is shown that starts
     * the flow with the configured non-password methods. `null`/undefined ⇒
     * legacy behaviour (always start on the password step).
     */
    loginConfig?: LoginConfig | null
}

export default function LoginMfaFlow({ clientId, onComplete, onCancel, onStepChange, loginConfig }: LoginMfaFlowProps) {
    const { t } = useTranslation()
    const authRepository = useService<IAuthRepository>(TYPES.AuthRepository)
    const httpClient = useService<IHttpClient>(TYPES.HttpClient)

    // Layer-1 rendering decision (D). With a config that omits PASSWORD we never
    // show the password field; if an identifier is still required we collect it
    // first, otherwise we go straight to picking a Layer-1 method.
    const passwordIsLayer1 = !loginConfig || hasPasswordLayer1(loginConfig)
    const identifierRequired = loginConfig ? needsIdentifier(loginConfig) : true
    // IDENTIFIER-FIRST (engine ON): screen 1 collects only identity (email /
    // passkey); EVERY factor — including password — comes afterwards. So even a
    // password-Layer-1 flow starts on the 'identifier' phase. When the engine is
    // OFF we keep the legacy single-screen email+password ('password' phase), so
    // the whole redesign reverts with the engine flag and no web redeploy.
    const engineActive = Boolean(loginConfig?.engineActive)

    /** Which screen the flow opens on, given the tenant config + engine flag. */
    function pickInitialPhase(): FlowPhase {
        // Identifier-first (engine ON): screen 1 collects identity only; password
        // and every other factor are presented afterwards.
        if (engineActive && identifierRequired) return FlowPhase.Identifier
        // Legacy (engine OFF): the single email+password screen.
        if (passwordIsLayer1) return FlowPhase.Password
        // Non-password Layer-1 that still needs an identifier (e.g. OTP-first).
        if (identifierRequired) return FlowPhase.Identifier
        // All-usernameless Layer-1 (passkey / QR) — go straight to method choice.
        return FlowPhase.MethodPicker
    }
    const initialPhase: FlowPhase = pickInitialPhase()

    const [phase, setPhase] = useState<FlowPhase>(initialPhase)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | undefined>(undefined)
    const [mfaSessionToken, setMfaSessionToken] = useState<string>('')
    const [availableMethods, setAvailableMethods] = useState<AvailableMfaMethod[]>([])
    const [selectedMethod, setSelectedMethod] = useState<string>('')
    const [currentStep, setCurrentStep] = useState(1)
    const [totalSteps, setTotalSteps] = useState(1)
    const [usedMethods, setUsedMethods] = useState<string[]>([])
    // Identifier-first entry (config without PASSWORD): the typed email.
    const [identifier, setIdentifier] = useState('')

    // Perf (USER-BUG-7): warm MediaPipe FaceLandmarker in the background while
    // the user is still on the password step. By the time MFA dispatches the
    // face capture step, the WASM + .task model are already cached. Lazy
    // import keeps BiometricEngine off the password-step critical path.
    // Copilot post-merge round 5: BiometricEngine.initialize() is now
    // single-flight (shared in-flight promise) so this idle warm-up cannot
    // race with useFaceDetection's on-mount init. Failures are non-fatal —
    // useFaceDetection retries on demand.
    useEffect(() => {
        let cancelled = false
        const win = window as Window & { requestIdleCallback?: (cb: () => void) => void }
        const idle = win.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1))
        idle(() => {
            if (cancelled) return
            import('@/lib/biometric-engine/core/BiometricEngine')
                .then(({ BiometricEngine }) => {
                    if (cancelled) return
                    return BiometricEngine.getInstance().initialize()
                })
                .catch(() => {
                    // Non-fatal — useFaceDetection retries on demand
                })
        })
        return () => {
            cancelled = true
        }
    }, [])

    // Notify parent bridge when the login/MFA phase changes
    useEffect(() => {
        if (!onStepChange) return
        // Map login flow phases to step indices for the postMessage bridge
        // password=0, method-picker=1, mfa-step=1 (step 2 of 2 when MFA is active)
        if (phase === FlowPhase.Password || phase === FlowPhase.Identifier) {
            onStepChange(0, phase === FlowPhase.Password ? 'PASSWORD' : 'IDENTIFIER', totalSteps > 1 ? totalSteps : 1)
        } else if (phase === FlowPhase.MethodPicker || phase === FlowPhase.MfaStep) {
            const stepIdx = currentStep - 1
            onStepChange(stepIdx, selectedMethod || 'MFA', totalSteps)
        }
    }, [phase, selectedMethod, currentStep, totalSteps, onStepChange])

    // loginConfig is fetched ASYNCHRONOUSLY by the parent (HostedLoginApp /
    // LoginPage), so on first mount it is null and the `useState` initializer
    // derived the legacy 'password' opening screen. Once the real config lands,
    // re-derive the opening phase ONCE — but only while the user is still on that
    // opening password screen and hasn't submitted anything, so we never pull
    // someone out of a flow they already started. This is what actually opens
    // engine-ON (engineActive) tenants identifier-first: without it the page
    // stays on the null-config legacy screen even though the config says
    // otherwise.
    const openingPhaseSyncedRef = useRef(false)
    useEffect(() => {
        if (openingPhaseSyncedRef.current || !loginConfig) return
        openingPhaseSyncedRef.current = true
        const intended = pickInitialPhase()
        setPhase((current) =>
            current === FlowPhase.Password && !mfaSessionToken && !identifier.trim()
                ? intended
                : current,
        )
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loginConfig])

    // ─── Password Submit ────────────────────────────────────────

    const handlePasswordSubmit = useCallback(async (data: { email: string; password: string }) => {
        setLoading(true)
        setError(undefined)

        try {
            // T-TENANT-GATE 2026-05-07: forward clientId so the backend can
            // reject wrong-tenant users at the password step (HTTP 403 +
            // TENANT_MISMATCH). Without this, a gmail user submitting the
            // Marmara hosted-login form passes password + MFA only to fail at
            // /oauth2/authorize/complete with no enrollment in the foreign
            // tenant — the bug user reported on demo.fivucsas.com.
            const result = await authRepository.login({
                email: data.email,
                password: data.password,
                clientId: clientId || undefined,
            })

            if (result.twoFactorRequired) {
                // MFA required
                const token = result.mfaSessionToken ?? ''
                setMfaSessionToken(token)

                const methods = result.availableMethods ?? []
                const enrolledMethods = methods.filter((m) => m.enrolled)
                setAvailableMethods(methods)
                if (result.completedMethods?.length) {
                    setUsedMethods((prev) =>
                        Array.from(new Set([...prev, ...result.completedMethods!])),
                    )
                }

                if (enrolledMethods.length > 1) {
                    // Multiple enrolled methods: show picker
                    setPhase(FlowPhase.MethodPicker)
                } else {
                    // Single method: go directly to step
                    const method = result.twoFactorMethod || enrolledMethods[0]?.methodType || 'EMAIL_OTP'
                    setSelectedMethod(method)
                    setPhase(FlowPhase.MfaStep)
                }
            } else {
                // No MFA — single-factor login complete
                onComplete({
                    accessToken: result.accessToken ?? '',
                    refreshToken: result.refreshToken ?? undefined,
                    userId: result.user?.id ?? '',
                    email: result.user?.email ?? undefined,
                    completedMethods: ['PASSWORD'],
                    timestamp: Date.now(),
                })
            }
        } catch (err) {
            setError(formatApiError(err, t))
        } finally {
            setLoading(false)
        }
    }, [authRepository, clientId, onComplete, t])

    // ─── Identifier-first Submit (config without PASSWORD) ──────

    // Seed the method picker from the tenant's Layer-1 config when there is no
    // password factor. Non-usernameless Layer-1 methods (EMAIL_OTP, SMS_OTP, …)
    // are surfaced here; usernameless ones are handled by the shortcut buttons.
    const configLayer1Methods: AvailableMfaMethod[] = (loginConfig?.layer1.methods ?? [])
        .filter((m) => m.type !== AuthMethodType.PASSWORD && !m.usernameless)
        .map((m) => ({
            methodType: m.type,
            name: m.type,
            category: '',
            enrolled: true,
            preferred: false,
            requiresEnrollment: m.requiresEnrollment,
        }))

    const handleIdentifierSubmit = useCallback(async () => {
        if (!identifier.trim()) {
            setError(t('auth.validation.emailRequired'))
            return
        }
        // Identifier-first WITH a password factor: we now know who the user is,
        // so just reveal the password screen. The /auth/login call happens at the
        // password step (with this email), then any MFA steps follow. No
        // beginIdentifierLogin here — password is authenticated via /auth/login.
        if (engineActive && passwordIsLayer1) {
            setError(undefined)
            setPhase(FlowPhase.Password)
            return
        }
        setLoading(true)
        setError(undefined)
        try {
            const result = await authRepository.beginIdentifierLogin(
                identifier.trim(),
                clientId || undefined,
            )
            const token = result.mfaSessionToken ?? ''
            setMfaSessionToken(token)
            const methods = result.availableMethods ?? configLayer1Methods
            setAvailableMethods(methods)
            if (result.completedMethods?.length) {
                setUsedMethods((prev) => Array.from(new Set([...prev, ...result.completedMethods!])))
            }
            const enrolled = methods.filter((m) => m.enrolled)
            if (enrolled.length > 1) {
                setPhase(FlowPhase.MethodPicker)
            } else if (enrolled.length === 1) {
                setSelectedMethod(enrolled[0].methodType)
                setPhase(FlowPhase.MfaStep)
            } else {
                setPhase(FlowPhase.MethodPicker)
            }
        } catch (err) {
            setError(formatApiError(err, t))
        } finally {
            setLoading(false)
        }
    }, [authRepository, identifier, clientId, configLayer1Methods, engineActive, passwordIsLayer1, t])

    // ─── Method Selection ───────────────────────────────────────

    const handleMethodSelected = useCallback((methodType: string) => {
        setSelectedMethod(methodType)
        setError(undefined)
        setPhase(FlowPhase.MfaStep)
    }, [])

    const handleBackToMethodSelection = useCallback(() => {
        setError(undefined)
        setPhase(FlowPhase.MethodPicker)
    }, [])

    const handleBackToPassword = useCallback(() => {
        setError(undefined)
        setMfaSessionToken('')
        setAvailableMethods([])
        setSelectedMethod('')
        setUsedMethods([])
        // Return to whichever entry phase this flow started on (password vs
        // identifier-first), not unconditionally to password.
        setPhase(initialPhase)
    }, [initialPhase])

    // ─── MFA Step Verification ──────────────────────────────────

    const verifyStep = useCallback(async (method: string, data: Record<string, unknown>) => {
        setLoading(true)
        setError(undefined)

        try {
            const res = await authRepository.verifyMfaStep(mfaSessionToken, method, data)
            handleMfaResult(res)
        } catch (err) {
            setError(formatApiError(err, t))
        } finally {
            setLoading(false)
        }
    }, [authRepository, mfaSessionToken, t]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleMfaResult = useCallback((res: MfaStepResponse) => {
        if (res.status === MfaStepStatus.AUTHENTICATED && res.accessToken) {
            // All steps complete — include PASSWORD (always first) + any MFA methods used + current
            const finalMethods = Array.from(new Set<string>([
                'PASSWORD',
                ...usedMethods,
                ...(selectedMethod ? [selectedMethod] : []),
            ]))
            onComplete({
                accessToken: res.accessToken,
                refreshToken: res.refreshToken,
                userId: res.user?.id ? String(res.user.id) : '',
                email: res.user?.email ? String(res.user.email) : undefined,
                completedMethods: finalMethods,
                mfaSessionToken: mfaSessionToken || undefined,
                timestamp: Date.now(),
            })
        } else if (res.status === MfaStepStatus.STEP_COMPLETED) {
            // More steps remain — merge backend-authoritative completed list with local + current.
            // Compute the merged set synchronously so the picker decision below cannot
            // re-route the user back through an already-completed method (the bug:
            // "Fingerprint succeeded — and then the SAME fingerprint step ran again").
            // Using only `selectedMethod` for the filter was insufficient because a
            // server-side legit-repeat could leave the just-cleared method in
            // availableMethods AND the local closure had not yet seen the updated state.
            const mergedUsed = new Set<string>(usedMethods)
            if (res.completedMethods?.length) res.completedMethods.forEach((m) => mergedUsed.add(m))
            if (selectedMethod) mergedUsed.add(selectedMethod)
            setUsedMethods(Array.from(mergedUsed))

            if (res.mfaSessionToken) setMfaSessionToken(res.mfaSessionToken)
            if (res.currentStep) setCurrentStep(res.currentStep)
            if (res.totalSteps) setTotalSteps((prev) => Math.max(prev, res.totalSteps!))

            const methods = res.availableMethods ?? availableMethods
            setAvailableMethods(methods)

            // Clear the active selection; we are between steps. A new method will be
            // chosen below (auto-pick or via the picker) and the FingerprintStep /
            // FaceStep / etc. component will remount because `selectedMethod` changed.
            setSelectedMethod('')

            const enrolled = methods.filter((m) => m.enrolled && !mergedUsed.has(m.methodType))
            if (enrolled.length > 1) {
                setPhase(FlowPhase.MethodPicker)
            } else if (enrolled.length === 1) {
                setSelectedMethod(enrolled[0].methodType)
                setPhase(FlowPhase.MfaStep)
            } else {
                setPhase(FlowPhase.MethodPicker)
            }
        } else {
            setError(t('widget.verificationFailed'))
        }
    }, [onComplete, availableMethods, mfaSessionToken, usedMethods, selectedMethod, t])

    // ─── WebAuthn Challenge Helper ────────────────────────────────

    const requestWebAuthnChallenge = useCallback(async (method: AuthMethodType): Promise<ChallengeResponse | null> => {
        const res = await authRepository.verifyMfaStep(
            mfaSessionToken, method, { action: MfaStepAction.CHALLENGE }
        )
        if (res.data && typeof res.data.challenge === 'string') {
            return {
                challenge: res.data.challenge,
                rpId: typeof res.data.rpId === 'string' ? res.data.rpId : undefined,
                timeout: typeof res.data.timeout === 'string' ? res.data.timeout : undefined,
                allowCredentials: Array.isArray(res.data.allowCredentials) ? res.data.allowCredentials as string[] : undefined,
            }
        }
        return null
    }, [authRepository, mfaSessionToken])

    // ─── Render Step Component ──────────────────────────────────

    const renderMfaStep = () => {
        const method = selectedMethod

        if (!method || method === AuthMethodType.EMAIL_OTP) {
            return (
                <EmailOtpMfaStep
                    mfaSessionToken={mfaSessionToken}
                    onAuthenticated={handleMfaResult}
                    onBack={handleBackToMethodSelection}
                />
            )
        }

        switch (method) {
            case AuthMethodType.TOTP:
                return (
                    <TotpStep
                        onSubmit={(code) => verifyStep(AuthMethodType.TOTP, { code })}
                        loading={loading}
                        error={error}
                    />
                )

            case AuthMethodType.SMS_OTP:
                return (
                    <SmsOtpStep
                        onSubmit={(code) => verifyStep(AuthMethodType.SMS_OTP, { code })}
                        onSendOtp={async () => {
                            try {
                                await httpClient.post(AUTH_API.MFA_SEND_OTP, {
                                    sessionToken: mfaSessionToken,
                                    method: AuthMethodType.SMS_OTP,
                                })
                            } catch {
                                // fire-and-forget
                            }
                        }}
                        loading={loading}
                        error={error}
                    />
                )

            case AuthMethodType.FACE:
                return (
                    <FaceCaptureStep
                        onSubmit={(image) => verifyStep(AuthMethodType.FACE, { image })}
                        loading={loading}
                        error={error}
                    />
                )

            case AuthMethodType.VOICE:
                return (
                    <VoiceStep
                        onSubmit={(voiceData) => verifyStep(AuthMethodType.VOICE, { voiceData })}
                        loading={loading}
                        error={error}
                    />
                )

            case AuthMethodType.FINGERPRINT:
                return (
                    <FingerprintStep
                        onRequestChallenge={() => requestWebAuthnChallenge(AuthMethodType.FINGERPRINT)}
                        onSubmit={(data) => verifyStep(AuthMethodType.FINGERPRINT, { assertion: data })}
                        loading={loading}
                        error={error}
                    />
                )

            case AuthMethodType.QR_CODE:
                return (
                    <QrCodeStep
                        userId="mfa-session"
                        onGenerateToken={async () => {
                            const res = await httpClient.post<{ token: string; expiresInSeconds: number }>(
                                AUTH_API.MFA_QR_GENERATE,
                                { sessionToken: mfaSessionToken }
                            )
                            return res.data
                        }}
                        onSubmit={(token) => verifyStep(AuthMethodType.QR_CODE, { token })}
                        loading={loading}
                        error={error}
                    />
                )

            case AuthMethodType.HARDWARE_KEY:
                return (
                    <HardwareKeyStep
                        onRequestChallenge={() => requestWebAuthnChallenge(AuthMethodType.HARDWARE_KEY)}
                        onSubmit={(data) => verifyStep(AuthMethodType.HARDWARE_KEY, { assertion: data })}
                        loading={loading}
                        error={error}
                    />
                )

            case AuthMethodType.NFC_DOCUMENT:
                return (
                    <NfcStep
                        onSubmit={(data) => verifyStep(AuthMethodType.NFC_DOCUMENT, { nfcData: data })}
                        loading={loading}
                        error={error}
                        onBack={handleBackToMethodSelection}
                    />
                )

            default:
                return (
                    <Alert severity="warning" sx={{ borderRadius: '12px' }}>
                        {t('widget.unknownMethod', { method })}
                    </Alert>
                )
        }
    }

    // ─── Render ─────────────────────────────────────────────────

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE_OUT }}
        >
            <Card
                sx={(th) => {
                    // Softer, mode-aware elevation. The default MuiCard hover lift
                    // is overridden because MFA flow cards should feel grounded,
                    // not interactive-on-hover — so the same shadow is used on
                    // base and :hover. Defined once here to prevent drift.
                    const groundedShadow = th.palette.mode === 'dark'
                        ? '0 8px 24px -8px rgba(0,0,0,0.5)'
                        : '0 8px 24px -8px rgba(15,23,42,0.12), 0 2px 6px -2px rgba(15,23,42,0.06)'
                    return {
                        maxWidth: 520,
                        width: '100%',
                        mx: 'auto',
                        borderRadius: '20px',
                        border: '1px solid',
                        borderColor: 'divider',
                        overflow: 'visible',
                        boxShadow: groundedShadow,
                        '&:hover': {
                            boxShadow: groundedShadow,
                            transform: 'none',
                        },
                    }
                }}
            >
                {/* Top-of-flow progress indicator — shown on every MFA step, not just the last.
                    Earlier behavior hid the counter until the backend reported `totalSteps > 1`
                    on STEP_COMPLETED, which only happens AFTER the user finishes a step — so
                    the counter only appeared on the last step (user-reported bug:
                    "Adım N/3 only renders on step 3 of 3"). We now show a counter as soon as
                    the user is on the MFA leg of the flow, inferring a safe total when the
                    backend hasn't reported one yet. */}
                <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                    {(() => {
                        if (phase === FlowPhase.Password || phase === FlowPhase.Identifier) {
                            return <StepProgress current={1} total={loginConfig?.totalSteps ?? 0} />
                        }
                        // Authoritative-total takes precedence; otherwise infer at least
                        // 2 (PASSWORD + 1 MFA step). `currentStep` is clamped inside
                        // StepProgress so a stale-low `currentStep` cannot exceed total.
                        const displayTotal = Math.max(totalSteps, 2, currentStep)
                        // Display "step 2" minimum once we leave the password phase, so
                        // the user sees their progression past PASSWORD (step 1) into MFA.
                        const displayCurrent = Math.max(currentStep, 2)
                        return (
                            <StepProgress
                                current={Math.min(displayCurrent, displayTotal)}
                                total={displayTotal}
                            />
                        )
                    })()}

                    {/* Header */}
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: 1.5,
                            mb: 3,
                        }}
                    >
                        <Typography
                            variant="h5"
                            sx={{
                                fontFamily: '"Poppins", "Inter", sans-serif',
                                fontWeight: 700,
                                letterSpacing: '-0.02em',
                                lineHeight: 1.2,
                                flexGrow: 1,
                                minWidth: 0,
                                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                backgroundClip: 'text',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            {phase === FlowPhase.Password || phase === FlowPhase.Identifier
                                ? t('widget.loginTitle')
                                : t('widget.verifyIdentity')}
                        </Typography>
                        <Button
                            variant="text"
                            size="small"
                            onClick={onCancel}
                            disabled={loading}
                            startIcon={<Close fontSize="small" />}
                            sx={{
                                color: 'text.secondary',
                                flexShrink: 0,
                                minWidth: 'auto',
                                fontWeight: 500,
                                px: 1.25,
                            }}
                        >
                            {t('widget.cancel')}
                        </Button>
                    </Box>

                    {/* Content */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={phase + selectedMethod}
                            initial={{ opacity: 0, x: 30 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -30 }}
                            transition={{ duration: 0.3, ease: EASE_OUT }}
                        >
                            {phase === FlowPhase.Password && (
                                <PasswordStep
                                    onSubmit={handlePasswordSubmit}
                                    loading={loading}
                                    error={error}
                                    presetEmail={
                                        engineActive && passwordIsLayer1 && identifier.trim()
                                            ? identifier.trim()
                                            : undefined
                                    }
                                    onChangeIdentity={
                                        engineActive
                                            ? () => {
                                                  setError(undefined)
                                                  setPhase(FlowPhase.Identifier)
                                              }
                                            : undefined
                                    }
                                />
                            )}

                            {phase === FlowPhase.Identifier && (
                                <Box>
                                    {error && (
                                        <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
                                            {error}
                                        </Alert>
                                    )}
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
                                            if (e.key === 'Enter' && !loading) {
                                                e.preventDefault()
                                                void handleIdentifierSubmit()
                                            }
                                        }}
                                        autoFocus
                                        disabled={loading}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <EmailOutlined sx={{ color: 'text.secondary' }} />
                                                </InputAdornment>
                                            ),
                                        }}
                                        sx={{
                                            mb: 2,
                                            '& .MuiOutlinedInput-root': { borderRadius: '12px' },
                                        }}
                                    />
                                    <Button
                                        fullWidth
                                        variant="contained"
                                        size="large"
                                        onClick={() => void handleIdentifierSubmit()}
                                        disabled={loading || !identifier.trim()}
                                        sx={{ py: 1.5, borderRadius: '12px', fontWeight: 600 }}
                                    >
                                        {t('auth.continue')}
                                    </Button>
                                </Box>
                            )}

                            {phase === FlowPhase.MethodPicker && (
                                <Box>
                                    <MethodPickerStep
                                        availableMethods={availableMethods}
                                        onMethodSelected={handleMethodSelected}
                                        hideNonEnrolled
                                        excludeMethods={usedMethods}
                                    />
                                    <Box sx={{ textAlign: 'center', mt: 2 }}>
                                        <Button
                                            variant="text"
                                            size="small"
                                            startIcon={<ArrowBack />}
                                            onClick={handleBackToPassword}
                                            sx={{ color: 'text.secondary' }}
                                        >
                                            {t('auth.backToLogin')}
                                        </Button>
                                    </Box>
                                </Box>
                            )}

                            {phase === FlowPhase.MfaStep && (
                                <Box>
                                    {/* Back to method selection — rendered ABOVE the step so it
                                        stays visible even when step content (e.g. Face camera)
                                        is tall enough to push trailing UI off-screen. */}
                                    {availableMethods.filter((m) => m.enrolled).length > 1 &&
                                        selectedMethod !== 'EMAIL_OTP' && (
                                            <Box sx={{ mb: 1 }}>
                                                <Button
                                                    variant="text"
                                                    size="small"
                                                    startIcon={<ArrowBack />}
                                                    onClick={handleBackToMethodSelection}
                                                    sx={{ color: 'text.secondary' }}
                                                >
                                                    {t('mfa.backToMethodSelection')}
                                                </Button>
                                            </Box>
                                        )}
                                    {renderMfaStep()}
                                </Box>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {/* Bottom step counter removed — StepProgress at the top is the
                        single authoritative indicator per Fix 4 (2026-04-18c). */}
                </CardContent>
            </Card>
        </motion.div>
    )
}
