/**
 * LoginMfaFlow — Widget-specific login + N-step MFA flow
 *
 * Used when the widget is opened in "login" mode (no session_id, has client_id).
 * Shows PasswordStep first, then handles MFA steps if required.
 *
 * Communicates completion via onComplete callback (which sends postMessage to parent).
 */

import { useState, useCallback } from 'react'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Typography,
} from '@mui/material'
import { Close, ArrowBack } from '@mui/icons-material'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useService } from '@app/providers/DependencyProvider'
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

type FlowPhase = 'password' | 'method-picker' | 'mfa-step' | 'complete'

interface LoginMfaFlowProps {
    clientId: string
    onComplete: (result: { accessToken: string; refreshToken?: string; userId: string; email?: string }) => void
    onCancel: () => void
}

export default function LoginMfaFlow({ clientId: _clientId, onComplete, onCancel }: LoginMfaFlowProps) {
    const { t } = useTranslation()
    const authRepository = useService<IAuthRepository>(TYPES.AuthRepository)
    const httpClient = useService<IHttpClient>(TYPES.HttpClient)

    const [phase, setPhase] = useState<FlowPhase>('password')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | undefined>(undefined)
    const [mfaSessionToken, setMfaSessionToken] = useState<string>('')
    const [availableMethods, setAvailableMethods] = useState<AvailableMfaMethod[]>([])
    const [selectedMethod, setSelectedMethod] = useState<string>('')
    const [currentStep, setCurrentStep] = useState(1)
    const [totalSteps, setTotalSteps] = useState(1)
    const [usedMethods, setUsedMethods] = useState<string[]>([])

    // ─── Password Submit ────────────────────────────────────────

    const handlePasswordSubmit = useCallback(async (data: { email: string; password: string }) => {
        setLoading(true)
        setError(undefined)

        try {
            const result = await authRepository.login({ email: data.email, password: data.password })

            if (result.twoFactorRequired) {
                // MFA required
                const token = result.mfaSessionToken ?? ''
                setMfaSessionToken(token)

                const methods = result.availableMethods ?? []
                const enrolledMethods = methods.filter((m) => m.enrolled)
                setAvailableMethods(methods)

                if (enrolledMethods.length > 1) {
                    // Multiple enrolled methods: show picker
                    setPhase('method-picker')
                } else {
                    // Single method: go directly to step
                    const method = result.twoFactorMethod || enrolledMethods[0]?.methodType || 'EMAIL_OTP'
                    setSelectedMethod(method)
                    setPhase('mfa-step')
                }
            } else {
                // No MFA — single-factor login complete
                onComplete({
                    accessToken: result.accessToken ?? '',
                    refreshToken: result.refreshToken ?? undefined,
                    userId: result.user?.id ?? '',
                    email: result.user?.email ?? undefined,
                })
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t('widget.loginFailed'))
        } finally {
            setLoading(false)
        }
    }, [authRepository, onComplete, t])

    // ─── Method Selection ───────────────────────────────────────

    const handleMethodSelected = useCallback((methodType: string) => {
        setSelectedMethod(methodType)
        setError(undefined)
        setPhase('mfa-step')
    }, [])

    const handleBackToMethodSelection = useCallback(() => {
        setError(undefined)
        setPhase('method-picker')
    }, [])

    const handleBackToPassword = useCallback(() => {
        setError(undefined)
        setMfaSessionToken('')
        setAvailableMethods([])
        setSelectedMethod('')
        setUsedMethods([])
        setPhase('password')
    }, [])

    // ─── MFA Step Verification ──────────────────────────────────

    const verifyStep = useCallback(async (method: string, data: Record<string, unknown>) => {
        setLoading(true)
        setError(undefined)

        try {
            const res = await authRepository.verifyMfaStep(mfaSessionToken, method, data)
            handleMfaResult(res)
        } catch (err) {
            setError(err instanceof Error ? err.message : t('widget.verificationFailed'))
        } finally {
            setLoading(false)
        }
    }, [authRepository, mfaSessionToken, t]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleMfaResult = useCallback((res: MfaStepResponse) => {
        if (res.status === MfaStepStatus.AUTHENTICATED && res.accessToken) {
            // All steps complete
            onComplete({
                accessToken: res.accessToken,
                refreshToken: res.refreshToken,
                userId: res.user?.id ? String(res.user.id) : '',
                email: res.user?.email ? String(res.user.email) : undefined,
            })
        } else if (res.status === MfaStepStatus.STEP_COMPLETED) {
            // More steps remain — track the method just used to exclude it from step 2
            setUsedMethods((prev) => selectedMethod && !prev.includes(selectedMethod) ? [...prev, selectedMethod] : prev)
            if (res.mfaSessionToken) setMfaSessionToken(res.mfaSessionToken)
            if (res.currentStep) setCurrentStep(res.currentStep)
            if (res.totalSteps) setTotalSteps(res.totalSteps)

            const methods = res.availableMethods ?? availableMethods
            setAvailableMethods(methods)

            const enrolled = methods.filter((m) => m.enrolled && m.methodType !== selectedMethod)
            if (enrolled.length > 1) {
                setPhase('method-picker')
            } else if (enrolled.length === 1) {
                setSelectedMethod(enrolled[0].methodType)
                setPhase('mfa-step')
            } else {
                setPhase('method-picker')
            }
        } else {
            setError(res.message || t('widget.verificationFailed'))
        }
    }, [onComplete, availableMethods, t])

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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
        >
            <Card
                sx={{
                    maxWidth: 520,
                    width: '100%',
                    mx: 'auto',
                    borderRadius: '24px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
                    border: '1px solid',
                    borderColor: 'divider',
                    overflow: 'visible',
                }}
            >
                <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                    {/* Header */}
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb: 3,
                        }}
                    >
                        <Typography
                            variant="h5"
                            sx={{
                                fontWeight: 700,
                                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                backgroundClip: 'text',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            {phase === 'password' ? t('widget.loginTitle') : t('widget.verifyIdentity')}
                        </Typography>
                        <Button
                            variant="text"
                            size="small"
                            onClick={onCancel}
                            disabled={loading}
                            startIcon={<Close />}
                            sx={{ color: 'text.secondary', minWidth: 'auto' }}
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
                            {phase === 'password' && (
                                <PasswordStep
                                    onSubmit={handlePasswordSubmit}
                                    loading={loading}
                                    error={error}
                                />
                            )}

                            {phase === 'method-picker' && (
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

                            {phase === 'mfa-step' && (
                                <Box>
                                    {renderMfaStep()}
                                    {/* Back to method selection (if multiple methods) */}
                                    {availableMethods.filter((m) => m.enrolled).length > 1 &&
                                        selectedMethod !== 'EMAIL_OTP' && (
                                            <Box sx={{ textAlign: 'center', mt: 2 }}>
                                                <Button
                                                    variant="text"
                                                    size="small"
                                                    onClick={handleBackToMethodSelection}
                                                    sx={{ color: 'text.secondary' }}
                                                >
                                                    {t('mfa.backToMethodSelection')}
                                                </Button>
                                            </Box>
                                        )}
                                </Box>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {/* Step counter for MFA */}
                    {(phase === 'mfa-step' || phase === 'method-picker') && totalSteps > 1 && (
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                                display: 'block',
                                textAlign: 'center',
                                mt: 3,
                            }}
                        >
                            {t('widget.stepOfTotal', { current: currentStep, total: totalSteps })}
                        </Typography>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    )
}
