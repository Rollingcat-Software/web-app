import { useState } from 'react'
import {
    Box,
    Card,
    CardContent,
} from '@mui/material'
import { motion } from 'framer-motion'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import TwoFactorVerification from './TwoFactorVerification'
import TotpStep from './steps/TotpStep'
import SmsOtpStep from './steps/SmsOtpStep'
import FaceCaptureStep from './steps/FaceCaptureStep'
import VoiceStep from './steps/VoiceStep'
import FingerprintStep from './steps/FingerprintStep'
import QrCodeStep from './steps/QrCodeStep'
import HardwareKeyStep from './steps/HardwareKeyStep'
import NfcStep from './steps/NfcStep'

const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

interface TwoFactorDispatcherProps {
    method: string
    onComplete: () => void
    onCancel: () => void
}

/**
 * TwoFactorDispatcher
 *
 * Routes the 2FA step to the correct step component based on the method
 * returned by the backend (twoFactorMethod field).
 *
 * For EMAIL_OTP: delegates to the existing TwoFactorVerification component.
 * For all other methods: wraps the step component with verification logic.
 */
export default function TwoFactorDispatcher({
    method,
    onComplete,
    onCancel,
}: TwoFactorDispatcherProps) {
    const httpClient = useService<IHttpClient>(TYPES.HttpClient)

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | undefined>(undefined)

    // EMAIL_OTP: delegate to existing full-page component
    if (!method || method === 'EMAIL_OTP') {
        return (
            <TwoFactorVerification
                onComplete={onComplete}
                onCancel={onCancel}
            />
        )
    }

    // Generic 2FA verify helper: sends the step data to /auth/2fa/verify-method
    const verify2FA = async (methodType: string, data: Record<string, unknown>) => {
        setLoading(true)
        setError(undefined)
        try {
            const res = await httpClient.post<{ success: boolean; message: string }>(
                '/auth/2fa/verify-method',
                { method: methodType, data }
            )
            if (res.data.success) {
                onComplete()
            } else {
                setError(res.data.message || 'Verification failed')
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Verification failed')
        } finally {
            setLoading(false)
        }
    }

    const renderStep = () => {
        switch (method) {
            case 'TOTP':
                return (
                    <TotpStep
                        onSubmit={(code) => verify2FA('TOTP', { code })}
                        loading={loading}
                        error={error}
                    />
                )

            case 'SMS_OTP':
                return (
                    <SmsOtpStep
                        onSubmit={(code) => verify2FA('SMS_OTP', { code })}
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
                        onSubmit={(image) => verify2FA('FACE', { image })}
                        loading={loading}
                        error={error}
                    />
                )

            case 'VOICE':
                return (
                    <VoiceStep
                        onSubmit={(voiceData) => verify2FA('VOICE', { voiceData })}
                        loading={loading}
                        error={error}
                    />
                )

            case 'FINGERPRINT':
                return (
                    <FingerprintStep
                        onSubmit={(data) => verify2FA('FINGERPRINT', { assertion: data })}
                        loading={loading}
                        error={error}
                    />
                )

            case 'QR_CODE':
                return (
                    <QrCodeStep
                        onGenerateToken={async () => {
                            const res = await httpClient.post<{ token: string; expiresInSeconds: number }>(
                                '/auth/2fa/qr-generate',
                                {}
                            )
                            return res.data
                        }}
                        onSubmit={(token) => verify2FA('QR_CODE', { token })}
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
                        onSubmit={(data) => verify2FA('HARDWARE_KEY', data)}
                        loading={loading}
                        error={error}
                    />
                )

            case 'NFC_DOCUMENT':
                return (
                    <NfcStep
                        loading={loading}
                        error={error}
                    />
                )

            default:
                // Fallback to email OTP for unknown methods
                return (
                    <TwoFactorVerification
                        onComplete={onComplete}
                        onCancel={onCancel}
                    />
                )
        }
    }

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
                    </CardContent>
                </Card>
            </motion.div>
        </Box>
    )
}
