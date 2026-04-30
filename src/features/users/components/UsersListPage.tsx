import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    IconButton,
    InputAdornment,
    LinearProgress,
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
import { Add, Delete, Edit, Search, Visibility } from '@mui/icons-material'
import { useUsers } from '../hooks/useUsers'
import { UserRole, UserStatus } from '@domain/models/User'
import { ConfirmDialog } from '@components/ConfirmDialog'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { dateFnsLocale } from '@utils/dateLocale'
import { formatApiError } from '@utils/formatApiError'

function getStatusColor(status: UserStatus): 'success' | 'warning' | 'error' | 'default' {
    switch (status) {
        case UserStatus.ACTIVE:
            return 'success'
        case UserStatus.PENDING_ENROLLMENT:
            return 'warning'
        case UserStatus.SUSPENDED:
        case UserStatus.LOCKED:
            return 'error'
        default:
            return 'default'
    }
}

function getRoleColor(role: UserRole): 'primary' | 'secondary' | 'default' {
    switch (role) {
        case UserRole.SUPER_ADMIN:
            return 'secondary'
        case UserRole.ADMIN:
            return 'primary'
        default:
            return 'default'
    }
}

export default function UsersListPage() {
    const navigate = useNavigate()
    const { t, i18n } = useTranslation()
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [page, setPage] = useState(0)
    const [rowsPerPage, setRowsPerPage] = useState(10)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
    const [deletingUserName, setDeletingUserName] = useState('')
    const [isDeleting, setIsDeleting] = useState(false)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    const { users, total, loading, error, deleteUser, refetch } = useUsers()

    // Debounce search input and use backend search when query is provided
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery)
            setPage(0) // Reset to first page when searching
        }, 300)
        return () => clearTimeout(timer)
    }, [searchQuery])

    // Trigger backend search when debounced search changes
    useEffect(() => {
        if (debouncedSearch) {
            refetch({ search: debouncedSearch })
        } else {
            refetch()
        }
    }, [debouncedSearch, refetch])

    // Clear success message after 3 seconds
    useEffect(() => {
        if (successMessage) {
            const timer = setTimeout(() => setSuccessMessage(null), 3000)
            return () => clearTimeout(timer)
        }
    }, [successMessage])

    // Users are now filtered server-side when search is active
    const filteredUsers = users

    const paginatedUsers = useMemo(() => {
        const start = page * rowsPerPage
        return filteredUsers.slice(start, start + rowsPerPage)
    }, [filteredUsers, page, rowsPerPage])

    const handleOpenDeleteDialog = useCallback((userId: string, userName: string) => {
        setDeletingUserId(userId)
        setDeletingUserName(userName)
        setDeleteDialogOpen(true)
    }, [])

    const handleCloseDeleteDialog = useCallback(() => {
        setDeleteDialogOpen(false)
        setDeletingUserId(null)
        setDeletingUserName('')
    }, [])

    const handleConfirmDelete = useCallback(async () => {
        if (!deletingUserId) return
        setIsDeleting(true)
        try {
            await deleteUser(deletingUserId)
            await refetch()
            setSuccessMessage(`User "${deletingUserName}" has been deleted successfully.`)
            handleCloseDeleteDialog()
        } catch {
            // Error handled by hook
        } finally {
            setIsDeleting(false)
        }
    }, [deletingUserId, deletingUserName, deleteUser, refetch, handleCloseDeleteDialog])

    const handleChangePage = useCallback((_: unknown, newPage: number) => {
        setPage(newPage)
    }, [])

    const handleChangeRowsPerPage = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10))
        setPage(0)
    }, [])

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box component="header">
                    <Typography variant="h4" gutterBottom fontWeight={600}>
                        {t('users.pageTitle')}
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        {t('users.pageSubtitle')}
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => navigate('/users/create')}
                >
                    {t('users.addButton')}
                </Button>
            </Box>

            {successMessage && (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>
                    {successMessage}
                </Alert>
            )}

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {formatApiError(error, t)}
                </Alert>
            )}

            <Paper sx={{ p: 2, mb: 3 }}>
                <TextField
                    fullWidth
                    placeholder={t('users.searchPlaceholder')}
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

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                    <CircularProgress aria-label="Loading users" />
                </Box>
            ) : (
                <Paper>
                    <TableContainer sx={{ overflowX: 'auto' }}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('users.columns.name')}</TableCell>
                                    <TableCell>{t('users.columns.email')}</TableCell>
                                    <TableCell>{t('users.columns.role')}</TableCell>
                                    <TableCell>{t('users.columns.status')}</TableCell>
                                    <TableCell>{t('users.columns.lastLogin')}</TableCell>
                                    <TableCell align="right">{t('users.columns.actions')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paginatedUsers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} align="center">
                                            <Typography color="text.secondary" py={4}>
                                                {debouncedSearch ? t('users.emptySearch') : t('users.empty')}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedUsers.map((user) => (
                                        <TableRow key={user.id} hover>
                                            <TableCell>{user.fullName}</TableCell>
                                            <TableCell>{user.email}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={user.role}
                                                    size="small"
                                                    color={getRoleColor(user.role)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={user.status.replace('_', ' ')}
                                                    size="small"
                                                    color={getStatusColor(user.status)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {user.lastLoginAt
                                                    ? format(user.lastLoginAt, 'MMM dd, yyyy HH:mm', { locale: dateFnsLocale(i18n.language) })
                                                    : 'Never'}
                                            </TableCell>
                                            <TableCell align="right">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => navigate(`/users/${user.id}`)}
                                                    aria-label={`View details for ${user.fullName}`}
                                                >
                                                    <Visibility fontSize="small" />
                                                </IconButton>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => navigate(`/users/${user.id}/edit`)}
                                                    aria-label={`Edit ${user.fullName}`}
                                                >
                                                    <Edit fontSize="small" />
                                                </IconButton>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleOpenDeleteDialog(user.id, user.fullName)}
                                                    color="error"
                                                    aria-label={`Delete ${user.fullName}`}
                                                >
                                                    <Delete fontSize="small" />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <TablePagination
                        component="div"
                        count={total || filteredUsers.length}
                        page={page}
                        onPageChange={handleChangePage}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                        rowsPerPageOptions={[5, 10, 25, 50]}
                    />
                </Paper>
            )}

            <ConfirmDialog
                open={deleteDialogOpen}
                title="Delete User"
                message={`Are you sure you want to delete "${deletingUserName}"? This action cannot be undone.`}
                confirmLabel="Delete"
                confirmColor="error"
                onConfirm={handleConfirmDelete}
                onCancel={handleCloseDeleteDialog}
                loading={isDeleting}
            />
        </Box>
    )
}
