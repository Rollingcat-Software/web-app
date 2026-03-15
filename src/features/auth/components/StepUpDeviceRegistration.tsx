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
    Step,
    StepLabel,
    Stepper,
    TextField,
    Typography,
} from '@mui/material'
import { PhonelinkLock, CheckCircle, DevicesOther } from '@mui/icons-material'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import { useTranslation } from 'react-i18next'

interface StepUpDeviceRegistrationProps {
    open: boolean
    userId: string
    onClose: () => void
    onSuccess: () => void
}

interface RegisterDeviceResponse {
    deviceId: string
    message: string
}

interface ChallengeResponse {
    challengeId: string
    challenge: string
    expiresAt: string
}

interface VerifyChallengeResponse {
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

export default function StepUpDeviceRegistration({ open, userId, onClose, onSuccess }: StepUpDeviceRegistrationProps) {
    const httpClient = useService<IHttpClient>(TYPES.HttpClient)
    const { t } = useTranslation()

    const [activeStep, setActiveStep] = useState(0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Step 1: Device registration
    const [deviceName, setDeviceName] = useState('')
    const [publicKey, setPublicKey] = useState('')
    const [registeredDeviceId, setRegisteredDeviceId] = useState('')

    // Step 2: Challenge verification
    const [challengeId, setChallengeId] = useState('')
    const [challenge, setChallenge] = useState('')
    const [signedChallenge, setSignedChallenge] = useState('')

    const steps = [
        t('stepUp.stepRegister'),
        t('stepUp.stepChallenge'),
        t('stepUp.stepComplete'),
    ]

    const handleReset = useCallback(() => {
        setActiveStep(0)
        setDeviceName('')
        setPublicKey('')
        setRegisteredDeviceId('')
        setChallengeId('')
        setChallenge('')
        setSignedChallenge('')
        setError(null)
    }, [])

    const handleGenerateKeyPair = useCallback(async () => {
        try {
            const keyPair = await window.crypto.subtle.generateKey(
                { name: 'ECDSA', namedCurve: 'P-256' },
                true,
                ['sign', 'verify'],
            )
            const exported = await window.crypto.subtle.exportKey('spki', keyPair.publicKey)
            const base64 = btoa(String.fromCharCode(...new Uint8Array(exported)))
            setPublicKey(base64)
        } catch {
            // Fallback: let user paste a key manually
            setError(t('stepUp.keyGenFailed'))
        }
    }, [t])

    const handleRegisterDevice = useCallback(async () => {
        if (!userId) {
            setError(t('stepUp.userIdRequired'))
            return
        }
        if (!deviceName.trim()) {
            setError(t('stepUp.deviceNameRequired'))
            return
        }
        if (!publicKey.trim()) {
            setError(t('stepUp.publicKeyRequired'))
            return
        }

        setLoading(true)
        setError(null)
        try {
            const response = await httpClient.post<RegisterDeviceResponse>(
                '/step-up/register-device',
                {
                    userId,
                    deviceName: deviceName.trim(),
                    publicKey: publicKey.trim(),
                    platform: navigator.platform || 'web',
                },
            )
            setRegisteredDeviceId(response.data.deviceId)
            setActiveStep(1)
        } catch (err) {
            setError(getErrorMessage(err, t('stepUp.registerFailed')))
        } finally {
            setLoading(false)
        }
    }, [httpClient, userId, deviceName, publicKey, t])

    const handleRequestChallenge = useCallback(async () => {
        if (!registeredDeviceId) {
            setError(t('stepUp.noDeviceRegistered'))
            return
        }

        setLoading(true)
        setError(null)
        try {
            const response = await httpClient.post<ChallengeResponse>(
                '/step-up/challenge',
                {
                    userId,
                    deviceId: registeredDeviceId,
                },
            )
            setChallengeId(response.data.challengeId)
            setChallenge(response.data.challenge)
        } catch (err) {
            setError(getErrorMessage(err, t('stepUp.challengeFailed')))
        } finally {
            setLoading(false)
        }
    }, [httpClient, userId, registeredDeviceId, t])

    const handleVerifyChallenge = useCallback(async () => {
        if (!challengeId || !signedChallenge.trim()) {
            setError(t('stepUp.signatureRequired'))
            return
        }

        setLoading(true)
        setError(null)
        try {
            const response = await httpClient.post<VerifyChallengeResponse>(
                '/step-up/verify-challenge',
                {
                    challengeId,
                    signedChallenge: signedChallenge.trim(),
                },
            )
            if (response.data.success !== false) {
                setActiveStep(2)
                setTimeout(() => {
                    onSuccess()
                    handleReset()
                }, 2000)
            } else {
                setError(response.data.message || t('stepUp.verifyFailed'))
            }
        } catch (err) {
            setError(getErrorMessage(err, t('stepUp.verifyFailed')))
        } finally {
            setLoading(false)
        }
    }, [httpClient, challengeId, signedChallenge, onSuccess, handleReset, t])

    const handleClose = useCallback(() => {
        handleReset()
        onClose()
    }, [onClose, handleReset])

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PhonelinkLock color="primary" />
                {t('stepUp.title')}
            </DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {t('stepUp.description')}
                </Typography>

                <Stepper activeStep={activeStep} sx={{ mb: 3, mt: 1 }}>
                    {steps.map((label) => (
                        <Step key={label}>
                            <StepLabel>{label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}

                {/* Step 0: Register Device */}
                {activeStep === 0 && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box sx={{ textAlign: 'center', mb: 1 }}>
                            <DevicesOther sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                        </Box>
                        <TextField
                            fullWidth
                            label={t('stepUp.deviceName')}
                            value={deviceName}
                            onChange={(e) => setDeviceName(e.target.value)}
                            placeholder={t('stepUp.deviceNamePlaceholder')}
                            disabled={loading}
                        />
                        <TextField
                            fullWidth
                            label={t('stepUp.publicKey')}
                            value={publicKey}
                            onChange={(e) => setPublicKey(e.target.value)}
                            placeholder={t('stepUp.publicKeyPlaceholder')}
                            disabled={loading}
                            multiline
                            rows={3}
                            helperText={t('stepUp.publicKeyHelper')}
                        />
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={handleGenerateKeyPair}
                            disabled={loading}
                            sx={{ alignSelf: 'flex-start' }}
                        >
                            {t('stepUp.generateKeyPair')}
                        </Button>
                    </Box>
                )}

                {/* Step 1: Request & Verify Challenge */}
                {activeStep === 1 && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Alert severity="success" sx={{ mb: 1 }}>
                            {t('stepUp.deviceRegistered', { deviceId: registeredDeviceId })}
                        </Alert>

                        {!challenge ? (
                            <Box sx={{ textAlign: 'center', py: 2 }}>
                                <Typography variant="body1" sx={{ mb: 2 }}>
                                    {t('stepUp.challengePrompt')}
                                </Typography>
                                <Button
                                    variant="contained"
                                    onClick={handleRequestChallenge}
                                    disabled={loading}
                                    startIcon={loading ? <CircularProgress size={16} /> : undefined}
                                    sx={{ borderRadius: '12px', py: 1.5, px: 4 }}
                                >
                                    {t('stepUp.requestChallenge')}
                                </Button>
                            </Box>
                        ) : (
                            <>
                                <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                                    <Typography variant="caption" color="text.secondary">
                                        {t('stepUp.challengeLabel')}
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        fontFamily="monospace"
                                        fontWeight={600}
                                        sx={{ wordBreak: 'break-all', mt: 0.5 }}
                                    >
                                        {challenge}
                                    </Typography>
                                </Box>
                                <TextField
                                    fullWidth
                                    label={t('stepUp.signedChallenge')}
                                    value={signedChallenge}
                                    onChange={(e) => setSignedChallenge(e.target.value)}
                                    placeholder={t('stepUp.signedChallengePlaceholder')}
                                    disabled={loading}
                                    multiline
                                    rows={3}
                                    helperText={t('stepUp.signedChallengeHelper')}
                                />
                            </>
                        )}
                    </Box>
                )}

                {/* Step 2: Complete */}
                {activeStep === 2 && (
                    <Box sx={{ textAlign: 'center', py: 3 }}>
                        <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                        <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                            {t('stepUp.complete')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {t('stepUp.completeDescription')}
                        </Typography>
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                {activeStep < 2 && (
                    <Button onClick={handleClose} disabled={loading}>
                        {t('common.cancel')}
                    </Button>
                )}
                {activeStep === 0 && (
                    <Button
                        variant="contained"
                        onClick={handleRegisterDevice}
                        disabled={loading || !deviceName.trim() || !publicKey.trim()}
                        startIcon={loading ? <CircularProgress size={16} /> : undefined}
                    >
                        {t('stepUp.registerDevice')}
                    </Button>
                )}
                {activeStep === 1 && challenge && (
                    <Button
                        variant="contained"
                        onClick={handleVerifyChallenge}
                        disabled={loading || !signedChallenge.trim()}
                        startIcon={loading ? <CircularProgress size={16} /> : undefined}
                    >
                        {t('stepUp.verifyChallenge')}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    )
}
