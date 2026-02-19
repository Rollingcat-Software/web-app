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

export default function RolesListPage() {
    const navigate = useNavigate()
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
                const message = err instanceof Error ? err.message : 'Failed to delete role'
                setActionError(message)
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
                        Roles & Permissions
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Manage roles and their permissions
                    </Typography>
                </div>
                <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/roles/create')}>
                    Add Role
                </Button>
            </Box>

            {actionError && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
                    {actionError}
                </Alert>
            )}

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    Failed to load roles: {error.message}
                </Alert>
            )}

            <Paper sx={{ p: 2, mb: 3 }}>
                <TextField
                    fullWidth
                    placeholder="Search roles by name or description..."
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
                                <TableCell>Role Name</TableCell>
                                <TableCell>Description</TableCell>
                                <TableCell>Permissions</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Created</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredRoles.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} align="center">
                                        <Typography color="text.secondary" py={4}>
                                            No roles found
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
                                                    <Tooltip title="System role - cannot be modified">
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
                                                label={`${role.permissionCount} permissions`}
                                                size="small"
                                                variant="outlined"
                                                color={role.permissionCount > 0 ? 'primary' : 'default'}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={role.active ? 'Active' : 'Inactive'}
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
                                                aria-label={`Edit ${role.name}`}
                                            >
                                                <Edit fontSize="small" />
                                            </IconButton>
                                            {!role.systemRole && (
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleDeleteClick(role.id, role.name)}
                                                    color="error"
                                                    aria-label={`Delete ${role.name}`}
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
                <DialogTitle id="delete-role-dialog-title">Delete Role</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete <strong>{deletingName}</strong>? Users assigned to this role
                        will lose their permissions.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDeleteCancel}>Cancel</Button>
                    <Button onClick={handleDeleteConfirm} color="error" variant="contained">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}
