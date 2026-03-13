import { useState, useCallback, useEffect } from 'react'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    TextField,
    Typography,
} from '@mui/material'
import { QrCode2, ArrowForward } from '@mui/icons-material'
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

interface QrCodeStepProps {
    userId?: string
    onGenerateToken: (userId: string) => Promise<{ token: string; expiresInSeconds: number }>
    onSubmit: (token: string) => void
    loading: boolean
    error?: string
}

export default function QrCodeStep({
    userId,
    onGenerateToken,
    onSubmit,
    loading,
    error,
}: QrCodeStepProps) {
    const [token, setToken] = useState('')
    const [generatedToken, setGeneratedToken] = useState('')
    const [expiresInSeconds, setExpiresInSeconds] = useState<number | null>(null)
    const [isGenerating, setIsGenerating] = useState(false)
    const [generationError, setGenerationError] = useState<string | undefined>(undefined)

    const handleGenerateToken = useCallback(async () => {
        if (!userId) {
            setGenerationError(
                'Automatic QR token generation is unavailable for this session. You can still enter a token manually.'
            )
            return
        }

        setIsGenerating(true)
        setGenerationError(undefined)

        try {
            const result = await onGenerateToken(userId)
            setGeneratedToken(result.token)
            setExpiresInSeconds(result.expiresInSeconds)
            setToken(result.token)
        } catch (err) {
            const message =
                err instanceof Error ? err.message : 'Unable to generate QR token automatically.'
            setGenerationError(`${message} You can continue with manual token entry.`)
        } finally {
            setIsGenerating(false)
        }
    }, [userId, onGenerateToken])

    useEffect(() => {
        void handleGenerateToken()
    }, [handleGenerateToken])

    const handleSubmit = useCallback(
        (e: React.FormEvent) => {
            e.preventDefault()
            if (token.trim()) {
                onSubmit(token.trim())
            }
        },
        [token, onSubmit]
    )

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
                    QR Code Authentication
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Scan the QR code with your mobile app to authenticate
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
                        mb: 3,
                    }}
                >
                    <Box
                        sx={{
                            width: 200,
                            height: 200,
                            borderRadius: '16px',
                            border: '2px dashed',
                            borderColor: 'divider',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'column',
                            bgcolor: '#f8fafc',
                            position: 'relative',
                            overflow: 'hidden',
                        }}
                    >
                        {isGenerating ? (
                            <>
                                <CircularProgress size={40} />
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                                    Generating secure token...
                                </Typography>
                            </>
                        ) : generatedToken ? (
                            <Box
                                sx={{
                                    px: 2,
                                    p: 2,
                                    textAlign: 'center',
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ display: 'block', mb: 1 }}
                                >
                                    Generated One-Time Token
                                </Typography>
                                <Typography
                                    variant="h6"
                                    sx={{
                                        fontFamily: 'monospace',
                                        letterSpacing: '0.08em',
                                        wordBreak: 'break-all',
                                        fontWeight: 700,
                                    }}
                                >
                                    {generatedToken}
                                </Typography>
                                {expiresInSeconds && (
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{ display: 'block', mt: 1 }}
                                    >
                                        Expires in {Math.max(1, Math.floor(expiresInSeconds / 60))} minute(s)
                                    </Typography>
                                )}
                            </Box>
                        ) : (
                            <>
                                <QrCode2 sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.4 }} />
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                                    QR Code will appear here
                                </Typography>
                            </>
                        )}

                        {/* Scanning animation overlay */}
                        {generatedToken && !loading && !isGenerating && (
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

            <motion.div variants={itemVariants}>
                <Box sx={{ textAlign: 'center', mb: 2 }}>
                    <Button
                        variant="text"
                        size="small"
                        onClick={() => {
                            void handleGenerateToken()
                        }}
                        disabled={loading || isGenerating}
                    >
                        Generate New Token
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
                            ? 'Token auto-filled. You can edit it or paste a token from your mobile app:'
                            : 'Enter the token from your mobile app manually:'}
                    </Typography>
                    <TextField
                        fullWidth
                        label="Authentication Token"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="Enter token from mobile app"
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
                            'Verify'
                        )}
                    </Button>
                </motion.div>
            </form>
        </motion.div>
    )
}
