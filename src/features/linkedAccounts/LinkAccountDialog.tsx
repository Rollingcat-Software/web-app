import { useState } from 'react'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    TextField,
    Typography,
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { formatApiError } from '@utils/formatApiError'

interface LinkAccountDialogProps {
    open: boolean
    onClose: () => void
    onLinked: () => void
    initiateLink: (email: string) => Promise<void>
    confirmLink: (email: string, otp: string, password: string) => Promise<void>
}

type Step = 'email' | 'confirm'

/**
 * Two-step "Link another account" dialog (Phase-2 account linking):
 *   1. enter the target email → OTP is sent to it,
 *   2. enter the OTP + the caller's own password (step-up) → confirm.
 */
export default function LinkAccountDialog({
    open,
    onClose,
    onLinked,
    initiateLink,
    confirmLink,
}: LinkAccountDialogProps) {
    const { t } = useTranslation()
    const [step, setStep] = useState<Step>('email')
    const [email, setEmail] = useState('')
    const [otp, setOtp] = useState('')
    const [password, setPassword] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [info, setInfo] = useState<string | null>(null)

    const reset = () => {
        setStep('email')
        setEmail('')
        setOtp('')
        setPassword('')
        setSubmitting(false)
        setError(null)
        setInfo(null)
    }

    const handleClose = () => {
        if (submitting) return
        reset()
        onClose()
    }

    const handleSend = async () => {
        if (!email.trim()) return
        setSubmitting(true)
        setError(null)
        try {
            await initiateLink(email.trim())
            setInfo(t('linkedAccounts.dialog.codeSent'))
            setStep('confirm')
        } catch (err) {
            setError(formatApiError(err, t) || t('linkedAccounts.dialog.initiateError'))
        } finally {
            setSubmitting(false)
        }
    }

    const handleConfirm = async () => {
        if (!otp.trim() || !password) return
        setSubmitting(true)
        setError(null)
        try {
            await confirmLink(email.trim(), otp.trim(), password)
            reset()
            onLinked()
        } catch (err) {
            setError(formatApiError(err, t) || t('linkedAccounts.dialog.confirmError'))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
            <DialogTitle>{t('linkedAccounts.dialog.title')}</DialogTitle>
            <DialogContent>
                {error && (
                    <Alert severity="error" role="alert" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {step === 'email' && (
                    <Box>
                        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                            {t('linkedAccounts.dialog.stepEmailTitle')}
                        </Typography>
                        <DialogContentText sx={{ mb: 2 }}>
                            {t('linkedAccounts.dialog.stepEmailHelp')}
                        </DialogContentText>
                        <TextField
                            autoFocus
                            fullWidth
                            type="email"
                            label={t('linkedAccounts.dialog.emailLabel')}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={submitting}
                        />
                    </Box>
                )}

                {step === 'confirm' && (
                    <Box>
                        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                            {t('linkedAccounts.dialog.stepConfirmTitle')}
                        </Typography>
                        <DialogContentText sx={{ mb: 2 }}>
                            {t('linkedAccounts.dialog.stepConfirmHelp', { email })}
                        </DialogContentText>
                        {info && (
                            <Alert severity="info" sx={{ mb: 2 }}>
                                {info}
                            </Alert>
                        )}
                        <TextField
                            autoFocus
                            fullWidth
                            label={t('linkedAccounts.dialog.otpLabel')}
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            disabled={submitting}
                            inputProps={{ inputMode: 'numeric', autoComplete: 'one-time-code' }}
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            fullWidth
                            type="password"
                            label={t('linkedAccounts.dialog.passwordLabel')}
                            helperText={t('linkedAccounts.dialog.passwordHelp')}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={submitting}
                            autoComplete="current-password"
                        />
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                {step === 'confirm' && (
                    <Button onClick={() => setStep('email')} disabled={submitting}>
                        {t('linkedAccounts.dialog.back')}
                    </Button>
                )}
                <Button onClick={handleClose} disabled={submitting}>
                    {t('linkedAccounts.dialog.cancel')}
                </Button>
                {step === 'email' ? (
                    <Button
                        variant="contained"
                        onClick={handleSend}
                        disabled={submitting || !email.trim()}
                        startIcon={submitting ? <CircularProgress size={16} /> : null}
                    >
                        {t('linkedAccounts.dialog.sendCode')}
                    </Button>
                ) : (
                    <Button
                        variant="contained"
                        onClick={handleConfirm}
                        disabled={submitting || !otp.trim() || !password}
                        startIcon={submitting ? <CircularProgress size={16} /> : null}
                    >
                        {t('linkedAccounts.dialog.confirm')}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    )
}
