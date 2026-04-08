import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    IconButton,
    InputAdornment,
    TextField,
    Typography,
} from '@mui/material'
import {
    EmailOutlined,
    LockOutlined,
    Visibility,
    VisibilityOff,
    ArrowForward,
} from '@mui/icons-material'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, Variants } from 'framer-motion'

const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.4, ease: easeOut },
    },
}

type PasswordFormData = { email: string; password: string }

interface PasswordStepProps {
    onSubmit: (data: { email: string; password: string }) => void
    loading: boolean
    error?: string
}

export default function PasswordStep({ onSubmit, loading, error }: PasswordStepProps) {
    const { t } = useTranslation()
    const [showPassword, setShowPassword] = useState(false)

    const schema = z.object({
        email: z.string().min(1, t('auth.validation.emailRequired')).email(t('auth.validation.invalidEmail')),
        password: z.string().min(8, t('auth.validation.passwordMinLength')),
    })

    const {
        control,
        handleSubmit,
        formState: { errors },
    } = useForm<PasswordFormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            email: '',
            password: '',
        },
    })

    const handleFormSubmit = (data: PasswordFormData) => {
        onSubmit({ email: data.email, password: data.password })
    }

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
                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                        boxShadow: '0 8px 32px rgba(99, 102, 241, 0.3)',
                    }}
                >
                    <LockOutlined sx={{ fontSize: 28, color: 'white' }} />
                </Box>
                <Typography variant="h6" fontWeight={600}>
                    {t('auth.enterCredentials')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {t('auth.signInWithEmail')}
                </Typography>
            </Box>

            <form onSubmit={handleSubmit(handleFormSubmit)}>
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

                <motion.div variants={itemVariants}>
                    <Controller
                        name="email"
                        control={control}
                        render={({ field }) => (
                            <TextField
                                {...field}
                                fullWidth
                                label={t('auth.emailLabel')}
                                type="email"
                                error={!!errors.email}
                                helperText={errors.email?.message}
                                margin="normal"
                                autoFocus
                                disabled={loading}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <EmailOutlined sx={{ color: 'text.secondary' }} />
                                        </InputAdornment>
                                    ),
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
                        )}
                    />
                </motion.div>

                <motion.div variants={itemVariants}>
                    <Controller
                        name="password"
                        control={control}
                        render={({ field }) => (
                            <TextField
                                {...field}
                                fullWidth
                                label={t('auth.passwordLabel')}
                                type={showPassword ? 'text' : 'password'}
                                error={!!errors.password}
                                helperText={errors.password?.message}
                                margin="normal"
                                disabled={loading}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <LockOutlined sx={{ color: 'text.secondary' }} />
                                        </InputAdornment>
                                    ),
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton
                                                onClick={() => setShowPassword(!showPassword)}
                                                edge="end"
                                                disabled={loading}
                                                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                                                sx={{
                                                    '&:hover': {
                                                        backgroundColor: 'rgba(99, 102, 241, 0.08)',
                                                    },
                                                }}
                                            >
                                                {showPassword ? <VisibilityOff /> : <Visibility />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
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
                        )}
                    />
                </motion.div>

                <motion.div variants={itemVariants}>
                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        size="large"
                        disabled={loading}
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
                                boxShadow: '0 15px 50px rgba(99, 102, 241, 0.5)',
                                transform: 'translateY(-2px)',
                            },
                            '&:active': { transform: 'translateY(0)' },
                            transition: 'all 0.3s ease',
                        }}
                    >
                        {loading ? (
                            <CircularProgress size={24} sx={{ color: 'white' }} />
                        ) : (
                            t('auth.continue')
                        )}
                    </Button>
                </motion.div>
            </form>
        </motion.div>
    )
}
