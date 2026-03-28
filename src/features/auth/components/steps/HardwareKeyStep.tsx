import { useState, useCallback } from 'react'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Typography,
} from '@mui/material'
import { Key, ArrowForward, UsbOutlined } from '@mui/icons-material'
import { motion, Variants } from 'framer-motion'

const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.4, ease: easeOut },
    },
}

interface ChallengeResponse {
    challenge: string
    rpId?: string
    timeout?: string
}

interface HardwareKeyStepProps {
    challenge?: string
    rpId?: string
    onRequestChallenge?: () => Promise<ChallengeResponse | null>
    onSubmit: (data: {
        credentialId: string
        authenticatorData: string
        clientDataJSON: string
        signature: string
    }) => void
    loading: boolean
    error?: string
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
}

export default function HardwareKeyStep({
    challenge: challengeProp,
    rpId: rpIdProp,
    onRequestChallenge,
    onSubmit,
    loading,
    error,
}: HardwareKeyStepProps) {
    const [waiting, setWaiting] = useState(false)
    const [keyError, setKeyError] = useState<string | null>(null)

    const handleAuthenticate = useCallback(async () => {
        setWaiting(true)
        setKeyError(null)

        try {
            if (!window.PublicKeyCredential) {
                setKeyError('WebAuthn is not supported in this browser.')
                setWaiting(false)
                return
            }

            // Determine challenge and rpId: prefer prop, then server, then random fallback
            let challenge = challengeProp
            let rpId = rpIdProp

            if (!challenge && onRequestChallenge) {
                try {
                    const serverChallenge = await onRequestChallenge()
                    if (serverChallenge?.challenge) {
                        challenge = serverChallenge.challenge
                        rpId = serverChallenge.rpId ?? rpId
                    }
                } catch {
                    // Server challenge request failed; fall back to local random challenge
                }
            }

            const challengeBytes = challenge
                ? Uint8Array.from(atob(challenge), (c) => c.charCodeAt(0))
                : (() => {
                      const arr = new Uint8Array(32)
                      crypto.getRandomValues(arr)
                      return arr
                  })()

            const credential = await navigator.credentials.get({
                publicKey: {
                    challenge: challengeBytes,
                    rpId: rpId || window.location.hostname,
                    timeout: 60000,
                    userVerification: 'preferred',
                },
            })

            if (credential && 'response' in credential) {
                const assertionResponse = credential.response as AuthenticatorAssertionResponse

                onSubmit({
                    credentialId: credential.id,
                    authenticatorData: arrayBufferToBase64(assertionResponse.authenticatorData),
                    clientDataJSON: arrayBufferToBase64(assertionResponse.clientDataJSON),
                    signature: arrayBufferToBase64(assertionResponse.signature),
                })
            }
        } catch (err) {
            if (err instanceof DOMException && err.name === 'NotAllowedError') {
                setKeyError('Authentication was cancelled or timed out. Please try again.')
            } else {
                setKeyError('Failed to authenticate with hardware key. Please try again.')
            }
        } finally {
            setWaiting(false)
        }
    }, [challengeProp, rpIdProp, onRequestChallenge, onSubmit])

    const isProcessing = loading || waiting

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={{
                hidden: { opacity: 0 },
                visible: {
                    opacity: 1,
                    transition: { staggerChildren: 0.1 },
                },
            }}
        >
            <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Box
                    sx={{
                        width: 56,
                        height: 56,
                        borderRadius: '14px',
                        background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                        boxShadow: '0 8px 32px rgba(245, 158, 11, 0.3)',
                    }}
                >
                    <Key sx={{ fontSize: 28, color: 'white' }} />
                </Box>
                <Typography variant="h6" fontWeight={600}>
                    Hardware Security Key
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Insert your security key and press the button when ready
                </Typography>
            </Box>

            {(error || keyError) && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
                        {error || keyError}
                    </Alert>
                </motion.div>
            )}

            {/* Security Key Animation */}
            <motion.div variants={itemVariants}>
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        my: 4,
                    }}
                >
                    <motion.div
                        animate={
                            isProcessing
                                ? {
                                      rotateY: [0, 15, -15, 0],
                                      scale: [1, 1.05, 1],
                                  }
                                : {}
                        }
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: 'easeInOut',
                        }}
                    >
                        <Box
                            sx={{
                                width: 100,
                                height: 100,
                                borderRadius: '20px',
                                background: isProcessing
                                    ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(239, 68, 68, 0.15) 100%)'
                                    : 'rgba(245, 158, 11, 0.06)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexDirection: 'column',
                                border: '2px solid',
                                borderColor: isProcessing ? 'warning.main' : 'divider',
                                transition: 'all 0.3s ease',
                                gap: 1,
                            }}
                        >
                            {isProcessing ? (
                                <CircularProgress size={40} color="warning" />
                            ) : (
                                <>
                                    <UsbOutlined sx={{ fontSize: 36, color: 'warning.main' }} />
                                    <Key sx={{ fontSize: 20, color: 'text.secondary' }} />
                                </>
                            )}
                        </Box>
                    </motion.div>
                </Box>
            </motion.div>

            <motion.div variants={itemVariants}>
                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ textAlign: 'center', mb: 3 }}
                >
                    {isProcessing
                        ? 'Touch your security key to authenticate...'
                        : 'Make sure your FIDO2/WebAuthn security key is inserted'}
                </Typography>
            </motion.div>

            <motion.div variants={itemVariants}>
                <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    onClick={handleAuthenticate}
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
                        'Authenticate with Security Key'
                    )}
                </Button>
            </motion.div>
        </motion.div>
    )
}
