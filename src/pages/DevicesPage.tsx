import { useState, useEffect, useCallback } from 'react'
import {
    Box,
    Typography,
    Card,
    CardContent,
    Chip,
    IconButton,
    Tooltip,
    Alert,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    CircularProgress,
} from '@mui/material'
import { Delete, PhoneAndroid, Computer, Language, DevicesOther } from '@mui/icons-material'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { PageTransition } from '@components/animations'
import { TYPES } from '@core/di/types'
import { useService } from '@app/providers'
import { useAuth } from '@features/auth/hooks/useAuth'
import type { DeviceRepository, DeviceResponse } from '@core/repositories/DeviceRepository'
import type { ILogger } from '@domain/interfaces/ILogger'
import { formatApiError } from '@utils/formatApiError'

const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

function getPlatformIcon(platform: string) {
    switch (platform?.toLowerCase()) {
        case 'android':
        case 'ios':
        case 'mobile':
            return <PhoneAndroid />
        case 'desktop':
        case 'windows':
        case 'macos':
        case 'linux':
            return <Computer />
        case 'web':
            return <Language />
        default:
            return <DevicesOther />
    }
}

export default function DevicesPage() {
    const { t } = useTranslation()
    const deviceRepo = useService<DeviceRepository>(TYPES.DeviceRepository)
    const logger = useService<ILogger>(TYPES.Logger)
    const { user } = useAuth()

    const [devices, setDevices] = useState<DeviceResponse[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // SUPER_ADMIN omits tenantId so the backend lists every tenant's
    // devices; tenant-scoped admins always pin to their own tenant.
    // Without this, SUPER_ADMIN saw only the system-tenant's (empty)
    // list because user.tenantId is the system tenant id.
    const isSuperAdmin = !!user?.isSuperAdmin?.()
    const tenantId = isSuperAdmin ? '' : (user?.tenantId ?? '')

    const loadDevices = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const data = await deviceRepo.listDevices(tenantId)
            setDevices(data)
        } catch (err) {
            logger.error('Failed to load devices', err)
            setError(formatApiError(err, t) || t('devices.loadFailed'))
        } finally {
            setLoading(false)
        }
    }, [deviceRepo, logger, tenantId, t])

    useEffect(() => {
        loadDevices()
    }, [loadDevices])

    const handleDelete = async (deviceId: string) => {
        try {
            await deviceRepo.deleteDevice(tenantId, deviceId)
            await loadDevices()
        } catch (err) {
            logger.error('Failed to delete device', err)
            setError(formatApiError(err, t) || t('devices.deleteFailed'))
        }
    }

    return (
        <PageTransition>
            <Box>
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: easeOut }}
                >
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="h4" fontWeight={700}>
                            {t('devices.title')}
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            {t('devices.subtitle')}
                        </Typography>
                    </Box>
                </motion.div>

                {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
                {isSuperAdmin && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                        {t('devices.platformWideNotice')}
                    </Alert>
                )}

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                        <CircularProgress />
                    </Box>
                ) : devices.length === 0 ? (
                    <Card>
                        <CardContent sx={{ textAlign: 'center', py: 6 }}>
                            <DevicesOther sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary">
                                {t('devices.empty')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t('devices.emptyHint')}
                            </Typography>
                        </CardContent>
                    </Card>
                ) : (
                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('devices.columnDevice')}</TableCell>
                                    <TableCell>{t('devices.columnPlatform')}</TableCell>
                                    <TableCell>{t('devices.columnFingerprint')}</TableCell>
                                    <TableCell>{t('devices.columnLastUsed')}</TableCell>
                                    <TableCell>{t('devices.columnRegistered')}</TableCell>
                                    <TableCell align="right">{t('common.actions')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {devices.map((device) => (
                                    <TableRow key={device.id} hover>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                {getPlatformIcon(device.platform)}
                                                <Typography variant="subtitle2" fontWeight={600}>
                                                    {device.deviceName}
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Chip label={device.platform} size="small" variant="outlined" />
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="caption" fontFamily="monospace">
                                                {device.fingerprint?.substring(0, 16)}...
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            {device.lastUsed ? new Date(device.lastUsed).toLocaleDateString() : '-'}
                                        </TableCell>
                                        <TableCell>
                                            {new Date(device.createdAt).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell align="right">
                                            <Tooltip title={t('devices.removeDevice')}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleDelete(device.id)}
                                                    sx={{ color: 'error.main' }}
                                                    aria-label={t('common.aria.remove')}
                                                >
                                                    <Delete fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Box>
        </PageTransition>
    )
}
