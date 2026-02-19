import {
    Alert,
    Box,
    Typography,
} from '@mui/material'
import { Nfc } from '@mui/icons-material'
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

interface NfcStepProps {
    loading: boolean
    error?: string
}

export default function NfcStep({ error }: NfcStepProps) {
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
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                        boxShadow: '0 8px 32px rgba(245, 158, 11, 0.3)',
                    }}
                >
                    <Nfc sx={{ fontSize: 28, color: 'white' }} />
                </Box>
                <Typography variant="h6" fontWeight={600}>
                    NFC Document Scan
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Verify your identity using an NFC-enabled ID document
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

            {/* NFC Icon with pulse */}
            <motion.div variants={itemVariants}>
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        my: 4,
                    }}
                >
                    <Box
                        sx={{
                            width: 100,
                            height: 100,
                            borderRadius: '50%',
                            background: 'rgba(245, 158, 11, 0.06)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '2px solid',
                            borderColor: 'divider',
                        }}
                    >
                        <Nfc
                            sx={{
                                fontSize: 56,
                                color: 'text.disabled',
                                opacity: 0.5,
                            }}
                        />
                    </Box>
                </Box>
            </motion.div>

            <motion.div variants={itemVariants}>
                <Alert severity="warning" sx={{ borderRadius: '12px' }}>
                    NFC document scanning is not available on this device.
                    This feature requires a mobile device with NFC capability.
                    Please use a supported mobile device to complete this authentication step.
                </Alert>
            </motion.div>

            <motion.div variants={itemVariants}>
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
                        Supported documents: National ID cards, passports, and residence
                        permits with NFC chips. Available on Android devices with NFC support
                        and iPhones (iPhone 7 and later).
                    </Typography>
                </Box>
            </motion.div>
        </motion.div>
    )
}
