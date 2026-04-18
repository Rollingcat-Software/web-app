import { useState, useCallback } from 'react'
import {
    Box,
    CircularProgress,
    Typography,
} from '@mui/material'
import { Key, UsbOutlined } from '@mui/icons-material'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { WEBAUTHN } from '../../constants'
import { type ChallengeResponse, arrayBufferToBase64, resolveChallenge, mapWebAuthnError } from '../../webauthn-utils'
import StepLayout from './StepLayout'
import { stepItemVariants as itemVariants } from './stepMotion'

interface HardwareKeyStepProps {
    challenge?: string
    rpId?: string
    onRequestChallenge?: () => Promise<ChallengeResponse | null>
    onSubmit: (data: string) => void
    loading: boolean
    error?: string
}

export default function HardwareKeyStep({
    challenge: challengeProp,
    rpId: rpIdProp,
    onRequestChallenge,
    onSubmit,
    loading,
    error,
}: HardwareKeyStepProps) {
    const { t } = useTranslation()
    const [waiting, setWaiting] = useState(false)
    const [keyError, setKeyError] = useState<string | null>(null)

    const handleAuthenticate = useCallback(async () => {
        setWaiting(true)
        setKeyError(null)

        try {
            if (!window.PublicKeyCredential) {
                setKeyError(t('webauthn.errors.notSupported'))
                setWaiting(false)
                return
            }

            const { challengeBytes, rpId } = await resolveChallenge(
                onRequestChallenge, challengeProp, rpIdProp
            )

            const credential = await navigator.credentials.get({
                publicKey: {
                    challenge: challengeBytes.buffer as ArrayBuffer,
                    rpId: rpId || window.location.hostname,
                    timeout: WEBAUTHN.TIMEOUT_MS,
                    userVerification: WEBAUTHN.UV_PREFERRED,
                },
            })

            if (credential && 'response' in credential) {
                const assertionResponse = credential.response as AuthenticatorAssertionResponse

                onSubmit(btoa(JSON.stringify({
                    credentialId: credential.id,
                    authenticatorData: arrayBufferToBase64(assertionResponse.authenticatorData),
                    clientDataJSON: arrayBufferToBase64(assertionResponse.clientDataJSON),
                    signature: arrayBufferToBase64(assertionResponse.signature),
                })))
            }
        } catch (err) {
            const mapped = mapWebAuthnError(err, t)
            if (mapped) setKeyError(mapped)
        } finally {
            setWaiting(false)
        }
    }, [challengeProp, rpIdProp, onRequestChallenge, onSubmit, t])

    const isProcessing = loading || waiting

    return (
        <StepLayout
            title={t('mfa.hardwareKey.title')}
            subtitle={t('mfa.hardwareKey.description')}
            icon={<Key sx={{ fontSize: 28, color: 'white' }} />}
            iconGradient="linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)"
            iconShadow="0 8px 32px rgba(245, 158, 11, 0.3)"
            error={error || keyError}
            primaryAction={{
                label: t('mfa.hardwareKey.authenticateButton'),
                onClick: () => { void handleAuthenticate() },
                disabled: isProcessing,
                loading: isProcessing,
            }}
        >
            <motion.div variants={itemVariants}>
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                    <motion.div
                        animate={
                            isProcessing
                                ? { rotateY: [0, 15, -15, 0], scale: [1, 1.05, 1] }
                                : {}
                        }
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
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
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mb: 3 }}>
                    {isProcessing ? t('mfa.hardwareKey.touchKey') : t('mfa.hardwareKey.ensureInserted')}
                </Typography>
            </motion.div>
        </StepLayout>
    )
}
