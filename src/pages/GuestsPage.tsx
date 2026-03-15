import { useState, useEffect, useCallback } from 'react'
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material'
import { Add, Block, Schedule, PersonAdd } from '@mui/icons-material'
import { motion } from 'framer-motion'
import { PageTransition } from '@components/animations'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'
import type { ILogger } from '@domain/interfaces/ILogger'

const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

interface GuestInvitation {
    id: string
    tenantId: string
    email: string
    status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED'
    invitedByEmail: string
    message?: string
    accessStartsAt?: string
    accessEndsAt?: string
    expiresAt: string
    extensionCount: number
    maxExtensions: number
    canExtend: boolean
    acceptedAt?: string
    createdAt: string
    guestUserId?: string
    guestFirstName?: string
    guestLastName?: string
}

type StatusFilter = '' | 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED'

const STATUS_COLORS: Record<string, 'warning' | 'success' | 'default' | 'error'> = {
    PENDING: 'warning',
    ACCEPTED: 'success',
    EXPIRED: 'default',
    REVOKED: 'error',
}

const STATUS_OPTIONS: { label: string; value: StatusFilter }[] = [
    { label: 'All', value: '' },
    { label: 'Pending', value: 'PENDING' },
    { label: 'Accepted', value: 'ACCEPTED' },
    { label: 'Expired', value: 'EXPIRED' },
    { label: 'Revoked', value: 'REVOKED' },
]

export default function GuestsPage() {
    const httpClient = useService<IHttpClient>(TYPES.HttpClient)
    const logger = useService<ILogger>(TYPES.Logger)

    const [guests, setGuests] = useState<GuestInvitation[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
    const [activeCount, setActiveCount] = useState(0)

    // Invite dialog
    const [inviteOpen, setInviteOpen] = useState(false)
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteDuration, setInviteDuration] = useState(24)
    const [inviteMessage, setInviteMessage] = useState('')
    const [inviteLoading, setInviteLoading] = useState(false)

    // Extend dialog
    const [extendOpen, setExtendOpen] = useState(false)
    const [extendGuestId, setExtendGuestId] = useState('')
    const [extendHours, setExtendHours] = useState(24)
    const [extendLoading, setExtendLoading] = useState(false)

    // Revoke dialog
    const [revokeOpen, setRevokeOpen] = useState(false)
    const [revokeGuestId, setRevokeGuestId] = useState('')
    const [revokeLoading, setRevokeLoading] = useState(false)

    const showSuccess = useCallback((msg: string) => {
        setSuccess(msg)
        setTimeout(() => setSuccess(null), 4000)
    }, [])

    const loadGuests = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const params: Record<string, unknown> = {}
            if (statusFilter) params.status = statusFilter
            const res = await httpClient.get<GuestInvitation[]>('/guests', { params })
            setGuests(res.data)
        } catch (err) {
            logger.error('Failed to load guests', err)
            setError('Failed to load guest invitations')
        } finally {
            setLoading(false)
        }
    }, [httpClient, logger, statusFilter])

    const loadCount = useCallback(async () => {
        try {
            const res = await httpClient.get<number>('/guests/count')
            setActiveCount(res.data)
        } catch (err) {
            logger.error('Failed to load guest count', err)
        }
    }, [httpClient, logger])

    useEffect(() => {
        loadGuests()
    }, [loadGuests])

    useEffect(() => {
        loadCount()
    }, [loadCount])

    const handleInvite = async () => {
        setInviteLoading(true)
        try {
            await httpClient.post('/guests/invite', {
                email: inviteEmail,
                accessDurationHours: inviteDuration,
                ...(inviteMessage ? { message: inviteMessage } : {}),
            })
            setInviteOpen(false)
            setInviteEmail('')
            setInviteDuration(24)
            setInviteMessage('')
            showSuccess('Guest invitation sent successfully')
            await loadGuests()
            await loadCount()
        } catch (err) {
            logger.error('Failed to invite guest', err)
            setError('Failed to send guest invitation')
        } finally {
            setInviteLoading(false)
        }
    }

    const handleExtend = async () => {
        setExtendLoading(true)
        try {
            await httpClient.post(`/guests/${extendGuestId}/extend`, { additionalHours: extendHours })
            setExtendOpen(false)
            setExtendHours(24)
            showSuccess('Guest access extended successfully')
            await loadGuests()
        } catch (err) {
            logger.error('Failed to extend guest access', err)
            setError('Failed to extend guest access')
        } finally {
            setExtendLoading(false)
        }
    }

    const handleRevoke = async () => {
        setRevokeLoading(true)
        try {
            await httpClient.post(`/guests/${revokeGuestId}/revoke`)
            setRevokeOpen(false)
            showSuccess('Guest access revoked successfully')
            await loadGuests()
            await loadCount()
        } catch (err) {
            logger.error('Failed to revoke guest access', err)
            setError('Failed to revoke guest access')
        } finally {
            setRevokeLoading(false)
        }
    }

    const formatDate = (iso?: string) => (iso ? new Date(iso).toLocaleString() : '-')

    return (
        <PageTransition>
            <Box>
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: easeOut }}
                >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                        <Box>
                            <Typography variant="h4" fontWeight={700}>
                                Guest Management
                            </Typography>
                            <Typography variant="body1" color="text.secondary">
                                Invite and manage temporary guest access
                            </Typography>
                        </Box>
                        <Button
                            variant="contained"
                            startIcon={<PersonAdd />}
                            onClick={() => setInviteOpen(true)}
                        >
                            Invite Guest
                        </Button>
                    </Box>
                </motion.div>

                {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
                {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3, flexWrap: 'wrap' }}>
                    {STATUS_OPTIONS.map((opt) => (
                        <Chip
                            key={opt.value}
                            label={opt.label}
                            variant={statusFilter === opt.value ? 'filled' : 'outlined'}
                            color={statusFilter === opt.value ? 'primary' : 'default'}
                            onClick={() => setStatusFilter(opt.value)}
                            clickable
                        />
                    ))}
                    <Chip
                        label={`${activeCount} active`}
                        size="small"
                        color="info"
                        variant="outlined"
                        sx={{ ml: 1 }}
                    />
                </Box>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                        <CircularProgress />
                    </Box>
                ) : guests.length === 0 ? (
                    <Paper sx={{ textAlign: 'center', py: 6, border: '1px solid', borderColor: 'divider', borderRadius: 2 }} elevation={0}>
                        <PersonAdd sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary">
                            No guest invitations found
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Click "Invite Guest" to send a temporary access invitation
                        </Typography>
                    </Paper>
                ) : (
                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Email</TableCell>
                                    <TableCell>Guest Name</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Invited By</TableCell>
                                    <TableCell>Access Period</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {guests.map((guest) => (
                                    <TableRow key={guest.id} hover>
                                        <TableCell>
                                            <Typography variant="subtitle2" fontWeight={600}>
                                                {guest.email}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            {guest.guestFirstName
                                                ? `${guest.guestFirstName} ${guest.guestLastName ?? ''}`.trim()
                                                : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={guest.status}
                                                size="small"
                                                color={STATUS_COLORS[guest.status] ?? 'default'}
                                            />
                                        </TableCell>
                                        <TableCell>{guest.invitedByEmail}</TableCell>
                                        <TableCell>
                                            <Typography variant="body2">
                                                {formatDate(guest.accessStartsAt)} — {formatDate(guest.accessEndsAt)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                                                {guest.canExtend && (
                                                    <Tooltip title="Extend access">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => {
                                                                setExtendGuestId(guest.guestUserId ?? '')
                                                                setExtendOpen(true)
                                                            }}
                                                        >
                                                            <Schedule fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                                {(guest.status === 'ACCEPTED' || guest.status === 'PENDING') && (
                                                    <Tooltip title="Revoke access">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => {
                                                                setRevokeGuestId(guest.guestUserId ?? '')
                                                                setRevokeOpen(true)
                                                            }}
                                                            sx={{ color: 'error.main' }}
                                                        >
                                                            <Block fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}

                {/* Invite Guest Dialog */}
                <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>Invite Guest</DialogTitle>
                    <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
                        <TextField
                            label="Email"
                            type="email"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            fullWidth
                            required
                        />
                        <TextField
                            label="Access Duration (hours)"
                            type="number"
                            value={inviteDuration}
                            onChange={(e) => setInviteDuration(Number(e.target.value))}
                            inputProps={{ min: 1 }}
                            fullWidth
                        />
                        <TextField
                            label="Message (optional)"
                            value={inviteMessage}
                            onChange={(e) => setInviteMessage(e.target.value)}
                            multiline
                            rows={3}
                            fullWidth
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setInviteOpen(false)}>Cancel</Button>
                        <Button
                            variant="contained"
                            onClick={handleInvite}
                            disabled={!inviteEmail || inviteDuration < 1 || inviteLoading}
                            startIcon={inviteLoading ? <CircularProgress size={16} /> : <Add />}
                        >
                            Send Invitation
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Extend Access Dialog */}
                <Dialog open={extendOpen} onClose={() => setExtendOpen(false)} maxWidth="xs" fullWidth>
                    <DialogTitle>Extend Guest Access</DialogTitle>
                    <DialogContent sx={{ pt: '16px !important' }}>
                        <TextField
                            label="Additional Hours"
                            type="number"
                            value={extendHours}
                            onChange={(e) => setExtendHours(Number(e.target.value))}
                            inputProps={{ min: 1 }}
                            fullWidth
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setExtendOpen(false)}>Cancel</Button>
                        <Button
                            variant="contained"
                            onClick={handleExtend}
                            disabled={extendHours < 1 || extendLoading}
                            startIcon={extendLoading ? <CircularProgress size={16} /> : <Schedule />}
                        >
                            Extend
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Confirm Revoke Dialog */}
                <Dialog open={revokeOpen} onClose={() => setRevokeOpen(false)} maxWidth="xs" fullWidth>
                    <DialogTitle>Revoke Guest Access</DialogTitle>
                    <DialogContent>
                        <Typography>
                            Are you sure you want to revoke this guest's access? This action cannot be undone.
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setRevokeOpen(false)}>Cancel</Button>
                        <Button
                            variant="contained"
                            color="error"
                            onClick={handleRevoke}
                            disabled={revokeLoading}
                            startIcon={revokeLoading ? <CircularProgress size={16} /> : <Block />}
                        >
                            Revoke
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </PageTransition>
    )
}
