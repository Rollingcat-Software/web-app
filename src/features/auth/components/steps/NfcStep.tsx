import { useState, useCallback, useMemo } from 'react'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Typography,
} from '@mui/material'
import { Nfc, Contactless, OpenInNew } from '@mui/icons-material'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import StepLayout from './StepLayout'
import { stepItemVariants as itemVariants } from './stepMotion'

interface NfcStepProps {
    onSubmit?: (data: string) => void
    loading: boolean
    error?: string
    /** When the widget is framed, clicking "pick another method" routes back to the method picker. */
    onBack?: () => void
}

/**
 * Web NFC (NDEFReader) only runs in top-level browsing contexts by spec. When our verify
 * widget is embedded in a tenant page via iframe, `NDEFReader.scan()` rejects with a
 * NotAllowedError. We detect that situation up-front and offer a "continue in a new tab"
 * CTA that opens the hosted login surface at the same origin so NFC works natively.
 */
export default function NfcStep({ onSubmit, loading, error, onBack }: NfcStepProps) {
    const { t } = useTranslation()
    const [scanning, setScanning] = useState(false)
    const [scanResult, setScanResult] = useState<string | null>(null)
    const [scanError, setScanError] = useState<string | null>(null)

    const isNfcSupported = typeof window !== 'undefined' && 'NDEFReader' in window
    const isFramed = typeof window !== 'undefined' && window.top !== window.self

    const hostedLoginHref = useMemo(() => {
        if (typeof window === 'undefined') return '/login'
        const url = new URL(window.location.href)
        url.pathname = '/login'
        return url.toString()
    }, [])

    const handleScan = useCallback(async () => {
        if (!isNfcSupported) {
            setScanError(t('mfa.nfc.notSupported'))
            return
        }

        setScanning(true)
        setScanError(null)
        setScanResult(null)

        // Track whether the scan succeeded so the 30s timeout doesn't stomp a
        // result — and, conversely, so it can surface a user-visible error if
        // nothing was tapped.
        let completed = false

        try {
            // @ts-expect-error NDEFReader is not in TypeScript types yet
            const ndef = new window.NDEFReader()
            await ndef.scan()

            ndef.addEventListener('reading', ({ serialNumber }: { serialNumber: string }) => {
                completed = true
                setScanResult(serialNumber)
                setScanning(false)
                if (onSubmit) {
                    onSubmit(serialNumber)
                }
            })

            ndef.addEventListener('readingerror', () => {
                completed = true
                setScanError(t('mfa.nfc.readError'))
                setScanning(false)
            })

            // Auto-timeout after 30 seconds with a user-visible message so the
            // user doesn't stare at a silently-stopped spinner.
            setTimeout(() => {
                if (!completed) {
                    setScanError(t('mfa.nfc.scanTimeout'))
                    setScanning(false)
                }
            }, 30000)
        } catch (err) {
            setScanError(err instanceof Error ? err.message : t('mfa.nfc.scanFailed'))
            setScanning(false)
        }
    }, [isNfcSupported, onSubmit, t])

    if (isFramed && isNfcSupported) {
        return (
            <StepLayout
                title={t('mfa.nfc.framedTitle')}
                subtitle={t('mfa.nfc.framedBody')}
                icon={<OpenInNew sx={{ fontSize: 28, color: 'white' }} />}
                iconGradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                iconShadow="0 8px 32px rgba(245, 158, 11, 0.3)"
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        component="a"
                        href={hostedLoginHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        startIcon={<OpenInNew />}
                        sx={{
                            py: 1.5,
                            borderRadius: '12px',
                            fontSize: '1rem',
                            fontWeight: 600,
                            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                            boxShadow: '0 10px 40px rgba(245, 158, 11, 0.4)',
                            '&:hover': {
                                background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                            },
                        }}
                    >
                        {t('mfa.nfc.framedCta')}
                    </Button>

                    {onBack && (
                        <Button
                            fullWidth
                            variant="outlined"
                            size="large"
                            onClick={onBack}
                            sx={{ py: 1.5, borderRadius: '12px', fontWeight: 600 }}
                        >
                            {t('mfa.nfc.framedSecondary')}
                        </Button>
                    )}
                </Box>
            </StepLayout>
        )
    }

    return (
        <StepLayout
            title={t('mfa.nfc.title')}
            subtitle={t('mfa.nfc.subtitle')}
            icon={<Nfc sx={{ fontSize: 28, color: 'white' }} />}
            iconGradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
            iconShadow="0 8px 32px rgba(245, 158, 11, 0.3)"
            error={error || scanError}
            help={
                <Box
                    sx={{
                        mt: 3,
                        p: 2,
                        bgcolor: 'rgba(245, 158, 11, 0.06)',
                        borderRadius: '12px',
                        border: '1px solid',
                        borderColor: 'divider',
                    }}
                >
                    <Typography variant="caption" color="text.secondary" display="block">
                        {t('mfa.nfc.hint')}
                    </Typography>
                </Box>
            }
        >
            {scanResult && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                >
                    <Alert severity="success" sx={{ mb: 2, borderRadius: '12px' }}>
                        {t('mfa.nfc.scanSuccess')}
                    </Alert>
                </motion.div>
            )}

            {/* NFC Icon with pulse animation when scanning */}
            <motion.div variants={itemVariants}>
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                    <Box
                        sx={{
                            width: 100,
                            height: 100,
                            borderRadius: '50%',
                            background: scanning
                                ? 'rgba(245, 158, 11, 0.15)'
                                : 'rgba(245, 158, 11, 0.06)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '2px solid',
                            borderColor: scanning ? 'warning.main' : 'divider',
                            animation: scanning ? 'pulse 1.5s ease-in-out infinite' : 'none',
                            '@keyframes pulse': {
                                '0%': { boxShadow: '0 0 0 0 rgba(245, 158, 11, 0.4)' },
                                '70%': { boxShadow: '0 0 0 20px rgba(245, 158, 11, 0)' },
                                '100%': { boxShadow: '0 0 0 0 rgba(245, 158, 11, 0)' },
                            },
                        }}
                    >
                        {scanning ? (
                            <CircularProgress size={48} sx={{ color: 'warning.main' }} />
                        ) : (
                            <Contactless sx={{ fontSize: 48, color: scanning ? 'warning.main' : 'text.disabled' }} />
                        )}
                    </Box>
                </Box>
            </motion.div>

            <motion.div variants={itemVariants}>
                {isNfcSupported ? (
                    <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        onClick={handleScan}
                        disabled={loading || scanning}
                        startIcon={!scanning && <Nfc />}
                        sx={{
                            py: 1.5,
                            borderRadius: '12px',
                            fontSize: '1rem',
                            fontWeight: 600,
                            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                            boxShadow: '0 10px 40px rgba(245, 158, 11, 0.4)',
                            '&:hover': {
                                background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                            },
                        }}
                    >
                        {scanning ? t('mfa.nfc.scanning') : t('mfa.nfc.scanButton')}
                    </Button>
                ) : (
                    <Alert severity="warning" sx={{ borderRadius: '12px' }}>
                        {t('mfa.nfc.notSupported')}
                    </Alert>
                )}
            </motion.div>
        </StepLayout>
    )
}
