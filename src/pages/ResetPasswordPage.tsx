import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    IconButton,
    InputAdornment,
    TextField,
    Typography,
    Link,
} from '@mui/material'
import {
    Fingerprint,
    LockOutlined,
    Visibility,
    VisibilityOff,
    ArrowForward,
} from '@mui/icons-material'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, Variants } from 'framer-motion'
import { getService } from '@core/di/container'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'

const resetPasswordSchema = z.object({
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
})

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>

const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.2,
        },
    },
}

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.5,
            ease: easeOut,
        },
    },
}

const logoVariants: Variants = {
    hidden: { scale: 0.8, opacity: 0, rotateY: -90 },
    visible: {
        scale: 1,
        opacity: 1,
        rotateY: 0,
        transition: {
            duration: 0.8,
            ease: easeOut,
        },
    },
}

const FloatingShape = ({ delay, size, left, top }: {
    delay: number
    size: number
    left: string
    top: string
}) => (
    <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{
            opacity: [0.1, 0.3, 0.1],
            scale: [1, 1.2, 1],
            y: [0, -20, 0],
        }}
        transition={{
            duration: 6,
            delay,
            repeat: Infinity,
            ease: 'easeInOut',
        }}
        style={{
            position: 'absolute',
            left,
            top,
            width: size,
            height: size,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
        }}
    />
)

export default function ResetPasswordPage() {
    const navigate = useNavigate()
    const { t } = useTranslation()
    const [searchParams] = useSearchParams()
    const token = searchParams.get('token') || ''
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

    const {
        control,
        handleSubmit,
        formState: { errors },
    } = useForm<ResetPasswordFormData>({
        resolver: zodResolver(resetPasswordSchema),
        defaultValues: {
            newPassword: '',
            confirmPassword: '',
        },
    })

    const onSubmit = async (data: ResetPasswordFormData) => {
        if (!token) {
            setError(t('auth.resetPasswordInvalidToken'))
            return
        }

        setLoading(true)
        setError(null)

        try {
            const httpClient = getService<IHttpClient>(TYPES.HttpClient)
            await httpClient.post('/auth/reset-password', {
                token,
                newPassword: data.newPassword,
            })
            setSuccess(true)
        } catch (err: any) {
            if (err.response?.data?.message) {
                setError(err.response.data.message)
            } else if (err instanceof Error) {
                setError(err.message)
            } else {
                setError(t('auth.resetPasswordError'))
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f64f59 100%)',
                backgroundSize: '400% 400%',
                animation: 'gradientShift 15s ease infinite',
                '@keyframes gradientShift': {
                    '0%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' },
                    '100%': { backgroundPosition: '0% 50%' },
                },
            }}
        >
            <FloatingShape delay={0} size={300} left="10%" top="20%" />
            <FloatingShape delay={1} size={200} left="70%" top="10%" />
            <FloatingShape delay={2} size={150} left="80%" top="60%" />
            <FloatingShape delay={0.5} size={100} left="5%" top="70%" />
            <FloatingShape delay={1.5} size={250} left="50%" top="80%" />

            <motion.div
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                style={{ width: '100%', maxWidth: 440, margin: '0 16px', zIndex: 1 }}
            >
                <Card
                    sx={{
                        background: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(20px)',
                        borderRadius: '24px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        overflow: 'visible',
                    }}
                >
                    <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
                        {/* Logo */}
                        <motion.div variants={logoVariants}>
                            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
                                <Box
                                    sx={{
                                        width: 80,
                                        height: 80,
                                        borderRadius: '20px',
                                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 10px 40px rgba(99, 102, 241, 0.4)',
                                    }}
                                >
                                    <Fingerprint sx={{ fontSize: 48, color: 'white' }} />
                                </Box>
                            </Box>
                        </motion.div>

                        {/* Header */}
                        <motion.div variants={itemVariants}>
                            <Box sx={{ textAlign: 'center', mb: 4 }}>
                                <Typography
                                    variant="h4"
                                    component="h1"
                                    sx={{
                                        fontWeight: 700,
                                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                        backgroundClip: 'text',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        mb: 1,
                                    }}
                                >
                                    {t('auth.resetPasswordTitle')}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {t('auth.resetPasswordSubtitle')}
                                </Typography>
                            </Box>
                        </motion.div>

                        {!token && !success && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.3 }}
                            >
                                <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>
                                    {t('auth.resetPasswordInvalidToken')}
                                </Alert>
                            </motion.div>
                        )}

                        {success ? (
                            <>
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <Alert severity="success" sx={{ mb: 3, borderRadius: '12px' }}>
                                        {t('auth.resetPasswordSuccess')}
                                    </Alert>
                                </motion.div>

                                <motion.div variants={itemVariants}>
                                    <Button
                                        fullWidth
                                        variant="contained"
                                        size="large"
                                        onClick={() => navigate('/login')}
                                        endIcon={<ArrowForward />}
                                        sx={{
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
                                        {t('auth.backToLogin')}
                                    </Button>
                                </motion.div>
                            </>
                        ) : (
                            <form onSubmit={handleSubmit(onSubmit)}>
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>
                                            {error}
                                        </Alert>
                                    </motion.div>
                                )}

                                {/* New Password */}
                                <motion.div variants={itemVariants}>
                                    <Controller
                                        name="newPassword"
                                        control={control}
                                        render={({ field }) => (
                                            <TextField
                                                {...field}
                                                fullWidth
                                                label={t('auth.newPasswordLabel')}
                                                type={showPassword ? 'text' : 'password'}
                                                error={!!errors.newPassword}
                                                helperText={errors.newPassword?.message}
                                                margin="normal"
                                                autoFocus
                                                disabled={loading || !token}
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
                                                                size="small"
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

                                {/* Confirm Password */}
                                <motion.div variants={itemVariants}>
                                    <Controller
                                        name="confirmPassword"
                                        control={control}
                                        render={({ field }) => (
                                            <TextField
                                                {...field}
                                                fullWidth
                                                label={t('auth.confirmPasswordLabel')}
                                                type={showConfirmPassword ? 'text' : 'password'}
                                                error={!!errors.confirmPassword}
                                                helperText={errors.confirmPassword?.message}
                                                margin="normal"
                                                disabled={loading || !token}
                                                InputProps={{
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <LockOutlined sx={{ color: 'text.secondary' }} />
                                                        </InputAdornment>
                                                    ),
                                                    endAdornment: (
                                                        <InputAdornment position="end">
                                                            <IconButton
                                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                                edge="end"
                                                                disabled={loading}
                                                                size="small"
                                                            >
                                                                {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
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
                                        disabled={loading || !token}
                                        endIcon={!loading && <ArrowForward />}
                                        sx={{
                                            mt: 3,
                                            mb: 2,
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
                                            t('auth.resetPasswordButton')
                                        )}
                                    </Button>
                                </motion.div>

                                <motion.div variants={itemVariants}>
                                    <Box sx={{ textAlign: 'center', mt: 2 }}>
                                        <Link
                                            component="button"
                                            type="button"
                                            onClick={() => navigate('/login')}
                                            underline="hover"
                                            sx={{
                                                fontWeight: 600,
                                                color: 'primary.main',
                                                cursor: 'pointer',
                                                '&:hover': { color: 'primary.dark' },
                                            }}
                                        >
                                            {t('auth.backToLogin')}
                                        </Link>
                                    </Box>
                                </motion.div>
                            </form>
                        )}
                    </CardContent>
                </Card>

                <motion.div variants={itemVariants}>
                    <Typography
                        variant="caption"
                        sx={{
                            display: 'block',
                            textAlign: 'center',
                            mt: 3,
                            color: 'rgba(255, 255, 255, 0.8)',
                        }}
                    >
                        Protected by enterprise-grade security
                    </Typography>
                </motion.div>
            </motion.div>
        </Box>
    )
}
