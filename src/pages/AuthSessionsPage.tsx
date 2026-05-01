import { useMemo, useState } from 'react'
import {
    Box,
    Typography,
    Card,
    CardContent,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    CircularProgress,
    TablePagination,
    Snackbar,
    Alert,
} from '@mui/material'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { formatApiError } from '@utils/formatApiError'
import { PageTransition } from '@components/animations'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useAuthSessionsList } from '@features/auth/hooks/useAuthSessionsList'
import type { AuthSessionStatusValue } from '@core/repositories/AuthSessionRepository'

const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

function getStatusColor(
    status: AuthSessionStatusValue
): 'success' | 'warning' | 'error' | 'info' | 'default' {
    switch (status) {
        case 'COMPLETED':
            return 'success'
        case 'IN_PROGRESS':
            return 'warning'
        case 'FAILED':
        case 'EXPIRED':
            return 'error'
        case 'CANCELLED':
            return 'default'
        case 'CREATED':
            return 'info'
        default:
            return 'default'
    }
}

function formatRelativeAge(iso: string, t: (k: string, v?: Record<string, unknown>) => string): string {
    const then = new Date(iso).getTime()
    if (Number.isNaN(then)) return iso
    const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000))
    if (diffSec < 60) return t('sessions.justNow')
    if (diffSec < 3600) return t('sessions.minutesAgo', { count: Math.floor(diffSec / 60) })
    if (diffSec < 86400) return t('sessions.hoursAgo', { count: Math.floor(diffSec / 3600) })
    return t('sessions.daysAgo', { count: Math.floor(diffSec / 86400) })
}

function shortId(id: string | null): string {
    if (!id) return '—'
    return id.length > 8 ? `${id.substring(0, 8)}…` : id
}

export default function AuthSessionsPage() {
    const { t } = useTranslation()
    const { user } = useAuth()
    // SUPER_ADMIN omits tenantId so the backend lists every tenant's
    // sessions; tenant-scoped admins always pin to their own tenant.
    // Without this, SUPER_ADMIN saw only the system-tenant's (empty)
    // list because user.tenantId is the system tenant id.
    const isSuperAdmin = !!user?.isSuperAdmin?.()
    const tenantId = isSuperAdmin ? '' : (user?.tenantId ?? '')

    const [statusFilter, setStatusFilter] = useState<string>('')
    const [cancelTarget, setCancelTarget] = useState<string | null>(null)
    const [cancelInFlight, setCancelInFlight] = useState(false)
    const [toast, setToast] = useState<{ severity: 'success' | 'error'; message: string } | null>(
        null
    )

    const statusFilterArr = useMemo<AuthSessionStatusValue[] | undefined>(() => {
        return statusFilter ? [statusFilter as AuthSessionStatusValue] : undefined
    }, [statusFilter])

    const {
        sessions,
        totalElements,
        page,
        size,
        loading,
        error,
        setPage,
        setSize,
        cancelSession,
    } = useAuthSessionsList(tenantId, statusFilterArr, undefined, 20, isSuperAdmin)

    const handleCancelConfirm = async () => {
        if (!cancelTarget) return
        setCancelInFlight(true)
        try {
            await cancelSession(cancelTarget)
            setToast({ severity: 'success', message: t('authSessionsPage.cancelSuccess') })
            setCancelTarget(null)
        } catch {
            setToast({ severity: 'error', message: t('authSessionsPage.cancelFailed') })
        } finally {
            setCancelInFlight(false)
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
                            {t('authSessionsPage.title')}
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            {t('authSessionsPage.subtitle')}
                        </Typography>
                    </Box>
                </motion.div>

                {!tenantId && !isSuperAdmin && (
                    <Alert severity="warning" sx={{ mb: 3 }}>
                        {t('authSessionsPage.tenantUnavailable')}
                    </Alert>
                )}
                {isSuperAdmin && (
                    <Alert severity="info" sx={{ mb: 3 }}>
                        {t('authSessionsPage.platformWideNotice')}
                    </Alert>
                )}

                <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <FormControl size="small" sx={{ minWidth: 220 }}>
                        <InputLabel>{t('authSessionsPage.filterByStatus')}</InputLabel>
                        <Select
                            value={statusFilter}
                            label={t('authSessionsPage.filterByStatus')}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <MenuItem value="">{t('authSessionsPage.allStatuses')}</MenuItem>
                            <MenuItem value="CREATED">{t('authSessionsPage.statusCreated')}</MenuItem>
                            <MenuItem value="IN_PROGRESS">{t('authSessionsPage.statusInProgress')}</MenuItem>
                            <MenuItem value="COMPLETED">{t('authSessionsPage.statusCompleted')}</MenuItem>
                            <MenuItem value="FAILED">{t('authSessionsPage.statusFailed')}</MenuItem>
                            <MenuItem value="EXPIRED">{t('authSessionsPage.statusExpired')}</MenuItem>
                            <MenuItem value="CANCELLED">{t('authSessionsPage.statusCancelled')}</MenuItem>
                        </Select>
                    </FormControl>
                    <Typography variant="body2" color="text.secondary">
                        {t('authSessionsPage.countLabel', { count: totalElements })}
                    </Typography>
                    {loading && <CircularProgress size={18} aria-label={t('authSessionsPage.loadingAriaLabel')} />}
                </Box>

                {error && (
                    <Alert severity="error" sx={{ mb: 3 }}>
                        {formatApiError(error, t)}
                    </Alert>
                )}

                {!loading && sessions.length === 0 ? (
                    <Card>
                        <CardContent sx={{ textAlign: 'center', py: 6 }}>
                            <Typography variant="h6" color="text.secondary">
                                {t('authSessionsPage.emptyTitle')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                {t('authSessionsPage.emptyDescription')}
                            </Typography>
                        </CardContent>
                    </Card>
                ) : (
                    <Paper
                        elevation={0}
                        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
                    >
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>{t('authSessionsPage.columnSessionId')}</TableCell>
                                        <TableCell>{t('authSessionsPage.columnUserId')}</TableCell>
                                        <TableCell>{t('authSessionsPage.columnOperation')}</TableCell>
                                        <TableCell>{t('authSessionsPage.columnStatus')}</TableCell>
                                        <TableCell>{t('authSessionsPage.columnStep')}</TableCell>
                                        <TableCell>{t('authSessionsPage.columnIpAddress')}</TableCell>
                                        <TableCell>{t('authSessionsPage.columnAge')}</TableCell>
                                        <TableCell align="right">{t('authSessionsPage.columnActions')}</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {sessions.map((s) => (
                                        <TableRow key={s.id} hover>
                                            <TableCell>
                                                <Typography variant="caption" fontFamily="monospace">
                                                    {shortId(s.id)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="caption" fontFamily="monospace">
                                                    {shortId(s.userId)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip label={s.operationType} size="small" variant="outlined" />
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={s.status}
                                                    size="small"
                                                    color={getStatusColor(s.status)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {t('authSessionsPage.stepFormat', {
                                                    current: s.currentStep,
                                                    total: s.totalSteps,
                                                })}
                                            </TableCell>
                                            <TableCell>{s.ipAddress || t('authSessionsPage.ipUnknown')}</TableCell>
                                            <TableCell>{formatRelativeAge(s.createdAt, t)}</TableCell>
                                            <TableCell align="right">
                                                {(s.status === 'CREATED' || s.status === 'IN_PROGRESS') && (
                                                    <Button
                                                        size="small"
                                                        color="warning"
                                                        variant="outlined"
                                                        onClick={() => setCancelTarget(s.id)}
                                                    >
                                                        {t('authSessionsPage.cancelButton')}
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        <TablePagination
                            component="div"
                            count={totalElements}
                            page={page}
                            onPageChange={(_, newPage) => setPage(newPage)}
                            rowsPerPage={size}
                            onRowsPerPageChange={(e) => setSize(parseInt(e.target.value, 10))}
                            rowsPerPageOptions={[10, 20, 50, 100]}
                        />
                    </Paper>
                )}

                <Dialog open={cancelTarget !== null} onClose={() => setCancelTarget(null)}>
                    <DialogTitle>{t('authSessionsPage.cancelTitle')}</DialogTitle>
                    <DialogContent>
                        <DialogContentText>
                            {t('authSessionsPage.cancelDescription')}
                        </DialogContentText>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setCancelTarget(null)} disabled={cancelInFlight}>
                            {t('common.cancel', 'Cancel')}
                        </Button>
                        <Button
                            color="warning"
                            variant="contained"
                            onClick={handleCancelConfirm}
                            disabled={cancelInFlight}
                            startIcon={cancelInFlight ? <CircularProgress size={14} /> : undefined}
                        >
                            {t('authSessionsPage.cancelButton')}
                        </Button>
                    </DialogActions>
                </Dialog>

                <Snackbar
                    open={toast !== null}
                    autoHideDuration={4000}
                    onClose={() => setToast(null)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                >
                    {toast ? (
                        <Alert severity={toast.severity} onClose={() => setToast(null)}>
                            {toast.message}
                        </Alert>
                    ) : undefined}
                </Snackbar>
            </Box>
        </PageTransition>
    )
}
