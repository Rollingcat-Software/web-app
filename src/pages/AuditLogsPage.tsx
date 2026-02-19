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
    Search,
    Security,
    Settings,
    Warning,
} from '@mui/icons-material'
import { useAuditLogs } from '@features/auditLogs'
import { AUDIT_LOG_ACTION_TYPES } from '@domain/models/AuditLog'
import { format } from 'date-fns'

function getActionIcon(action: string) {
    if (action.includes('LOGIN')) return <Login fontSize="small" />
    if (action.includes('LOGOUT')) return <Logout fontSize="small" />
    if (action.includes('CREATED')) return <Person fontSize="small" />
    if (action.includes('UPDATED')) return <Edit fontSize="small" />
    if (action.includes('DELETED')) return <Delete fontSize="small" />
    if (action.includes('FAILED')) return <Warning fontSize="small" />
    if (action.includes('SETTINGS')) return <Settings fontSize="small" />
    if (action.includes('BIOMETRIC') || action.includes('VERIFICATION')) return <Security fontSize="small" />
    return <Security fontSize="small" />
}

function getActionColor(action: string): 'success' | 'error' | 'warning' | 'info' | 'default' {
    if (action.includes('LOGIN') && !action.includes('FAILED')) return 'success'
    if (action.includes('CREATED')) return 'info'
    if (action.includes('DELETED')) return 'error'
    if (action.includes('FAILED')) return 'error'
    if (action.includes('UPDATED') || action.includes('SETTINGS')) return 'warning'
    return 'default'
}

const ACTION_TYPES = ['ALL', ...AUDIT_LOG_ACTION_TYPES] as const

export default function AuditLogsPage() {
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
                    Failed to load audit logs: {error.message}
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
                        {ACTION_TYPES.map((action) => (
                            <MenuItem key={action} value={action}>
                                {action === 'ALL' ? 'All Actions' : action.replace(/_/g, ' ')}
                            </MenuItem>
                        ))}
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
