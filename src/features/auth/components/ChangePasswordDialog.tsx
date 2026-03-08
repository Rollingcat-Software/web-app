import React, { useState } from 'react'
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Box,
    LinearProgress,
    Typography,
    Alert,
    IconButton,
    InputAdornment,
} from '@mui/material'
import { Visibility, VisibilityOff } from '@mui/icons-material'
import { useService } from '@app/providers/DependencyProvider'
import { TYPES } from '@core/di/types'
import type { IPasswordService } from '@domain/interfaces/IPasswordService'
import { useAuth } from '../hooks/useAuth'

interface ChangePasswordDialogProps {
    open: boolean
    onClose: () => void
}

interface FormData {
    currentPassword: string
    newPassword: string
    confirmPassword: string
}

interface ShowPasswords {
    current: boolean
    new: boolean
    confirm: boolean
}

export function ChangePasswordDialog({ open, onClose }: ChangePasswordDialogProps) {
    const passwordService = useService<IPasswordService>(TYPES.PasswordService)
    const { user } = useAuth()

    const [formData, setFormData] = useState<FormData>({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    })
    const [showPasswords, setShowPasswords] = useState<ShowPasswords>({
        current: false,
        new: false,
        confirm: false,
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [validation, setValidation] = useState<{
        strength: 'weak' | 'medium' | 'strong'
        errors: string[]
    }>({
        strength: 'weak',
        errors: [],
    })

    const handleChange = (field: keyof FormData) => (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const value = e.target.value
        setFormData((prev) => ({ ...prev, [field]: value }))

        if (field === 'newPassword') {
            const result = passwordService.validatePassword(value)
            setValidation({ strength: result.strength, errors: result.errors })
        }
    }

    const togglePasswordVisibility = (field: keyof ShowPasswords) => {
        setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }))
    }

    const handleSubmit = async () => {
        if (!user?.id) return

        setLoading(true)
        setError(null)

        try {
            await passwordService.changePassword(user.id, formData)
            handleClose()
        } catch (err) {
            setError((err as Error).message)
        } finally {
            setLoading(false)
        }
    }

    const handleClose = () => {
        setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' })
        setError(null)
        setValidation({ strength: 'weak', errors: [] })
        onClose()
    }

    const getStrengthColor = (): 'error' | 'warning' | 'success' => {
        switch (validation.strength) {
            case 'weak':
                return 'error'
            case 'medium':
                return 'warning'
            case 'strong':
                return 'success'
            default:
                return 'error'
        }
    }

    const getStrengthValue = (): number => {
        switch (validation.strength) {
            case 'weak':
                return 33
            case 'medium':
                return 66
            case 'strong':
                return 100
            default:
                return 0
        }
    }

    const isSubmitDisabled =
        loading ||
        validation.errors.length > 0 ||
        formData.newPassword !== formData.confirmPassword ||
        !formData.currentPassword ||
        !formData.newPassword ||
        !formData.confirmPassword

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>Change Password</DialogTitle>
            <DialogContent>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                <TextField
                    fullWidth
                    margin="normal"
                    label="Current Password"
                    type={showPasswords.current ? 'text' : 'password'}
                    value={formData.currentPassword}
                    onChange={handleChange('currentPassword')}
                    autoComplete="current-password"
                    InputProps={{
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton
                                    onClick={() => togglePasswordVisibility('current')}
                                    edge="end"
                                >
                                    {showPasswords.current ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                            </InputAdornment>
                        ),
                    }}
                />

                <TextField
                    fullWidth
                    margin="normal"
                    label="New Password"
                    type={showPasswords.new ? 'text' : 'password'}
                    value={formData.newPassword}
                    onChange={handleChange('newPassword')}
                    autoComplete="new-password"
                    InputProps={{
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton
                                    onClick={() => togglePasswordVisibility('new')}
                                    edge="end"
                                >
                                    {showPasswords.new ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                            </InputAdornment>
                        ),
                    }}
                />

                {formData.newPassword && (
                    <Box sx={{ mt: 1, mb: 2 }}>
                        <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="caption">Strength:</Typography>
                            <Box flexGrow={1}>
                                <LinearProgress
                                    variant="determinate"
                                    value={getStrengthValue()}
                                    color={getStrengthColor()}
                                />
                            </Box>
                            <Typography
                                variant="caption"
                                sx={{ color: `${getStrengthColor()}.main`, textTransform: 'capitalize' }}
                            >
                                {validation.strength}
                            </Typography>
                        </Box>
                        {validation.errors.length > 0 && (
                            <Box sx={{ mt: 1 }}>
                                {validation.errors.map((err, i) => (
                                    <Typography key={i} variant="caption" color="error" display="block">
                                        - {err}
                                    </Typography>
                                ))}
                            </Box>
                        )}
                    </Box>
                )}

                <TextField
                    fullWidth
                    margin="normal"
                    label="Confirm New Password"
                    type={showPasswords.confirm ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={handleChange('confirmPassword')}
                    autoComplete="new-password"
                    error={
                        formData.confirmPassword !== '' &&
                        formData.newPassword !== formData.confirmPassword
                    }
                    helperText={
                        formData.confirmPassword !== '' &&
                        formData.newPassword !== formData.confirmPassword
                            ? "Passwords don't match"
                            : ''
                    }
                    InputProps={{
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton
                                    onClick={() => togglePasswordVisibility('confirm')}
                                    edge="end"
                                >
                                    {showPasswords.confirm ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                            </InputAdornment>
                        ),
                    }}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={loading}>
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={isSubmitDisabled}
                >
                    {loading ? 'Changing...' : 'Change Password'}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export default ChangePasswordDialog
