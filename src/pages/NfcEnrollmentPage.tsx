import { useState, useCallback, useEffect, useRef } from 'react'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Typography,
} from '@mui/material'
import {
    Contactless,
    PersonSearch,
    PhoneAndroid,
    Refresh,
    VerifiedUser,
    GetApp,
} from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@features/auth/hooks/useAuth'
import { container } from '@core/di/container'
import { TYPES } from '@core/di/types'
import type { ITokenService } from '@domain/interfaces/ITokenService'
import { QRCodeSVG } from 'qrcode.react'

/**
 * Check if Web NFC API is available (Chrome on Android only).
 */
function isWebNfcSupported(): boolean {
    return 'NDEFReader' in window
}

interface NfcResult {
    success: boolean
    message: string
    data?: Record<string, unknown>
}

export default function NfcEnrollmentPage() {
    const { t } = useTranslation()
    const { user } = useAuth()
    const isAdmin = user?.isAdmin() ?? false
    const nfcSupported = isWebNfcSupported()

    const [serialNumber, setSerialNumber] = useState<string | null>(null)
    const [scanning, setScanning] = useState(false)
    const [scanError, setScanError] = useState<string | null>(null)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [actionResult, setActionResult] = useState<NfcResult | null>(null)
    const [, setCardEnrolled] = useState<boolean | null>(null)
    const autoVerifyDone = useRef(false)
    const _unused = [setCardEnrolled] // suppress TS unused warning

    const startNfcScan = useCallback(async () => {
        if (!nfcSupported) return

        setScanning(true)
        setScanError(null)
        setSerialNumber(null)
        setActionResult(null)

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ndef = new (window as any).NDEFReader()
            await ndef.scan()

            ndef.addEventListener('reading', ({ serialNumber: sn }: { serialNumber: string }) => {
                setSerialNumber(sn)
                setScanning(false)
            })

            ndef.addEventListener('readingerror', () => {
                setScanError(t('nfc.readError', 'Failed to read NFC tag. Try again.'))
                setScanning(false)
            })
        } catch (err) {
            setScanError(
                err instanceof Error
                    ? err.message
                    : 'NFC scan failed. Make sure NFC is enabled.'
            )
            setScanning(false)
        }
    }, [nfcSupported])

    const doNfcAction = useCallback(async (action: 'enroll' | 'verify' | 'search') => {
        if (!serialNumber) return

        setActionLoading(action)
        setActionResult(null)

        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://auth.rollingcatsoftware.com/api/v1'

        try {
            let url: string
            let method: string
            let body: string | undefined

            switch (action) {
                case 'enroll':
                    url = `${apiBaseUrl}/nfc/enroll`
                    method = 'POST'
                    body = JSON.stringify({ cardSerial: serialNumber })
                    break
                case 'verify':
                    url = `${apiBaseUrl}/nfc/verify`
                    method = 'POST'
                    body = JSON.stringify({ cardSerial: serialNumber })
                    break
                case 'search':
                    url = `${apiBaseUrl}/nfc/search/${encodeURIComponent(serialNumber)}`
                    method = 'GET'
                    break
            }

            const tokenService = container.get<ITokenService>(TYPES.TokenService)
            const token = await tokenService.getAccessToken()
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            }
            const res = await fetch(url, { method, headers, body })
            const data = await res.json().catch(() => null)

            if (res.ok && data) {
                let message: string
                switch (action) {
                    case 'enroll':
                        message = t('nfc.enrollSuccess', 'NFC card enrolled successfully!')
                        setCardEnrolled(true)
                        break
                    case 'verify':
                        if (data.verified) {
                            message = data.userId
                                ? `${t('nfc.verifySuccess', 'NFC card verified!')} — ${t('nfc.cardOwner', 'Card owner')}: ${data.userId}`
                                : t('nfc.verifySuccess', 'NFC card verified!')
                            setCardEnrolled(true)
                        } else {
                            message = t('nfc.verifyFailed', 'NFC card not recognized.')
                            setCardEnrolled(false)
                        }
                        break
                    case 'search':
                        message = data.userId
                            ? `${t('nfc.cardOwner', 'Card owner')}: ${data.userId}`
                            : t('nfc.noOwner', 'No user found for this card.')
                        setCardEnrolled(!!data.userId)
                        break
                }
                setActionResult({ success: true, message, data })
            } else {
                setActionResult({
                    success: false,
                    message: data?.message || `${action} failed (${res.status})`,
                })
            }
        } catch (err) {
            setActionResult({
                success: false,
                message: err instanceof Error ? err.message : 'Request failed',
            })
        } finally {
            setActionLoading(null)
        }
    }, [serialNumber, t])

    const handleReset = () => {
        setSerialNumber(null)
        setScanError(null)
        setActionResult(null)
        setCardEnrolled(null)
        autoVerifyDone.current = false
    }

    // Auto-verify after card detection
    useEffect(() => {
        if (serialNumber && !autoVerifyDone.current) {
            autoVerifyDone.current = true
            doNfcAction('verify')
        }
    }, [serialNumber, doNfcAction])

    // Build deep link URL for mobile app NFC enrollment
    const tokenService = container.get<ITokenService>(TYPES.TokenService)
    const [mobileToken, setMobileToken] = useState<string | null>(null)
    useEffect(() => {
        tokenService.getAccessToken().then(setMobileToken).catch(() => {})
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const deepLinkUrl = `fivucsas://enroll/nfc?userId=${encodeURIComponent(user?.id ?? '')}&token=${encodeURIComponent(mobileToken ?? '')}`

    // Unsupported browser view
    if (!nfcSupported) {
        return (
            <Box sx={{ maxWidth: { xs: '100%', sm: 800 }, mx: 'auto', py: { xs: 1, sm: 3 }, px: { xs: 1, sm: 0 } }}>
                <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Contactless /> {t('nfc.title', 'NFC Scanner')}
                </Typography>

                <Card>
                    <CardContent sx={{ textAlign: 'center', py: 4 }}>
                        <PhoneAndroid sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" gutterBottom>
                            {t('nfc.unsupportedTitle', 'Web NFC Not Available')}
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 500, mx: 'auto' }}>
                            {t(
                                'nfc.unsupportedDescription',
                                'NFC document scanning requires Chrome on Android. Desktop browsers (including Brave, Firefox, and Safari) and iOS do not support the Web NFC API.'
                            )}
                        </Typography>

                        {/* QR Code for mobile deep link */}
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                                {t('nfc.scanQrTitle', 'Scan with your phone to continue on mobile')}
                            </Typography>
                            <Box sx={{
                                display: 'inline-block',
                                p: 2,
                                bgcolor: 'white',
                                borderRadius: 2,
                                border: '1px solid',
                                borderColor: 'divider',
                            }}>
                                <QRCodeSVG
                                    value={deepLinkUrl}
                                    size={180}
                                    level="M"
                                    includeMargin={false}
                                />
                            </Box>
                            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                                {t('nfc.qrHint', 'Opens FIVUCSAS mobile app NFC enrollment')}
                            </Typography>
                        </Box>

                        {/* Download app link */}
                        <Button
                            variant="outlined"
                            startIcon={<GetApp />}
                            href="https://github.com/Rollingcat-Software/client-apps/releases/latest"
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ mb: 2 }}
                        >
                            {t('nfc.downloadApp', 'Download FIVUCSAS App')}
                        </Button>

                        <Alert severity="info" sx={{ maxWidth: 500, mx: 'auto' }}>
                            {t(
                                'nfc.unsupportedHint',
                                'Tip: Open this page in Chrome on your Android device with NFC enabled to scan and save your NFC card.'
                            )}
                        </Alert>
                    </CardContent>
                </Card>
            </Box>
        )
    }

    return (
        <Box sx={{ maxWidth: { xs: '100%', sm: 800 }, mx: 'auto', py: { xs: 1, sm: 3 }, px: { xs: 1, sm: 0 } }}>
            <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Contactless /> {t('nfc.title', 'NFC Scanner')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {isAdmin
                    ? t('nfc.subtitleAdmin', 'Scan an NFC card to enroll, verify, or search for its owner.')
                    : t('nfc.subtitle', 'Scan and save your NFC-enabled ID card for authentication.')}
            </Typography>

            {scanError && (
                <Alert severity="error" sx={{ mb: 2 }}>{scanError}</Alert>
            )}

            {actionResult && (
                <Alert severity={actionResult.success ? 'success' : 'error'} sx={{ mb: 2 }}>
                    {actionResult.message}
                </Alert>
            )}

            <Card sx={{ mb: 3 }}>
                <CardContent>
                    {/* NFC scan area */}
                    <Box sx={{
                        height: 200,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: scanning ? 'primary.50' : serialNumber ? 'success.50' : 'grey.100',
                        borderRadius: 2,
                        mb: 2,
                        border: '2px dashed',
                        borderColor: scanning ? 'primary.main' : serialNumber ? 'success.main' : 'grey.300',
                        transition: 'all 0.3s',
                    }}>
                        {scanning ? (
                            <>
                                <CircularProgress sx={{ mb: 2 }} />
                                <Typography color="primary.main" fontWeight={600}>
                                    {t('nfc.waiting', 'Hold your NFC card near the device...')}
                                </Typography>
                            </>
                        ) : serialNumber ? (
                            <>
                                <Contactless sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                                <Typography variant="h6" color="success.main" fontWeight={600}>
                                    {t('nfc.cardDetected', 'Card Detected')}
                                </Typography>
                                <Chip
                                    label={`Serial: ${serialNumber}`}
                                    variant="outlined"
                                    color="success"
                                    sx={{ mt: 1, fontFamily: 'monospace' }}
                                />
                            </>
                        ) : (
                            <>
                                <Contactless sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                                <Typography color="text.secondary">
                                    {t('nfc.scanPrompt', 'Click "Scan NFC Card" to begin')}
                                </Typography>
                            </>
                        )}
                    </Box>

                    {/* Controls */}
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {!serialNumber && !scanning && (
                            <Button
                                variant="contained"
                                startIcon={<Contactless />}
                                onClick={startNfcScan}
                            >
                                {t('nfc.scanButton', 'Scan NFC Card')}
                            </Button>
                        )}


                        {scanning && (
                            <Button
                                variant="outlined"
                                onClick={() => setScanning(false)}
                            >
                                {t('common.cancel', 'Cancel')}
                            </Button>
                        )}

                        {serialNumber && (
                            <>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    startIcon={actionLoading === 'verify' ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <VerifiedUser />}
                                    onClick={() => doNfcAction('verify')}
                                    disabled={actionLoading !== null}
                                >
                                    {t('nfc.verifyButton', 'Whose Card?')}
                                </Button>
                                {isAdmin && (
                                    <Button
                                        variant="contained"
                                        color="secondary"
                                        startIcon={actionLoading === 'search' ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <PersonSearch />}
                                        onClick={() => doNfcAction('search')}
                                        disabled={actionLoading !== null}
                                    >
                                        {t('nfc.searchButton', 'Search All')}
                                    </Button>
                                )}
                                <Button
                                    variant="outlined"
                                    startIcon={<Refresh />}
                                    onClick={handleReset}
                            