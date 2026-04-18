import { useState, useCallback, useEffect, useRef } from 'react'
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
import { CheckCircle, Nfc } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import { formatApiError } from '@utils/formatApiError'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'

interface NfcEnrollmentProps {
    open: boolean
    onClose: () => void
    onSuccess: () => void
    userId: string
}

export default function NfcEnrollment({ open, onClose, onSuccess, userId }: NfcEnrollmentProps) {
    const { t } = useTranslation()
    const httpClient = useService<IHttpClient>(TYPES.HttpClient)
    const steps = [t('nfcEnroll.stepScan'), t('nfcEnroll.stepRegister'), t('nfcEnroll.stepComplete')]
    const [activeStep, setActiveStep] = useState(0)
    const [loading, setLoading] = useState(false)
    const [scanning, setScanning] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [cardSerial, setCardSerial] = useState('')
    const [cardLabel, setCardLabel] = useState('')
    const [nfcSupported, setNfcSupported] = useState(true)
    const [cardInfo, setCardInfo] = useState<{ enrolled: boolean; message: string; data?: Record<string, unknown> } | null>(null)
    const abortRef = useRef<AbortController | null>(null)

    useEffect(() => {
        setNfcSupported('NDEFReader' in window)
    }, [])

    useEffect(() => {
        if (!open) {
            setActiveStep(0)
            setError(null)
            setCardSerial('')
            setCardLabel('')
            setCardInfo(null)
            setScanning(false)
            if (abortRef.current) {
                abortRef.current.abort()
                abortRef.current = null
            }
        }
    }, [open])

    const startNfcScan = useCallback(async () => {
        setError(null)
        setScanning(true)

        try {
            // @ts-expect-error NDEFReader is not in TS lib types
            const ndef = new NDEFReader()
            const controller = new AbortController()
            abortRef.current = controller

            await ndef.scan({ signal: controller.signal })

            ndef.addEventListener('reading', ({ serialNumber }: { serialNumber: string }) => {
                setCardSerial(serialNumber || 'unknown')
                setScanning(false)
                if (abortRef.current) {
                    abortRef.current.abort()
                    abortRef.current = null
                }
            }, { once: true })

            ndef.addEventListener('readingerror', () => {
                setError(t('nfcEnroll.readError'))
                setScanning(false)
            }, { once: true })
        } catch (err) {
            setScanning(false)
            if (err instanceof DOMException && err.name === 'NotAllowedError') {
                setError(t('nfcEnroll.permissionDenied'))
            } else if (err instanceof DOMException && err.name === 'NotSupportedError') {
                setError(t('nfcEnroll.notSupported'))
                setNfcSupported(false)
            } else {
                setError(t('nfcEnroll.scanFailed'))
            }
        }
    }, [t])

    const handleRegister = useCallback(async () => {
        if (!cardSerial) return
        setLoading(true)
        setError(null)
        setActiveStep(1)

        try {
            const response = await httpClient.post<{ success: boolean; message: string }>('/nfc/enroll', {
                userId,
                cardSerial,
                cardType: 'NFC_CARD',
                label: cardLabel || undefined,
            })

            if (response.data.success) {
                setActiveStep(2)
                setTimeout(() => onSuccess(), 2000)
            } else {
                setError(response.data.message || t('nfcEnroll.registerFailed'))
                setActiveStep(0)
            }
        } catch (err) {
            const axiosErr = err as { response?: { status?: number; data?: { message?: string } } }
            if (axiosErr.response?.status === 409) {
                // Card already in DB — check if it belongs to this user
                try {
                    const verifyRes = await httpClient.post<Record<string, unknown>>('/nfc/verify', { cardSerial })
                    const verifyData = verifyRes.data
                    if (verifyData?.userId === userId) {
                        // This user's card is already enrolled in identity-core — just complete
                        onSuccess()
                        return
                    }
                    setCardInfo({
                        enrolled: true,
                        message: t('nfcEnroll.alreadyEnrolledOther'),
                        data: verifyData,
                    })
                } catch {
                    setCardInfo({ enrolled: true, message: t('nfcEnroll.alreadyEnrolled') })
                }
            } else {
                setError(formatApiError(err, t))
            }
            setActiveStep(0)
        } finally {
            setLoading(false)
        }
    }, [httpClient, userId, cardSerial, cardLabel, onSuccess, t])

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                    sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Nfc sx={{ fontSize: 24, color: 'white' }} />
                </Box>
                {t('nfcEnroll.title')}
            </DialogTitle>
            <DialogContent>
                {!nfcSupported ? (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                        {t('nfcEnroll.browserNotSupported')}
                    </Alert>
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
                            <Box sx={{ py: 2 }}>
                                <Box sx={{ textAlign: 'center', mb: 3 }}>
                                    <Box
                                        sx={{
                                            width: 80,
                                            height: 80,
                                            borderRadius: '50%',
                                            background: scanning
                                                ? 'rgba(124, 58, 237, 0.15)'
                                                : 'rgba(124, 58, 237, 0.08)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            mx: 'auto',
                                            mb: 2,
                                            transition: 'all 0.3s',
                                            animation: scanning ? 'pulse 1.5s infinite' : 'none',
                                            '@keyframes pulse': {
                                                '0%': { boxShadow: '0 0 0 0 rgba(124, 58, 237, 0.4)' },
                                                '70%': { boxShadow: '0 0 0 20px rgba(124, 58, 237, 0)' },
                                                '100%': { boxShadow: '0 0 0 0 rgba(124, 58, 237, 0)' },
                                            },
                                        }}
                                    >
                                        <Nfc sx={{ fontSize: 48, color: scanning ? 'primary.main' : 'text.disabled' }} />
                                    </Box>

                                    {scanning ? (
                                        <>
                                            <Typography variant="h6" fontWeight={600}>
                                                {t('nfcEnroll.waiting')}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                {t('nfcEnroll.holdCard')}
                                            </Typography>
                                        </>
                                    ) : cardSerial ? (
                                        <>
                                            <Typography variant="h6" fontWeight={600} color="success.main">
                                                {t('nfcEnroll.cardDetected')}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                Serial: <strong>{cardSerial}</strong>
                                            </Typography>
                                        </>
                                    ) : (
                                        <>
                                            <Typography variant="body1" sx={{ mb: 1 }}>
                                                {t('nfcEnroll.registerDescription')}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {t('nfcEnroll.supportedCards')}
                                            </Typography>
                                        </>
                                    )}
                                </Box>

                                {!cardSerial && (
                                    <Button
                                        fullWidth
                                        variant="contained"
                                        size="large"
                                        onClick={startNfcScan}
                                        disabled={scanning}
                                        startIcon={scanning ? <CircularProgress size={16} color="inherit" /> : <Nfc />}
                                        sx={{
                                            py: 1.5,
                                            borderRadius: '12px',
                                            fontWeight: 600,
                                            background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                                            '&:hover': {
                                                background: 'linear-gradient(135deg, #6d28d9 0%, #4338ca 100%)',
                                            },
                                            mb: 2,
                                        }}
                                    >
                                        {scanning ? t('nfcEnroll.scanning') : t('nfcEnroll.startScan')}
                                    </Button>
                                )}

                                {cardSerial && (
                                    <>
                                        <TextField
                                            fullWidth
                                            label={t('nfcEnroll.cardLabel')}
                                            value={cardLabel}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCardLabel(e.target.value)}
                                            placeholder={t('nfcEnroll.cardLabelPlaceholder')}
                                            InputLabelProps={{ shrink: true }}
                                            sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                                        />
                                        <Button
                                            fullWidth
                                            variant="contained"
                                            size="large"
                                            onClick={handleRegister}
                                            disabled={loading}
                                            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
                                            sx={{
                                                py: 1.5,
                                                borderRadius: '12px',
                                                fontWeight: 600,
                                                background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
                                                '&:hover': {
                                                    background: 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)',
                                                },
                                            }}
                                        >
                                            {loading ? t('nfcEnroll.registering') : t('nfcEnroll.registerCard')}
                                        </Button>
                                    </>
                                )}

                                {cardInfo && (
                                    <>
                                        <Alert severity="warning" sx={{ mt: 2 }}>
                                            <Typography variant="body2" fontWeight={600}>
                                                {cardInfo.message}
                                            </Typography>
                                            {cardInfo.data && (
                                                <Box sx={{ mt: 1 }}>
                                                    {cardInfo.data.userName ? (
                                                        <Typography variant="body2">
                                                            {t('nfcEnroll.owner')}: {String(cardInfo.data.userName)}
                                                        </Typography>
                                                    ) : null}
                                                    {cardInfo.data.email ? (
                                                        <Typography variant="body2">
                                                            Email: {String(cardInfo.data.email)}
                                                        </Typography>
                                                    ) : null}
                                                </Box>
                                            )}
                                        </Alert>
                                        <Button
                                            fullWidth
                                            variant="outlined"
                                            size="small"
                                            onClick={() => { setCardInfo(null); setCardSerial(''); setError(null) }}
                                            sx={{ mt: 1, borderRadius: '10px' }}
                                        >
                                            {t('nfcEnroll.scanDifferent')}
                                        </Button>
                                    </>
                                )}

                                <Alert severity="info" sx={{ mt: 2 }}>
                                    {t('nfcEnroll.infoHint')}
                                </Alert>
                            </Box>
                        )}

                        {activeStep === 1 && (
                            <Box sx={{ textAlign: 'center', py: 3 }}>
                                <CircularProgress size={48} sx={{ mb: 2 }} />
                                <Typography variant="h6" fontWeight={600}>
                                    {t('nfcEnroll.registering')}
                                </Typography>
                            </Box>
                        )}

                        {activeStep === 2 && (
                            <Box sx={{ textAlign: 'center', py: 3 }}>
                                <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                                <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                                    {t('nfcEnroll.registered')}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {t('nfcEnroll.registeredDescription')}
                                </Typography>
                            </Box>
                        )}
                    </>
                )}
            </DialogContent>
            <DialogActions>
                {activeStep < 2 && <Button onClick={onClose}>{t('common.cancel')}</Button>}
                {activeStep === 2 && <Button onClick={onClose}>{t('nfcEnroll.done')}</Button>}
            </DialogActions>
        </Dialog>
    )
}
