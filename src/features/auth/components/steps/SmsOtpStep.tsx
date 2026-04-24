import { useState, useEffect, useCallback } from 'react'
import {
    Box,
    Button,
    CircularProgress,
    TextField,
} from '@mui/material'
import { Sms, ArrowForward, Refresh } from '@mui/icons-material'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import StepLayout from './StepLayout'
import { stepItemVariants as itemVariants } from './stepMotion'

const COUNTDOWN_SECONDS = 60

interface SmsOtpStepProps {
    onSubmit: (code: string) => void
    onSendOtp: () => void
    loading: boolean
    error?: string
}

export default function SmsOtpStep({ onSubmit, onSendOtp, loading, error }: SmsOtpStepProps) {
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
            title={t('mfa.smsOtp.title')}
            subtitle={otpSent ? t('mfa.smsOtp.enterCode') : t('mfa.smsOtp.willSend')}
            icon={<Sms sx={{ fontSize: 28, color: 'white' }} />}
            iconGradient="linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)"
            iconShadow="0 8px 32px rgba(59, 130, 246, 0.3)"
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
                        startIcon={!loading && <Sms />}
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
                            t('mfa.smsOtp.sendCode')
                        )}
                    </Button>
                </motion.div>
            ) : (
                <form onSubmit={handleSubmit}>
                    <motion.div variants={itemVariants}>
                        <TextField
                            fullWidth
                            label={t('mfa.smsOtp.codeLabel')}
                            value={code}
                            onChange={handleCodeChange}
                            placeholder={t('mfa.placeholder.code')}
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
                                    backgroundColor: 'background.paper',
                                    '&:hover': { backgroundColor: 'background.paper' },
                                    '&.Mui-focused': { backgroundColor: 'background.paper' },
                                },
                                '& .MuiOutlinedInput-input': {
                                    color: 'text.primary',
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
                                t('mfa.smsOtp.verifyCode')
                            )}
                        </Button>
                    </motion.div>

                    <motion.div variants={itemVariants}>
                        <Box sx={{ textAlign: 'center', mt: 2 }}>
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={
                                    loading ? (
                                        <CircularProgress size={16} />
                                    ) : (
                                        <Refresh />
                                    )
                                }
                                onClick={handleSendOtp}
                                disabled={countdown > 0 || loading}
                                sx={{
                                    borderColor: 'primary.main',
                                    color: 'primary.main',
                                    fontWeight: 500,
                                    backgroundColor: 'background.paper',
                                    '&:hover': {
                                        borderColor: 'primary.dark',
                                        backgroundColor: 'action.hover',
                                    },
                                    '&.Mui-disabled': {
                                        borderColor: 'action.disabled',
                                        color: 'text.secondary',
                                        backgroundColor: 'background.paper',
                                    },
                                }}
                            >
                                <span aria-live="polite" aria-atomic="true">
                                    {countdown > 0
                                        ? t('mfa.smsOtp.resendCountdown', { seconds: countdown })
                                        : t('mfa.smsOtp.resend')}
                                </span>
                            </Button>
                        </Box>
                    </motion.div>
                </form>
            )}
        </StepLayout>
    )
}
