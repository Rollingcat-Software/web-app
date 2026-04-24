import {useState} from 'react'
import {Link as RouterLink, Outlet, useLocation} from 'react-router-dom'
import {
    alpha,
    Box,
    Breadcrumbs,
    Link,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material'
import {NavigateNext} from '@mui/icons-material'
import {useTranslation} from 'react-i18next'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

const DRAWER_WIDTH = 260

// PRESERVED: breadcrumb map (do not change keys — used by every deep route).
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
    'biometric-puzzles': 'nav.biometricPuzzles',
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
            separator={<NavigateNext fontSize="small" sx={{ color: 'text.disabled' }}/>}
            sx={{
                mb: 2.5,
                '& .MuiBreadcrumbs-ol': { flexWrap: 'wrap' },
            }}
            aria-label="breadcrumb"
        >
            <Link
                component={RouterLink}
                to="/"
                underline="hover"
                color="text.secondary"
                sx={{
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    '&:hover': { color: 'primary.main' },
                }}
            >
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
                        <Typography
                            key={path}
                            color="text.primary"
                            sx={{ fontSize: '0.8125rem', fontWeight: 600 }}
                        >
                            {label}
                        </Typography>
                    )
                }

                return (
                    <Link
                        key={path}
                        component={RouterLink}
                        to={path}
                        underline="hover"
                        color="text.secondary"
                        sx={{
                            fontSize: '0.8125rem',
                            fontWeight: 500,
                            '&:hover': { color: 'primary.main' },
                        }}
                    >
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
    const isDark = theme.palette.mode === 'dark'

    const handleDrawerToggle = () => {
        setMobileOpen(prev => !prev)
    }

    return (
        <Box
            sx={{
                display: 'flex',
                minHeight: '100vh',
                // Subtle ambient background
                background: isDark
                    ? 'radial-gradient(1200px 600px at 20% -10%, rgba(99,102,241,0.08), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(139,92,246,0.06), transparent 55%), #0f1220'
                    : 'radial-gradient(1200px 600px at 20% -10%, rgba(99,102,241,0.06), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(139,92,246,0.04), transparent 55%), #f8fafc',
            }}
        >
            {/* Skip to main content (a11y FE-H4).
                Visually hidden until focused. */}
            <Box
                component="a"
                href="#main-content"
                sx={{
                    position: 'absolute',
                    left: -9999,
                    top: 8,
                    zIndex: 2000,
                    padding: '10px 18px',
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                    textDecoration: 'none',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    boxShadow: '0 8px 20px -6px rgba(99,102,241,0.55)',
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
                    p: { xs: 1.75, sm: 3, md: 4 },
                    width: {xs: '100%', md: `calc(100% - ${DRAWER_WIDTH}px)`},
                    maxWidth: '100vw',
                    overflowX: 'hidden',
                    boxSizing: 'border-box',
                    mt: {xs: '56px', sm: '64px'},
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
                        mt: 6,
                        pt: 3,
                        pb: 1.5,
                        textAlign: 'center',
                        borderTop: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                    }}
                >
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        sx={{ fontWeight: 600, letterSpacing: '0.01em' }}
                    >
                        {t('footer.platform')}
                    </Typography>
                    <Box sx={{ mt: 0.75, display: 'flex', justifyContent: 'center', gap: 2.5 }}>
                        <Link
                            component={RouterLink}
                            to="/terms"
                            variant="caption"
                            color="text.secondary"
                            underline="hover"
                            sx={{ fontWeight: 500, '&:hover': { color: 'primary.main' } }}
                        >
                            {t('footer.terms')}
                        </Link>
                        <Link
                            component={RouterLink}
                            to="/privacy"
                            variant="caption"
                            color="text.secondary"
                            underline="hover"
                            sx={{ fontWeight: 500, '&:hover': { color: 'primary.main' } }}
                        >
                            {t('footer.privacy')}
                        </Link>
                    </Box>
                    <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.5 }}>
                        {t('footer.copyright')}
                    </Typography>
                    <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.25, opacity: 0.65, fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: '0.7rem' }}>
                        {t('footer.version')}
                    </Typography>
                </Box>
            </Box>
        </Box>
    )
}
