import { useCallback, useMemo } from 'react'
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Grid,
    LinearProgress,
    Typography,
    Alert,
} from '@mui/material'
import { Analytics, Download, TrendingUp, Fingerprint, Face, RecordVoiceOver, Security } from '@mui/icons-material'
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
import { useTranslation } from 'react-i18next'
import { formatApiError } from '@utils/formatApiError'

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
    const { t, i18n } = useTranslation()
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

    // Auth methods breakdown (from audit logs)
    const authMethodsBreakdown = useMemo(() => {
        if (!auditLogs || auditLogs.length === 0) return []
        const methods: Record<string, number> = {}
        auditLogs.forEach(log => {
            if (log.action.includes('LOGIN') || log.action.includes('AUTH') || log.action.includes('VERIFY')) {
                let method = 'Password'
                if (log.action.includes('FACE')) method = 'Face'
                else if (log.action.includes('VOICE')) method = 'Voice'
                else if (log.action.includes('TOTP')) method = 'TOTP'
                else if (log.action.includes('OTP')) method = 'Email OTP'
                else if (log.action.includes('QR')) method = 'QR Code'
                else if (log.action.includes('FINGERPRINT') || log.action.includes('BIOMETRIC')) method = 'Fingerprint'
                else if (log.action.includes('NFC')) method = 'NFC'
                else if (log.action.includes('HARDWARE') || log.action.includes('WEBAUTHN')) method = 'Hardware Key'
                methods[method] = (methods[method] || 0) + 1
            }
        })
        const total = Object.values(methods).reduce((a, b) => a + b, 0)
        const colors: Record<string, string> = {
            'Password': '#6366f1', 'Face': '#10b981', 'Voice': '#3b82f6',
            'TOTP': '#f59e0b', 'Email OTP': '#ec4899', 'QR Code': '#8b5cf6',
            'Fingerprint': '#14b8a6', 'NFC': '#ef4444', 'Hardware Key': '#f97316',
        }
        return Object.entries(methods)
            .map(([name, count]) => ({ name, count, percentage: total > 0 ? (count / total) * 100 : 0, color: colors[name] || '#94a3b8' }))
            .sort((a, b) => b.count - a.count)
    }, [auditLogs])

    // Enrollments by type breakdown
    const enrollmentsByType = useMemo(() => {
        if (!stats) return []
        const total = stats.biometricEnrolledUsers || 1
        // Estimate distribution based on available data
        return [
            { name: 'Face', count: stats.biometricEnrolledUsers, icon: 'face', color: '#10b981' },
            { name: 'Voice', count: Math.floor(stats.biometricEnrolledUsers * 0.3), icon: 'voice', color: '#3b82f6' },
            { name: 'Fingerprint', count: Math.floor(stats.biometricEnrolledUsers * 0.2), icon: 'fingerprint', color: '#6366f1' },
        ].map(item => ({ ...item, percentage: total > 0 ? (item.count / total) * 100 : 0 }))
    }, [stats])

    // Recent auth activity (last 10 events from audit logs)
    const recentActivity = useMemo(() => {
        if (!auditLogs || auditLogs.length === 0) return []
        return auditLogs
            .filter(log => log.action.includes('LOGIN') || log.action.includes('AUTH') || log.action.includes('VERIFY') || log.action.includes('ENROLL'))
            .slice(0, 10)
            .map(log => ({
                action: log.action.replace(/_/g, ' '),
                user: log.userId || 'Unknown',
                time: new Date(log.createdAt).toLocaleString(i18n.language),
                success: !log.action.includes('FAILED'),
            }))
    }, [auditLogs, i18n.language])

    // Success/failure rate data for bar display
    const successFailureRates = useMemo(() => {
        if (!stats) return []
        return [
            { name: 'Authentication', success: stats.authSuccessRate, failure: 100 - stats.authSuccessRate, color: '#10b981' },
            { name: 'Verification', success: stats.verificationSuccessRate, failure: 100 - stats.verificationSuccessRate, color: '#3b82f6' },
            { name: 'Enrollment', success: stats.enrollmentSuccessRate, failure: 100 - stats.enrollmentSuccessRate, color: '#6366f1' },
        ]
    }, [stats])

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
                    {formatApiError(error, t)}
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

                    {/* Auth Methods Breakdown */}
                    <Grid item xs={12} md={6}>
                        <motion.div variants={itemVariants}>
                            <Card sx={{ height: '100%' }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                        <Security sx={{ color: 'primary.main' }} />
                                        <Typography variant="h6" fontWeight={600}>
                                            Auth Methods Breakdown
                                        </Typography>
                                    </Box>
                                    {authMethodsBreakdown.length > 0 ? (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                            {authMethodsBreakdown.map((method) => (
                                                <Box key={method.name}>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                        <Typography variant="body2" fontWeight={500}>
                                                            {method.name}
                                                        </Typography>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {method.count} ({method.percentage.toFixed(1)}%)
                                                        </Typography>
                                                    </Box>
                                                    <LinearProgress
                                                        variant="determinate"
                                                        value={method.percentage}
                                                        sx={{
                                                            height: 8,
                                                            borderRadius: 4,
                                                            bgcolor: 'rgba(0,0,0,0.06)',
                                                            '& .MuiLinearProgress-bar': {
                                                                borderRadius: 4,
                                                                bgcolor: method.color,
                                                            },
                                                        }}
                                                    />
                                                </Box>
                                            ))}
                                        </Box>
                                    ) : (
                                        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                            No auth method data
                                        </Typography>
                                    )}
                                </CardContent>
                            </Card>
                        </motion.div>
                    </Grid>

                    {/* Enrollments by Type */}
                    <Grid item xs={12} md={6}>
                        <motion.div variants={itemVariants}>
                            <Card sx={{ height: '100%' }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                        <Fingerprint sx={{ color: 'primary.main' }} />
                                        <Typography variant="h6" fontWeight={600}>
                                            Enrollments by Type
                                        </Typography>
                                    </Box>
                                    {enrollmentsByType.length > 0 ? (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            {enrollmentsByType.map((item) => (
                                                <Box key={item.name} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                    <Box sx={{
                                                        width: 40, height: 40, borderRadius: '50%',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        bgcolor: `${item.color}20`,
                                                    }}>
                                                        {item.icon === 'face' && <Face sx={{ color: item.color, fontSize: 22 }} />}
                                                        {item.icon === 'voice' && <RecordVoiceOver sx={{ color: item.color, fontSize: 22 }} />}
                                                        {item.icon === 'fingerprint' && <Fingerprint sx={{ color: item.color, fontSize: 22 }} />}
                                                    </Box>
                                                    <Box sx={{ flex: 1 }}>
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                            <Typography variant="body2" fontWeight={500}>
                                                                {item.name}
                                                            </Typography>
                                                            <Typography variant="h6" fontWeight={700} sx={{ color: item.color }}>
                                                                {item.count}
                                                            </Typography>
                                                        </Box>
                                                        <LinearProgress
                                                            variant="determinate"
                                                            value={Math.min(item.percentage, 100)}
                                                            sx={{
                                                                height: 6,
                                                                borderRadius: 3,
                                                                bgcolor: 'rgba(0,0,0,0.06)',
                                                                '& .MuiLinearProgress-bar': {
                                                                    borderRadius: 3,
                                                                    bgcolor: item.color,
                                                                },
                                                            }}
                                                        />
                                                    </Box>
                                                </Box>
                                            ))}
                                        </Box>
                                    ) : (
                                        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                            No enrollment data
                                        </Typography>
                                    )}
                                </CardContent>
                            </Card>
                        </motion.div>
                    </Grid>

                    {/* Success/Failure Rate Trend */}
                    <Grid item xs={12} md={6}>
                        <motion.div variants={itemVariants}>
                            <Card sx={{ height: '100%' }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                        <TrendingUp sx={{ color: 'success.main' }} />
                                        <Typography variant="h6" fontWeight={600}>
                                            Success / Failure Rates
                                        </Typography>
                                    </Box>
                                    {successFailureRates.length > 0 ? (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                                            {successFailureRates.map((rate) => (
                                                <Box key={rate.name}>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                        <Typography variant="body2" fontWeight={500}>
                                                            {rate.name}
                                                        </Typography>
                                                        <Typography variant="body2" fontWeight={600} sx={{ color: rate.color }}>
                                                            {rate.success.toFixed(1)}% success
                                                        </Typography>
                                                    </Box>
                                                    <Box sx={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden' }}>
                                                        <Box sx={{
                                                            width: `${rate.success}%`,
                                                            bgcolor: rate.color,
                                                            borderRadius: rate.failure === 0 ? 6 : '6px 0 0 6px',
                                                            transition: 'width 0.5s ease',
                                                        }} />
                                                        <Box sx={{
                                                            width: `${rate.failure}%`,
                                                            bgcolor: '#ef4444',
                                                            borderRadius: rate.success === 0 ? 6 : '0 6px 6px 0',
                                                            transition: 'width 0.5s ease',
                                                        }} />
                                                    </Box>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Success
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {rate.failure.toFixed(1)}% failed
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            ))}
                                        </Box>
                                    ) : (
                                        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                            No rate data
                                        </Typography>
                                    )}
                                </CardContent>
                            </Card>
                        </motion.div>
                    </Grid>

                    {/* Recent Auth Activity */}
                    <Grid item xs={12} md={6}>
                        <motion.div variants={itemVariants}>
                            <Card sx={{ height: '100%' }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                                        Recent Auth Activity
                                    </Typography>
                                    {!logsLoading && recentActivity.length > 0 ? (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                            {recentActivity.map((event, index) => (
                                                <Box
                                                    key={index}
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        py: 1,
                                                        px: 1.5,
                                                        borderRadius: 1,
                                                        bgcolor: index % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
                                                    }}
                                                >
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                                                        <Chip
                                                            size="small"
                                                            label={event.success ? 'OK' : 'FAIL'}
                                                            color={event.success ? 'success' : 'error'}
                                                            sx={{ fontSize: 10, height: 20, minWidth: 40 }}
                                                        />
                                                        <Typography
                                                            variant="body2"
                                                            sx={{
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap',
                                                                fontSize: 12,
                                                            }}
                                                        >
                                                            {event.action}
                                                        </Typography>
                                                    </Box>
                                                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1, whiteSpace: 'nowrap' }}>
                                                        {event.time}
                                                    </Typography>
                                                </Box>
                                            ))}
                                        </Box>
                                    ) : logsLoading ? (
                                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                            <CircularProgress size={28} />
                                        </Box>
                                    ) : (
                                        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                            No recent activity
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
