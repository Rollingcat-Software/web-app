import { useState, useCallback, useEffect, useRef } from 'react'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    TextField,
    Typography,
} from '@mui/material'
import {
    ArrowBack,
    LockOutlined,
    MailOutlined,
    VerifiedUser,
} from '@mui/icons-material'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import { formatApiError } from '@utils/formatApiError'

const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

interface TwoFactorVerificationProps {
    onComplete: () => void
    onCancel: () => void
}

/**
 * TwoFactorVerification - Email OTP 2FA after password login
 *
 * After successful password authentication, if the user has 2FA enabled,
 * this component sends an OTP code to their email and verifies it
 * before allowing access to the dashboard.
 */
export default function TwoFactorVerification({
    onComplete,
    onCancel,
}: TwoFactorVerificationProps) {
    const { t } = useTranslation()
    const httpClient = useService<IHttpClient>(TYPES.HttpClient)

    const [code, setCode] = useState('')
    const [loading, setLoading] = useState(false)
    const [sending, setSending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [maskedEmail, setMaskedEmail] = useState<string | null>(null)
    const [codeSent, setCodeSent] = useState(false)
    const [resendCountdown, setResendCountdown] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)
    const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        return () => {
            if (focusTimerRef.current) clearTimeout(focusTimerRef.current)
        }
    }, [])

    // Send OTP code on mount
    const sendCode = useCallback(async () => {
        setSending(true)
        setError(null)
        try {
            const res = await httpClient.post<{ message: string; email: string }>('/auth/2fa/send', {})
            setMaskedEmail(res.data.email)
            setCodeSent(true)
            setResendCountdown(60)
            // Focus input after code is sent
            if (focusTimerRef.current) clearTimeout(focusTimerRef.current)
            focusTimerRef.current = setTimeout(() => inputRef.current?.focus(), 200)
        } catch (err) {
            setError(formatApiError(err, t))
        } finally {
            setSending(false)
        }
    }, [httpClient, t])

    // Send code on mount
    useEffect(() => {
        sendCode()
    }, [sendCode])

    // Countdown timer for resend
    useEffect(() => {
        if (resendCountdown <= 0) return
        const timer = setInterval(() => {
            setResendCountdown((prev) => prev - 1)
        }, 1000)
        return () => clearInterval(timer)
    }, [resendCountdown])

    const handleVerify = useCallback(async () => {
        if (!code.trim()) return
        setLoading(true)
        setError(null)
        try {
            const res = await httpClient.post<{ success: boolean; message: string }>('/auth/2fa/verify', { code: code.trim() })
            if (res.data.success) {
                onComplete()
            } else {
                setError(res.data.message || t('twoFactor.invalidCode', 'Invalid or expired code'))
            }
        } catch (err) {
            setError(formatApiError(err, t))
        } finally {
            setLoading(false)
        }
    }, [code, httpClient, onComplete, t])

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter') {
                handleVerify()
            }
        },
        [handleVerify]
    )

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: 1,
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
                        '& .MuiTypography-colorTextDisabled': { color: 'rgba(0,0,0,0.38)' },
                        '& .MuiSvgIcon-root': { color: 'rgba(0,0,0,0.54)' },
                        '& .MuiButton-textPrimary': { color: '#6366f1' },
                        '& .MuiButton-text:not(.MuiButton-textPrimary)': { color: 'rgba(0,0,0,0.6)' },
                        '& .MuiInputBase-input': { color: '#1a1a2e' },
                        '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' },
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' },
                    }}
                >
                    <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                        {/* Icon */}
                        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                            <Box
                                sx={{
                                    width: 64,
                                    height: 64,
                                    borderRadius: '16px',
                                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 10px 40px rgba(99, 102, 241, 0.4)',
                                }}
                            >
                                <LockOutlined sx={{ fontSize: 32, color: 'white' }} />
                            </Box>
                        </Box>

                        {/* Header */}
                        <Typography
                            variant="h5"
                            fontWeight={700}
                            textAlign="center"
                            sx={{
                                mb: 0.5,
                                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                backgroundClip: 'text',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            {t('twoFactor.title', 'Two-Factor Authentication')}
                        </Typography>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            textAlign="center"
                            sx={{ mb: 3 }}
                        >
                            {codeSent && maskedEmail
                                ? t('twoFactor.codeSent', 'A verification code has been sent to {{email}}', { email: maskedEmail })
                                : t('twoFactor.sending', 'Sending verification code...')}
                        </Typography>

                        {error && (
                            <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
                                {error}
                            </Alert>
                        )}

                        {/* OTP Input */}
                        <TextField
                            inputRef={inputRef}
                            fullWidth
                            label={t('twoFactor.codeLabel', 'Verification Code')}
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            onKeyDown={handleKeyDown}
                            disabled={loading || sending}
                            placeholder="000000"
                            inputProps={{
                                maxLength: 6,
                                inputMode: 'numeric',
                                autoComplete: 'one-time-code',
                                style: {
                                    textAlign: 'center',
                                    fontSize: '1.5rem',
                                    letterSpacing: '0.5rem',
                                    fontWeight: 600,
                                },
                            }}
                            InputProps={{
                                startAdornment: <MailOutlined sx={{ mr: 1, color: 'action.active' }} />,
                            }}
                            sx={{
                                mb: 2,
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: '12px',
                                    backgroundColor: '#f8fafc',
                                },
                            }}
                        />

                        {/* Verify Button */}
                        <Button
                            fullWidth
                            variant="contained"
                            size="large"
                            onClick={handleVerify}
                            disabled={loading || code.length < 6}
                            sx={{
                                py: 1.5,
                                borderRadius: '12px',
                                fontSize: '1rem',
                                fontWeight: 600,
                                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                boxShadow: '0 10px 40px rgba(99, 102, 241, 0.4)',
                                '&:hover': {
                                    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                                },
                                mb: 2,
                            }}
                        >
                            {loading ? (
                                <CircularProgress size={24} sx={{ color: 'white' }} />
                            ) : (
                                t('twoFactor.verify', 'Verify')
                            )}
                        </Button>

                        {/* Resend link */}
                        <Box sx={{ textAlign: 'center', mb: 2 }}>
                            {resendCountdown > 0 ? (
                                <Typography variant="body2" color="text.secondary">
                                    {t('twoFactor.resendIn', 'Resend code in {{seconds}}s', { seconds: resendCountdown })}
                                </Typography>
                            ) : (
                                <Button
                                    variant="text"
                                    size="small"
                                    onClick={sendCode}
                                    disabled={sending}
                                    sx={{ color: 'primary.main', fontWeight: 500 }}
                                >
                                    {sending ? (
                                        <CircularProgress size={16} sx={{ mr: 1 }} />
                                    ) : null}
                                    {t('twoFactor.resend', 'Resend Code')}
                                </Button>
                            )}
                        </Box>

                        {/* Secured by badge */}
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 0.5,
                                mb: 2,
                                opacity: 0.5,
                            }}
                        >
                            <VerifiedUser sx={{ fontSize: 14, color: 'text.disabled' }} />
                            <Typography variant="caption" color="text.disabled">
                                {t('twoFactor.securedBy', 'Secured by FIVUCSAS')}
                            </Typography>
                        </Box>

                        {/* Cancel button */}
                        <Box sx={{ textAlign: 'center' }}>
                            <Button
                                variant="text"
                                size="small"
                                onClick={onCancel}
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
                                {t('twoFactor.cancel', 'Cancel and sign out')}
                            </Button>
                        </Box>
                    </CardContent>
                </Card>
            </motion.div>
        </Box>
    )
}
