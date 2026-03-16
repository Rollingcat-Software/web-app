import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
    Visibility,
    VisibilityOff,
    PersonAddOutlined,
    EmailOutlined,
    PersonOutlined,
    LockOutlined,
    ArrowForward,
    MarkEmailRead,
} from '@mui/icons-material'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, Variants } from 'framer-motion'
import { getService } from '@core/di/container'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'

/**
 * Register form validation schema
 */
const registerSchema = z.object({
    firstName: z.string().min(1, 'First name is required').max(50, 'First name too long'),
    lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long'),
    email: z.string().min(1, 'Email is required').email('Invalid email address'),
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain uppercase letter')
        .regex(/[a-z]/, 'Password must contain lowercase letter')
        .regex(/[0-9]/, 'Password must contain a number')
        .regex(/[!@#$%^&*]/, 'Password must contain special character (!@#$%^&*)'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
})

type RegisterFormData = z.infer<typeof registerSchema>

// Bezier easing
const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

// Animation variants
const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.08,
            delayChildren: 0.15,
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

// Floating shapes for background
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

/**
 * Register Page Component
 * Beautiful animated registration with glassmorphism design
 */
export default function RegisterPage() {
    const navigate = useNavigate()
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const {
        control,
        handleSubmit,
        formState: { errors },
    } = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
        defaultValues: {
            firstName: '',
            lastName: '',
            email: '',
            password: '',
            confirmPassword: '',
        },
    })

    const [registeredEmail, setRegisteredEmail] = useState('')
    const [registrationToken, setRegistrationToken] = useState('')
    const [otpCode, setOtpCode] = useState('')
    const [otpError, setOtpError] = useState<string | null>(null)
    const [verifying, setVerifying] = useState(false)
    const [verified, setVerified] = useState(false)

    const onSubmit = async (data: RegisterFormData) => {
        setLoading(true)
        setError(null)

        try {
            const httpClient = getService<IHttpClient>(TYPES.HttpClient)
            const response = await httpClient.post<{ accessToken?: string }>('/auth/register', {
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                password: data.password,
            })

            setRegisteredEmail(data.email)
            if (response?.data?.accessToken) {
                setRegistrationToken(response.data.accessToken)
            }
            setSuccess(true)
        } catch (err: any) {
            if (err.response?.status === 409) {
                setError('An account with this email already exists')
            } else if (err.response?.data?.message) {
                setError(err.response.data.message)
            } else if (err instanceof Error) {
                setError(err.message)
            } else {
                setError('Registration failed. Please try again.')
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
                py: 4,
            }}
        >
            {/* Animated background shapes */}
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
                            <Box
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    mb: 3,
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 70,
                                        height: 70,
                                        borderRadius: '18px',
                                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 10px 40px rgba(99, 102, 241, 0.4)',
                                    }}
                                >
                                    <Fingerprint sx={{ fontSize: 40, color: 'white' }} />
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
                                    Create Account
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Join FIVUCSAS Identity Platform
                                </Typography>
                            </Box>
                        </motion.div>

                        {/* Check Your Email view — replaces form on success */}
                        {success ? (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, ease: easeOut }}
                            >
                                <Box sx={{ textAlign: 'center', py: 2 }}>
                                    <Box
                                        sx={{
                                            width: 72,
                                            height: 72,
                                            borderRadius: '18px',
                                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            boxShadow: '0 10px 40px rgba(16, 185, 129, 0.4)',
                                            mx: 'auto',
                                            mb: 3,
                                        }}
                                    >
                                        <MarkEmailRead sx={{ fontSize: 40, color: 'white' }} />
                                    </Box>
                                    <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
                                        Check your email
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                        We sent a verification code to
                                    </Typography>
                                    <Typography variant="body1" fontWeight={600} sx={{ mb: 3, color: 'primary.main' }}>
                                        {registeredEmail}
                                    </Typography>
                                    {verified ? (
                                        <>
                                            <Typography variant="body2" color="success.main" fontWeight={600} sx={{ mb: 3 }}>
                                                ✓ Email verified successfully!
                                            </Typography>
                                            <Button
                                                fullWidth
                                                variant="contained"
                                                size="large"
                                                onClick={() => navigate('/login')}
                                                sx={{
                                                    py: 1.5,
                                                    borderRadius: '12px',
                                                    fontWeight: 600,
                                                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                                    boxShadow: '0 10px 40px rgba(99, 102, 241, 0.4)',
                                                }}
                                            >
                                                Go to Sign In
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                                Enter the 6-digit code from the email. It expires in 5 minutes.
                                            </Typography>
                                            <TextField
                                                fullWidth
                                                label="Verification Code"
                                                value={otpCode}
                                                onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                inputProps={{ maxLength: 6, style: { textAlign: 'center', letterSpacing: '0.5em', fontSize: '1.4rem' } }}
                                                sx={{ mb: 2 }}
                                                error={!!otpError}
                                                helperText={otpError}
                                            />
                                            <Button
                                                fullWidth
                                                variant="contained"
                                                size="large"
                                                disabled={otpCode.length !== 6 || verifying}
                                                onClick={async () => {
                                                    setVerifying(true)
                                                    setOtpError(null)
                                                    try {
                                                        const httpClient = getService<IHttpClient>(TYPES.HttpClient)
                                                        const res = await httpClient.post<{ success: boolean; message?: string }>(
                                                            '/auth/verify-email',
                                                            { code: otpCode },
                                                            registrationToken ? { headers: { Authorization: `Bearer ${registrationToken}` } } : undefined
                                                        )
                                                        if (res?.data?.success) {
                                                            setVerified(true)
                                                        } else {
                                                            setOtpError(res?.data?.message ?? 'Invalid or expired code. Please try again.')
                                                        }
                                                    } catch {
                                                        setOtpError('Verification failed. Please try again.')
                                                    } finally {
                                                        setVerifying(false)
                                                    }
                                                }}
                                                sx={{
                                                    py: 1.5,
                                                    borderRadius: '12px',
                                                    fontWeight: 600,
                                                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                                    boxShadow: '0 10px 40px rgba(99, 102, 241, 0.4)',
                                                    mb: 1,
                                                }}
                                            >
                                                {verifying ? <CircularProgress size={22} color="inherit" /> : 'Verify Email'}
                                            </Button>
                                            <Button
                                                fullWidth
                                                variant="text"
                                                size="small"
                                                onClick={() => navigate('/login')}
                                                sx={{ color: 'text.secondary' }}
                                            >
                                                Skip for now — Go to Sign In
                                            </Button>
                                        </>
                                    )}
                                </Box>
                            </motion.div>
                        ) : (
                        <>

                        {/* Register Form */}
                        <form onSubmit={handleSubmit(onSubmit)}>
                            {/* Error Alert */}
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <Alert
                                        severity="error"
                                        sx={{
                                            mb: 2,
                                            borderRadius: '12px',
                                        }}
                                    >
                                        {error}
                                    </Alert>
                                </motion.div>
                            )}

                            {/* Name Fields - Side by Side */}
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <motion.div variants={itemVariants} style={{ flex: 1 }}>
                                    <Controller
                                        name="firstName"
                                        control={control}
                                        render={({ field }) => (
                                            <TextField
                                                {...field}
                                                fullWidth
                                                label="First Name"
                                                error={!!errors.firstName}
                                                helperText={errors.firstName?.message}
                                                margin="dense"
                                                disabled={loading || success}
                                                InputProps={{
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <PersonOutlined sx={{ color: 'text.secondary', fontSize: 20 }} />
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

                                <motion.div variants={itemVariants} style={{ flex: 1 }}>
                                    <Controller
                                        name="lastName"
                                        control={control}
                                        render={({ field }) => (
                                            <TextField
                                                {...field}
                                                fullWidth
                                                label="Last Name"
                                                error={!!errors.lastName}
                                                helperText={errors.lastName?.message}
                                                margin="dense"
                                                disabled={loading || success}
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
                            </Box>

                            {/* Email Field */}
                            <motion.div variants={itemVariants}>
                                <Controller
                                    name="email"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            label="Email Address"
                                            type="email"
                                            error={!!errors.email}
                                            helperText={errors.email?.message}
                                            margin="dense"
                                            disabled={loading || success}
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

                            {/* Password Field */}
                            <motion.div variants={itemVariants}>
                                <Controller
                                    name="password"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            label="Password"
                                            type={showPassword ? 'text' : 'password'}
                                            error={!!errors.password}
                                            helperText={errors.password?.message}
                                            margin="dense"
                                            disabled={loading || success}
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
                                                            disabled={loading || success}
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

                            {/* Confirm Password Field */}
                            <motion.div variants={itemVariants}>
                                <Controller
                                    name="confirmPassword"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            label="Confirm Password"
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            error={!!errors.confirmPassword}
                                            helperText={errors.confirmPassword?.message}
                                            margin="dense"
                                            disabled={loading || success}
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
                                                            disabled={loading || success}
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

                            {/* Submit Button */}
                            <motion.div variants={itemVariants}>
                                <Button
                                    type="submit"
                                    fullWidth
                                    variant="contained"
                                    size="large"
                                    disabled={loading || success}
                                    startIcon={!loading && <PersonAddOutlined />}
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
                                        '&:active': {
                                            transform: 'translateY(0)',
                                        },
                                        transition: 'all 0.3s ease',
                                    }}
                                >
                                    {loading ? (
                                        <CircularProgress size={24} sx={{ color: 'white' }} />
                                    ) : (
                                        'Create Account'
                                    )}
                                </Button>
                            </motion.div>
                        </form>

                        {/* Login Link */}
                        <motion.div variants={itemVariants}>
                            <Box sx={{ textAlign: 'center', mt: 2 }}>
                                <Typography variant="body2" color="text.secondary">
                                    Already have an account?{' '}
                                    <Link
                                        component="button"
                                        type="button"
                                        onClick={() => navigate('/login')}
                                        underline="hover"
                                        sx={{
                                            fontWeight: 600,
                                            color: 'primary.main',
                                            cursor: 'pointer',
                                            '&:hover': {
                                                color: 'primary.dark',
                                            },
                                        }}
                                    >
                                        Sign In
                                    </Link>
                                </Typography>
                            </Box>
                        </motion.div>
                        </>)}
                    </CardContent>
                </Card>

                {/* Footer */}
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
