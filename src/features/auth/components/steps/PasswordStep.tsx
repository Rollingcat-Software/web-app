import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    IconButton,
    InputAdornment,
    TextField,
} from '@mui/material'
import {
    EmailOutlined,
    LockOutlined,
    Visibility,
    VisibilityOff,
} from '@mui/icons-material'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import StepLayout from './StepLayout'
import { stepItemVariants as itemVariants } from './stepMotion'

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
        <StepLayout
            title={t('auth.enterCredentials')}
            subtitle={t('auth.signInWithEmail')}
            icon={<LockOutlined sx={{ fontSize: 28, color: 'white' }} />}
            error={error}
            primaryAction={{
                label: t('auth.continue'),
                onClick: () => {
                    void handleSubmit(handleFormSubmit)()
                },
                disabled: loading,
                loading,
            }}
        >
            <form onSubmit={handleSubmit(handleFormSubmit)}>
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
                {/* Hidden submit input so Enter-to-submit still works inside the form.
                    The visible submit button is rendered by StepLayout via primaryAction. */}
                <button type="submit" style={{ display: 'none' }} aria-hidden="true" tabIndex={-1} />
            </form>
        </StepLayout>
    )
}
