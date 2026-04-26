import { useState, useCallback } from 'react'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Tab,
    Tabs,
    TextField,
    Typography,
} from '@mui/material'
import { Email, Sms, CheckCircle, Send } from '@mui/icons-material'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import { useTranslation } from 'react-i18next'
import { formatApiError } from '@utils/formatApiError'
import type { TFunction } from 'i18next'

interface OtpManagementProps {
    open: boolean
    userId: string
    onClose: () => void
}

type OtpChannel = 'email' | 'sms'

interface OtpSendResponse {
    message: string
}

interface OtpVerifyResponse {
    success: boolean
    message: string
}

function getErrorMessage(err: unknown, t: TFunction, _fallback: string): string {
    return formatApiError(err, t)
}

export default function OtpManagement({ open, userId, onClose }: OtpManagementProps) {
    const httpClient = useService<IHttpClient>(TYPES.HttpClient)
    const { t } = useTranslation()

    const [channel, setChannel] = useState<OtpChannel>('email')
    const [otpCode, setOtpCode] = useState('')
    const [sending, setSending] = useState(false)
    const [verifying, setVerifying] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [otpSent, setOtpSent] = useState(false)
    const [verified, setVerified] = useState(false)

    const handleReset = useCallback(() => {
        setOtpCode('')
        setError(null)
        setSuccess(null)
        setOtpSent(false)
        setVerified(false)
    }, [])

    const handleChannelChange = useCallback((_: React.SyntheticEvent, newValue: OtpChannel) => {
        setChannel(newValue)
        handleReset()
    }, [handleReset])

    const handleSendOtp = useCallback(async () => {
        if (!userId) {
            setError(t('otp.userIdRequired'))
            return
        }

        setSending(true)
        setError(null)
        setSuccess(null)
        try {
            const response = await httpClient.post<OtpSendResponse>(
                `/otp/${channel}/send/${userId}`,
                {},
            )
            setOtpSent(true)
            setSuccess(response.data.message || t('otp.sentSuccess', { channel }))
        } catch (err) {
            setError(getErrorMessage(err, t, t('otp.sendFailed', { channel })))
        } finally {
            setSending(false)
        }
    }, [httpClient, userId, channel, t])

    const handleVerifyOtp = useCallback(async () => {
        if (!userId) {
            setError(t('otp.userIdRequired'))
            return
        }

        if (otpCode.length < 4) {
            setError(t('otp.codeTooShort'))
            return
        }

        setVerifying(true)
        setError(null)
        setSuccess(null)
        try {
            const response = await httpClient.post<OtpVerifyResponse>(
                `/otp/${channel}/verify/${userId}`,
                { code: otpCode },
            )
            if (response.data.success !== false) {
                setVerified(true)
                setSuccess(response.data.message || t('otp.verifySuccess'))
            } else {
                setError(response.data.message || t('otp.verifyFailed'))
            }
        } catch (err) {
            setError(getErrorMessage(err, t, t('otp.verifyFailed')))
        } finally {
            setVerifying(false)
        }
    }, [httpClient, userId, channel, otpCode, t])

    const handleClose = useCallback(() => {
        handleReset()
        onClose()
    }, [onClose, handleReset])

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Email color="primary" />
                {t('otp.title')}
            </DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {t('otp.description')}
                </Typography>

                <Tabs
                    value={channel}
                    onChange={handleChannelChange}
                    sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
                >
                    <Tab
                        icon={<Email />}
                        iconPosition="start"
                        label={t('otp.emailTab')}
                        value="email"
                    />
                    <Tab
                        icon={<Sms />}
                        iconPosition="start"
                        label={t('otp.smsTab')}
                        value="sms"
                    />
                </Tabs>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}

                {success && (
                    <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
                        {success}
                    </Alert>
                )}

                {verified ? (
                    <Box sx={{ textAlign: 'center', py: 3 }}>
                        <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                        <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                            {t('otp.verified')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {t('otp.verifiedDescription', { channel: channel === 'email' ? t('otp.emailTab') : t('otp.smsTab') })}
                        </Typography>
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {!otpSent ? (
                            <Box sx={{ textAlign: 'center', py: 2 }}>
                                {channel === 'email' ? (
                                    <Email sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                                ) : (
                                    <Sms sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                                )}
                                <Typography variant="body1" sx={{ mb: 2 }}>
                                    {channel === 'email' ? t('otp.sendEmailPrompt') : t('otp.sendSmsPrompt')}
                                </Typography>
                                <Button
                                    variant="contained"
                                    onClick={handleSendOtp}
                                    disabled={sending}
                                    startIcon={sending ? <CircularProgress size={16} /> : <Send />}
                                    sx={{
                                        borderRadius: '12px',
                                        py: 1.5,
                                        px: 4,
                                    }}
                                >
                                    {t('otp.sendCode')}
                                </Button>
                            </Box>
                        ) : (
                            <Box sx={{ textAlign: 'center', py: 2 }}>
                                <Typography variant="body2" sx={{ mb: 2 }}>
                                    {t('otp.enterCode')}
                                </Typography>
                                <TextField
                                    value={otpCode}
                                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
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
                                <Box sx={{ mt: 2 }}>
                                    <Button
                                        variant="text"
                                        size="small"
                                        onClick={handleSendOtp}
                                        disabled={sending}
                                    >
                                        {t('otp.resendCode')}
                                    </Button>
                                </Box>
                            </Box>
                        )}
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>
                    {verified ? t('otp.close') : t('common.cancel')}
                </Button>
                {otpSent && !verified && (
                    <Button
                        variant="contained"
                        onClick={handleVerifyOtp}
                        disabled={verifying || otpCode.length < 4}
                        startIcon={verifying ? <CircularProgress size={16} /> : undefined}
                    >
                        {t('otp.verifyCode')}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    )
}
