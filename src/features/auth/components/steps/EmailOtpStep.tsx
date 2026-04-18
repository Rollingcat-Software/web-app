import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Box,
    Button,
    CircularProgress,
    TextField,
} from '@mui/material'
import { Email, ArrowForward, Refresh } from '@mui/icons-material'
import { motion } from 'framer-motion'
import StepLayout from './StepLayout'
import { stepItemVariants as itemVariants } from './stepMotion'

const COUNTDOWN_SECONDS = 60

interface EmailOtpStepProps {
    onSubmit: (code: string) => void
    onSendOtp: () => void
    loading: boolean
    error?: string
}

export default function EmailOtpStep({ onSubmit, onSendOtp, loading, error }: EmailOtpStepProps) {
    const { t } = useTranslation()
    const [code, setCode] = useState('')
    const [countdown, setCountdown] = useState(0)
    const [otpSent, setOtpSent] = useState(false)

    useEffect(() => {
        if (countdown <= 0) return

        const timer = setInterval(() => {
            setCountdown((prev) => prev - 1)
        }, 1000)

        return () => clearInterval(timer)
    }, [countdown])

    const handleSendOtp = useCallback(() => {
        onSendOtp()
        setCountdown(COUNTDOWN_SECONDS)
        setOtpSent(true)
    }, [onSendOtp])

    const handleSubmit = useCallback(
        (e: React.FormEvent) => {
            e.preventDefault()
            if (code.length === 6) {
                onSubmit(code)
            }
        },
        [code, onSubmit]
    )

    const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, '').slice(0, 6)
        setCode(value)
    }, [])

    return (
        <StepLayout
            title={t('auth.emailVerification')}
            subtitle={otpSent ? t('auth.enterOtpCode') : t('auth.willSendOtp')}
            icon={<Email sx={{ fontSize: 28, color: 'white' }} />}
            iconGradient="linear-gradient(135deg, #10b981 0%, #3b82f6 100%)"
            iconShadow="0 8px 32px rgba(16, 185, 129, 0.3)"
            error={error}
        >
            {!otpSent ? (
                <motion.div variants={itemVariants}>
                    <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        onClick={handleSendOtp}
                        disabled={loading}
                        startIcon={!loading && <Email />}
                        sx={{
                            mt: 2,
                            py: 1.5,
                            borderRadius: '12px',
                            fontSize: '1rem',
                            fontWeight: 600,
                            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                            boxShadow: '0 10px 40px rgba(99, 102, 241, 0.4)',
                            '&:hover': {
                                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                            },
                            transition: 'all 0.3s ease',
                        }}
                    >
                        {loading ? (
                            <CircularProgress size={24} sx={{ color: 'white' }} />
                        ) : (
                            t('auth.sendVerificationCode')
                        )}
                    </Button>
                </motion.div>
            ) : (
                <form onSubmit={handleSubmit}>
                    <motion.div variants={itemVariants}>
                        <TextField
                            fullWidth
                            label={t('auth.verificationCodeLabel')}
                            value={code}
                            onChange={handleCodeChange}
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
                                },
                                inputMode: 'numeric',
                            }}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: '12px',
                                    backgroundColor: '#f8fafc',
                                    '&:hover': { backgroundColor: '#f1f5f9' },
                                    '&.Mui-focused': { backgroundColor: '#fff' },
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
                                transition: 'all 0.3s ease',
                            }}
                        >
                            {loading ? (
                                <CircularProgress size={24} sx={{ color: 'white' }} />
                            ) : (
                                t('auth.verifyCode')
                            )}
                        </Button>
                    </motion.div>

                    <motion.div variants={itemVariants}>
                        <Box sx={{ textAlign: 'center', mt: 2 }}>
                            <Button
                                variant="text"
                                size="small"
                                startIcon={<Refresh />}
                                onClick={handleSendOtp}
                                disabled={countdown > 0 || loading}
                                sx={{
                                    color: countdown > 0 ? 'text.secondary' : 'primary.main',
                                    fontWeight: 500,
                                }}
                            >
                                {countdown > 0
                                    ? t('auth.resendCodeCountdown', { countdown })
                                    : t('auth.resendCode')}
                            </Button>
                        </Box>
                    </motion.div>
                </form>
            )}
        </StepLayout>
    )
}
