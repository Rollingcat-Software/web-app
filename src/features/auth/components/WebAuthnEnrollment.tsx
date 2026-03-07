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
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'

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
    createdAt: string
    lastUsedAt: string
}

const steps = ['Register Key', 'Verify', 'Complete']

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
}

export default function WebAuthnEnrollment({
    open,
    onClose,
    onSuccess,
    userId,
    mode = 'hardware-key',
}: WebAuthnEnrollmentProps) {
    const httpClient = useService<IHttpClient>(TYPES.HttpClient)
    const [activeStep, setActiveStep] = useState(0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [deviceName, setDeviceName] = useState('')
    const [credentials, setCredentials] = useState<WebAuthnCredential[]>([])
    const [loadingCredentials, setLoadingCredentials] = useState(false)

    const isPlatform = mode === 'platform'
    const title = isPlatform ? 'Register Fingerprint / Biometric' : 'Register Hardware Security Key'
    const icon = isPlatform ? <Fingerprint sx={{ fontSize: 28, color: 'white' }} /> : <Key sx={{ fontSize: 28, color: 'white' }} />

    const loadCredentials = useCallback(async () => {
        setLoadingCredentials(true)
        try {
            const response = await httpClient.get<WebAuthnCredential[]>(`/webauthn/credentials/${userId}`)
            setCredentials(response.data)
        } catch {
            // Silently fail - credentials list is optional
        } finally {
            setLoadingCredentials(false)
        }
    }, [httpClient, userId])

    useEffect(() => {
        if (open) {
            loadCredentials()
        }
        return () => {
            setActiveStep(0)
            setError(null)
            setDeviceName('')
        }
    }, [open, loadCredentials])

    const handleRegister = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            if (!window.PublicKeyCredential) {
                setError('WebAuthn is not supported in this browser.')
                setLoading(false)
                return
            }

            if (isPlatform) {
                const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
                if (!available) {
                    setError('No platform authenticator (fingerprint/biometric) available on this device.')
                    setLoading(false)
                    return
                }
            }

            // Step 1: Get registration options from backend
            const optionsResponse = await httpClient.post<{
                sessionId: string
                challenge: string
                rpId: string
                rpName: string
                userId: string
                userName: string
                excludeCredentials: string[]
            }>(`/webauthn/register/options/${userId}`, {})

            const options = optionsResponse.data
            const challengeBytes = Uint8Array.from(atob(options.challenge), (c) => c.charCodeAt(0))

            // Step 2: Create credential via browser WebAuthn API
            const excludeCredentials = options.excludeCredentials.map((id) => ({
                type: 'public-key' as const,
                id: Uint8Array.from(atob(id), (c) => c.charCodeAt(0)),
            }))

            const credential = await navigator.credentials.create({
                publicKey: {
                    challenge: challengeBytes,
                    rp: {
                        name: options.rpName || 'Fivucsas Identity',
                        id: options.rpId,
                    },
                    user: {
                        id: Uint8Array.from(options.userId, (c) => c.charCodeAt(0)),
                        name: options.userName,
                        displayName: options.userName,
                    },
                    pubKeyCredParams: [
                        { type: 'public-key', alg: -7 },   // ES256
                        { type: 'public-key', alg: -257 },  // RS256
                    ],
                    authenticatorSelection: {
                        authenticatorAttachment: isPlatform ? 'platform' : 'cross-platform',
                        requireResidentKey: false,
                        userVerification: 'preferred',
                    },
                    excludeCredentials,
                    attestation: 'direct',
                    timeout: 60000,
                },
            })

            if (!credential || !('response' in credential)) {
                setError('Failed to create credential. Please try again.')
                setLoading(false)
                return
            }

            setActiveStep(1)

            // Step 3: Send attestation to backend for verification
            const attestationResponse = credential.response as AuthenticatorAttestationResponse
            const publicKeyBytes = attestationResponse.getPublicKey?.()

            const registrationData = {
                userId: options.userId,
                sessionId: options.sessionId,
                credentialId: credential.id,
                publicKey: publicKeyBytes ? arrayBufferToBase64(publicKeyBytes) : arrayBufferToBase64(attestationResponse.attestationObject),
                clientDataJSON: arrayBufferToBase64(attestationResponse.clientDataJSON),
                attestationFormat: 'packed',
                transports: (credential as PublicKeyCredential).response
                    ? 'internal'
                    : 'usb',
                deviceName: deviceName || (isPlatform ? 'Platform Authenticator' : 'Security Key'),
            }

            const verifyResponse = await httpClient.post<{ success: boolean; message: string }>(
                '/webauthn/register/verify',
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
            if (err instanceof DOMException && err.name === 'NotAllowedError') {
                setError('Registration was cancelled or timed out. Please try again.')
            } else if (err instanceof DOMException && err.name === 'InvalidStateError') {
                setError('This authenticator is already registered.')
            } else {
                setError(err instanceof Error ? err.message : 'Failed to register credential')
            }
            setActiveStep(0)
        } finally {
            setLoading(false)
        }
    }, [httpClient, userId, deviceName, isPlatform, loadCredentials, onSuccess])

    const handleDeleteCredential = useCallback(async (credentialId: string) => {
        try {
            await httpClient.delete(`/webauthn/credentials/${credentialId}`)
            await loadCredentials()
        } catch {
            setError('Failed to delete credential')
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
                                    ? 'Register your device biometric (fingerprint, face, or PIN) for passwordless authentication.'
                                    : 'Register a FIDO2/WebAuthn hardware security key for strong two-factor authentication.'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                {isPlatform
                                    ? 'Uses your device\'s built-in authenticator (Touch ID, Windows Hello, etc.)'
                                    : 'Insert your security key (YubiKey, Titan, etc.) and click Register.'}
                            </Typography>
                        </Box>

                        <TextField
                            fullWidth
                            label="Device Name (optional)"
                            value={deviceName}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeviceName(e.target.value)}
                            placeholder={isPlatform ? 'e.g., MacBook Pro Touch ID' : 'e.g., YubiKey 5'}
                            sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                        />

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
                            {loading ? 'Waiting for authenticator...' : 'Register Authenticator'}
                        </Button>
                    </Box>
                )}

                {activeStep === 1 && (
                    <Box sx={{ textAlign: 'center', py: 3 }}>
                        <CircularProgress size={48} sx={{ mb: 2 }} />
                        <Typography variant="h6" fontWeight={600}>
                            Verifying Registration...
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Please wait while we verify your credential with the server.
                        </Typography>
                    </Box>
                )}

                {activeStep === 2 && (
                    <Box sx={{ textAlign: 'center', py: 3 }}>
                        <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                        <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                            Registration Complete!
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {isPlatform
                                ? 'Your device biometric has been registered. You can now use it for authentication.'
                                : 'Your security key has been registered. You can now use it for authentication.'}
                        </Typography>
                    </Box>
                )}

                {/* Existing credentials list */}
                {credentials.length > 0 && activeStep === 0 && (
                    <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                            Registered Credentials ({credentials.length})
                        </Typography>
                        <List dense>
                            {credentials.map((cred) => (
                                <ListItem key={cred.id} sx={{ borderRadius: '8px', mb: 0.5 }}>
                                    <ListItemIcon>
                                        <Key fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={cred.deviceName}
                                        secondary={`Added ${new Date(cred.createdAt).toLocaleDateString()}`}
                                    />
                                    <ListItemSecondaryAction>
                                        <IconButton
                                            edge="end"
                                            size="small"
                                            onClick={() => handleDeleteCredential(cred.credentialId)}
                                        >
                                            <Delete fontSize="small" />
                                        </IconButton>
                                    </ListItemSecondaryAction>
                                </ListItem>
                            ))}
                        </List>
                        {loadingCredentials && <CircularProgress size={20} sx={{ display: 'block', mx: 'auto' }} />}
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                {activeStep < 2 && (
                    <Button onClick={handleClose}>Cancel</Button>
                )}
                {activeStep === 2 && (
                    <Button onClick={handleClose}>Done</Button>
                )}
            </DialogActions>
        </Dialog>
    )
}
