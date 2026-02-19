import {useState} from 'react'
import {useNavigate} from 'react-router-dom'
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
    LinearProgress,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material'
import {Add, Block, CheckCircle, Delete, Edit, Search, Visibility,} from '@mui/icons-material'
import {useTenants} from '@features/tenants'
import {TenantStatus} from '@domain/models/Tenant'
import {format} from 'date-fns'

function getStatusColor(status: TenantStatus): 'success' | 'warning' | 'error' {
    switch (status) {
        case TenantStatus.ACTIVE:
            return 'success'
        case TenantStatus.TRIAL:
            return 'warning'
        case TenantStatus.SUSPENDED:
            return 'error'
        default:
            return 'warning'
    }
}

export default function TenantsListPage() {
    const navigate = useNavigate()
    const {tenants, loading, deleteTenant, activateTenant, suspendTenant} = useTenants()
    const [searchQuery, setSearchQuery] = useState('')
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [deletingName, setDeletingName] = useState('')
    const [deleteError, setDeleteError] = useState<string | null>(null)

    const filteredTenants = tenants.filter(
        (tenant) =>
            tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            tenant.slug.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleDeleteClick = (id: string, name: string) => {
        setDeletingId(id)
        setDeletingName(name)
        setDeleteDialogOpen(true)
    }

    const handleDeleteConfirm = async () => {
        if (deletingId) {
            try {
                await deleteTenant(deletingId)
                setDeleteError(null)
            } catch (err) {
                setDeleteError(err instanceof Error ? err.message : 'Failed to delete tenant')
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

    const getUserPercentage = (current: number, max: number): number => {
        if (max === 0) return 0
        return (current / max) * 100
    }

    return (
        <Box>
            <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3}}>
                <div>
                    <Typography variant="h4" gutterBottom fontWeight={600}>
                        Tenants
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Manage tenant organizations and subscriptions
                    </Typography>
                </div>
                <Button
                    variant="contained"
                    startIcon={<Add/>}
                    onClick={() => navigate('/tenants/create')}
                >
                    Add Tenant
                </Button>
            </Box>

            {deleteError && (
                <Alert severity="error" sx={{mb: 2}} onClose={() => setDeleteError(null)}>
                    {deleteError}
                </Alert>
            )}

            <Paper sx={{p: 2, mb: 3}}>
                <TextField
                    fullWidth
                    placeholder="Search tenants by name or slug..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <Search/>
                            </InputAdornment>
                        ),
                    }}
                />
            </Paper>

            {loading ? (
                <Box sx={{display: 'flex', justifyContent: 'center', py: 8}}>
                    <CircularProgress/>
                </Box>
            ) : (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>Slug</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Users</TableCell>
                                <TableCell>Created</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredTenants.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} align="center">
                                        <Typography color="text.secondary" py={4}>
                                            No tenants found
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredTenants.map((tenant) => (
                                    <TableRow key={tenant.id} hover>
                                        <TableCell>
                                            <Typography fontWeight={500}>{tenant.name}</Typography>
                                        </TableCell>
                                        <TableCell>{tenant.slug}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={tenant.status}
                                                size="small"
                                                color={getStatusColor(tenant.status)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Box>
                                                <Typography variant="body2" sx={{mb: 0.5}}>
                                                    {tenant.currentUsers} / {tenant.maxUsers}
                                                </Typography>
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={getUserPercentage(tenant.currentUsers, tenant.maxUsers)}
                                                    aria-label={`${tenant.currentUsers} of ${tenant.maxUsers} users`}
                                                    sx={{
                                                        height: 6,
                                                        borderRadius: 1,
                                                        backgroundColor: 'grey.200',
                                                    }}
                                                />
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            {format(new Date(tenant.createdAt), 'MMM dd, yyyy')}
                                        </TableCell>
                                        <TableCell align="right">
                                            <IconButton
                                                size="small"
                                                onClick={() => navigate(`/tenants/${tenant.id}/edit`)}
                                                aria-label="View details"
                                            >
                                                <Visibility fontSize="small"/>
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                onClick={() => navigate(`/tenants/${tenant.id}/edit`)}
                                                aria-label="Edit tenant"
                                            >
                                                <Edit fontSize="small"/>
                                            </IconButton>
                                            {tenant.status === TenantStatus.SUSPENDED ? (
                                                <IconButton
                                                    size="small"
                                                    onClick={() => activateTenant(tenant.id).catch(() => {})}
                                                    color="success"
                                                    aria-label="Activate tenant"
                                                >
                                                    <CheckCircle fontSize="small"/>
                                                </IconButton>
                                            ) : tenant.status === TenantStatus.ACTIVE ? (
                                                <IconButton
                                                    size="small"
                                                    onClick={() => suspendTenant(tenant.id).catch(() => {})}
                                                    color="warning"
                                                    aria-label="Suspend tenant"
                                                >
                                                    <Block fontSize="small"/>
                                                </IconButton>
                                            ) : null}
                                            <IconButton
                                                size="small"
                                                onClick={() => handleDeleteClick(tenant.id, tenant.name)}
                                                color="error"
                                                aria-label="Delete tenant"
                                            >
                                                <Delete fontSize="small"/>
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <Dialog
                open={deleteDialogOpen}
                onClose={handleDeleteCancel}
                aria-labelledby="delete-tenant-dialog-title"
            >
                <DialogTitle id="delete-tenant-dialog-title">Delete Tenant</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete <strong>{deletingName}</strong>? All associated users will be affected. This action cannot be undone.
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
