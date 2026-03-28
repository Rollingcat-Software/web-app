import { useEffect, useMemo, useState } from 'react'
import {
    Alert,
    Box,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    FormControl,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material'
import {
    VerifiedUser,
    CheckCircle,
    Timer,
    ErrorOutline,
} from '@mui/icons-material'
import {
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts'
import { motion, Variants } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useVerification } from '@hooks/useVerification'
import { useNavigate } from 'react-router-dom'

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1, delayChildren: 0.1 },
    },
}

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

const PIE_COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#94a3b8']

export default function VerificationDashboardPage() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const {
        stats,
        sessions,
        loading,
        error,
        loadStats,
        loadSessions,
        clearError,
    } = useVerification()

    const [statusFilter, setStatusFilter] = useState<string>('all')

    useEffect(() => {
        loadStats()
        loadSessions()
    }, [loadStats, loadSessions])

    const filteredSessions = useMemo(() => {
        if (statusFilter === 'all') return sessions
        return sessions.filter(s => s.status === statusFilter)
    }, [sessions, statusFilter])

    const statusDistData = useMemo(() => {
        if (!stats?.statusDistribution) return []
        return stats.statusDistribution.map(d => ({
            name: d.status.replace(/_/g, ' '),
            value: d.count,
        }))
    }, [stats])

    const dailyData = useMemo(() => {
        if (!stats?.dailyVerifications) return []
        return stats.dailyVerifications.slice(-30).map(d => ({
            date: d.date.slice(5), // MM-DD format
            count: d.count,
        }))
    }, [stats])

    const failureData = useMemo(() => {
        if (!stats?.failureReasons) return []
        return stats.failureReasons.slice(0, 8)
    }, [stats])

    const statusChipColor = (status: string): 'success' | 'warning' | 'info' | 'error' | 'default' => {
        if (status === 'completed') return 'success'
        if (status === 'failed') return 'error'
        if (status === 'in_progress') return 'info'
        if (status === 'pending') return 'warning'
        return 'default'
    }

    if (loading && !stats) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                <CircularProgress />
            </Box>
        )
    }

    return (
        <motion.div initial="hidden" animate="visible" variants={containerVariants}>
            <Box>
                <motion.div variants={itemVariants}>
                    <Box sx={{ mb: 4 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <VerifiedUser sx={{ color: 'primary.main', fontSize: 32 }} />
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
                                {t('verification.dashboardTitle')}
                            </Typography>
                        </Box>
                        <Typography variant="body1" color="text.secondary">
                            {t('verification.dashboardSubtitle')}
                        </Typography>
                    </Box>
                </motion.div>

                {error && (
                    <Alert severity="error" onClose={clearError} sx={{ mb: 3 }}>
                        {error}
                    </Alert>
                )}

                {/* Overview stat cards */}
                <Grid container spacing={3} sx={{ mb: 3 }}>
                    {[
                        {
                            label: t('verification.totalVerifications'),
                            value: stats?.totalVerifications ?? 0,
                            icon: <VerifiedUser />,
                            color: '#6366f1',
                        },
                        {
                            label: t('verification.completionRate'),
                            value: `${(stats?.completionRate ?? 0).toFixed(1)}%`,
                            icon: <CheckCircle />,
                            color: '#10b981',
                        },
                        {
                            label: t('verification.avgTime'),
                            value: `${(stats?.avgTimeMinutes ?? 0).toFixed(1)} min`,
                            icon: <Timer />,
                            color: '#3b82f6',
                        },
                        {
                            label: t('verification.failureRate'),
                            value: `${(stats?.failureRate ?? 0).toFixed(1)}%`,
                            icon: <ErrorOutline />,
                            color: '#ef4444',
                        },
                    ].map((card, idx) => (
                        <Grid item xs={12} sm={6} md={3} key={idx}>
                            <motion.div variants={itemVariants}>
                                <Card>
                                    <CardContent sx={{ p: 3 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                            <Box
                                                sx={{
                                                    width: 48,
                                                    height: 48,
                                                    borderRadius: 2,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    bgcolor: `${card.color}15`,
                                                    color: card.color,
                                                }}
                                            >
                                                {card.icon}
                                            </Box>
                                            <Box>
                                                <Typography variant="h5" fontWeight={700}>
                                                    {card.value}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {card.label}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        </Grid>
                    ))}
                </Grid>

                {/* Charts row */}
                <Grid container spacing={3} sx={{ mb: 3 }}>
                    {/* Verifications per day */}
                    <Grid item xs={12} md={8}>
                        <motion.div variants={itemVariants}>
                            <Card sx={{ height: '100%' }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                                        {t('verification.dailyChart')}
                                    </Typography>
                                    {dailyData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <BarChart data={dailyData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                                                <XAxis dataKey="date" fontSize={11} />
                                                <YAxis fontSize={12} />
                                                <Tooltip contentStyle={{ borderRadius: 8 }} />
                                                <Bar
                                                    dataKey="count"
                                                    fill="#6366f1"
                                                    radius={[4, 4, 0, 0]}
                                                    name={t('verification.verifications')}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
                                            {t('common.noData')}
                                        </Typography>
                                    )}
                                </CardContent>
                            </Card>
                        </motion.div>
                    </Grid>

                    {/* Status distribution pie */}
                    <Grid item xs={12} md={4}>
                        <motion.div variants={itemVariants}>
                            <Card sx={{ height: '100%' }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                                        {t('verification.statusDistribution')}
                                    </Typography>
                                    {statusDistData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <PieChart>
                                                <Pie
                                                    data={statusDistData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={50}
                                                    outerRadius={90}
                                                    paddingAngle={3}
                                                    dataKey="value"
                                                    label={({ name, percent }) =>
                                                        `${name} ${(percent * 100).toFixed(0)}%`
                                                    }
                                                    labelLine={false}
                                                >
                                                    {statusDistData.map((_entry, index) => (
                                                        <Cell
                                                            key={index}
                                                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                                                        />
                                                    ))}
                                                </Pie>
                                                <Tooltip contentStyle={{ borderRadius: 8 }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
                                            {t('common.noData')}
                                        </Typography>
                                    )}
                                </CardContent>
                            </Card>
                        </motion.div>
                    </Grid>
                </Grid>

                {/* Failure reasons chart */}
                <Grid container spacing={3} sx={{ mb: 3 }}>
                    <Grid item xs={12}>
                        <motion.div variants={itemVariants}>
                            <Card>
                                <CardContent sx={{ p: 3 }}>
                                    <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                                        {t('verification.failureReasons')}
                                    </Typography>
                                    {failureData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={280}>
                                            <BarChart data={failureData} layout="vertical">
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                                                <XAxis type="number" fontSize={12} />
                                                <YAxis
                                                    type="category"
                                                    dataKey="reason"
                                                    width={180}
                                                    fontSize={11}
                                                    tick={{ fill: '#64748b' }}
                                                />
                                                <Tooltip contentStyle={{ borderRadius: 8 }} />
                                                <Bar
                                                    dataKey="count"
                                                    fill="#ef4444"
                                                    radius={[0, 4, 4, 0]}
                                                    name={t('verification.failures')}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                            {t('common.noData')}
                                        </Typography>
                                    )}
                                </CardContent>
                            </Card>
                        </motion.div>
                    </Grid>
                </Grid>

                {/* Recent sessions table */}
                <motion.div variants={itemVariants}>
                    <Card>
                        <CardContent sx={{ p: 3 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                <Typography variant="h6" fontWeight={600}>
                                    {t('verification.recentSessions')}
                                </Typography>
                                <FormControl size="small" sx={{ minWidth: 150 }}>
                                    <InputLabel>{t('common.status')}</InputLabel>
                                    <Select
                                        value={statusFilter}
                                        label={t('common.status')}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                    >
                                        <MenuItem value="all">{t('common.all')}</MenuItem>
                                        <MenuItem value="completed">{t('verification.statusCompleted')}</MenuItem>
                                        <MenuItem value="pending">{t('common.pending')}</MenuItem>
                                        <MenuItem value="in_progress">{t('verification.statusInProgress')}</MenuItem>
                                        <MenuItem value="failed">{t('verification.statusFailed')}</MenuItem>
                                    </Select>
                                </FormControl>
                            </Box>

                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>{t('verification.sessionId')}</TableCell>
                                            <TableCell>{t('verification.flow')}</TableCell>
                                            <TableCell>{t('verification.progress')}</TableCell>
                                            <TableCell>{t('common.status')}</TableCell>
                                            <TableCell>{t('verification.startedAt')}</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredSessions.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} align="center">
                                                    <Typography color="text.secondary" sx={{ py: 3 }}>
                                                        {t('common.noData')}
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredSessions.slice(0, 20).map((session) => (
                                                <TableRow
                                                    key={session.id}
                                                    hover
                                                    sx={{ cursor: 'pointer' }}
                                                    onClick={() => navigate(`/verification-sessions/${session.id}`)}
                                                >
                                                    <TableCell>
                                                        <Typography variant="body2" fontFamily="monospace" fontSize={12}>
                                                            {session.id.slice(0, 8)}...
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>{session.flowName}</TableCell>
                                                    <TableCell>
                                                        {session.currentStep}/{session.totalSteps}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={session.status.replace(/_/g, ' ')}
                                                            size="small"
                                                            color={statusChipColor(session.status)}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        {new Date(session.startedAt).toLocaleString()}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </CardContent>
                    </Card>
                </motion.div>
            </Box>
        </motion.div>
    )
}
