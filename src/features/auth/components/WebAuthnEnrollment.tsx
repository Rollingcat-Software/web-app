import { useState, useCallback, useEffect } from 'react'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    ListItemSecondaryAction,
    Step,
    StepLabel,
    Stepper,
    TextField,
    Typography,
} from '@mui/material'
import { Key, CheckCircle, Delete, UsbOutlined, Fingerprint } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import { WEBAUTHN, AUTH_API } from '../constants'
import { base64urlToBytes, bytesToBase64url, mapWebAuthnError } from '../webauthn-utils'

interface WebAuthnEnrollmentProps {
    open: boolean
    onClose: () => void
    onSuccess: () => void
    userId: string
    mode?: 'hardware-key' | 'platform'
}

interface WebAuthnCredential {
    id: string
    credentialId: string
    deviceName: string
    transports: string
    createdAt: string
    lastUsedAt: string
}

interface RegistrationOptions {
    sessionId: string
    challenge: string
    rpId: string
    rpName: string
    userId: string
    userName: string
    excludeCredentials: string[]
}

// base64url utilities imported from webauthn-utils

export default function WebAuthnEnrollment({
    open,
    onClose,
    onSuccess,
    userId,
    mode = 'hardware-key',
}: WebAuthnEnrollmentProps) {
    const { t } = useTranslation()
    const httpClient = useService<IHttpClient>(TYPES.HttpClient)
    const [activeStep, setActiveStep] = useState(0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [deviceName, setDeviceName] = useState('')
    const [credentials, setCredentials] = useState<WebAuthnCredential[]>([])
    const [loadingCredentials, setLoadingCredentials] = useState(false)
    const [webAuthnSupported, setWebAuthnSupported] = useState(true)

    const isPlatform = mode === WEBAUTHN.ATTACHMENT_PLATFORM
    const title = isPlatform ? t('webauthn.enrollment.registerFingerprint') : t('webauthn.enrollment.registerHardwareKey')
    const icon = isPlatform ? <Fingerprint sx={{ fontSize: 28, color: 'white' }} /> : <Key sx={{ fontSize: 28, color: 'white' }} />

    // Check WebAuthn support on mount
    useEffect(() => {
        if (!window.PublicKeyCredential) {
            setWebAuthnSupported(false)
        }
    }, [])

    const loadCredentials = useCallback(async () => {
        if (!userId) return
        setLoadingCredentials(true)
        try {
            const response = await httpClient.get<WebAuthnCredential[]>(AUTH_API.WEBAUTHN_CREDENTIALS(userId))
            setCredentials(response.data)
        } catch {
            // Silently fail - credentials list is optional
        } finally {
            setLoadingCredentials(false)
        }
    }, [httpClient, userId])

    useEffect(() => {
        if (open && userId) {
            loadCredentials()
        }
        return () => {
            setActiveStep(0)
            setError(null)
            setDeviceName('')
        }
    }, [open, userId, loadCredentials])

    const handleRegister = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            if (!window.PublicKeyCredential) {
                setError(t('webauthn.errors.notSupported'))
                setLoading(false)
                return
            }

            if (isPlatform) {
                try {
                    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
                    if (!available) {
                        setError(t('webauthn.enrollment.noPlatformAuthenticator'))
                        setLoading(false)
                        return
                    }
                } catch {
                    // Brave throws here — proceed anyway and let WebAuthn prompt the user
                }
            }

            // Step 1: Get registration options from backend
            const optionsResponse = await httpClient.post<RegistrationOptions>(
                AUTH_API.WEBAUTHN_REGISTER_OPTIONS(userId),
                {},
            )

            const options = optionsResponse.data

            // Backend sends challenge as base64url (no padding)
            const challengeBytes = base64urlToBytes(options.challenge)

            // Step 2: Build exclude credentials list (credential IDs are base64url)
            const excludeCredentials: PublicKeyCredentialDescriptor[] = (options.excludeCredentials || []).map((id) => ({
                type: 'public-key' as const,
                id: base64urlToBytes(id).buffer as ArrayBuffer,
            }))

            // Step 3: Create credential via browser WebAuthn API
            const credential = (await navigator.credentials.create({
                publicKey: {
                    challenge: challengeBytes.buffer as ArrayBuffer,
                    rp: {
                        name: options.rpName || 'Fivucsas Identity',
                        id: options.rpId,
                    },
                    user: {
                        id: new TextEncoder().encode(options.userId).buffer as ArrayBuffer,
                        name: options.userName,
                        displayName: options.userName,
                    },
                    pubKeyCredParams: [
                        { type: WEBAUTHN.CREDENTIAL_TYPE, alg: WEBAUTHN.ALG_ES256 },
                        { type: WEBAUTHN.CREDENTIAL_TYPE, alg: WEBAUTHN.ALG_RS256 },
                    ],
                    authenticatorSelection: {
                        authenticatorAttachment: isPlatform ? WEBAUTHN.ATTACHMENT_PLATFORM : WEBAUTHN.ATTACHMENT_CROSS_PLATFORM,
                        requireResidentKey: false,
                        userVerification: WEBAUTHN.UV_PREFERRED,
                    },
                    excludeCredentials,
                    attestation: WEBAUTHN.ATTESTATION_DIRECT,
                    timeout: WEBAUTHN.TIMEOUT_MS,
                },
            })) as PublicKeyCredential | null

            if (!credential) {
                setError(t('webauthn.enrollment.failedToCreate'))
                setLoading(false)
                return
            }

            setActiveStep(1)

            // Step 4: Encode attestation response for backend
            const attestationResponse = credential.response as AuthenticatorAttestationResponse

            // Try to get the raw public key via getPublicKey() (supported in most modern browsers)
            const publicKeyBytes = attestationResponse.getPublicKey?.()

            // Determine actual transports from the authenticator response
            let transports: string = isPlatform ? WEBAUTHN.TRANSPORT_INTERNAL : WEBAUTHN.TRANSPORT_USB
            if (typeof attestationResponse.getTransports === 'function') {
                const reportedTransports = attestationResponse.getTransports()
                if (reportedTransports.length > 0) {
                    transports = reportedTransports.join(',')
                }
            }

            // Build registration payload with base64url encoding (matching backend expectations)
            const registrationData = {
                userId: options.userId,
                sessionId: options.sessionId,
                credentialId: credential.id, // Already base64url from the browser
                publicKey: publicKeyBytes
                    ? bytesToBase64url(publicKeyBytes)
                    : bytesToBase64url(attestationResponse.attestationObject),
                clientDataJSON: bytesToBase64url(attestationResponse.clientDataJSON),
                attestationFormat: WEBAUTHN.FORMAT_PACKED,
                transports,
                deviceName: deviceName || t(isPlatform ? WEBAUTHN.DEVICE_NAME_PLATFORM : WEBAUTHN.DEVICE_NAME_KEY),
            }

            // Step 5: Send to backend for verification
            const verifyResponse = await httpClient.post<{ success: boolean; message: string }>(
                AUTH_API.WEBAUTHN_REGISTER_VERIFY,
                registrationData,
            )

            if (verifyResponse.data.success) {
                setActiveStep(2)
                await loadCredentials()
                setTimeout(() => {
                    onSuccess()
                }, 2000)
            } else {
                setError(verifyResponse.data.message || 'Registration verification failed')
                setActiveStep(0)
            }
        } catch (err) {
            const mapped = mapWebAuthnError(err, t)
            setError(mapped || t('webauthn.enrollment.failedToRegister'))
            setActiveStep(0)
        } finally {
            setLoading(false)
        }
    }, [httpClient, userId, deviceName, isPlatform, loadCredentials, onSuccess])

    const handleDeleteCredential = useCallback(async (id: string) => {
        try {
            await httpClient.delete(AUTH_API.WEBAUTHN_CREDENTIAL_BY_ID(id))
            await loadCredentials()
        } catch {
            setError(t('webauthn.enrollment.failedToDelete'))
        }
    }, [httpClient, loadCredentials])

    const handleClose = useCallback(() => {
        setActiveStep(0)
        setError(null)
        setDeviceName('')
        onClose()
    }, [onClose])

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                    sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '10px',
                        background: isPlatform
                            ? 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)'
                            : 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    {icon}
                </Box>
                {title}
            </DialogTitle>
            <DialogContent>
                {!webAuthnSupported ? (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                        {t('webauthn.errors.notSupported')}
                    </Alert>
                ) : (
                    <>
                        <Stepper activeStep={activeStep} sx={{ mb: 3, mt: 1 }}>
                            {[t('webauthn.enrollment.steps.register'), t('webauthn.enrollment.steps.verify'), t('webauthn.enrollment.steps.complete')].map((label) => (
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
                                            borderRadius: '20px',
                                            background: isPlatform
                                                ? 'rgba(139, 92, 246, 0.08)'
                                                : 'rgba(245, 158, 11, 0.08)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            mx: 'auto',
                                            mb: 2,
                                        }}
                                    >
                                        {isPlatform ? (
                                            <Fingerprint sx={{ fontSize: 48, color: 'primary.main' }} />
                                        ) : (
                                            <UsbOutlined sx={{ fontSize: 48, color: 'warning.main' }} />
                                        )}
                                    </Box>
                                    <Typography variant="body1" sx={{ mb: 1 }}>
                                        {isPlatform
                                            ? t('webauthn.enrollment.platformDescription')
                                            : t('webauthn.enrollment.hardwareKeyDescription')}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                        {isPlatform
                                            ? t('webauthn.enrollment.platformHint')
                                            : t('webauthn.enrollment.hardwareKeyHint')}
                                    </Typography>
                                </Box>

                                <TextField
                                    fullWidth
                                    label={t('webauthn.enrollment.deviceNameLabel')}
                                    value={deviceName}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeviceName(e.target.value)}
                                    placeholder={isPlatform ? t('webauthn.enrollment.deviceNamePlaceholderPlatform') : t('webauthn.enrollment.deviceNamePlaceholderKey')}
                                    InputLabelProps={{ shrink: true }}
                                    sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                                />

                                {!isPlatform && (
                                    <Alert severity="info" sx={{ mb: 3 }}>
                                        {t('webauthn.enrollment.hardwareKeyInfo')}
                                    </Alert>
                                )}

                                <Button
                                    fullWidth
                                    variant="contained"
                                    size="large"
                                    onClick={handleRegister}
                                    disabled={loading}
                                    startIcon={loading ? <CircularProgress size={16} /> : undefined}
                                    sx={{
                                        py: 1.5,
                                        borderRadius: '12px',
                                        fontWeight: 600,
                                        background: isPlatform
                                            ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                                            : 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
                                        '&:hover': {
                                            background: isPlatform
                                                ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)'
                                                : 'linear-gradient(135deg, #d97706 0%, #dc2626 100%)',
                                        },
                                    }}
                                >
                                    {loading ? t('webauthn.enrollment.waitingForAuthenticator') : t('webauthn.enrollment.registerButton')}
                                </Button>
                            </Box>
                        )}

                        {activeStep === 1 && (
                            <Box sx={{ textAlign: 'center', py: 3 }}>
                                <CircularProgress size={48} sx={{ mb: 2 }} />
                                <Typography variant="h6" fontWeight={600}>
                                    {t('webauthn.enrollment.verifying')}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {t('webauthn.enrollment.verifyingHint')}
                                </Typography>
                            </Box>
                        )}

                        {activeStep === 2 && (
                            <Box sx={{ textAlign: 'center', py: 3 }}>
                                <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                                <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                                    {t('webauthn.enrollment.complete')}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    {isPlatform
                                        ? t('webauthn.enrollment.completePlatformHint')
                                        : t('webauthn.enrollment.completeHardwareKeyHint')}
                                </Typography>
                                <Alert severity="success" variant="outlined" sx={{ textAlign: 'left' }}>
                                    <Typography variant="body2">
                                        {t('webauthn.enrollment.howToVerify', {
                                            method: isPlatform ? t('mfa.fingerprint.title') : t('mfa.hardwareKey.title'),
                                            device: isPlatform ? 'Touch ID, Windows Hello' : t('webauthn.defaultDeviceKey'),
                                        })}
                                    </Typography>
                                </Alert>
                            </Box>
                        )}

                        {/* Existing credentials list — filtered by transport type */}
                        {(() => {
                            const filtered = credentials.filter((c) => {
                                const tr = (c.transports || '').toLowerCase()
                                if (isPlatform) return tr.includes(WEBAUTHN.TRANSPORT_INTERNAL) || tr.includes(WEBAUTHN.TRANSPORT_HYBRID) || tr === ''
                                return tr.includes(WEBAUTHN.TRANSPORT_USB) || tr.includes(WEBAUTHN.TRANSPORT_BLE) || tr.includes(WEBAUTHN.TRANSPORT_NFC)
                            })
                            return filtered.length > 0 && activeStep === 0 ? (
                            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                                    {t('webauthn.enrollment.registeredCredentials', { count: filtered.length })}
                                </Typography>
                                <List dense>
                                    {filtered.map((cred) => (
                                        <ListItem key={cred.id} sx={{ borderRadius: '8px', mb: 0.5 }}>
                                            <ListItemIcon>
                                                <Key fontSize="small" />
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={cred.deviceName}
                                                secondary={`Added ${new Date(cred.createdAt).toLocaleDateString()}${cred.lastUsedAt && cred.lastUsedAt !== 'Never' ? ` \u2022 Last used ${new Date(cred.lastUsedAt).toLocaleDateString()}` : ''}`}
                                            />
                                            <ListItemSecondaryAction>
                                                <IconButton
                                                    edge="end"
                                                    size="small"
                                                    onClick={() => handleDeleteCredential(cred.id)}
                                                    aria-label={t('common.aria.delete')}
                                                >
                                                    <Delete fontSize="small" />
                                                </IconButton>
                                            </ListItemSecondaryAction>
                                        </ListItem>
                                    ))}
                                </List>
                                {loadingCredentials && <CircularProgress size={20} sx={{ display: 'block', mx: 'auto' }} />}
                            </Box>
                            ) : null
                        })()}
                    </>
                )}
            </DialogContent>
            <DialogActions>
                {activeStep < 2 && (
                    <Button onClick={handleClose}>{t('webauthn.enrollment.cancel')}</Button>
                )}
                {activeStep === 2 && (
                    <Button onClick={handleClose}>{t('webauthn.enrollment.done')}</Button>
                )}
            </DialogActions>
        </Dialog>
    )
}
