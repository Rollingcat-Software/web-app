import { useState, useEffect, useCallback } from 'react'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    TextField,
    Typography,
} from '@mui/material'
import { Sms, ArrowForward, Refresh } from '@mui/icons-material'
import { motion, Variants } from 'framer-motion'
import { useTranslation } from 'react-i18next'

const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.4, ease: easeOut },
    },
}

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
        <motion.div
            initial="hidden"
            animate="visible"
            variants={{
                hidden: { opacity: 0 },
                visible: {
                    opacity: 1,
                    transition: { staggerChildren: 0.1 },
                },
            }}
        >
            <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Box
                    sx={{
                        width: 56,
                        height: 56,
                        borderRadius: '14px',
                        background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                        boxShadow: '0 8px 32px rgba(59, 130, 246, 0.3)',
                    }}
                >
                    <Sms sx={{ fontSize: 28, color: 'white' }} />
                </Box>
                <Typography variant="h6" fontWeight={600}>
                    {t('mfa.smsOtp.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {otpSent
                        ? t('mfa.smsOtp.enterCode')
                        : t('mfa.smsOtp.willSend')}
                </Typography>
            </Box>

            {error && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
                        {error}
                    </Alert>
                </motion.div>
            )}

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
                                    backgroundColor: 'action.hover',
                                    '&:hover': { backgroundColor: 'action.selected' },
                                    '&.Mui-focused': { backgroundColor: 'background.paper' },
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
                                    ? t('mfa.smsOtp.resendCountdown', { seconds: countdown })
                                    : t('mfa.smsOtp.resend')}
                            </Button>
                        </Box>
                    </motion.div>
                </form>
            )}
        </motion.div>
    )
}
