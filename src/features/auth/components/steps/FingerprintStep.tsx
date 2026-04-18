import { useState, useCallback } from 'react'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Typography,
} from '@mui/material'
import { Fingerprint, ArrowForward } from '@mui/icons-material'
import { motion, Variants } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { WEBAUTHN, EASE_OUT, ANIMATION } from '../../constants'
import { type ChallengeResponse, arrayBufferToBase64, resolveChallenge, base64urlToBytes } from '../../webauthn-utils'

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: ANIMATION.ITEM_ENTER, ease: EASE_OUT },
    },
}

interface FingerprintStepProps {
    challenge?: string
    rpId?: string
    allowCredentials?: string[]
    onRequestChallenge?: () => Promise<ChallengeResponse | null>
    onSubmit: (data: string) => void
    loading: boolean
    error?: string
}

export default function FingerprintStep({
    challenge: challengeProp,
    rpId: rpIdProp,
    allowCredentials: allowCredentialsProp,
    onRequestChallenge,
    onSubmit,
    loading,
    error,
}: FingerprintStepProps) {
    const { t } = useTranslation()
    const [waiting, setWaiting] = useState(false)
    const [unavailable, setUnavailable] = useState(false)
    const [localError, setLocalError] = useState<string | null>(null)

    const handleScan = useCallback(async () => {
        setWaiting(true)
        setUnavailable(false)
        setLocalError(null)

        try {
            if (!window.PublicKeyCredential) {
                setUnavailable(true)
                setWaiting(false)
                return
            }

            let available = false
            try {
                available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
            } catch {
                // Brave throws here — proceed anyway and let WebAuthn prompt
                available = true
            }
            if (!available) {
                setUnavailable(true)
                setWaiting(false)
                return
            }

            const { challengeBytes, rpId, allowCredentials: resolvedCreds } = await resolveChallenge(
                onRequestChallenge, challengeProp, rpIdProp
            )

            // Use server-provided allowCredentials (from challenge) or prop fallback.
            // This lets non-discoverable platform credentials be found on Android —
            // without allowCredentials the passkey picker only shows resident credentials.
            const rawIds = resolvedCreds ?? allowCredentialsProp ?? []
            // transports: ['internal'] biases the OS picker toward platform authenticators
            // (Windows Hello / Touch ID / Android biometric) and away from security keys / phone hand-off.
            // Note: get() does NOT support authenticatorSelection; transports is the only hint available.
            const allowCredentials: PublicKeyCredentialDescriptor[] = rawIds.map(id => ({
                type: 'public-key' as const,
                id: base64urlToBytes(id).buffer as ArrayBuffer,
                transports: ['internal'] as AuthenticatorTransport[],
            }))

            const publicKeyOptions: PublicKeyCredentialRequestOptions = {
                challenge: challengeBytes.buffer as ArrayBuffer,
                rpId: rpId || window.location.hostname,
                userVerification: WEBAUTHN.UV_REQUIRED,
                timeout: WEBAUTHN.TIMEOUT_MS,
                ...(allowCredentials.length > 0 && { allowCredentials }),
            }

            console.log('[FingerprintStep] WebAuthn get() called', {
                rpId: publicKeyOptions.rpId,
                credentialCount: allowCredentials.length,
                credentialIds: rawIds,
                timeout: publicKeyOptions.timeout,
                timestamp: new Date().toISOString(),
            })

            const credential = await navigator.credentials.get({ publicKey: publicKeyOptions })

            console.log('[FingerprintStep] WebAuthn get() resolved', {
                hasCredential: !!credential,
                credentialId: credential?.id,
                timestamp: new Date().toISOString(),
            })

            if (credential && 'response' in credential) {
                const assertionResponse = credential.response as AuthenticatorAssertionResponse
                setWaiting(false)

                onSubmit(btoa(JSON.stringify({
                    credentialId: credential.id,
                    authenticatorData: arrayBufferToBase64(assertionResponse.authenticatorData),
                    clientDataJSON: arrayBufferToBase64(assertionResponse.clientDataJSON),
                    signature: arrayBufferToBase64(assertionResponse.signature),
                })))
            }
        } catch (err) {
            console.warn('[FingerprintStep] WebAuthn get() error', {
                name: err instanceof DOMException ? err.name : 'unknown',
                message: err instanceof Error ? err.message : String(err),
                timestamp: new Date().toISOString(),
            })
            setWaiting(false)
            if (err instanceof DOMException) {
                if (err.name === 'NotAllowedError') {
                    // NotAllowedError covers two cases:
                    // 1. User explicitly dismissed the dialog (no error message needed)
                    // 2. No matching passkey on device (OS shows "geçiş anahtarı yok" notification)
                    // Distinguish by checking the message — if it mentions credentials/passkey,
                    // show the re-enroll prompt; otherwise treat as user-cancelled.
                    const msg = err.message.toLowerCase()
                    if (msg.includes('credential') || msg.includes('passkey') || msg.includes('not found') || msg.includes('bulunamadı')) {
                        setLocalError(t('mfa.fingerprint.noPasskey'))
                    }
                    // else: user cancelled — no message needed
                } else if (err.name === 'SecurityError') {
                    setLocalError(t('mfa.fingerprint.noPasskey'))
                }
                // AbortError, TimeoutError etc. → silent
            }
        }
    }, [challengeProp, rpIdProp, onRequestChallenge, onSubmit, t, allowCredentialsProp])

    const isProcessing = loading || waiting

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={{
                hidden: { opacity: 0 },
                visible: {
                    opacity: 1,
                    transition: { staggerChildren: ANIMATION.STAGGER_CHILDREN },
                },
            }}
        >
            <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Box
                    sx={{
                        width: 56,
                        height: 56,
                        borderRadius: '14px',
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                        boxShadow: '0 8px 32px rgba(139, 92, 246, 0.3)',
                    }}
                >
                    <Fingerprint sx={{ fontSize: 28, color: 'white' }} />
                </Box>
                <Typography variant="h6" fontWeight={600}>
                    {t('mfa.fingerprint.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {t('mfa.fingerprint.description')}
                </Typography>
            </Box>

            {(error || localError) && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: ANIMATION.STEP_TRANSITION }}
                >
                    <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
                        {error || localError}
                    </Alert>
                </motion.div>
            )}

            {unavailable && (
                <Alert severity="warning" sx={{ mb: 2, borderRadius: '12px' }}>
                    {t('mfa.fingerprint.unavailable')}
                </Alert>
            )}

            <motion.div variants={itemVariants}>
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                    <motion.div
                        animate={
                            isProcessing
                                ? { scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }
                                : {}
                        }
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    >
                        <Box
                            sx={{
                                width: 120,
                                height: 120,
                                borderRadius: '50%',
                                background: isProcessing
                                    ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)'
                                    : 'rgba(99, 102, 241, 0.06)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '2px solid',
                                borderColor: isProcessing ? 'primary.main' : 'divider',
                                transition: 'all 0.3s ease',
                            }}
                        >
                            {isProcessing ? (
                                <CircularProgress size={48} />
                            ) : (
                                <Fingerprint sx={{ fontSize: 64, color: 'primary.main', opacity: 0.7 }} />
                            )}
                        </Box>
                    </motion.div>
                </Box>
            </motion.div>

            <motion.div variants={itemVariants}>
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mb: 3 }}>
                    {isProcessing ? t('mfa.fingerprint.placeFinger') : t('mfa.fingerprint.clickToStart')}
                </Typography>
            </motion.div>

            <motion.div variants={itemVariants}>
                <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    onClick={handleScan}
                    disabled={isProcessing}
                    endIcon={!isProcessing && <ArrowForward />}
                    sx={{
                        py: 1.5,
                        borderRadius: '12px',
                        fontSize: '1rem',
                        fontWeight: 600,
                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                        boxShadow: '0 10px 40px rgba(99, 102, 241, 0.4)',
                        '&:hover': {
                            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                        },
                        transition: 'all 0.3s ease',
                    }}
                >
                    {isProcessing ? (
                        <CircularProgress size={24} sx={{ color: 'white' }} />
                    ) : (
                        t('mfa.fingerprint.scanButton')
                    )}
                </Button>
            </motion.div>
        </motion.div>
    )
}
