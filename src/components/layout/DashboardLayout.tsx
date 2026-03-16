import {useState} from 'react'
import {Link as RouterLink, Outlet, useLocation} from 'react-router-dom'
import {Box, Breadcrumbs, Link, Typography, useMediaQuery, useTheme} from '@mui/material'
import {NavigateNext} from '@mui/icons-material'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

const DRAWER_WIDTH = 260

const BREADCRUMB_MAP: Record<string, string> = {
    users: 'Users',
    tenants: 'Tenants',
    enrollments: 'Enrollments',
    'user-enrollment': 'Identity Enrollment',
    'audit-logs': 'Audit Logs',
    'auth-flows': 'Auth Flows',
    'auth-sessions': 'Auth Sessions',
    devices: 'Devices',
    roles: 'Roles',
    guests: 'Guests',
    analytics: 'Analytics',
    settings: 'Settings',
    create: 'Create',
    edit: 'Edit',
}

function PageBreadcrumbs() {
    const location = useLocation()
    const pathSegments = location.pathname.split('/').filter(Boolean)

    if (pathSegments.length === 0) return null

    return (
        <Breadcrumbs
            separator={<NavigateNext fontSize="small" />}
            sx={{ mb: 2 }}
            aria-label="breadcrumb"
        >
            <Link component={RouterLink} to="/" underline="hover" color="inherit">
                Dashboard
            </Link>
            {pathSegments.map((segment, index) => {
                const isLast = index === pathSegments.length - 1
                const path = '/' + pathSegments.slice(0, index + 1).join('/')
                const label = BREADCRUMB_MAP[segment] || segment

                // Skip UUID segments in display
                if (/^[0-9a-f-]{36}$/i.test(segment)) return null

                if (isLast) {
                    return (
                        <Typography key={path} color="text.primary" fontWeight={500}>
                            {label}
                        </Typography>
                    )
                }

                return (
                    <Link key={path} component={RouterLink} to={path} underline="hover" color="inherit">
                        {label}
                    </Link>
                )
            })}
        </Breadcrumbs>
    )
}

export default function DashboardLayout() {
    const theme = useTheme()
    const isMobile = useMediaQuery(theme.breakpoints.down('md'))
    const [mobileOpen, setMobileOpen] = useState(false)

    const handleDrawerToggle = () => {
        setMobileOpen(prev => !prev)
    }

    return (
        <Box sx={{display: 'flex', minHeight: '100vh'}}>
            {/* Top Bar */}
            <TopBar
                drawerWidth={DRAWER_WIDTH}
                onMenuClick={handleDrawerToggle}
            />

            {/* Sidebar */}
            <Sidebar
                drawerWidth={DRAWER_WIDTH}
                mobileOpen={mobileOpen}
                onMobileClose={handleDrawerToggle}
                isMobile={isMobile}
            />

            {/* Main Content */}
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: 3,
                    width: {md: `calc(100% - ${DRAWER_WIDTH}px)`},
                    mt: {xs: '56px', sm: '64px'},
                    backgroundColor: 'background.default',
                    minHeight: {xs: 'calc(100vh - 56px)', sm: 'calc(100vh - 64px)'},
                }}
            >
                <PageBreadcrumbs/>
                <Outlet/>
            </Box>
        </Box>
    )
}
