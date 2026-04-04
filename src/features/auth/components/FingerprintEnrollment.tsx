import { useState, useEffect } from 'react'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogContent,
    DialogTitle,
    Typography,
} from '@mui/material'
import { Fingerprint } from '@mui/icons-material'
import WebAuthnEnrollment from './WebAuthnEnrollment'

interface FingerprintEnrollmentProps {
    open: boolean
    onClose: () => void
    onSuccess: () => void
    userId: string
}

export default function FingerprintEnrollment({
    open,
    onClose,
    onSuccess,
    userId,
}: FingerprintEnrollmentProps) {
    const [platformAvailable, setPlatformAvailable] = useState<boolean | null>(null)

    useEffect(() => {
        if (!open) {
            setPlatformAvailable(null)
            return
        }

        let cancelled = false

        async function checkAvailability() {
            if (!window.PublicKeyCredential) {
                if (!cancelled) setPlatformAvailable(false)
                return
            }
            try {
                const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
                if (!cancelled) setPlatformAvailable(available)
            } catch {
                // Brave throws here — assume available and let WebAuthn prompt the user
                if (!cancelled) setPlatformAvailable(true)
            }
        }

        checkAvailability()
        return () => { cancelled = true }
    }, [open])

    // Still checking availability
    if (open && platformAvailable === null) {
        return (
            <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                        sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Fingerprint sx={{ fontSize: 28, color: 'white' }} />
                    </Box>
                    Fingerprint Authentication
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <CircularProgress size={40} />
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                            Checking device compatibility...
                        </Typography>
                    </Box>
                </DialogContent>
            </Dialog>
        )
    }

    // Platform authenticator not available
    if (open && platformAvailable === false) {
        return (
            <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                        sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Fingerprint sx={{ fontSize: 28, color: 'white' }} />
                    </Box>
                    Fingerprint Authentication
                </DialogTitle>
                <DialogContent>
                    <Alert severity="error" sx={{ mt: 1 }}>
                        Fingerprint authentication is not available on this device. Your browser
                        or device does not support a platform authenticator (Touch ID, Windows Hello,
                        or similar biometric). Please try from a device with built-in biometric support.
                    </Alert>
                    <Box sx={{ textAlign: 'center', mt: 3 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Supported platforms include MacBooks with Touch ID, Windows devices
                            with Windows Hello, and Android devices with fingerprint sensors.
                        </Typography>
                        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: '12px' }}>
                            Close
                        </Button>
                    </Box>
                </DialogContent>
            </Dialog>
        )
    }

    // Platform authenticator is available -- render the WebAuthn enrollment in platform mode
    return (
        <WebAuthnEnrollment
            open={open}
            onClose={onClose}
            onSuccess={onSuccess}
            userId={userId}
            mode="platform"
        />
    )
}
