import { useState, useEffect, useCallback } from 'react'
import {
    Box,
    CircularProgress,
    TextField,
    Typography,
} from '@mui/material'
import { PhonelinkLock } from '@mui/icons-material'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import StepLayout from './StepLayout'
import { stepItemVariants as itemVariants } from './stepMotion'

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
        <StepLayout
            title={t('mfa.totp.title')}
            subtitle={t('mfa.totp.subtitle')}
            icon={<PhonelinkLock sx={{ fontSize: 28, color: 'white' }} />}
            iconGradient="linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)"
            iconShadow="0 8px 32px rgba(59, 130, 246, 0.3)"
            error={error}
            primaryAction={{
                label: t('mfa.verify'),
                onClick: () => {
                    if (code.length === 6) onSubmit(code)
                },
                disabled: loading || code.length !== 6,
            }}
            help={
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
            }
        >
            <form onSubmit={handleSubmit}>
                <motion.div variants={itemVariants}>
                    <TextField
                        fullWidth
                        label={t('mfa.totp.codeLabel')}
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
                {/* Submit button is rendered by StepLayout via primaryAction. The
                    hidden submit input below keeps Enter-to-submit working inside
                    the form without duplicating the visible button. */}
                <button type="submit" style={{ display: 'none' }} aria-hidden="true" tabIndex={-1} />
            </form>
        </StepLayout>
    )
}
