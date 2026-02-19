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

const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.4, ease: easeOut },
    },
}

interface FingerprintStepProps {
    onSubmit: (data: string) => void
    loading: boolean
    error?: string
}

export default function FingerprintStep({ onSubmit, loading, error }: FingerprintStepProps) {
    const [waiting, setWaiting] = useState(false)

    const handleScan = useCallback(async () => {
        setWaiting(true)

        // Attempt to use WebAuthn platform authenticator (fingerprint/biometric)
        try {
            if (window.PublicKeyCredential) {
                const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
                if (available) {
                    const challenge = new Uint8Array(32)
                    crypto.getRandomValues(challenge)

                    const credential = await navigator.credentials.create({
                        publicKey: {
                            challenge,
                            rp: { name: 'FIVUCSAS', id: window.location.hostname },
                            user: {
                                id: new Uint8Array(16),
                                name: 'user',
                                displayName: 'User',
                            },
                            pubKeyCredParams: [
                                { type: 'public-key', alg: -7 },
                                { type: 'public-key', alg: -257 },
                            ],
                            authenticatorSelection: {
                                authenticatorAttachment: 'platform',
                                userVerification: 'required',
                            },
                            timeout: 60000,
                        },
                    })

                    if (credential) {
                        onSubmit(btoa(JSON.stringify({ credentialId: credential.id })))
                        return
                    }
                }
            }

            // Fallback: simulate fingerprint scan for devices without WebAuthn
            await new Promise((resolve) => setTimeout(resolve, 2000))
            onSubmit(btoa('fingerprint-verified'))
        } catch (_err) {
            // User cancelled or error occurred, reset waiting state
            setWaiting(false)
        }
    }, [onSubmit])

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
                    Fingerprint Verification
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Use your fingerprint sensor to verify your identity
                </Typography>
            </Box>

            {error && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
                        {error}
                    </Alert>
                </motion.div>
            )}

            {/* Fingerprint Icon Animation */}
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
                                      scale: [1, 1.15, 1],
                                      opacity: [0.6, 1, 0.6],
                                  }
                                : {}
                        }
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: 'easeInOut',
                        }}
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
                                <Fingerprint
                                    sx={{
                                        fontSize: 64,
                                        color: 'primary.main',
                                        opacity: 0.7,
                                    }}
                                />
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
                        ? 'Place your finger on the sensor...'
                        : 'Click the button below to start fingerprint verification'}
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
                        'Scan Fingerprint'
                    )}
                </Button>
            </motion.div>
        </motion.div>
    )
}
