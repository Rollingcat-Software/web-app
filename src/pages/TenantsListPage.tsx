import {useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {
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
    TableRow,
    TextField,
    Typography,
} from '@mui/material'
import {Add, Delete, Edit, Search, Visibility,} from '@mui/icons-material'
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
    const {tenants, loading, deleteTenant} = useTenants()
    const [searchQuery, setSearchQuery] = useState('')

    const filteredTenants = tenants.filter(
        (tenant) =>
            tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            tenant.domain.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleDelete = async (id: number) => {
        if (window.confirm('Are you sure you want to delete this tenant? All associated users will be affected.')) {
            try {
                await deleteTenant(id)
            } catch (error) {
                console.error('Failed to delete tenant:', error)
            }
        }
    }

    const getUserPercentage = (current: number, max: number): number => {
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

            <Paper sx={{p: 2, mb: 3}}>
                <TextField
                    fullWidth
                    placeholder="Search tenants by name or domain..."
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
                                <TableCell>Domain</TableCell>
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
                                        <TableCell>{tenant.domain}</TableCell>
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
                                                onClick={() => navigate(`/tenants/${tenant.id}`)}
                                                title="View details"
                                            >
                                                <Visibility fontSize="small"/>
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                onClick={() => navigate(`/tenants/${tenant.id}/edit`)}
                                                title="Edit tenant"
                                            >
                                                <Edit fontSize="small"/>
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                onClick={() => handleDelete(tenant.id)}
                                                color="error"
                                                title="Delete tenant"
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
        </Box>
    )
}
