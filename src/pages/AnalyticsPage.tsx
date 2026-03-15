import { useCallback, useMemo } from 'react'
import {
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Grid,
    Typography,
    Alert,
} from '@mui/material'
import { Analytics, Download, TrendingUp } from '@mui/icons-material'
import {
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    RadialBarChart,
    RadialBar,
    AreaChart,
    Area,
} from 'recharts'
import { motion, Variants } from 'framer-motion'
import { useDashboard } from '@features/dashboard/hooks/useDashboard'
import { useAuditLogs } from '@features/auditLogs'

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

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6']

export default function AnalyticsPage() {
    const { stats, loading, error } = useDashboard()
    const { auditLogs, loading: logsLoading } = useAuditLogs()

    const handleExportCsv = useCallback(() => {
        if (!stats) return
        const rows: (string | number)[][] = [
            ['Metric', 'Value'],
            ['Active Users', stats.activeUsers],
            ['Inactive Users', stats.inactiveUsers],
            ['Suspended Users', stats.suspendedUsers],
            ['Total Enrollments', stats.totalEnrollments],
            ['Successful Enrollments', stats.successfulEnrollments],
            ['Failed Enrollments', stats.failedEnrollments],
            ['Total Verifications', stats.totalVerifications],
        ]
        const csvContent = rows.map(r => r.join(',')).join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `fivucsas-analytics-${new Date().toISOString().split('T')[0]}.csv`
        link.click()
        URL.revokeObjectURL(link.href)
    }, [stats])

    const userStatusData = useMemo(() => {
        if (!stats) return []
        return [
            { name: 'Active', value: stats.activeUsers, color: '#10b981' },
            { name: 'Inactive', value: stats.inactiveUsers, color: '#f59e0b' },
            { name: 'Suspended', value: stats.suspendedUsers, color: '#ef4444' },
        ].filter(d => d.value > 0)
    }, [stats])

    const enrollmentData = useMemo(() => {
        if (!stats) return []
        return [
            { name: 'Enrolled', value: stats.biometricEnrolledUsers, color: '#6366f1' },
            { name: 'Pending', value: stats.pendingEnrollments, color: '#f59e0b' },
            { name: 'Failed', value: stats.failedEnrollments, color: '#ef4444' },
        ].filter(d => d.value > 0)
    }, [stats])

    const successRateData = useMemo(() => {
        if (!stats) return []
        return [
            {
                name: 'Auth Success',
                value: stats.authSuccessRate,
                fill: '#6366f1',
            },
            {
                name: 'Verification',
                value: stats.verificationSuccessRate,
                fill: '#10b981',
            },
            {
                name: 'Enrollment',
                value: stats.enrollmentSuccessRate,
                fill: '#3b82f6',
            },
        ]
    }, [stats])

    const activityByAction = useMemo(() => {
        if (!auditLogs || auditLogs.length === 0) return []
        const counts: Record<string, number> = {}
        auditLogs.forEach(log => {
            const action = log.action.replace(/_/g, ' ')
            counts[action] = (counts[action] || 0) + 1
        })
        return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8)
    }, [auditLogs])

    const activityTimeline = useMemo(() => {
        if (!auditLogs || auditLogs.length === 0) return []
        const buckets: Record<string, { logins: number; failures: number; other: number }> = {}
        auditLogs.forEach(log => {
            const date = new Date(log.createdAt)
            const key = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
            if (!buckets[key]) buckets[key] = { logins: 0, failures: 0, other: 0 }
            if (log.action.includes('LOGIN') && !log.action.includes('FAILED')) {
                buckets[key].logins++
            } else if (log.action.includes('FAILED')) {
                buckets[key].failures++
            } else {
                buckets[key].other++
            }
        })
        return Object.entries(buckets)
            .map(([date, data]) => ({ date, ...data }))
            .slice(-14)
    }, [auditLogs])

    const platformMetrics = useMemo(() => {
        if (!stats) return []
        return [
            { name: 'Users', value: stats.totalUsers },
            { name: 'Tenants', value: stats.totalTenants },
            { name: 'Enrolled', value: stats.biometricEnrolledUsers },
            { name: 'Verifications', value: stats.totalVerifications },
        ]
    }, [stats])

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                <CircularProgress />
            </Box>
        )
    }

    if (error) {
        return (
            <Box>
                <Typography variant="h4" gutterBottom fontWeight={600}>Analytics</Typography>
                <Alert severity="error" sx={{ mt: 2 }}>
                    Failed to load analytics: {error.message}
                </Alert>
            </Box>
        )
    }

    return (
        <motion.div initial="hidden" animate="visible" variants={containerVariants}>
            <Box>
                <motion.div variants={itemVariants}>
                    <Box sx={{ mb: 4 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Analytics sx={{ color: 'primary.main', fontSize: 32 }} />
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
                                Analytics
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Typography variant="body1" color="text.secondary" sx={{ flex: 1 }}>
                                Visual insights from your identity platform data.
                            </Typography>
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<Download />}
                                onClick={handleExportCsv}
                                disabled={!stats}
                            >
                                Export CSV
                            </Button>
                        </Box>
                    </Box>
                </motion.div>

                <Grid container spacing={3}>
                    {/* Platform Overview Bar Chart */}
                    <Grid item xs={12} md={6}>
                        <motion.div variants={itemVariants}>
                            <Card sx={{ height: '100%' }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                                        Platform Overview
                                    </Typography>
                                    <ResponsiveContainer width="100%" height={280}>
                                        <BarChart data={platformMetrics}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                                            <XAxis dataKey="name" fontSize={12} />
                                            <YAxis fontSize={12} />
                                            <Tooltip
                                                contentStyle={{
                                                    borderRadius: 8,
                                                    border: '1px solid rgba(0,0,0,0.1)',
                                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                                }}
                                            />
                                            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                                {platformMetrics.map((_entry, index) => (
                                                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </Grid>

                    {/* Success Rates Radial Chart */}
                    <Grid item xs={12} md={6}>
                        <motion.div variants={itemVariants}>
                            <Card sx={{ height: '100%' }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                        <TrendingUp sx={{ color: 'success.main' }} />
                                        <Typography variant="h6" fontWeight={600}>
                                            Success Rates
                                        </Typography>
                                    </Box>
                                    <ResponsiveContainer width="100%" height={280}>
                                        <RadialBarChart
                                            cx="50%"
                                            cy="50%"
                                            innerRadius="30%"
                                            outerRadius="90%"
                                            data={successRateData}
                                            startAngle={180}
                                            endAngle={0}
                                        >
                                            <RadialBar
                                                dataKey="value"
                                                cornerRadius={8}
                                                label={{ position: 'insideStart', fill: '#fff', fontSize: 12 }}
                                            />
                                            <Legend
                                                iconSize={10}
                                                layout="horizontal"
                                                verticalAlign="bottom"
                                            />
                                            <Tooltip
                                                formatter={(value: number) => `${value.toFixed(1)}%`}
                                                contentStyle={{ borderRadius: 8 }}
                                            />
                                        </RadialBarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </Grid>

                    {/* User Status Distribution Pie */}
                    <Grid item xs={12} md={4}>
                        <motion.div variants={itemVariants}>
                            <Card sx={{ height: '100%' }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                                        User Status Distribution
                                    </Typography>
                                    {userStatusData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={250}>
                                            <PieChart>
                                                <Pie
                                                    data={userStatusData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={50}
                                                    outerRadius={80}
                                                    paddingAngle={4}
                                                    dataKey="value"
                                                    label={({ name, percent }) =>
                                                        `${name} ${(percent * 100).toFixed(0)}%`
                                                    }
                                                    labelLine={false}
                                                >
                                                    {userStatusData.map((entry, index) => (
                                                        <Cell key={index} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip contentStyle={{ borderRadius: 8 }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                            No user data
                                        </Typography>
                                    )}
                                </CardContent>
                            </Card>
                        </motion.div>
                    </Grid>

                    {/* Enrollment Status Pie */}
                    <Grid item xs={12} md={4}>
                        <motion.div variants={itemVariants}>
                            <Card sx={{ height: '100%' }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                                        Enrollment Status
                                    </Typography>
                                    {enrollmentData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={250}>
                                            <PieChart>
                                                <Pie
                                                    data={enrollmentData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={50}
                                                    outerRadius={80}
                                                    paddingAngle={4}
                                                    dataKey="value"
                                                    label={({ name, percent }) =>
                                                        `${name} ${(percent * 100).toFixed(0)}%`
                                                    }
                                                    labelLine={false}
                                                >
                                                    {enrollmentData.map((entry, index) => (
                                                        <Cell key={index} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip contentStyle={{ borderRadius: 8 }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                            No enrollment data
                                        </Typography>
                                    )}
                                </CardContent>
                            </Card>
                        </motion.div>
                    </Grid>

                    {/* Activity by Action Type */}
                    <Grid item xs={12} md={4}>
                        <motion.div variants={itemVariants}>
                            <Card sx={{ height: '100%' }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                                        Activity by Type
                                    </Typography>
                                    {!logsLoading && activityByAction.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={250}>
                                            <BarChart data={activityByAction} layout="vertical">
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                                                <XAxis type="number" fontSize={11} />
                                                <YAxis
                                                    type="category"
                                                    dataKey="name"
                                                    width={100}
                                                    fontSize={10}
                                                    tick={{ fill: '#64748b' }}
                                                />
                                                <Tooltip contentStyle={{ borderRadius: 8 }} />
                                                <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : logsLoading ? (
                                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                            <CircularProgress size={28} />
                                        </Box>
                                    ) : (
                                        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                            No activity data
                                        </Typography>
                                    )}
                                </CardContent>
                            </Card>
                        </motion.div>
                    </Grid>

                    {/* Activity Timeline */}
                    <Grid item xs={12}>
                        <motion.div variants={itemVariants}>
                            <Card>
                                <CardContent sx={{ p: 3 }}>
                                    <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                                        Activity Timeline
                                    </Typography>
                                    {!logsLoading && activityTimeline.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <AreaChart data={activityTimeline}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                                                <XAxis dataKey="date" fontSize={12} />
                                                <YAxis fontSize={12} />
                                                <Tooltip contentStyle={{ borderRadius: 8 }} />
                                                <Legend />
                                                <Area
                                                    type="monotone"
                                                    dataKey="logins"
                                                    stackId="1"
                                                    stroke="#10b981"
                                                    fill="#10b981"
                                                    fillOpacity={0.6}
                                                    name="Logins"
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey="failures"
                                                    stackId="1"
                                                    stroke="#ef4444"
                                                    fill="#ef4444"
                                                    fillOpacity={0.6}
                                                    name="Failures"
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey="other"
                                                    stackId="1"
                                                    stroke="#6366f1"
                                                    fill="#6366f1"
                                                    fillOpacity={0.6}
                                                    name="Other"
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : logsLoading ? (
                                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                            <CircularProgress size={28} />
                                        </Box>
                                    ) : (
                                        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                            No timeline data available
                                        </Typography>
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
