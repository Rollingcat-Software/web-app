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
    Divider,
    Link,
} from '@mui/material'
import {
    Face,
    Fingerprint,
    Visibility,
    VisibilityOff,
    LockOutlined,
    EmailOutlined,
    ArrowForward,
} from '@mui/icons-material'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, Variants } from 'framer-motion'
import { useAuth } from '../hooks/useAuth'
import FaceVerificationFlow from './FaceVerificationFlow'
import { getBiometricService } from '@core/services/BiometricService'

/**
 * Login form validation schema
 */
const loginSchema = z.object({
    email: z.string().min(1, 'Email is required').email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
})

type LoginFormData = z.infer<typeof loginSchema>

// Bezier easing
const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

// Animation variants
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
 * Login Page Component
 * Beautiful animated login with glassmorphism design
 */
export default function LoginPage() {
    const navigate = useNavigate()
    const { login, loading, error } = useAuth()
    const [showPassword, setShowPassword] = useState(false)
    const [faceLoginOpen, setFaceLoginOpen] = useState(false)

    const handleFaceVerify = async (image: string): Promise<boolean> => {
        try {
            const biometric = getBiometricService()
            const result = await biometric.searchFace(image)
            if (result.found && result.userId) {
                // Face matched — log in with the matched user
                await login({ email: result.userId, password: '' })
                navigate('/')
                return true
            }
            return false
        } catch {
            return false
        }
    }

    const {
        control,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: '',
            password: '',
        },
    })

    const onSubmit = async (data: LoginFormData) => {
        try {
            await login({
                email: data.email,
                password: data.password,
            })
            navigate('/')
        } catch (err) {
            if (import.meta.env.DEV) {
                console.error('Login failed:', err)
            }
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
                                    mb: 4,
                                }}
                            >
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
                                    Welcome Back
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Sign in to FIVUCSAS Identity Platform
                                </Typography>
                            </Box>
                        </motion.div>

                        {/* Login Form */}
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
                                            mb: 3,
                                            borderRadius: '12px',
                                        }}
                                    >
                                        {error.message || 'Login failed. Please try again.'}
                                    </Alert>
                                </motion.div>
                            )}

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
                                                    '&:hover': {
                                                        backgroundColor: '#f1f5f9',
                                                    },
                                                    '&.Mui-focused': {
                                                        backgroundColor: '#fff',
                                                    },
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
                                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
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
                                                    '&:hover': {
                                                        backgroundColor: '#f1f5f9',
                                                    },
                                                    '&.Mui-focused': {
                                                        backgroundColor: '#fff',
                                                    },
                                                },
                                            }}
                                        />
                                    )}
                                />
                            </motion.div>

                            {/* Forgot Password Link */}
                            <motion.div variants={itemVariants}>
                                <Box sx={{ textAlign: 'right', mt: 1 }}>
                                    <Typography
                                        component="span"
                                        sx={{
                                            fontSize: '0.875rem',
                                            color: 'text.secondary',
                                            fontStyle: 'italic',
                                        }}
                                    >
                                        Forgot password? Contact admin
                                    </Typography>
                                </Box>
                            </motion.div>

                            {/* Submit Button */}
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
                                        'Sign In'
                                    )}
                                </Button>
                            </motion.div>
                        </form>

                        {/* Divider */}
                        <motion.div variants={itemVariants}>
                            <Divider sx={{ my: 3 }}>
                                <Typography variant="caption" color="text.secondary">
                                    Or continue with
                                </Typography>
                            </Divider>
                        </motion.div>

                        {/* Face Login Button */}
                        <motion.div variants={itemVariants}>
                            <Button
                                fullWidth
                                variant="outlined"
                                size="large"
                                onClick={() => setFaceLoginOpen(true)}
                                disabled={loading}
                                startIcon={<Face />}
                                sx={{
                                    mb: 2,
                                    py: 1.3,
                                    borderRadius: '12px',
                                    fontSize: '0.95rem',
                                    fontWeight: 600,
                                    borderColor: 'rgba(99, 102, 241, 0.3)',
                                    color: '#6366f1',
                                    '&:hover': {
                                        borderColor: '#6366f1',
                                        backgroundColor: 'rgba(99, 102, 241, 0.04)',
                                    },
                                    transition: 'all 0.3s ease',
                                }}
                            >
                                Login with Face ID
                            </Button>
                        </motion.div>

                        {/* Features */}
                        <motion.div variants={itemVariants}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    gap: 3,
                                    flexWrap: 'wrap',
                                }}
                            >
                                {['Face ID', 'Fingerprint', 'QR Code'].map((feature) => (
                                    <Typography
                                        key={feature}
                                        variant="caption"
                                        sx={{
                                            color: 'text.secondary',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 0.5,
                                            '&::before': {
                                                content: '"\\2022"',
                                                color: 'primary.main',
                                            },
                                        }}
                                    >
                                        {feature}
                                    </Typography>
                                ))}
                            </Box>
                        </motion.div>

                        {/* Register Link */}
                        <motion.div variants={itemVariants}>
                            <Box sx={{ textAlign: 'center', mt: 2 }}>
                                <Typography variant="body2" color="text.secondary">
                                    Don't have an account?{' '}
                                    <Link
                                        component="button"
                                        type="button"
                                        onClick={() => navigate('/register')}
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
                                        Register
                                    </Link>
                                </Typography>
                            </Box>
                        </motion.div>

                        {/* Demo credentials - only visible in development */}
                        {import.meta.env.DEV && (
                        <motion.div
                            variants={itemVariants}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            transition={{ delay: 1 }}
                        >
                            <Box
                                sx={{
                                    mt: 3,
                                    p: 2,
                                    bgcolor: 'rgba(99, 102, 241, 0.08)',
                                    borderRadius: '12px',
                                    border: '1px dashed',
                                    borderColor: 'primary.light',
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    color="primary.main"
                                    display="block"
                                    fontWeight="bold"
                                    sx={{ mb: 0.5 }}
                                >
                                    Demo Credentials
                                </Typography>
                                <Typography variant="caption" color="text.secondary" display="block">
                                    admin@fivucsas.local / Test@123
                                </Typography>
                            </Box>
                        </motion.div>
                        )}
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

            {/* Face Login Dialog */}
            <FaceVerificationFlow
                open={faceLoginOpen}
                onClose={() => setFaceLoginOpen(false)}
                onVerify={handleFaceVerify}
            />
        </Box>
    )
}
