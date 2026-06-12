import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatApiError } from '@utils/formatApiError'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    IconButton,
    InputAdornment,
    Link,
    TextField,
    Typography,
} from '@mui/material'
import {
    ApartmentOutlined,
    ArrowForward,
    EmailOutlined,
    LockOutlined,
    MarkEmailReadOutlined,
    PersonOutline,
    Visibility,
    VisibilityOff,
    WorkspacePremiumOutlined,
} from '@mui/icons-material'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, Variants } from 'framer-motion'
import { getService } from '@core/di/container'
import { TYPES } from '@core/di/types'
import type { IOnboardingRepository } from '@domain/interfaces/IOnboardingRepository'
import { usePrefersReducedMotion } from '@hooks/usePrefersReducedMotion'
import { loginShellBackgroundSx } from '@features/auth/components/loginBackground'
import FloatingShape from '@features/auth/components/FloatingShape'

const onboardingSchema = z
    .object({
        orgName: z.string().min(2, 'orgNameMin').max(100, 'orgNameMax'),
        firstName: z.string().min(1, 'firstNameRequired').max(100, 'firstNameMax'),
        lastName: z.string().min(1, 'lastNameRequired').max(100, 'lastNameMax'),
        email: z.string().min(1, 'emailRequired').email('emailInvalid'),
        password: z.string().min(8, 'passwordMin').max(128, 'passwordMax'),
        confirmPassword: z.string().min(1, 'confirmPasswordRequired'),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: 'passwordsDoNotMatch',
        path: ['confirmPassword'],
    })

type OnboardingFormData = z.infer<typeof onboardingSchema>

const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.08, delayChildren: 0.15 },
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

export default function OnboardingPage() {
    const navigate = useNavigate()
    const { t } = useTranslation()
    const prefersReducedMotion = usePrefersReducedMotion()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

    const {
        control,
        handleSubmit,
        formState: { errors },
    } = useForm<OnboardingFormData>({
        resolver: zodResolver(onboardingSchema),
        defaultValues: {
            orgName: '',
            firstName: '',
            lastName: '',
            email: '',
            password: '',
            confirmPassword: '',
        },
    })

    const onSubmit = async (data: OnboardingFormData) => {
        setLoading(true)
        setError(null)

        try {
            const onboardingRepository = getService<IOnboardingRepository>(TYPES.OnboardingRepository)
            await onboardingRepository.registerTenant({
                orgName: data.orgName,
                adminFirstName: data.firstName,
                adminLastName: data.lastName,
                adminEmail: data.email,
                adminPassword: data.password,
            })
            setSubmittedEmail(data.email)
            setSuccess(true)
        } catch (err: unknown) {
            setError(formatApiError(err, t))
        } finally {
            setLoading(false)
        }
    }

    // Map Zod error keys to localized messages.
    const fieldError = (key?: string) => (key ? t(`onboarding.validation.${key}`) : undefined)

    const cardSx = {
        background: 'rgba(255, 255, 255, 0.95)',
        color: '#1a1a2e',
        '& .MuiTypography-root': { color: '#1a1a2e' },
        '& .MuiTypography-colorTextSecondary': { color: 'rgba(0,0,0,0.6)' },
        '& .MuiSvgIcon-root': { color: 'rgba(0,0,0,0.54)' },
        '& .MuiIconButton-root .MuiSvgIcon-root': { color: 'rgba(0,0,0,0.54)' },
        '& .MuiInputBase-input': { color: '#1a1a2e' },
        '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' },
        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' },
        '& .MuiLink-root': { color: '#6366f1' },
        '& .MuiFormHelperText-root': { color: 'rgba(0,0,0,0.6)' },
        backdropFilter: 'blur(20px)',
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        overflow: 'visible',
    }

    const inputSx = {
        '& .MuiOutlinedInput-root': {
            borderRadius: '12px',
            backgroundColor: '#f8fafc',
            '&:hover': { backgroundColor: '#f1f5f9' },
            '&.Mui-focused': { backgroundColor: '#fff' },
        },
    }

    const submitButtonSx = {
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
                py: 4,
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
                    <FloatingShape delay={1.5} size={250} left="50%" top="80%" />
                </>
            )}

            <motion.div
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                style={{ width: '100%', maxWidth: 480, margin: '0 16px', zIndex: 1 }}
            >
                <Card sx={cardSx}>
                    <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
                        {/* Logo */}
                        <motion.div variants={logoVariants}>
                            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
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
                                    {success ? (
                                        <MarkEmailReadOutlined sx={{ fontSize: 44, color: 'white' }} />
                                    ) : (
                                        <ApartmentOutlined sx={{ fontSize: 44, color: 'white' }} />
                                    )}
                                </Box>
                            </Box>
                        </motion.div>

                        {/* Header */}
                        <motion.div variants={itemVariants}>
                            <Box sx={{ textAlign: 'center', mb: 3 }}>
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
                                    {success ? t('onboarding.successTitle') : t('onboarding.title')}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {success ? t('onboarding.successSubtitle') : t('onboarding.subtitle')}
                                </Typography>
                                {!success && (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                                        <Chip
                                            icon={<WorkspacePremiumOutlined sx={{ color: '#6366f1 !important' }} />}
                                            label={t('onboarding.trialBadge')}
                                            size="small"
                                            sx={{
                                                fontWeight: 600,
                                                color: '#4f46e5',
                                                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                                            }}
                                        />
                                    </Box>
                                )}
                            </Box>
                        </motion.div>

                        {success ? (
                            <>
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <Alert severity="success" sx={{ mb: 3, borderRadius: '12px' }}>
                                        {submittedEmail
                                            ? t('onboarding.checkInboxWithEmail', { email: submittedEmail })
                                            : t('onboarding.checkInbox')}
                                    </Alert>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                        {t('onboarding.checkInboxHint')}
                                    </Typography>
                                </motion.div>

                                <motion.div variants={itemVariants}>
                                    <Button
                                        fullWidth
                                        variant="contained"
                                        size="large"
                                        onClick={() => navigate('/login')}
                                        endIcon={<ArrowForward />}
                                        sx={submitButtonSx}
                                    >
                                        {t('onboarding.goToLogin')}
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
                                        <Alert severity="error" sx={{ mb: 3, borderRadius: '12px', whiteSpace: 'pre-line' }}>
                                            {error}
                                        </Alert>
                                    </motion.div>
                                )}

                                {/* Organisation name */}
                                <motion.div variants={itemVariants}>
                                    <Controller
                                        name="orgName"
                                        control={control}
                                        render={({ field }) => (
                                            <TextField
                                                {...field}
                                                id="onboarding-orgName"
                                                fullWidth
                                                label={t('onboarding.orgNameLabel')}
                                                placeholder={t('onboarding.orgNamePlaceholder')}
                                                error={!!errors.orgName}
                                                helperText={fieldError(errors.orgName?.message)}
                                                margin="normal"
                                                disabled={loading}
                                                InputProps={{
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <ApartmentOutlined sx={{ color: 'text.secondary' }} />
                                                        </InputAdornment>
                                                    ),
                                                }}
                                                sx={inputSx}
                                            />
                                        )}
                                    />
                                </motion.div>

                                {/* First + last name */}
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <motion.div variants={itemVariants} style={{ flex: 1 }}>
                                        <Controller
                                            name="firstName"
                                            control={control}
                                            render={({ field }) => (
                                                <TextField
                                                    {...field}
                                                    id="onboarding-firstName"
                                                    fullWidth
                                                    label={t('onboarding.firstNameLabel')}
                                                    error={!!errors.firstName}
                                                    helperText={fieldError(errors.firstName?.message)}
                                                    margin="normal"
                                                    disabled={loading}
                                                    InputProps={{
                                                        startAdornment: (
                                                            <InputAdornment position="start">
                                                                <PersonOutline sx={{ color: 'text.secondary' }} />
                                                            </InputAdornment>
                                                        ),
                                                    }}
                                                    sx={inputSx}
                                                />
                                            )}
                                        />
                                    </motion.div>
                                    <motion.div variants={itemVariants} style={{ flex: 1 }}>
                                        <Controller
                                            name="lastName"
                                            control={control}
                                            render={({ field }) => (
                                                <TextField
                                                    {...field}
                                                    id="onboarding-lastName"
                                                    fullWidth
                                                    label={t('onboarding.lastNameLabel')}
                                                    error={!!errors.lastName}
                                                    helperText={fieldError(errors.lastName?.message)}
                                                    margin="normal"
                                                    disabled={loading}
                                                    sx={inputSx}
                                                />
                                            )}
                                        />
                                    </motion.div>
                                </Box>

                                {/* Work email */}
                                <motion.div variants={itemVariants}>
                                    <Controller
                                        name="email"
                                        control={control}
                                        render={({ field }) => (
                                            <TextField
                                                {...field}
                                                id="onboarding-email"
                                                fullWidth
                                                type="email"
                                                label={t('onboarding.emailLabel')}
                                                placeholder={t('onboarding.emailPlaceholder')}
                                                error={!!errors.email}
                                                helperText={
                                                    fieldError(errors.email?.message) ??
                                                    t('onboarding.emailHelp')
                                                }
                                                margin="normal"
                                                disabled={loading}
                                                InputProps={{
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <EmailOutlined sx={{ color: 'text.secondary' }} />
                                                        </InputAdornment>
                                                    ),
                                                }}
                                                sx={inputSx}
                                            />
                                        )}
                                    />
                                </motion.div>

                                {/* Password */}
                                <motion.div variants={itemVariants}>
                                    <Controller
                                        name="password"
                                        control={control}
                                        render={({ field }) => (
                                            <TextField
                                                {...field}
                                                id="onboarding-password"
                                                fullWidth
                                                label={t('onboarding.passwordLabel')}
                                                type={showPassword ? 'text' : 'password'}
                                                error={!!errors.password}
                                                helperText={fieldError(errors.password?.message)}
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
                                                                size="small"
                                                                aria-label={showPassword ? t('common.aria.hidePassword') : t('common.aria.showPassword')}
                                                            >
                                                                {showPassword ? <VisibilityOff /> : <Visibility />}
                                                            </IconButton>
                                                        </InputAdornment>
                                                    ),
                                                }}
                                                sx={inputSx}
                                            />
                                        )}
                                    />
                                </motion.div>

                                {/* Confirm password */}
                                <motion.div variants={itemVariants}>
                                    <Controller
                                        name="confirmPassword"
                                        control={control}
                                        render={({ field }) => (
                                            <TextField
                                                {...field}
                                                id="onboarding-confirmPassword"
                                                fullWidth
                                                label={t('onboarding.confirmPasswordLabel')}
                                                type={showConfirmPassword ? 'text' : 'password'}
                                                error={!!errors.confirmPassword}
                                                helperText={fieldError(errors.confirmPassword?.message)}
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
                                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                                edge="end"
                                                                disabled={loading}
                                                                size="small"
                                                                aria-label={showConfirmPassword ? t('common.aria.hidePassword') : t('common.aria.showPassword')}
                                                            >
                                                                {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                                                            </IconButton>
                                                        </InputAdornment>
                                                    ),
                                                }}
                                                sx={inputSx}
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
                                        sx={submitButtonSx}
                                    >
                                        {loading ? (
                                            <CircularProgress size={24} sx={{ color: 'white' }} />
                                        ) : (
                                            t('onboarding.submitButton')
                                        )}
                                    </Button>
                                </motion.div>

                                <motion.div variants={itemVariants}>
                                    <Box sx={{ textAlign: 'center', mt: 1 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            {t('onboarding.haveAccountQuestion')}{' '}
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
                                                {t('onboarding.signInLink')}
                                            </Link>
                                        </Typography>
                                    </Box>
                                </motion.div>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </motion.div>
        </Box>
    )
}
