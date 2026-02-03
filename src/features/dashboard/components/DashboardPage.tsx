import { memo } from 'react'
import { Alert, Box, Card, CardContent, Chip, CircularProgress, Grid, Typography } from '@mui/material'
import { Info } from '@mui/icons-material'
import {
    CheckCircle,
    Error,
    Fingerprint,
    People,
    PersonAdd,
    TrendingUp,
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
import { useDashboard } from '../hooks/useDashboard'

interface StatCardProps {
    title: string
    value: string | number
    icon: React.ReactNode
    color: string
    subtitle?: string
}

const StatCard = memo(function StatCard({ title, value, icon, color, subtitle }: StatCardProps) {
    return (
        <Card sx={{ height: '100%' }}>
            <CardContent>
                <Box
                    sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
                >
                    <Box>
                        <Typography color="text.secondary" gutterBottom variant="body2">
                            {title}
                        </Typography>
                        <Typography variant="h4" component="div" fontWeight={600}>
                            {value}
                        </Typography>
                        {subtitle && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                {subtitle}
                            </Typography>
                        )}
                    </Box>
                    <Box
                        sx={{
                            p: 1.5,
                            borderRadius: 2,
                            backgroundColor: `${color}.lighter`,
                            color: `${color}.main`,
                        }}
                    >
                        {icon}
                    </Box>
                </Box>
            </CardContent>
        </Card>
    )
})

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

const COLORS = ['#1976d2', '#9c27b0', '#2e7d32', '#ed6c02']

function SampleDataIndicator() {
    return (
        <Chip
            icon={<Info fontSize="small" />}
            label="Sample Data"
            size="small"
            color="info"
            variant="outlined"
            sx={{ ml: 1 }}
        />
    )
}

export default function DashboardPage() {
    const { stats, loading, error } = useDashboard()

    if (loading) {
        return (
            <Box
                sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}
            >
                <CircularProgress aria-label="Loading dashboard" />
            </Box>
        )
    }

    if (error) {
        return (
            <Box>
                <Typography variant="h4" gutterBottom fontWeight={600}>
                    Dashboard
                </Typography>
                <Alert severity="error" sx={{ mt: 2 }}>
                    Failed to load dashboard statistics: {error.message}
                </Alert>
            </Box>
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
        <Box>
            <Typography variant="h4" gutterBottom fontWeight={600}>
                Dashboard
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Welcome back! Here's what's happening with your platform.
            </Typography>

            <Grid container spacing={3}>
                {/* Total Users */}
                <Grid item xs={12} sm={6} md={4}>
                    <StatCard
                        title="Total Users"
                        value={stats.totalUsers.toLocaleString()}
                        icon={<People sx={{ fontSize: 32 }} />}
                        color="primary"
                    />
                </Grid>

                {/* Active Users */}
                <Grid item xs={12} sm={6} md={4}>
                    <StatCard
                        title="Active Users"
                        value={stats.activeUsers.toLocaleString()}
                        icon={<CheckCircle sx={{ fontSize: 32 }} />}
                        color="success"
                        subtitle={`${stats.activeUserPercentage.toFixed(1)}% of total`}
                    />
                </Grid>

                {/* Pending Enrollments */}
                <Grid item xs={12} sm={6} md={4}>
                    <StatCard
                        title="Pending Enrollments"
                        value={stats.pendingEnrollments}
                        icon={<PersonAdd sx={{ fontSize: 32 }} />}
                        color="warning"
                    />
                </Grid>

                {/* Successful Enrollments */}
                <Grid item xs={12} sm={6} md={4}>
                    <StatCard
                        title="Successful Enrollments"
                        value={stats.successfulEnrollments.toLocaleString()}
                        icon={<Fingerprint sx={{ fontSize: 32 }} />}
                        color="success"
                    />
                </Grid>

                {/* Failed Enrollments */}
                <Grid item xs={12} sm={6} md={4}>
                    <StatCard
                        title="Failed Enrollments"
                        value={stats.failedEnrollments}
                        icon={<Error sx={{ fontSize: 32 }} />}
                        color="error"
                    />
                </Grid>

                {/* Auth Success Rate */}
                <Grid item xs={12} sm={6} md={4}>
                    <StatCard
                        title="Auth Success Rate"
                        value={`${stats.authSuccessRate}%`}
                        icon={<TrendingUp sx={{ fontSize: 32 }} />}
                        color="info"
                    />
                </Grid>

                {/* User Growth Chart */}
                <Grid item xs={12} md={8}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Typography variant="h6" fontWeight={600}>
                                    User Growth Trend
                                </Typography>
                                <SampleDataIndicator />
                            </Box>
                            <Box sx={{ width: '100%', height: 300, mt: 2 }}>
                                <ResponsiveContainer>
                                    <LineChart data={userGrowthData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="month" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Line
                                            type="monotone"
                                            dataKey="users"
                                            stroke="#1976d2"
                                            strokeWidth={2}
                                            name="Total Users"
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Authentication Methods Pie Chart */}
                <Grid item xs={12} md={4}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Typography variant="h6" fontWeight={600}>
                                    Authentication Methods
                                </Typography>
                                <SampleDataIndicator />
                            </Box>
                            <Box sx={{ width: '100%', height: 300, mt: 2 }}>
                                <ResponsiveContainer>
                                    <PieChart>
                                        <Pie
                                            data={authMethodsData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) =>
                                                `${name} ${(percent * 100).toFixed(0)}%`
                                            }
                                            outerRadius={80}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {authMethodsData.map((entry, index) => (
                                                <Cell
                                                    key={entry.name}
                                                    fill={COLORS[index % COLORS.length]}
                                                />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Enrollment Trends Bar Chart */}
                <Grid item xs={12}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Typography variant="h6" fontWeight={600}>
                                    Enrollment Success vs Failed
                                </Typography>
                                <SampleDataIndicator />
                            </Box>
                            <Box sx={{ width: '100%', height: 300, mt: 2 }}>
                                <ResponsiveContainer>
                                    <BarChart data={enrollmentTrendData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="month" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="success" fill="#2e7d32" name="Successful" />
                                        <Bar dataKey="failed" fill="#d32f2f" name="Failed" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* System Overview */}
                <Grid item xs={12}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom fontWeight={600}>
                                System Overview
                            </Typography>
                            <Grid container spacing={2} sx={{ mt: 1 }}>
                                <Grid item xs={12} sm={6} md={3}>
                                    <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            Verification Success Rate
                                        </Typography>
                                        <Typography variant="h5" fontWeight={600} color="success.main">
                                            {stats.verificationSuccessRate}%
                                        </Typography>
                                    </Box>
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                    <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            Total Enrollments
                                        </Typography>
                                        <Typography variant="h5" fontWeight={600}>
                                            {stats.totalEnrollments.toLocaleString()}
                                        </Typography>
                                    </Box>
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                    <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            Average Response Time
                                        </Typography>
                                        <Typography variant="h5" fontWeight={600}>
                                            145ms
                                        </Typography>
                                    </Box>
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                    <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            System Uptime
                                        </Typography>
                                        <Typography variant="h5" fontWeight={600} color="success.main">
                                            99.9%
                                        </Typography>
                                    </Box>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    )
}
