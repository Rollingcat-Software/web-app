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
} from '@mui/material'
import { Security, Visibility, VisibilityOff } from '@mui/icons-material'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../hooks/useAuth'

/**
 * Login form validation schema
 */
const loginSchema = z.object({
    email: z.string().email('Invalid email address').min(1, 'Email is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginFormData = z.infer<typeof loginSchema>

/**
 * Login Page Component (New Architecture)
 * Uses dependency injection and clean architecture principles
 */
export default function LoginPage() {
    const navigate = useNavigate()
    const { login, loading, error } = useAuth()
    const [showPassword, setShowPassword] = useState(false)

    const {
        control,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        // SECURITY: Removed hardcoded credentials
        // Default values are empty for security
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

            // Navigate to dashboard on successful login
            navigate('/')
        } catch (err) {
            // Error already handled by useAuth hook and ErrorHandler
            // SECURITY: Don't log sensitive error details in production
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
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}
        >
            <Card
                sx={{
                    minWidth: 400,
                    maxWidth: 500,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                }}
            >
                <CardContent sx={{ p: 4 }}>
                    {/* Header */}
                    <Box sx={{ textAlign: 'center', mb: 3 }}>
                        <Security sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
                        <Typography variant="h4" component="h1" gutterBottom fontWeight={600}>
                            FIVUCSAS
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Face and Identity Verification Platform
                        </Typography>
                    </Box>

                    {/* Login Form */}
                    <form onSubmit={handleSubmit(onSubmit)}>
                        {/* Error Alert */}
                        {error && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {error.message || 'Login failed. Please try again.'}
                            </Alert>
                        )}

                        {/* Email Field */}
                        <Controller
                            name="email"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    fullWidth
                                    label="Email"
                                    type="email"
                                    error={!!errors.email}
                                    helperText={errors.email?.message}
                                    margin="normal"
                                    autoFocus
                                    disabled={loading}
                                />
                            )}
                        />

                        {/* Password Field */}
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
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    edge="end"
                                                    disabled={loading}
                                                >
                                                    {showPassword ? <VisibilityOff /> : <Visibility />}
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                            )}
                        />

                        {/* Submit Button */}
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            size="large"
                            disabled={loading}
                            sx={{ mt: 3, mb: 2, py: 1.5 }}
                        >
                            {loading ? <CircularProgress size={24} /> : 'Sign In'}
                        </Button>
                    </form>

                    {/* SECURITY: Demo credentials removed for production security
                        Only show demo credentials in development environment */}
                    {import.meta.env.DEV && (
                        <Box sx={{ mt: 3, p: 2, bgcolor: 'warning.lighter', borderRadius: 1, border: '1px solid', borderColor: 'warning.main' }}>
                            <Typography variant="caption" color="warning.dark" display="block" fontWeight="bold">
                                DEV MODE ONLY - Demo Credentials:
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                                Email: admin@fivucsas.com
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Password: password123
                            </Typography>
                            <Typography variant="caption" color="error.main" display="block" sx={{ mt: 1 }}>
                                This box will not appear in production
                            </Typography>
                        </Box>
                    )}
                </CardContent>
            </Card>
        </Box>
    )
}
