import {useState} from 'react'
import {Link as RouterLink, Outlet, useLocation} from 'react-router-dom'
import {Box, Breadcrumbs, Link, Typography, useMediaQuery, useTheme} from '@mui/material'
import {NavigateNext} from '@mui/icons-material'
import {useTranslation} from 'react-i18next'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

const DRAWER_WIDTH = 260

const BREADCRUMB_I18N_MAP: Record<string, string> = {
    users: 'nav.users',
    tenants: 'nav.tenants',
    enrollments: 'nav.enrollments',
    'user-enrollment': 'nav.userEnrollment',
    enrollment: 'enrollmentPage.title',
    'audit-logs': 'nav.auditLogs',
    'auth-flows': 'nav.authFlows',
    'auth-sessions': 'nav.authSessions',
    devices: 'nav.devices',
    roles: 'nav.roles',
    guests: 'nav.guests',
    'voice-search': 'nav.voiceSearch',
    'nfc-enrollment': 'nav.nfcEnrollment',
    'my-profile': 'nav.myProfile',
    analytics: 'nav.analytics',
    settings: 'nav.settings',
    'biometric-tools': 'nav.biometricTools',
    'verification-flows': 'nav.verificationFlows',
    'verification-dashboard': 'nav.verificationDashboard',
    'verification-sessions': 'nav.verificationSessions',
    'widget-demo': 'nav.widgetDemo',
    'developer-portal': 'nav.developerPortal',
    create: 'common.create',
    edit: 'common.edit',
}

function PageBreadcrumbs() {
    const location = useLocation()
    const {t} = useTranslation()
    const pathSegments = location.pathname.split('/').filter(Boolean)

    if (pathSegments.length === 0) return null

    return (
        <Breadcrumbs
            separator={<NavigateNext fontSize="small" />}
            sx={{ mb: 2 }}
            aria-label="breadcrumb"
        >
            <Link component={RouterLink} to="/" underline="hover" color="inherit">
                {t('nav.dashboard')}
            </Link>
            {pathSegments.map((segment, index) => {
                const isLast = index === pathSegments.length - 1
                const path = '/' + pathSegments.slice(0, index + 1).join('/')
                const i18nKey = BREADCRUMB_I18N_MAP[segment]
                const label = i18nKey ? t(i18nKey) : segment

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
    const {t} = useTranslation()

    const handleDrawerToggle = () => {
        setMobileOpen(prev => !prev)
    }

    return (
        <Box sx={{display: 'flex', minHeight: '100vh'}}>
            {/* Skip to main content link (a11y FE-H4).
                Visually hidden until focused — first focusable element so
                keyboard / screen-reader users can bypass the nav. */}
            <Box
                component="a"
                href="#main-content"
                sx={{
                    position: 'absolute',
                    left: -9999,
                    top: 8,
                    zIndex: 2000,
                    padding: '8px 16px',
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                    textDecoration: 'none',
                    borderRadius: 1,
                    fontWeight: 600,
                    '&:focus': { left: 8 },
                }}
            >
                {t('common.skipToContent')}
            </Box>

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
                id="main-content"
                tabIndex={-1}
                sx={{
                    flexGrow: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    p: { xs: 1.5, sm: 3 },
                    width: {xs: '100%', md: `calc(100% - ${DRAWER_WIDTH}px)`},
                    maxWidth: '100vw',
                    overflowX: 'hidden',
                    boxSizing: 'border-box',
                    mt: {xs: '56px', sm: '64px'},
                    backgroundColor: 'background.default',
                    minHeight: {xs: 'calc(100vh - 56px)', sm: 'calc(100vh - 64px)'},
                }}
            >
                <PageBreadcrumbs/>
                <Box sx={{ flexGrow: 1 }}>
                    <Outlet/>
                </Box>
                <Box
                    component="footer"
                    sx={{
                        mt: 4,
                        pt: 2,
                        pb: 1,
                        textAlign: 'center',
                        borderTop: '1px solid',
                        borderColor: 'divider',
                    }}
                >
                    <Typography variant="caption" color="text.disabled" display="block">
                        {t('footer.platform')}
                    </Typography>
                    <Box sx={{ mt: 0.5, display: 'flex', justifyContent: 'center', gap: 2 }}>
                        <Link component={RouterLink} to="/terms" variant="caption" color="text.disabled" underline="hover">
                            {t('footer.terms')}
                        </Link>
                        <Link component={RouterLink} to="/privacy" variant="caption" color="text.disabled" underline="hover">
                            {t('footer.privacy')}
                        </Link>
                    </Box>
                    <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.25 }}>
                        {t('footer.copyright')}
                    </Typography>
                    <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.25, opacity: 0.7 }}>
                        {t('footer.version')}
                    </Typography>
                </Box>
            </Box>
        </Box>
    )
}
