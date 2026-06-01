import { useState, useCallback } from 'react'
import {
    Box,
    Button,
    Card,
    CardContent,
} from '@mui/material'
import { ArrowBack } from '@mui/icons-material'
import { motion } from 'framer-motion'
import StepProgress from '../../../verify-app/StepProgress'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IAuthRepository, MfaStepResponse } from '@domain/interfaces/IAuthRepository'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import { useTranslation } from 'react-i18next'
import { AuthMethodType, MfaStepStatus, EASE_OUT } from '../constants'
import MfaStepRenderer from '../login-shared/MfaStepRenderer'
import { makeRequestWebAuthnChallenge } from '../login-shared/webauthnChallenge'

interface TwoFactorDispatcherProps {
    method: string
    mfaSessionToken: string
    onAuthenticated: (response: MfaStepResponse) => void
    onBackToMethodSelection: () => void
    onCancel: () => void
    /** Step/factor progress (parity with verify.fivucsas). Renders a StepProgress
     *  bar at the top of the MFA card; hidden when total <= 1. */
    stepCurrent?: number
    stepTotal?: number
    /** The already-collected identifier — shown read-only on a PASSWORD MFA step
     *  ("Signing in as <email>"); the password completes the step via /auth/mfa/step. */
    email?: string
}

/**
 * TwoFactorDispatcher
 *
 * Routes the MFA step to the correct step component.
 * Uses POST /auth/mfa/step (public, no JWT) with session token.
 * Handles N-step flows: on STEP_COMPLETED shows next step, on AUTHENTICATED returns tokens.
 */
export default function TwoFactorDispatcher({
    method,
    mfaSessionToken,
    onAuthenticated,
    onBackToMethodSelection,
    onCancel: _onCancel,
    stepCurrent,
    stepTotal,
    email,
}: TwoFactorDispatcherProps) {
    const authRepository = useService<IAuthRepository>(TYPES.AuthRepository)
    const httpClient = useService<IHttpClient>(TYPES.HttpClient)
    const { t } = useTranslation()

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | undefined>(undefined)

    // ─── WebAuthn Challenge Helper ────────────────────────────────
    // Hook declarations must run on every render (rules-of-hooks) — they are
    // placed before the EMAIL_OTP early-return below so ordering stays stable.
    const requestWebAuthnChallenge = useCallback(
        (method: AuthMethodType) =>
            makeRequestWebAuthnChallenge(authRepository, mfaSessionToken)(method),
        [authRepository, mfaSessionToken],
    )

    const verifyStep = useCallback(async (methodType: string, data: Record<string, unknown>) => {
        setLoading(true)
        setError(undefined)
        try {
            const res = await authRepository.verifyMfaStep(mfaSessionToken, methodType, data)

            if (res.status === MfaStepStatus.AUTHENTICATED) {
                onAuthenticated(res)
            } else if (res.status === MfaStepStatus.STEP_COMPLETED) {
                onAuthenticated(res)
            } else {
                // Backend sends English messages like "Verification failed for FACE"
                // Always show translated message instead
                setError(t('mfa.verificationFailed'))
            }
        } catch (err) {
            // Check for rate limit (429)
            const axiosErr = err as { response?: { status?: number } }
            if (axiosErr.response?.status === 429) {
                setError(t('errors.rateLimitExceeded'))
            } else {
                setError(t('mfa.verificationFailed'))
            }
        } finally {
            setLoading(false)
        }
    }, [authRepository, mfaSessionToken, onAuthenticated, t])

    // The actual step body is rendered by the SHARED MfaStepRenderer (kept
    // identical with verify.fivucsas's LoginMfaFlow). This dispatcher only owns
    // the dashboard's full-screen glass-card SHELL + step progress + back/cancel.
    const stepBody = (
        <MfaStepRenderer
            method={method}
            mfaSessionToken={mfaSessionToken}
            verifyStep={verifyStep}
            requestWebAuthnChallenge={requestWebAuthnChallenge}
            httpClient={httpClient}
            onAuthenticated={onAuthenticated}
            onBack={onBackToMethodSelection}
            loading={loading}
            error={error}
            onError={setError}
            presetEmail={email}
        />
    )

    // EMAIL_OTP: use the new session-token-based OTP flow
    if (!method || method === AuthMethodType.EMAIL_OTP) {
        // Auto-send OTP on mount, then show code input
        return (
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f64f59 100%)',
                    backgroundSize: '400% 400%',
                    animation: 'gradientShift 15s ease infinite',
                    '@keyframes gradientShift': {
                        '0%': { backgroundPosition: '0% 50%' },
                        '50%': { backgroundPosition: '100% 50%' },
                        '100%': { backgroundPosition: '0% 50%' },
                    },
                    p: { xs: 2, sm: 3 },
                }}
            >
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: EASE_OUT }}
                    style={{ width: '100%', maxWidth: 400 }}
                >
                    <Card
                        sx={{
                            borderRadius: '24px',
                            background: 'rgba(255, 255, 255, 0.95)',
                            backdropFilter: 'blur(20px)',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            color: '#1a1a2e',
                            '& .MuiTypography-root': { color: '#1a1a2e' },
                            '& .MuiTypography-colorTextSecondary': { color: 'rgba(0,0,0,0.6)' },
                            '& .MuiInputBase-input': { color: '#1a1a2e' },
                            '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' },
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' },
                            // The MFA card is intentionally a fixed light surface even in dark
                            // mode. The step TextFields fill their box from the theme token
                            // `background.paper` (near-black in dark mode) → black-on-black
                            // code inputs. Force the input box white to match the card. `&&`
                            // doubles specificity so it beats the per-step `background.paper`.
                            '&& .MuiOutlinedInput-root': {
                                backgroundColor: '#ffffff',
                                '&:hover': { backgroundColor: '#ffffff' },
                                '&.Mui-focused': { backgroundColor: '#ffffff' },
                            },
                        }}
                    >
                        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                            {typeof stepCurrent === 'number' && typeof stepTotal === 'number' && (
                                <StepProgress current={stepCurrent} total={stepTotal} />
                            )}
                            {stepBody}
                        </CardContent>
                    </Card>
                </motion.div>
            </Box>
        )
    }

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f64f59 100%)',
                backgroundSize: '400% 400%',
                animation: 'gradientShift 15s ease infinite',
                '@keyframes gradientShift': {
                    '0%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' },
                    '100%': { backgroundPosition: '0% 50%' },
                },
                p: { xs: 2, sm: 3 },
            }}
        >
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE_OUT }}
                style={{ width: '100%', maxWidth: 480 }}
            >
                <Card
                    sx={{
                        borderRadius: '24px',
                        background: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(20px)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        color: '#1a1a2e',
                        '& .MuiTypography-root': { color: '#1a1a2e' },
                        '& .MuiTypography-colorTextSecondary': { color: 'rgba(0,0,0,0.6)' },
                        '& .MuiSvgIcon-root': { color: 'rgba(0,0,0,0.54)' },
                        '& .MuiInputBase-input': { color: '#1a1a2e' },
                        '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' },
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' },
                        // The MFA card is intentionally a fixed light surface even in dark
                        // mode. The step TextFields fill their box from the theme token
                        // `background.paper` (near-black in dark mode) → black-on-black
                        // code inputs. Force the input box white to match the card. `&&`
                        // doubles specificity so it beats the per-step `background.paper`.
                        '&& .MuiOutlinedInput-root': {
                            backgroundColor: '#ffffff',
                            '&:hover': { backgroundColor: '#ffffff' },
                            '&.Mui-focused': { backgroundColor: '#ffffff' },
                        },
                    }}
                >
                    <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                        {typeof stepCurrent === 'number' && typeof stepTotal === 'number' && (
                            <StepProgress current={stepCurrent} total={stepTotal} />
                        )}
                        {stepBody}
                        <Box sx={{ textAlign: 'center', mt: 2 }}>
                            <Button
                                variant="text"
                                startIcon={<ArrowBack />}
                                onClick={onBackToMethodSelection}
                                sx={{ color: 'rgba(0,0,0,0.6)' }}
                            >
                                {t('mfa.backToMethodSelection')}
                            </Button>
                        </Box>
                    </CardContent>
                </Card>
            </motion.div>
        </Box>
    )
}
