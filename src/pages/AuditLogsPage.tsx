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
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
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

const ACTION_LABELS: Record<string, string> = {
    ALL: 'All Actions',
    // Authentication
    USER_LOGIN: 'User Login',
    USER_LOGOUT: 'User Logout',
    USER_LOGIN_FAILED: 'Login Failed',
    TOKEN_REFRESH: 'Token Refresh',
    PASSWORD_CHANGE: 'Password Change',
    PASSWORD_RESET_REQUEST: 'Password Reset Request',
    PASSWORD_RESET: 'Password Reset',
    // User management
    USER_CREATED: 'User Created',
    USER_UPDATED: 'User Updated',
    USER_DELETED: 'User Deleted',
    USER_STATUS_CHANGED: 'User Status Changed',
    USER_ROLE_ASSIGNED: 'User Role Assigned',
    USER_ROLE_REMOVED: 'User Role Removed',
    // Tenant management
    TENANT_CREATED: 'Tenant Created',
    TENANT_UPDATED: 'Tenant Updated',
    TENANT_DELETED: 'Tenant Deleted',
    TENANT_STATUS_CHANGED: 'Tenant Status Changed',
    // Role management
    ROLE_CREATED: 'Role Created',
    ROLE_UPDATED: 'Role Updated',
    ROLE_DELETED: 'Role Deleted',
    PERMISSION_ADDED: 'Permission Added',
    PERMISSION_REMOVED: 'Permission Removed',
    // Biometric
    BIOMETRIC_ENROLLED: 'Biometric Enrolled',
    BIOMETRIC_VERIFIED: 'Biometric Verified',
    BIOMETRIC_VERIFICATION_FAILED: 'Biometric Verification Failed',
    BIOMETRIC_DELETED: 'Biometric Deleted',
    // Settings
    SETTINGS_UPDATED: 'Settings Updated',
    SECURITY_SETTINGS_UPDATED: 'Security Settings Updated',
    NOTIFICATION_SETTINGS_UPDATED: 'Notification Settings Updated',
    APPEARANCE_SETTINGS_UPDATED: 'Appearance Settings Updated',
}

/** Grouped action types for the filter dropdown with subheaders */
const GROUPED_ACTION_ITEMS: Array<{ type: 'header'; label: string } | { type: 'action'; value: string }> = [
    { type: 'action', value: 'ALL' },
    { type: 'header', label: 'Authentication' },
    { type: 'action', value: 'USER_LOGIN' },
    { type: 'action', value: 'USER_LOGOUT' },
    { type: 'action', value: 'USER_LOGIN_FAILED' },
    { type: 'action', value: 'TOKEN_REFRESH' },
    { type: 'action', value: 'PASSWORD_CHANGE' },
    { type: 'action', value: 'PASSWORD_RESET_REQUEST' },
    { type: 'action', value: 'PASSWORD_RESET' },
    { type: 'header', label: 'User Management' },
    { type: 'action', value: 'USER_CREATED' },
    { type: 'action', value: 'USER_UPDATED' },
    { type: 'action', value: 'USER_DELETED' },
    { type: 'action', value: 'USER_STATUS_CHANGED' },
    { type: 'action', value: 'USER_ROLE_ASSIGNED' },
    { type: 'action', value: 'USER_ROLE_REMOVED' },
    { type: 'header', label: 'Tenant Management' },
    { type: 'action', value: 'TENANT_CREATED' },
    { type: 'action', value: 'TENANT_UPDATED' },
    { type: 'action', value: 'TENANT_DELETED' },
    { type: 'action', value: 'TENANT_STATUS_CHANGED' },
    { type: 'header', label: 'Role Management' },
    { type: 'action', value: 'ROLE_CREATED' },
    { type: 'action', value: 'ROLE_UPDATED' },
    { type: 'action', value: 'ROLE_DELETED' },
    { type: 'action', value: 'PERMISSION_ADDED' },
    { type: 'action', value: 'PERMISSION_REMOVED' },
    { type: 'header', label: 'Biometric' },
    { type: 'action', value: 'BIOMETRIC_ENROLLED' },
    { type: 'action', value: 'BIOMETRIC_VERIFIED' },
    { type: 'action', value: 'BIOMETRIC_VERIFICATION_FAILED' },
    { type: 'action', value: 'BIOMETRIC_DELETED' },
    { type: 'header', label: 'Settings' },
    { type: 'action', value: 'SETTINGS_UPDATED' },
    { type: 'action', value: 'SECURITY_SETTINGS_UPDATED' },
    { type: 'action', value: 'NOTIFICATION_SETTINGS_UPDATED' },
    { type: 'action', value: 'APPEARANCE_SETTINGS_UPDATED' },
]

export default function AuditLogsPage() {
    const { t } = useTranslation()
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
                    Audit Logs
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Security audit trail and activity monitoring
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
                        placeholder="Search by action, user ID, IP address..."
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
                        label="Action Type"
                        value={actionFilter}
                        onChange={(e) => setActionFilter(e.target.value)}
                    >
                        {GROUPED_ACTION_ITEMS.map((item, idx) =>
                            item.type === 'header' ? (
                                <ListSubheader key={`header-${idx}`}>{item.label}</ListSubheader>
                            ) : (
                                <MenuItem key={item.value} value={item.value}>
                                    {ACTION_LABELS[item.value] || item.value.replace(/_/g, ' ')}
                                </MenuItem>
                            )
                        )}
                    </TextField>
                </Paper>
            </Box>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                    <CircularProgress aria-label="Loading audit logs" />
                </Box>
            ) : (
                <Paper>
                    <TableContainer sx={{ overflowX: 'auto' }}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Timestamp</TableCell>
                                    <TableCell>Action</TableCell>
                                    <TableCell>User ID</TableCell>
                                    <TableCell>Entity</TableCell>
                                    <TableCell>IP Address</TableCell>
                                    <TableCell>Details</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paginatedLogs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} align="center">
                                            <Typography color="text.secondary" py={4}>
                                                {debouncedSearch || actionFilter !== 'ALL'
                                                    ? 'No audit logs match your filters'
                                                    : 'No audit logs found'}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedLogs.map((log) => (
                                        <TableRow key={log.id} hover>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    {format(new Date(log.createdAt), 'MMM dd, yyyy')}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {format(new Date(log.createdAt), 'HH:mm:ss')}
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
                                                        ID: {log.entityId}
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
                                                                View Details
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
