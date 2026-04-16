import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Step,
    StepLabel,
    Stepper,
    TextField,
    Typography,
} from '@mui/material'
import { PhonelinkLock, QrCode2, CheckCircle, ContentCopy, DeleteOutline } from '@mui/icons-material'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'

interface TotpEnrollmentProps {
    open: boolean
    userId: string
    onClose: () => void
    onSuccess: () => void
}

const steps = ['Generate Secret', 'Scan QR Code', 'Verify Code']

interface TotpSetupResponse {
    secret: string
    otpAuthUri: string
    message: string
}

interface TotpVerifyResponse {
    success: boolean
    message: string
}

interface TotpStatusResponse {
    userId: string
    configured: boolean
}

interface TotpRevokeResponse {
    success: boolean
    message: string
}

function getErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error) {
        return err.message
    }

    const maybeError = err as { response?: { data?: { message?: string } } }
    return maybeError.response?.data?.message || fallback
}

export default function TotpEnrollment({ open, userId, onClose, onSuccess }: TotpEnrollmentProps) {
    const { t } = useTranslation()
    const httpClient = useService<IHttpClient>(TYPES.HttpClient)
    const [activeStep, setActiveStep] = useState(0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [secret, setSecret] = useState('')
    const [qrUri, setQrUri] = useState('')
    const [code, setCode] = useState('')
    const [copied, setCopied] = useState(false)
    const [totpConfigured, setTotpConfigured] = useState(false)
    const [statusLoading, setStatusLoading] = useState(false)
    const [disableLoading, setDisableLoading] = useState(false)

    // Check TOTP status when dialog opens
    useEffect(() => {
        if (!open || !userId) return

        let cancelled = false
        const checkStatus = async () => {
            setStatusLoading(true)
            try {
                const response = await httpClient.get<TotpStatusResponse>(`/totp/status/${userId}`)
                if (!cancelled) {
                    setTotpConfigured(response.data.configured)
                }
            } catch {
                // Status check is non-critical; ignore errors
            } finally {
                if (!cancelled) {
                    setStatusLoading(false)
                }
            }
        }

        checkStatus()
        return () => {
            cancelled = true
        }
    }, [open, userId, httpClient])

    const handleReset = useCallback(() => {
        setActiveStep(0)
        setSecret('')
        setQrUri('')
        setCode('')
        setError(null)
        setCopied(false)
    }, [])

    const handleSetup = useCallback(async () => {
        if (!userId) {
            setError(t('auth.totp.error.userIdRequired'))
            return
        }

        setLoading(true)
        setError(null)
        try {
            const response = await httpClient.post<TotpSetupResponse>(`/totp/setup/${userId}`, {})
            setSecret(response.data.secret)
            setQrUri(response.data.otpAuthUri)
            setTotpConfigured(false)
            setActiveStep(1)
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to setup TOTP'))
        } finally {
            setLoading(false)
        }
    }, [httpClient, t, userId])

    const handleVerify = useCallback(async () => {
        if (!userId) {
            setError(t('auth.totp.error.userIdRequiredVerify'))
            return
        }

        if (code.length !== 6) {
            return
        }

        setLoading(true)
        setError(null)
        try {
            const response = await httpClient.post<TotpVerifyResponse>(`/totp/verify-setup/${userId}`, { code })
            if (!response.data.success) {
                setError(response.data.message || 'Invalid verification code')
                return
            }

            setTotpConfigured(true)
            setActiveStep(2)
            setTimeout(() => {
                onSuccess()
                handleReset()
            }, 2000)
        } catch (err) {
            setError(getErrorMessage(err, 'Invalid verification code'))
        } finally {
            setLoading(false)
        }
    }, [code, httpClient, onSuccess, handleReset, t, userId])

    const handleDisable = useCallback(async () => {
        if (!userId) return

        const confirmed = window.confirm(
            'Are you sure you want to disable TOTP? You will no longer need a code from your authenticator app to log in.',
        )
        if (!confirmed) return

        setDisableLoading(true)
        setError(null)
        try {
            await httpClient.delete<TotpRevokeResponse>(`/totp/${userId}`)
            setTotpConfigured(false)
            handleReset()
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to disable TOTP'))
        } finally {
            setDisableLoading(false)
        }
    }, [httpClient, userId, handleReset])

    const handleClose = useCallback(() => {
        handleReset()
        onClose()
    }, [onClose, handleReset])

    const handleCopySecret = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(secret)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            // Fallback for non-HTTPS
        }
    }, [secret])

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PhonelinkLock color="primary" />
                Setup Two-Factor Authentication (TOTP)
            </DialogTitle>
            <DialogContent>
                {statusLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : totpConfigured && activeStep === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 3 }}>
                        <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                        <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                            TOTP is Already Configured
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Two-factor authentication is currently enabled for your account.
                            You can disable it or set it up again with a new secret.
                        </Typography>

                        {error && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {error}
                            </Alert>
                        )}

                        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                            <Button
                                variant="outlined"
                                color="error"
                                onClick={handleDisable}
                                disabled={disableLoading}
                                startIcon={disableLoading ? <CircularProgress size={16} /> : <DeleteOutline />}
                            >
                                Disable TOTP
                            </Button>
                            <Button
                                variant="contained"
                                onClick={handleSetup}
                                disabled={loading}
                                startIcon={loading ? <CircularProgress size={16} /> : undefined}
                            >
                                Re-setup TOTP
                            </Button>
                        </Box>
                    </Box>
                ) : (
                    <>
                        <Stepper activeStep={activeStep} sx={{ mb: 3, mt: 1 }}>
                            {steps.map((label) => (
                                <Step key={label}>
                                    <StepLabel>{label}</StepLabel>
                                </Step>
                            ))}
                        </Stepper>

                        {error && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {error}
                            </Alert>
                        )}

                        {activeStep === 0 && (
                            <Box sx={{ textAlign: 'center', py: 2 }}>
                                <QrCode2 sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
                                <Typography variant="body1" sx={{ mb: 2 }}>
                                    Set up two-factor authentication using an authenticator app like
                                    Google Authenticator, Authy, or Microsoft Authenticator.
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                    This adds an extra layer of security to your account. You will need
                                    to enter a code from the app each time you log in.
                                </Typography>
                                <Button
                                    variant="contained"
                                    onClick={handleSetup}
                                    disabled={loading}
                                    startIcon={loading ? <CircularProgress size={16} /> : undefined}
                                    sx={{
                                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                        borderRadius: '12px',
                                        py: 1.5,
                                        px: 4,
                                    }}
                                >
                                    Generate Secret Key
                                </Button>
                            </Box>
                        )}

                        {activeStep === 1 && (
                            <Box sx={{ textAlign: 'center', py: 2 }}>
                                {qrUri && (
                                    <Box sx={{ mb: 3 }}>
                                        <Box
                                            sx={{
                                                display: 'inline-block',
                                                p: 2,
                                                bgcolor: '#fff',
                                                borderRadius: 2,
                                                border: '2px solid',
                                                borderColor: 'divider',
                                            }}
                                        >
                                            <img
                                                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUri)}`}
                                                alt="TOTP QR Code"
                                                width={200}
                                                height={200}
                                            />
                                        </Box>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                            Scan this QR code with your authenticator app
                                        </Typography>
                                    </Box>
                                )}

                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                    Or enter this secret key manually:
                                </Typography>
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 1,
                                        mb: 3,
                                    }}
                                >
                                    <Typography
                                        variant="body1"
                                        fontFamily="monospace"
                                        fontWeight={600}
                                        sx={{
                                            p: 1.5,
                                            bgcolor: 'rgba(99, 102, 241, 0.08)',
                                            borderRadius: 2,
                                            letterSpacing: '0.15em',
                                            wordBreak: 'break-all',
                                        }}
                                    >
                                        {secret}
                                    </Typography>
                                    <Button
                                        size="small"
                                        onClick={handleCopySecret}
                                        startIcon={<ContentCopy />}
                                    >
                                        {copied ? 'Copied!' : 'Copy'}
                                    </Button>
                                </Box>

                                <Typography variant="body2" sx={{ mb: 2 }}>
                                    Enter the 6-digit verification code from your app:
                                </Typography>
                                <TextField
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="000000"
                                    autoFocus
                                    inputProps={{
                                        maxLength: 6,
                                        style: {
                                            textAlign: 'center',
                                            fontSize: '1.5rem',
                                            fontWeight: 700,
                                            letterSpacing: '0.5em',
                                        },
                                        inputMode: 'numeric',
                                    }}
                                    sx={{
                                        maxWidth: 240,
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: '12px',
                                        },
                                    }}
                                />
                            </Box>
                        )}

                        {activeStep === 2 && (
                            <Box sx={{ textAlign: 'center', py: 3 }}>
                                <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                                <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                                    TOTP Setup Complete!
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Two-factor authentication has been enabled for your account.
                                    You will need to enter a code from your authenticator app when logging in.
                                </Typography>
                            </Box>
                        )}
                    </>
                )}
            </DialogContent>
            <DialogActions>
                {activeStep < 2 && (
                    <Button onClick={handleClose}>
                        {totpConfigured && activeStep === 0 ? 'Close' : 'Cancel'}
                    </Button>
                )}
                {activeStep === 1 && (
                    <Button
                        variant="contained"
                        onClick={handleVerify}
                        disabled={loading || code.length !== 6}
                        startIcon={loading ? <CircularProgress size={16} /> : undefined}
                    >
                        Verify & Enable
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    )
}
