import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatApiError } from '@utils/formatApiError'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Link,
    Typography,
} from '@mui/material'
import {
    ArrowForward,
    ErrorOutline,
    MarkEmailReadOutlined,
} from '@mui/icons-material'
import { motion, Variants } from 'framer-motion'
import { getService } from '@core/di/container'
import { TYPES } from '@core/di/types'
import type { IOnboardingRepository } from '@domain/interfaces/IOnboardingRepository'
import { usePrefersReducedMotion } from '@hooks/usePrefersReducedMotion'
import { loginShellBackgroundSx } from '@features/auth/components/loginBackground'
import FloatingShape from '@features/auth/components/FloatingShape'

const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
}

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } },
}

const logoVariants: Variants = {
    hidden: { scale: 0.8, opacity: 0, rotateY: -90 },
    visible: { scale: 1, opacity: 1, rotateY: 0, transition: { duration: 0.8, ease: easeOut } },
}

type VerifyState = 'verifying' | 'success' | 'error' | 'noToken'

export default function VerifyEmailPage() {
    const navigate = useNavigate()
    const { t } = useTranslation()
    const prefersReducedMotion = usePrefersReducedMotion()
    const [searchParams] = useSearchParams()
    const token = searchParams.get('token') || ''
    const [state, setState] = useState<VerifyState>(token ? 'verifying' : 'noToken')
    const [error, setError] = useState<string | null>(null)

    const verify = useCallback(async () => {
        if (!token) {
            setState('noToken')
            return
        }
        setState('verifying')
        setError(null)
        try {
            const onboardingRepository = getService<IOnboardingRepository>(TYPES.OnboardingRepository)
            await onboardingRepository.verifyEmail(token)
            setState('success')
        } catch (err: unknown) {
            setError(formatApiError(err, t))
            setState('error')
        }
    }, [token, t])

    useEffect(() => {
        verify()
    }, [verify])

    const cardSx = {
        background: 'rgba(255, 255, 255, 0.95)',
        color: '#1a1a2e',
        '& .MuiTypography-root': { color: '#1a1a2e' },
        '& .MuiTypography-colorTextSecondary': { color: 'rgba(0,0,0,0.6)' },
        '& .MuiLink-root': { color: '#6366f1' },
        backdropFilter: 'blur(20px)',
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        overflow: 'visible',
    }

    const submitButtonSx = {
        mt: 3,
        mb: 1,
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
    }

    const isError = state === 'error' || state === 'noToken'

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                ...loginShellBackgroundSx(),
            }}
        >
            {/* Decorative background shapes — skipped for reduced-motion users. */}
            {!prefersReducedMotion && (
                <>
                    <FloatingShape delay={0} size={300} left="10%" top="20%" />
                    <FloatingShape delay={1} size={200} left="70%" top="10%" />
                    <FloatingShape delay={2} size={150} left="80%" top="60%" />
                    <FloatingShape delay={0.5} size={100} left="5%" top="70%" />
                </>
            )}

            <motion.div
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                style={{ width: '100%', maxWidth: 440, margin: '0 16px', zIndex: 1 }}
            >
                <Card sx={cardSx}>
                    <CardContent sx={{ p: { xs: 3, sm: 5 }, textAlign: 'center' }}>
                        {/* Logo */}
                        <motion.div variants={logoVariants}>
                            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                                <Box
                                    sx={{
                                        width: 80,
                                        height: 80,
                                        borderRadius: '20px',
                                        background: isError
                                            ? 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)'
                                            : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 10px 40px rgba(99, 102, 241, 0.4)',
                                    }}
                                >
                                    {isError ? (
                                        <ErrorOutline sx={{ fontSize: 44, color: 'white' }} />
                                    ) : (
                                        <MarkEmailReadOutlined sx={{ fontSize: 44, color: 'white' }} />
                                    )}
                                </Box>
                            </Box>
                        </motion.div>

                        {state === 'verifying' && (
                            <motion.div variants={itemVariants}>
                                <Typography variant="h5" component="h1" sx={{ fontWeight: 700, mb: 2 }}>
                                    {t('verifyEmail.verifyingTitle')}
                                </Typography>
                                <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                                    <CircularProgress />
                                </Box>
                                <Typography variant="body2" color="text.secondary">
                                    {t('verifyEmail.verifyingSubtitle')}
                                </Typography>
                            </motion.div>
                        )}

                        {state === 'success' && (
                            <motion.div variants={itemVariants}>
                                <Typography
                                    variant="h4"
                                    component="h1"
                                    sx={{
                                        fontWeight: 700,
                                        mb: 1,
                                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                        backgroundClip: 'text',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                    }}
                                >
                                    {t('verifyEmail.successTitle')}
                                </Typography>
                                <Alert severity="success" sx={{ my: 3, borderRadius: '12px', textAlign: 'left' }}>
                                    {t('verifyEmail.successMessage')}
                                </Alert>
                                <Button
                                    fullWidth
                                    variant="contained"
                                    size="large"
                                    onClick={() => navigate('/login')}
                                    endIcon={<ArrowForward />}
                                    sx={submitButtonSx}
                                >
                                    {t('verifyEmail.goToLogin')}
                                </Button>
                            </motion.div>
                        )}

                        {(state === 'error' || state === 'noToken') && (
                            <motion.div variants={itemVariants}>
                                <Typography variant="h5" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
                                    {t('verifyEmail.errorTitle')}
                                </Typography>
                                <Alert severity="error" sx={{ my: 3, borderRadius: '12px', textAlign: 'left' }}>
                                    {state === 'noToken' ? t('verifyEmail.noToken') : error}
                                </Alert>
                                {state === 'error' && (
                                    <Button
                                        fullWidth
                                        variant="contained"
                                        size="large"
                                        onClick={verify}
                                        sx={submitButtonSx}
                                    >
                                        {t('verifyEmail.retry')}
                                    </Button>
                                )}
                                <Box sx={{ mt: 2 }}>
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
                                        {t('verifyEmail.backToLogin')}
                                    </Link>
                                </Box>
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
                                    {t('verifyEmail.contactSupport')}
                                </Typography>
                            </motion.div>
                        )}
                    </CardContent>
                </Card>
            </motion.div>
        </Box>
    )
}
