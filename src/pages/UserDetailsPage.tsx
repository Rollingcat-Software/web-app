import { Navigate, useNavigate, useParams } from 'react-router-dom'
import {
    Avatar,
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    Grid,
    Paper,
    Typography,
} from '@mui/material'
import { ArrowBack, Edit, Email, Person, Shield, Business, Schedule } from '@mui/icons-material'
import { useUser } from '@features/users'
import { UserRole, UserStatus } from '@domain/models/User'
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

interface DetailRowProps {
    icon: React.ReactNode
    label: string
    value: React.ReactNode
}

function DetailRow({ icon, label, value }: DetailRowProps) {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', py: 1.5 }}>
            <Box sx={{ color: 'text.secondary', mr: 2, display: 'flex' }}>{icon}</Box>
            <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                    {label}
                </Typography>
                <Typography variant="body1">{value}</Typography>
            </Box>
        </Box>
    )
}

export default function UserDetailsPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { t, i18n } = useTranslation()
    const { user, loading, error } = useUser(id ?? '')

    if (!id) {
        return <Navigate to="/users" replace />
    }

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress aria-label="Loading user details" />
            </Box>
        )
    }

    if (error) {
        return (
            <Box>
                <Button startIcon={<ArrowBack />} onClick={() => navigate('/users')} sx={{ mb: 2 }}>
                    Back to Users
                </Button>
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="h6" color="error" gutterBottom>
                        {t('errors.failedToLoad')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {formatApiError(error, t)}
                    </Typography>
                </Paper>
            </Box>
        )
    }

    if (!user) {
        return (
            <Box>
                <Button startIcon={<ArrowBack />} onClick={() => navigate('/users')} sx={{ mb: 2 }}>
                    Back to Users
                </Button>
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="h6" color="text.secondary">
                        User not found
                    </Typography>
                </Paper>
            </Box>
        )
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Button startIcon={<ArrowBack />} onClick={() => navigate('/users')}>
                    Back to Users
                </Button>
                <Button
                    variant="contained"
                    startIcon={<Edit />}
                    onClick={() => navigate(`/users/${id}/edit`)}
                >
                    Edit User
                </Button>
            </Box>

            <Grid container spacing={3}>
                {/* Profile Card */}
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 3, textAlign: 'center' }}>
                        <Avatar
                            sx={{
                                width: 100,
                                height: 100,
                                mx: 'auto',
                                mb: 2,
                                bgcolor: 'primary.main',
                                fontSize: '2.5rem',
                            }}
                        >
                            {user.firstName[0]}
                            {user.lastName[0]}
                        </Avatar>
                        <Typography variant="h5" fontWeight={600} gutterBottom>
                            {user.fullName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            {user.email}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mt: 2 }}>
                            <Chip label={user.role} color={getRoleColor(user.role)} size="small" />
                            <Chip
                                label={user.status.replace('_', ' ')}
                                color={getStatusColor(user.status)}
                                size="small"
                            />
                        </Box>
                    </Paper>
                </Grid>

                {/* Details Card */}
                <Grid item xs={12} md={8}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" fontWeight={600} gutterBottom>
                            Account Information
                        </Typography>
                        <Divider sx={{ mb: 2 }} />

                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <DetailRow
                                    icon={<Person />}
                                    label="Full Name"
                                    value={user.fullName}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <DetailRow
                                    icon={<Email />}
                                    label="Email Address"
                                    value={user.email}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <DetailRow
                                    icon={<Shield />}
                                    label="Role"
                                    value={<Chip label={user.role} color={getRoleColor(user.role)} size="small" />}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <DetailRow
                                    icon={<Shield />}
                                    label="Status"
                                    value={
                                        <Chip
                                            label={user.status.replace('_', ' ')}
                                            color={getStatusColor(user.status)}
                                            size="small"
                                        />
                                    }
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <DetailRow
                                    icon={<Business />}
                                    label="Tenant ID"
                                    value={user.tenantId}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <DetailRow
                                    icon={<Schedule />}
                                    label="Created"
                                    value={format(user.createdAt, 'MMM dd, yyyy HH:mm', { locale: dateFnsLocale(i18n.language) })}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <DetailRow
                                    icon={<Schedule />}
                                    label="Last Login"
                                    value={
                                        user.lastLoginAt
                                            ? format(user.lastLoginAt, 'MMM dd, yyyy HH:mm', { locale: dateFnsLocale(i18n.language) })
                                            : 'Never'
                                    }
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <DetailRow
                                    icon={<Schedule />}
                                    label="Last Updated"
                                    value={format(user.updatedAt, 'MMM dd, yyyy HH:mm', { locale: dateFnsLocale(i18n.language) })}
                                />
                            </Grid>
                        </Grid>
                    </Paper>
                </Grid>

                {/* User ID Card */}
                <Grid item xs={12}>
                    <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                        <Typography variant="caption" color="text.secondary">
                            User ID
                        </Typography>
                        <Typography variant="body2" fontFamily="monospace">
                            {user.id}
                        </Typography>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    )
}
