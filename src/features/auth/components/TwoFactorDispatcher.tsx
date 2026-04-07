import { useState, useCallback } from 'react'
import {
    Box,
    Button,
    Card,
    CardContent,
} from '@mui/material'
import { ArrowBack } from '@mui/icons-material'
import { motion } from 'framer-motion'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IAuthRepository, MfaStepResponse } from '@domain/interfaces/IAuthRepository'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import { useTranslation } from 'react-i18next'
// TwoFactorVerification is replaced by EmailOtpMfaStep for the N-step flow
import TotpStep from './steps/TotpStep'
import SmsOtpStep from './steps/SmsOtpStep'
import FaceCaptureStep from './steps/FaceCaptureStep'
import VoiceStep from './steps/VoiceStep'
import FingerprintStep from './steps/FingerprintStep'
import QrCodeStep from './steps/QrCodeStep'
import HardwareKeyStep from './steps/HardwareKeyStep'
import NfcStep from './steps/NfcStep'
import EmailOtpMfaStep from './steps/EmailOtpMfaStep'

const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

interface TwoFactorDispatcherProps {
    method: string
    mfaSessionToken: string
    onAuthenticated: (response: MfaStepResponse) => void
    onBackToMethodSelection: () => void
    onCancel: () => void
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
}: TwoFactorDispatcherProps) {
    const authRepository = useService<IAuthRepository>(TYPES.AuthRepository)
    const httpClient = useService<IHttpClient>(TYPES.HttpClient)
    const { t } = useTranslation()

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | undefined>(undefined)

    // EMAIL_OTP: use the new session-token-based OTP flow
    if (!method || method === 'EMAIL_OTP') {
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
                    transition={{ duration: 0.5, ease: easeOut }}
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
                        }}
                    >
                        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                            <EmailOtpMfaStep
                                mfaSessionToken={mfaSessionToken}
                                onAuthenticated={onAuthenticated}
                                onBack={onBackToMethodSelection}
                            />
                        </CardContent>
                    </Card>
                </motion.div>
            </Box>
        )
    }

    // Verify MFA step using the new public endpoint (no JWT needed)
    const verifyStep = useCallback(async (methodType: string, data: Record<string, unknown>) => {
        setLoading(true)
        setError(undefined)
        try {
            const res = await authRepository.verifyMfaStep(mfaSessionToken, methodType, data)

            if (res.status === 'AUTHENTICATED') {
                onAuthenticated(res)
            } else if (res.status === 'STEP_COMPLETED') {
                // More steps — parent will handle showing next step
                onAuthenticated(res)
            } else {
                setError(res.message || t('mfa.verificationFailed'))
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t('mfa.verificationFailed'))
        } finally {
            setLoading(false)
        }
    }, [authRepository, mfaSessionToken, onAuthenticated, t])

    const totpSubmit = useCallback((code: string) => verifyStep('TOTP', { code }), [verifyStep])

    const renderStep = () => {
        switch (method) {
            case 'TOTP':
                return (
                    <TotpStep
                        onSubmit={totpSubmit}
                        loading={loading}
                        error={error}
                    />
                )

            case 'SMS_OTP':
                return (
                    <SmsOtpStep
                        onSubmit={(code) => verifyStep('SMS_OTP', { code })}
                        onSendOtp={async () => {
                            try {
                                await httpClient.post('/auth/2fa/send-sms', {})
                            } catch (err) {
                                setError(err instanceof Error ? err.message : 'Failed to send SMS')
                            }
                        }}
                        loading={loading}
                        error={error}
                    />
                )

            case 'FACE':
                return (
                    <FaceCaptureStep
                        onSubmit={(image) => verifyStep('FACE', { image })}
                        loading={loading}
                        error={error}
                    />
                )

            case 'VOICE':
                return (
                    <VoiceStep
                        onSubmit={(voiceData) => verifyStep('VOICE', { voiceData })}
                        loading={loading}
                        error={error}
                    />
                )

            case 'FINGERPRINT':
                return (
                    <FingerprintStep
                        onSubmit={(data) => verifyStep('FINGERPRINT', { assertion: data })}
                        loading={loading}
                        error={error}
                    />
                )

            case 'QR_CODE':
                return (
                    <QrCodeStep
                        userId="mfa-session"
                        onGenerateToken={async () => {
                            const res = await httpClient.post<{ token: string; expiresInSeconds: number }>(
                                '/auth/mfa/qr-generate',
                                { sessionToken: mfaSessionToken }
                            )
                            return res.data
                        }}
                        onSubmit={(token) => verifyStep('QR_CODE', { token })}
                        loading={loading}
                        error={error}
                    />
                )

            case 'HARDWARE_KEY':
                return (
                    <HardwareKeyStep
                        onRequestChallenge={async () => {
                            const res = await httpClient.post<{
                                challenge: string
                                rpId: string
                                allowCredentials: Array<{ id: string; type: string }>
                                timeout: string
                            }>('/auth/2fa/hardware-challenge', {})
                            return res.data
                        }}
                        onSubmit={(data) => verifyStep('HARDWARE_KEY', data)}
                        loading={loading}
                        error={error}
                    />
                )

            case 'NFC_DOCUMENT':
                return (
                    <NfcStep
                        onSubmit={(data) => verifyStep('NFC_DOCUMENT', { nfcData: data })}
                        loading={loading}
                        error={error}
                    />
                )

            default:
                return (
                    <EmailOtpMfaStep
                        mfaSessionToken={mfaSessionToken}
                        onAuthenticated={onAuthenticated}
                        onBack={onBackToMethodSelection}
                    />
                )
        }
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
                transition={{ duration: 0.5, ease: easeOut }}
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
                        '& .MuiSvgIcon-root': { color: 'rgba(0,0,0,0.54)' },
                        '& .MuiInputBase-input': { color: '#1a1a2e' },
                        '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' },
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' },
                    }}
                >
                    <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                        {renderStep()}
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
