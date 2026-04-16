import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    IconButton,
    InputAdornment,
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
import { Add, Delete, Edit, Lock, Search, Shield } from '@mui/icons-material'
import { useRoles } from '@features/roles'
import { format } from 'date-fns'
import { Trans, useTranslation } from 'react-i18next'
import { formatApiError } from '@utils/formatApiError'

export default function RolesListPage() {
    const navigate = useNavigate()
    const { t } = useTranslation()
    const { roles, loading, error, deleteRole } = useRoles()
    const [searchQuery, setSearchQuery] = useState('')
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [deletingName, setDeletingName] = useState('')
    const [actionError, setActionError] = useState<string | null>(null)

    const filteredRoles = roles.filter(
        (role) =>
            role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            role.description.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleDeleteClick = (id: string, name: string) => {
        setDeletingId(id)
        setDeletingName(name)
        setDeleteDialogOpen(true)
    }

    const handleDeleteConfirm = async () => {
        if (deletingId) {
            try {
                await deleteRole(deletingId)
                setActionError(null)
            } catch (err) {
                setActionError(formatApiError(err, t))
            }
        }
        setDeleteDialogOpen(false)
        setDeletingId(null)
    }

    const handleDeleteCancel = () => {
        setDeleteDialogOpen(false)
        setDeletingId(null)
        setDeletingName('')
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <div>
                    <Typography variant="h4" gutterBottom fontWeight={600}>
                        {t('roles.title')}
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        {t('roles.subtitle')}
                    </Typography>
                </div>
                <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/roles/create')}>
                    {t('roles.addRole')}
                </Button>
            </Box>

            {actionError && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
                    {actionError}
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
                    placeholder={t('roles.searchPlaceholder')}
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
            </Paper>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>{t('roles.columnName')}</TableCell>
                                <TableCell>{t('roles.columnDescription')}</TableCell>
                                <TableCell>{t('roles.columnPermissions')}</TableCell>
                                <TableCell>{t('roles.columnStatus')}</TableCell>
                                <TableCell>{t('roles.columnCreated')}</TableCell>
                                <TableCell align="right">{t('roles.columnActions')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredRoles.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} align="center">
                                        <Typography color="text.secondary" py={4}>
                                            {t('roles.noRolesFound')}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredRoles.map((role) => (
                                    <TableRow key={role.id} hover>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Shield fontSize="small" color="primary" />
                                                <Typography fontWeight={500}>{role.name}</Typography>
                                                {role.systemRole && (
                                                    <Tooltip title={t('roles.systemRoleTooltip')}>
                                                        <Lock fontSize="small" color="action" />
                                                    </Tooltip>
                                                )}
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" color="text.secondary">
                                                {role.description || '-'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={t('roles.permissionCount', { count: role.permissionCount })}
                                                size="small"
                                                variant="outlined"
                                                color={role.permissionCount > 0 ? 'primary' : 'default'}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={role.active ? t('common.active') : t('common.inactive')}
                                                size="small"
                                                color={role.active ? 'success' : 'default'}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {format(new Date(role.createdAt), 'MMM dd, yyyy')}
                                        </TableCell>
                                        <TableCell align="right">
                                            <IconButton
                                                size="small"
                                                onClick={() => navigate(`/roles/${role.id}/edit`)}
                                                aria-label={t('roles.editRoleAria', { name: role.name })}
                                            >
                                                <Edit fontSize="small" />
                                            </IconButton>
                                            {!role.systemRole && (
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleDeleteClick(role.id, role.name)}
                                                    color="error"
                                                    aria-label={t('roles.deleteRoleAria', { name: role.name })}
                                                >
                                                    <Delete fontSize="small" />
                                                </IconButton>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel} aria-labelledby="delete-role-dialog-title">
                <DialogTitle id="delete-role-dialog-title">{t('roles.deleteTitle')}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        <Trans
                            i18nKey="roles.deleteConfirm"
                            values={{ name: deletingName }}
                            components={{ strong: <strong /> }}
                        />
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDeleteCancel}>{t('common.cancel')}</Button>
                    <Button onClick={handleDeleteConfirm} color="error" variant="contained">
                        {t('common.delete')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}
