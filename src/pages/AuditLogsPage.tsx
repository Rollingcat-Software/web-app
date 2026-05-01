import { useEffect, useMemo, useState } from 'react'
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Chip,
    CircularProgress,
    InputAdornment,
    LinearProgress,
    ListSubheader,
    MenuItem,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TextField,
    Typography,
} from '@mui/material'
import {
    Delete,
    Edit,
    ExpandMore,
    Login,
    Logout,
    Person,
    Refresh,
    Search,
    Security,
    Settings,
    Warning,
} from '@mui/icons-material'
import { useAuditLogs } from '@features/auditLogs'
import { useTranslation } from 'react-i18next'
import { formatLocale } from '@utils/dateLocale'
import { formatApiError } from '@utils/formatApiError'

function getActionIcon(action: string) {
    if (action.includes('LOGIN')) return <Login fontSize="small" />
    if (action.includes('LOGOUT')) return <Logout fontSize="small" />
    if (action.includes('TOKEN_REFRESH')) return <Refresh fontSize="small" />
    if (action.includes('CREATED')) return <Person fontSize="small" />
    if (action.includes('UPDATED') || action.includes('CHANGED')) return <Edit fontSize="small" />
    if (action.includes('DELETED') || action.includes('REMOVED')) return <Delete fontSize="small" />
    if (action.includes('FAILED')) return <Warning fontSize="small" />
    if (action.includes('SETTINGS')) return <Settings fontSize="small" />
    if (action.includes('BIOMETRIC') || action.includes('VERIFICATION')) return <Security fontSize="small" />
    if (action.includes('ROLE') || action.includes('PERMISSION')) return <Security fontSize="small" />
    return <Security fontSize="small" />
}

function getActionColor(action: string): 'success' | 'error' | 'warning' | 'info' | 'default' {
    if (action.includes('LOGIN') && !action.includes('FAILED')) return 'success'
    if (action.includes('CREATED') || action.includes('ENROLLED') || action.includes('VERIFIED')) return 'info'
    if (action.includes('DELETED') || action.includes('REMOVED')) return 'error'
    if (action.includes('FAILED')) return 'error'
    if (action.includes('UPDATED') || action.includes('CHANGED') || action.includes('SETTINGS')) return 'warning'
    if (action.includes('ASSIGNED') || action.includes('ADDED')) return 'info'
    return 'default'
}

/** Grouped action types for the filter dropdown with subheaders */
const GROUPED_ACTION_ITEMS: Array<{ type: 'header'; labelKey: string } | { type: 'action'; value: string }> = [
    { type: 'action', value: 'ALL' },
    { type: 'header', labelKey: 'auditLogs.groups.authentication' },
    { type: 'action', value: 'USER_LOGIN' },
    { type: 'action', value: 'USER_LOGOUT' },
    { type: 'action', value: 'USER_LOGIN_FAILED' },
    { type: 'action', value: 'TOKEN_REFRESH' },
    { type: 'action', value: 'PASSWORD_CHANGE' },
    { type: 'action', value: 'PASSWORD_RESET_REQUEST' },
    { type: 'action', value: 'PASSWORD_RESET' },
    { type: 'header', labelKey: 'auditLogs.groups.userManagement' },
    { type: 'action', value: 'USER_CREATED' },
    { type: 'action', value: 'USER_UPDATED' },
    { type: 'action', value: 'USER_DELETED' },
    { type: 'action', value: 'USER_STATUS_CHANGED' },
    { type: 'action', value: 'USER_ROLE_ASSIGNED' },
    { type: 'action', value: 'USER_ROLE_REMOVED' },
    { type: 'header', labelKey: 'auditLogs.groups.tenantManagement' },
    { type: 'action', value: 'TENANT_CREATED' },
    { type: 'action', value: 'TENANT_UPDATED' },
    { type: 'action', value: 'TENANT_DELETED' },
    { type: 'action', value: 'TENANT_STATUS_CHANGED' },
    { type: 'header', labelKey: 'auditLogs.groups.roleManagement' },
    { type: 'action', value: 'ROLE_CREATED' },
    { type: 'action', value: 'ROLE_UPDATED' },
    { type: 'action', value: 'ROLE_DELETED' },
    { type: 'action', value: 'PERMISSION_ADDED' },
    { type: 'action', value: 'PERMISSION_REMOVED' },
    { type: 'header', labelKey: 'auditLogs.groups.biometric' },
    { type: 'action', value: 'BIOMETRIC_ENROLLED' },
    { type: 'action', value: 'BIOMETRIC_VERIFIED' },
    { type: 'action', value: 'BIOMETRIC_VERIFICATION_FAILED' },
    { type: 'action', value: 'BIOMETRIC_DELETED' },
    { type: 'header', labelKey: 'auditLogs.groups.settings' },
    { type: 'action', value: 'SETTINGS_UPDATED' },
    { type: 'action', value: 'SECURITY_SETTINGS_UPDATED' },
    { type: 'action', value: 'NOTIFICATION_SETTINGS_UPDATED' },
    { type: 'action', value: 'APPEARANCE_SETTINGS_UPDATED' },
]

export default function AuditLogsPage() {
    const { t, i18n } = useTranslation()
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [actionFilter, setActionFilter] = useState<string>('ALL')
    const [page, setPage] = useState(0)
    const [rowsPerPage, setRowsPerPage] = useState(25)

    const filters = actionFilter === 'ALL' ? undefined : { action: actionFilter }
    const { auditLogs, loading, error } = useAuditLogs(filters)

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery)
            setPage(0)
        }, 300)
        return () => clearTimeout(timer)
    }, [searchQuery])

    // Reset page when filter changes
    useEffect(() => {
        setPage(0)
    }, [actionFilter])

    const filteredLogs = useMemo(() => {
        if (!debouncedSearch) return auditLogs
        const query = debouncedSearch.toLowerCase()
        return auditLogs.filter(
            (log) =>
                log.action.toLowerCase().includes(query) ||
                log.entityType.toLowerCase().includes(query) ||
                log.ipAddress.includes(query) ||
                log.userId.toString().includes(query)
        )
    }, [auditLogs, debouncedSearch])

    const paginatedLogs = useMemo(() => {
        const start = page * rowsPerPage
        return filteredLogs.slice(start, start + rowsPerPage)
    }, [filteredLogs, page, rowsPerPage])

    return (
        <Box>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" gutterBottom fontWeight={600}>
                    {t('auditLogs.title')}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    {t('auditLogs.subtitle')}
                </Typography>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {formatApiError(error, t)}
                </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexDirection: { xs: 'column', sm: 'row' } }}>
                <Paper sx={{ p: 2, flex: 1 }}>
                    <TextField
                        fullWidth
                        placeholder={t('auditLogs.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Search />
                                </InputAdornment>
                            ),
                        }}
                    />
                    {searchQuery !== debouncedSearch && (
                        <LinearProgress sx={{ mt: 1, borderRadius: 1, height: 2 }} />
                    )}
                </Paper>

                <Paper sx={{ p: 2, minWidth: { xs: '100%', sm: 250 } }}>
                    <TextField
                        select
                        fullWidth
                        label={t('auditLogs.actionTypeLabel')}
                        value={actionFilter}
                        onChange={(e) => setActionFilter(e.target.value)}
                    >
                        {GROUPED_ACTION_ITEMS.map((item, idx) =>
                            item.type === 'header' ? (
                                <ListSubheader key={`header-${idx}`}>{t(item.labelKey)}</ListSubheader>
                            ) : (
                                <MenuItem key={item.value} value={item.value}>
                                    {t(`auditLogs.actions.${item.value}`, item.value.replace(/_/g, ' '))}
                                </MenuItem>
                            )
                        )}
                    </TextField>
                </Paper>
            </Box>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                    <CircularProgress aria-label={t('auditLogs.loadingAriaLabel')} />
                </Box>
            ) : (
                <Paper>
                    <TableContainer sx={{ overflowX: 'auto' }}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('auditLogs.columnTimestamp')}</TableCell>
                                    <TableCell>{t('auditLogs.columnAction')}</TableCell>
                                    <TableCell>{t('auditLogs.columnUserId')}</TableCell>
                                    <TableCell>{t('auditLogs.columnEntity')}</TableCell>
                                    <TableCell>{t('auditLogs.columnIpAddress')}</TableCell>
                                    <TableCell>{t('auditLogs.columnDetails')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paginatedLogs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} align="center">
                                            <Typography color="text.secondary" py={4}>
                                                {debouncedSearch || actionFilter !== 'ALL'
                                                    ? t('auditLogs.noMatchingLogs')
                                                    : t('auditLogs.noLogsFound')}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedLogs.map((log) => (
                                        <TableRow key={log.id} hover>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    {formatLocale(log.createdAt, i18n.language, 'PP')}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {formatLocale(log.createdAt, i18n.language, 'pp')}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    icon={getActionIcon(log.action)}
                                                    label={log.action.replace(/_/g, ' ')}
                                                    size="small"
                                                    color={getActionColor(log.action)}
                                                    sx={{ fontWeight: 500 }}
                                                />
                                            </TableCell>
                                            <TableCell>{log.userId}</TableCell>
                                            <TableCell>
                                                <Typography variant="body2">{log.entityType}</Typography>
                                                {log.entityId && (
                                                    <Typography variant="caption" color="text.secondary">
                                                        {t('auditLogs.entityIdPrefix', { id: log.entityId })}
                                                    </Typography>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontFamily="monospace">
                                                    {log.ipAddress}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                {log.details && Object.keys(log.details).length > 0 ? (
                                                    <Accordion
                                                        sx={{
                                                            boxShadow: 'none',
                                                            '&:before': { display: 'none' },
                                                            backgroundColor: 'transparent',
                                                        }}
                                                    >
                                                        <AccordionSummary
                                                            expandIcon={<ExpandMore fontSize="small" />}
                                                            sx={{ minHeight: 0, px: 1, py: 0 }}
                                                        >
                                                            <Typography variant="caption" color="primary">
                                                                {t('auditLogs.viewDetails')}
                                                            </Typography>
                                                        </AccordionSummary>
                                                        <AccordionDetails sx={{ px: 1, py: 1 }}>
                                                            <Box
                                                                component="pre"
                                                                sx={{
                                                                    m: 0,
                                                                    p: 1,
                                                                    backgroundColor: 'action.hover',
                                                                    borderRadius: 1,
                                                                    fontSize: '0.75rem',
                                                                    overflow: 'auto',
                                                                    fontFamily: 'monospace',
                                                                    maxHeight: 200,
                                                                }}
                                                            >
                                                                {JSON.stringify(log.details, null, 2)}
                                                            </Box>
                                                        </AccordionDetails>
                                                    </Accordion>
                                                ) : (
                                                    <Typography variant="caption" color="text.secondary">
                                                        -
                                                    </Typography>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <TablePagination
                        component="div"
                        count={filteredLogs.length}
                        page={page}
                        onPageChange={(_, newPage) => setPage(newPage)}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={(e) => {
                            setRowsPerPage(parseInt(e.target.value, 10))
                            setPage(0)
                        }}
                        rowsPerPageOptions={[10, 25, 50, 100]}
                    />
                </Paper>
            )}
        </Box>
    )
}
