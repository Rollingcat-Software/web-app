import { useState, useCallback, useEffect, useRef } from 'react'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    LinearProgress,
    TextField,
    Typography,
} from '@mui/material'
import { QrCode2, ArrowForward, Refresh } from '@mui/icons-material'
import { motion, Variants } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { QRCodeSVG } from 'qrcode.react'

const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.4, ease: easeOut },
    },
}

interface QrCodeStepProps {
    userId?: string
    onGenerateToken: (userId: string) => Promise<{ token: string; expiresInSeconds: number }>
    onInvalidateToken?: (token: string) => Promise<void>
    onSubmit: (token: string) => void
    loading: boolean
    error?: string
}

export default function QrCodeStep({
    userId,
    onGenerateToken,
    onInvalidateToken,
    onSubmit,
    loading,
    error,
}: QrCodeStepProps) {
    const { t } = useTranslation()
    const [token, setToken] = useState('')
    const [generatedToken, setGeneratedToken] = useState('')
    const [expiresInSeconds, setExpiresInSeconds] = useState<number | null>(null)
    const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
    const [isGenerating, setIsGenerating] = useState(false)
    const [generationError, setGenerationError] = useState<string | undefined>(undefined)
    const [isExpired, setIsExpired] = useState(false)

    // Track the current token for cleanup on unmount
    const currentTokenRef = useRef<string>('')
    const onInvalidateTokenRef = useRef(onInvalidateToken)
    onInvalidateTokenRef.current = onInvalidateToken

    const handleGenerateToken = useCallback(async () => {
        if (!userId) {
            setGenerationError(
                t('mfa.qrCode.autoUnavailable')
            )
            return
        }

        setIsGenerating(true)
        setGenerationError(undefined)
        setIsExpired(false)

        // Invalidate the previous token if one exists
        if (currentTokenRef.current && onInvalidateToken) {
            try {
                await onInvalidateToken(currentTokenRef.current)
            } catch (_err) {
                // Best-effort invalidation of old token
            }
        }

        try {
            const result = await onGenerateToken(userId)
            setGeneratedToken(result.token)
            setExpiresInSeconds(result.expiresInSeconds)
            setRemainingSeconds(result.expiresInSeconds)
            setToken(result.token)
            currentTokenRef.current = result.token
        } catch (err) {
            const message =
                err instanceof Error ? err.message : 'Unable to generate QR token automatically.'
            setGenerationError(`${message} ${t('mfa.qrCode.manualFallback')}`)
        } finally {
            setIsGenerating(false)
        }
    }, [userId, onGenerateToken, onInvalidateToken])

    // Generate token on mount
    useEffect(() => {
        void handleGenerateToken()
    }, [handleGenerateToken])

    // Countdown timer for token expiry
    useEffect(() => {
        if (remainingSeconds === null || remainingSeconds <= 0) return

        const timer = setInterval(() => {
            setRemainingSeconds((prev) => {
                if (prev === null || prev <= 1) {
                    setIsExpired(true)
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(timer)
    }, [remainingSeconds])

    // Auto-refresh when token expires
    useEffect(() => {
        if (isExpired && !isGenerating && !loading) {
            const timeout = setTimeout(() => {
                void handleGenerateToken()
            }, 2000)
            return () => clearTimeout(timeout)
        }
    }, [isExpired, isGenerating, loading, handleGenerateToken])

    // Invalidate token on unmount
    useEffect(() => {
        return () => {
            const tokenToInvalidate = currentTokenRef.current
            const invalidateFn = onInvalidateTokenRef.current
            if (tokenToInvalidate && invalidateFn) {
                void invalidateFn(tokenToInvalidate)
            }
        }
    }, [])

    const handleSubmit = useCallback(
        (e: React.FormEvent) => {
            e.preventDefault()
            if (token.trim()) {
                onSubmit(token.trim())
            }
        },
        [token, onSubmit]
    )

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const expiryProgress =
        expiresInSeconds && remainingSeconds !== null
            ? (remainingSeconds / expiresInSeconds) * 100
            : 0

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
                        background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                        boxShadow: '0 8px 32px rgba(59, 130, 246, 0.3)',
                    }}
                >
                    <QrCode2 sx={{ fontSize: 28, color: 'white' }} />
                </Box>
                <Typography variant="h6" fontWeight={600}>
                    {t('mfa.qrCode.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {t('mfa.qrCode.description')}
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

            {generationError && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    <Alert severity="warning" sx={{ mb: 2, borderRadius: '12px' }}>
                        {generationError}
                    </Alert>
                </motion.div>
            )}

            {/* QR Code Display Area */}
            <motion.div variants={itemVariants}>
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        mb: 2,
                    }}
                >
                    <Box
                        sx={{
                            width: 220,
                            height: 220,
                            borderRadius: '16px',
                            border: '2px solid',
                            borderColor: isExpired ? 'error.light' : 'divider',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'column',
                            bgcolor: '#ffffff',
                            position: 'relative',
                            overflow: 'hidden',
                            p: 1.5,
                            transition: 'border-color 0.3s ease',
                        }}
                    >
                        {isGenerating ? (
                            <>
                                <CircularProgress size={40} />
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                                    {t('mfa.qrCode.generating')}
                                </Typography>
                            </>
                        ) : generatedToken && !isExpired ? (
                            <QRCodeSVG
                                value={generatedToken}
                                size={180}
                                level="M"
                                includeMargin={false}
                                bgColor="#ffffff"
                                fgColor="#1e293b"
                            />
                        ) : isExpired ? (
                            <>
                                <QrCode2 sx={{ fontSize: 48, color: 'error.light', opacity: 0.5 }} />
                                <Typography
                                    variant="caption"
                                    color="error.main"
                                    sx={{ mt: 1, fontWeight: 600 }}
                                >
                                    {t('mfa.qrCode.tokenExpired')}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {t('mfa.qrCode.generatingNew')}
                                </Typography>
                            </>
                        ) : (
                            <>
                                <QrCode2 sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.4 }} />
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                                    {t('mfa.qrCode.placeholder')}
                                </Typography>
                            </>
                        )}

                        {/* Scanning animation overlay */}
                        {generatedToken && !loading && !isGenerating && !isExpired && (
                            <motion.div
                                animate={{
                                    y: ['-100%', '100%'],
                                }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: 'linear',
                                }}
                                style={{
                                    position: 'absolute',
                                    left: 0,
                                    right: 0,
                                    height: '2px',
                                    background: 'linear-gradient(90deg, transparent, #6366f1, transparent)',
                                }}
                            />
                        )}
                    </Box>
                </Box>
            </motion.div>

            {/* Expiry countdown bar */}
            {generatedToken && remainingSeconds !== null && !isGenerating && (
                <motion.div variants={itemVariants}>
                    <Box sx={{ px: 2, mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography
                                variant="caption"
                                color={remainingSeconds <= 30 ? 'error.main' : 'text.secondary'}
                                fontWeight={remainingSeconds <= 30 ? 600 : 400}
                            >
                                {isExpired ? t('mfa.qrCode.expired') : t('mfa.qrCode.expiresIn', { time: formatTime(remainingSeconds) })}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {t('mfa.qrCode.autoRefresh')}
                            </Typography>
                        </Box>
                        <LinearProgress
                            variant="determinate"
                            value={expiryProgress}
                            sx={{
                                height: 4,
                                borderRadius: 2,
                                bgcolor: 'rgba(0,0,0,0.06)',
                                '& .MuiLinearProgress-bar': {
                                    borderRadius: 2,
                                    bgcolor: remainingSeconds <= 30 ? 'error.main' : 'primary.main',
                                    transition: 'width 1s linear',
                                },
                            }}
                        />
                    </Box>
                </motion.div>
            )}

            <motion.div variants={itemVariants}>
                <Box sx={{ textAlign: 'center', mb: 2 }}>
                    <Button
                        variant="text"
                        size="small"
                        startIcon={<Refresh />}
                        onClick={() => {
                            void handleGenerateToken()
                        }}
                        disabled={loading || isGenerating}
                    >
                        {t('mfa.qrCode.generateNew')}
                    </Button>
                </Box>
            </motion.div>

            <form onSubmit={handleSubmit}>
                <motion.div variants={itemVariants}>
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ textAlign: 'center', mb: 2 }}
                    >
                        {generatedToken
                            ? t('mfa.qrCode.tokenAutoFilled')
                            : t('mfa.qrCode.enterManually')}
                    </Typography>
                    <TextField
                        fullWidth
                        label={t('mfa.qrCode.tokenLabel')}
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder={t('mfa.qrCode.tokenPlaceholder')}
                        disabled={loading || isGenerating}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: '12px',
                                backgroundColor: '#f8fafc',
                                '&:hover': { backgroundColor: '#f1f5f9' },
                                '&.Mui-focused': { backgroundColor: '#fff' },
                            },
                        }}
                    />
                </motion.div>

                <motion.div variants={itemVariants}>
                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        size="large"
                        disabled={loading || isGenerating || !token.trim()}
                        endIcon={!loading && <ArrowForward />}
                        sx={{
                            mt: 3,
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
                        {loading ? (
                            <CircularProgress size={24} sx={{ color: 'white' }} />
                        ) : (
                            t('mfa.qrCode.verify')
                        )}
                    </Button>
                </motion.div>
            </form>
        </motion.div>
    )
}
