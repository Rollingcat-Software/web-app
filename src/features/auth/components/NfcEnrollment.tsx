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
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'

interface NfcEnrollmentProps {
    open: boolean
    onClose: () => void
    onSuccess: () => void
    userId: string
}

const steps = ['Scan Card', 'Register', 'Complete']

export default function NfcEnrollment({ open, onClose, onSuccess, userId }: NfcEnrollmentProps) {
    const httpClient = useService<IHttpClient>(TYPES.HttpClient)
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
                setError('Failed to read NFC card. Please try again.')
                setScanning(false)
            }, { once: true })
        } catch (err) {
            setScanning(false)
            if (err instanceof DOMException && err.name === 'NotAllowedError') {
                setError('NFC permission denied. Please allow NFC access in your browser settings.')
            } else if (err instanceof DOMException && err.name === 'NotSupportedError') {
                setError('NFC is not supported on this device or browser.')
                setNfcSupported(false)
            } else {
                setError('Failed to start NFC scan. Make sure NFC is enabled on your device.')
            }
        }
    }, [])

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
                setError(response.data.message || 'Failed to register NFC card')
                setActiveStep(0)
            }
        } catch (err) {
            const axiosErr = err as { response?: { status?: number; data?: { message?: string } } }
            if (axiosErr.response?.status === 409) {
                // Card already enrolled — check whose it is
                try {
                    const verifyRes = await httpClient.post<Record<string, unknown>>('/nfc/verify', { cardSerial })
                    setCardInfo({
                        enrolled: true,
                        message: 'This card is already enrolled.',
                        data: verifyRes.data,
                    })
                } catch {
                    setCardInfo({ enrolled: true, message: 'This card is already enrolled.' })
                }
            } else {
                setError(err instanceof Error ? err.message : 'Failed to register NFC card')
            }
            setActiveStep(0)
        } finally {
            setLoading(false)
        }
    }, [httpClient, userId, cardSerial, cardLabel, onSuccess])

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
                Register NFC Document
            </DialogTitle>
            <DialogContent>
                {!nfcSupported ? (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                        Web NFC is not supported in this browser. NFC enrollment requires
                        <strong> Chrome on Android</strong>. Desktop browsers, iOS Safari, Firefox,
                        and Brave do not support the Web NFC API.
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
                                                Waiting for NFC card...
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                Hold your NFC card (ID, passport, or access card) against the back of your phone
                                            </Typography>
                                        </>
                                    ) : cardSerial ? (
                                        <>
                                            <Typography variant="h6" fontWeight={600} color="success.main">
                                                Card Detected!
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                Serial: <strong>{cardSerial}</strong>
                                            </Typography>
                                        </>
                                    ) : (
                                        <>
                                            <Typography variant="body1" sx={{ mb: 1 }}>
                                                Register an NFC-enabled card for identity verification.
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Supported: National ID cards, passports, access cards with NFC chips.
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
                                        {scanning ? 'Scanning...' : 'Start NFC Scan'}
                                    </Button>
                                )}

                                {cardSerial && (
                                    <>
                                        <TextField
                                            fullWidth
                                            label="Card Label (optional)"
                                            value={cardLabel}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCardLabel(e.target.value)}
                                            placeholder="e.g., My National ID, Office Badge"
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
                                            {loading ? 'Registering...' : 'Register Card'}
                                        </Button>
                                    </>
                                )}

                                {cardInfo && (
                                    <Alert severity={cardInfo.enrolled ? 'info' : 'success'} sx={{ mt: 2 }}>
                                        <Typography variant="body2" fontWeight={600}>
                                            {cardInfo.message}
                                        </Typography>
                                        {cardInfo.data && (
                                            <Box sx={{ mt: 1 }}>
                                                {cardInfo.data.userName ? (
                                                    <Typography variant="body2">
                                                        Owner: {String(cardInfo.data.userName)}
                                                    </Typography>
                                                ) : null}
                                                {cardInfo.data.email ? (
                                                    <Typography variant="body2">
                                                        Email: {String(cardInfo.data.email)}
                                                    </Typography>
                                                ) : null}
                                                {cardInfo.data.cardType ? (
                                                    <Typography variant="body2">
                                                        Card Type: {String(cardInfo.data.cardType)}
                                                    </Typography>
                                                ) : null}
                                            </Box>
                                        )}
                                    </Alert>
                                )}

                                <Alert severity="info" sx={{ mt: 2 }}>
                                    Make sure NFC is enabled in your phone settings. Hold the card flat against the
                                    back of your phone near the NFC antenna (usually top-center). Note: Turkish
                                    National ID cards (TC Kimlik) and passports use encrypted NFC chips that cannot
                                    be read by browsers — only student IDs, access cards, and other NDEF-compatible
                                    NFC cards are supported.
                                </Alert>
                            </Box>
                        )}

                        {activeStep === 1 && (
                            <Box sx={{ textAlign: 'center', py: 3 }}>
                                <CircularProgress size={48} sx={{ mb: 2 }} />
                                <Typography variant="h6" fontWeight={600}>
                                    Registering Card...
                                </Typography>
                            </Box>
                        )}

                        {activeStep === 2 && (
                            <Box sx={{ textAlign: 'center', py: 3 }}>
                                <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                                <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                                    NFC Card Registered!
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Your NFC card has been enrolled. You can now use it for identity verification.
                                </Typography>
                            </Box>
                        )}
                    </>
                )}
            </DialogContent>
            <DialogActions>
                {activeStep < 2 && <Button onClick={onClose}>Cancel</Button>}
                {activeStep === 2 && <Button onClick={onClose}>Done</Button>}
            </DialogActions>
        </Dialog>
    )
}
