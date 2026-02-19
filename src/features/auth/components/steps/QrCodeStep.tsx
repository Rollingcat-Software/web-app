import { useState, useCallback } from 'react'
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
    qrData?: string
    onSubmit: (token: string) => void
    loading: boolean
    error?: string
}

export default function QrCodeStep({ qrData, onSubmit, loading, error }: QrCodeStepProps) {
    const [token, setToken] = useState('')

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
                        {qrData ? (
                            <Box
                                component="img"
                                src={qrData}
                                alt="QR Code"
                                sx={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain',
                                    p: 2,
                                }}
                            />
                        ) : loading ? (
                            <CircularProgress size={40} />
                        ) : (
                            <>
                                <QrCode2 sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.4 }} />
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                                    QR Code will appear here
                                </Typography>
                            </>
                        )}

                        {/* Scanning animation overlay */}
                        {qrData && !loading && (
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

            <form onSubmit={handleSubmit}>
                <motion.div variants={itemVariants}>
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ textAlign: 'center', mb: 2 }}
                    >
                        Or enter the token from the mobile app manually:
                    </Typography>
                    <TextField
                        fullWidth
                        label="Authentication Token"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="Enter token from mobile app"
                        disabled={loading}
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
                        disabled={loading || !token.trim()}
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
