import { useState, useEffect, useCallback } from 'react'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    TextField,
    Typography,
} from '@mui/material'
import { PhonelinkLock, ArrowForward } from '@mui/icons-material'
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

interface TotpStepProps {
    onSubmit: (code: string) => void
    loading: boolean
    error?: string
}

export default function TotpStep({ onSubmit, loading, error }: TotpStepProps) {
    const { t } = useTranslation()
    const [code, setCode] = useState('')
    const [submitted, setSubmitted] = useState(false)

    // Auto-submit when 6 digits are entered (only once per code entry)
    useEffect(() => {
        if (code.length === 6 && !loading && !submitted) {
            setSubmitted(true)
            onSubmit(code)
        }
    }, [code, loading, onSubmit, submitted])

    // Reset submitted flag when code changes (user types a new code)
    useEffect(() => {
        if (code.length < 6) {
            setSubmitted(false)
        }
    }, [code])

    const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, '').slice(0, 6)
        setCode(value)
    }, [])

    const handleSubmit = useCallback(
        (e: React.FormEvent) => {
            e.preventDefault()
            if (code.length === 6) {
                onSubmit(code)
            }
        },
        [code, onSubmit]
    )

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
                        background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                        boxShadow: '0 8px 32px rgba(59, 130, 246, 0.3)',
                    }}
                >
                    <PhonelinkLock sx={{ fontSize: 28, color: 'white' }} />
                </Box>
                <Typography variant="h6" fontWeight={600}>
                    {t('mfa.totp.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {t('mfa.totp.subtitle')}
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

            <form onSubmit={handleSubmit}>
                <motion.div variants={itemVariants}>
                    <TextField
                        fullWidth
                        label={t('mfa.totp.codeLabel')}
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

                {loading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                            <CircularProgress size={32} />
                        </Box>
                    </motion.div>
                )}

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
                        {t('mfa.verify')}
                    </Button>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <Box
                        sx={{
                            mt: 3,
                            p: 2,
                            bgcolor: 'rgba(99, 102, 241, 0.06)',
                            borderRadius: '12px',
                            border: '1px solid',
                            borderColor: 'divider',
                        }}
                    >
                        <Typography variant="caption" color="text.secondary" display="block">
                            {t('mfa.totp.hint')}
                        </Typography>
                    </Box>
                </motion.div>
            </form>
        </motion.div>
    )
}
