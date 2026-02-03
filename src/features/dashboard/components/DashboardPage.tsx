import { memo } from 'react'
import {
    Alert,
    Box,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Grid,
    LinearProgress,
    Typography,
} from '@mui/material'
import {
    CheckCircle,
    Error as ErrorIcon,
    Fingerprint,
    Info,
    People,
    PersonAdd,
    Speed,
    TrendingUp,
    Verified,
} from '@mui/icons-material'
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'
import { motion, Variants } from 'framer-motion'
import { useDashboard } from '../hooks/useDashboard'

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
    trend?: number
}

const StatCard = memo(function StatCard({
    title,
    value,
    icon,
    color,
    subtitle,
    trend,
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
                                    sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}
                                >
                                    {trend !== undefined && (
                                        <TrendingUp
                                            sx={{
                                                fontSize: 16,
                                                color: trend >= 0 ? 'success.main' : 'error.main',
                                                transform: trend < 0 ? 'rotate(180deg)' : 'none',
                                            }}
                                        />
                                    )}
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

// Chart colors matching the new theme
const CHART_COLORS = {
    primary: '#6366f1',
    secondary: '#8b5cf6',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
}

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b']

// Mock data for charts
const userGrowthData = [
    { month: 'Jan', users: 850 },
    { month: 'Feb', users: 920 },
    { month: 'Mar', users: 980 },
    { month: 'Apr', users: 1050 },
    { month: 'May', users: 1120 },
    { month: 'Jun', users: 1190 },
    { month: 'Jul', users: 1247 },
]

const enrollmentTrendData = [
    { month: 'Jan', success: 45, failed: 3 },
    { month: 'Feb', success: 52, failed: 4 },
    { month: 'Mar', success: 48, failed: 2 },
    { month: 'Apr', success: 61, failed: 5 },
    { month: 'May', success: 58, failed: 3 },
    { month: 'Jun', success: 67, failed: 4 },
    { month: 'Jul', success: 72, failed: 2 },
]

const authMethodsData = [
    { name: 'Biometric', value: 65 },
    { name: 'Password', value: 25 },
    { name: '2FA', value: 10 },
]

function SampleDataIndicator() {
    return (
        <Chip
            icon={<Info fontSize="small" />}
            label="Sample Data"
            size="small"
            sx={{
                ml: 1,
                bgcolor: 'rgba(99, 102, 241, 0.1)',
                color: 'primary.main',
                border: '1px solid',
                borderColor: 'primary.light',
                fontWeight: 500,
            }}
        />
    )
}

// Custom tooltip for charts
const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
    if (active && payload && payload.length) {
        return (
            <Box
                sx={{
                    bgcolor: 'background.paper',
                    p: 1.5,
                    borderRadius: 2,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    border: '1px solid',
                    borderColor: 'divider',
                }}
            >
                <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                    {label}
                </Typography>
                {payload.map((item, index) => (
                    <Typography
                        key={index}
                        variant="body2"
                        sx={{ color: item.color, display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                        <Box
                            component="span"
                            sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                bgcolor: item.color,
                            }}
                        />
                        {item.name}: {item.value.toLocaleString()}
                    </Typography>
                ))}
            </Box>
        )
    }
    return null
}

export default function DashboardPage() {
    const { stats, loading, error } = useDashboard()

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
                    Loading dashboard...
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
                        Dashboard
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
                        Failed to load dashboard statistics: {error.message}
                    </Alert>
                </Box>
            </motion.div>
        )
    }

    if (!stats) {
        return (
            <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="text.secondary">No data available</Typography>
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
                            Dashboard
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Welcome back! Here's what's happening with your identity platform.
                        </Typography>
                    </Box>
                </motion.div>

                <Grid container spacing={3}>
                    {/* Stat Cards */}
                    <Grid item xs={12} sm={6} md={4}>
                        <StatCard
                            title="Total Users"
                            value={stats.totalUsers.toLocaleString()}
                            icon={<People sx={{ fontSize: 28 }} />}
                            color="primary"
                            trend={12.5}
                            subtitle="+12.5% from last month"
                        />
                    </Grid>

                    <Grid item xs={12} sm={6} md={4}>
                        <StatCard
                            title="Active Users"
                            value={stats.activeUsers.toLocaleString()}
                            icon={<CheckCircle sx={{ fontSize: 28 }} />}
                            color="success"
                            subtitle={`${stats.activeUserPercentage.toFixed(1)}% of total`}
                        />
                    </Grid>

                    <Grid item xs={12} sm={6} md={4}>
                        <StatCard
                            title="Pending Enrollments"
                            value={stats.pendingEnrollments}
                            icon={<PersonAdd sx={{ fontSize: 28 }} />}
                            color="warning"
                            subtitle="Awaiting verification"
                        />
                    </Grid>

                    <Grid item xs={12} sm={6} md={4}>
                        <StatCard
                            title="Successful Enrollments"
                            value={stats.successfulEnrollments.toLocaleString()}
                            icon={<Fingerprint sx={{ fontSize: 28 }} />}
                            color="success"
                            trend={8.3}
                            subtitle="+8.3% this week"
                        />
                    </Grid>

                    <Grid item xs={12} sm={6} md={4}>
                        <StatCard
                            title="Failed Enrollments"
                            value={stats.failedEnrollments}
                            icon={<ErrorIcon sx={{ fontSize: 28 }} />}
                            color="error"
                            subtitle="Requires attention"
                        />
                    </Grid>

                    <Grid item xs={12} sm={6} md={4}>
                        <StatCard
                            title="Auth Success Rate"
                            value={`${stats.authSuccessRate}%`}
                            icon={<TrendingUp sx={{ fontSize: 28 }} />}
                            color="info"
                            subtitle="Last 30 days average"
                        />
                    </Grid>

                    {/* User Growth Chart */}
                    <Grid item xs={12} md={8}>
                        <motion.div variants={itemVariants}>
                            <Card>
                                <CardContent sx={{ p: 3 }}>
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            mb: 3,
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                            <Typography variant="h6" fontWeight={600}>
                                                User Growth Trend
                                            </Typography>
                                            <SampleDataIndicator />
                                        </Box>
                                    </Box>
                                    <Box sx={{ width: '100%', height: 300 }}>
                                        <ResponsiveContainer>
                                            <LineChart data={userGrowthData}>
                                                <defs>
                                                    <linearGradient
                                                        id="userGradient"
                                                        x1="0"
                                                        y1="0"
                                                        x2="0"
                                                        y2="1"
                                                    >
                                                        <stop
                                                            offset="5%"
                                                            stopColor={CHART_COLORS.primary}
                                                            stopOpacity={0.3}
                                                        />
                                                        <stop
                                                            offset="95%"
                                                            stopColor={CHART_COLORS.primary}
                                                            stopOpacity={0}
                                                        />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid
                                                    strokeDasharray="3 3"
                                                    stroke="#e2e8f0"
                                                    vertical={false}
                                                />
                                                <XAxis
                                                    dataKey="month"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                                />
                                                <YAxis
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                                />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Line
                                                    type="monotone"
                                                    dataKey="users"
                                                    stroke={CHART_COLORS.primary}
                                                    strokeWidth={3}
                                                    name="Total Users"
                                                    dot={{
                                                        fill: CHART_COLORS.primary,
                                                        strokeWidth: 2,
                                                        r: 4,
                                                    }}
                                                    activeDot={{
                                                        r: 6,
                                                        fill: CHART_COLORS.primary,
                                                        stroke: '#fff',
                                                        strokeWidth: 2,
                                                    }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </Box>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </Grid>

                    {/* Authentication Methods Pie Chart */}
                    <Grid item xs={12} md={4}>
                        <motion.div variants={itemVariants}>
                            <Card sx={{ height: '100%' }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                                        <Typography variant="h6" fontWeight={600}>
                                            Auth Methods
                                        </Typography>
                                        <SampleDataIndicator />
                                    </Box>
                                    <Box sx={{ width: '100%', height: 220 }}>
                                        <ResponsiveContainer>
                                            <PieChart>
                                                <Pie
                                                    data={authMethodsData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={50}
                                                    outerRadius={80}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {authMethodsData.map((entry, index) => (
                                                        <Cell
                                                            key={entry.name}
                                                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                                                        />
                                                    ))}
                                                </Pie>
                                                <Tooltip content={<CustomTooltip />} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </Box>
                                    {/* Legend */}
                                    <Box sx={{ mt: 2 }}>
                                        {authMethodsData.map((item, index) => (
                                            <Box
                                                key={item.name}
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    py: 0.5,
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 1,
                                                    }}
                                                >
                                                    <Box
                                                        sx={{
                                                            width: 10,
                                                            height: 10,
                                                            borderRadius: '50%',
                                                            bgcolor: PIE_COLORS[index],
                                                        }}
                                                    />
                                                    <Typography variant="body2" color="text.secondary">
                                                        {item.name}
                                                    </Typography>
                                                </Box>
                                                <Typography variant="body2" fontWeight={600}>
                                                    {item.value}%
                                                </Typography>
                                            </Box>
                                        ))}
                                    </Box>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </Grid>

                    {/* Enrollment Trends Bar Chart */}
                    <Grid item xs={12}>
                        <motion.div variants={itemVariants}>
                            <Card>
                                <CardContent sx={{ p: 3 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                                        <Typography variant="h6" fontWeight={600}>
                                            Enrollment Trends
                                        </Typography>
                                        <SampleDataIndicator />
                                    </Box>
                                    <Box sx={{ width: '100%', height: 300 }}>
                                        <ResponsiveContainer>
                                            <BarChart data={enrollmentTrendData} barGap={8}>
                                                <CartesianGrid
                                                    strokeDasharray="3 3"
                                                    stroke="#e2e8f0"
                                                    vertical={false}
                                                />
                                                <XAxis
                                                    dataKey="month"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                                />
                                                <YAxis
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                                />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Legend
                                                    wrapperStyle={{ paddingTop: 20 }}
                                                    iconType="circle"
                                                />
                                                <Bar
                                                    dataKey="success"
                                                    fill={CHART_COLORS.success}
                                                    name="Successful"
                                                    radius={[4, 4, 0, 0]}
                                                />
                                                <Bar
                                                    dataKey="failed"
                                                    fill={CHART_COLORS.error}
                                                    name="Failed"
                                                    radius={[4, 4, 0, 0]}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </Box>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </Grid>

                    {/* System Overview */}
                    <Grid item xs={12}>
                        <motion.div variants={itemVariants}>
                            <Card>
                                <CardContent sx={{ p: 3 }}>
                                    <Typography variant="h6" fontWeight={600} sx={{ mb: 3 }}>
                                        System Overview
                                    </Typography>
                                    <Grid container spacing={3}>
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
                                                        Verification Rate
                                                    </Typography>
                                                </Box>
                                                <Typography variant="h5" fontWeight={700} color="success.main">
                                                    {stats.verificationSuccessRate}%
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
                                                        Total Enrollments
                                                    </Typography>
                                                </Box>
                                                <Typography variant="h5" fontWeight={700}>
                                                    {stats.totalEnrollments.toLocaleString()}
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
                                                    <Speed sx={{ color: 'info.main', fontSize: 20 }} />
                                                    <Typography variant="body2" color="text.secondary">
                                                        Avg Response Time
                                                    </Typography>
                                                </Box>
                                                <Typography variant="h5" fontWeight={700}>
                                                    145ms
                                                </Typography>
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
                                                    <CheckCircle sx={{ color: 'success.main', fontSize: 20 }} />
                                                    <Typography variant="body2" color="text.secondary">
                                                        System Uptime
                                                    </Typography>
                                                </Box>
                                                <Typography variant="h5" fontWeight={700} color="success.main">
                                                    99.9%
                                                </Typography>
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={99.9}
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
                                    </Grid>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </Grid>
                </Grid>
            </Box>
        </motion.div>
    )
}
