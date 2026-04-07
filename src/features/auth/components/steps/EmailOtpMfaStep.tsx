import { useState, useEffect, useCallback } from 'react'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    TextField,
    Typography,
} from '@mui/material'
import { Email, ArrowForward, ArrowBack, Refresh } from '@mui/icons-material'
import { motion, Variants } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { IAuthRepository, MfaStepResponse } from '@domain/interfaces/IAuthRepository'

const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.4, ease: easeOut },
    },
}

interface EmailOtpMfaStepProps {
    mfaSessionToken: string
    onAuthenticated: (response: MfaStepResponse) => void
    onBack: () => void
}

export default function EmailOtpMfaStep({
    mfaSessionToken,
    onAuthenticated,
    onBack,
}: EmailOtpMfaStepProps) {
    const { t } = useTranslation()
    const httpClient = useService<IHttpClient>(TYPES.HttpClient)
    const authRepository = useService<IAuthRepository>(TYPES.AuthRepository)

    const [code, setCode] = useState('')
    const [loading, setLoading] = useState(false)
    const [sending, setSending] = useState(false)
    const [error, setError] = useState<string | undefined>()
    const [maskedEmail, setMaskedEmail] = useState<string | null>(null)
    const [countdown, setCountdown] = useState(0)
    const [submitted, setSubmitted] = useState(false)

    // Send OTP on mount
    useEffect(() => {
        sendOtp()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Countdown timer
    useEffect(() => {
        if (countdown <= 0) return
        const timer = setInterval(() => setCountdown(c => c - 1), 1000)
        return () => clearInterval(timer)
    }, [countdown])

    const sendOtp = useCallback(async () => {
        setSending(true)
        setError(undefined)
        try {
            const res = await httpClient.post<{ message: string; email?: string }>(
                '/auth/mfa/send-otp',
                { sessionToken: mfaSessionToken, method: 'EMAIL_OTP' }
            )
            setMaskedEmail(res.data.email ?? null)
            setCountdown(60)
        } catch (err) {
            setError(err instanceof Error ? err.message : t('mfa.verificationFailed'))
        } finally {
            setSending(false)
        }
    }, [httpClient, mfaSessionToken, t])

    // Auto-submit on 6 digits
    useEffect(() => {
        if (code.length === 6 && !loading && !submitted) {
            setSubmitted(true)
            handleVerify()
        }
    }, [code, loading, submitted]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (code.length < 6) setSubmitted(false)
    }, [code])

    const handleVerify = useCallback(async () => {
        setLoading(true)
        setError(undefined)
        try {
            const res = await authRepository.verifyMfaStep(mfaSessionToken, 'EMAIL_OTP', { code })
            if (res.status === 'AUTHENTICATED' || res.status === 'STEP_COMPLETED') {
                onAuthenticated(res)
            } else {
                setError(res.message || t('mfa.verificationFailed'))
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t('mfa.verificationFailed'))
        } finally {
            setLoading(false)
        }
    }, [authRepository, mfaSessionToken, code, onAuthenticated, t])

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
            }}
        >
            <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Box
                    sx={{
                        width: 56,
                        height: 56,
                        borderRadius: '14px',
                        background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                        boxShadow: '0 8px 32px rgba(59, 130, 246, 0.3)',
                    }}
                >
                    <Email sx={{ fontSize: 28, color: 'white' }} />
                </Box>
                <Typography variant="h6" fontWeight={600}>
                    {t('mfa.emailOtp.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {maskedEmail
                        ? t('mfa.emailOtp.sentTo', { email: maskedEmail })
                        : t('mfa.emailOtp.subtitle')}
                </Typography>
            </Box>

            {sending && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                    <CircularProgress size={24} />
                </Box>
            )}

            {error && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                >
                    <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
                        {error}
                    </Alert>
                </motion.div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); if (code.length === 6) handleVerify() }}>
                <motion.div variants={itemVariants}>
                    <TextField
                        fullWidth
                        label={t('mfa.totp.codeLabel')}
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        disabled={loading}
                        autoFocus
                        inputProps={{
                            maxLength: 6,
                            style: {
                                textAlign: 'center',
                                fontSize: '1.5rem',
                                fontWeight: 700,
                                letterSpacing: '0.5em',
                                color: '#1a1a2e',
                            },
                            inputMode: 'numeric',
                        }}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: '12px',
                                backgroundColor: '#f8fafc',
                            },
                        }}
                    />
                </motion.div>

                <motion.div variants={itemVariants}>
                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        size="large"
                        disabled={loading || code.length !== 6}
                        endIcon={!loading && <ArrowForward />}
                        sx={{
                            mt: 3,
                            py: 1.5,
                            borderRadius: '12px',
                            fontSize: '1rem',
                            fontWeight: 600,
                            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                            boxShadow: '0 10px 40px rgba(99, 102, 241, 0.4)',
                            '&:hover': {
                                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                            },
                        }}
                    >
                        {loading ? <CircularProgress size={24} sx={{ color: 'white' }} /> : t('mfa.verify')}
                    </Button>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <Box sx={{ textAlign: 'center', mt: 2 }}>
                        <Button
                            variant="text"
                            size="small"
                            startIcon={<Refresh />}
                            onClick={sendOtp}
                            disabled={countdown > 0 || sending}
                            sx={{ color: countdown > 0 ? 'rgba(0,0,0,0.4)' : '#6366f1', fontWeight: 500 }}
                        >
                            {countdown > 0
                                ? t('mfa.emailOtp.resendCountdown', { seconds: countdown })
                                : t('mfa.emailOtp.resend')}
                        </Button>
                    </Box>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <Box sx={{ textAlign: 'center', mt: 1 }}>
                        <Button
                            variant="text"
                            startIcon={<ArrowBack />}
                            onClick={onBack}
                            sx={{ color: 'rgba(0,0,0,0.6)' }}
                        >
                            {t('mfa.backToMethodSelection')}
                        </Button>
                    </Box>
                </motion.div>
            </form>
        </motion.div>
    )
}
