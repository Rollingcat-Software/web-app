import { memo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Alert,
    Avatar,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Grid,
    LinearProgress,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Typography,
} from '@mui/material'
import {
    CheckCircle,
    Delete,
    Edit,
    Error as ErrorIcon,
    Fingerprint,
    Login,
    Logout,
    People,
    Person,
    PersonAdd,
    Security,
    Settings,
    TrendingUp,
    Verified,
    Warning,
    Business,
    Face,
    PhonelinkLock,
    Email,
    SmsOutlined,
    QrCode2,
    Key,
    Mic,
    Nfc,
    ArrowForward,
    CalendarToday,
    Shield,
} from '@mui/icons-material'
import { motion, Variants } from 'framer-motion'
import { useDashboard } from '../hooks/useDashboard'
import { useAuditLogs } from '@features/auditLogs'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useUserEnrollments } from '@features/enrollments/hooks/useEnrollments'
import { AuditLog } from '@domain/models/AuditLog'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { container } from '@core/di/container'
import { TYPES } from '@core/di/types'
import type { IHttpClient } from '@domain/interfaces/IHttpClient'

// Bezier easing
const easeOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

// Animation variants
const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.08,
            delayChildren: 0.1,
        },
    },
}

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            duration: 0.5,
            ease: easeOut,
        },
    },
}

interface StatCardProps {
    title: string
    value: string | number
    icon: React.ReactNode
    color: string
    subtitle?: string
}

const StatCard = memo(function StatCard({
    title,
    value,
    icon,
    color,
    subtitle,
}: StatCardProps) {
    return (
        <motion.div
            variants={itemVariants}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
        >
            <Card
                sx={{
                    height: '100%',
                    position: 'relative',
                    overflow: 'hidden',
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '4px',
                        background: `linear-gradient(90deg, var(--mui-palette-${color}-main) 0%, var(--mui-palette-${color}-light) 100%)`,
                    },
                }}
            >
                <CardContent sx={{ p: 3 }}>
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                        }}
                    >
                        <Box sx={{ flex: 1 }}>
                            <Typography
                                color="text.secondary"
                                variant="body2"
                                sx={{ fontWeight: 500, mb: 1 }}
                            >
                                {title}
                            </Typography>
                            <Typography
                                variant="h4"
                                component="div"
                                sx={{
                                    fontWeight: 700,
                                    background:
                                        color === 'primary'
                                            ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                                            : undefined,
                                    backgroundClip: color === 'primary' ? 'text' : undefined,
                                    WebkitBackgroundClip: color === 'primary' ? 'text' : undefined,
                                    WebkitTextFillColor:
                                        color === 'primary' ? 'transparent' : undefined,
                                }}
                            >
                                {value}
                            </Typography>
                            {subtitle && (
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ mt: 1 }}
                                >
                                    {subtitle}
                                </Typography>
                            )}
                        </Box>
                        <Box
                            sx={{
                                p: 2,
                                borderRadius: 3,
                                background: `linear-gradient(135deg, ${
                                    color === 'primary'
                                        ? 'rgba(99, 102, 241, 0.1)'
                                        : color === 'success'
                                          ? 'rgba(16, 185, 129, 0.1)'
                                          : color === 'warning'
                                            ? 'rgba(245, 158, 11, 0.1)'
                                            : color === 'error'
                                              ? 'rgba(239, 68, 68, 0.1)'
                                              : 'rgba(59, 130, 246, 0.1)'
                                } 0%, ${
                                    color === 'primary'
                                        ? 'rgba(139, 92, 246, 0.1)'
                                        : color === 'success'
                                          ? 'rgba(52, 211, 153, 0.1)'
                                          : color === 'warning'
                                            ? 'rgba(251, 191, 36, 0.1)'
                                            : color === 'error'
                                              ? 'rgba(248, 113, 113, 0.1)'
                                              : 'rgba(96, 165, 250, 0.1)'
                                } 100%)`,
                                color: `${color}.main`,
                            }}
                        >
                            {icon}
                        </Box>
                    </Box>
                </CardContent>
            </Card>
        </motion.div>
    )
})

function getActivityIcon(action: string) {
    if (action.includes('LOGIN') && !action.includes('FAILED')) return <Login fontSize="small" color="success" />
    if (action.includes('FAILED')) return <Warning fontSize="small" color="error" />
    if (action.includes('LOGOUT')) return <Logout fontSize="small" color="action" />
    if (action.includes('CREATED')) return <Person fontSize="small" color="info" />
    if (action.includes('UPDATED')) return <Edit fontSize="small" color="warning" />
    if (action.includes('DELETED')) return <Delete fontSize="small" color="error" />
    if (action.includes('SETTINGS')) return <Settings fontSize="small" color="warning" />
    if (action.includes('BIOMETRIC') || action.includes('VERIFICATION'))
        return <Security fontSize="small" color="primary" />
    return <Security fontSize="small" />
}

function getActivityColor(action: string): 'success' | 'error' | 'warning' | 'info' | 'default' {
    if (action.includes('LOGIN') && !action.includes('FAILED')) return 'success'
    if (action.includes('CREATED')) return 'info'
    if (action.includes('DELETED') || action.includes('FAILED')) return 'error'
    if (action.includes('UPDATED') || action.includes('SETTINGS')) return 'warning'
    return 'default'
}

const RecentActivity = memo(function RecentActivity({ logs }: { logs: AuditLog[] }) {
    const { t } = useTranslation()
    const recentLogs = logs.slice(0, 8)

    if (recentLogs.length === 0) {
        return (
            <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                {t('dashboard.noRecentActivity')}
            </Typography>
        )
    }

    return (
        <List dense disablePadding>
            {recentLogs.map((log) => (
                <ListItem key={log.id} sx={{ px: 0, py: 0.75 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>{getActivityIcon(log.action)}</ListItemIcon>
                    <ListItemText
                        primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Chip
                                    label={log.action.replace(/_/g, ' ')}
                                    size="small"
                                    color={getActivityColor(log.action)}
                                    sx={{ fontSize: '0.7rem', height: 22 }}
                                />
                                <Typography variant="caption" color="text.secondary">
                                    User {log.userId}
                                </Typography>
                            </Box>
                        }
                        secondary={
                            <Typography variant="caption" color="text.secondary">
                                {format(new Date(log.createdAt), 'MMM dd, HH:mm:ss')}
                                {log.ipAddress && ` from ${log.ipAddress}`}
                            </Typography>
                        }
                    />
                </ListItem>
            ))}
        </List>
    )
})

/** Map auth method type to icon and label */
const METHOD_INFO: Record<string, { icon: React.ReactNode; label: string }> = {
    FACE: { icon: <Face sx={{ fontSize: 18 }} />, label: 'Face Recognition' },
    FINGERPRINT: { icon: <Fingerprint sx={{ fontSize: 18 }} />, label: 'Fingerprint' },
    VOICE: { icon: <Mic sx={{ fontSize: 18 }} />, label: 'Voice Recognition' },
    TOTP: { icon: <PhonelinkLock sx={{ fontSize: 18 }} />, label: 'Authenticator (TOTP)' },
    EMAIL_OTP: { icon: <Email sx={{ fontSize: 18 }} />, label: 'Email OTP' },
    SMS_OTP: { icon: <SmsOutlined sx={{ fontSize: 18 }} />, label: 'SMS OTP' },
    QR_CODE: { icon: <QrCode2 sx={{ fontSize: 18 }} />, label: 'QR Code' },
    HARDWARE_KEY: { icon: <Key sx={{ fontSize: 18 }} />, label: 'Hardware Key' },
    NFC_DOCUMENT: { icon: <Nfc sx={{ fontSize: 18 }} />, label: 'NFC Document' },
}

/**
 * Personal dashboard for non-admin users
 */
function UserDashboardContent() {
    const { user } = useAuth()
    const { t } = useTranslation()
    const navigate = useNavigate()
    const userId = user?.id ?? ''
    const { enrollments, loading: enrollmentsLoading } = useUserEnrollments(userId)

    // Fetch audit logs directly with error suppression — avoids 403 for non-admin users
    const [loginLogs, setLoginLogs] = useState<AuditLog[]>([])
    const [logsLoading, setLogsLoading] = useState(true)

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const httpClient = container.get<IHttpClient>(TYPES.HttpClient)
                const response = await httpClient.get<{ content?: AuditLog[]; items?: AuditLog[] }>('/my/activity', {
                    params: { page: 0, size: 10 }
                })
                const logs = response.data.content ?? response.data.items ?? (Array.isArray(response.data) ? response.data as unknown as AuditLog[] : [])
                setLoginLogs(logs.filter((l) => l.action === 'USER_LOGIN' || l.action === 'USER_LOGIN_FAILED').slice(0, 5))
            } catch {
                // Silently handle 403 — user doesn't have audit log permission
            } finally {
                setLogsLoading(false)
            }
        }
        if (userId) fetchLogs()
    }, [userId])

    const enrolledMethods = enrollments.filter((e) => e.isSuccessful())
    const loading = enrollmentsLoading || logsLoading

    return (
        <motion.div initial="hidden" animate="visible" variants={containerVariants}>
            <Box>
                {/* Welcome Header */}
                <motion.div variants={itemVariants}>
                    <Box sx={{ mb: 4 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                            <Avatar
                                sx={{
                                    width: 56,
                                    height: 56,
                                    bgcolor: 'primary.main',
                                    fontSize: '1.5rem',
                                    fontWeight: 700,
                                }}
                            >
                                {user?.firstName?.[0]}{user?.lastName?.[0]}
                            </Avatar>
                            <Box>
                                <Typography
                                    variant="h4"
                                    sx={{
                                        fontWeight: 700,
                                        background: 'linear-gradient(135deg, #1e293b 0%, #475569 100%)',
                                        backgroundClip: 'text',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                    }}
                                >
                                    {t('dashboard.welcome', { name: user?.firstName || 'User', defaultValue: `Welcome back, ${user?.firstName || 'User'}` })}
                                </Typography>
                                <Typography variant="body1" color="text.secondary">
                                    {t('dashboard.personalSummary', 'Here is your account overview')}
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                </motion.div>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Grid container spacing={3}>
                        {/* Account Info Card */}
                        <Grid item xs={12} md={6}>
                            <motion.div variants={itemVariants}>
                                <Card sx={{ height: '100%' }}>
                                    <CardContent sx={{ p: 3 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                            <Person sx={{ color: 'primary.main' }} />
                                            <Typography variant="h6" fontWeight={600}>
                                                {t('dashboard.accountInfo', 'Account Information')}
                                            </Typography>
                                        </Box>
                                        <List dense disablePadding>
                                            <ListItem sx={{ px: 0 }}>
                                                <ListItemIcon sx={{ minWidth: 36 }}>
                                                    <Email fontSize="small" color="action" />
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={<Typography variant="body2" color="text.secondary">Email</Typography>}
                                                    secondary={<Typography variant="body1">{user?.email}</Typography>}
                                                />
                                            </ListItem>
                                            <ListItem sx={{ px: 0 }}>
                                                <ListItemIcon sx={{ minWidth: 36 }}>
                                                    <Shield fontSize="small" color="action" />
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={<Typography variant="body2" color="text.secondary">Role</Typography>}
                                                    secondary={
                                                        <Chip
                                                            label={user?.role?.replace(/_/g, ' ')}
                                                            size="small"
                                                            color="primary"
                                                            variant="outlined"
                                                            sx={{ mt: 0.5 }}
                                                        />
                                                    }
                                                />
                                            </ListItem>
                                            <ListItem sx={{ px: 0 }}>
                                                <ListItemIcon sx={{ minWidth: 36 }}>
                                                    <Business fontSize="small" color="action" />
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={<Typography variant="body2" color="text.secondary">Tenant</Typography>}
                                                    secondary={<Typography variant="body1">{user?.tenantId ? 'Marmara University' : 'Default'}</Typography>}
                                                />
                                            </ListItem>
                                            <ListItem sx={{ px: 0 }}>
                                                <ListItemIcon sx={{ minWidth: 36 }}>
                                                    <CalendarToday fontSize="small" color="action" />
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={<Typography variant="body2" color="text.secondary">Member Since</Typography>}
                                                    secondary={
                                                        <Typography variant="body1">
                                                            {user?.createdAt ? format(new Date(user.createdAt), 'MMMM dd, yyyy') : 'N/A'}
                                                        </Typography>
                                                    }
                                                />
                                            </ListItem>
                                        </List>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        </Grid>

                        {/* Enrolled Methods Card */}
                        <Grid item xs={12} md={6}>
                            <motion.div variants={itemVariants}>
                                <Card sx={{ height: '100%' }}>
                                    <CardContent sx={{ p: 3 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Fingerprint sx={{ color: 'primary.main' }} />
                                                <Typography variant="h6" fontWeight={600}>
                                                    {t('dashboard.enrolledMethods', 'Enrolled Methods')}
                                                </Typography>
                                            </Box>
                                            <Chip
                                                label={`${enrolledMethods.length} active`}
                                                size="small"
                                                color={enrolledMethods.length > 0 ? 'success' : 'default'}
                                            />
                                        </Box>

                                        {enrolledMethods.length === 0 ? (
                                            <Box sx={{ textAlign: 'center', py: 3 }}>
                                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                                    {t('dashboard.noEnrollments', 'No authentication methods enrolled yet.')}
                                                </Typography>
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    onClick={() => navigate('/enrollment')}
                                                    endIcon={<ArrowForward />}
                                                >
                                                    {t('dashboard.enrollNow', 'Enroll Now')}
                                                </Button>
                                            </Box>
                                        ) : (
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                {enrolledMethods.map((enrollment) => {
                                                    const methodType = enrollment.authMethodType || ''
                                                    const info = METHOD_INFO[methodType] || {
                                                        icon: <Security sx={{ fontSize: 18 }} />,
                                                        label: methodType.replace(/_/g, ' '),
                                                    }
                                                    return (
                                                        <Box
                                                            key={enrollment.id}
                                                            sx={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 1.5,
                                                                p: 1.5,
                                                                borderRadius: 2,
                                                                bgcolor: 'rgba(16, 185, 129, 0.06)',
                                                                border: '1px solid',
                                                                borderColor: 'rgba(16, 185, 129, 0.2)',
                                                            }}
                                                        >
                                                            <Box sx={{ color: 'success.main' }}>{info.icon}</Box>
                                                            <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>
                                                                {info.label}
                                                            </Typography>
                                                            <CheckCircle sx={{ fontSize: 18, color: 'success.main' }} />
                                                        </Box>
                                                    )
                                                })}
                                            </Box>
                                        )}
                                    </CardContent>
                                </Card>
                            </motion.div>
                        </Grid>

                        {/* Recent Login Activity */}
                        <Grid item xs={12}>
                            <motion.div variants={itemVariants}>
                                <Card>
                                    <CardContent sx={{ p: 3 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                            <Login sx={{ color: 'primary.main' }} />
                                            <Typography variant="h6" fontWeight={600}>
                                                {t('dashboard.recentLogins', 'Recent Login Activity')}
                                            </Typography>
                                        </Box>

                                        {loginLogs.length === 0 ? (
                                            <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                                                {t('dashboard.noLoginHistory', 'No recent login activity')}
                                            </Typography>
                                        ) : (
                                            <List dense disablePadding>
                                                {loginLogs.map((log) => (
                                                    <ListItem key={log.id} sx={{ px: 0, py: 0.75 }}>
                                                        <ListItemIcon sx={{ minWidth: 36 }}>
                                                            {log.action === 'USER_LOGIN'
                                                                ? <Login fontSize="small" color="success" />
                                                                : <Warning fontSize="small" color="error" />}
                                                        </ListItemIcon>
                                                        <ListItemText
                                                            primary={
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                    <Chip
                                                                        label={log.action === 'USER_LOGIN' ? 'Successful Login' : 'Failed Login'}
                                                                        size="small"
                                                                        color={log.action === 'USER_LOGIN' ? 'success' : 'error'}
                                                                        sx={{ fontSize: '0.7rem', height: 22 }}
                                                                    />
                                                                    {log.ipAddress && (
                                                                        <Typography variant="caption" color="text.secondary">
                                                                            from {log.ipAddress}
                                                                        </Typography>
                                                                    )}
                                                                </Box>
                                                            }
                                                            secondary={
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {format(new Date(log.createdAt), 'MMM dd, yyyy HH:mm:ss')}
                                                                    {log.userAgent && ` -- ${log.userAgent.substring(0, 60)}${log.userAgent.length > 60 ? '...' : ''}`}
                                                                </Typography>
                                                            }
                                                        />
                                                    </ListItem>
                                                ))}
                                            </List>
                                        )}
                                    </CardContent>
                                </Card>
                            </motion.div>
                        </Grid>

                        {/* Quick Actions */}
                        <Grid item xs={12}>
                            <motion.div variants={itemVariants}>
                                <Card>
                                    <CardContent sx={{ p: 3 }}>
                                        <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                                            {t('dashboard.quickActions', 'Quick Actions')}
                                        </Typography>
                                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                            <Button
                                                variant="outlined"
                                                startIcon={<Fingerprint />}
                                                onClick={() => navigate('/enrollment')}
                                                sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600 }}
                                            >
                                                {t('dashboard.manageEnrollments', 'Manage Enrollments')}
                                            </Button>
                                            <Button
                                                variant="outlined"
                                                startIcon={<Security />}
                                                onClick={() => navigate('/biometric-tools')}
                                                sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600 }}
                                            >
                                                {t('dashboard.biometricTools', 'Biometric Tools')}
                                            </Button>
                                            <Button
                                                variant="outlined"
                                                startIcon={<Settings />}
                                                onClick={() => navigate('/settings')}
                                                sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600 }}
                                            >
                                                {t('dashboard.settingsAction', 'Settings')}
                                            </Button>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        </Grid>
                    </Grid>
                )}
            </Box>
        </motion.div>
    )
}

function AdminDashboardContent() {
    const { stats, loading, error } = useDashboard()
    const { auditLogs, loading: logsLoading } = useAuditLogs()
    const { t } = useTranslation()

    if (loading) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: 400,
                    gap: 2,
                }}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                        <CircularProgress
                            size={60}
                            thickness={2}
                            sx={{ color: 'primary.lighter' }}
                            variant="determinate"
                            value={100}
                        />
                        <CircularProgress
                            size={60}
                            thickness={2}
                            sx={{ position: 'absolute', left: 0, color: 'primary.main' }}
                        />
                    </Box>
                </motion.div>
                <Typography variant="body2" color="text.secondary" fontWeight={500}>
                    {t('dashboard.loadingDashboard')}
                </Typography>
            </Box>
        )
    }

    if (error) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <Box>
                    <Typography variant="h4" gutterBottom fontWeight={600}>
                        {t('dashboard.title')}
                    </Typography>
                    <Alert
                        severity="error"
                        sx={{
                            mt: 2,
                            borderRadius: 3,
                            '& .MuiAlert-icon': {
                                fontSize: 28,
                            },
                        }}
                    >
                        {t('dashboard.failedToLoad')}: {error.message}
                    </Alert>
                </Box>
            </motion.div>
        )
    }

    if (!stats) {
        return (
            <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="text.secondary">{t('common.noData')}</Typography>
            </Box>
        )
    }

    return (
        <motion.div initial="hidden" animate="visible" variants={containerVariants}>
            <Box>
                {/* Header */}
                <motion.div variants={itemVariants}>
                    <Box sx={{ mb: 4 }}>
                        <Typography
                            variant="h4"
                            sx={{
                                fontWeight: 700,
                                background: 'linear-gradient(135deg, #1e293b 0%, #475569 100%)',
                                backgroundClip: 'text',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                mb: 1,
                            }}
                        >
                            {t('dashboard.title')}
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            {t('dashboard.subtitle')}
                        </Typography>
                    </Box>
                </motion.div>

                <Grid container spacing={3}>
                    {/* Stat Cards - Row 1 */}
                    <Grid item xs={12} sm={6} md={4}>
                        <StatCard
                            title={t('dashboard.totalUsers')}
                            value={stats.totalUsers.toLocaleString()}
                            icon={<People sx={{ fontSize: 28 }} />}
                            color="primary"
                        />
                    </Grid>

                    <Grid item xs={12} sm={6} md={4}>
                        <StatCard
                            title={t('dashboard.activeUsers')}
                            value={stats.activeUsers.toLocaleString()}
                            icon={<CheckCircle sx={{ fontSize: 28 }} />}
                            color="success"
                            subtitle={`${stats.activeUserPercentage.toFixed(1)}% ${t('dashboard.ofTotal')}`}
                        />
                    </Grid>

                    <Grid item xs={12} sm={6} md={4}>
                        <StatCard
                            title={t('dashboard.totalTenants')}
                            value={stats.totalTenants.toLocaleString()}
                            icon={<Business sx={{ fontSize: 28 }} />}
                            color="info"
                        />
                    </Grid>

                    {/* Stat Cards - Row 2 */}
                    <Grid item xs={12} sm={6} md={4}>
                        <StatCard
                            title={t('dashboard.biometricEnrolled')}
                            value={stats.biometricEnrolledUsers.toLocaleString()}
                            icon={<Fingerprint sx={{ fontSize: 28 }} />}
                            color="success"
                            subtitle={`${stats.totalUsers > 0 ? ((stats.biometricEnrolledUsers / stats.totalUsers) * 100).toFixed(1) : 0}% ${t('dashboard.ofUsers')}`}
                        />
                    </Grid>

                    <Grid item xs={12} sm={6} md={4}>
                        <StatCard
                            title={t('dashboard.pendingEnrollments')}
                            value={stats.pendingEnrollments.toLocaleString()}
                            icon={<PersonAdd sx={{ fontSize: 28 }} />}
                            color="warning"
                            subtitle={t('dashboard.awaitingEnrollment')}
                        />
                    </Grid>

                    <Grid item xs={12} sm={6} md={4}>
                        <StatCard
                            title={t('dashboard.failedEnrollments')}
                            value={stats.failedEnrollments.toLocaleString()}
                            icon={<ErrorIcon sx={{ fontSize: 28 }} />}
                            color="error"
                            subtitle={stats.failedEnrollments > 0 ? t('dashboard.requiresAttention') : t('dashboard.noFailures')}
                        />
                    </Grid>

                    {/* System Metrics */}
                    <Grid item xs={12}>
                        <motion.div variants={itemVariants}>
                            <Card>
                                <CardContent sx={{ p: 3 }}>
                                    <Typography variant="h6" fontWeight={600} sx={{ mb: 3 }}>
                                        {t('dashboard.systemMetrics')}
                                    </Typography>
                                    <Grid container spacing={3}>
                                        <Grid item xs={12} sm={6} md={3}>
                                            <Box
                                                sx={{
                                                    p: 2.5,
                                                    bgcolor: 'rgba(99, 102, 241, 0.08)',
                                                    borderRadius: 3,
                                                    border: '1px solid',
                                                    borderColor: 'rgba(99, 102, 241, 0.2)',
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 1,
                                                        mb: 1,
                                                    }}
                                                >
                                                    <TrendingUp sx={{ color: 'primary.main', fontSize: 20 }} />
                                                    <Typography variant="body2" color="text.secondary">
                                                        {t('dashboard.authSuccessRate')}
                                                    </Typography>
                                                </Box>
                                                <Typography variant="h5" fontWeight={700}>
                                                    {stats.authSuccessRate.toFixed(1)}%
                                                </Typography>
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={stats.authSuccessRate}
                                                    sx={{
                                                        mt: 1.5,
                                                        height: 6,
                                                        borderRadius: 3,
                                                        bgcolor: 'rgba(99, 102, 241, 0.2)',
                                                        '& .MuiLinearProgress-bar': {
                                                            bgcolor: 'primary.main',
                                                            borderRadius: 3,
                                                        },
                                                    }}
                                                />
                                            </Box>
                                        </Grid>
                                        <Grid item xs={12} sm={6} md={3}>
                                            <Box
                                                sx={{
                                                    p: 2.5,
                                                    bgcolor: 'rgba(16, 185, 129, 0.08)',
                                                    borderRadius: 3,
                                                    border: '1px solid',
                                                    borderColor: 'rgba(16, 185, 129, 0.2)',
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 1,
                                                        mb: 1,
                                                    }}
                                                >
                                                    <Verified sx={{ color: 'success.main', fontSize: 20 }} />
                                                    <Typography variant="body2" color="text.secondary">
                                                        {t('dashboard.verificationRate')}
                                                    </Typography>
                                                </Box>
                                                <Typography variant="h5" fontWeight={700} color="success.main">
                                                    {stats.verificationSuccessRate.toFixed(1)}%
                                                </Typography>
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={stats.verificationSuccessRate}
                                                    sx={{
                                                        mt: 1.5,
                                                        height: 6,
                                                        borderRadius: 3,
                                                        bgcolor: 'rgba(16, 185, 129, 0.2)',
                                                        '& .MuiLinearProgress-bar': {
                                                            bgcolor: 'success.main',
                                                            borderRadius: 3,
                                                        },
                                                    }}
                                                />
                                            </Box>
                                        </Grid>
                                        <Grid item xs={12} sm={6} md={3}>
                                            <Box
                                                sx={{
                                                    p: 2.5,
                                                    bgcolor: 'rgba(99, 102, 241, 0.08)',
                                                    borderRadius: 3,
                                                    border: '1px solid',
                                                    borderColor: 'rgba(99, 102, 241, 0.2)',
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 1,
                                                        mb: 1,
                                                    }}
                                                >
                                                    <Fingerprint sx={{ color: 'primary.main', fontSize: 20 }} />
                                                    <Typography variant="body2" color="text.secondary">
                                                        {t('dashboard.totalVerifications')}
                                                    </Typography>
                                                </Box>
                                                <Typography variant="h5" fontWeight={700}>
                                                    {stats.totalVerifications.toLocaleString()}
                                                </Typography>
                                            </Box>
                                        </Grid>
                                        <Grid item xs={12} sm={6} md={3}>
                                            <Box
                                                sx={{
                                                    p: 2.5,
                                                    bgcolor: 'rgba(59, 130, 246, 0.08)',
                                                    borderRadius: 3,
                                                    border: '1px solid',
                                                    borderColor: 'rgba(59, 130, 246, 0.2)',
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 1,
                                                        mb: 1,
                                                    }}
                                                >
                                                    <People sx={{ color: 'info.main', fontSize: 20 }} />
                                                    <Typography variant="body2" color="text.secondary">
                                                        {t('dashboard.avgVerifications')}
                                                    </Typography>
                                                </Box>
                                                <Typography variant="h5" fontWeight={700}>
                                                    {stats.averageVerificationsPerUser.toFixed(1)}
                                                </Typography>
                                            </Box>
                                        </Grid>
                                    </Grid>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </Grid>
                    {/* Recent Activity Feed */}
                    <Grid item xs={12}>
                        <motion.div variants={itemVariants}>
                            <Card>
                                <CardContent sx={{ p: 3 }}>
                                    <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                                        {t('dashboard.recentActivity')}
                                    </Typography>
                                    {logsLoading ? (
                                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                                            <CircularProgress size={28} />
                                        </Box>
                                    ) : (
                                        <RecentActivity logs={auditLogs} />
                                    )}
                                </CardContent>
                            </Card>
                        </motion.div>
                    </Grid>
                </Grid>
            </Box>
        </motion.div>
    )
}

export default function DashboardPage() {
    const { user } = useAuth()

    if (!user?.isAdmin()) {
        return <UserDashboardContent />
    }

    return <AdminDashboardContent />
}
