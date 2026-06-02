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
import { Typography } from '@mui/material'
import StepLayout from './StepLayout'
import { stepItemVariants as itemVariants } from './stepMotion'

type PasswordFormData = { email: string; password: string }

interface PasswordStepProps {
    onSubmit: (data: { email: string; password: string }) => void
    loading: boolean
    error?: string
    /**
     * Identifier-first mode: when set, the email was already collected on the
     * identify screen — hide the email field, password is the only input, and
     * show "Signing in as <email>" read-only. The "change identity" / restart
     * affordance is provided once at the SHELL level (LoginMfaFlow's
     * "Not you? Start over" header link), not per-step, so every factor is
     * uniform — PasswordStep no longer carries its own change link.
     */
    presetEmail?: string
}

export default function PasswordStep({ onSubmit, loading, error, presetEmail }: PasswordStepProps) {
    const { t } = useTranslation()
    const [showPassword, setShowPassword] = useState(false)
    const identifierFirst = Boolean(presetEmail)

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
            email: presetEmail ?? '',
            password: '',
        },
    })

    const handleFormSubmit = (data: PasswordFormData) => {
        onSubmit({ email: data.email, password: data.password })
    }

    return (
        <StepLayout
            title={identifierFirst ? t('auth.enterPassword') : t('auth.enterCredentials')}
            subtitle={identifierFirst ? t('auth.signInWithPassword') : t('auth.signInWithEmail')}
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
                {identifierFirst ? (
                    // Identity already collected on the identify screen — show it
                    // read-only, NO email box. The "change identity" / restart
                    // affordance is the shell-level "Not you? Start over" header
                    // link (Fix 1), so it is NOT repeated here per-step.
                    <>
                    <motion.div variants={itemVariants}>
                        <Typography
                            variant="body2"
                            sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}
                        >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                                <EmailOutlined sx={{ fontSize: 18, color: 'text.secondary' }} />
                                <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{presetEmail}</strong>
                            </span>
                        </Typography>
                    </motion.div>
                    {/* paired username field for a11y + password managers (email is shown
                        read-only above, not as an input, in identifier-first mode) */}
                    <input
                        type="text"
                        name="username"
                        autoComplete="username"
                        value={presetEmail ?? ''}
                        readOnly
                        aria-hidden="true"
                        tabIndex={-1}
                        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                    />
                    </>
                ) : (
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
                                            backgroundColor: 'background.paper',
                                            '&:hover': { backgroundColor: 'action.hover' },
                                            '&.Mui-focused': { backgroundColor: 'background.paper' },
                                        },
                                    }}
                                />
                            )}
                        />
                    </motion.div>
                )}

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
                                autoFocus={identifierFirst}
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
                                        backgroundColor: 'background.paper',
                                        '&:hover': { backgroundColor: 'action.hover' },
                                        '&.Mui-focused': { backgroundColor: 'background.paper' },
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
