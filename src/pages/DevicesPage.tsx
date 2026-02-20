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
import { PageTransition } from '@components/animations'
import { TYPES } from '@core/di/types'
import { useService } from '@app/providers/DependencyProvider'
import { useAuth } from '@features/auth/hooks/useAuth'
import type { DeviceRepository, DeviceResponse } from '@core/repositories/DeviceRepository'
import type { ILogger } from '@domain/interfaces/ILogger'

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
    const deviceRepo = useService<DeviceRepository>(TYPES.DeviceRepository)
    const logger = useService<ILogger>(TYPES.Logger)
    const { user } = useAuth()

    const [devices, setDevices] = useState<DeviceResponse[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const tenantId = user?.tenantId ?? ''

    const loadDevices = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const data = await deviceRepo.listDevices(tenantId)
            setDevices(data)
        } catch (err) {
            logger.error('Failed to load devices', err)
            setError('Failed to load devices')
        } finally {
            setLoading(false)
        }
    }, [deviceRepo, logger, tenantId])

    useEffect(() => {
        loadDevices()
    }, [loadDevices])

    const handleDelete = async (deviceId: string) => {
        try {
            await deviceRepo.deleteDevice(tenantId, deviceId)
            await loadDevices()
        } catch (err) {
            logger.error('Failed to delete device', err)
            setError('Failed to delete device')
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
                            Registered Devices
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Manage user devices and access permissions
                        </Typography>
                    </Box>
                </motion.div>

                {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                        <CircularProgress />
                    </Box>
                ) : devices.length === 0 ? (
                    <Card>
                        <CardContent sx={{ textAlign: 'center', py: 6 }}>
                            <DevicesOther sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary">
                                No devices registered
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Devices will appear here when users authenticate from new devices
                            </Typography>
                        </CardContent>
                    </Card>
                ) : (
                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Device</TableCell>
                                    <TableCell>Platform</TableCell>
                                    <TableCell>Fingerprint</TableCell>
                                    <TableCell>Last Used</TableCell>
                                    <TableCell>Registered</TableCell>
                                    <TableCell align="right">Actions</TableCell>
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
                                            <Tooltip title="Remove device">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleDelete(device.id)}
                                                    sx={{ color: 'error.main' }}
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
